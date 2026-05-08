---
phase: 05-remotion-animated-subtitles
plan: 05
subsystem: pipeline
tags: [gap-closure, pipeline-config, e2e-test, validation, timestamps, defensive-checks]

# Dependency graph
requires:
  - phase: 05-remotion-animated-subtitles
    provides: 05-04 (areTimestampsAlreadyRemapped detection, auto-skip remap)
provides:
  - Corrected process.sh pipeline config (no SILENCE_CUTS_PATH for remotion-renderer)
  - E2E test script running standalone with --no-deps
  - Defensive validation for impossible timestamps (fromMs > toMs)
  - Cut-timeline synthetic test data matching real pipeline behavior
affects: [06-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [pipeline-config-clarity, e2e-no-deps-pattern, defensive-timestamp-validation]

key-files:
  created: []
  modified:
    - process.sh
    - scripts/test-remotion-renderer.sh
    - services/remotion-renderer/src/validate.ts
    - services/remotion-renderer/src/validate.test.ts

key-decisions:
  - "SILENCE_CUTS_PATH intentionally not passed to remotion-renderer — Whisper runs on cut video so timestamps are already on silence-removed timeline"
  - "E2E test uses --no-deps to avoid ffmpeg-finalizer dependency chain failing with synthetic data"
  - "Synthetic transcript uses cut-timeline timestamps (0.5s start) matching real pipeline behavior instead of original timeline (3.5s start)"

patterns-established:
  - "Pipeline config documentation: explicit comments explaining env var omissions and their rationale"
  - "E2E test independence: --no-deps flag for running container tests without triggering dependency chain"

requirements-completed: [SUBT-02, SUBT-03]

# Metrics
duration: 9min
completed: 2026-05-08
---

# Phase 5 Plan 05: Gap Closure — Pipeline Config & Defensive Validation Summary

**Corrected process.sh pipeline config (no SILENCE_CUTS_PATH), fixed E2E test with --no-deps and cut-timeline data, added fromMs > toMs defensive validation**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-08T13:17:32Z
- **Completed:** 2026-05-08T13:26:33Z
- **Tasks:** 2 (1 auto, 1 TDD)
- **Files modified:** 4

## Accomplishments

- Fixed process.sh to not pass SILENCE_CUTS_PATH to remotion-renderer (with explanatory comment), matching the real pipeline behavior where Whisper runs on the cut video
- Fixed E2E test script with --no-deps flag to avoid ffmpeg-finalizer dependency chain, and updated synthetic transcript to use cut-timeline timestamps
- Added defensive validation (SUBT-03) in validateCaptionPages to detect tokens with fromMs > toMs (impossible timestamps), preventing double-remap corruption silently
- All 42 unit tests pass (25 validate + 17 captions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix process.sh pipeline config + E2E test script** - `3f839d1` (fix)
2. **Task 2 (TDD RED): Failing tests for impossible timestamps** - `4e77df1` (test)
3. **Task 2 (TDD GREEN): Implement fromMs > toMs validation** - `0b7ef03` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `process.sh` - Added comment explaining why SILENCE_CUTS_PATH/FINALIZER_INFO_PATH are not passed to remotion-renderer
- `scripts/test-remotion-renderer.sh` - Added --no-deps flag, updated synthetic transcript to cut-timeline timestamps, removed silence-cuts.json creation, added impossible timestamp check
- `services/remotion-renderer/src/validate.ts` - Added fromMs > toMs validation in validateCaptionPages token loop
- `services/remotion-renderer/src/validate.test.ts` - Added 3 tests for impossible timestamps (fromMs > toMs)

## Decisions Made

- SILENCE_CUTS_PATH intentionally omitted from remotion-renderer step in process.sh — Whisper runs on cut video so timestamps are already on silence-removed timeline, detection logic handles this correctly
- E2E test uses --no-deps to isolate remotion-renderer from ffmpeg-finalizer dependency chain
- Synthetic transcript updated to use cut-timeline timestamps (0.5s, 0.9s, etc.) instead of original timeline (3.5s, 3.9s) to match real pipeline behavior where Whisper processes the already-cut video

## TDD Gate Compliance

| Gate | Status | Commit |
|------|--------|--------|
| RED (failing test) | ✓ | 4e77df1 |
| GREEN (implementation) | ✓ | 0b7ef03 |
| REFACTOR | Not needed — code clean | — |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TDD cycle completed cleanly, all 42 tests passing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Process.sh correctly configures remotion-renderer without SILENCE_CUTS_PATH
- E2E test runs standalone without ffmpeg-finalizer dependency
- Defensive validation catches impossible fromMs > toMs timestamps (double-remap corruption)
- All 42 unit tests pass across validate.test.ts and captions.test.ts
- Ready for Phase 06 (integration) — pipeline configuration is correct

---
*Phase: 05-remotion-animated-subtitles*
*Completed: 2026-05-08*

## Self-Check: PASSED

- process.sh: FOUND
- scripts/test-remotion-renderer.sh: FOUND
- services/remotion-renderer/src/validate.ts: FOUND
- services/remotion-renderer/src/validate.test.ts: FOUND
- Commit 3f839d1 (Task 1): FOUND
- Commit 4e77df1 (TDD RED): FOUND
- Commit 0b7ef03 (TDD GREEN): FOUND
- 42 tests passing: VERIFIED