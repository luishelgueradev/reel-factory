---
phase: 26-ui-convergence
plan: 02
subsystem: remotion-studio/editor
tags: [ui, preset-cards, subtitle-layout, title-entrance, color-law, a11y, sketch-011-C, sketch-014-C]
dependency_graph:
  requires: [26-01]
  provides: [specimen-driven-preset-cards, subtitle-layout-cards, entrance-animation-cards]
  affects: [LayoutSelector, TitleEditor, StyleControls]
tech_stack:
  added: []
  patterns: [preset-card-grid, radiogroup-a11y, mc-vis-specimen, mc-nm-label]
key_files:
  created:
    - services/remotion-studio/src/editor/components/layout-mode-cards.test.tsx
  modified:
    - services/remotion-studio/src/editor/components/LayoutSelector.tsx
    - services/remotion-studio/src/editor/components/LayoutSelector.test.tsx
    - services/remotion-studio/src/editor/components/TitleEditor.tsx
decisions:
  - "D-03: Static cards only (no live animation) — deferred per plan decision"
  - "D-04: Active state = --accent (blue), never green; enforced in both cards + tests"
  - "LayoutSelector stays in PreviewApp above StyleControls (already leading the form)"
  - "TitleEditor entrance section promoted to lead the form before timing inputs"
metrics:
  duration: 510s
  completed: "2026-06-04T23:01:09Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 26 Plan 02: Specimen-driven preset cards — Summary

**One-liner:** Subtitle layout modes and titles entrance animation refactored from radio/flat inputs to 4-card preset grids (sketches 011-C/014-C) with blue active rings, static specimens, and full a11y.

## Tasks Completed

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 | Subtitles layout-mode preset cards (011-C) | c4026ff | LayoutSelector.tsx, LayoutSelector.test.tsx |
| 2 | Titles entrance preset cards (014-C) + tests | 0e03664 | TitleEditor.tsx, layout-mode-cards.test.tsx |

## What Was Built

### Task 1 — LayoutSelector refactored to 4-card grid (sketch 011-C)

`LayoutSelector.tsx` was fully rewritten from a vertical radio-row list into a 4-column preset card grid matching the `.modecards`/`.modecard` pattern from sketch 011-C:

- **4 mode cards:** TikTok / Sentence / Bar / Karaoke
- **Each card:** 30px static specimen tile (`.mc-vis`) showing a visual hint of the mode + label (`.mc-nm`)
  - TikTok: `pa` (yellow/active) + `labra` (white/inactive) — word-by-word hint
  - Sentence: `frase entera` — full sentence hint
  - Bar: blue `barra` chip — bar background hint
  - Karaoke: `kara` (yellow) + `oke` (white) — fill hint
- **Blue active ring:** `--accent-strong` border + `--accent-tint-2` background (D-04 color law)
- **A11y:** `role="radiogroup"` container, each card is `role="radio"` with `aria-checked`, `data-mode` + `data-selected` attributes
- **Preserves:** Same `SubtitleLayoutMode` enum values passed to `onChange` — no config change

`LayoutSelector.test.tsx` updated from label/input-radio structure to button/radio structure (10 tests, all passing).

### Task 2 — TitleEditor entrance animation preset cards (014-C)

`TitleEditor.tsx` entrance animation section refactored from segmented buttons to a 4-card preset grid matching sketch 014-C:

- **4 entrance cards:** Slide ↑ / Slide ↓ / Fade / Ninguna
- **Each card:** 30px glyph tile (↑/↓/◍/∅) + label — static, no live animation (D-03)
- **Blue active ring:** same `--accent-strong`/`--accent-tint-2` pattern
- **A11y:** `role="radiogroup"` with `aria-label="Animación de entrada"`, cards are `role="radio"` with `aria-checked`, `data-entrance` + `data-selected` attributes
- **Section header:** matches always-open titled section pattern used across the editor
- **Preserves:** Same `TitleEntranceAnimation` enum values (`"slide-up"`, `"slide-down"`, `"fade-in"`, `"none"`) + all timing/style inputs unchanged

`layout-mode-cards.test.tsx` created with 12 integration tests:
- Suite 1: LayoutSelector cards in StyleControls context (5 tests)
- Suite 2: TitleEditor entrance cards (7 tests)
  - Opening add form, card rendering, onChange value, color law, form regression, edit mode

## Deviations from Plan

### Minor

**1. [Rule 1 - Bug] LayoutSelector test updated for new button/card structure**
- **Found during:** Task 1 execution
- **Issue:** Existing `LayoutSelector.test.tsx` queried `label[data-selected]` and `input[type=radio]` — structure changed to `button[role=radio]`
- **Fix:** Updated test assertions to match new card button structure; color-law regression guard preserved
- **Files modified:** `LayoutSelector.test.tsx`
- **Commit:** c4026ff

**2. [Rule 1 - Bug] Fixed test helper for multi-element text queries**
- **Found during:** Task 2 test writing
- **Issue:** `screen.getByText(/posición/i)` and `screen.getByText(/agregar título/i)` found multiple elements in combined layouts
- **Fix:** Used `getAllByText(...).length > 0` and a DOM-based helper to find the dashed add button
- **Files modified:** `layout-mode-cards.test.tsx`
- **Commit:** 0e03664

**3. StyleControls.tsx not modified (as mentioned in plan files)**
- `StyleControls.tsx` was listed in Task 1's `<files>` but no changes were needed: `LayoutSelector` is already rendered above `StyleControls` in `PreviewApp.tsx`, already leading the form (TabLead position). No structural change was required to achieve the 011-C leading position.

## Verification

- `npx vitest run` (studio): **402 tests, 20 test files — all passed** (was 387 before this plan)
- `npm run build:editor`: **built in 1.97s — OK**, no TypeScript errors
- No green on active states: scan of all changed files confirms `--accent` only on active rings
- No config/behavior change: `SubtitleLayoutMode` enum values + `TitleEntranceAnimation` values preserved unchanged

## Known Stubs

None — cards are functional (they set config values), static specimen hints are intentional (D-03 deferred for live animation).

## Threat Flags

None — this is a pure UI/presentation change with no network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

All files verified:
- FOUND: services/remotion-studio/src/editor/components/LayoutSelector.tsx
- FOUND: services/remotion-studio/src/editor/components/LayoutSelector.test.tsx
- FOUND: services/remotion-studio/src/editor/components/TitleEditor.tsx
- FOUND: services/remotion-studio/src/editor/components/layout-mode-cards.test.tsx
- FOUND: .planning/phases/26-ui-convergence/26-02-SUMMARY.md

Commits verified:
- c4026ff: feat(26-02): refactor LayoutSelector into 4-card grid (sketch 011-C, D-04)
- 0e03664: feat(26-02): entrance animation → 4-card preset grid in TitleEditor (sketch 014-C)
