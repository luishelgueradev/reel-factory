import { Router, type Request, type Response } from "express";

export const healthRouter = Router();

/**
 * GET /health - Liveness check for the API server.
 *
 * Returns a simple status response with timestamp and uptime.
 * Does NOT check dependency health (Docker daemon, pipeline volume, etc.)
 * to avoid hanging on downstream issues.
 */
healthRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
  });
});