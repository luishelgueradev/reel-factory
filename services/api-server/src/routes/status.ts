import { Router, type Request, type Response } from "express";
import { getJobStatus } from "../progress.js";
import { StatusResponseSchema } from "../schemas/status.js";
import { videoQueue } from "../queue.js";

export const statusRouter = Router();

/**
 * GET /status/:jobId - Progress tracking endpoint
 *
 * Per PROG-01: Returns current pipeline step, progress percentage, and completed steps.
 * Per PROG-02: Progress includes step name and completion percentage.
 * Per D-03: Unknown or expired jobId returns HTTP 404.
 * Per T-11-01: Non-UUID jobId format returns HTTP 400.
 */
statusRouter.get("/status/:jobId", async (req: Request, res: Response) => {
  const { jobId } = req.params;

  // Validate jobId is UUID format (per T-11-01)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(jobId)) {
    res.status(400).json({ error: "Invalid jobId format" });
    return;
  }

  // Get progress data from Redis hash
  const jobStatus = await getJobStatus(jobId);

  if (!jobStatus) {
    // Per D-03: unknown or expired jobId → 404
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // BullMQ job state is authoritative for completed/failed (like batch.ts)
  const bullmqJob = await videoQueue.getJob(jobId);
  if (bullmqJob) {
    const state = await bullmqJob.getState();
    if (state === "completed") {
      jobStatus.status = "completed";
    } else if (state === "failed") {
      jobStatus.status = "failed";
    }
  }

  // Validate response with Zod schema (per D-01)
  const response = StatusResponseSchema.parse({
    jobId: jobStatus.jobId,
    status: jobStatus.status,
    currentStep: jobStatus.currentStep,
    progress: jobStatus.progress,
    stepInfo: jobStatus.stepInfo,
    steps: jobStatus.steps,
    startedAt: jobStatus.startedAt,
    error: jobStatus.error,
  });

  res.status(200).json(response);
});