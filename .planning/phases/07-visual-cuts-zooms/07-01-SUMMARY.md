---
phase: 07-visual-cuts-zooms
plan: 01
subsystem: video-effects
tags: [zoom, detection, visual-effects, config, validation, remotion]

# Dependency graph
requires:
  - phase: 05-subtitle-engine
    provides: WhisperTranscript and SilenceCutList types from captions.ts
  - phase: 06-animated-intros-outros
    provides: PipelineConfig validation infrastructure
provides:
  - ZoomEvent interface for 07-02 (ZoomContainer) and 07-04 (integration)
  - detectZoomEvents function for zoom trigger detection
  - ZoomConfig, TransitionConfig, VisualEffectsConfig types for pipeline config
  - DEFAULT_VISUAL_EFFECTS constants for Remotion render config
  - Visual effects validation in validatePipelineConfig
affects: [07-visual-cuts-zooms]

# Tech tracking
tech-stack:
  added: []
  patterns: [confidence-based-zoom-detection, silence-boundary-signal, event-merge-gap]

key-files:
  created:
    - services/remotion-renderer/src/zoom-detection.ts
    - services/remotion-renderer/src/zoom-detection.test.ts
  modified:
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.test.ts

key-decisions:
  - "Zoom zoom events use two signals: confidence dips (full zoom) and sentence starts after silence (mild zoom at 87% of maxScale)"
  - "DetectZoomEvents reuses areTimestampsAlreadyRemapped/ remapTimestamps from captions.ts for timeline consistency"
  - "Minimum zoom event duration of 300ms prevents subliminal flashes"
  - "Mild zoom at maxScale * 0.87 ≈ 1.0 provides subtle emphasis without jarring visual effect"

patterns-established:
  - "Zoom detection follows same remapping pattern as captions for timeline consistency"
  - "VisualEffectsConfig follows established PipelineConfig pattern: optional fields with defaults applied at render time, validation in validatePipelineConfig"

requirements-completed: []

# Metrics
duration: 54min
completed: 2026-05-12
---

# Phase 7 Plan 1: Zoom Trigger Logic & Visual Effects Config Summary

**Zoom event detection from Whisper confidence dips and silence boundaries, with VisualEffectsConfig schema extension**

## Performance

- **Duration:** 54 min
- **Started:** 2026-05-12T10:33:56Z
- **Completed:** 2026-05-12T11:28:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added ZoomConfig, TransitionConfig, and VisualEffectsConfig interfaces to PipelineConfig with full defaults and validation
- Implemented detectZoomEvents() that identifies emphasis moments from confidence dips and silence boundaries
- Detection reuses existing timestamp remapping from captions.ts for timeline consistency (D-01)
- Two signals produce events: confidence dips (full zoom at maxScale) and sentence starts after silence (mild zoom at maxScale * 0.87)
- Events within mergeGapMs (default 500ms) are automatically merged with scale taking the maximum (D-04)
- 64 unit tests total (41 for pipeline-config + 23 for zoom-detection)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add VisualEffectsConfig types and defaults to pipeline-config.ts** - `2dc89ad` (feat)
2. **Task 2: Implement detectZoomEvents function with unit tests** - `1dadf49` (feat)

## Files Created/Modified

- `services/remotion-renderer/src/zoom-detection.ts` - ZoomEvent interface and detectZoomEvents function with confidence dip and silence boundary detection, event merging
- `services/remotion-renderer/src/zoom-detection.test.ts` - 23 unit tests covering Signal 1 (confidence dips), Signal 2 (sentence starts), event merging, edge cases, and timestamp remapping
- `services/remotion-renderer/src/pipeline-config.ts` - Added ZoomConfig, TransitionConfig, VisualEffectsConfig, DEFAULT_ZOOM_CONFIG, DEFAULT_TRANSITION_CONFIG, DEFAULT_VISUAL_EFFECTS, validation for visualEffects section
- `services/remotion-renderer/src/pipeline-config.test.ts` - Added 20 tests for VisualEffectsConfig validation (valid configs, invalid values, edge cases, defaults)

## Decisions Made

- Zoom detection reuses areTimestampsAlreadyRemapped() and remapTimestamps() from captions.ts for timeline consistency (same approach as caption generation)
- Mild zoom uses maxScale * 0.87 ≈ 1.0 for default maxScale, providing subtle emphasis rather than full zoom at sentence starts
- Minimum zoom event duration of 300ms prevents subliminal flashes from very short words
- Validation follows established PipelineConfig pattern: optional fields with defaults applied at render time, validation catches invalid values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Test data construction for Signal 2 and timestamp remapping required careful attention to the `areTimestampsAlreadyRemapped` heuristic, which distinguishes original-timeline from cut-timeline timestamps based on whether `max_word_end <= new_duration + TOLERANCE`. Test cases needed to ensure word timestamps were clearly on one timeline or the other to avoid false detection.

## Known Stubs

None - no stubs; all functionality is fully implemented with tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ZoomEvent interface and detectZoomEvents function ready for 07-02 (ZoomContainer Remotion component)
- VisualEffectsConfig ready for 07-04 (integration with Root.tsx and render.ts)
- ZoomConfig and TransitionConfig defaults ready for config-driven rendering

---
*Phase: 07-visual-cuts-zooms*
*Completed: 2026-05-12*