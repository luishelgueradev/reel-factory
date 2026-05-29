---
phase: 20-title-block-precision
plan: "02"
subsystem: remotion-compositions
tags: [title-overlay, pixel-positioning, border-radius, subtitle-removal, react, typescript]
dependency_graph:
  requires: [TitleStyleProps-x-y-borderRadius, TitleConfig-no-subtitle, validatePipelineConfig-Phase20]
  provides: [TitleOverlay-pixel-positioning, TitleOverlay-config-borderRadius, TitleOverlay-no-subtitle, TitleEditor-xy-inputs, TitleEditor-borderRadius-slider, TitleEditor-subtitle-removed]
  affects: [services/remotion-studio/src/SubtitledVideo.tsx, services/remotion-renderer/src/compositions/TitleOverlay.tsx]
tech_stack:
  added: []
  patterns: [pixel-to-percent-coordinate-conversion, config-driven-css, animation-only-transform]
key_files:
  created: []
  modified:
    - services/remotion-studio/src/compositions/TitleOverlay.tsx
    - services/remotion-studio/src/editor/components/TitleEditor.tsx
    - services/remotion-studio/src/SubtitledVideo.tsx
    - services/remotion-renderer/src/compositions/TitleOverlay.tsx
decisions:
  - "D-04 top-left anchor: centering transform translate(-50%,-50%) removed; only translateY for entrance animation remains"
  - "D-06 defaults: x:200 y:960 in DEFAULT_TITLE_STYLE in both TitleOverlay.tsx and TitleEditor.tsx"
  - "D-09 borderRadius: local variable from style?.borderRadius ?? DEFAULT_TITLE_STYLE.borderRadius; not inline ?? 12"
  - "Rule 3 auto-fix: TitleEditor.tsx and SubtitledVideo.tsx fixed to compile cleanly after Plan 01 schema changes removed subtitle/subtitleFontFamily/topOffset from TitleConfig+TitleStyleProps"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-29"
  tasks_completed: 1
  files_changed: 4
---

# Phase 20 Plan 02: TitleOverlay Rendering Update Summary

TitleOverlay.tsx rewritten with pixel-coordinate positioning (left/top % from x/y px), config-driven borderRadius, and subtitle block removed; TitleEditor.tsx updated with x/y number inputs and borderRadius slider replacing topOffset slider and subtitle controls; renderer synced; all 47 pipeline-config tests green.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Rewrite TitleOverlay.tsx — remove subtitle, pixel positioning, config borderRadius | 7927a4f | services/remotion-studio/src/compositions/TitleOverlay.tsx, services/remotion-studio/src/SubtitledVideo.tsx, services/remotion-renderer/src/compositions/TitleOverlay.tsx |

## What Was Built

**TitleOverlay.tsx (studio + renderer):**
- `TitleOverlayProps` interface: removed `subtitle?: string`
- `DEFAULT_TITLE_STYLE`: removed `subtitleFontSize:42`, `subtitleColor:"#FFFFFF"`, `subtitleFontFamily:"PlusJakartaSans"`, `topOffset:50`; added `x:200`, `y:960`, `borderRadius:12`
- Variable declarations: removed `subtitleFontSize`, `subtitleColor`, `subtitleFontFamily`, `topOffset`, `subtitleFontCSS`; added `x`, `y`, `borderRadius` using `style?.field ?? DEFAULT_TITLE_STYLE.field` pattern
- `fontsToLoad` and `useEffect` deps: reduced to `[titleFontFamily]` only
- Positioning CSS: `left: ${(x/1080)*100}%`, `top: ${(y/1920)*100}%` replacing `left:"50%"` + `topOffset%`; `transform: translateY(${translateY}px)` (centering removed); `borderRadius: ${borderRadius}px`; `gap: "0"` (static)
- Subtitle JSX block removed entirely

**TitleEditor.tsx (studio only):**
- `DEFAULT_TITLE_STYLE`: removed subtitle/topOffset fields, added `x:200`, `y:960`, `borderRadius:12`
- State initializers, `resetForm`, `handleAdd`, `handleSaveEdit`, `handleStartEdit`: `subtitle` field removed throughout
- Title list item: subtitle display `<div>` removed
- Form: Subtitle text input removed; Subtitle Color column removed; Subtitle Size slider removed; Subtitle Font select removed; topOffset slider replaced with X(px)/Y(px) number inputs (min/max 0-1080/0-1920); Border Radius slider added (0-50px, accentColor #4CAF50); Title Font select is now full-width single column

**SubtitledVideo.tsx:**
- `subtitle={title.subtitle}` prop removed from `<TitleOverlay>` call

**Renderer sync:** `TitleOverlay.tsx` copied from studio to renderer via `cp` per AGENTS.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TitleEditor.tsx and SubtitledVideo.tsx to compile after Plan 01 schema removal**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** Plan 01 removed `subtitle`, `subtitleFontSize`, `subtitleColor`, `subtitleFontFamily`, `topOffset` from `TitleStyleProps` and `TitleConfig`. `TitleEditor.tsx` still referenced all removed fields (TypeScript errors at 10 locations); `SubtitledVideo.tsx` still passed `subtitle={title.subtitle}` to `<TitleOverlay>` (which no longer accepts that prop).
- **Fix:** Rewrote `TitleEditor.tsx` removing all deprecated field references and adding x/y inputs + borderRadius slider. Removed `subtitle` prop from `<TitleOverlay>` in `SubtitledVideo.tsx`.
- **Files modified:** `services/remotion-studio/src/editor/components/TitleEditor.tsx`, `services/remotion-studio/src/SubtitledVideo.tsx`
- **Commits:** 7927a4f (TitleOverlay + SubtitledVideo), 5620664 (TitleEditor)

**Note on typography.test.ts pre-existing failure:** `services/remotion-renderer/src/compositions/typography.test.ts` contains a test "rejects title style subtitleFontSize = 201 (exceeds max)" that was already failing before this plan (introduced when Plan 01 removed the `subtitleFontSize` validation from `validatePipelineConfig`). This is a pre-existing failure outside the scope of Plan 02. Logged to deferred-items.

## Known Stubs

None — all rendering logic is wired. The x/y coordinate inputs and borderRadius slider in TitleEditor write to in-memory state and persist via Save (Phase 18 D-09 pattern).

## Threat Flags

None — CSS property values from local config; no new network surface.

## Self-Check: PASSED

- `services/remotion-studio/src/compositions/TitleOverlay.tsx` — verified: `(x / 1080) * 100` present, `(y / 1920) * 100` present, no `topOffset`/`subtitleFontFamily`/`subtitleColor`/`subtitleFontCSS`, no `translate(-50%`, `borderRadius: \`${borderRadius}px\`` config-driven
- `services/remotion-renderer/src/compositions/TitleOverlay.tsx` — synced from studio
- `services/remotion-renderer/src/pipeline-config.test.ts` — 47 tests, all green
- Commits 7927a4f and 5620664 — both verified in git log
