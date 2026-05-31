# Sketch Wrap-Up Summary

**Date:** 2026-05-31
**Sketches processed:** 3
**Design areas:** Workspace Shell & Layout · Control Panel Density & Disclosure · Position Presets
**Skill output:** `./.claude/skills/sketch-findings-reel-factory/`

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | three-column-shell | D — content-sized preview + 2-col controls + persistent metadata | Workspace Shell & Layout |
| 002 | control-density-disclosure | A — always-open titled sections, Posición→Estilo→Avanzado | Control Panel Density & Disclosure |
| 003 | position-presets | B — 9 arrow-buttons, size-aware X/Y math | Position Presets (shared component) |

## Excluded Sketches
| # | Name | Reason |
|---|------|--------|
| — | — | None excluded — all three winners packaged |

## Design Direction
Phase 22 reshapes the Remotion Studio control surface into a dense, deliberate, professional control
panel (Linear/Figma/Raycast register) on the established dark indigo design system. A 3-column
workspace shell: content-sized 9:16 preview · controls that grow into two internal columns ·
persistent ~320px social-metadata placeholder ("Próximamente"). Color stays Restrained
(OKLCH-tuned tinted-indigo neutrals, no pure black/white) — blue reserved for selection/focus,
green reserved for the single primary action (`Guardar config`). The realized synthesis is sketch
001 variant D, which folds in 002-A's always-open sections and 003-B's arrow presets.

## Key Decisions
- **Layout:** 3-column shell. Preview content-sized (`flex:0 1 470px`) because the 9:16 phone is
  height-bounded and flex-growing it only padded empty space; freed width goes to the controls
  column (`flex:1 1 auto`), which lays each tab out in two internal columns. Metadata is a
  persistent, non-collapsing 320px placeholder — collapsing it reflowed the controls grid and read
  as a glitch. Real-build: collapse the controls' 2 internal columns to 1 below a width breakpoint.
- **Density / disclosure:** Always-open titled sections (Posición → Estilo → Avanzado) with numbered
  chips + hairline dividers. No collapse/accordion — the height cost is absorbed by the 2-column
  layout. "Avanzado" stays compact and visible at the bottom. Pattern is identical across Titles /
  Overlays / Subtitles.
- **Position presets:** Shared 9-point arrow-button grid (↖↑↗ / ←•→ / ↙↓↘). Size-aware math against
  the 1080×1920 frame with top-left anchor (e.g. 400×120 element bottom-right → X 680, Y 1800).
  Presets and manual entry write the same draft X/Y; inputs flash on apply. Compact `repeat(3,30px)`
  cells in-panel. Replaces the old 3-button subtitle presets.
- **Palette:** dark indigo system preserved (canvas #1a1a2e, chrome #16213e, accent #90caf9, action
  #4CAF50), re-tuned in OKLCH as design tokens in `themes/default.css`.
- **Typography:** single sans (Inter), fixed type scale 10.5–23px.
- **Spacing/shape/motion:** compact 2–32px rhythm, 4–12px radii, 150–250ms ease-out-quart motion.

## Open Questions
- Width breakpoint at which the controls' two internal columns collapse to one (real-build tuning).
- Whether the persistent metadata column's exact width (320px) holds once real AI-metadata content
  lands in a later phase.
