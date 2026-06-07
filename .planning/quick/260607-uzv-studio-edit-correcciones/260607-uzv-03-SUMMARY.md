---
phase: 260607-uzv-studio-edit-correcciones
plan: 03
subsystem: remotion-studio + remotion-renderer (subtitles)
tags: [subtitles, tiktok, style-controls, renderer-sync, ux]
requires:
  - 260607-uzv-02 (serial: shared pipeline-config.ts write)
provides:
  - tiktok subtitles paint NO full-phrase backgroundHighlight (per-word only)
  - StyleControls: tiktok shows ONE per-word control labeled "Fondo resaltado"
  - DEFAULT_SUBTITLE_CONFIG.highlightDurationMs = 0 (active word = activeColor immediately)
  - deduplicated sample-text heading in the preview
affects:
  - sentence/bar layouts UNCHANGED (backgroundHighlight field + validation retained)
tech-stack:
  added: []
  patterns:
    - layout-conditional control rendering in StyleControls (config.layout === "tiktok")
    - source-level assertion test for a render-wiring removal (CaptionPage uses Remotion hooks → not jsdom-renderable)
key-files:
  created: []
  modified:
    - services/remotion-studio/src/compositions/TikTokLayout.tsx
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-studio/src/editor/components/StyleControls.tsx
    - services/remotion-studio/src/preview/TextareaInput.tsx
    - services/remotion-studio/src/compositions/tiktok-word-background.test.tsx
    - services/remotion-studio/src/pipeline-config.test.ts
    - services/remotion-studio/src/editor/components/word-background-controls.test.tsx
    - services/remotion-renderer/src/compositions/TikTokLayout.tsx
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-renderer/src/compositions/tiktok-word-background.test.tsx
    - services/remotion-renderer/src/pipeline-config.test.ts
decisions:
  - "tiktok highlighted-bg is per-word only: removed the full-phrase getBackgroundHighlightStyle spread from the CaptionPage parent div; kept the field/validation for sentence/bar"
  - "flash off by default via DEFAULT_SUBTITLE_CONFIG.highlightDurationMs = 0 (no CaptionWord logic change — existing showHighlight already returns activeColor at duration 0)"
  - "the per-word control's title is layout-conditional ('Fondo resaltado' for tiktok, 'Fondo por palabra' for sentence/bar) rather than a duplicate control"
metrics:
  duration: ~12m
  completed: 2026-06-07
---

# Phase 260607-uzv Plan 03: Subtítulos — per-word tiktok bg, flash-off default, sample-text dedupe Summary

Three v1.5-regression fixes for the Studio subtitles surface: tiktok now paints only the per-word "Fondo resaltado" background (full-phrase highlight removed from the tiktok render path and hidden in the controls, but retained for sentence/bar), the active-word highlight flash is OFF by default so the active word shows its `activeColor` immediately, and the duplicate inner "Sample Text" heading is removed. Items 4 and 5 are renderer-synced.

## What Was Built

### Item 4 — tiktok per-word background only (renderer-synced)
- `TikTokLayout.tsx` (both services): removed `const bgHighlightStyles = getBackgroundHighlightStyle(config.backgroundHighlight)` and the `...bgHighlightStyles` spread from the `CaptionPage` parent `<div>`, and dropped the now-unused `getBackgroundHighlightStyle` import. tiktok no longer paints the full-phrase background even when `config.backgroundHighlight.enabled === true`. The per-word `getWordBackgroundStyle` path is untouched.
- `StyleControls.tsx` (studio-only): added `const isTiktok = config.layout === "tiktok"`. For tiktok, the full-phrase `bh` FxBlock is hidden (`{!isTiktok && (...)}`) and the per-word `wb` FxBlock is relabeled `"Fondo resaltado"`. For sentence/bar the full-phrase "Fondo resaltado" control renders unchanged and the per-word block keeps its "Fondo por palabra" label.
- `backgroundHighlight` field + validation are **retained** in `pipeline-config.ts` (10 references) — SentenceLayout/BarLayout still use it.

### Item 5 — flash off by default (renderer-synced)
- `pipeline-config.ts` (both services): `DEFAULT_SUBTITLE_CONFIG.highlightDurationMs` changed `200 → 0`. No `CaptionWord` logic change needed — the existing `showHighlight = isActive && !!highlightColor && (highlightDurationMs ?? 0) > 0` already yields `wordColor = color (= activeColor)` at duration 0. Capability preserved: a config with `highlightDurationMs > 0` still flashes.

