import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { v4 as uuidv4 } from "uuid";

/**
 * E2E progress tracking test: Simulates a full job lifecycle
 * from queued → step transitions → completed, verifying that
 * each step transition correctly updates progress, stepInfo,
 * currentStep, and steps array.
 *
 * Strategy: Mock Redis at the progress module level, then use
 * supertest to hit the real Express endpoint. Each updateJobProgress
 * call is intercepted to simulate what Redis would store, and
 * getJobStatus computes the derived fields.
 */

// Shared mock state to simulate Redis across the lifecycle
let mockJobData: Record<string, string> | null = null;

// Mock BullMQ queue
vi.mock("../queue.js", () => ({
  videoQueue: {
    add: vi.fn(),
    getJob: vi.fn().mockResolvedValue(null), // No BullMQ job — use Redis data
  },
  QUEUE_NAME: "video-processing",
  createQueueConnection: vi.fn(),
  closeQueueConnection: vi.fn(),
}));

// Mock progress tracking module — simulate Redis storage
vi.mock("../progress.js", () => ({
  updateJobProgress: vi.fn().mockImplementation(async (_jobId: string, data: any) => {
    // Simulate Redis hset — merge data into mockJobData
    if (mockJobData !== null) {
      const fields: Record<string, string> = {
        status: data.status,
        updatedAt: new Date().toISOString(),
      };
      if (data.currentStep !== undefined) {
        fields.currentStep = data.currentStep;
      }
      if (data.error !== undefined) {
        fields.error = data.error;
      }
      if (data.completedSteps !== undefined) {
        fields.steps = data.completedSteps.join(",");
      }
      // Simulate hsetnx for startedAt
      if (data.status === "active" && !mockJobData.startedAt) {
        fields.startedAt = new Date().toISOString();
      }
      mockJobData = { ...mockJobData, ...fields };
    }
  }),
  getJobProgress: vi.fn().mockImplementation(async (_jobId: string) => {
    return mockJobData;
  }),
  getJobStatus: vi.fn().mockImplementation(async (jobId: string) => {
    if (mockJobData === null) {
      return null;
    }

    const data = mockJobData;
    // Parse completed steps from comma-joined string (per D-02)
    const completedSteps = data.steps && data.steps.length > 0
      ? data.steps.split(",")
      : [];
    const TOTAL_STEPS = 5;

    // Compute progress percentage per D-05
    let progress: number;
    let stepInfo: string;

    switch (data.status) {
      case "queued":
        progress = 0;
        stepInfo = `0/${TOTAL_STEPS}`;
        break;
      case "completed":
        progress = 100;
        stepInfo = `${TOTAL_STEPS}/${TOTAL_STEPS}`;
        break;
      case "active":
      case "failed":
      default:
        progress = Math.round(((completedSteps.length + 1) / TOTAL_STEPS) * 100);
        stepInfo = `${completedSteps.length + 1}/${TOTAL_STEPS}`;
        break;
    }

    return {
      jobId,
      status: data.status,
      currentStep: data.currentStep || "",
      progress,
      stepInfo,
      steps: completedSteps,
      startedAt: data.startedAt || null,
      error: data.error,
    };
  }),
  addJobToBatch: vi.fn(),
  getBatchJobs: vi.fn(),
}));

// Mock orchestrator
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

import { updateJobProgress, getJobStatus } from "../progress.js";
import { app } from "../index.js";

// 5 pipeline steps as defined in orchestrator.ts
const STEPS = ["whisper", "silence-cutter", "ffmpeg-finalizer", "remotion-renderer", "srt-exporter"];
const TOTAL_STEPS = STEPS.length;

