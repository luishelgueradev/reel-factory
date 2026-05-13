import { createQueueConnection } from "./queue.js";

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

/**
 * Update progress fields for a specific job.
 * Sets fields on a Redis hash at key `job:{jobId}` with a 24-hour TTL.
 * @param jobId - The job UUID
 * @param data - Progress fields to set (currentStep, status, error)
 */
export async function updateJobProgress(
  jobId: string,
  data: { currentStep?: string; status: string; error?: string }
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

  await redis.hset(key, fields);
  await redis.expire(key, JOB_TTL_SECONDS);
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