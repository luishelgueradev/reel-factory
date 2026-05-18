---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: complete
stopped_at: Phase 12 complete — all plans executed
last_updated: "2026-05-18T13:10:00.000Z"
last_activity: 2026-05-18
progress:
  total_phases: 12
  completed_phases: 12
  total_plans: 48
  completed_plans: 48
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-05)

**Core value:** Transformar un video crudo de una persona hablando en un video dinamico para redes sociales con un solo comando API, eliminando silencios y agregando subtítulos automaticamente.
**Current focus:** Phase 12 complete — all milestone phases finished

## Current Position

Phase: 12 (subtitle-preview-lab) — COMPLETE
Plan: 2 of 2
Status: All plans executed
Last activity: 2026-05-18

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 46
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 6 | - | - |
| 2 | 3 | - | - |
| 3 | 4 | - | - |
| 4 | 3 | - | - |
| 5 | 6 | - | - |
| 6 | 5 | - | - |
| 7 | 7 | - | - |
| 8 | 2 | - | - |
| 9 | 3 | - | - |
| 10 | 4 | - | - |
| 11 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

| Phase 12-subtitle-preview-lab P01 | 7min | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 11 P02]: Express path normalization handles path traversal as 404 before route handler
- [Phase 11 P02]: POST /process uses same onStepStart callback pattern as worker.ts
- [Phase 11 P02]: BullMQ job state overrides Redis progress status for completed/failed
- [Phase ?]: ---

phase: 12-subtitle-preview-lab
plan: 01
subsystem: ui
tags: [remotion, subtitles, opacity, config, slider, preview]

# Dependency graph

requires:

  - phase: 11
    provides: PipelineConfig, SubtitleConfig, layout components, StyleControls, Root.tsx
provides:

  - pastWordOpacity field in SubtitleConfig with default 0.4 and validation
  - getPastWordOpacity helper in shared-styles.ts
  - pastWordOpacity applied in all 4 layout components (TikTok, Sentence, Bar, Karaoke)
  - SubtitledVideo exported from Root.tsx for @remotion/player import
  - rawVideoSrc prop on RemotionProps for Player context
  - lineHeight, pastWordOpacity, bottomOffset sliders in StyleControls

affects: [12-subtitle-preview-lab, preview-page]

# Tech tracking

tech-stack:
  added: []
  patterns: [config-driven-opacity, shared-style-helpers, player-compatible-exports]

key-files:
  created: []
  modified:

    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-renderer/src/compositions/TikTokLayout.tsx
    - services/remotion-renderer/src/compositions/SentenceLayout.tsx
    - services/remotion-renderer/src/compositions/BarLayout.tsx
    - services/remotion-renderer/src/compositions/KaraokeLayout.tsx
    - services/remotion-renderer/src/compositions/shared-styles.ts
    - services/remotion-renderer/src/Root.tsx
    - services/remotion-studio/src/editor/components/StyleControls.tsx

key-decisions:

  - "Added getPastWordOpacity() shared helper instead of duplicating default fallback in each layout"
  - "Exported SubtitledVideo from Root.tsx to enable @remotion/player import for preview page"
  - "Used rawVideoSrc ?? staticFile(videoSrc) pattern to support both Player and production render contexts"
  - "Added lineHeight validation in validatePipelineConfig alongside pastWordOpacity validation"

patterns-established:

  - "Config fields with defaults: add field to interface, add to DEFAULT_SUBTITLE_CONFIG, add fallback in layouts via helper"
  - "Layout opacity: wasActive words get config.pastWordOpacity; active and upcoming words get opacity 1"

requirements-completed: [PREV-03]

# Metrics

duration: 7min
completed: 2026-05-18
---

# Phase 12 Plan 01: Subtitle Config pastWordOpacity + StyleControls Extensions Summary

**pastWordOpacity config field (default 0.4) applied in all 4 layouts, SubtitledVideo exported for Player, three new StyleControls sliders added for lineHeight/pastWordOpacity/bottomOffset**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-18T12:37:16Z
- ** **Completed:** 2026-05-18T12:44:23Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added `pastWordOpacity?: number` to SubtitleConfig with default 0.4 and 0–1 validation
- Created `getPastWordOpacity()` shared helper to centralize default fallback
- Applied pastWordOpacity to wasActive words in all 4 layout components (TikTok, Sentence, Bar, Karaoke)
- Replaced hardcoded `PAST_OPACITY = 0.5` in SentenceLayout with config-driven value
- Exported `SubtitledVideo` from Root.tsx enabling @remotion/player import
- Added `rawVideoSrc?: string` prop to RemotionProps for Player context video loading
- Added lineHeight (0.8–3.0), pastWordOpacity (0–1), and bottomOffset (0–960px) sliders to StyleControls
- Added lineHeight validation in validatePipelineConfig

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pastWordOpacity to SubtitleConfig, export SubtitledVideo, add rawVideoSrc prop, and apply pastWordOpacity in all 4 layout components** - `d2030e7` (feat)
2. **Task 2: Extend StyleControls with lineHeight, pastWordOpacity, and bottomOffset sliders** - `da8e16f` (feat)

## Files Created/Modified

- `services/remotion-renderer/src/pipeline-config.ts` - Added pastWordOpacity field, default, and validation; added lineHeight validation
- `services/remotion-renderer/src/compositions/TikTokLayout.tsx` - CaptionWord applies opacity via pastWordOpacity prop for wasActive words
- `services/remotion-renderer/src/compositions/SentenceLayout.tsx` - Replaced hardcoded PAST_OPACITY=0.5 with config-driven pastWordOpacityVal
- `services/remotion-renderer/src/compositions/BarLayout.tsx` - BarWord applies opacity via pastWordOpacity for wasActive words
- `services/remotion-renderer/src/compositions/KaraokeLayout.tsx` - KaraokeWord applies pastWordOpacity to baseline layer for wasActive words
- `services/remotion-renderer/src/compositions/shared-styles.ts` - Added getPastWordOpacity() helper, imported DEFAULT_SUBTITLE_CONFIG
- `services/remotion-renderer/src/Root.tsx` - Exported SubtitledVideo, added rawVideoSrc prop, merged pastWordOpacity into config defaults
- `services/remotion-studio/src/editor/components/StyleControls.tsx` - Added lineHeight, pastWordOpacity, and bottomOffset sliders

## Decisions Made

- Used shared `getPastWordOpacity(config)` helper instead of duplicating `config.pastWordOpacity ?? DEFAULT_SUBTITLE_CONFIG.pastWordOpacity` in each layout
- Exported `SubtitledVideo` (not just `RemotionRoot`) so the preview Player can render just the composition without registerRoot registration
- `rawVideoSrc ?? staticFile(videoSrc)` pattern allows the Player to load video from a direct URL path while production renders continue using `staticFile()`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- pastWordOpacity is now configurable and applied in all layouts, ready for preview page (Plan 02) to use @remotion/player with SubtitledVideo
- rawVideoSrc prop enables Player to load video via direct URL (bypassing staticFile)
- All 3 new StyleControls sliders (lineHeight, pastWordOpacity, bottomOffset) are wired for real-time adjustment in both editor and preview contexts

---
*Phase: 12-subtitle-preview-lab*
*Completed: 2026-05-18*

## Session Continuity

Last session: 2026-05-18T12:46:13.178Z
Stopped at: Completed 12-01-PLAN.md
Resume file: None
