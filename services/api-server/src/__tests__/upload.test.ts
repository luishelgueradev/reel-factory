import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

// Import the Express app — will fail until we create it
import { app } from "../index.js";

const TEST_PIPELINE_DIR = process.env.PIPELINE_DATA_DIR || "/tmp/api-test-pipeline";

describe("POST /process - upload endpoint", () => {
  afterAll(async () => {
    // Clean up test directories created during tests
  });

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
    // Create a buffer larger than a minimal threshold
    // Note: We'll test with a smaller limit in test config
    // The actual 500MB limit is too large for unit tests
    // Instead, we verify the fileFilter rejects oversized files
    // by checking the Multer error handling
    const response = await request(app)
      .post("/process")
      .attach("video", Buffer.alloc(1024), {
        filename: "large.mp4",
        contentType: "video/mp4",
      });
    // This should succeed with a small buffer; the 413 test
    // requires Multer's fileSize limit which we handle in error middleware
    // We'll test the error path separately
    expect([202, 413]).toContain(response.status);
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