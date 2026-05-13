import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { v4 as uuidv4 } from "uuid";

// Mock BullMQ queue
vi.mock("../queue.js", () => ({
  videoQueue: {
    add: vi.fn(),
    getJob: vi.fn(),
  },
  QUEUE_NAME: "video-processing",
  createQueueConnection: vi.fn(),
  closeQueueConnection: vi.fn(),
}));

// Mock progress tracking module
vi.mock("../progress.js", () => ({
  updateJobProgress: vi.fn(),
  getJobProgress: vi.fn(),
  getJobStatus: vi.fn(),
  addJobToBatch: vi.fn(),
  getBatchJobs: vi.fn(),
}));

// Mock runPipeline so we don't need Docker
vi.mock("../orchestrator.js", () => ({
  runPipeline: vi.fn(),
  PipelineStepError: class PipelineStepError extends Error {
    public readonly stepName: string;
    public readonly exitCode: number;
    public readonly errorMessage: string;
    constructor(stepName: string, exitCode: number, errorMessage: string) {
      super(`Pipeline step "${stepName}" failed (exit code ${exitCode}): ${errorMessage}`);
      this.name = "PipelineStepError";
      this.stepName = stepName;
      this.exitCode = exitCode;
      this.errorMessage = errorMessage;
    }
  },
  STEPS: [
    { name: "whisper", image: "test-whisper", envVars: {} },
    { name: "silence-cutter", image: "test-silence-cutter", envVars: {} },
    { name: "ffmpeg-finalizer", image: "test-ffmpeg-finalizer", envVars: {} },
    { name: "remotion-renderer", image: "test-remotion-renderer", envVars: {} },
    { name: "srt-exporter", image: "test-srt-exporter", envVars: {} },
  ],
}));

import { videoQueue } from "../queue.js";
import { getJobStatus } from "../progress.js";
import { app } from "../index.js";