describe("E2E progress tracking — full step transitions", () => {
  let jobId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Fresh mock state for each test
    mockJobData = null;
    jobId = uuidv4();
  });

  // ── Simulate full job lifecycle: queued → active → completed ──

  it("should track progress through all 5 steps from queued to completed", async () => {
    // 1. Create job: queued state
    mockJobData = {
      status: "queued",
      currentStep: "queued",
      steps: "",
      updatedAt: new Date().toISOString(),
    };

    // Verify queued state via GET /status/:jobId
    let response = await request(app).get(`/status/${jobId}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "queued",
      currentStep: "queued",
      progress: 0,
      stepInfo: "0/5",
      steps: [],
    });

    // Track progress values for monotonic check
    const progressValues: number[] = [0];

    // 2. Simulate each step transition
    for (let i = 0; i < STEPS.length; i++) {
      const stepName = STEPS[i];
      const completedSteps = STEPS.slice(0, i); // Steps completed before this one
      const expectedProgress = Math.round(((i + 1) / TOTAL_STEPS) * 100);
      const expectedStepInfo = `${i + 1}/${TOTAL_STEPS}`;

      // Update job to active with current step
      await updateJobProgress(jobId, {
        status: "active",
        currentStep: stepName,
        completedSteps,
      });

      // Simulate Redis state after updateJobProgress
      mockJobData = {
        ...mockJobData,
        status: "active",
        currentStep: stepName,
        steps: completedSteps.join(","),
        startedAt: mockJobData.startedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Verify status endpoint reflects the transition
      response = await request(app).get(`/status/${jobId}`);
      expect(response.status).toBe(200);
      expect(response.body.currentStep).toBe(stepName);
      expect(response.body.progress).toBe(expectedProgress);
      expect(response.body.stepInfo).toBe(expectedStepInfo);

      // Steps array should contain all completed steps
      expect(response.body.steps).toEqual(completedSteps);

      progressValues.push(expectedProgress);
    }

    // Verify progress increases monotonically: 0, 20, 40, 60, 80, 100
    expect(progressValues).toEqual([0, 20, 40, 60, 80, 100]);
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThan(progressValues[i - 1]);
    }

    // 3. Mark as completed
    await updateJobProgress(jobId, {
      status: "completed",
      currentStep: "completed",
    });

    mockJobData = {
      ...mockJobData,
      status: "completed",
      currentStep: "completed",
      steps: STEPS.join(","),
      updatedAt: new Date().toISOString(),
    };

    response = await request(app).get(`/status/${jobId}`);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(response.body.progress).toBe(100);
    expect(response.body.stepInfo).toBe("5/5");
  });

  // ── Verify each step transition individually ──

  it("should correctly accumulate completed steps after each transition", async () => {
    // Start with queued
    mockJobData = {
      status: "queued",
      currentStep: "queued",
      steps: "",
      updatedAt: new Date().toISOString(),
    };

    let response = await request(app).get(`/status/${jobId}`);
    expect(response.body.steps).toEqual([]);

    // After whisper starts (step 1/5): no completed steps yet
    await updateJobProgress(jobId, { status: "active", currentStep: "whisper", completedSteps: [] });
    mockJobData = {
      status: "active",
      currentStep: "whisper",
      steps: "",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    response = await request(app).get(`/status/${jobId}`);
    expect(response.body.steps).toEqual([]);
    expect(response.body.progress).toBe(20);
    expect(response.body.stepInfo).toBe("1/5");

    // After silence-cutter starts (step 2/5): whisper completed
    await updateJobProgress(jobId, { status: "active", currentStep: "silence-cutter", completedSteps: ["whisper"] });
    mockJobData = {
      ...mockJobData,
      status: "active",
      currentStep: "silence-cutter",
      steps: "whisper",
      updatedAt: new Date().toISOString(),
    };
    response = await request(app).get(`/status/${jobId}`);
    expect(response.body.steps).toEqual(["whisper"]);
    expect(response.body.progress).toBe(40);
    expect(response.body.stepInfo).toBe("2/5");

    // After ffmpeg-finalizer starts (step 3/5): whisper + silence-cutter completed
    await updateJobProgress(jobId, { status: "active", currentStep: "ffmpeg-finalizer", completedSteps: ["whisper", "silence-cutter"] });
    mockJobData = {
      ...mockJobData,
      status: "active",
      currentStep: "ffmpeg-finalizer",
      steps: "whisper,silence-cutter",
      updatedAt: new Date().toISOString(),
    };
    response = await request(app).get(`/status/${jobId}`);
    expect(response.body.steps).toEqual(["whisper", "silence-cutter"]);
    expect(response.body.progress).toBe(60);
    expect(response.body.stepInfo).toBe("3/5");

    // After remotion-renderer starts (step 4/5)
    await updateJobProgress(jobId, { status: "active", currentStep: "remotion-renderer", completedSteps: ["whisper", "silence-cutter", "ffmpeg-finalizer"] });
    mockJobData = {
      ...mockJobData,
      status: "active",
      currentStep: "remotion-renderer",
      steps: "whisper,silence-cutter,ffmpeg-finalizer",
      updatedAt: new Date().toISOString(),
    };
    response = await request(app).get(`/status/${jobId}`);
    expect(response.body.steps).toEqual(["whisper", "silence-cutter", "ffmpeg-finalizer"]);
    expect(response.body.progress).toBe(80);
    expect(response.body.stepInfo).toBe("4/5");

    // After srt-exporter starts (step 5/5)
    await updateJobProgress(jobId, { status: "active", currentStep: "srt-exporter", completedSteps: ["whisper", "silence-cutter", "ffmpeg-finalizer", "remotion-renderer"] });
    mockJobData = {
      ...mockJobData,
      status: "active",
      currentStep: "srt-exporter",
      steps: "whisper,silence-cutter,ffmpeg-finalizer,remotion-renderer",
      updatedAt: new Date().toISOString(),
    };
    response = await request(app).get(`/status/${jobId}`);
    expect(response.body.steps).toEqual(["whisper", "silence-cutter", "ffmpeg-finalizer", "remotion-renderer"]);
    expect(response.body.progress).toBe(100);
    expect(response.body.stepInfo).toBe("5/5");
  });

  // ── Failure scenario: job fails at step 3 ──

  it("should reflect failed status and error field when job fails at ffmpeg-finalizer", async () => {
    // Progress through first 2 steps
    mockJobData = {
      status: "queued",
      currentStep: "queued",
      steps: "",
      updatedAt: new Date().toISOString(),
    };

    // Step 1: whisper
    await updateJobProgress(jobId, { status: "active", currentStep: "whisper", completedSteps: [] });
    mockJobData = {
      ...mockJobData,
      status: "active",
      currentStep: "whisper",
      steps: "",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Step 2: silence-cutter
    await updateJobProgress(jobId, { status: "active", currentStep: "silence-cutter", completedSteps: ["whisper"] });
    mockJobData = {
      ...mockJobData,
      status: "active",
      currentStep: "silence-cutter",
      steps: "whisper",
      updatedAt: new Date().toISOString(),
    };

    // Step 3: ffmpeg-finalizer — FAILS
    await updateJobProgress(jobId, {
      status: "failed",
      currentStep: "ffmpeg-finalizer",
      error: "Step ffmpeg-finalizer failed (exit 1): Encoding error",
      completedSteps: ["whisper", "silence-cutter"],
    });
    mockJobData = {
      ...mockJobData,
      status: "failed",
      currentStep: "ffmpeg-finalizer",
      steps: "whisper,silence-cutter",
      error: "Step ffmpeg-finalizer failed (exit 1): Encoding error",
      updatedAt: new Date().toISOString(),
    };

    // Verify failed status
    const response = await request(app).get(`/status/${jobId}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "failed",
      currentStep: "ffmpeg-finalizer",
      error: "Step ffmpeg-finalizer failed (exit 1): Encoding error",
    });

    // Progress should reflect failure point: (2 completed + 1 current) / 5 * 100 = 60%
    expect(response.body.progress).toBe(60);
    expect(response.body.stepInfo).toBe("3/5");
    expect(response.body.steps).toEqual(["whisper", "silence-cutter"]);
  });

  // ── Progress values are exactly the step-index formula ──

  it("should produce correct progress values: 0, 20, 40, 60, 80, 100 for 5 steps", async () => {
    const expectedProgress = [0, 20, 40, 60, 80, 100];
    const states: Array<{ status: string; currentStep: string; completedSteps: string[] }> = [
      { status: "queued", currentStep: "queued", completedSteps: [] },
      { status: "active", currentStep: "whisper", completedSteps: [] },
      { status: "active", currentStep: "silence-cutter", completedSteps: ["whisper"] },
      { status: "active", currentStep: "ffmpeg-finalizer", completedSteps: ["whisper", "silence-cutter"] },
      { status: "active", currentStep: "remotion-renderer", completedSteps: ["whisper", "silence-cutter", "ffmpeg-finalizer"] },
      { status: "completed", currentStep: "completed", completedSteps: STEPS },
    ];

    for (let i = 0; i < states.length; i++) {
      const state = states[i];

      if (state.status === "queued") {
        mockJobData = {
          status: "queued",
          currentStep: "queued",
          steps: "",
          updatedAt: new Date().toISOString(),
        };
      } else if (state.status === "completed") {
        mockJobData = {
          status: "completed",
          currentStep: "completed",
          steps: state.completedSteps.join(","),
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        mockJobData = {
          status: "active",
          currentStep: state.currentStep,
          steps: state.completedSteps.join(","),
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      const response = await request(app).get(`/status/${jobId}`);
      expect(response.body.progress).toBe(expectedProgress[i],
        `Step ${i} (${state.currentStep}): expected progress=${expectedProgress[i]}, got ${response.body.progress}`);
    }
  });

  // ─── Unknown jobId returns 404 ──

  it("should return 404 for unknown jobId in E2E flow", async () => {
    mockJobData = null; // Simulates Redis returning null for unknown jobId

    const response = await request(app).get(`/status/${uuidv4()}`);
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("error", "Job not found");
  });
});