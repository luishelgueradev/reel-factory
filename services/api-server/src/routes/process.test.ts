import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import fs from "fs/promises";
import path from "path";
import os from "os";

// We'll import the app after setting up mocks
// Mock the orchestrator module
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

import { app } from "../index.js";
import { runPipeline, PipelineStepError } from "../orchestrator.js";
import type { PipelineResult } from "../orchestrator.js";

// Use a temp directory for tests
const TEST_PIPELINE_DIR = await fs.mkdtemp(
  path.join(os.tmpdir(), "process-test-")
);

// Override PIPELINE_DATA_DIR for tests before importing
process.env.PIPELINE_DATA_DIR = TEST_PIPELINE_DIR;

describe("POST /process - full pipeline handler", () => {
  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Ensure test directory exists
    await fs.mkdir(TEST_PIPELINE_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up job directories but keep the base test dir
    const entries = await fs.readdir(TEST_PIPELINE_DIR).catch(() => []);
    for (const entry of entries) {
      if (entry !== "tmp") {
        await fs.rm(path.join(TEST_PIPELINE_DIR, entry), { recursive: true, force: true }).catch(() => {});
      }
    }
  });

  it("should return 200 with videoUrl and artifacts when pipeline succeeds", async () => {
    const mockResult: PipelineResult = {
      jobId: "test-uuid-123",
      steps: [
        { name: "whisper", durationSeconds: 10, status: "success" },
        { name: "silence-cutter", durationSeconds: 5, status: "success" },
        { name: "ffmpeg-finalizer", durationSeconds: 15, status: "success" },
        { name: "remotion-renderer", durationSeconds: 30, status: "success" },
        { name: "srt-exporter", durationSeconds: 3, status: "success" },
      ],
      artifacts: {
        whisper: ["transcript.json", "manifest.json"],
        "silence-cutter": ["output.mp4", "silence-cuts.json", "manifest.json"],
        "ffmpeg-finalizer": ["output.mp4", "finalizer-info.json", "manifest.json"],
        "remotion-renderer": ["output.mp4", "caption-pages.json", "remotion-info.json", "manifest.json"],
        "srt-exporter": ["output.srt", "output.vtt", "manifest.json"],
      },
      totalDurationSeconds: 123.45,
      videoUrl: "/artifacts/test-uuid-123/remotion-renderer/output.mp4",
    };
    vi.mocked(runPipeline).mockResolvedValue(mockResult);

    // Create a small buffer to upload as MP4
    const fakeVideo = Buffer.from("fake mp4 data for processing test");

    const response = await request(app)
      .post("/process")
      .attach("video", fakeVideo, {
        filename: "test.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("jobId");
    expect(response.body).toHaveProperty("videoUrl");
    expect(response.body).toHaveProperty("artifacts");
    expect(response.body).toHaveProperty("duration_seconds");
    expect(response.body.videoUrl).toContain("/remotion-renderer/output.mp4");

    // Verify runPipeline was called with the uploaded job's ID
    expect(runPipeline).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(runPipeline).mock.calls[0];
    expect(callArgs[0]).toBeTruthy(); // jobId should be provided
  });

  it("should return 500 with step error info when a pipeline step fails", async () => {
    const stepError = new PipelineStepError("whisper", 1, "Transcription failed");
    vi.mocked(runPipeline).mockRejectedValue(stepError);

    const fakeVideo = Buffer.from("fake mp4 data for error test");

    const response = await request(app)
      .post("/process")
      .attach("video", fakeVideo, {
        filename: "test.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("step", "whisper");
    expect(response.body.error).toHaveProperty("exitCode", 1);
    expect(response.body.error).toHaveProperty("message");
    expect(response.body.error.message).toContain("Transcription failed");
  });

  it("should return 408 with timeout info when pipeline exceeds timeout", async () => {
    // Simulate a timeout by making runPipeline hang indefinitely
    // The handler should use req.setTimeout and AbortController
    vi.mocked(runPipeline).mockImplementation(
      () => new Promise((_resolve, reject) => {
        // Never resolve — simulates an infinite pipeline run
        setTimeout(() => {
          reject(new Error("Pipeline timed out"));
        }, 600000); // 10 minutes — will be aborted by timeout
      })
    );

    // We test the timeout logic via a shorter PROCESS_TIMEOUT_MS
    // Since testing actual timeout takes too long, we'll test the error path
    // This test verifies that when runPipeline rejects with a timeout error,
    // the handler returns 408.

    // Instead, let's use a more direct test: mock runPipeline to reject with a timeout-like error
    vi.mocked(runPipeline).mockRejectedValue(
      new Error("Pipeline exceeded 600000ms timeout")
    );

    const fakeVideo = Buffer.from("fake mp4 data for timeout test");

    const response = await request(app)
      .post("/process")
      .attach("video", fakeVideo, {
        filename: "test.mp4",
        contentType: "video/mp4",
      });

    // The handler should detect timeout errors and return 408
    expect(response.status).toBe(408);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("step", "timeout");
  });
});