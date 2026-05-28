---
phase: 19-typography-text-effects
plan: "02"
subsystem: ui
tags: [remotion, typescript, css, text-shadow, font-weight, outer-glow, tdd]

# Dependency graph
requires:
  - phase: 19-01
    provides: [OuterGlow-interface, fontWeight-field, fontStyle-field, PlusJakartaSans-font, typography-tests]
provides:
  - getOuterGlowStyle-helper
  - config-driven-fontWeight-all-layouts
  - config-driven-fontStyle-all-layouts
  - outerGlow-applied-all-compositions
  - renderer-sync-compositions
affects: [remotion-studio, remotion-renderer, TikTokLayout, BarLayout, KaraokeLayout, SentenceLayout, TitleOverlay]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getOuterGlowStyle hex-to-rgba parsing (no library, parseInt digit pairs)"
    - "outerGlowStyle computed once in page component, passed to word sub-components"
    - "KaraokeLayout outerGlow on outer wrapper span (both fill layers share the same glow)"
    - "fontWeight !== false ? 700 : 400 (undefined defaults to bold)"
    - "fontStyle === true ? italic : normal (undefined defaults to normal)"

key-files:
  created: []
  modified:
    - services/remotion-studio/src/compositions/shared-styles.ts
    - services/remotion-studio/src/compositions/typography.test.ts
    - services/remotion-studio/src/compositions/TikTokLayout.tsx
    - services/remotion-studio/src/compositions/BarLayout.tsx
    - services/remotion-studio/src/compositions/KaraokeLayout.tsx
    - services/remotion-studio/src/compositions/SentenceLayout.tsx
    - services/remotion-studio/src/compositions/TitleOverlay.tsx
    - services/remotion-renderer/src/compositions/shared-styles.ts
    - services/remotion-renderer/src/compositions/TikTokLayout.tsx
    - services/remotion-renderer/src/compositions/BarLayout.tsx
    - services/remotion-renderer/src/compositions/KaraokeLayout.tsx
    - services/remotion-renderer/src/compositions/SentenceLayout.tsx
    - services/remotion-renderer/src/compositions/TitleOverlay.tsx

key-decisions:
  - "outerGlowStyle spread on word span (TikTok/Bar/Sentence) and outer wrapper span (Karaoke) — applied once per word for performance"
  - "TitleOverlay subtitle span keeps fontWeight: 500 for visual hierarchy (RESEARCH.md A2); only fontStyle and outerGlow are config-driven"
  - "TDD RED/GREEN cycle: 6 new tests added before implementation of getOuterGlowStyle"
  - "SentenceLayout uses inline getOuterGlowStyle(config.outerGlow) spread (no sub-component) since tokens are rendered inline in SentencePage"

patterns-established:
  - "Outer glow: computed once in page-level component, passed as CSSProperties to each word component"
  - "Boolean config fields: fontWeight !== false ? 700 : 400; fontStyle === true ? italic : normal"

requirements-completed:
  - TYPO-03
  - TYPO-04

# Metrics
duration: 6min
completed: "2026-05-28"
---

# Phase 19 Plan 02: Composition Layer — fontWeight, fontStyle, outerGlow Summary

**getOuterGlowStyle() CSS helper wired to all 4 subtitle layouts and TitleOverlay, de-hardcoding fontWeight:700 across the entire Remotion composition layer and enabling config-driven bold/italic/glow for live preview and render.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-28T22:07:00Z
- **Completed:** 2026-05-28T22:13:14Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Implemented `getOuterGlowStyle()` in `shared-styles.ts`: hex-to-RGBA conversion, existingTextShadow comma-join, disabled/undefined passthrough
- De-hardcoded `fontWeight: 700` across all 4 subtitle layouts (TikTok, Bar, Karaoke, Sentence) and TitleOverlay — all now read from `config.fontWeight`
- Applied `outerGlowStyle` at word span level in all layouts (outer wrapper for KaraokeLayout since both fill layers share it)
- Added `fontStyle` CSS mapping (`italic`/`normal`) to all layouts and TitleOverlay
- TDD cycle: 6 tests added in RED state before implementation; all 25 tests pass in GREEN
- Renderer synced: all 5 modified compositions + shared-styles.ts copied to remotion-renderer

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getOuterGlowStyle() to shared-styles.ts** - `e192b12` (feat + test — TDD RED/GREEN)
2. **Task 2: De-hardcode fontWeight in 4 layouts + TitleOverlay + apply outerGlow** - `7b9c8c9` (feat)
3. **Task 3: Renderer sync** - `f1e6ed4` (chore)

