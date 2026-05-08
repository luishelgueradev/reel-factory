---
phase: 05-remotion-animated-subtitles
plan: 02
subsystem: pipeline-infra
tags: [remotion, timestamp-remapping, safe-zone, captions, binary-search]

# Dependency graph
requires:
  - phase: 04-ffmpeg-finalizer
    provides: ffmpeg-finalizer service, finalizer-info.json with safe_zone
  - phase: 05-01
    provides: SILENCE_CUTS_PATH and FINALIZER_INFO_PATH env vars wired, bottomOffset prop in RemotionProps
provides:
  - remapTimestamps function with binary search for efficient timeline remapping
  - remapWordTimestamps for graceful null/empty handling
  - SilenceCutList and FinalizerInfo TypeScript interfaces
  - Integrated timestamp remapping in render pipeline via transcriptToCaptionPages
  - Dynamic safe_zone.bottom positioning in Subtitles composition via bottomOffset
affects: [05-remotion-animated-subtitles, 06-integration]

# Tech tracking
tech-stack:
  added: [vitest]
  patterns: [binary-search-timestamp-remap, safe-zone-derived-offset-with-validation, try-catch-json-parse-robustness]

key-files:
  created:
    - services/remotion-renderer/src/captions.test.ts
    - services/remotion-renderer/vitest.config.ts
  modified:
    - services/remotion-renderer/src/captions.ts
    - services/remotion-renderer/src/render.ts

key-decisions:
  - "remapTimestamps uses binary search O(log n) on silence cuts sorted by original_start for efficient timeline remapping"
  - "Null/empty silenceCuts gracefully falls back to original timestamps (D-03 backward compatibility)"
  - "T-05-04: JSON.parse wrapped in try/catch for both silence-cuts.json and finalizer-info.json"
  - "T-05-06: safe_zone.bottom validated as positive integer, falls back to 250px if invalid"

patterns-established:
  - "Binary search pattern for timestamp remapping — find last cut where original_start <= time, apply cumulative_shift"
  - "Robust JSON loading: try/catch with validation of required fields before type assertion"
  - "Safe zone offset validation: check typeof and > 0 before using, Math.round for integer safety"

requirements-completed: [SUBT-01, SUBT-02, SUBT-03]

# Metrics
duration: 8min
completed: 2026-05-08
---

# Phase 5 Plan 02: Timestamp Remapping & Safe Zone Positioning Summary

**Binary search timestamp remapping from silence-cuts.json and dynamic safe zone positioning from finalizer-info.json**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-08T01:59:46Z
- **Completed:** 2026-05-08T02:08:28Z
- **Tasks:** 2
- **Files modified:** 2 (+ 2 test/config files)

## Accomplishments
- remapTimestamps with O(log n) binary search efficiently maps original timestamps to silence-removed timeline using cumulative_shift
- remapWordTimestamps provides graceful fallback for null/empty silenceCuts (backward compatible)
- TypeScript interfaces SilenceCutList, SilenceCut, SafeZone, FinalizerInfo mirror Python schemas
- transcriptToCaptionPages now calls remapWordTimestamps BEFORE createTikTokStyleCaptions (D-04)
- render.ts loads silence-cuts.json and finalizer-info.json with try/catch for malformed JSON (T-05-04)
- render.ts validates safe_zone.bottom as positive integer (T-05-06, falls back to 250px)
- remotion-info.json now includes silence_cuts_applied, safe_zone_used, bottom_offset for debugging
- 10 comprehensive unit tests covering remap edge cases, null handling, backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing tests for remapTimestamps** - `1bb1368` (test)
2. **Task 1 (TDD GREEN): Implement remapTimestamps and TypeScript interfaces** - `97c8466` (feat)
3. **Task 2: Integrate remap + safe zone into render pipeline** - `b01d74a` (feat)

