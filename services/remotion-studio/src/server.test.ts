// @vitest-environment node
// server.test.ts — supertest integration tests for the 3 proxy routes
//
// Task 1 guard: NODE_ENV="test" is set BEFORE importing the studio app so
// app.listen does NOT bind port 3123 (mirrors api-server/src/index.ts L93).
// All upstream fetch calls are mocked via vi.fn() — no real network.

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ─── Set test env BEFORE importing the studio app ───────────────────────────
process.env.NODE_ENV = "test";
// Point the proxy at a fake URL so tests can assert the URL shape
process.env.API_SERVER_URL = "http://mock-api-server:3000";
// Disable basic-auth (leave STUDIO_BASIC_AUTH_USER/PASSWORD unset) so the
// middleware no-ops and supertest requests go straight through.

// ─── Mock global fetch ───────────────────────────────────────────────────────
// All proxy routes call `fetch(API_SERVER_URL + ...)`. We stub it with vi.fn().
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Import the studio app AFTER env/mock setup ──────────────────────────────
import app from "./server.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Response-like object for mockFetch to return */
function makeFetchResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const headersMap: Record<string, string> = {
    "content-type": "application/json",
    ...headers,
  };
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => headersMap[name.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(body),
    body: null, // not needed for JSON responses
  };
}

/** Build a minimal Response-like for binary/streaming (result proxy) */
function makeBinaryFetchResponse(
  status: number,
  headers: Record<string, string> = {}
) {
  const headersMap: Record<string, string> = {
    "content-type": "video/mp4",
    "accept-ranges": "bytes",
    ...headers,
  };

  // Use a proper WHATWG ReadableStream so Readable.fromWeb() works in Node.js
  const webStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("fake-mp4-data"));
      controller.close();
    },
  });

  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => headersMap[name.toLowerCase()] ?? null,
    },
    json: () => Promise.reject(new Error("Not a JSON response")),
    body: webStream,
  };
}

const VALID_UUID = "12345678-1234-1234-1234-123456789012";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Studio server — proxy routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/render ──────────────────────────────────────────────────────

  describe("POST /api/render", () => {
    it("relays multipart upload to /batch and returns jobId from upstream", async () => {
      const upstreamJobId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
      mockFetch.mockResolvedValueOnce(
        makeFetchResponse(200, {
          batchId: "batch-123",
          jobs: [{ jobId: upstreamJobId, filename: "video.mp4", status: "queued" }],
          createdAt: new Date().toISOString(),
        })
      );

      const res = await request(app)
        .post("/api/render")
        .set("content-type", "multipart/form-data; boundary=----boundary")
        .send("------boundary\r\nContent-Disposition: form-data; name=\"videos\"\r\n\r\ndata\r\n------boundary--");

      expect(res.status).toBe(200);
      expect(res.body.jobs[0].jobId).toBe(upstreamJobId);

      // Assert upstream URL ends in /batch
      expect(mockFetch).toHaveBeenCalledOnce();
      const [calledUrl] = mockFetch.mock.calls[0] as [string, ...unknown[]];
      expect(calledUrl).toMatch(/\/batch$/);
    });

    it("returns 502 with error envelope when upstream fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const res = await request(app)
        .post("/api/render")
        .set("content-type", "multipart/form-data; boundary=----boundary")
        .send("------boundary--");

      expect(res.status).toBe(502);
      expect(res.body.error.step).toBe("proxy");
      expect(res.body.error.message).toContain("ECONNREFUSED");
    });
  });

  // ─── GET /api/status/:jobId ────────────────────────────────────────────────

  describe("GET /api/status/:jobId", () => {
    it("relays status JSON from upstream for a valid UUID", async () => {
      const mockStatus = {
        jobId: VALID_UUID,
        status: "active",
        currentStep: "whisper",
        progress: 30,
        stepInfo: null,
        steps: [],
        startedAt: new Date().toISOString(),
        error: null,
      };
      mockFetch.mockResolvedValueOnce(makeFetchResponse(200, mockStatus));

      const res = await request(app).get(`/api/status/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("active");
      expect(res.body.currentStep).toBe("whisper");
      expect(res.body.progress).toBe(30);
    });

    it("returns 400 and does NOT call fetch for a non-UUID jobId", async () => {
      const res = await request(app).get("/api/status/not-a-uuid");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid jobId format");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("relays 404 from upstream for an unknown jobId", async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchResponse(404, { error: "Job not found" })
      );

      const res = await request(app).get(`/api/status/${VALID_UUID}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Job not found");
    });

    it("returns 502 when upstream fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const res = await request(app).get(`/api/status/${VALID_UUID}`);

      expect(res.status).toBe(502);
      expect(res.body.error.step).toBe("proxy");
    });
  });

  // ─── GET /api/result/:jobId ────────────────────────────────────────────────

  describe("GET /api/result/:jobId", () => {
    it("returns 400 and does NOT call fetch for a non-UUID jobId", async () => {
      const res = await request(app).get("/api/result/not-a-uuid");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid jobId format");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("proxies upstream URL containing quality-finalizer/output.mp4 (step-name pinned)", async () => {
      mockFetch.mockResolvedValueOnce(makeBinaryFetchResponse(200));

      await request(app).get(`/api/result/${VALID_UUID}`);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [calledUrl] = mockFetch.mock.calls[0] as [string, ...unknown[]];
      expect(calledUrl).toContain("quality-finalizer/output.mp4");
    });

    it("forwards Range header to upstream and relays accept-ranges/content-range back", async () => {
      // The mock stream body is small ("fake-mp4-data") — include content-length so
      // supertest knows the exact byte count and doesn't wait for EOF with ECONNRESET.
      const fakeBody = "fake-mp4-data";
      mockFetch.mockResolvedValueOnce(
        makeBinaryFetchResponse(206, {
          "content-type": "video/mp4",
          "accept-ranges": "bytes",
          "content-range": "bytes 0-12/5000",
          "content-length": String(fakeBody.length),
        })
      );

      const res = await request(app)
        .get(`/api/result/${VALID_UUID}`)
        .set("Range", "bytes=0-12")
        .buffer(true);       // force supertest to buffer the full body

      // Verify Range was forwarded to upstream
      expect(mockFetch).toHaveBeenCalledOnce();
      const [, fetchOptions] = mockFetch.mock.calls[0] as [string, { headers?: Record<string, string> }];
      expect(fetchOptions?.headers?.["range"]).toBe("bytes=0-12");

      // Verify relay headers present in response
      expect(res.headers["accept-ranges"]).toBe("bytes");
      expect(res.headers["content-range"]).toBe("bytes 0-12/5000");
      expect(res.status).toBe(206);
    });

    it("returns 502 when upstream fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const res = await request(app).get(`/api/result/${VALID_UUID}`);

      expect(res.status).toBe(502);
      expect(res.body.error.step).toBe("proxy");
    });
  });
});
