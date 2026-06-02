---
sketch: 042
name: direct-manipulation-canvas
question: "What is the complete on-canvas editing model — select/move/resize handles, snap guides, z-order, overlapping elements, deselect — drawn as one thing?"
winner: "C"
tags: [frontier, preview, drag, direct-manipulation, canvas, scope-expanding]
---

# Sketch 042: Direct-Manipulation Canvas

## Design Question
Sketch 007 proved drag-to-position and 039 proved PNG-drop-on-canvas — but as *pieces*. The complete
on-canvas interaction model was never drawn as one thing: selection handles, resize handles, snap
guides, selecting an element under another, reading/changing z-order *from* the canvas,
deselect/multi-select. This is the highest-leverage deferred frontier — the "preview is also an
editing surface" promise (007-A), fully realized. Grounded in the real schema: title (x/y px), PNG
overlay (x/y, displayWidth, layer), caption (anchored, full-width).

## How to View
open .planning/sketches/042-direct-manipulation-canvas/index.html
→ **Drag the elements** on the 9:16 canvas; click to select; in A/C drag the corner **handles** to
resize the PNG; tap a **9-point preset** cell to snap; in C, when title + PNG overlap, use the
on-canvas **layer chips**.

## Variants
- **A: Figma-style bounding box + handles** — click selects (blue box + 8 resize handles), drag moves, handles resize, snap guides to the 9 anchors. The full design-tool idiom. Powerful, but more surface than a dense control panel needs.
- **B: Anchor-snap + size-in-panel** — the canvas does *placement* (drag snapping to the 9 anchors, selection ring, no handles); the panel does *size + layer*. Same division of labor as 020/022/025: "the global places, the panel refines."
- **C: Hybrid** — handles for *size* (what the panel does worst) but position still snaps to the 9 anchors with guides; overlapping elements get an on-canvas **layer-chip stack**. Direct where direct wins (size, layer-pick), guided where the 9-anchor system already governs (position).

## What to Look For
- Does free-drag resize (A/C handles) actually beat a size slider, or just add chrome? Resize is the one thing the panel genuinely does worse.
- The established direction is "global places / panel refines" (020-C, 022-B, 025-C) — does B's panel-resize feel *consistent* or *indirect*?
- Overlapping title + PNG: how do you select the one *underneath*? (C's layer chips vs A's click-through vs B's tab-to-cycle.)
- Snap feel: is snapping to the 9 anchors enough, or do you want edge/center guides against *other elements* too (A only)?
- Does the X/Y numeric field stay in sync and feel like the same truth as the drag? (px → 1080×1920 at ×4.)
- Likely synthesis: **C** — direct handles for size + the shared 9-anchor snap for position + on-canvas layer chips for overlap.
