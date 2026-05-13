import { Router, type Request, type Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import { BatchResponseSchema, BatchStatusResponseSchema } from "../schemas/batch.js";
import { videoQueue } from "../queue.js";
import { updateJobProgress, addJobToBatch, getBatchJobs, getJobProgress } from "../progress.js";
import { PIPELINE_DATA_DIR, MAX_BATCH_SIZE } from "../constants.js";
import { isValidVideoMimetype } from "../schemas/request.js";

/**
 * Multer disk storage configuration for batch uploads.
 * Files are first stored in a tmp directory, then moved to job directories.
 */
const batchStorage = multer.diskStorage({
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
const batchFileFilter = (
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
 * Multer upload instance for batch uploads.
 * Uses upload.array() to accept multiple files under the "videos" field.
 * Per-file size limit: 500MB (same as single upload).
 * File count limit: MAX_BATCH_SIZE (default 10).
 */
export const batchUpload = multer({
  storage: batchStorage,
  fileFilter: batchFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB per file
    files: MAX_BATCH_SIZE,
  },
});

export const batchRouter = Router();

/**
 * POST /batch - Batch upload endpoint
 *
 * Accepts multiple MP4 files via multipart upload array, creates a BullMQ job
 * for each file, and returns a batchId with per-job status.
 *
 * Per D-01: multipart upload with array, D-02: async response with batchId + jobIds,
 * D-03: batch grouping for status polling.
 *
 * Request: multipart/form-data with "videos" field containing multiple files
 * Success: 200 with { batchId, jobs: [{ jobId, filename, status: "queued" }], createdAt }
 * No files: 400 "No video files provided"
 * Too many files: 413 "Too many files in batch"
 * Invalid mimetype: 415 "Only MP4 files are accepted"
 */
batchRouter.post("/batch", batchUpload.array("videos", MAX_BATCH_SIZE), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;

  // Validate files exist
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No video files provided" });
    return;
  }

  // Validate file count doesn't exceed MAX_BATCH_SIZE
  if (files.length > MAX_BATCH_SIZE) {
    res.status(413).json({ error: `Too many files in batch. Maximum is ${MAX_BATCH_SIZE}` });
    return;
  }

  // Generate batchId to group all jobs
  const batchId = uuidv4();

  // Process each file: create job directory, move file, add BullMQ job
  const jobPromises = files.map(async (file) => {
    const jobId = uuidv4();
    const jobInputDir = path.join(PIPELINE_DATA_DIR, jobId, "input");

    // Create job directory
    await fs.mkdir(jobInputDir, { recursive: true });

    // Move file from tmp to job input directory as video.mp4
    const tmpPath = file.path;
    const destPath = path.join(jobInputDir, "video.mp4");
    await fs.rename(tmpPath, destPath);

    // Add BullMQ job with job data per D-04
    const inputPath = `/data/pipeline/${jobId}/input/video.mp4`;
    await videoQueue.add("process-video", {
      jobId,
      batchId,
      filename: file.originalname,
      inputPath,
    });

    // Store batch→job mapping in Redis
    await addJobToBatch(batchId, jobId);

    // Set initial progress status
    await updateJobProgress(jobId, { status: "queued", currentStep: "queued" });

    return {
      jobId,
      filename: file.originalname,
      status: "queued" as const,
    };
  });

  const jobs = await Promise.all(jobPromises);

  // Build and validate response
  const response = BatchResponseSchema.parse({
    batchId,
    jobs,
    createdAt: new Date().toISOString(),
  });

  res.status(200).json(response);
});

/**
 * GET /batch/:batchId - Batch status endpoint
 *
 * Returns the status of all jobs in a batch.
 * Per D-03: batchId groups jobIds, GET /batch/{batchId} returns all job statuses.
 *
 * Success: 200 with { batchId, jobs: [{ jobId, filename, status, currentStep?, error? }], completedCount, failedCount, totalCount }
 * Not found: 404 { error: "Batch not found" }
 */
batchRouter.get("/batch/:batchId", async (req: Request, res: Response) => {
  const { batchId } = req.params;

  // Get all job IDs for this batch
  const jobIds = await getBatchJobs(batchId);

  // If no jobs found, batch doesn't exist
  if (!jobIds || jobIds.length === 0) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  // Fetch status for each job
  const jobDetails = await Promise.all(
    jobIds.map(async (jobId) => {
      // Get progress data from Redis
      const progress = await getJobProgress(jobId);

      // Get BullMQ job for authoritative status and job data
      const bullmqJob = await videoQueue.getJob(jobId);

      // Determine status: BullMQ state takes precedence
      let status: string = progress?.status || "queued";
      let filename: string = "";
      let currentStep: string | undefined;
      let error: string | undefined;

      if (bullmqJob) {
        // BullMQ job exists — use its data for filename
        filename = bullmqJob.data?.filename || "";
        // BullMQ job state is authoritative for completed/failed
        const jobState = await bullmqJob.getState();
        if (jobState === "completed") {
          status = "completed";
        } else if (jobState === "failed") {
          status = "failed";
        } else if (jobState === "active") {
          status = "active";
        }
      }

      // Use progress data for currentStep and error
      if (progress) {
        currentStep = progress.currentStep;
        error = progress.error;
        if (!filename) {
          filename = progress.filename || "";
        }
      }

      return {
        jobId,
        filename,
        status,
        currentStep,
        error,
      };
    })
  );

  // Count completed and failed
  const completedCount = jobDetails.filter((j) => j.status === "completed").length;
  const failedCount = jobDetails.filter((j) => j.status === "failed").length;

  // Build and validate response
  const response = BatchStatusResponseSchema.parse({
    batchId,
    jobs: jobDetails,
    completedCount,
    failedCount,
    totalCount: jobDetails.length,
  });

  res.status(200).json(response);
});