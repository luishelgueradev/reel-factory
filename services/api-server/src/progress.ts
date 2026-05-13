import { createQueueConnection } from "./queue.js";
import { STEPS } from "./orchestrator.js";

/**
 * Shared Redis connection for progress tracking.
 * Reuses the connection factory from queue.ts to avoid connection sprawl.
 */
const redis = createQueueConnection();

/** Key prefix for job progress hashes */
const JOB_KEY_PREFIX = "job:";

/** Key prefix for batch→jobId lists */
const BATCH_KEY_PREFIX = "batch:";

/** 24-hour TTL on job progress hashes (per D-05) */
const JOB_TTL_SECONDS = 24 * 60 * 60;

/** 25-hour TTL on batch lists (slightly longer than job TTL) */
const BATCH_TTL_SECONDS = 25 * 60 * 60;

/** Total number of pipeline steps, derived from the STEPS configuration */
const TOTAL_STEPS = STEPS.length;

/**
 * Typed status response returned by getJobStatus().
 * Per D-01: step-aware response with progress percentage and stepInfo fraction.
 */
export interface JobStatus {
  jobId: string;
  status: string;
  currentStep: string;
  progress: number;
  stepInfo: string;
  steps: string[];
  startedAt: string | null;
  error?: string;
}

/**
 * Update progress fields for a specific job.
 * Sets fields on a Redis hash at key `job:{jobId}` with a 24-hour TTL.
 * @param jobId - The job UUID
 * @param data - Progress fields to set (currentStep, status, error, completedSteps)
 */
export async function updateJobProgress(
  jobId: string,
  data: { currentStep?: string; status: string; error?: string; completedSteps?: string[] }
): Promise<void> {
  const key = `${JOB_KEY_PREFIX}${jobId}`;
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
    // Per D-02: Store completed steps as comma-joined string
    fields.steps = data.completedSteps.join(",");
  }

  await redis.hset(key, fields);
  await redis.expire(key, JOB_TTL_SECONDS);

  // Per D-07: Set startedAt only once when status transitions to "active"
  // Use hsetnx to ensure it's only set for the first activation
  if (data.status === "active") {
    await redis.hsetnx(key, "startedAt", new Date().toISOString());
  }
}

/**
 * Get all progress fields for a specific job.
 * Returns null if the job hash doesn't exist (expired or never created).
 * @param jobId - The job UUID
 */
export async function getJobProgress(
  jobId: string
): Promise<Record<string, string> | null> {
  const key = `${JOB_KEY_PREFIX}${jobId}`;
  const data = await redis.hgetall(key);

  // hGetAll returns {} for non-existent keys; distinguish from empty hash
  if (Object.keys(data).length === 0) {
    return null;
  }

  return data;
}

/**
 * Get typed job status with computed progress fields.
 * Per D-01: Returns a step-aware status object with progress %, stepInfo fraction,
 * and completed steps list.
 *
 * Progress calculation per D-05:
 * - queued → 0%
 * - active → Math.round(((completedSteps.length + 1) / totalSteps) * 100)
 * - completed → 100%
 * - failed → Math.round(((completedSteps.length + 1) / totalSteps) * 100)
 *
 * stepInfo format per D-06: "{n}/{totalSteps}"
 * - queued → "0/{totalSteps}"
 * - active/failed → "{completedSteps.length + 1}/{totalSteps}"
 * - completed → "{totalSteps}/{totalSteps}"
 *
 * @param jobId - The job UUID
 * @returns JobStatus object or null if job not found
 */
export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  const data = await getJobProgress(jobId);
  if (data === null) {
    return null;
  }

  // Parse completed steps from comma-joined string (per D-02)
  const completedSteps = data.steps && data.steps.length > 0
    ? data.steps.split(",")
    : [];

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
      // For active/failed: progress = (completedSteps + 1) / totalSteps * 100
      // The +1 accounts for the currently running step
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
}

/**
 * Add a jobId to a batch's job list.
 * Uses Redis list at key `batch:{batchId}` with a 25-hour TTL.
 * @param batchId - The batch UUID
 * @param jobId - The job UUID to add
 */
export async function addJobToBatch(
  batchId: string,
  jobId: string
): Promise<void> {
  const key = `${BATCH_KEY_PREFIX}${batchId}`;
  await redis.rpush(key, jobId);
  await redis.expire(key, BATCH_TTL_SECONDS);
}

/**
 * Get all job IDs belonging to a batch.
 * Returns an empty array if the batch doesn't exist (expired or never created).
 * @param batchId - The batch UUID
 */
export async function getBatchJobs(batchId: string): Promise<string[]> {
  const key = `${BATCH_KEY_PREFIX}${batchId}`;
  return redis.lrange(key, 0, -1);
}