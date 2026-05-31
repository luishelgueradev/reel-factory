# Sketch Wrap-Up Summary

**Date:** 2026-05-31 (updated — appended sketches 008–010)
**Sketches processed:** 10 (001–010)
**Design areas:** Workspace Shell · Control Panel Density · Position Presets · Per-Tab Structure · Preview Direct Manipulation (frontier) · States & Save Feedback · Motion & Timing · Render/Export Surface (frontier)
**Skill output:** `./.claude/skills/sketch-findings-reel-factory/`

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | three-column-shell | D | Workspace Shell & Layout |
| 002 | control-density-disclosure | A | Control Panel Density & Disclosure |
| 003 | position-presets | B | Position Presets |
| 004 | overlay-list-and-layering | A | Per-Tab Structure & Coherence |
| 005 | subtitles-tab-restructure | C | Per-Tab Structure & Coherence |
| 006 | all-three-tabs-coherence | A | Per-Tab Structure & Coherence |
| 007 | preview-as-layer-map | A | Preview as Editing Surface (frontier) |
| 008 | states-and-empties | B | States, Empties & Save Feedback |
| 009 | motion-coherence | A | Motion & Timing |
| 010 | render-export-surface | A | Render / Export Surface (frontier) |

## Excluded Sketches
_None — all 10 sketches included._

## Design Direction
A 3-column workspace shell — **content-sized 9:16 preview · controls that grow into two internal
columns · persistent ~320px social-metadata placeholder** ("Próximamente"). Each tab (Titles /
Overlays / Subtitles) orders controls **Posición → Estilo → Avanzado** as always-open titled
sections, with a shared **9-point arrow-button position-preset** affordance. Dark indigo design
system preserved, **Restrained color**: tinted-indigo OKLCH neutrals, blue for selection/focus,
green for **the single primary action of the current surface**. Motion is **Calm** (170ms
ease-out-quart, two-tier state/travel timing). The realized synthesis is **sketch 001 variant D**.

## Key Decisions
- **Layout:** 3-column shell (001-D); controls grow into 2 internal columns, collapse to 1 under a
  width breakpoint (006-B).
- **Density:** always-open titled sections, no accordions (002-A).
- **Position:** shared 9-point arrow-button preset grid next to X/Y inputs (003-B).
- **Per-tab:** Titles/Overlays = list + detail form (004-A); Subtitles = condensed/expanding
  sample-text textarea (005-C); coherence rule = lists/textarea full-width, form always 2-col (006-A).
- **Preview (frontier):** drag-to-position on the full preview, sharing the 9 anchors + X/Y path
  (007-A); cheap subset = click-to-select.
- **States & save:** header status chip names save state (dirty/saving/saved) left of a stay-put
  button; validated empty (0/3), cap (3/3 disabled + "Máximo 3"), no-video & Whisper-loading states
  (008-B).
- **Motion:** Calm 170ms ease-out-quart; two-tier timing (`--dur` state / `--dur2` travel); 5 motions
  cohere as one vocabulary; `prefers-reduced-motion` collapse required (009-A).
- **Render (frontier):** render on the dimmed preview (progress ring + 3-step pipeline → "Reel
  listo"), no modal; single-job constraint surfaced; OOM-aware failure (010-A).
- **Green-primary rule (ratified, context-dependent):** green = THE primary action of the current
  surface — `Render Video` when render is in play (Save demotes to secondary outline), `Guardar
  config` in the editing-only state. Never two greens at once. Reconciles 008-B ↔ 010-A.

## Palette / Tokens
Canonical token source: `.planning/sketches/themes/default.css` (also in the skill's
`sources/themes/default.css`). Canvas `oklch(0.18 0.035 275)` ~#1a1a2e · chrome ~#16213e · accent
`--accent` ~#90caf9 · action `--action` ~#4CAF50 · `--warning` amber · `--success` · `--danger`.
Type: Inter, `--t-2xs` 10.5px … `--t-2xl` 23px. Spacing `--s-1` 2px … `--s-16` 32px. Shape 4–12px.
Motion `--dur` 170ms / `--dur2` 300ms / `--ease` cubic-bezier(0.22, 1, 0.36, 1).