## Files Created/Modified

- `services/remotion-studio/src/compositions/shared-styles.ts` — added `getOuterGlowStyle()` exported function, import for `OuterGlow` type
- `services/remotion-studio/src/compositions/typography.test.ts` — added 6 `getOuterGlowStyle` behavior tests (total 25 pass)
- `services/remotion-studio/src/compositions/TikTokLayout.tsx` — `CaptionWord` props + `fontWeight !== false`, `fontStyle`, `...outerGlowStyle`; `CaptionPage` computes and passes glow style
- `services/remotion-studio/src/compositions/BarLayout.tsx` — same pattern as TikTok (`BarWord` + `BarPage`)
- `services/remotion-studio/src/compositions/KaraokeLayout.tsx` — `KaraokeWord` gets both spans de-hardcoded; outerGlow on outer wrapper span; `KaraokePage` computes and passes glow
- `services/remotion-studio/src/compositions/SentenceLayout.tsx` — inline token span uses `config.fontWeight !== false`, `config.fontStyle`, `getOuterGlowStyle(config.outerGlow)` spread inline
- `services/remotion-studio/src/compositions/TitleOverlay.tsx` — main title: `style?.fontWeight !== false ? 700 : 400`, `style?.fontStyle`, `getOuterGlowStyle(style?.outerGlow)`; subtitle: keeps 500 weight, adds fontStyle + outerGlow
- `services/remotion-renderer/src/compositions/*` — synced copies of all 5 compositions + shared-styles.ts; typography.test.ts also copied (harmless)

## Decisions Made

1. `outerGlowStyle` is computed once in each page component and passed to all word sub-components — avoids calling `getOuterGlowStyle()` on every token render in the map.
2. KaraokeLayout: `outerGlowStyle` applied to the outer wrapper `<span>` (not the two inner spans) so the glow applies uniformly across the clip mechanism and both fill layers inherit it.
3. TitleOverlay subtitle span: `fontWeight` stays at 500 (visual hierarchy preserved per RESEARCH.md A2). Only `fontStyle` and `outerGlow` are config-driven on the subtitle span.
4. SentenceLayout: tokens rendered inline in `SentencePage` (no word sub-component), so `getOuterGlowStyle(config.outerGlow)` is spread directly in the token span's style object.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all fields are fully wired from config to CSS. The UI controls to set `fontWeight`, `fontStyle`, and `outerGlow` from the Studio editor are handled in Plan 03 (StyleControls.tsx + TitleEditor.tsx updates).

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns. The `outerGlow.color` CSS injection surface was already mitigated in Plan 01 via `validatePipelineConfig` hex regex validation (T-19-01). The `getOuterGlowStyle` implementation uses `parseInt` digit-by-digit from a validated hex string — no eval or template injection vector exists.

## Self-Check: PASSED

- FOUND: services/remotion-studio/src/compositions/shared-styles.ts (getOuterGlowStyle exported)
- FOUND: services/remotion-studio/src/compositions/typography.test.ts (25 tests pass)
- FOUND: services/remotion-studio/src/compositions/TikTokLayout.tsx (fontWeight !== false ? 700 : 400)
- FOUND: services/remotion-studio/src/compositions/BarLayout.tsx (fontWeight !== false ? 700 : 400)
- FOUND: services/remotion-studio/src/compositions/KaraokeLayout.tsx (2 occurrences of fontWeight !== false)
- FOUND: services/remotion-studio/src/compositions/SentenceLayout.tsx (fontWeight !== false ? 700 : 400)
- FOUND: services/remotion-studio/src/compositions/TitleOverlay.tsx (style?.fontWeight !== false ? 700 : 400 + getOuterGlowStyle)
- FOUND: services/remotion-renderer/src/compositions/shared-styles.ts (getOuterGlowStyle at line 80)
- FOUND: commit e192b12 (feat(19-02) — getOuterGlowStyle + tests)
- FOUND: commit 7b9c8c9 (feat(19-02) — de-hardcode fontWeight + outerGlow all layouts)
- FOUND: commit f1e6ed4 (chore(19-02) — renderer sync)

---
*Phase: 19-typography-text-effects*
*Completed: 2026-05-28*
