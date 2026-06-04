// @vitest-environment node
// metadata-api.test.ts — supertest integration tests for POST /api/metadata + GET /api/metadata/:jobId
//
// Strategy:
// - Set METADATA_* env + PIPELINE_DATA_DIR to a temp dir BEFORE importing the app
//   (module-caching lesson from 24-02 — lazy getters let us override per test file).
// - Seed {jobId}/whisper/transcript.json in the temp dir.
// - Mock global fetch (the router call) so no real network hits happen.
// - Cover: happy path, GET re-serve, persistence, all error-mapped paths.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_UUID = "11111111-2222-3333-4444-555555555555";
const VALID_UUID_2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const SAMPLE_TRANSCRIPT = {
  language: "es",
  model: "whisperx-large-v3",
  segments: [
    { id: 0, start: 0.0, end: 5.0, text: "Hoy vamos a hablar sobre cómo mejorar tu productividad en el trabajo.", words: [] },
    { id: 1, start: 5.1, end: 10.0, text: "Con estos tres consejos simples puedes doblar tu eficiencia.", words: [] },
  ],
};

const VALID_METADATA_JSON = JSON.stringify({
  title: "Dobla tu productividad con 3 consejos simples",
  description: "Descubre cómo mejorar tu productividad en el trabajo.",
  hashtags: ["#Productividad", "#Consejos", "#Trabajo"],
});

// ─── Temp directories BEFORE import ──────────────────────────────────────────

const TEST_PIPELINE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "metadata-api-test-"));

// Set env BEFORE importing the app so lazy getters pick up the overrides
process.env.NODE_ENV = "test";
process.env.PIPELINE_DATA_DIR = TEST_PIPELINE_DIR;
process.env.METADATA_API_URL = "http://mock-router:3210";
process.env.METADATA_API_KEY = "test-bearer-token";
process.env.METADATA_MODEL = "big-cloud";
// Disable basic auth
delete process.env.STUDIO_BASIC_AUTH_USER;
delete process.env.STUDIO_BASIC_AUTH_PASSWORD;
// Avoid conflicts with other test files
process.env.API_SERVER_URL = "http://mock-api-server:3000";

// ─── Mock global fetch (router + api-server) ─────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Import app AFTER env + mock setup ───────────────────────────────────────

import app from "./server.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a mock successful router response with the given content string.
 */
function makeRouterResponse(content: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => {
        if (name === "x-model-backend") return "ollama-cloud";
        if (name === "x-cost-cents") return "0.2";
        return null;
      },
    },
    json: () =>
      Promise.resolve({
        choices: [{ message: { content } }],
      }),
    text: () => Promise.resolve(`HTTP ${status} error`),
  };
}

/** Seed {jobId}/whisper/transcript.json with given data */
function seedTranscript(jobId: string, data: unknown = SAMPLE_TRANSCRIPT): void {
  const dir = path.join(TEST_PIPELINE_DIR, jobId, "whisper");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "transcript.json"), JSON.stringify(data), "utf-8");
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(() => {
  // Seed a primary transcript
  seedTranscript(VALID_UUID);
});

