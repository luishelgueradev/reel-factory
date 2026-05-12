import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

// Mock runPipeline so upload tests don't need Docker
vi.mock("../orchestrator.js", () => ({
  runPipeline: vi.fn(),
  PipelineStepError: class PipelineStepError extends Error {
    public readonly stepName: string;
    public readonly exitCode: number;
    public readonly errorMessage: string;
    constructor(stepName: string, exitCode: number, errorMessage: string) {
      super(`Pipeline step "${stepName}" failed (exit code ${exitCode}): ${errorMessage}`);
      this.name = "PipelineStepError";
      this.stepName = stepName;
      this.exitCode = exitCode;
      this.errorMessage = errorMessage;
    }
  },
  STEPS: [],
}));

import type { PipelineResult } from "../orchestrator.js";
import { runPipeline } from "../orchestrator.js";

// Import the Express app
import { app } from "../index.js";
import { upload, UnsupportedMediaTypeError, FileTooLargeError } from "../routes/process.js";

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

  it("should return 200 with jobId and videoUrl for valid MP4 upload when pipeline succeeds", async () => {
    // Mock runPipeline to return a successful result
    const mockResult: PipelineResult = {
      jobId: "test-job-id",
      steps: [
        { name: "whisper", durationSeconds: 10, status: "success" },
      ],
      artifacts: {
        whisper: ["transcript.json", "manifest.json"],
        "remotion-renderer": ["output.mp4"],
      },
      totalDurationSeconds: 60,
      videoUrl: "/artifacts/test-job-id/remotion-renderer/output.mp4",
    };
    vi.mocked(runPipeline).mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/process")
      .attach("video", Buffer.from("fake mp4 data for testing"), {
        filename: "sample.mp4",
        contentType: "video/mp4",
      });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("jobId");
    expect(response.body).toHaveProperty("videoUrl");
    expect(response.body).toHaveProperty("duration_seconds");

    // Verify runPipeline was called with a jobId
    expect(runPipeline).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(runPipeline).mock.calls[0];
    expect(callArgs[0]).toBeTruthy(); // jobId should be provided
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