import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

// Self-contained mock factories — no references to external variables
// (vi.mock factories are hoisted and executed before any const declarations)
vi.mock("../orchestrator.js", () => ({
  runPipeline: vi.fn().mockResolvedValue({
    jobId: "default",
    steps: [],
    artifacts: {},
    totalDurationSeconds: 0,
    videoUrl: "/artifacts/default/output.mp4",
  }),
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
    { name: "whisper", image: "test", envVars: {} },
    { name: "silence-cutter", image: "test", envVars: {} },
    { name: "ffmpeg-finalizer", image: "test", envVars: {} },
    { name: "remotion-renderer", image: "test", envVars: {} },
    { name: "srt-exporter", image: "test", envVars: {} },
  ],
}));

vi.mock("../progress.js", () => ({
  updateJobProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../queue.js", () => ({
  QUEUE_NAME: "video-processing",
  createQueueConnection: vi.fn().mockReturnValue({}),
  closeQueueConnection: vi.fn(),
}));

vi.mock("../constants.js", () => ({
  PIPELINE_DATA_DIR: "/tmp/test-pipeline",
}));

vi.mock("fs/promises", () => ({
  default: {
    rm: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocks
import { runPipeline } from "../orchestrator.js";
import { PipelineStepError } from "../orchestrator.js";
import { updateJobProgress } from "../progress.js";
import { processJob } from "../worker.js";
import fs from "fs/promises";

describe("BullMQ Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set default resolved values after clearAllMocks
    vi.mocked(updateJobProgress).mockResolvedValue(undefined);
    vi.mocked(fs.rm).mockResolvedValue(undefined);
  });

  // Test 1: Worker module exports startWorker() and stopWorker()
  describe("module exports", () => {
    it("should export startWorker function", async () => {
      const worker = await import("../worker.js");
      expect(typeof worker.startWorker).toBe("function");
    });

    it("should export stopWorker function", async () => {
      const worker = await import("../worker.js");
      expect(typeof worker.stopWorker).toBe("function");
    });
  });

  // Test 2: Job processor calls runPipeline() with correct jobId and updates progress before each step
  describe("processJob", () => {
    it("should call runPipeline with jobId and onStepStart callback", async () => {
      vi.mocked(runPipeline).mockResolvedValue({
        jobId: "test-job-1",
        steps: [],
        artifacts: {},
        totalDurationSeconds: 10,
        videoUrl: "/artifacts/test-job-1/remotion-renderer/output.mp4",
      });

      const mockJob = {
        id: "bullmq-job-1",
        data: { jobId: "test-job-1", batchId: "batch-1", filename: "video.mp4", inputPath: "/tmp/test-pipeline/test-job-1/input/video.mp4" },
        updateProgress: vi.fn(),
      } as unknown as Job;

      await processJob(mockJob);

      expect(runPipeline).toHaveBeenCalledWith("test-job-1", expect.objectContaining({
        onStepStart: expect.any(Function),
      }));
    });

    it("should update progress before each pipeline step via onStepStart callback", async () => {
      vi.mocked(runPipeline).mockImplementation(async (_jobId: string, options?: { onStepStart?: (stepName: string, stepIndex: number, totalSteps: number) => Promise<void> }) => {
        if (options?.onStepStart) {
          // Simulate orchestrator calling onStepStart for each of the 5 steps
          const steps = ["whisper", "silence-cutter", "ffmpeg-finalizer", "remotion-renderer", "srt-exporter"];
          for (let i = 0; i < steps.length; i++) {
            await options.onStepStart(steps[i], i, steps.length);
          }
        }
        return {
          jobId: "test-job-2",
          steps: [],
          artifacts: {},
          totalDurationSeconds: 15,
          videoUrl: "/artifacts/test-job-2/remotion-renderer/output.mp4",
        };
      });

      const mockJob = {
        id: "bullmq-job-2",
        data: { jobId: "test-job-2", batchId: "batch-2", filename: "video.mp4", inputPath: "/tmp/test-pipeline/test-job-2/input/video.mp4" },
        updateProgress: vi.fn(),
      } as unknown as Job;

      await processJob(mockJob);

      // Should have called updateJobProgress for each of the 5 steps (active) + 1 completed = 6
      expect(updateJobProgress).toHaveBeenCalledTimes(6);
      // Verify the first step progress update — no completed steps before whisper starts
      expect(updateJobProgress).toHaveBeenNthCalledWith(1, "test-job-2", {
        status: "active",
        currentStep: "whisper",
        completedSteps: [],
      });
      // Verify the completed call
      expect(updateJobProgress).toHaveBeenNthCalledWith(6, "test-job-2", {
        status: "completed",
        currentStep: "completed",
      });
    });
  });

  // Test 3: Successful job marks status "completed" in Redis progress
  describe("successful job completion", () => {
    it("should mark status as completed in Redis when runPipeline succeeds", async () => {
      vi.mocked(runPipeline).mockResolvedValue({
        jobId: "test-job-3",
        steps: [{ name: "whisper", durationSeconds: 5, status: "success" }],
        artifacts: {},
        totalDurationSeconds: 15,
        videoUrl: "/artifacts/test-job-3/remotion-renderer/output.mp4",
      });

      const mockJob = {
        id: "bullmq-job-3",
        data: { jobId: "test-job-3", batchId: "batch-3", filename: "video.mp4", inputPath: "/tmp/test" },
        updateProgress: vi.fn(),
      } as unknown as Job;

      await processJob(mockJob);

      // Last updateJobProgress call should be "completed"
      const lastCall = vi.mocked(updateJobProgress).mock.calls[vi.mocked(updateJobProgress).mock.calls.length - 1];
      expect(lastCall).toEqual(["test-job-3", { status: "completed", currentStep: "completed" }]);
    });
  });

  // Test 4: Failed job (PipelineStepError) marks status "failed" with error details in Redis
  describe("failed job handling", () => {
    it("should mark status as failed with error details when PipelineStepError is thrown", async () => {
      vi.mocked(runPipeline).mockRejectedValue(new PipelineStepError("whisper", 1, "Transcription failed"));

      const mockJob = {
        id: "bullmq-job-4",
        data: { jobId: "test-job-4", batchId: "batch-4", filename: "video.mp4", inputPath: "/tmp/test" },
        updateProgress: vi.fn(),
      } as unknown as Job;

      await expect(processJob(mockJob)).rejects.toThrow();

      expect(updateJobProgress).toHaveBeenCalledWith("test-job-4", {
        status: "failed",
        currentStep: "whisper",
        error: "Step whisper failed (exit 1): Transcription failed",
      });
    });

    it("should mark status as failed with unknown step for non-PipelineStepError", async () => {
      vi.mocked(runPipeline).mockRejectedValue(new Error("Something went wrong"));

      const mockJob = {
        id: "bullmq-job-5",
        data: { jobId: "test-job-5", batchId: "batch-5", filename: "video.mp4", inputPath: "/tmp/test" },
        updateProgress: vi.fn(),
      } as unknown as Job;

      await expect(processJob(mockJob)).rejects.toThrow();

      expect(updateJobProgress).toHaveBeenCalledWith("test-job-5", {
        status: "failed",
        currentStep: "unknown",
        error: "Something went wrong",
      });
    });
  });

  // Test 5: Progress hash includes currentStep, status, and updatedAt after each pipeline step
  describe("progress tracking details", () => {
    it("should include currentStep, status in progress updates", async () => {
      vi.mocked(runPipeline).mockImplementation(async (_jobId: string, options?: { onStepStart?: (stepName: string, stepIndex: number, totalSteps: number) => Promise<void> }) => {
        if (options?.onStepStart) {
          await options.onStepStart("whisper", 0, 5);
        }
        return {
          jobId: "test-job-6",
          steps: [],
          artifacts: {},
          totalDurationSeconds: 10,
          videoUrl: "/artifacts/test-job-6/remotion-renderer/output.mp4",
        };
      });

      const mockJob = {
        id: "bullmq-job-6",
        data: { jobId: "test-job-6", batchId: "batch-6", filename: "video.mp4", inputPath: "/tmp/test" },
        updateProgress: vi.fn(),
      } as unknown as Job;

      await processJob(mockJob);

      // Check that updateJobProgress was called with status, currentStep, and completedSteps
      expect(updateJobProgress).toHaveBeenCalledWith("test-job-6", {
        status: "active",
        currentStep: "whisper",
        completedSteps: [],
      });

      // Also check that job.updateProgress was called for BullMQ progress tracking
      expect(mockJob.updateProgress).toHaveBeenCalledWith(20); // (0+1)/5 * 100 = 20
    });

    it("should update BullMQ job progress with percentage", async () => {
      vi.mocked(runPipeline).mockImplementation(async (_jobId: string, options?: { onStepStart?: (stepName: string, stepIndex: number, totalSteps: number) => Promise<void> }) => {
        if (options?.onStepStart) {
          await options.onStepStart("silence-cutter", 1, 5);
        }
        return {
          jobId: "test-job-7",
          steps: [],
          artifacts: {},
          totalDurationSeconds: 10,
          videoUrl: "/artifacts/test-job-7/remotion-renderer/output.mp4",
        };
      });

      const mockJob = {
        id: "bullmq-job-7",
        data: { jobId: "test-job-7", batchId: "batch-7", filename: "video.mp4", inputPath: "/tmp/test" },
        updateProgress: vi.fn(),
      } as unknown as Job;

      await processJob(mockJob);

      // (1+1)/5 * 100 = 40
      expect(mockJob.updateProgress).toHaveBeenCalledWith(40);
    });
  });

  describe("directory cleanup on retry", () => {
    it("should clean up step output directories before running pipeline", async () => {
      vi.mocked(runPipeline).mockResolvedValue({
        jobId: "test-job-8",
        steps: [],
        artifacts: {},
        totalDurationSeconds: 10,
        videoUrl: "/artifacts/test-job-8/remotion-renderer/output.mp4",
      });

      const mockJob = {
        id: "bullmq-job-8",
        data: { jobId: "test-job-8", batchId: "batch-8", filename: "video.mp4", inputPath: "/tmp/test" },
        updateProgress: vi.fn(),
      } as unknown as Job;

      await processJob(mockJob);

      // Should attempt to remove all 5 step directories
      const mockedRm = vi.mocked(fs.rm);
      expect(mockedRm).toHaveBeenCalledTimes(5);
      // Verify step directory paths
      expect(mockedRm).toHaveBeenCalledWith(
        "/tmp/test-pipeline/test-job-8/whisper",
        expect.objectContaining({ recursive: true, force: true })
      );
      expect(mockedRm).toHaveBeenCalledWith(
        "/tmp/test-pipeline/test-job-8/silence-cutter",
        expect.objectContaining({ recursive: true, force: true })
      );
    });
  });
});