---
phase: 04-9-16-vertical-output
plan: 01
subsystem: video-processing
tags: [ffmpeg, h264, 9-16, vertical, center-crop, safe-zone, finalizer]

# Dependency graph
requires:
  - phase: 03-silence-detection-removal
    provides: silence-cutter output MP4 as input to FFmpeg finalizer
provides:
  - Conditional crop path (D-03) — scale-only for 9:16 inputs, scale+crop for wider
  - Safe zone metadata in finalizer-info.json for Phase 5 subtitle positioning
  - D-XX decision traceability on all config constants
affects: [05-subtitle-rendering, 06-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [D-XX decision traceability on config constants, conditional crop path per aspect ratio]

key-files:
  created: []
  modified:
    - services/ffmpeg-finalizer/src/config.py
    - services/ffmpeg-finalizer/src/crop.py
    - services/ffmpeg-finalizer/src/schema.py
    - services/ffmpeg-finalizer/main.py

key-decisions:
  - "D-03: Conditional crop path — skip crop filter when input already 9:16, scale-only re-encode"
  - "D-05: Safe zone constants NOT configurable via env vars — hardcoded in config.py"
  - "D-06: Safe zone values: top=100, bottom=230, left=54, right=54 at 1080x1920"
  - "D-11: FPS_OUTPUT=30 constant replaces hardcoded -r 30 in FFmpeg command"
  - "0.5% aspect ratio tolerance for 9:16 detection before applying crop filter"

patterns-established:
  - "D-XX decision traceability: every config constant has a D-XX comment with rationale"
  - "Conditional FFmpeg filter chain: compute_crop() returns zero-offset for matching aspect ratios"
  - "crop_applied boolean: downstream steps can know if original framing was preserved"

requirements-completed: [VERT-01, VERT-02]

# Metrics
duration: 2min
completed: 2026-05-07
---

# Phase 4 Plan 1: Refine FFmpeg Finalizer Summary

**Conditional 9:16 crop path with D-XX traceability, safe zone constants, and manifest path fix**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-07T20:25:01Z
- **Completed:** 2026-05-07T20:27:11Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Implemented D-03 conditional crop path: scale-only for already-9:16 inputs, scale+crop for wider inputs
- Added D-XX decision traceability comments to all config.py constants following whisper/silence-cutter pattern
- Added safe zone constants (top=100, bottom=230, left=54, right=54px) with D-05/D-06 traceability
- Fixed manifest path bug in main.py (used input_file dirname instead of OUTPUT_PATH when output_files empty)
- Aligned main.py with whisper/silence-cutter patterns (traceback in error handler, consistent _write_manifest)

## Task Commits

Each task was committed atomically:

1. **Task 1: Refine config.py with D-XX decision traceability and safe zone constants** - `0b9a5b2` (feat)
2. **Task 2: Implement conditional crop path in crop.py and update schema.py** - `a147ba9` (feat)
3. **Task 3: Fix main.py manifest path and update for refined modules** - `344b5ae` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `services/ffmpeg-finalizer/src/config.py` - D-XX traceability on all constants, safe zone constants, FPS_OUTPUT=30
- `services/ffmpeg-finalizer/src/crop.py` - Conditional crop path (D-03), config constant imports, crop_applied in metadata
- `services/ffmpeg-finalizer/src/schema.py` - Added crop_applied: bool field to FinalizerInfo
- `services/ffmpeg-finalizer/main.py` - Manifest path fix, traceback in error handler, D-05 comment, whisper/silence-cutter pattern alignment

## Decisions Made
- 0.5% aspect ratio tolerance for 9:16 detection — inputs within this range skip crop filter entirely
- crop_applied boolean added to FinalizerInfo so Phase 5 knows if original framing was preserved
- Safe zone values from config.py (not hardcoded in crop.py) — single source of truth following D-05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- FFmpeg finalizer ready for Docker build and integration testing
- Safe zone metadata available for Phase 5 Remotion subtitle positioning
- Conditional crop path ensures 9:16 inputs are not unnecessarily cropped

## Self-Check: PASSED

---
*Phase: 04-9-16-vertical-output*
*Completed: 2026-05-07*