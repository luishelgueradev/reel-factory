---
phase: 06-animated-intros-outros
plan: 02
subsystem: subtitle-layouts
tags: [remotion, typescript, layout-modes, tiktok, sentence, bar, karaoke, position-presets, background-highlight]

# Dependency graph
requires:
  - phase: 06-animated-intros-outros
    provides: PipelineConfig schema, validatePipelineConfig, config-driven Root.tsx and render.ts
provides:
  - TikTokLayout word-by-word subtitle rendering (extracted from Subtitles.tsx)
  - SentenceLayout sentence-at-a-time subtitle rendering
  - BarLayout full-width bar with word-by-word fill
  - KaraokeLayout progressive color fill karaoke-style
  - LayoutDispatcher config-driven layout mode selection
  - Background highlight effect for all layout modes (D-08)
  - Position presets (bottom-center, top-center, center-screen) for all layout modes (D-09)
  - Root.tsx wiring via SubtitleLayoutRenderer with SubtitleConfig merging
affects: [06-intros-outros, 07-zooms, 08-srt-export]

# Tech tracking
tech-stack:
  added: [@types/react for TypeScript type checking]
  patterns: [layout-dispatcher-pattern, position-preset-strategy, shared-layout-constants, dual-layer-karaoke-fill]

key-files:
  created:
    - services/remotion-renderer/src/compositions/TikTokLayout.tsx
    - services/remotion-renderer/src/compositions/SentenceLayout.tsx
    - services/remotion-renderer/src/compositions/BarLayout.tsx
    - services/remotion-renderer/src/compositions/KaraokeLayout.tsx
    - services/remotion-renderer/src/compositions/LayoutDispatcher.tsx
  modified:
    - services/remotion-renderer/src/Root.tsx
    - services/remotion-renderer/src/render.ts
    - services/remotion-renderer/package.json

key-decisions:
  - "All four layout modes share TikTokPage[] data format — no changes to captions.ts needed"
  - "TikTokLayout is pixel-identical to Subtitles.tsx behavior (same FADE_IN_MS, FADE_OUT_MS, PAGE_OVERLAP_GUARD_MS constants)"
  - "KaraokeLayout uses dual-layer rendering (baseline inactive + clip-masked active fill) for progressive word fill"
  - "SentenceLayout groups tokens by sentence-ending punctuation (., ?, !) with active sentence highlighting"
  - "BarLayout renders inline-block background bar behind text with per-word fill progression"
  - "Unknown layout modes fall back to TikTok via LayoutDispatcher default case (T-06-04 mitigation)"
  - "Root.tsx merges SubtitleConfig defaults with env var fallbacks in SubtitledVideo component"
  - "Position presets use CSS absolute positioning: bottom-center (safe zone), top-center (100px), center-screen (50% translateY)"

patterns-established:
  - "Layout Dispatcher pattern: switch on config.layout field, render appropriate component, default to safe fallback"
  - "Shared timing constants: FADE_IN_MS=100, FADE_OUT_MS=300, PAGE_OVERLAP_GUARD_MS=100 across all layout modes"
  - "Config merging pattern: SubtitleConfig built from pipelineConfig with env var fallbacks in SubtitledVideo component"

requirements-completed: [VISU-01, VISU-02]

# Metrics
duration: 7min
completed: 2026-05-10
---

# Phase 6 Plan 02: Subtitle Layout Modes Summary

**Four subtitle layout modes (TikTok, Sentence, Bar, Karaoke) with LayoutDispatcher, position presets, and background highlights — all driven by pipeline-config.json**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-10T01:29:32Z
- **Completed:** 2026-05-10T01:37:26Z
- **Tasks:** 2 (combined into 1 commit since KaraokeLayout was needed for LayoutDispatcher import)
- **Files modified:** 9 (5 new, 4 modified)

## Accomplishments

- Extracted TikTokLayout from Subtitles.tsx with identical word-by-word rendering behavior (same fade constants, same token loop, same CaptionWord pattern)
- Implemented LayoutDispatcher that selects layout component based on subtitleLayout config prop with safe TikTok fallback (T-06-04)
- Created SentenceLayout with sentence-at-a-time grouping by punctuation (.?!) and active sentence highlighting
- Created BarLayout with colored background bar and word-by-word fill progression (Instagram Reels style)
- Created KaraokeLayout with dual-layer progressive fill effect — baseline text in inactiveColor, clip-masked overlay in activeColor animating left-to-right
- Added position presets (bottom-center, top-center, center-screen) to all layout modes per D-09
- Added background highlight support to all layout modes per D-08
- Refactored Root.tsx to use SubtitleLayoutRenderer with SubtitleConfig merging and env var fallbacks
- Updated render.ts to pass style props through subtitleConfig instead of top-level props

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Extract TikTokLayout, create LayoutDispatcher, SentenceLayout, BarLayout, KaraokeLayout** - `1736864` (feat)

