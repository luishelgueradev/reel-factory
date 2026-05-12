import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

// Import the Express app
import { app } from "../index.js";
import { upload, UnsupportedMediaTypeError, FileTooLargeError } from "../routes/upload.js";

const TEST_PIPELINE_DIR = process.env.PIPELINE_DATA_DIR || "/tmp/api-test-pipeline";

/**
 * Create a test Express app with a very low file size limit (1KB)
 * to test 413 Payload Too Large responses without uploading huge files.
 */
function createLowLimitApp() {
  const testApp = express();

  // Create a Multer instance with 1KB file size limit for testing
  const lowLimitUpload = multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, cb) => {
        const tmpDir = path.join(TEST_PIPELINE_DIR, "tmp");
        await fs.mkdir(tmpDir, { recursive: true });
        cb(null, tmpDir);
      },
      filename: (_req, file, cb) => {
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === "video/mp4") {
        cb(null, true);
      } else {
        cb(new Error("Only MP4 files are accepted"));
      }
    },
    limits: {
      fileSize: 1024, // 1KB limit for testing
    },
  });

  testApp.use(express.json());
  testApp.post("/process", lowLimitUpload.single("video"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No video file provided" });
      return;
    }
    res.status(202).json({ jobId: "test-id", status: "uploaded" });
  });

  // Error handler that mimics the production one
  testApp.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File size exceeds 500MB limit" });
      return;
    }
    if (err.message === "Only MP4 files are accepted") {
      res.status(415).json({ error: "Only MP4 files are accepted" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  });

  return testApp;
}

describe("POST /process - upload endpoint", () => {
  it("should return 400 when no file is provided", async () => {
    const response = await request(app).post("/process");
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("No video file provided");
  });

  it("should return 415 when non-MP4 mimetype is uploaded", async () => {
    const response = await request(app)
      .post("/process")
      .attach("video", Buffer.from("fake image data"), {
        filename: "image.png",
        contentType: "image/png",
      });
    expect(response.status).toBe(415);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("Only MP4 files are accepted");
  });

  it("should return 413 when file exceeds size limit", async () => {
    // Use a test app with a 1KB limit to test 413 without uploading huge files
    const testApp = createLowLimitApp();
    const response = await request(testApp)
      .post("/process")
      .attach("video", Buffer.alloc(2048), {
        filename: "large.mp4",
        contentType: "video/mp4",
      });
    expect(response.status).toBe(413);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("500MB");
  });

  it("should return 202 with jobId for valid MP4 upload and create job directory", async () => {
    const response = await request(app)
      .post("/process")
      .attach("video", Buffer.from("fake mp4 data for testing"), {
        filename: "sample.mp4",
        contentType: "video/mp4",
      });
    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty("jobId");
    expect(response.body).toHaveProperty("status", "uploaded");
    expect(response.body).toHaveProperty("message");

    // Verify jobId is a UUID v4 format
    const jobId = response.body.jobId;
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(jobId).toMatch(uuidV4Regex);

    // Verify directory structure was created
    const pipelineDir = process.env.PIPELINE_DATA_DIR || "/data/pipeline";
    const inputDir = path.join(pipelineDir, jobId, "input");
    const inputExists = await fs
      .stat(inputDir)
      .then(() => true)
      .catch(() => false);
    expect(inputExists).toBe(true);

    // Verify video.mp4 exists in input directory
    const videoFile = path.join(inputDir, "video.mp4");
    const videoExists = await fs
      .stat(videoFile)
      .then(() => true)
      .catch(() => false);
    expect(videoExists).toBe(true);

    // Clean up test directory
    await fs.rm(path.join(pipelineDir, jobId), {
      recursive: true,
      force: true,
    });
  });
});

describe("ProcessResponseSchema", () => {
  it("should validate a correct response shape", async () => {
    // Import schema after module is created
    const { ProcessResponseSchema } = await import(
      "../schemas/response.js"
    );
    const valid = ProcessResponseSchema.safeParse({
      jobId: "550e8400-e29b-41d4-a716-446655440000",
      status: "uploaded",
      message: "Video uploaded successfully",
    });
    expect(valid.success).toBe(true);
  });

  it("should reject a response with invalid jobId", async () => {
    const { ProcessResponseSchema } = await import(
      "../schemas/response.js"
    );
    const result = ProcessResponseSchema.safeParse({
      jobId: "not-a-uuid",
      status: "uploaded",
      message: "Video uploaded successfully",
    });
    expect(result.success).toBe(false);
  });

  it("should reject a response missing required fields", async () => {
    const { ProcessResponseSchema } = await import(
      "../schemas/response.js"
    );
    const result = ProcessResponseSchema.safeParse({
      jobId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });
});