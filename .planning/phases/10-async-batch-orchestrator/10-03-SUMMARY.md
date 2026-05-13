---
phase: 10-async-batch-orchestrator
plan: 03
subsystem: worker
tags: bullmq, worker, redis-progress, retry, graceful-shutdown, tdd

# Dependency graph
requires:
  - phase: 10-async-batch-orchestrator/01
    provides: BullMQ Queue, Redis progress tracking, shared constants
  - phase: 10-async-batch-orchestrator/02
    provides: Batch upload endpoint, Zod batch schemas
provides:
  - BullMQ Worker that processes video-processing jobs via runPipeline()
  - Per-step progress tracking via onStepStart callback into Redis hashes
  - Directory cleanup on retry (removes step output dirs, keeps input)
  - Graceful shutdown (SIGTERM/SIGINT) with worker stop and Redis connection close
affects: [10-async-batch-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns: [BullMQ Worker consuming video-processing queue, onStepStart callback for per-step progress, directory cleanup before retry preserving input]

key-files:
  created: [services/api-server/src/worker.ts, services/api-server/src/__tests__/worker.test.ts]
  modified: [services/api-server/src/orchestrator.ts, services/api-server/src/index.ts]

key-decisions:
  - "Worker runs in same Node.js process as Express server per D-12 discretion"
  - "onStepStart callback added to RunPipelineOptions for progress tracking — backward-compatible (optional)"
  - "Directory cleanup on retry removes step output dirs but preserves input/video.mp4 per D-06"
  - "MAX_CONCURRENT_JOBS defaults to 2 per D-08, configurable via env var"

patterns-established:
  - "BullMQ Worker with processJob function as job processor"
  - "onStepStart callback bridges orchestrator loop to Redis progress updates"
  - "Graceful shutdown sequence: stopWorker() → closeQueueConnection() → server.close()"

requirements-completed: [APIA-02, APIA-03]

# Metrics
duration: 5min
completed: 2026-05-13
---

# Phase 10 Plan 03: BullMQ Worker + Progress Tracking Summary

**BullMQ worker wrapping runPipeline() as job processor with per-step progress tracking, retry cleanup, and Express server integration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-13T01:42:35Z
- **Completed:** 2026-05-13T01:48:32Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- BullMQ Worker created with processJob() that wraps runPipeline() as job processor
- Per-step progress tracking via onStepStart callback in RunPipelineOptions — updates Redis hash with currentStep and status before each pipeline step
- Failed job error handling: PipelineStepError extracts step name and exit code, generic errors captured
- Directory cleanup on retry removes step output dirs but preserves input/video.mp4
- Worker starts alongside Express server in same Node.js process (per D-12)
- Graceful shutdown on SIGTERM/SIGINT stops worker and closes Redis connection
- 10 TDD tests for worker: module exports, job processing, progress callbacks, success/failure handling, directory cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BullMQ worker with runPipeline() + per-step progress tracking** - `720c812` (test) + `ffa7e74` (feat)
2. **Task 2: Integrate worker into Express server + graceful shutdown** - `f5b22b4` (feat)

## Files Created/Modified
- `services/api-server/src/worker.ts` - BullMQ Worker with processJob(), startWorker(), stopWorker(); per-step progress via onStepStart; directory cleanup on retry
- `services/api-server/src/__tests__/worker.test.ts` - 10 tests covering module exports, job processing, progress tracking, success/failure, and directory cleanup
- `services/api-server/src/orchestrator.ts` - Added optional onStepStart callback to RunPipelineOptions; invokes callback before each pipeline step
- `services/api-server/src/index.ts` - Import startWorker/stopWorker/closeQueueConnection; start worker on server startup; graceful shutdown on SIGTERM/SIGINT

## Decisions Made
- Worker runs in same process as Express server per D-12 — simpler deployment, one container handles both HTTP and job processing
- onStepStart callback is optional and backward-compatible — runPipeline() still works without it for synchronous API usage
- Directory cleanup preserves input/video.mp4 but removes all step output directories — ensures each pipeline step starts fresh on retry
- MAX_CONCURRENT_JOBS defaults to 2 per D-08 — balances throughput with GPU/CPU resource constraints

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BullMQ worker ready to consume jobs from video-processing queue
- Per-step progress tracking ready for Phase 11 (PROG-01, PROG-02)
- Retry handling configured with attempts: 2 and exponential backoff
- Graceful shutdown ensures clean worker and Redis connection teardown

## Self-Check: PASSED

- [x] services/api-server/src/worker.ts EXISTS
- [x] services/api-server/src/__tests__/worker.test.ts EXISTS
- [x] services/api-server/src/orchestrator.ts EXISTS
- [x] services/api-server/src/index.ts EXISTS
- [x] Commit 720c812 (test) EXISTS
- [x] Commit ffa7e74 (feat) EXISTS
- [x] Commit f5b22b4 (feat) EXISTS
- [x] All 10 worker tests PASS
- [x] All 47 api-server tests PASS
- [x] Worker consumes from video-processing queue (new Worker(QUEUE_NAME, processJob, ...))
- [x] Per-step progress tracked via onStepStart callback → updateJobProgress()
- [x] Failed jobs get error details in Redis (PipelineStepError and generic error handling)
- [x] No TypeScript errors introduced by plan changes

---
*Phase: 10-async-batch-orchestrator*
*Completed: 2026-05-13*