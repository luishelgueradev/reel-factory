import { Queue } from "bullmq";
import Redis from "ioredis";

/**
 * Redis connection URL. Defaults to localhost for development;
 * in Docker, overridden via REDIS_URL env var (redis://redis:6379).
 */
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * BullMQ queue name for video processing jobs.
 */
export const QUEUE_NAME = "video-processing";

/**
 * Creates a Redis connection suitable for BullMQ.
 * BullMQ requires maxRetriesPerRequest: null to avoid throwing on retry limits.
 * @returns A new Redis instance configured for BullMQ
 */
export function createQueueConnection(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

/**
 * Shared Redis connection for BullMQ Queue and progress tracking.
 * Reuse this connection across modules to avoid connection sprawl.
 */
const sharedConnection = createQueueConnection();

/**
 * BullMQ Queue instance for video processing jobs.
 * Per D-06: 1 automatic retry (attempts: 2 = original + 1 retry) with exponential backoff.
 * Completed jobs kept for 1000, failed kept for 5000 for debugging.
 */
export const videoQueue = new Queue(QUEUE_NAME, {
  connection: sharedConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 2,
    backoff: { type: "exponential", delay: 30000 },
  },
});

/**
 * Gracefully close the shared Redis connection.
 * Call on server shutdown to allow clean exit.
 */
export async function closeQueueConnection(): Promise<void> {
  await sharedConnection.quit();
}