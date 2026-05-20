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

    // Resolve against the base and confirm the result stays inside it. Using a
    // trailing path separator prevents sibling-prefix escapes (e.g. a sibling
    // directory like "/data/pipeline-evil" passing a bare startsWith check), and
    // resolving collapses any "../" in the user-supplied params.
    const base = path.resolve(PIPELINE_DATA_DIR);
    const resolvedPath = path.resolve(base, jobId, stepName, filename);

    if (resolvedPath !== base && !resolvedPath.startsWith(base + path.sep)) {
      res.status(403).json({ error: "Access denied", jobId, stepName, filename });
      return;
    }

    // Check if file exists and send it
    try {
      await fs.access(resolvedPath);
      res.sendFile(resolvedPath);
    } catch {
      res
        .status(404)
        .json({ error: "Artifact not found", jobId, stepName, filename });
    }
  }
);