### Item 6 — duplicate sample-text label (studio-only)
- `TextareaInput.tsx`: removed the inner `<label>Sample Text</label>` (the wrapping `CollapsibleSection` owns the heading). Helper `<p>` and the `<textarea>` are kept.

### Renderer sync (Task 3)
- `cp` of ONLY `TikTokLayout.tsx` + `pipeline-config.ts` studio→renderer (no glob — clobber hazard). Verified byte-identical via `diff`. The synced renderer `pipeline-config.ts` carries BOTH plan-02's title fields (`backgroundGradient`/`backgroundWidth`, 16 refs) AND this plan's `highlightDurationMs: 0`. `Root.tsx`/`SubtitledVideo.tsx`/`StyleControls`/`TextareaInput` NOT synced. Pre-sync `diff` confirmed the only differences were exactly this plan's intended changes — no renderer-only fixes were clobbered.

## Tests
- `tiktok-word-background.test.tsx` (both services): added active-word flash-off cases (activeColor at duration 0 and unset; instant flash still visible at duration>0) + source-level assertions that the tiktok layout no longer spreads `bgHighlightStyles` / no longer calls `getBackgroundHighlightStyle`, and keeps `getWordBackgroundStyle`.
- `pipeline-config.test.ts` (both services): `DEFAULT_SUBTITLE_CONFIG.highlightDurationMs === 0`.
- `word-background-controls.test.tsx` (studio): updated to the layout-conditional label — tiktok per-word block is "Fondo resaltado" (and "Fondo por palabra" is absent for tiktok); added a sentence-layout case asserting both the full-phrase "Fondo resaltado" and per-word "Fondo por palabra" render.

## Verification
- `npm run build:editor` (studio): PASS (exit 0).
- Studio vitest: **538 passed** (27 files). Baseline 529 + wave-1 already merged; net-new tests added here.
- Renderer vitest: **355 passed** (11 files). Baseline 354 (incl. wave-1) + 1 new default assertion.
- Acceptance greps: `highlightDurationMs: 0` → 1 in both services; renderer TikTokLayout has 0 `...bgHighlightStyles` and 0 `getBackgroundHighlightStyle`; `backgroundHighlight` retained (10 refs) in both; `Sample Text` → 0 in TextareaInput.tsx.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test breakage from the intended behavior change] Updated `word-background-controls.test.tsx`**
- **Found during:** Task 2 (full studio suite run).
- **Issue:** The existing Phase 28-03 test asserted the per-word block is titled "Fondo por palabra" with a `layout: "tiktok"` `baseConfig`. Item 4 relabels that block to "Fondo resaltado" for tiktok, so two assertions failed.
- **Fix:** Updated the two tiktok-config assertions to the new "Fondo resaltado" label and added a sentence-layout case proving the non-tiktok labels ("Fondo por palabra" per-word + "Fondo resaltado" full-phrase) still render. This is in-scope test maintenance for the plan's own behavior change, not a separate fix.
- **Files modified:** services/remotion-studio/src/editor/components/word-background-controls.test.tsx
- **Commit:** 25b3bc1

### Environment
- Worktree lacked `node_modules`; symlinked from the main checkout per constraint (no installs). Symlinks left untracked and NOT committed.

## UI Tooling Note
- `sketch-findings-reel-factory` honored: green-discipline preserved — the new/relabeled controls reuse the existing `FxBlock` idiom and `--accent`/neutral tokens; no `--action` green introduced (verified by the existing "no #4CAF50" test still passing). The `impeccable` skill and `frontend-design` plugin are not available as invokable tools in this executor environment — documented skip; the loaded sketch skill provided the canonical green-discipline rules.

## Live UAT (user follow-up, NOT performed)
- Docker studio: tiktok shows ONE "Fondo resaltado" (per-word) control; switching to sentence/bar restores the full-phrase control. Active word shows the "Activa" color immediately. Subtítulos sample-text section shows a single heading.

## Commits
- `b188df2` fix(260607-uzv-03): tiktok drops full-phrase bg + flash off by default (studio)
- `25b3bc1` feat(260607-uzv-03): tiktok single per-word 'Fondo resaltado'; dedupe sample-text label (studio)
- `2a80f64` feat(260607-uzv-03): renderer sync — TikTokLayout + pipeline-config mirror (items 4/5)

## Self-Check: PASSED

All modified files present; all three commits (b188df2, 25b3bc1, 2a80f64) exist.
