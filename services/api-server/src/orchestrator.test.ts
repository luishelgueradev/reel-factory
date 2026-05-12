import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  runPipeline,
  PipelineStepError,
  STEPS,
  type PipelineStepConfig,
} from "./orchestrator.js";
import type { PipelineManifest } from "../../shared/schemas/manifest.js";

/**
 * Creates a mock Docker instance that creates containers with the specified behavior.
 * All containers succeed with exit code 0 by default.
 */
function createMockDocker(options?: { exitCode?: number }) {
  const exitCode = options?.exitCode ?? 0;
  const mockContainer = {
    start: vi.fn().mockResolvedValue(undefined),
    wait: vi.fn().mockResolvedValue({ StatusCode: exitCode }),
    logs: vi.fn().mockResolvedValue(Buffer.from("")),
    remove: vi.fn().mockResolvedValue(undefined),
  };

  return {
    createContainer: vi.fn().mockResolvedValue(mockContainer),
    _mockContainer: mockContainer,
  };
}

describe("STEPS configuration", () => {
  it("should have exactly 5 steps", () => {
    expect(STEPS).toHaveLength(5);
  });

  it("should have steps in correct order: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → srt-exporter", () => {
    expect(STEPS[0].name).toBe("whisper");
    expect(STEPS[1].name).toBe("silence-cutter");
    expect(STEPS[2].name).toBe("ffmpeg-finalizer");
    expect(STEPS[3].name).toBe("remotion-renderer");
    expect(STEPS[4].name).toBe("srt-exporter");
  });

  it("whisper step should have correct env vars", () => {
    const whisper = STEPS[0];
    expect(whisper.image).toBe("video-pipeline-whisper");
    expect(whisper.envVars).toHaveProperty("INPUT_PATH");
    expect(whisper.envVars.INPUT_PATH).toContain("/input/video.mp4");
    expect(whisper.envVars).toHaveProperty("OUTPUT_PATH");
    expect(whisper.envVars.OUTPUT_PATH).toContain("/whisper/transcript.json");
    expect(whisper.envVars).toHaveProperty("PIPELINE_JOB_ID");
    expect(whisper.envVars).toHaveProperty("HF_HOME");
    expect(whisper.envVars.HF_HOME).toBe("/data/pipeline/.cache/huggingface");
  });

  it("silence-cutter step should have correct env vars including TRANSCRIPT_PATH", () => {
    const step = STEPS[1];
    expect(step.image).toBe("video-pipeline-silence-cutter");
    expect(step.envVars).toHaveProperty("INPUT_PATH");
    expect(step.envVars).toHaveProperty("OUTPUT_PATH");
    expect(step.envVars).toHaveProperty("PIPELINE_JOB_ID");
    expect(step.envVars).toHaveProperty("TRANSCRIPT_PATH");
    expect(step.envVars.TRANSCRIPT_PATH).toContain("/whisper/transcript.json");
    expect(step.envVars).toHaveProperty("SILENCE_MIN_DURATION");
    expect(step.envVars).toHaveProperty("SILENCE_CUT_SHRINK");
  });

  it("ffmpeg-finalizer step should have correct env vars including VERTICAL_WIDTH/HEIGHT and CROP_STRATEGY", () => {
    const step = STEPS[2];
    expect(step.image).toBe("video-pipeline-ffmpeg-finalizer");
    expect(step.envVars).toHaveProperty("INPUT_PATH");
    expect(step.envVars.INPUT_PATH).toContain("/silence-cutter/output.mp4");
    expect(step.envVars).toHaveProperty("OUTPUT_PATH");
    expect(step.envVars.OUTPUT_PATH).toContain("/ffmpeg-finalizer/output.mp4");
    expect(step.envVars).toHaveProperty("PIPELINE_JOB_ID");
    expect(step.envVars).toHaveProperty("VERTICAL_WIDTH");
    expect(step.envVars).toHaveProperty("VERTICAL_HEIGHT");
    expect(step.envVars).toHaveProperty("CROP_STRATEGY");
  });

  it("remotion-renderer step should have correct env vars including TRANSCRIPT_PATH, SILENCE_CUTS_PATH, FINALIZER_INFO_PATH", () => {
    const step = STEPS[3];
    expect(step.image).toBe("video-pipeline-remotion-renderer");
    expect(step.envVars).toHaveProperty("INPUT_PATH");
    expect(step.envVars.INPUT_PATH).toContain("/ffmpeg-finalizer/output.mp4");
    expect(step.envVars).toHaveProperty("OUTPUT_PATH");
    expect(step.envVars.OUTPUT_PATH).toContain("/remotion-renderer/output.mp4");
    expect(step.envVars).toHaveProperty("PIPELINE_JOB_ID");
    expect(step.envVars).toHaveProperty("TRANSCRIPT_PATH");
    expect(step.envVars).toHaveProperty("SILENCE_CUTS_PATH");
    expect(step.envVars).toHaveProperty("FINALIZER_INFO_PATH");
    expect(step.envVars).toHaveProperty("ACTIVE_COLOR");
    expect(step.envVars).toHaveProperty("INACTIVE_COLOR");
    expect(step.envVars).toHaveProperty("FONT_SIZE");
  });

  it("srt-exporter step should have correct env vars including TRANSCRIPT_PATH and SILENCE_CUTS_PATH", () => {
    const step = STEPS[4];
    expect(step.image).toBe("video-pipeline-srt-exporter");
    expect(step.envVars).toHaveProperty("INPUT_PATH");
    expect(step.envVars.INPUT_PATH).toContain("/input/video.mp4");
    expect(step.envVars).toHaveProperty("OUTPUT_PATH");
    expect(step.envVars.OUTPUT_PATH).toContain("/srt-exporter/output.vtt");
    expect(step.envVars).toHaveProperty("PIPELINE_JOB_ID");
    expect(step.envVars).toHaveProperty("TRANSCRIPT_PATH");
    expect(step.envVars.TRANSCRIPT_PATH).toContain("/whisper/transcript.json");
    expect(step.envVars).toHaveProperty("SILENCE_CUTS_PATH");
    expect(step.envVars.SILENCE_CUTS_PATH).toContain("/silence-cutter/silence-cuts.json");
  });
});