describe("GET /status/:jobId - status endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 404 for unknown/expired jobId (per D-03) ──

  it("should return 404 for unknown jobId", async () => {
    const unknownJobId = uuidv4();
    vi.mocked(getJobStatus).mockResolvedValue(null);

    const response = await request(app).get(`/status/${unknownJobId}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("error", "Job not found");
  });

  // ── 400 for invalid (non-UUID) jobId format (per T-11-01) ──

  it("should return 400 for non-UUID jobId format", async () => {
    const response = await request(app).get("/status/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toMatch(/invalid/i);
  });

  it("should reject path traversal attempts — Express normalizes these to unmatched routes (404)", async () => {
    // Path traversal like /status/../../../etc/passwd gets normalized by Express
    // before reaching our route handler, resulting in a 404 from the fallback handler.
    // This is actually more secure since the handler is never reached.
    const response = await request(app).get("/status/../../../etc/passwd");

    // Express normalizes the path, which may result in 404 (route not matched) or 400
    expect([400, 404]).toContain(response.status);
  });

  // ── 200 with queued job response ──

  it("should return 200 with queued status for a queued job", async () => {
    const jobId = uuidv4();
    vi.mocked(getJobStatus).mockResolvedValue({
      jobId,
      status: "queued",
      currentStep: "queued",
      progress: 0,
      stepInfo: "0/5",
      steps: [],
      startedAt: null,
      error: undefined,
    });
    vi.mocked(videoQueue.getJob).mockResolvedValue(null);

    const response = await request(app).get(`/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jobId,
      status: "queued",
      currentStep: "queued",
      progress: 0,
      stepInfo: "0/5",
      steps: [],
      startedAt: null,
    });
  });

  // ── 200 with active job response at step 2 ──

  it("should return 200 with active response at step 2 with progress=40, stepInfo=2/5", async () => {
    const jobId = uuidv4();
    vi.mocked(getJobStatus).mockResolvedValue({
      jobId,
      status: "active",
      currentStep: "silence-cutter",
      progress: 40,
      stepInfo: "2/5",
      steps: ["whisper"],
      startedAt: "2026-05-13T12:00:00.000Z",
      error: undefined,
    });
    vi.mocked(videoQueue.getJob).mockResolvedValue(null);

    const response = await request(app).get(`/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jobId,
      status: "active",
      currentStep: "silence-cutter",
      progress: 40,
      stepInfo: "2/5",
      steps: ["whisper"],
    });
  });

  // ── 200 with completed job response ──

  it("should return 200 with completed status showing progress=100, stepInfo=5/5, all steps", async () => {
    const jobId = uuidv4();
    vi.mocked(getJobStatus).mockResolvedValue({
      jobId,
      status: "queued", // Redis still says queued, but BullMQ overrides
      currentStep: "completed",
      progress: 100,
      stepInfo: "5/5",
      steps: ["whisper", "silence-cutter", "ffmpeg-finalizer", "remotion-renderer", "srt-exporter"],
      startedAt: "2026-05-13T12:00:00.000Z",
      error: undefined,
    });
    // BullMQ job state is authoritative for completed status
    vi.mocked(videoQueue.getJob).mockResolvedValue({
      data: { jobId },
      getState: vi.fn().mockResolvedValue("completed"),
    } as any);

    const response = await request(app).get(`/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jobId,
      status: "completed",
      progress: 100,
      stepInfo: "5/5",
      steps: ["whisper", "silence-cutter", "ffmpeg-finalizer", "remotion-renderer", "srt-exporter"],
    });
  });

  // ── 200 with failed job error details ──

  it("should return 200 with failed status and error field populated", async () => {
    const jobId = uuidv4();
    vi.mocked(getJobStatus).mockResolvedValue({
      jobId,
      status: "failed",
      currentStep: "whisper",
      progress: 20,
      stepInfo: "1/5",
      steps: [],
      startedAt: "2026-05-13T12:00:00.000Z",
      error: "Step whisper failed (exit 1): Transcription failed",
    });
    vi.mocked(videoQueue.getJob).mockResolvedValue(null);

    const response = await request(app).get(`/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jobId,
      status: "failed",
      currentStep: "whisper",
      error: "Step whisper failed (exit 1): Transcription failed",
    });
  });

  // ── BullMQ state overrides Redis progress for completed ──

  it("should override Redis status with BullMQ completed state", async () => {
    const jobId = uuidv4();
    // Redis says "active" but BullMQ says "completed" — BullMQ wins
    vi.mocked(getJobStatus).mockResolvedValue({
      jobId,
      status: "active",
      currentStep: "srt-exporter",
      progress: 80,
      stepInfo: "4/5",
      steps: ["whisper", "silence-cutter", "ffmpeg-finalizer", "remotion-renderer"],
      startedAt: "2026-05-13T12:00:00.000Z",
      error: undefined,
    });
    vi.mocked(videoQueue.getJob).mockResolvedValue({
      data: { jobId },
      getState: vi.fn().mockResolvedValue("completed"),
    } as any);

    const response = await request(app).get(`/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
  });

  // ── BullMQ state overrides Redis progress for failed ──

  it("should override Redis status with BullMQ failed state", async () => {
    const jobId = uuidv4();
    // Redis says "active" but BullMQ says "failed" — BullMQ wins
    vi.mocked(getJobStatus).mockResolvedValue({
      jobId,
      status: "active",
      currentStep: "whisper",
      progress: 20,
      stepInfo: "1/5",
      steps: [],
      startedAt: "2026-05-13T12:00:00.000Z",
      error: undefined,
    });
    vi.mocked(videoQueue.getJob).mockResolvedValue({
      data: { jobId },
      getState: vi.fn().mockResolvedValue("failed"),
    } as any);

    const response = await request(app).get(`/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("failed");
  });

  // ── Progress percentage matches step-index formula (per D-05) ──

  it("should reflect progress calculation from getJobStatus (step-index formula per D-05)", async () => {
    const jobId = uuidv4();
    // Progress at 3/5 = 60% for an active job
    vi.mocked(getJobStatus).mockResolvedValue({
      jobId,
      status: "active",
      currentStep: "ffmpeg-finalizer",
      progress: 60,
      stepInfo: "3/5",
      steps: ["whisper", "silence-cutter"],
      startedAt: "2026-05-13T12:00:00.000Z",
      error: undefined,
    });
    vi.mocked(videoQueue.getJob).mockResolvedValue(null);

    const response = await request(app).get(`/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body.progress).toBe(60);
    expect(response.body.stepInfo).toBe("3/5");
  });

  // ── stepInfo shows fraction format (per D-06) ──

  it("should include stepInfo fraction in response (per D-06)", async () => {
    const jobId = uuidv4();
    vi.mocked(getJobStatus).mockResolvedValue({
      jobId,
      status: "active",
      currentStep: "remotion-renderer",
      progress: 80,
      stepInfo: "4/5",
      steps: ["whisper", "silence-cutter", "ffmpeg-finalizer"],
      startedAt: "2026-05-13T12:00:00.000Z",
      error: undefined,
    });
    vi.mocked(videoQueue.getJob).mockResolvedValue(null);

    const response = await request(app).get(`/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body.stepInfo).toBe("4/5");
  });

  // ── Response validated by StatusResponseSchema (per D-01) ──

  it("should return all fields per StatusResponseSchema", async () => {
    const jobId = uuidv4();
    vi.mocked(getJobStatus).mockResolvedValue({
      jobId,
      status: "active",
      currentStep: "whisper",
      progress: 20,
      stepInfo: "1/5",
      steps: [],
      startedAt: "2026-05-13T12:00:00.000Z",
      error: undefined,
    });
    vi.mocked(videoQueue.getJob).mockResolvedValue(null);

    const response = await request(app).get(`/status/${jobId}`);

    expect(response.status).toBe(200);
    // Verify all required fields are present
    expect(response.body).toHaveProperty("jobId");
    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("currentStep");
    expect(response.body).toHaveProperty("progress");
    expect(response.body).toHaveProperty("stepInfo");
    expect(response.body).toHaveProperty("steps");
    expect(response.body).toHaveProperty("startedAt");
  });

  // ── No BullMQ job found: Redis progress data is used directly ──

  it("should return Redis progress data when BullMQ job is not found", async () => {
    const jobId = uuidv4();
    vi.mocked(getJobStatus).mockResolvedValue({
      jobId,
      status: "active",
      currentStep: "whisper",
      progress: 20,
      stepInfo: "1/5",
      steps: [],
      startedAt: "2026-05-13T12:00:00.000Z",
      error: undefined,
    });
    vi.mocked(videoQueue.getJob).mockResolvedValue(null);

    const response = await request(app).get(`/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("active");
    expect(response.body.currentStep).toBe("whisper");
  });
});