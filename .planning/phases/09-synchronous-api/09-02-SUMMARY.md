---
phase: 09-synchronous-api
plan: 02
subsystem: api
tags: [docker, orchestrator, express, dockerode, pipeline, upload]

# Dependency graph
requires:
  - phase: 09-synchronous-api
    provides: Upoad handler, artifact serving, Zod schemas, Express app scaffolding
provides:
  - Pipeline orchestrator running 5 Docker containers sequentially
  - POST /process handler with full orchestration (upload → pipeline → response)
  - PipelineStepError class for step failure detection
  - 408 timeout handling with configurable PROCESS_TIMEOUT_MS

affects: [09-synchronous-api, 10-async-batch, 11-progress]

# Tech tracking
tech-stack:
  added: [dockerode, @types/dockerode]
  patterns: [sibling-container-orchestration, manifest-based-pipeline-status]

key-files:
  created:
    - services/api-server/src/orchestrator.ts
    - services/api-server/src/orchestrator.test.ts
    - services/api-server/src/routes/process.ts
    - services/api-server/src/routes/process.test.ts
  modified:
    - services/api-server/src/index.ts
    - services/api-server/src/__tests__/upload.test.ts
    - services/api-server/package.json
    - services/api-server/package-lock.json
  removed:
    - services/api-server/src/routes/upload.ts

key-decisions:
  - "STEPS config uses {jobId} template placeholders resolved at runtime via resolveEnvVars()"
  - "process.ts replaces upload.ts entirely — single endpoint handles upload + orchestration"
  - "Used Dockerode for Docker API interaction instead of child_process.spawn for better error handling and container lifecycle management"
  - "PROCESS_TIMEOUT_MS defaults to 600000ms (10 minutes), configurable via env var"

patterns-established:
  - "Pipeline orchestrator pattern: sequential container execution with manifest-based status checking"
  - "Error classification: PipelineStepError for step failures, timeout detection for long-running pipelines"

requirements-completed: [APIS-01, APIS-02]

# Metrics
duration: 7min
completed: 2026-05-12
---

# Phase 9: Synchronous API Plan 02: Pipeline Orchestrator Summary

**Dockerode-based pipeline orchestrator running 5 sequential containers with manifest-based status detection and POST /process handler returning processed video + artifacts**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-12T23:24:15Z
- **Completed:** 2026-05-12T23:32:16Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 3 modified, 1 removed)

## Accomplishments

- Pipeline orchestrator sequentially runs whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → srt-exporter Docker containers
- Each step's manifest.json is read after completion to detect success/error status
- PipelineStepError throws with step name, exit code, and error message from manifest
- POST /process endpoint chains upload → orchestration → full response with video URL and artifact map
- 500 response on pipeline step failure, 408 on timeout (configurable via PROCESS_TIMEOUT_MS)

## Task Commits

Each task was committed atomically with TDD cycle:

1. **Task 1 (RED): Add failing tests for pipeline orchestrator** - `d3739ff` (test)
2. **Task 1 (GREEN): Implement pipeline orchestrator with Dockerode** - `e6f7b28` (feat)
3. **Task 2 (RED): Add failing tests for POST /process handler** - `db2de62` (test)
4. **Task 2 (GREEN): Implement POST /process handler with orchestration** - `4a20d8e` (feat)
5. **Refactor: Remove replaced upload route** - `cfad2f2` (refactor)

## Files Created/Modified

- `services/api-server/src/orchestrator.ts` - Pipeline orchestrator using Dockerode (5 steps, manifest reading, error handling)
- `services/api-server/src/orchestrator.test.ts` - 12 orchestrator tests (STEPS config, PipelineStepError, runPipeline scenarios)
- `services/api-server/src/routes/process.ts` - POST /process handler (upload + orchestration + timeout handling)
- `services/api-server/src/routes/process.test.ts` - 3 process handler tests (success, step error, timeout)
- `services/api-server/src/index.ts` - Updated to mount processRouter instead of uploadRouter
- `services/api-server/src/__tests__/upload.test.ts` - Updated to mock runPipeline, expect 200 response
- `services/api-server/package.json` - Added dockerode and @types/dockerode dependencies
- `services/api-server/src/routes/upload.ts` - Removed (replaced by process.ts)

## Decisions Made

- **STEPS config uses {jobId} template placeholders**: The STEPS constant contains path templates like `/data/pipeline/{jobId}/input/video.mp4` which are resolved at runtime with `resolveEnvVars()`. This makes the config self-documenting and easy to verify against docker-compose.yml.
- **process.ts replaces upload.ts entirely**: Rather than having separate upload and orchestration handlers, the POST /process endpoint now handles both file upload and pipeline execution in a single request, returning the final result synchronously.
- **Dockerode over child_process.spawn**: Dockerode provides better error handling, container lifecycle management, and streaming logs compared to spawning docker compose commands. The `createContainer` + `start` + `wait` pattern mirrors docker-compose behavior.
- **PROCESS_TIMEOUT_MS defaults to 10 minutes**: Configurable via environment variable, matching the D-07 decision for timeout handling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused upload.ts after process.ts replaced it**
- **Found during:** Task 2 implementation
- **Issue:** The new process.ts fully replaces the upload-only handler from Plan 01. The old upload.ts was no longer imported by index.ts or any other module.
- **Fix:** Removed services/api-server/src/routes/upload.ts and updated index.ts to import from process.ts instead.
- **Files modified:** services/api-server/src/routes/upload.ts (deleted), services/api-server/src/index.ts
- **Verification:** All 28 tests pass (4 test files, 0 failures)
- **Committed in:** cfad2f2 (part of refactor commit)

**2. [Rule 2 - Missing Critical] Updated upload.test.ts to mock runPipeline**
- **Found during:** Task 2 implementation
- **Issue:** The valid upload test expected HTTP 202 with upload status, but the new handler calls runPipeline() which tries to create real Docker containers. Without mocking, the test would fail.
- **Fix:** Added vi.mock for orchestrator module in upload.test.ts, updated expected status code from 202 to 200, and added PipelineResult mock for the success case.
- **Files modified:** services/api-server/src/__tests__/upload.test.ts
- **Verification:** All 28 tests pass
- **Committed in:** 4a20d8e (part of feat commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes were necessary for correctness. No scope creep.

## Issues Encountered

None — all tests pass, implementation matches the plan exactly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pipeline orchestrator and POST /process handler are complete and tested
- Ready for Plan 03 (error handling, health endpoint, or batch processing)
- The API server can now accept MP4 uploads and orchestrate the full pipeline
- Docker socket access required for production deployment (T-09-07 mitigation)

---
*Phase: 09-synchronous-api*
*Completed: 2026-05-12*

## Self-Check: PASSED

- orchestrator.ts: FOUND
- orchestrator.test.ts: FOUND
- process.ts: FOUND
- process.test.ts: FOUND
- upload.ts: CONFIRMED removed (replaced by process.ts)
- 6 commits verified: d3739ff, e6f7b28, db2de62, 4a20d8e, cfad2f2, b42dac1
- All 28 tests passing (4 test files)