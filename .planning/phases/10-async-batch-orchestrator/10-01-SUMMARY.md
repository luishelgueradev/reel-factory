---
phase: 10-async-batch-orchestrator
plan: 01
subsystem: infra
tags: redis, bullmq, ioredis, zod, docker-compose, job-queue, progress-tracking

# Dependency graph
requires:
  - phase: 09-api-server
    provides: Express API server, Docker orchestration, shared constants
provides:
  - Redis service in Docker Compose with healthcheck and persistence
  - BullMQ Queue module (queue.ts) with shared connection factory
  - Zod batch schemas (batch.ts) for API validation
  - Redis progress tracking module (progress.ts) for job state
  - Fixed STEP_NAMES with srt-exporter entry
affects: [10-async-batch-orchestrator]

# Tech tracking
tech-stack:
  added: [redis:7-alpine, bullmq@5.76.8, ioredis@5.10.1, @types/ioredis]
  patterns: [BullMQ Queue with exponential backoff retry, Redis hash-based progress tracking, Redis list-based batch→job mapping, TTL-based job data expiration]

key-files:
  created: [docker-compose.yml (redis service addition), services/api-server/src/queue.ts, services/api-server/src/progress.ts, services/api-server/src/schemas/batch.ts]
  modified: [docker-compose.yml, services/api-server/package.json, shared/constants.ts]

key-decisions:
  - "Redis 7-alpine for lightweight production image with AOF persistence"
  - "ioredis lowercase method names (hset, hgetall, rpush, lrange) per ioredis API convention"
  - "BullMQ attempts:2 for 1 automatic retry with 30s exponential backoff"
  - "Shared Redis connection from queue.ts reused in progress.ts to avoid connection sprawl"

patterns-established:
  - "Redis hash for job progress (job:{jobId}) with 24h TTL"
  - "Redis list for batch→job mapping (batch:{batchId}) with 25h TTL"
  - "BullMQ Queue named 'video-processing' as central job queue"

requirements-completed: [APIA-02]

# Metrics
duration: 7min
completed: 2026-05-13
---

# Phase 10 Plan 01: Redis + BullMQ Infrastructure Summary

**Redis service, BullMQ queue module, Zod batch schemas, and per-job progress tracking with shared Redis connection**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-13T01:23:18Z
- **Completed:** 2026-05-13T01:31:03Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Redis service in Docker Compose with AOF persistence, healthcheck, and volume
- BullMQ Queue module with shared Redis connection, retry config, and job retention limits
- Zod batch schemas for batch API validation (BatchJobSchema, BatchResponseSchema, BatchStatusResponseSchema)
- Redis progress tracking module with hash operations for job state and list operations for batch→job mapping
- Fixed STEP_NAMES to include srt-exporter entry

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Redis to Docker Compose + BullMQ/ioredis dependencies + create queue module** - `233b21b` (feat)
2. **Task 2: Create batch Zod schemas + Redis progress tracking module + fix STEP_NAMES** - `d6dfa7c` (feat)

## Files Created/Modified
- `docker-compose.yml` - Added Redis service, redis-data volume, redis depends_on for api-server, env vars (REDIS_URL, MAX_CONCURRENT_JOBS, MAX_BATCH_SIZE)
- `services/api-server/package.json` - Added bullmq, ioredis, @types/ioredis dependencies
- `services/api-server/src/queue.ts` - BullMQ Queue instance, createQueueConnection, QUEUE_NAME, closeQueueConnection
- `services/api-server/src/progress.ts` - updateJobProgress, getJobProgress, addJobToBatch, getBatchJobs with Redis hash/list operations
- `services/api-server/src/schemas/batch.ts` - BatchJobSchema, BatchResponseSchema, BatchStatusResponseSchema, JOB_STATUS_VALUES
- `shared/constants.ts` - Added srtExporter: "srt-exporter" to STEP_NAMES

## Decisions Made
- Redis 7-alpine chosen for lightweight production image with AOF persistence (per STACK.md)
- ioredis lowercase method names used (hset, hgetall, rpush, lrange) per ioredis v5 API convention — initial implementation used cameCase which caused TS errors
- BullMQ attempts:2 configured for 1 automatic retry with exponential backoff starting at 30s (D-06)
- Shared Redis connection reused from queue.ts in progress.ts to avoid connection sprawl

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ioredis method casing from camelCase to lowercase**
- **Found during:** Task 2 (progress.ts creation)
- **Issue:** Initial progress.ts used camelCase ioredis methods (hSet, hGetAll, rPush, lRange) which don't exist in ioredis v5 — TS compiler caught `Property 'hSet' does not exist on type 'Redis'. Did you mean 'hset'?`
- **Fix:** Changed all method calls to lowercase (hset, hgetall, rpush, lrange) matching ioredis v5 API convention
- **Files modified:** services/api-server/src/progress.ts
- **Verification:** TypeScript compiles without errors in new files
- **Committed in:** d6dfa7c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal — ioredis API casing convention mismatch caught by TypeScript compiler and fixed immediately. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Redis infrastructure ready for Plans 02-03 (batch API endpoint and BullMQ worker)
- BullMQ Queue instance ready for job submission
- Progress tracking ready for per-job status updates
- Batch schemas ready for API route validation

---
*Phase: 10-async-batch-orchestrator*
*Completed: 2026-05-13*