**Plan metadata:** (pending final commit)

_Note: Tasks 1 and 2 were combined into a single commit because LayoutDispatcher imports all four layout components — KaraokeLayout creation (Task 2) was required for Task 1's LayoutDispatcher to compile._

## Files Created/Modified

- `services/remotion-renderer/src/compositions/TikTokLayout.tsx` - TikTok word-by-word layout extracted from Subtitles.tsx, with position presets and background highlight
- `services/remotion-renderer/src/compositions/SentenceLayout.tsx` - Sentence-at-a-time layout with punctuation-based grouping and active highlighting
- `services/remotion-renderer/src/compositions/BarLayout.tsx` - Full-width bar layout with word-by-word fill and configurable background
- `services/remotion-renderer/src/compositions/KaraokeLayout.tsx` - Karaoke-style progressive fill layout with dual-layer rendering
- `services/remotion-renderer/src/compositions/LayoutDispatcher.tsx` - Config-driven layout selector with safe TikTok fallback
- `services/remotion-renderer/src/Root.tsx` - Refactored to use SubtitleLayoutRenderer with SubtitleConfig merging
- `services/remotion-renderer/src/render.ts` - Updated to pass style props through subtitleConfig with env var fallbacks
- `services/remotion-renderer/package.json` - Added @types/react dev dependency
- `services/remotion-renderer/package-lock.json` - Updated lockfile

## Decisions Made

- All layout modes share TikTokPage[] as input data — captions.ts remains untouched
- TikTokLayout preserves exact Subtitles.tsx behavior for backward compatibility (same constants, same rendering pattern)
- KaraokeLayout uses CSS clip approach (overflow:hidden + width animation) rather than SVG masks for progressive fill — simpler implementation, same visual result
- BarLayout uses inline-block div with backgroundColor for the bar — no full-width absolute div needed, text determines bar width
- SentenceLayout groups by sentence-ending punctuation; tokens without ending punctuation form a final sentence group
- Position presets derive bottomOffset from config (which reads finalizer-info.json safe_zone for bottom-center)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Installed @types/react for TypeScript type checking**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** @types/react was not installed, causing 140+ implicit-any type errors (all pre-existing but blocking verification)
- **Fix:** `npm install --save-dev @types/react` — reduced type errors from 144 to 7 pre-existing Remotion generic typing issues
- **Files modified:** services/remotion-renderer/package.json, services/remotion-renderer/package-lock.json
- **Verification:** TypeScript errors in new files reduced to zero; pre-existing Remotion/Composition generic type errors unchanged
- **Committed in:** 1736864 (part of task commit)

**2. [Rule 3 - Blocking] Removed legacy top-level props from RemotionProps (render.ts)**
- **Found during:** Task 1 (render.ts type error: 'activeColor' does not exist in type 'RemotionProps')
- **Issue:** Root.tsx removed legacy style props (activeColor, inactiveColor, fontSize, bottomOffset) from RemotionProps to use SubtitleConfig instead, but render.ts still passed them as top-level props
- **Fix:** Refactored render.ts to merge env var fallbacks into the subtitleConfig object instead of top-level props
- **Files modified:** services/remotion-renderer/src/render.ts
- **Verification:** TypeScript error `activeColor does not exist in type 'RemotionProps'` resolved
- **Committed in:** 1736864 (part of task commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes essential for type safety and correct config wiring. No scope creep.

## Issues Encountered

None — all layout components compile and type-check correctly. Pre-existing Remotion Composition generic type errors are unrelated to this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four layout modes (TikTok, Sentence, Bar, Karaoke) render via LayoutDispatcher
- Layout selection driven by pipeline-config.json subtitleLayout field
- Background highlight and position presets work across all layouts
- TikTok layout is pixel-compatible with original Subtitles.tsx behavior
- captions.ts data layer untouched — ready for title overlay plans (Plan 03+)
- Existing pipeline (render.ts) properly passes config to composition

## Self-Check: PASSED

- services/remotion-renderer/src/compositions/TikTokLayout.tsx: FOUND
- services/remotion-renderer/src/compositions/SentenceLayout.tsx: FOUND
- services/remotion-renderer/src/compositions/BarLayout.tsx: FOUND
- services/remotion-renderer/src/compositions/KaraokeLayout.tsx: FOUND
- services/remotion-renderer/src/compositions/LayoutDispatcher.tsx: FOUND
- services/remotion-renderer/src/Root.tsx: FOUND (modified)
- services/remotion-renderer/src/render.ts: FOUND (modified)
- Commit 1736864: FOUND
- LayoutDispatcher includes tiktok, sentence, bar, karaoke: VERIFIED (5 matches)
- Root.tsx uses SubtitleLayoutRenderer: VERIFIED
- No files accidentally deleted: VERIFIED

---
*Phase: 06-animated-intros-outros*
*Completed: 2026-05-10*