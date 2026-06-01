---
sketch: 015
name: north-star-composite
question: "Does the whole Phase 22 vision hold together in one screen — shell + all three real tabs + drag-on-preview + render + save + metadata — and where exactly is the line between the committed editing surface and the scope-expanding frontier?"
winner: "A"
tags: [frontier, composite, north-star, integration, scope, phase-22]
---

# Sketch 015: North-Star Composite

## Design Question
Sketches 001–014 each proved one decision in isolation or in a small integration. None ever drew the
**whole thing at once**. Before the React redesign starts, it's worth one composite — the screen the
real build aims at — and, just as important, an explicit line around **what Phase 22 actually plans to
ship now** versus the **frontier** that sketches 007 (drag-to-position) and 010 (render surface)
flagged as scope-expanding.

So this sketch is two screens that share every token and pattern, differing only in scope:
the **north star** (everything) and the **committed slice** (editing surface only). The contrast
*is* the finding — it turns "drag and render are frontier" from a prose caveat into something you can
see and point at when splitting the plan.

## How to View
open .planning/sketches/015-north-star-composite/index.html

**Try it (A):** switch tabs (Títulos / Overlays / Subtítulos); **drag any element on the preview** — it
snaps to the 9 anchors (blue guides flash) and live-writes X/Y into the inspector inputs (which flash
to confirm, sharing the 003 preset path). Click **Render Video** to run the 3-step pipeline on the
dimmed stage → "Reel listo". **(B):** the same shell, but Render is a disabled `Frontera` ghost and the
preview is **click-to-select only** (the cheap 007 subset), with a green banner marking the committed
boundary.

## Variants
- **A ★ (winner — north star): Everything composed** — the full realized vision. 013-B split-
  zone header (chip left · Guardar + Render right, Render the only green), 001-D three-column shell,
  per-tab structure (Títulos/Overlays list+form, Subtítulos textarea + specimen + mode cards + 2-col
  form), **007 drag-to-position on the preview**, **010 render-on-stage**, persistent metadata
  placeholder. The single screen the build targets.
- **B: Committed scope only** — identical shell and editing surface, but the two frontier layers are
  removed: Render is a `Próximamente / Frontera` ghost, and the preview offers only **click-to-select**
  (focus an element's controls) instead of full drag. A green scope banner names the boundary. This is
  the honest "what we're planning *now*" picture.

## What to Look For
- **Does it cohere as one tool?** Switch all three tabs in A. Header, sections, lists, specimen, and the
  preview should read as one calm Linear/Figma-grade surface, not a stitched-together demo.
- **The scope line.** Flip A ↔ B. Is the frontier (drag + render) a clean, separable enhancement layer
  on top of the committed surface — i.e. can the plan ship B first and add A's layers later without
  rework? If removing them leaves B feeling whole, the split is safe.
- **Drag ↔ inputs share one path (A).** Drag the title; watch X/Y flash and update in the inspector.
  Does direct manipulation feel like an *additional* affordance over the numeric/preset path, not a
  competing one (the 007-A requirement)?
- **Green discipline end to end.** Confirm exactly one green at a time across editing and rendering
  (Render owns it; Guardar never greens; the chip carries dirty). The whole-screen view is the real
  test of the color rule.
