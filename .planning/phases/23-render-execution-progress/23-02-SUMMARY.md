---
phase: 23-render-execution-progress
plan: "02"
subsystem: remotion-studio/server
tags: [proxy, express, streaming, multipart, range-headers, supertest, vitest, RENDER-01, RENDER-02, RENDER-04]
dependency_graph:
  requires: ["23-01"]
  provides: ["POST /api/render proxy", "GET /api/status/:jobId proxy", "GET /api/result/:jobId Range proxy", "test-guarded app.listen"]
  affects: ["services/remotion-studio/src/server.ts", "services/remotion-studio/src/server.test.ts"]
tech_stack:
  added: []
  patterns:
    - "NODE_ENV/VITEST guard on app.listen — mirrors api-server/src/index.ts L93"
    - "Streaming multipart proxy via fetch(body:req, duplex:'half') — Node 22 required pattern"
    - "UUID regex gate (verbatim from status.ts) before all upstream calls"
    - "Pinned step/filename (quality-finalizer/output.mp4) for path-traversal mitigation"
    - "Readable.fromWeb().pipe(res) wrapped in Promise for Express 5 async compatibility"
    - "@vitest-environment node + vi.stubGlobal fetch for server integration tests"
key_files:
  modified:
    - path: services/remotion-studio/src/server.ts
      role: "app.listen guard + API_SERVER_URL constant + 3 proxy routes (render/status/result)"
  created:
    - path: services/remotion-studio/src/server.test.ts
      role: "10 supertest integration tests covering all 3 proxy routes"
decisions:
  - "Forward to POST /batch (not /process): queue path returns jobId immediately enabling RENDER-02 polling; /process blocks until render completes"
  - "API_SERVER_URL env var constant for testability (defaults to http://api-server:3000)"
  - "duplex:'half' on fetch body passthrough — required by Node 22 fetch for streaming request bodies (RESEARCH Pitfall 3)"
  - "Wrap Readable.fromWeb().pipe(res) in Promise for Express 5 async handler compatibility"
  - ".buffer(true) on supertest Range test — required because streaming response + small body causes ECONNRESET without content-length-driven buffering"
metrics:
  duration: "7m 21s"
  completed: "2026-06-03"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 1
  files_created: 1
  tests_before: 166
  tests_after: 176
---

# Phase 23 Plan 02: Server Proxy Routes (RENDER-01/02/04) Summary

Studio Express server now proxies render submission to api-server POST /batch with streaming multipart passthrough, returning jobId immediately for live polling; UUID-gated status and Range-aware result proxies complete the render execution surface.

## What Was Built

Three proxy routes were added to `services/remotion-studio/src/server.ts` behind the existing basic-auth middleware, turning the Studio into the single public origin for rendering:

1. **`POST /api/render`** — Replaces the 501 stub. Streams the inbound multipart body to `http://api-server:3000/batch` using Node 22 `fetch(body:req, duplex:'half')`. No re-parsing in Studio: the multipart boundary survives intact to api-server's multer. Returns upstream status + JSON (jobId in `jobs[0].jobId`) verbatim. Upstream field name: `videos` (batch.ts `upload.array("videos")`). 502 on network failure.

2. **`GET /api/status/:jobId`** — UUID-validates jobId (exact regex from status.ts), then relays `GET /status/:jobId` from api-server verbatim. Returns `{status, currentStep, progress, stepInfo, steps, error}`. 400 without calling upstream on invalid UUID.

3. **`GET /api/result/:jobId`** — UUID-validates jobId, proxies `quality-finalizer/output.mp4` from api-server. Step name and filename are PINNED (not request-derived). Forwards `Range` header, relays `content-type/content-length/accept-ranges/content-range` for 206 partial content support. `?download=1` adds `Content-Disposition: attachment`. Streams body via `Readable.fromWeb().pipe(res)`.

The `app.listen(PORT, ...)` call is now wrapped in `if (process.env.NODE_ENV !== "test" && !process.env.VITEST)` so the app imports cleanly under vitest without binding port 3123.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 05ac017 | Guard app.listen for test imports (no port bind under vitest) |
| 2 | 6da997f | Replace 501 /api/render stub with streaming multipart proxy |
| 3 | ccea916 | Add GET /api/status/:jobId and GET /api/result/:jobId proxy routes |
| 4 | 735a140 | server.test.ts — 10 supertest integration tests, all green |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Readable.fromWeb().pipe(res) needs Promise wrap for Express 5 async**
- **Found during:** Task 4 test execution
- **Issue:** In Express 5, async route handlers that return after calling `Readable.fromWeb().pipe(res)` without `await` can trigger "no response" behavior or ECONNRESET in supertest
- **Fix:** Wrapped `Readable.fromWeb(upstream.body!).pipe(res)` in `await new Promise<void>((resolve, reject) => ...)` listening for `finish`/`error`. Also guarded the catch block with `!res.headersSent` to prevent double-response
- **Files modified:** `services/remotion-studio/src/server.ts`
- **Commit:** 735a140

**2. [Rule 1 - Bug] supertest ECONNRESET on streaming 206 response**
- **Found during:** Task 4 test execution (Range header test)
- **Issue:** When testing a 206 partial response with a small streaming body, supertest received ECONNRESET because there was no `content-length` header to bound the read, and the stream completed before supertest finished reading
- **Fix:** Added `content-length: String(fakeBody.length)` to the mock response headers and used `.buffer(true)` on the supertest request to force full body buffering
- **Files modified:** `services/remotion-studio/src/server.test.ts`
- **Commit:** 735a140

## Tests

- Full vitest suite: **176/176 passing** (was 166/166 before this plan)
- New tests in `server.test.ts`: 10 tests covering all 3 proxy routes

## Known Stubs

None. All three routes are fully functional proxies. The result proxy step/filename are pinned constants, not configurable stubs.

## Threat Surface Scan

No new threat surface beyond what the plan's `<threat_model>` already covers:
- T-23-02-01: UUID gate + pinned step/filename implemented
- T-23-02-02: UUID gate on status route implemented
- T-23-02-03: All 3 routes registered AFTER auth middleware (verified in tests)
- T-23-02-04: Streaming passthrough (no buffering) implemented

## Self-Check: PASSED

- `services/remotion-studio/src/server.ts` — exists, modified
- `services/remotion-studio/src/server.test.ts` — exists, created
- Commits 05ac017, 6da997f, ccea916, 735a140 — all present in git log
- 176/176 tests passing
- No TypeScript errors in server.ts
