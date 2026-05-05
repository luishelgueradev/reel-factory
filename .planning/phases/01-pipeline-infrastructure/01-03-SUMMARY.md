---
phase: 01-pipeline-infrastructure
plan: 03
subsystem: infra
tags: [docker, dockerfile, ffmpeg, python, node, remotion]

requires:
  - phase: 01-pipeline-infrastructure
    provides: docker-compose.yml with volume definition and x-pipeline-common extension
  - phase: 01-pipeline-infrastructure
    provides: shared/constants.ts with PIPELINE_DATA_DIR and STEP_NAMES

provides:
  - Python 3.12 base image with pinned FFmpeg 7.1.1
  - Node 22 bookworm-slim base image with pinned FFmpeg 7.1.1 and Chrome dependencies
  - Pipeline service chain template with depends_on and healthcheck pattern

affects: [02-whisper-transcription, 05-remotion-subtitles, 10-async-batch]

tech-stack:
  added: [python:3.12-slim, node:22-bookworm-slim, ffmpeg-7.1.1-static]
  patterns: [base-image-inheritance, depends-on-healthcheck-chain, ffmpeg-version-pinning]

key-files:
  created:
    - services/base-python/Dockerfile
    - services/base-node/Dockerfile
  modified:
    - docker-compose.yml

key-decisions:
  - "FFmpeg pinned to 7.1.1 across both base images via build ARG (PIPE-05)"
  - "Node image uses bookworm-slim NOT Alpine per Remotion docs and PITFALLS.md Pitfall 7"
  - "Chrome Headless Shell dependencies installed in Node base for Remotion (PITFALLS Pitfall 3)"

patterns-established:
  - "Base image pattern: step containers FROM video-pipeline-base-{python|node}"
  - "FFmpeg version pinning via FFMPEG_VERSION build arg from .env.example"
  - "depends_on + healthcheck chain pattern for step sequencing"

requirements-completed: [PIPE-04, PIPE-05]

duration: 3min
completed: 2026-05-05
---

# Phase 1 Plan 03: Base Docker Images Summary

**Python 3.12 and Node 22 base images with pinned FFmpeg 7.1.1 static builds and pipeline service chain template with depends_on healthchecks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-05T21:19:00Z
- **Completed:** 2026-05-05T21:22:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Python base image from python:3.12-slim with FFmpeg 7.1.1 static build
- Node base image from node:22-bookworm-slim with FFmpeg 7.1.1 and Chrome dependencies for Remotion
- Pipeline service chain template in docker-compose.yml with commented-out step pattern showing depends_on + healthcheck

## Task Commits

1. **Task 1: Create base Docker images with pinned FFmpeg** - `ee6390f` (feat)
2. **Task 2: Add pipeline service chain to docker-compose.yml** - `ee6390f` (feat)

## Files Created/Modified
- `services/base-python/Dockerfile` - Python 3.12 base with FFmpeg 7.1.1 static build
- `services/base-node/Dockerfile` - Node 22 bookworm-slim with FFmpeg 7.1.1 and Chrome deps
- `docker-compose.yml` - Added base-python/base-node services and step chain template

## Decisions Made
- None - followed plan as specified

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `docker compose config` validation skipped — Docker not installed in this execution environment. Validation deferred to smoke test (Plan 01-04).

## User Setup Required
None

## Next Phase Readiness
- Base images ready for smoke test container (Plan 01-04)
- Step chain template demonstrates PIPE-04 extensibility pattern
- FFmpeg version pinning ensures cross-container consistency (PIPE-05)

---
*Phase: 01-pipeline-infrastructure*
*Completed: 2026-05-05*