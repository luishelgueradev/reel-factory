import { Router, type Request, type Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import { ProcessResponseSchema } from "../schemas/response.js";
import { isValidVideoMimetype } from "../schemas/request.js";
import { PIPELINE_DATA_DIR } from "../constants.js";

// Multer disk storage configuration
// Files are first stored in a tmp directory, then moved to the job directory
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
    // Use a temp name to avoid collisions, we'll rename after
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter: only accept video/mp4
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
 * Custom error class for unsupported media type (415).
 * Used to pass Multer filter errors through Express error handling.
 */
export class UnsupportedMediaTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedMediaTypeError";
  }
}

/**
 * Custom error class for file too large (413).
 * Used to pass Multer file size errors through Express error handling.
 */
export class FileTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileTooLargeError";
  }
}

// Multer upload instance with limits
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

export const uploadRouter = Router();

/**
 * POST /process - Upload an MP4 video file for processing
 *
 * Accepts a multipart form-data upload with a "video" field.
 * Creates a unique jobId, stores the file in the pipeline volume,
 * and returns a 202 with the job ID and status.
 */
uploadRouter.post("/process", upload.single("video"), async (req: Request, res: Response) => {
  // Check if file was provided (Multer sets req.file)
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

  // Validate and send response
  const response = ProcessResponseSchema.parse({
    jobId,
    status: "uploaded",
    message: "Video uploaded successfully. Processing not yet started.",
  });

  res.status(202).json(response);
});

/**
 * GET /process/:jobId/status - Get the status of a processing job
 * Placeholder for future implementation (Phase 10/11)
 */
uploadRouter.get("/process/:jobId/status", async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const jobDir = path.join(PIPELINE_DATA_DIR, jobId);

  try {
    await fs.access(jobDir);
    res.json({ jobId, status: "uploaded", message: "Status endpoint - implementation pending" });
  } catch {
    res.status(404).json({ error: "Job not found", jobId });
  }
});