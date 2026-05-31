---
sketch: 003
name: position-presets
question: "What should the shared 9-point position-preset affordance look like, and how does it sit next to the X/Y number inputs?"
winner: "B"
tags: [presets, position, shared-component, phase-22]
---

# Sketch 003: Position Presets (9-point grid)

## Design Question
Phase 22 (D-07/08/09) extracts a shared `PositionPresets` component for titles, overlays, and subtitles: a **9-point grid** (4 corners + 4 edge-centers + center) that pushes size-aware X/Y into the existing draft path. Math is computed against the **1080×1920** frame with a top-left anchor (e.g. bottom-right of a 400×120 element → X 680, Y 1800). What's the right affordance?

## How to View
open .planning/sketches/003-position-presets/index.html

## Variants
- **A: Grid of dots** — minimal 3×3 of dots; active point glows blue. Smallest footprint, sits inline with the X/Y row.
- **B: Arrow buttons** — 3×3 buttons with directional glyphs (↖ ↑ ↗ …). More explicit; reads well for corner-targeting logos/watermarks.
- **C: Mini-canvas drag** — a tiny 9:16 frame with a draggable element that snaps to the 9 anchors (or click a region to snap). Spatial and direct, taller footprint.

## Winner: B — rationale
Arrow buttons won over bare dots (A) and the mini-canvas (C): the directional glyph names the anchor at a glance, the 3×3 buttons are easy click targets, and the affordance reads clearly for corner-targeting logos/watermarks. It also stays compact enough to sit inside sketch 001-D's narrower Posición column (see the inline arrow grid in 001 variant D). The mini-canvas was the most spatial but too tall for the dense 2-column panel; dots were too ambiguous about direction.

## What to Look For
- Pick a preset / drag the element — the X/Y inputs flash and update (size-aware math is live). Do the resulting numbers read correctly?
- Which affordance is fastest to reach for "logo bottom-right" vs "title top-center"?
- Footprint: A and B sit beside the X/Y row; C needs its own block. Does C's spatial clarity justify the height?
- Will the chosen affordance feel right reused across Titles / Overlays / Subtitles (it replaces the existing 3-button subtitle presets)?
