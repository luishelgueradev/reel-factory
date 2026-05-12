---
phase: 09-synchronous-api
plan: 01
subsystem: api
tags: [express, multer, zod, uuid, vitest, supertest, multipart-upload, artifact-serving]

# Dependency graph
requires:
  - phase: 08-srt-vtt-subtitle-export
    provides: Pipeline step contracts, manifest format, shared constants
provides:
  - Express.js 5 API server with POST /process upload endpoint
  - GET /artifacts/:jobId/:stepName/:filename artifact serving
  - GET /artifacts/:jobId listing endpoint
  - Zod request/response validation schemas
  - Path traversal protection on artifact routes
  - Vitest test suite for upload and artifact routes
affects: [09-synchronous-api-plan-02, 09-synchronous-api-plan-03]

# Tech tracking
tech-stack:
  added: [express@5.2.1, multer@2.1.1, zod@4.4.3, uuid@14.0.0, vitest@4.1.6, supertest@7, tsx@4.19]
  patterns: [ESM modules, TDD with vitest, Multer disk storage for large file uploads, path.normalize for traversal protection, Express 5 error handler signature]

key-files:
  created:
    - services/api-server/package.json
    - services/api-server/tsconfig.json
    - services/api-server/vitest.config.ts
    - services/api-server/src/index.ts
    - services/api-server/src/constants.ts
    - services/api-server/src/routes/upload.ts
    - services/api-server/src/routes/artifacts.ts
    - services/api-server/src/schemas/request.ts
    - services/api-server/src/schemas/response.ts
    - services/api-server/src/__tests__/setup.ts
    - services/api-server/src/__tests__/upload.test.ts
    - services/api-server/src/__tests__/artifacts.test.ts
  modified: []

key-decisions:
  - "Multer 2.x with disk storage to /data/pipeline/tmp then move to job directory (avoids OOM on large MP4 files)"
  - "Supertest with raw request parser for binary file serving tests (avoids JSON auto-parse on .json artifacts)"
  - "Custom Multer fileSize limit test with 1KB override to verify 413 error path without huge uploads"
  - "Express 5 four-argument error handler for MulterError with LIMIT_FILE_SIZE code"
  - "Shared PIPELINE_DATA_DIR constant from env var, defaulting to /data/pipeline (overridable for testing)"

patterns-established:
  - "Multer disk storage pattern: upload to tmp/ → mkdir job dir → rename to job/input/video.mp4"
  - "Path traversal protection: path.normalize + startsWith check against PIPELINE_DATA_DIR"
  - "Zod schema co-location: request.ts and response.ts beside routes"
  - "Test isolation: PIPELINE_DATA_DIR env override with temp directories, per-test cleanup"

requirements-completed: [APIS-01, APIS-02]

# Metrics
duration: 10min
completed: 2026-05-12
---

# Phase 9 Plan 1: Synchronous API Scaffolding Summary

**Express.js 5 API server with Multer MP4 upload, Zod validation, artifact serving, and 13 passing vitest tests**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-12T23:09:12Z
- **Completed:** 2026-05-12T23:19:52Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Created Express.js 5 API server with POST /process multipart upload using Multer disk storage
- Implemented file validation (video/mp4 mimetype, 500MB size limit) with proper HTTP error codes (400, 415, 413)
- Built GET /artifacts/:jobId listing endpoint and GET /artifacts/:jobId/:stepName/:filename file serving
- Added path traversal protection on artifact routes using path.normalize + directory prefix validation
- Established Zod schemas for ProcessResponse and ArtifactResponse with UUID validation
- Created vitest test suite: 7 upload tests + 6 artifact tests (13 total, all passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create API server scaffolding, Zod schemas, and upload validation** - `8bcee15` (test) then `20f774f` (feat)
   - TDD: RED commit with 7 failing tests, GREEN commit with full implementation
2. **Task 2: Create artifact serving route and integrate routes into Express app** - `10e5ef8` (feat)
   - Added artifact serving tests and route implementation

**Plan metadata:** pending (docs commit at end)

_Note: TDD discipline followed — RED (test commit) → GREEN (implementation commit) → no refactor needed_

## Files Created/Modified

- `services/api-server/package.json` - Express 5.2.1, Multer 2.x, Zod 4.4, UUID 14, Vitest 4.1, Supertest 7
- `services/api-server/tsconfig.json` - ESM module with bundler resolution
- `services/api-server/vitest.config.ts` - Vitest config with Node environment and setup files
- `services/api-server/src/index.ts` - Express app setup with JSON parser, Multer error handling, CORS, route mounting
- `services/api-server/src/constants.ts` - PIPELINE_DATA_DIR env override (testable)
- `services/api-server/src/routes/upload.ts` - POST /process with Multer disk storage, UUID job creation, file move
- `services/api-server/src/routes/artifacts.ts` - GET /artifacts/:jobId listing + file serving with path traversal protection
- `services/api-server/src/schemas/request.ts` - UploadRequestSchema, isValidVideoMimetype helper
- `services/api-server/src/schemas/response.ts` - ProcessResponseSchema (UUID, status, message), ArtifactResponseSchema
- `services/api-server/src/__tests__/setup.ts` - Test temp directory setup/teardown
- `services/api-server/src/__tests__/upload.test.ts` - 7 tests: 400 no file, 415 wrong type, 413 too large, 202 valid upload + 3 schema tests
- `services/api-server/src/__tests__/artifacts.test.ts` - 6 tests: 404 nonexistent job, artifact listing, 200 file serve, 404 missing file, 403 path traversal x2

## Decisions Made

- **Multer 2.x disk storage**: Uploads go to /data/pipeline/tmp first, then moved to /data/pipeline/{jobId}/input/video.mp4. Avoids OOM on large video uploads.
- **413 test strategy**: Used a test-specific Multer instance with 1KB file size limit to verify 413 responses without needing 500MB test files.
- **Supertest raw parser for binary files**: Created `rawRequest` helper that forces latin1 encoding to avoid JSON auto-parsing when serving .json artifact files.
- **PIPELINE_DATA_DIR as env var**: Makes the data directory configurable for testing (uses temp dirs in test environment).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Supertest JSON auto-parsing on `.json` files**: Express's `res.sendFile()` sets `Content-Type: application/json` for `.json` files, causing supertest to auto-parse the response body. Fixed by creating a `rawRequest` test helper that uses a custom response parser with latin1 encoding. This is a test infrastructure decision, not a code deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- POST /process upload endpoint ready for pipeline orchestration integration (Plan 02)
- GET /artifacts endpoint ready for serving processed video and intermediate files
- Zod schemas available for Plan 02/03 response validation
- Test infrastructure (vitest + supertest) in place for expanding test coverage

---
*Phase: 09-synchronous-api*
*Completed: 2026-05-12*

## Self-Check: PASSED

- All 12 created files verified on disk ✓
- 4 commits verified in git log (test, feat, feat, docs) ✓
- SUMMARY.md created and committed ✓
- 13 vitest tests passing ✓

## TDD Gate Compliance

- RED gate: `8bcee15` test(09-01): add failing test for upload endpoint and Zod schemas ✓
- GREEN gate: `20f774f` feat(09-01): implement Express API server with upload endpoint and Zod schemas ✓
- REFACTOR gate: No separate refactor commit needed — code was clean after GREEN