# Sketch Wrap-Up Summary

**Dates:** 2026-05-31 (sketches 001–003), 2026-05-31 (sketches 004–007 — appended)
**Sketches processed:** 7
**Design areas:** Workspace Shell & Layout · Control Panel Density & Disclosure · Position Presets ·
Per-Tab Structure & Coherence · Preview as Editing Surface (frontier)
**Skill output:** `./.claude/skills/sketch-findings-reel-factory/`

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | three-column-shell | D — content-sized preview + 2-col controls + persistent metadata | Workspace Shell & Layout |
| 002 | control-density-disclosure | A — always-open titled sections, Posición→Estilo→Avanzado | Control Panel Density & Disclosure |
| 003 | position-presets | B — 9 arrow-buttons, size-aware X/Y math | Position Presets (shared component) |
| 004 | overlay-list-and-layering | A — overlay list + detail form; Detrás/Delante toggle (D-03), drag-reorder paint order (D-04), cap 3 | Per-Tab Structure & Coherence |
| 005 | subtitles-tab-restructure | C — condensed/expanding sample-text textarea at top of Subtitles (D-10) | Per-Tab Structure & Coherence |
| 006 | all-three-tabs-coherence | A — lists + textarea full-width, form always 2-col; B = responsive single-column collapse | Per-Tab Structure & Coherence |
| 007 | preview-as-layer-map | A — drag-to-position on the full preview, snap to 9 anchors, shared X/Y path (scope-expanding) | Preview as Editing Surface (frontier) |

## Excluded Sketches
| # | Name | Reason |
|---|------|--------|
| — | — | None excluded — all seven winners packaged (007 flagged as frontier/scope-expanding) |

## Design Direction
Phase 22 reshapes the Remotion Studio control surface into a dense, deliberate, professional control
panel (Linear/Figma/Raycast register) on the established dark indigo design system. A 3-column
workspace shell: content-sized 9:16 preview · controls that grow into two internal columns ·
persistent ~320px social-metadata placeholder ("Próximamente"). Color stays Restrained (OKLCH-tuned
tinted-indigo neutrals, no pure black/white) — blue reserved for selection/focus, green reserved for
the single primary action (`Guardar config`). The realized synthesis is sketch 001 variant D, which
folds in 002-A's always-open sections and 003-B's arrow presets.

The second sketch pass (004–007) resolved per-tab structure and the cross-tab coherence rule, then
probed one frontier interaction:
- **Coherence rule (006-A):** lists (Titles/Overlays) and the Subtitles sample-text textarea span
  full width; the Posición→Estilo→Avanzado form is always the 001-D two-column grid, collapsing to
  one column under a width breakpoint (006-B, the documented responsive degrade).
- **Overlays (004-A):** list + detail form. Card list at top (drag-handle reorder = paint order,
  D-04; Detrás/Delante badge), shared form below with the `Capa` segmented in Estilo (D-03, default
  `back`), capped at 3. Back overlays dim in the preview only, never in the export.
- **Subtitles (005-C):** condensed single-line sample-text textarea (D-10) that expands on focus;
  "no se exporta" cue keeps its role legible.
- **Preview as editing surface (007-A, frontier):** drag elements directly on the full preview,
  snapping to the same 9 anchors and writing the same X/Y path the presets/inputs do. Adopted as a
  scope-expanding enhancement on top of the locked control-driven approach; cheap subset is
  click-to-select. Split into its own slice if the phase gets heavy.

## Key Decisions
- **Layout:** 3-column shell. Preview content-sized (`flex:0 1 470px`) because the 9:16 phone is
  height-bounded and flex-growing it only padded empty space; freed width goes to the controls
  column (`flex:1 1 auto`), which lays each tab out in two internal columns. Metadata is a
  persistent, non-collapsing 320px placeholder — collapsing it reflowed the controls grid and read
  as a glitch. Real-build: collapse the controls' 2 internal columns to 1 below a width breakpoint.
- **Density / disclosure:** Always-open titled sections (Posición → Estilo → Avanzado) with numbered
  chips + hairline dividers. No collapse/accordion — the height cost is absorbed by the 2-column
  layout. Pattern is identical across Titles / Overlays / Subtitles (confirmed by 006).
- **Position presets:** Shared 9-point arrow-button grid (↖↑↗ / ←•→ / ↙↓↘). Size-aware math against
  the 1080×1920 frame, top-left anchor. Presets and manual entry write the same draft X/Y; inputs
  flash on apply. Compact `repeat(3,30px)` cells in-panel.
- **Per-tab structure:** Titles & Overlays = list + detail form (004-A); Subtitles = condensed
  textarea + form (005-C). Coherence rule: full-width lists/textarea, always-2-col form (006-A).
- **Overlay layering:** new `layer: "back" | "front"` field (default `back`, D-03) via a segmented
  control in Estilo; array order = paint order via drag-reorder (D-04); cap 3; back-overlay dim is a
  preview-only legibility cue.
- **Direct manipulation (frontier):** drag-to-position shares one X/Y path with presets + numeric
  entry (one source of truth, three affordances); snaps to the same 9 anchors with blue guides.
  Layer-map exploded view (007-B) parked, its paint-order numbers held in reserve.
- **Palette:** dark indigo system preserved (canvas #1a1a2e, chrome #16213e, accent #90caf9, action
  #4CAF50), re-tuned in OKLCH as design tokens in `themes/default.css`.
- **Typography:** single sans (Inter), fixed type scale 10.5–23px.
- **Spacing/shape/motion:** compact 2–32px rhythm, 4–12px radii, 150–250ms ease-out-quart motion.

## Open Questions
- Width breakpoint at which the controls' two internal columns collapse to one (real-build tuning).
- Whether the persistent metadata column's exact width (320px) holds once real AI-metadata content
  lands in a later phase.
- Whether full drag-to-position (007-A) ships in Phase 22 or is split into a follow-on slice; the
  click-to-select subset should ship regardless.
- Whether the Titles tab's list (count 2) reads as expected, given users may anticipate a single
  title (flagged in 006).
