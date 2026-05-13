---
phase: 11-progress-tracking
plan: 01
subsystem: api
tags: [redis, progress, status, zod, bullmq]

requires:
  - phase: 10-async-batch-orchestrator
    provides: Redis progress hashes, BullMQ worker with onStepStart callback, updateJobProgress/getJobProgress functions
provides:
  - getJobStatus function returning typed JobStatus with progress %, stepInfo, completed steps
  - StatusResponseSchema for GET /status/{jobId} validation
  - completedSteps tracking in worker onStepStart callback
  - startedAt timestamp set on first job activation via hsetnx
affects: [progress-api, status-endpoint, worker]

tech-stack:
  added: []
  patterns: [step-index-progress-computation, comma-joined-redis-fields, hsetnx-for-idempotent-timestamps]

key-files:
  created:
    - services/api-server/src/__tests__/progress.test.ts
    - services/api-server/src/schemas/status.ts
  modified:
    - services/api-server/src/progress.ts
    - services/api-server/src/worker.ts
    - services/api-server/src/__tests__/worker.test.ts

key-decisions:
  - "Completed steps stored as comma-joined string in Redis hash field 'steps' per D-02"
  - "startedAt set via hsetnx for idempotent first-activation timestamp per D-07"
  - "Progress computed as Math.round(((completedSteps.length + 1) / totalSteps) * 100) for active/failed per D-05"
  - "stepInfo format '{n}/{totalSteps}' per D-06"

requirements-completed: [PROG-01, PROG-02]

duration: 19min
completed: 2026-05-13
---

# Phase 11 Plan 01: Progress Data Layer Summary

**Extended progress.ts with completed steps tracking, progress computation, and JobStatus type; created Zod status schema; updated worker to push completed step names**

## Performance

- **Duration:** 19 min
- **Started:** 2026-05-13T13:05:11Z
- **Completed:** 2026-05-13T13:25:02Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `getJobStatus(jobId)` returning typed `JobStatus | null` with progress percentage, stepInfo fraction, completed steps array, and startedAt timestamp
- Extended `updateJobProgress` to accept `completedSteps: string[]` — stored as comma-joined string in Redis hash `steps` field
- Implemented `startedAt` via `hsetnx` for idempotent first-activation timestamp
- Created `StatusResponseSchema` Zod schema matching D-01 response shape
- Updated worker `onStepStart` callback to compute `completedSteps` from `STEPS.slice(0, stepIndex)` and pass to `updateJobProgress`
- Progress calculation: queued=0%, active=`Math.round(((completedSteps.length + 1) / 5) * 100)`, completed=100%
- stepInfo format: `"{n}/{totalSteps}"` (e.g., "3/5", "0/5", "5/5")

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing tests for progress tracking** - `06ddd22` (test)
2. **Task 1 (TDD GREEN): Implement completed steps tracking and job status** - `a9ea54d` (feat)
3. **Task 2: Status Zod schema and worker completedSteps** - `99a4eee` (feat)

## Files Created/Modified
- `services/api-server/src/__tests__/progress.test.ts` - 23 test cases for getJobStatus, updateJobProgress with completedSteps, and getJobProgress backward compatibility
- `services/api-server/src/progress.ts` - Extended with `completedSteps` support, `getJobStatus()`, `JobStatus` interface, `startedAt` via hsetnx
- `services/api-server/src/schemas/status.ts` - New Zod schema for GET /status/{jobId} response validation
- `services/api-server/src/worker.ts` - Updated onStepStart to compute and pass `completedSteps` array
- `services/api-server/src/__tests__/worker.test.ts` - Updated assertions to include `completedSteps` parameter

## Decisions Made
- Used `hsetnx` for `startedAt` to ensure it's only set once per job (idempotent across retries) — per D-07
- Comma-joined string for completed steps in Redis (per D-02) — simple format since step names don't contain commas
- Progress calculation uses `completedSteps.length + 1` (not `stepIndex`) because `completedSteps` represents steps that finished before the current one, and `+1` accounts for the currently running step (per D-05)
- Used `vi.hoisted()` for Redis mock sharing between test factory and test assertions to avoid TDZ issues with ESM module mocking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tests pass (70/70 including existing test suites).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for plan 02 (GET /status/{jobId} endpoint) — all data layer functions are in place
- `getJobStatus()` can be directly used by the status route handler
- `StatusResponseSchema` ready for response validation

## Self-Check: PASSED

- All 5 created/modified files found on disk
- All 3 commit hashes verified in git log (06ddd22, a9ea54d, 99a4eee)
- All verification commands pass: progress.test.ts (23/23), worker.test.ts (10/10)
- getJobStatus found in progress.ts (2 occurrences)
- StatusResponseSchema found in status.ts (2 occurrences)

---
*Phase: 11-progress-tracking*
*Completed: 2026-05-13*