import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs/promises";
import { PIPELINE_DATA_DIR } from "../constants.js";

export const artifactsRouter = Router();

/**
 * GET /artifacts/:jobId - List all artifacts for a job
 *
 * Reads the job directory and returns a map of step names to their output files.
 */
artifactsRouter.get("/artifacts/:jobId", async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const jobDir = path.join(PIPELINE_DATA_DIR, jobId);

  try {
    // Check if job directory exists
    const entries = await fs.readdir(jobDir, { withFileTypes: true });

    const artifacts: Record<string, string[]> = {};

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== "input" && entry.name !== "tmp") {
        // This is a step directory — list its files
        try {
          const stepFiles = await fs.readdir(path.join(jobDir, entry.name));
          artifacts[entry.name] = stepFiles;
        } catch {
          // Skip directories we can't read
          artifacts[entry.name] = [];
        }
      }
    }

    res.json({ jobId, artifacts });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ error: "Job not found", jobId });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * GET /artifacts/:jobId/:stepName/:filename - Serve a specific artifact file
 *
 * Serves files from the pipeline volume with path traversal protection.
 */
artifactsRouter.get(
  "/artifacts/:jobId/:stepName/:filename",
  async (req: Request, res: Response) => {
    const { jobId, stepName, filename } = req.params;

    // Construct the file path
    const filePath = path.join(PIPELINE_DATA_DIR, jobId, stepName, filename);
    const normalizedPath = path.normalize(filePath);

    // Path traversal protection: ensure the path starts with /data/pipeline/
    if (!normalizedPath.startsWith(PIPELINE_DATA_DIR)) {
      res.status(403).json({ error: "Access denied", jobId, stepName, filename });
      return;
    }

    // Check if file exists and send it
    try {
      await fs.access(filePath);
      res.sendFile(filePath);
    } catch {
      res
        .status(404)
        .json({ error: "Artifact not found", jobId, stepName, filename });
    }
  }
);