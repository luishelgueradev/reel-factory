import { Router, type Request, type Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import { ProcessResponseSchema } from "../schemas/response.js";
import { ArtifactResponseSchema } from "../schemas/response.js";
import { isValidVideoMimetype } from "../schemas/request.js";
import { PIPELINE_DATA_DIR } from "../constants.js";
import { runPipeline, PipelineStepError, STEPS } from "../orchestrator.js";
import { updateJobProgress } from "../progress.js";

/**
 * Multer disk storage configuration.
 * Files are first stored in a tmp directory, then moved to the job directory.
 */
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const tmpDir = path.join(PIPELINE_DATA_DIR, "tmp");
    try {
      await fs.mkdir(tmpDir, { recursive: true });
      cb(null, tmpDir);
    } catch (err) {
      cb(err as Error);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

/**
 * File filter: only accept video/mp4 mimetype.
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (isValidVideoMimetype(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only MP4 files are accepted"));
  }
};

/**
 * Custom error classes for Express error handling.
 */
export class UnsupportedMediaTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedMediaTypeError";
  }
}

export class FileTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileTooLargeError";
  }
}

/**
 * Multer upload instance with 500MB size limit.
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

/**
 * Default timeout for pipeline processing (3 hours).
 * Can be overridden via PROCESS_TIMEOUT_MS env var.
 */
const DEFAULT_TIMEOUT_MS = 10800000; // 3 hours — accommodates scale:2 supersampled renders (Phase 14 D-03)

export const processRouter = Router();

/**
 * POST /process - Full pipeline processing endpoint
 *
 * Accepts an MP4 file via multipart upload, runs the entire pipeline
 * (whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → srt-exporter),
 * and returns the processed video URL and all artifact URLs.
 *
 * Success: 200 with { jobId, videoUrl, artifacts, duration_seconds }
 * Step failure: 500 with { jobId, error: { step, exitCode, message } }
 * Timeout: 408 with { jobId, error: { step: "timeout", message } }
 */
processRouter.post("/process", upload.single("video"), async (req: Request, res: Response) => {
  // Check if file was provided
  if (!req.file) {
    res.status(400).json({ error: "No video file provided" });
    return;
  }

  // Generate a unique job ID
  const jobId = uuidv4();

  // Create job directory structure
  const jobInputDir = path.join(PIPELINE_DATA_DIR, jobId, "input");
  await fs.mkdir(jobInputDir, { recursive: true });

  // Move file from tmp to job input directory as video.mp4
  const tmpPath = req.file.path;
  const destPath = path.join(jobInputDir, "video.mp4");
  await fs.rename(tmpPath, destPath);

  // Per D-04: Write initial "queued" status to Redis for synchronous jobs
  // so they appear in GET /status queries even before the pipeline starts
  await updateJobProgress(jobId, { status: "queued", currentStep: "queued" });

  // Configure timeout per D-07
  const timeoutMs = parseInt(process.env.PROCESS_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);

  // Per D-04: onStepStart callback updates Redis progress during synchronous execution
  // Same pattern as worker.ts onStepStart
  const onStepStart = async (stepName: string, stepIndex: number, totalSteps: number) => {
    const completedSteps = STEPS.slice(0, stepIndex).map(s => s.name);
    await updateJobProgress(jobId, { status: "active", currentStep: stepName, completedSteps });
  };

  // Enforce the timeout for real: race the pipeline against a timer so a hung
  // step returns 408 instead of blocking the request indefinitely. NOTE: losing
  // the race does not cancel the underlying containers — they keep running.
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`Pipeline processing timeout after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    // Run the entire pipeline with progress tracking, bounded by the timeout
    const result = await Promise.race([runPipeline(jobId, { onStepStart }), timeoutPromise]);

    // Mark job as completed in Redis
    await updateJobProgress(jobId, { status: "completed", currentStep: "completed" });

    // Build artifact map with URLs
    const artifactsWithUrls: Record<string, string[]> = {};
    for (const [stepName, files] of Object.entries(result.artifacts)) {
      artifactsWithUrls[stepName] = files.map(
        (filename) => `/artifacts/${jobId}/${stepName}/${filename}`
      );
    }

    // Return success response with ArtifactResponseSchema validation
    const response = ArtifactResponseSchema.parse({
      jobId: result.jobId,
      videoUrl: result.videoUrl,
      artifacts: artifactsWithUrls,
      duration_seconds: result.totalDurationSeconds,
    });

    res.status(200).json(response);
  } catch (err: unknown) {
    // Handle PipelineStepError — step failure
    if (err instanceof PipelineStepError) {
      // Per D-04: Mark as failed with step details in Redis
      await updateJobProgress(jobId, {
        status: "failed",
        currentStep: err.stepName,
        error: `Step ${err.stepName} failed (exit ${err.exitCode}): ${err.errorMessage}`,
      });

      res.status(500).json({
        jobId,
        error: {
          step: err.stepName,
          exitCode: err.exitCode,
          message: err.errorMessage,
        },
      });
      return;
    }

    // Handle timeout errors
    if (err instanceof Error && err.message.includes("timeout")) {
      await updateJobProgress(jobId, {
        status: "failed",
        currentStep: "timeout",
        error: `Pipeline exceeded ${timeoutMs}ms timeout`,
      });

      res.status(408).json({
        jobId,
        error: {
          step: "timeout",
          message: `Pipeline exceeded ${timeoutMs}ms timeout`,
        },
      });
      return;
    }

    // Generic error
    console.error("Pipeline error:", err);
    await updateJobProgress(jobId, {
      status: "failed",
      currentStep: "unknown",
      error: err instanceof Error ? err.message : "Internal server error",
    });

    res.status(500).json({
      jobId,
      error: {
        step: "unknown",
        message: err instanceof Error ? err.message : "Internal server error",
      },
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
});