afterAll(() => {
  try {
    fs.rmSync(TEST_PIPELINE_DIR, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

beforeEach(() => {
  mockFetch.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/metadata", () => {
  it("happy path: returns 200 with title/description/hashtags and persists metadata.json", async () => {
    mockFetch.mockResolvedValueOnce(makeRouterResponse(VALID_METADATA_JSON));

    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: VALID_UUID, platform: "tiktok", tone: "cercano" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Dobla tu productividad con 3 consejos simples");
    expect(res.body.description).toBeDefined();
    expect(Array.isArray(res.body.hashtags)).toBe(true);
    expect(res.body._meta).toBeDefined();
    expect(res.body._meta.model).toBe("big-cloud");

    // Verify metadata.json was persisted
    const metaPath = path.join(TEST_PIPELINE_DIR, VALID_UUID, "metadata.json");
    expect(fs.existsSync(metaPath)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { title: string };
    expect(saved.title).toBe("Dobla tu productividad con 3 consejos simples");
  });

  it("returns 400 for invalid jobId", async () => {
    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: "not-a-uuid", platform: "tiktok", tone: "cercano" });

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 for path-traversal jobId '../evil'", async () => {
    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: "../evil", platform: "tiktok", tone: "cercano" });

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 for unknown platform", async () => {
    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: VALID_UUID, platform: "twitter", tone: "cercano" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/platform/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 for unknown tone", async () => {
    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: VALID_UUID, platform: "instagram", tone: "random-tone" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tone/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 404 when transcript.json does not exist for the jobId", async () => {
    const missingJobId = "99999999-9999-9999-9999-999999999999";
    // Do NOT seed transcript for this jobId

    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: missingJobId, platform: "tiktok", tone: "cercano" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/transcript/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 503 when METADATA_API_KEY is empty (router not configured)", async () => {
    // Temporarily clear the key
    const origKey = process.env.METADATA_API_KEY;
    process.env.METADATA_API_KEY = "";

    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: VALID_UUID, platform: "tiktok", tone: "cercano" });

    process.env.METADATA_API_KEY = origKey;

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/router no configurado/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 502 when the router returns HTTP 500", async () => {
    mockFetch.mockResolvedValueOnce(makeRouterResponse("Internal Server Error", 500));

    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: VALID_UUID, platform: "tiktok", tone: "cercano" });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/router/i);
  });

  it("returns 502 when the router returns invalid JSON twice (MetadataValidationError after retry)", async () => {
    // Both attempts return unparseable / non-conforming content
    const badContent = JSON.stringify({ not_title: "wrong", not_description: "also wrong" });
    mockFetch
      .mockResolvedValueOnce(makeRouterResponse(badContent))
      .mockResolvedValueOnce(makeRouterResponse(badContent));

    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: VALID_UUID, platform: "tiktok", tone: "cercano" });

    expect(res.status).toBe(502);
    expect(res.body.error).toBeDefined();
  });

  it("returns 422 when transcript is empty (no segments, no text)", async () => {
    const emptyJobId = "22222222-2222-2222-2222-222222222222";
    seedTranscript(emptyJobId, { language: "es", segments: [] });

    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: emptyJobId, platform: "tiktok", tone: "cercano" });

    expect(res.status).toBe(422);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("works with instagram platform and profesional tone", async () => {
    mockFetch.mockResolvedValueOnce(makeRouterResponse(VALID_METADATA_JSON));

    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: VALID_UUID, platform: "instagram", tone: "profesional" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBeDefined();
  });

  it("works with youtube_shorts platform and llamativo tone", async () => {
    mockFetch.mockResolvedValueOnce(makeRouterResponse(VALID_METADATA_JSON));

    const res = await request(app)
      .post("/api/metadata")
      .send({ jobId: VALID_UUID, platform: "youtube_shorts", tone: "llamativo" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBeDefined();
  });
});

describe("GET /api/metadata/:jobId", () => {
  it("returns 200 with persisted metadata after a successful POST", async () => {
    // Seed a second UUID and do a full POST first
    seedTranscript(VALID_UUID_2);
    mockFetch.mockResolvedValueOnce(makeRouterResponse(VALID_METADATA_JSON));

    await request(app)
      .post("/api/metadata")
      .send({ jobId: VALID_UUID_2, platform: "tiktok", tone: "cercano" });

    const res = await request(app).get(`/api/metadata/${VALID_UUID_2}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Dobla tu productividad con 3 consejos simples");
    expect(Array.isArray(res.body.hashtags)).toBe(true);
  });

  it("returns 404 for a jobId with no metadata.json", async () => {
    const noMetaId = "33333333-3333-3333-3333-333333333333";

    const res = await request(app).get(`/api/metadata/${noMetaId}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("returns 400 for an invalid jobId format", async () => {
    const res = await request(app).get("/api/metadata/not-a-uuid");

    expect(res.status).toBe(400);
  });

  it("returns 400 for path-traversal jobId", async () => {
    // URL-encoded '../..'
    const res = await request(app).get("/api/metadata/..%2F..");

    expect(res.status).toBe(400);
  });
});
