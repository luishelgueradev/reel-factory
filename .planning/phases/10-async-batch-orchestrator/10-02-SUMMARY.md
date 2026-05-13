---
phase: 10-async-batch-orchestrator
plan: 02
subsystem: api
tags: express, multer, bullmq, redis, batch-upload, zod, vitest, supertest

# Dependency graph
requires:
  - phase: 10-async-batch-orchestrator/01
    provides: BullMQ Queue, Redis progress tracking, Zod batch schemas, shared constants
provides:
  - POST /batch endpoint for multi-video upload with batchId grouping
  - GET /batch/:batchId endpoint for batch status retrieval
  - Batch error handling (LIMIT_FILE_COUNT, LIMIT_UNEXPECTED_FILE, non-MP4, no files)
  - TDD test suite for batch upload and status routes
affects: [10-async-batch-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns: [Multer array upload for batch processing, BullMQ job creation per uploaded file, Redis batch→job mapping with TTL, Express global error handler extended for batch limits]

key-files:
  created: [services/api-server/src/routes/batch.ts, services/api-server/src/__tests__/batch.test.ts]
  modified: [services/api-server/src/index.ts]

key-decisions:
  - "MAX_BATCH_SIZE defaults to 10, configurable via env var per D-10"
  - "Multer LIMIT_FILE_COUNT error handles batch size overflow (not LIMIT_UNEXPECTED_FILE)"
  - "BullMQ job data includes jobId, batchId, filename, inputPath for pipeline processor"
  - "GET /batch/:batchId merges Redis progress data with BullMQ job state, BullMQ state takes precedence for status"
  - "Task 2 changes (batchRouter mount, LIMIT_FILE_COUNT handling) were included in Task 1 GREEN commit since tests required them"

patterns-established:
  - "Batch upload follows same Multer pattern as single upload (diskStorage, fileFilter, limits)"
  - "Batch→job mapping via Redis list with 25h TTL"
  - "Initial job progress set to { status: queued, currentStep: queued } on batch upload"

requirements-completed: [APIA-01]

# Metrics
duration: 6min
completed: 2026-05-13
---

# Phase 10 Plan 02: Batch Upload & Status Endpoints Summary

**POST /batch multi-video upload endpoint with BullMQ job creation and GET /batch/:batchId status retrieval, via TDD**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-13T01:33:36Z
- **Completed:** 2026-05-13T01:39:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- POST /batch endpoint accepts multiple MP4 files, creates BullMQ jobs for each, returns batchId + job statuses
- GET /batch/:batchId endpoint returns all job statuses for a batch with merged Redis/BullMQ state
- Batch error handling: 400 (no files), 413 (too many files), 415 (non-MP4)
- LIMIT_FILE_COUNT and LIMIT_UNEXPECTED_FILE errors handled in global error handler
- Comprehensive TDD test suite (9 tests) covering all batch upload and status scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Create POST /batch and GET /batch/{batchId} routes with Multer array upload** - `67e3c60` (test) + `ef6d8b0` (feat)
2. **Task 2: Mount batch routes in Express app + integrate batch error handling** - Included in `ef6d8b0` (feat) — changes required for tests to pass

**Plan metadata:** TBD (docs commit to follow)

## Files Created/Modified
- `services/api-server/src/routes/batch.ts` - POST /batch and GET /batch/:batchId route handlers with Multer array upload, BullMQ job creation, Redis batch mapping
- `services/api-server/src/__tests__/batch.test.ts` - 9 tests for batch upload (no files, too many files, non-MP4, valid upload, BullMQ job creation, Redis mapping, progress tracking) and batch status (404, status retrieval with per-job details)
- `services/api-server/src/index.ts` - Added batchRouter import/mount, LIMIT_FILE_COUNT/LIMIT_UNEXPECTED_FILE error handling

## Decisions Made
- MAX_BATCH_SIZE defaults to 10, configurable via `MAX_BATCH_SIZE` env var (D-10)
- Multer's `LIMIT_FILE_COUNT` error code handles batch size overflow (not `LIMIT_UNEXPECTED_FILE`) — both handled in error handler for robustness
- BullMQ job data includes `{ jobId, batchId, filename, inputPath }` for the pipeline processor to use
- GET /batch/:batchId merges Redis progress data (currentStep, error) with BullMQ job state — BullMQ status takes precedence for completed/failed detection
- Task 2 (mount batchRouter, error handler changes) was included in the Task 1 GREEN commit since tests needed batchRouter mounted to pass

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Batch upload and status endpoints ready for BullMQ worker consumption (Plan 03)
- All 37 api-server tests pass including 9 new batch tests
- batchRouter mounted alongside processRouter and artifactsRouter

---
*Phase: 10-async-batch-orchestrator*
*Completed: 2026-05-13*

## Self-Check: PASSED

- [x] services/api-server/src/routes/batch.ts EXISTS
- [x] services/api-server/src/__tests__/batch.test.ts EXISTS
- [x] services/api-server/src/index.ts EXISTS
- [x] Commit 67e3c60 (test) EXISTS
- [x] Commit ef6d8b0 (feat) EXISTS
- [x] All 9 batch tests PASS
- [x] All 37 api-server tests PASS
- [x] POST /batch endpoint validates file count and mimetype (413, 415, 400)
- [x] GET /batch/:batchId returns correct status structure
- [x] BullMQ jobs created for each uploaded file
- [x] MAX_BATCH_SIZE enforced