## Files Created/Modified
- `services/remotion-renderer/src/captions.ts` - Added SilenceCut/SilenceCutList/SafeZone/FinalizerInfo interfaces, remapTimestamps binary search, remapWordTimestamps null-safe remapper, updated transcriptToCaptionPages with silenceCuts option
- `services/remotion-renderer/src/captions.test.ts` - 10 unit tests for remapTimestamps, remapWordTimestamps, and transcriptToCaptionPages with/without silenceCuts
- `services/remotion-renderer/src/render.ts` - Added typed silence-cuts/finalizer-info loading with try/catch, safe_zone.bottom validation, import SilenceCutList/FinalizerInfo types, updated remotion-info.json
- `services/remotion-renderer/vitest.config.ts` - Vitest configuration for remotion-renderer tests
- `services/remotion-renderer/package.json` - Added test/test:watch scripts and vitest devDependency

## Decisions Made
- Binary search chosen for remapTimestamps over linear scan — O(log n) for typical <1000 cuts in a video, efficient for longer videos
- remapTimestamps accepts null SilenceCutList (returns original time unchanged) — this mirrors the D-03 graceful handling requirement
- transcriptToCaptionPages remaps BEFORE createTikTokStyleCaptions — this ensures TikTok page grouping works with remapped times
- JSON loading uses try/catch with field validation (Array.isArray for cuts, safe_zone existence check) — robustness against malformed pipeline outputs
- safe_zone.bottom validated as number > 0 with Math.round — prevents float/zero/negative positioning bugs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added null handling to remapTimestamps**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Test for `remapTimestamps(ms, null)` failed because function typed `SilenceCutList` not `SilenceCutList | null` 
- **Fix:** Updated signature to accept `SilenceCutList | null` and return original time immediately when null
- **Files modified:** services/remotion-renderer/src/captions.ts
- **Verification:** All 10 tests pass including null handling test
- **Committed in:** 97c8466

**2. [Rule 2 - Missing Critical] Added try/catch JSON parsing for threat model T-05-04**
- **Found during:** Task 2 (render.ts integration)
- **Issue:** Threat model T-05-04 required JSON.parse wrapped in try/catch with fallback to null for malformed silence-cuts.json — Plan 01 had raw JSON.parse without error handling
- **Fix:** Wrapped both silence-cuts.json and finalizer-info.json parsing in try/catch blocks with validation of required fields (Array.isArray for cuts, safe_zone existence)
- **Files modified:** services/remotion-renderer/src/render.ts
- **Verification:** Code review shows both try/catch blocks with descriptive WARN messages on failure
- **Committed in:** b01d74a

**3. [Rule 2 - Missing Critical] Added safe_zone.bottom validation for threat model T-05-06**
- **Found during:** Task 2 (bottomOffset computation)
- **Issue:** Threat model T-05-06 required validating safe_zone.bottom is a positive integer with fallback to 250 — Plan 01 had simple truthiness check
- **Fix:** Changed from `safeZone ? safeZone.bottom : 250` to explicit validation: `typeof safeZone.bottom === 'number' && safeZone.bottom > 0` with Math.round
- **Files modified:** services/remotion-renderer/src/render.ts
- **Verification:** Code shows validated path with Math.round and fallback
- **Committed in:** b01d74a

---

**Total deviations:** 3 auto-fixed (3 missing critical functionality from threat model)
**Impact on plan:** All auto-fixes address security/reliability requirements from the threat model. No scope creep.

## TDD Gate Compliance

| Gate | Status | Commit |
|------|--------|--------|
| RED (failing test) | ✓ | 1bb1368 |
| GREEN (implementation) | ✓ | 97c8466 |
| REFACTOR | Not needed — code clean | — |

## Issues Encountered

None — TDD cycle completed cleanly, all tests passing on GREEN phase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Timestamp remapping fully wired: silence-cuts → remapTimestamps → TikTokPages → Subtitles renders at correct times (D-01, D-04)
- Safe zone positioning wired: finalizer-info → safe_zone.bottom → bottomOffset → Subtitles positions within safe zone (D-08)
- Active word highlighted yellow (#FFFF00) with scale animation, inactive words white (#FFFFFF) — validated (D-10, SUBT-02)
- Word-by-word animation uses @remotion/captions createTikTokStyleCaptions — validated (SUBT-01)
- Missing files handled gracefully with fallback defaults (D-03)
- Ready for Plan 03 (Docker integration testing)

---
*Phase: 05-remotion-animated-subtitles*
*Completed: 2026-05-08*