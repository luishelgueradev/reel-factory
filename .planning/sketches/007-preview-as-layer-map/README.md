---
sketch: 007
name: preview-as-layer-map
question: "Could the full-size live preview itself be a drag-to-position + layer-stack surface (overlays z-stacked vs text), instead of only the in-panel X/Y controls and presets?"
winner: "A"
tags: [frontier, preview, drag, layering, phase-22]
---

# Sketch 007: Preview as Layer Map

## Design Question
**Lateral / frontier — explicitly beyond what Phase 22 strictly requires.** The validated direction drives positioning and layering entirely from the *controls column* (numeric X/Y + 9-point presets in sketch 003, layer toggle in sketch 004). The mini-canvas drag affordance was rejected for the dense panel (003-C) *because it was too tall for the panel* — but the **full-size preview** has no such constraint.

So: should the preview double as the editing surface — drag elements directly, snap to the same 9 anchors, and see/manage z-order on the canvas — with the rail acting as inspector + layer stack? This probes whether direct manipulation is worth the extra implementation over the locked control-driven approach.

## How to View
open .planning/sketches/007-preview-as-layer-map/index.html

## Variants
- **A: Drag-to-position** — every element (title, subtitle, logo, watermark) is draggable on the phone. Dragging snaps to the **same 9 anchors** as the preset grid (blue guides appear on snap) and writes back to the X/Y inputs in the rail. The rail is a slim inspector + layer stack. Direct manipulation, presets become "snap targets."
- **B: Layer-map view** — the preview renders in an "exploded"/labeled mode: each element shows its **paint-order number** and the rail is a full layer stack (front → text band → back). Click a layer to select; use **Al fondo / Al frente** to restack. Emphasizes *understanding and managing depth* over positioning. (Toggle "Vista normal" to drop the map overlay.)

## Winner: A — rationale (scope-expanding)
**Drag-to-position adopted** — *not* parked. Direct manipulation on the full-size preview is worth
the extra build: dragging an element and snapping to the same 9 anchors is more tactile than typing
X/Y or clicking a preset, and it costs nothing in panel density because the preview already exists at
full size (the constraint that killed the mini-canvas in 003-C does not apply here). Crucially, drag
and the numeric inputs **share one path** — a drag writes the same X/Y the presets and manual entry
do, with the same flash confirmation — so it's an *additional* affordance, not a competing model.

This expands Phase 22's committed scope (which was control-driven only). Flag for planning: the drag
layer is an enhancement on top of the locked 003 presets + 004 layer list, and could be split into
its own slice if the phase gets heavy. The cheapest subset — **click-to-select an element on the
preview to focus its controls** — should ship even if full drag is deferred.

Layer-map view (B) was a nice teaching overlay but didn't beat the in-panel layer affordances of
sketch 004 for everyday use; keep its paint-order-number idea in reserve.

## What to Look For
- **Drag an element** (variant A) — does direct positioning feel better than typing X/Y or clicking a preset? Do the snap guides make the 9 anchors discoverable on the canvas?
- Does **dragging coexist** with the numeric inputs cleanly (both write the same X/Y), or does it create two competing mental models?
- The **layer-map numbers** (variant B): does seeing paint order *on the elements* make D-04 (array order = paint order) and D-03 (back/front) click faster than the in-panel list of sketch 004?
- **Scope honesty:** this is more interaction surface than Phase 22 committed to. Is the payoff worth it now, is it a *future* enhancement, or does the in-panel approach (003 presets + 004 layer list) already suffice? A valid outcome here is **"park it"** — the sketch exists to make that call deliberately, not by omission.
- If anything *is* adopted, the most likely candidate is the cheap win: click-to-select an element on the preview to focus its controls (without full drag).