describe("PipelineStepError", () => {
  it("should have stepName, exitCode, and errorMessage properties", () => {
    const error = new PipelineStepError("whisper", 1, "Transcription failed");
    expect(error.stepName).toBe("whisper");
    expect(error.exitCode).toBe(1);
    expect(error.errorMessage).toBe("Transcription failed");
    expect(error.message).toContain("whisper");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("runPipeline", () => {
  // Temp directory for manifest files
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "orchestrator-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * Creates a mock Docker instance that succeeds for all containers.
   * Also creates manifest.json files for each step in the pipeline data directory.
   */
  async function createSuccessMockDocker(jobId: string, pipelineDir: string) {
    const mockContainer = {
      start: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue({ StatusCode: 0 }),
      logs: vi.fn().mockResolvedValue(Buffer.from("")),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const docker = {
      createContainer: vi.fn().mockResolvedValue(mockContainer),
    };

    // Create step directories with success manifest.json files for each step
    for (const step of STEPS) {
      const stepDir = path.join(pipelineDir, jobId, step.name);
      await fs.mkdir(stepDir, { recursive: true });
      const manifest: PipelineManifest = {
        step_name: step.name,
        input_file: `/data/pipeline/${jobId}/input/video.mp4`,
        output_files: ["output.mp4"],
        duration_seconds: 10.5,
        timestamp: new Date().toISOString(),
        status: "success",
        exit_code: 0,
      };
      await fs.writeFile(
        path.join(stepDir, "manifest.json"),
        JSON.stringify(manifest)
      );
    }

    // Also create output files in step directories for artifact collection
    for (const step of STEPS) {
      const stepDir = path.join(pipelineDir, jobId, step.name);
      await fs.writeFile(path.join(stepDir, "output.mp4"), "fake");
    }

    return docker;
  }

  it("should return PipelineResult with all step durations and videoUrl when all steps succeed", async () => {
    const jobId = "test-job-success";
    const docker = await createSuccessMockDocker(jobId, tmpDir);

    const result = await runPipeline(jobId, {
      pipelineDataDir: tmpDir,
      docker: docker as any,
    });

    expect(result).toHaveProperty("jobId", jobId);
    expect(result).toHaveProperty("videoUrl");
    expect(result.videoUrl).toContain("/remotion-renderer/output.mp4");
    expect(result).toHaveProperty("steps");
    expect(result.steps).toHaveLength(5);
    expect(result).toHaveProperty("totalDurationSeconds");
    expect(result.totalDurationSeconds).toBeGreaterThan(0);
    expect(result).toHaveProperty("artifacts");
  });

  it("should call createContainer once per step with correct image and env vars", async () => {
    const jobId = "test-job-envcheck";
    const docker = await createSuccessMockDocker(jobId, tmpDir);

    await runPipeline(jobId, {
      pipelineDataDir: tmpDir,
      docker: docker as any,
    });

    // Should have been called 5 times (one per step)
    expect(docker.createContainer).toHaveBeenCalledTimes(5);

    // Check that the first call was for whisper
    const firstCall = docker.createContainer.mock.calls[0][0];
    expect(firstCall.Image).toBe("video-pipeline-whisper");
    expect(firstCall.Env).toBeDefined();
    expect(firstCall.Env.length).toBeGreaterThan(0);
    // Verify that jobId was substituted in env vars
    const envObj: Record<string, string> = {};
    for (const envStr of firstCall.Env) {
      const [key, ...valueParts] = envStr.split("=");
      envObj[key] = valueParts.join("=");
    }
    expect(envObj.PIPELINE_JOB_ID).toBe(jobId);
    expect(envObj.INPUT_PATH).toContain(jobId);
  });

  it("should throw PipelineStepError when a step's manifest has status 'error'", async () => {
    const jobId = "test-job-err-manifest";
    const mockContainer = {
      start: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue({ StatusCode: 1 }),
      logs: vi.fn().mockResolvedValue(Buffer.from("")),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const docker = {
      createContainer: vi.fn().mockResolvedValue(mockContainer),
    };

    // Create an error manifest for whisper
    const stepDir = path.join(tmpDir, jobId, "whisper");
    await fs.mkdir(stepDir, { recursive: true });
    const manifest: PipelineManifest = {
      step_name: "whisper",
      input_file: `/data/pipeline/${jobId}/input/video.mp4`,
      output_files: [],
      duration_seconds: 5,
      timestamp: new Date().toISOString(),
      status: "error",
      error_message: "Whisper transcription failed",
      exit_code: 1,
    };
    await fs.writeFile(
      path.join(stepDir, "manifest.json"),
      JSON.stringify(manifest)
    );

    try {
      await runPipeline(jobId, { pipelineDataDir: tmpDir, docker: docker as any });
      // Should not reach here
      expect.unreachable("Should have thrown PipelineStepError");
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineStepError);
      const stepErr = err as PipelineStepError;
      expect(stepErr.stepName).toBe("whisper");
      expect(stepErr.errorMessage).toBe("Whisper transcription failed");
    }
  });

  it("should throw PipelineStepError when container exits with non-zero code and no manifest", async () => {
    const jobId = "test-job-no-manifest";
    const mockContainer = {
      start: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue({ StatusCode: 137 }),
      logs: vi.fn().mockResolvedValue(Buffer.from("")),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const docker = {
      createContainer: vi.fn().mockResolvedValue(mockContainer),
    };

    // No manifest files created — container crashed before writing one

    try {
      await runPipeline(jobId, { pipelineDataDir: tmpDir, docker: docker as any });
      expect.unreachable("Should have thrown PipelineStepError");
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineStepError);
      const stepErr = err as PipelineStepError;
      expect(stepErr.stepName).toBe("whisper");
      expect(stepErr.exitCode).toBe(137);
    }
  });
});