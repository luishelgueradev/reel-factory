---
phase: 10-async-batch-orchestrator
plan: 04
subsystem: infra
tags: concurrency, health-check, redis, bullmq, batch-size, env-config

# Dependency graph
requires:
  - phase: 10-async-batch-orchestrator/01
    provides: BullMQ Queue, Redis progress tracking, shared constants
  - phase: 10-async-batch-orchestrator/02
    provides: POST /batch endpoint, batch upload routes, MAX_BATCH_SIZE enforcement
  - phase: 10-async-batch-orchestrator/03
    provides: BullMQ Worker, processJob, startWorker/stopWorker, graceful shutdown
provides:
  - Centralized env-configurable constants (MAX_CONCURRENT_JOBS, MAX_BATCH_SIZE, REDIS_URL)
  - Health endpoint with Redis ping and BullMQ queue connectivity checks
  - Worker concurrency wired to MAX_CONCURRENT_JOBS from constants
  - Batch size enforcement wired to MAX_BATCH_SIZE from constants
  - Queue module using REDIS_URL from constants
affects: [10-async-batch-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns: [Centralized configuration constants from env vars, Health endpoint with dependency connectivity checks and degraded status, 5-second timeout on health checks to prevent hanging]

key-files:
  created: []
  modified: [services/api-server/src/constants.ts, services/api-server/src/worker.ts, services/api-server/src/routes/batch.ts, services/api-server/src/routes/health.ts, services/api-server/src/queue.ts]

key-decisions:
  - "Redis health check uses new connection per request (ping + quit) to avoid interfering with shared connection"
  - "Health endpoint returns 200 with degraded status when Redis/BullMQ unavailable rather than 503"
  - "All configuration constants centralized in constants.ts for consistency and testability"

patterns-established:
  - "Env-configurable constants in constants.ts: MAX_CONCURRENT_JOBS, MAX_BATCH_SIZE, REDIS_URL"
  - "Health endpoint pattern: check dependencies with timeout, return degraded status instead of errors"

requirements-completed: [APIA-01, APIA-02, APIA-03]

# Metrics
duration: 3min
completed: 2026-05-13
---

# Phase 10 Plan 04: Concurrency Config + Health Checks + E2E Checkpoint Summary

**Centralized env-configurable constants (MAX_CONCURRENT_JOBS, MAX_BATCH_SIZE, REDIS_URL), Redis/BullMQ health endpoint with degraded status, and E2E batch verification checkpoint**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-13T01:51:46Z
- **Completed:** 2026-05-13T01:54:58Z
- **Tasks:** 1 (code task) + 1 (verification checkpoint)
- **Files modified:** 5

## Accomplishments
- MAX_CONCURRENT_JOBS and MAX_BATCH_SIZE constants centralized in constants.ts, configurable via env vars
- REDIS_URL constant centralized in constants.ts, removing inline env var reads from queue.ts
- Health endpoint (GET /health) now reports Redis and BullMQ connectivity with 5-second timeout per check
- Worker concurrency wired to MAX_CONCURRENT_JOBS constant (was previously inline parseInt)
- Batch size enforcement wired to MAX_BATCH_SIZE constant (was previously inline parseInt)
- All 47 existing tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire concurrency configuration + batch size enforcement + health checks** - `f1083d7` (feat)

## Files Created/Modified
- `services/api-server/src/constants.ts` - Added MAX_BATCH_SIZE, MAX_CONCURRENT_JOBS, REDIS_URL exports with env var configuration
- `services/api-server/src/worker.ts` - Replaced inline parseInt with MAX_CONCURRENT_JOBS import from constants
- `services/api-server/src/routes/batch.ts` - Replaced inline MAX_BATCH_SIZE with import from constants
- `services/api-server/src/routes/health.ts` - Added Redis ping check and BullMQ queue connectivity check with 5s timeouts, returns degraded status when services unavailable
- `services/api-server/src/queue.ts` - Replaced inline REDIS_URL with import from constants

## Decisions Made
- Health endpoint creates a new Redis connection for each health check (ping then quit) rather than reusing the shared connection — avoids interfering with BullMQ's connection pool
- Health endpoint returns 200 with `"status": "degraded"` when Redis or BullMQ is unavailable rather than 503 — provides visibility without breaking load balancers
- 5-second timeout per dependency check prevents the health endpoint from hanging if Redis or BullMQ is unresponsive

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Checkpoint: E2E Batch Verification

Task 2 is a `checkpoint:human-verify` for end-to-end batch testing in Docker. No code changes were required for this task. Verification steps:

1. Start Redis: `docker compose up -d redis`
2. Build and start API server: `docker compose up -d api-server`
3. Verify health: `curl http://localhost:3000/health` — should show `"redis": "connected"` and `"queue": "connected"`
4. Submit a batch of test videos: `curl -X POST http://localhost:3000/batch -F "videos=@test-video-1.mp4" -F "videos=@test-video-2.mp4" -F "videos=@test-video-3.mp4"`
5. Check batch status: `curl http://localhost:3000/batch/{batchId}`
6. Verify job isolation (one failure doesn't affect others)
7. Verify concurrency limit (max 2 concurrent jobs with MAX_CONCURRENT_JOBS=2)

## Next Phase Readiness
- All Phase 10 plans complete — full async batch orchestrator is wired and ready for E2E Docker testing
- Concurrency, batch size, and Redis connectivity are all configurable via env vars
- Health endpoint provides operational visibility for monitoring

---
*Phase: 10-async-batch-orchestrator*
*Completed: 2026-05-13*

## Self-Check: PASSED

- [x] services/api-server/src/constants.ts EXISTS
- [x] services/api-server/src/worker.ts EXISTS
- [x] services/api-server/src/routes/batch.ts EXISTS
- [x] services/api-server/src/routes/health.ts EXISTS
- [x] services/api-server/src/queue.ts EXISTS
- [x] Commit f1083d7 EXISTS
- [x] All 47 api-server tests PASS
- [x] MAX_CONCURRENT_JOBS (default 2) controls worker concurrency per D-08
- [x] MAX_BATCH_SIZE (default 10) limits batch upload per D-10
- [x] Health endpoint reports Redis and BullMQ connection status
- [x] Both values configurable via env vars