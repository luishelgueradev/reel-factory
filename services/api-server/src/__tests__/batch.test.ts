import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Mock BullMQ queue - must be before importing modules that use it
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
  STEPS: [],
}));

import { videoQueue } from "../queue.js";
import { updateJobProgress, addJobToBatch, getBatchJobs, getJobProgress } from "../progress.js";
import { app } from "../index.js";

const TEST_PIPELINE_DIR = process.env.PIPELINE_DATA_DIR || "/tmp/api-test-pipeline";

describe("POST /batch - batch upload endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 when no files are provided", async () => {
    const response = await request(app).post("/batch");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("No video files provided");
  });

  it("should return 413 when file count exceeds MAX_BATCH_SIZE", async () => {
    // Create 11 small MP4 buffers to exceed default MAX_BATCH_SIZE of 10
    const files = Array.from({ length: 11 }, (_, i) => ({
      buffer: Buffer.from(`fake mp4 data ${i}`),
      filename: `video${i}.mp4`,
      contentType: "video/mp4",
    }));

    // Build a supertest request with 11 files
    const req = request(app).post("/batch");
    for (const file of files) {
      req.attach("videos", file.buffer, {
        filename: file.filename,
        contentType: file.contentType,
      });
    }

    const response = await req;
    expect(response.status).toBe(413);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toMatch(/too many|batch|limit/i);
  });

  it("should return 415 when non-MP4 mimetype is uploaded", async () => {
    const response = await request(app)
      .post("/batch")
      .attach("videos", Buffer.from("fake image data"), {
        filename: "image.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(415);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("MP4");
  });

  it("should return 200 with batchId, jobs array, and createdAt for valid MP4 files", async () => {
    const response = await request(app)
      .post("/batch")
      .attach("videos", Buffer.from("fake mp4 data 1"), {
        filename: "video1.mp4",
        contentType: "video/mp4",
      })
      .attach("videos", Buffer.from("fake mp4 data 2"), {
        filename: "video2.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("batchId");
    expect(response.body).toHaveProperty("createdAt");
    expect(response.body).toHaveProperty("jobs");
    expect(response.body.jobs).toHaveLength(2);

    // Each job should have jobId, filename, and status
    for (const job of response.body.jobs) {
      expect(job).toHaveProperty("jobId");
      expect(job).toHaveProperty("filename");
      expect(job).toHaveProperty("status", "queued");
    }
  });

  it("should add each file as a BullMQ job with correct job data", async () => {
    const response = await request(app)
      .post("/batch")
      .attach("videos", Buffer.from("fake mp4 data A"), {
        filename: "clip_a.mp4",
        contentType: "video/mp4",
      })
      .attach("videos", Buffer.from("fake mp4 data B"), {
        filename: "clip_b.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(200);

    // Verify videoQueue.add was called for each file
    expect(videoQueue.add).toHaveBeenCalledTimes(2);

    // Verify the first call's job data includes batchId and filename
    const firstCallData = vi.mocked(videoQueue.add).mock.calls[0];
    expect(firstCallData[1]).toHaveProperty("jobId");
    expect(firstCallData[1]).toHaveProperty("batchId");
    expect(firstCallData[1]).toHaveProperty("filename", "clip_a.mp4");
    expect(firstCallData[1]).toHaveProperty("inputPath");

    // Verify the second call's job data
    const secondCallData = vi.mocked(videoQueue.add).mock.calls[1];
    expect(secondCallData[1].filename).toBe("clip_b.mp4");
  });

  it("should store batchId→jobId mapping in Redis via addJobToBatch", async () => {
    const response = await request(app)
      .post("/batch")
      .attach("videos", Buffer.from("fake mp4 data"), {
        filename: "video.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(200);

    // Verify addJobToBatch was called with the batchId and jobId
    expect(addJobToBatch).toHaveBeenCalledTimes(1);
    const [batchId, jobId] = vi.mocked(addJobToBatch).mock.calls[0];
    expect(batchId).toBe(response.body.batchId);
    expect(jobId).toBeTruthy();
  });

  it("should call updateJobProgress for each file with queued status", async () => {
    const response = await request(app)
      .post("/batch")
      .attach("videos", Buffer.from("fake mp4 data"), {
        filename: "video.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(200);

    // Verify updateJobProgress was called with initial status
    expect(updateJobProgress).toHaveBeenCalledTimes(1);
    const [jobId, data] = vi.mocked(updateJobProgress).mock.calls[0];
    expect(jobId).toBeTruthy();
    expect(data).toEqual({ status: "queued", currentStep: "queued" });
  });
});

describe("GET /batch/:batchId - batch status endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 for nonexistent batch", async () => {
    const fakeBatchId = uuidv4();
    vi.mocked(getBatchJobs).mockResolvedValue([]);

    const response = await request(app).get(`/batch/${fakeBatchId}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("not found");
  });

  it("should return batch status with per-job details", async () => {
    const batchId = uuidv4();
    const jobId1 = uuidv4();
    const jobId2 = uuidv4();

    // Mock getBatchJobs to return job IDs
    vi.mocked(getBatchJobs).mockResolvedValue([jobId1, jobId2]);

    // Mock getJobProgress to return status data
    vi.mocked(getJobProgress)
      .mockResolvedValueOnce({
        status: "completed",
        currentStep: "remotion-renderer",
        updatedAt: "2026-05-13T00:00:00Z",
      })
      .mockResolvedValueOnce({
        status: "failed",
        currentStep: "whisper",
        error: "Transcription failed",
        updatedAt: "2026-05-13T00:01:00Z",
      });

    // Mock BullMQ getJob to return job data with filename
    vi.mocked(videoQueue.getJob)
      .mockResolvedValueOnce({
        data: { jobId: jobId1, filename: "clip1.mp4", batchId },
        returnvalue: undefined,
      } as any)
      .mockResolvedValueOnce({
        data: { jobId: jobId2, filename: "clip2.mp4", batchId },
        returnvalue: undefined,
      } as any);

    const response = await request(app).get(`/batch/${batchId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("batchId", batchId);
    expect(response.body).toHaveProperty("jobs");
    expect(response.body).toHaveProperty("completedCount");
    expect(response.body).toHaveProperty("failedCount");
    expect(response.body).toHaveProperty("totalCount", 2);
    expect(response.body.jobs).toHaveLength(2);

    // Verify job details
    const job1 = response.body.jobs.find((j: any) => j.jobId === jobId1);
    expect(job1).toBeDefined();
    expect(job1.status).toBe("completed");
    expect(job1.currentStep).toBe("remotion-renderer");

    const job2 = response.body.jobs.find((j: any) => j.jobId === jobId2);
    expect(job2).toBeDefined();
    expect(job2.status).toBe("failed");
    expect(job2.error).toBe("Transcription failed");

    // Verify aggregated counts
    expect(response.body.completedCount).toBe(1);
    expect(response.body.failedCount).toBe(1);
  });
});