---
phase: 05-remotion-animated-subtitles
plan: 04
subsystem: pipeline
tags: [double-remap, timestamp-detection, subtitles, remotion, captions, gap-closure]

# Dependency graph
requires:
  - phase: 05-remotion-animated-subtitles
    provides: 05-01 (Docker Compose wiring, env vars, angle-egl)
  - phase: 05-remotion-animated-subtitles
    provides: 05-02 (remapTimestamps, safe zone, integration)
  - phase: 05-remotion-animated-subtitles
    provides: 05-03 (validation module, E2E test)
provides:
  - areTimestampsAlreadyRemapped detection function with 2.0s tolerance heuristic
  - Auto-skip remap logic in transcriptToCaptionPages for cut-timeline timestamps
  - Unit tests covering 5 detection scenarios + 2 integration scenarios
  - Timestamp timeline logging and remotion-info.json metadata in render.ts
affects: [06-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [detection-heuristic-for-timeline-origin, auto-skip-remap-when-already-remapped]

key-files:
  created: []
  modified:
    - services/remotion-renderer/src/captions.ts
    - services/remotion-renderer/src/captions.test.ts
    - services/remotion-renderer/src/render.ts

key-decisions:
  - "Use max word.end <= new_duration + 2.0s tolerance heuristic for detection — handles Whisper timing variance"
  - "Skip remap by passing null to remapWordTimestamps instead of mutating the function — minimal change, backward compatible"
  - "DETECTION_TOLERANCE_SEC exported as constant for testability and future tuning"

patterns-established:
  - "Timestamp timeline detection: check max word timestamp against new_duration + tolerance to determine origin timeline"
  - "Auto-skip pattern: detection function returns boolean → override silenceCuts parameter to null → existing fallback path"

requirements-completed: [SUBT-02, SUBT-03]

# Metrics
duration: 4min
completed: 2026-05-08
---

# Phase 5 Plan 04: Double-Remap Bug Fix Summary

**areTimestampsAlreadyRemapped detection with 2.0s tolerance heuristic, auto-skip remap in transcriptToCaptionPages, and timeline logging in render.ts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-08T13:08:21Z
- **Completed:** 2026-05-08T13:12:42Z
- **Tasks:** 2 (1 TDD, 1 auto)
- **Files modified:** 3

## Accomplishments

- Fixed double-remap bug: transcriptToCaptionPages now detects when Whisper ran on the already-cut video and skips timestamp remapping, preventing progressive drift and fromMs > toMs token corruption
- Added areTimestampsAlreadyRemapped() with 5 scenario coverage (true, false, null cuts, empty cuts, empty words) plus 2 integration tests (skip-remap, still-remap)
- render.ts logs timestamp timeline detection result and includes timestamps_already_remapped in remotion-info.json

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing tests for areTimestampsAlreadyRemapped detection** - `5798fd7` (test)
2. **Task 1 (TDD GREEN): Implement areTimestampsAlreadyRemapped and auto-skip remap** - `2eb6bd8` (feat)
3. **Task 2: Add detection logging and metadata in render.ts** - `7bc4db2` (feat)

**Plan metadata:** pending

## Files Created/Modified

- `services/remotion-renderer/src/captions.ts` - Added areTimestampsAlreadyRemapped() detection function, DETECTION_TOLERANCE_SEC constant, and auto-skip remap logic in transcriptToCaptionPages
- `services/remotion-renderer/src/captions.test.ts` - Added 7 new tests: 5 for areTimestampsAlreadyRemapped, 2 for transcriptToCaptionPages skip/remap behavior. Updated existing test data for detection compatibility.
- `services/remotion-renderer/src/render.ts` - Added areTimestampsAlreadyRemapped import, timeline detection logging, and timestamps_already_remapped field in remotion-info.json

## Decisions Made

- Used max word.end <= new_duration + 2.0s tolerance heuristic — handles Whisper timing variance while reliably detecting timeline origin
- Skipped remap via passing null to remapWordTimestamps instead of adding a skip parameter — leverages existing graceful fallback path, minimal code change
- Exported DETECTION_TOLERANCE_SEC constant for testability and future pipeline tuning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed existing test data incompatible with detection logic**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Existing "produces remapped TikTokPages" test had word timestamps (5.0-5.5s) that fell within new_duration(18)+tolerance(2)=20s, causing detection to classify them as already-remapped
- **Fix:** Adjusted test silenceCuts data: reduced new_duration from 18→2s and added a second cut so words clearly exceed detection threshold, ensuring remap is applied as the test expects
- **Files modified:** services/remotion-renderer/src/captions.test.ts
- **Verification:** All 17 tests pass including the existing remap test
- **Committed in:** 2eb6bd8 (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Fixed boundary condition in areTimestampsAlreadyRemapped false-test**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Test used max word end = 9.0 which equals new_duration(7)+tolerance(2)=9.0, not strictly greater — detection correctly returned true, not false
- **Fix:** Changed test word end from 9.0 to 9.5 so it clearly exceeds the threshold
- **Files modified:** services/remotion-renderer/src/captions.test.ts
- **Verification:** Detection returns false for 9.5 > 9.0
- **Committed in:** 2eb6bd8 (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes corrected test data to work correctly with the new detection logic. No scope creep.

## TDD Gate Compliance

| Gate | Status | Commit |
|------|--------|--------|
| RED (failing test) | ✓ | 5798fd7 |
| GREEN (implementation) | ✓ | 2eb6bd8 |
| REFACTOR | Not needed — code clean | — |

## Issues Encountered

None — TDD cycle completed cleanly, all 17 tests passing on GREEN phase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Double-remap bug fixed: transcriptToCaptionPages detects already-remapped timestamps and skips remap
- Full test coverage: 5 detection scenarios + 2 integration tests + 10 existing tests (backward compatible)
- render.ts logs detection result and includes metadata in remotion-info.json
- All 39 tests pass across captions.test.ts and validate.test.ts
- Ready for Phase 06 integration — pipeline can now handle both scenarios (Whisper on original vs cut video)

---
*Phase: 05-remotion-animated-subtitles*
*Completed: 2026-05-08*

## Self-Check: PASSED

- services/remotion-renderer/src/captions.ts: FOUND
- services/remotion-renderer/src/captions.test.ts: FOUND
- services/remotion-renderer/src/render.ts: FOUND
- Commit 5798fd7 (TDD RED): FOUND
- Commit 2eb6bd8 (TDD GREEN): FOUND
- Commit 7bc4db2 (Task 2): FOUND
- 39 tests passing (17 captions + 22 validate): VERIFIED
- areTimestampsAlreadyRemapped exported and contains expected pattern: VERIFIED
- render.ts contains timestamps_already_remapped metadata field: VERIFIED