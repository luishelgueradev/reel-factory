---
phase: 01-pipeline-infrastructure
plan: 06
subsystem: infra
tags: [ffmpeg, docker, version-pinning, gap-closure, multi-stage-build]

# Dependency graph
requires:
  - phase: 01-pipeline-infrastructure
    provides: docker base images with FFmpeg, docker-compose.yml
provides:
  - FFmpeg 7.1.1 compiled from source in both base Dockerfiles
  - Smoke test version pin check for PIPE-05
  - .env.example documenting pinned version approach
affects: [01-pipeline-infrastructure, all-downstream-containers]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-stage-ffmpeg-build, version-pinned-source-compilation]

key-files:
  created: []
  modified:
    - services/base-python/Dockerfile
    - services/base-node/Dockerfile
    - .env.example
    - scripts/smoke-test.sh

key-decisions:
  - "Compile FFmpeg 7.1.1 from official source tarball (ffmpeg.org) instead of prebuilt nightly builds"
  - "Multi-stage Docker build pattern: builder stage compiles, final stage copies binary + runtime libs"
  - "libx264-164 is the current Debian package for x264 runtime library (both trixie and bookworm)"

patterns-established:
  - "Multi-stage build for version-pinned binary: ARG for version, builder compiles, final copies"
  - "Source-compilation pinning pattern: curl source tarball → configure → make → copy to slim runtime"

requirements-completed: [PIPE-05]

# Metrics
duration: 5min
completed: 2026-05-14
---

# Phase 1 Plan 6: Gap Closure Summary

**Pinned FFmpeg to 7.1.1 by compiling from source in multi-stage Docker builds, updated smoke test to verify version pin**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-14T02:45:00Z
- **Completed:** 2026-05-14T03:30:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Rewrote base-python Dockerfile to compile FFmpeg 7.1.1 from source in a multi-stage build (UAT gap test 5)
- Rewrote base-node Dockerfile to compile FFmpeg 7.1.1 from source with Chrome/Remotion runtime deps preserved (UAT gap test 5)
- Updated .env.example to document FFMPEG_VERSION=7.1.1 pinned version approach
- Updated smoke-test.sh check_pipe_05() to verify version is pinned to 7.1.1 (not just consistent)

## Task Commits

1. **Task 1: Rewrite base-python Dockerfile** - `3ac18fb` (fix)
2. **Task 2: Rewrite base-node Dockerfile** - `9d5fa1b` (fix)
3. **Task 3: Update .env.example and smoke-test.sh** - `441b884` (fix)

## Files Created/Modified
- `services/base-python/Dockerfile` - Multi-stage build: FFmpeg 7.1.1 compiled from source with libx264
- `services/base-node/Dockerfile` - Multi-stage build: FFmpeg 7.1.1 compiled from source with Chrome deps + libx264
- `.env.example` - Replaced FFMPEG_SOURCE=BtbN-latest with FFMPEG_VERSION=7.1.1
- `scripts/smoke-test.sh` - Added EXPECTED_VERSION="7.1.1" pin check in check_pipe_05()

## Decisions Made
- Compile FFmpeg from official source tarball (ffmpeg.org) — only reliable way to get exactly 7.1.1 since BtbN has no version-tagged releases and johnvansickle.com returns HTTP 415
- Multi-stage Docker build keeps runtime images slim (no build deps leak)
- Both Dockerfiles use identical configure flags (--enable-gpl, --enable-libx264, --enable-avfilter) for consistency
- libx264-164 is the current Debian package name (both bookworm and trixie)

## Deviations from Plan
- Had to change libx264-163 → libx264-164 because Debian updated the package name. Plan specified 163 but current Debian repos only have 164.

## Issues Encountered
- Initial build failed: python:3.12-slim is now based on Debian trixie (not bookworm), libx264-163 not found → fixed to libx264-164
- Initial build failed: node:22-bookworm-slim also updated, libx264-163 not found → fixed to libx264-164

## User Setup Required
None - rebuild Docker images with `docker compose build base-python base-node` to apply.

## Next Phase Readiness
- PIPE-05 (FFmpeg version consistency) now fully satisfied: both containers report 7.1.1
- Smoke test passes all 12 checks (5 PIPE requirements)
- Phase 01 pipeline infrastructure is complete and fully validated

---
*Phase: 01-pipeline-infrastructure*
*Completed: 2026-05-14*

## Self-Check: PASSED
- services/base-python/Dockerfile: FOUND
- services/base-node/Dockerfile: FOUND
- .env.example: FOUND
- scripts/smoke-test.sh: FOUND
- Both containers: `ffmpeg -version` reports 7.1.1 with libx264 encoder support
- Smoke test: 12 passed, 0 failed