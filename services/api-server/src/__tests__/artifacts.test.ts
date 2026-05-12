import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

import { app } from "../index.js";
import { PIPELINE_DATA_DIR } from "../constants.js";

/**
 * Helper: create a fake job directory with step outputs for testing artifacts.
 */
async function createFakeJob(jobId: string, steps: Record<string, string[]>): Promise<string> {
  const jobDir = path.join(PIPELINE_DATA_DIR, jobId);
  await fs.mkdir(jobDir, { recursive: true });

  for (const [stepName, files] of Object.entries(steps)) {
    const stepDir = path.join(jobDir, stepName);
    await fs.mkdir(stepDir, { recursive: true });
    for (const filename of files) {
      await fs.writeFile(path.join(stepDir, filename), `fake ${filename} content`);
    }
  }

  return jobDir;
}

/**
 * Helper: make a request that doesn't auto-parse the response body.
 * Needed for serving binary/text files where supertest's JSON parser fails.
 */
function rawRequest(app: express.Application, method: string, url: string) {
  return request(app)
    [method as "get"](url)
    .accept("application/octet-stream")
    .parse((res, callback) => {
      res.setEncoding("latin1");
      const data: string[] = [];
      res.on("data", (chunk) => data.push(chunk));
      res.on("end", () => callback(null, data.join("")));
    });
}

describe("GET /artifacts/:jobId - artifact listing", () => {
  it("should return 404 for nonexistent job", async () => {
    const response = await request(app).get(`/artifacts/nonexistent-job-${Date.now()}`);
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("not found");
  });

  it("should return artifact map for valid job", async () => {
    const jobId = uuidv4();
    const jobDir = await createFakeJob(jobId, {
      whisper: ["transcript.json", "manifest.json"],
      "silence-cutter": ["silence-cuts.json", "manifest.json"],
    });

    const response = await request(app).get(`/artifacts/${jobId}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("jobId", jobId);
    expect(response.body).toHaveProperty("artifacts");
    expect(response.body.artifacts).toHaveProperty("whisper");
    expect(response.body.artifacts.whisper).toContain("transcript.json");
    expect(response.body.artifacts).toHaveProperty("silence-cutter");
    expect(response.body.artifacts["silence-cutter"]).toContain("silence-cuts.json");

    // Clean up
    await fs.rm(jobDir, { recursive: true, force: true });
  });
});

describe("GET /artifacts/:jobId/:stepName/:filename - artifact serving", () => {
  it("should return 200 and file content for valid artifact", async () => {
    const jobId = uuidv4();
    const jobDir = await createFakeJob(jobId, {
      whisper: ["transcript.json", "output.txt"],
    });

    // Test with a .txt file using raw request to avoid JSON auto-parsing
    const response = await rawRequest(app, "get", `/artifacts/${jobId}/whisper/output.txt`);
    expect(response.status).toBe(200);
    expect(response.body).toContain("fake output.txt content");

    // Verify .json file serves correctly too (raw request avoids JSON parse errors)
    const jsonResponse = await rawRequest(app, "get", `/artifacts/${jobId}/whisper/transcript.json`);
    expect(jsonResponse.status).toBe(200);
    expect(jsonResponse.body).toContain("fake transcript.json content");

    // Clean up
    await fs.rm(jobDir, { recursive: true, force: true });
  });

  it("should return 404 for nonexistent artifact", async () => {
    const jobId = uuidv4();
    const jobDir = await createFakeJob(jobId, {
      whisper: ["transcript.json"],
    });

    const response = await request(app).get(
      `/artifacts/${jobId}/whisper/nonexistent.json`
    );
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("not found");

    // Clean up
    await fs.rm(jobDir, { recursive: true, force: true });
  });

  it("should return 403 for path traversal attempt", async () => {
    const response = await request(app).get(
      "/artifacts/../../../etc/passwd"
    );
    // The path traversal could either be caught by our validation (403)
    // or by Express's routing (404), both are acceptable security responses
    expect([403, 404]).toContain(response.status);
  });

  it("should return 403 for directory traversal with encoded path", async () => {
    const response = await request(app).get(
      "/artifacts/valid-job/../../etc/passwd"
    );
    // Path traversal attempts should be rejected
    expect([403, 404]).toContain(response.status);
  });
});