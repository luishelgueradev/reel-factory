import { describe, it, expect, vi, beforeEach } from "vitest";

// Self-contained mock factories — vi.mock factories are hoisted before any
// module-level declarations. Use inline vi.fn() to avoid TDZ issues.
vi.mock("../queue.js", () => ({
  createQueueConnection: () => ({
    hset: vi.fn().mockResolvedValue(1),
    hsetnx: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("../orchestrator.js", () => ({
  STEPS: [
    { name: "whisper", image: "test-whisper", envVars: {} },
    { name: "silence-cutter", image: "test-silence-cutter", envVars: {} },
    { name: "ffmpeg-finalizer", image: "test-ffmpeg-finalizer", envVars: {} },
    { name: "remotion-renderer", image: "test-remotion-renderer", envVars: {} },
    { name: "srt-exporter", image: "test-srt-exporter", envVars: {} },
  ],
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
}));

// Import after mocks are set up
import { updateJobProgress, getJobProgress, getJobStatus } from "../progress.js";

const TOTAL_STEPS = 5;

/**
 * Helper to get mock Redis functions from the mocked createQueueConnection.
 * Since the mock factory creates a new object per call but progress.ts caches
 * the connection at module level, we need to access the singleton Redis instance.
 * We do this by calling createQueueConnection() again, which returns a new mock
 * object — but for test assertions we need the actual instance used by the module.
 * 
 * Instead, we spy on the real module exports to verify behavior via their effects.
 */

describe("Progress tracking", () => {
  /**
   * Access the mock Redis instance used by progress.ts.
   * progress.ts calls createQueueConnection() at module load time and stores
   * the result in a const. We re-invoke the factory to get the same shape,
   * but for assertion we rely on the actual function calls made.
   */
  function getMockRedis() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createQueueConnection } = require("../queue.js");
    return createQueueConnection();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mocks on the Redis instance
    const redis = getMockRedis();
    vi.mocked(redis.hset).mockResolvedValue(1);
    vi.mocked(redis.hsetnx).mockResolvedValue(1);
    vi.mocked(redis.expire).mockResolvedValue(1);
    vi.mocked(redis.hgetall).mockResolvedValue({});
  });

  // ── getJobStatus ──

  describe("getJobStatus", () => {
    it("should return null for unknown jobId", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({} as Record<string, string>);

      const result = await getJobStatus("non-existent-uuid");
      expect(result).toBeNull();
    });

    it("should return steps array parsed from comma-joined string in Redis hash", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "active",
        currentStep: "ffmpeg-finalizer",
        steps: "whisper,silence-cutter",
        startedAt: "2026-05-13T12:00:00.000Z",
        updatedAt: "2026-05-13T12:05:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      expect(result).not.toBeNull();
      expect(result!.steps).toEqual(["whisper", "silence-cutter"]);
    });

    it("should return empty steps array when steps field is empty string", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "active",
        currentStep: "whisper",
        steps: "",
        startedAt: "2026-05-13T12:00:00.000Z",
        updatedAt: "2026-05-13T12:00:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      expect(result).not.toBeNull();
      expect(result!.steps).toEqual([]);
    });

    it("should compute progress as 0% when status is queued", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "queued",
        currentStep: "",
        steps: "",
        updatedAt: "2026-05-13T12:00:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      expect(result).not.toBeNull();
      expect(result!.progress).toBe(0);
    });

    it("should compute progress based on completed steps count when status is active", async () => {
      // Whisper has completed, silence-cutter is active → stepIndex 1, 1 completed step before it
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "active",
        currentStep: "silence-cutter",
        steps: "whisper",
        startedAt: "2026-05-13T12:00:00.000Z",
        updatedAt: "2026-05-13T12:01:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      // completedSteps.length = 1 (whisper done), current step = silence-cutter (index 1)
      // progress = Math.round(((1 + 1) / 5) * 100) = 40
      expect(result!.progress).toBe(40);
    });

    it("should compute progress as 100 when status is completed", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "completed",
        currentStep: "completed",
        steps: "whisper,silence-cutter,ffmpeg-finalizer,remotion-renderer,srt-exporter",
        startedAt: "2026-05-13T12:00:00.000Z",
        updatedAt: "2026-05-13T12:10:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      expect(result!.progress).toBe(100);
    });

    it("should compute progress correctly for first step active", async () => {
      // First step (whisper) just started, no completed steps yet
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "active",
        currentStep: "whisper",
        steps: "",
        startedAt: "2026-05-13T12:00:00.000Z",
        updatedAt: "2026-05-13T12:00:30.000Z",
      });

      const result = await getJobStatus("test-job-id");
      // completedSteps.length = 0, current step = whisper (index 0)
      // progress = Math.round(((0 + 1) / 5) * 100) = 20
      expect(result!.progress).toBe(20);
    });

    it("should compute stepInfo as fraction format", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "active",
        currentStep: "ffmpeg-finalizer",
        steps: "whisper,silence-cutter",
        startedAt: "2026-05-13T12:00:00.000Z",
        updatedAt: "2026-05-13T12:05:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      // 2 completed + 1 current = 3 → "3/5"
      expect(result!.stepInfo).toBe("3/5");
    });

    it("should compute stepInfo as 0/5 when status is queued", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "queued",
        currentStep: "",
        steps: "",
        updatedAt: "2026-05-13T12:00:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      expect(result!.stepInfo).toBe("0/5");
    });

    it("should compute stepInfo as 5/5 when status is completed", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "completed",
        currentStep: "completed",
        steps: "whisper,silence-cutter,ffmpeg-finalizer,remotion-renderer,srt-exporter",
        startedAt: "2026-05-13T12:00:00.000Z",
        updatedAt: "2026-05-13T12:10:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      expect(result!.stepInfo).toBe("5/5");
    });

    it("should return error field from Redis hash when status is failed", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "failed",
        currentStep: "whisper",
        steps: "",
        startedAt: "2026-05-13T12:00:00.000Z",
        error: "Step whisper failed (exit 1): Transcription failed",
        updatedAt: "2026-05-13T12:00:30.000Z",
      });

      const result = await getJobStatus("test-job-id");
      expect(result).not.toBeNull();
      expect(result!.error).toBe("Step whisper failed (exit 1): Transcription failed");
      expect(result!.status).toBe("failed");
    });

    it("should return startedAt from Redis hash", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "active",
        currentStep: "remotion-renderer",
        steps: "whisper,silence-cutter,ffmpeg-finalizer",
        startedAt: "2026-05-13T12:00:00.000Z",
        updatedAt: "2026-05-13T12:08:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      expect(result!.startedAt).toBe("2026-05-13T12:00:00.000Z");
    });

    it("should return null startedAt when not set in Redis", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "queued",
        currentStep: "",
        steps: "",
        updatedAt: "2026-05-13T12:00:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      expect(result!.startedAt).toBeNull();
    });

    it("should return full typed JobStatus object", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "active",
        currentStep: "silence-cutter",
        steps: "whisper",
        startedAt: "2026-05-13T12:00:00.000Z",
        updatedAt: "2026-05-13T12:01:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      expect(result).toEqual({
        jobId: "test-job-id",
        status: "active",
        currentStep: "silence-cutter",
        progress: 40,
        stepInfo: "2/5",
        steps: ["whisper"],
        startedAt: "2026-05-13T12:00:00.000Z",
        error: undefined,
      });
    });

    it("should compute progress correctly for failed job at step boundary", async () => {
      // Failed at ffmpeg-finalizer (step 3), with 2 completed steps
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({
        status: "failed",
        currentStep: "ffmpeg-finalizer",
        steps: "whisper,silence-cutter",
        startedAt: "2026-05-13T12:00:00.000Z",
        error: "Container exited with code 1",
        updatedAt: "2026-05-13T12:05:00.000Z",
      });

      const result = await getJobStatus("test-job-id");
      // 2 completed + 1 current = 3 → (2+1)/5 * 100 = 60
      expect(result!.progress).toBe(60);
      expect(result!.stepInfo).toBe("3/5");
    });
  });

  // ── updateJobProgress with completedSteps ──

  describe("updateJobProgress with completedSteps", () => {
    it("should store completedSteps as comma-joined string in Redis hash", async () => {
      const redis = getMockRedis();
      await updateJobProgress("test-job-id", {
        status: "active",
        currentStep: "silence-cutter",
        completedSteps: ["whisper"],
      });

      expect(vi.mocked(redis.hset)).toHaveBeenCalledWith(
        "job:test-job-id",
        expect.objectContaining({
          steps: "whisper",
        })
      );
    });

    it("should store multiple completedSteps as comma-joined string", async () => {
      const redis = getMockRedis();
      await updateJobProgress("test-job-id", {
        status: "active",
        currentStep: "ffmpeg-finalizer",
        completedSteps: ["whisper", "silence-cutter"],
      });

      expect(vi.mocked(redis.hset)).toHaveBeenCalledWith(
        "job:test-job-id",
        expect.objectContaining({
          steps: "whisper,silence-cutter",
        })
      );
    });

    it("should store empty string for steps when completedSteps is empty array", async () => {
      const redis = getMockRedis();
      await updateJobProgress("test-job-id", {
        status: "active",
        currentStep: "whisper",
        completedSteps: [],
      });

      expect(vi.mocked(redis.hset)).toHaveBeenCalledWith(
        "job:test-job-id",
        expect.objectContaining({
          steps: "",
        })
      );
    });

    it("should set startedAt via hsetnx when status is active", async () => {
      const redis = getMockRedis();
      await updateJobProgress("test-job-id", {
        status: "active",
        currentStep: "whisper",
        completedSteps: [],
      });

      // hsetnx should be called to set startedAt only once
      expect(vi.mocked(redis.hsetnx)).toHaveBeenCalledWith(
        "job:test-job-id",
        "startedAt",
        expect.any(String) // ISO timestamp
      );
    });

    it("should not set startedAt when status is not active", async () => {
      const redis = getMockRedis();
      await updateJobProgress("test-job-id", {
        status: "queued",
      });

      expect(vi.mocked(redis.hsetnx)).not.toHaveBeenCalled();
    });

    it("should still work without completedSteps (backward compatible)", async () => {
      const redis = getMockRedis();
      await updateJobProgress("test-job-id", {
        status: "active",
        currentStep: "whisper",
      });

      // Should not include 'steps' key in hset fields when completedSteps not provided
      const hsetCall = vi.mocked(redis.hset).mock.calls[0];
      const fields = hsetCall[1] as Record<string, string>;
      expect(fields.steps).toBeUndefined();
    });
  });

  // ── getJobProgress backward compatibility ──

  describe("getJobProgress (backward compatibility)", () => {
    it("should return null for unknown jobId", async () => {
      const redis = getMockRedis();
      vi.mocked(redis.hgetall).mockResolvedValue({} as Record<string, string>);

      const result = await getJobProgress("non-existent-uuid");
      expect(result).toBeNull();
    });

    it("should return raw hash for existing job", async () => {
      const redis = getMockRedis();
      const expected = {
        status: "active",
        currentStep: "whisper",
        steps: "",
        updatedAt: "2026-05-13T12:00:00.000Z",
      };
      vi.mocked(redis.hgetall).mockResolvedValue(expected);

      const result = await getJobProgress("test-job-id");
      expect(result).toEqual(expected);
    });
  });
});