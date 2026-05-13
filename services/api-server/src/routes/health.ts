import { Router, type Request, type Response } from "express";
import { createQueueConnection } from "../queue.js";
import { videoQueue } from "../queue.js";

export const healthRouter = Router();

/**
 * GET /health - Health check for the API server.
 *
 * Returns server status along with Redis and BullMQ connectivity.
 * If Redis or BullMQ are unavailable, the endpoint returns 200 with
 * status "degraded" and details about which services are disconnected.
 * A 5-second timeout per dependency prevents hanging.
 */
healthRouter.get("/health", async (_req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = process.uptime();

  let redisStatus: string = "disconnected";
  let queueStatus: string = "disconnected";

  // Check Redis connectivity with 5s timeout
  try {
    const redis = createQueueConnection();
    const pingPromise = redis.ping();
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );
    await Promise.race([pingPromise, timeoutPromise]);
    redisStatus = "connected";
    await redis.quit();
  } catch {
    redisStatus = "disconnected";
  }

  // Check BullMQ queue connectivity with 5s timeout
  try {
    const jobCountsPromise = videoQueue.getJobCounts();
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );
    await Promise.race([jobCountsPromise, timeoutPromise]);
    queueStatus = "connected";
  } catch {
    queueStatus = "disconnected";
  }

  // Determine overall status
  const overallStatus = redisStatus === "connected" && queueStatus === "connected"
    ? "ok"
    : "degraded";

  res.status(200).json({
    status: overallStatus,
    timestamp,
    uptime_seconds: uptimeSeconds,
    redis: redisStatus,
    queue: queueStatus,
  });
});