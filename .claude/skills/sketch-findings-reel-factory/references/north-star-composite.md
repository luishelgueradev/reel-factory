# North-Star Composite & Scope Boundary

The **whole Phase 22 vision in one screen**, plus the explicit line between what the real build **ships
now** (committed editing surface) and the **frontier** that sketches 007 (drag-to-position) and 010
(render surface) flagged as scope-expanding. This is the capstone integration — read every other
reference first; this one only proves they cohere and names the plan-split boundary.

## Design Decisions

### A — the north star (sketch 015-A — winner): everything composed
The single screen the React redesign targets, with every validated decision in place at once:
- **013-B split-zone header** — chip left · Guardar + Render right, Render the only green.
- **001-D three-column shell** — content-sized 9:16 preview · controls (2 internal columns) · persistent
  ~320px metadata placeholder ("Próximamente").
- **Per-tab structure** — Títulos/Overlays list+form (004-A); Subtítulos textarea + specimen + mode
  cards + 2-col form (005-C / 011-C); the 012-B `TabLead`/`TabForm` skeleton holding them coherent.
- **007 drag-to-position on the preview** (frontier) — drag any element on the live preview; it snaps to
  the 9 anchors and **live-writes X/Y into the inspector inputs** (which flash to confirm), sharing the
  003 preset path. Direct manipulation is an *additional* affordance over the numeric/preset path, never
  a competing one.
- **010 render-on-stage** (frontier) — Render dims the preview and runs the 3-step pipeline → "Reel
  listo", no modal.

**Finding:** it coheres as one calm tool, not a stitched-together demo. The whole-screen view is also
the real test of **green discipline** — exactly one green at a time across editing *and* rendering
(Render owns it; Guardar never greens; the chip carries dirty).

### B — committed scope only: the honest "what we ship now" picture
Identical shell and editing surface, with the two frontier layers **removed**:
- **Render** is a disabled `Próximamente / Frontera` **ghost** button.
- The preview offers **click-to-select** (focus an element's controls) — the cheap 007 subset — instead
  of full drag.
- A **green scope banner** names the boundary.

### The scope line (the actual finding — why both screens exist)
The A↔B contrast turns "drag and render are frontier" from a prose caveat into something you can **see
and point at when splitting the plan**:
- **Both frontier layers (007 drag, 010 render) are clean, separable enhancement layers** on top of the
  committed surface. Removing them leaves B feeling **whole** — so the split is safe.
- **Plan-split rule: ship B first, add A's frontier layers later without rework.** The committed slice
  is the editing surface (shell · controls · metadata placeholder · click-to-select · Guardar). Drag and
  render bolt on afterward.

This is the boundary the real-build plan should cut along.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### Draggable preview elements + snap guides (007-A, composed)
```css
.el { position: absolute; z-index: 50; cursor: grab; user-select: none;
      outline: 1.5px solid transparent; outline-offset: 3px; border-radius: var(--r-xs);
      transition: outline-color var(--dur) var(--ease); }
.el.sel      { outline-color: var(--accent); }
.el.dragging { cursor: grabbing; outline-color: var(--accent-strong); }
.variant.scoped .el { cursor: pointer; }   /* committed-scope B: click-to-select only, no drag */

/* snap guides flash when the element locks to one of the 9 anchors */
.guide { position: absolute; z-index: 45; background: var(--accent); opacity: 0;
         pointer-events: none; transition: opacity 120ms var(--ease); }
.guide.vx { width: 1px; top: 0; bottom: 0; }
.guide.hy { height: 1px; left: 0; right: 0; }
.guide.show { opacity: 0.55; }
```

### Scope banner — committed (green) vs frontier (blue)
```css
.scope-note { display: flex; align-items: center; gap: var(--s-5); padding: var(--s-5) var(--s-6);
              margin-bottom: var(--s-8); border-radius: var(--r-sm); font-size: var(--t-xs); line-height: 1.5; }
.scope-note.committed { background: oklch(0.72 0.14 150 / 0.10); color: var(--text-2);
                        border: 1px solid oklch(0.72 0.14 150 / 0.3); }
.scope-note.frontier  { background: var(--accent-tint-2); color: var(--text-2);
                        border: 1px solid var(--accent-strong); }
.scope-note b { color: var(--text); font-weight: 600; }
```

## Interaction: drag ↔ inspector share one path (007-A, the core requirement)
```js
// dragging an element writes the SAME x/y model the numeric inputs + 9-point presets write
const ANCHORS = [/* 9 [x,y] anchor pairs in 0..1 preview space */];
function move(ev) {
  let px = clamp((ev.clientX - pr.left) / pr.width,  0.02, 0.98);
  let py = clamp((ev.clientY - pr.top)  / pr.height, 0.02, 0.98);
  // snap to nearest anchor when close — same anchors the preset grid uses
  for (const [ax, ay] of ANCHORS) {
    if (Math.abs(px-ax) < 0.05 && Math.abs(py-ay) < 0.05) { px = ax; py = ay; /* flash guides */ }
  }
  els[name] = { x: Math.round(px*1080), y: Math.round(py*1920) };  // 1080×1920 model space
  // live-write into the inspector inputs and flash them to confirm the shared path
  xi.value = els[name].x; flash(xi);
  yi.value = els[name].y; flash(yi);
}
```
Dragging starts on whichever tab owns the element (`{ title:'titles', logo:'overlays', caption:'subtitles' }`);
grabbing an element on another tab switches to its tab first. Disabled entirely while a render is running.

## What to Avoid
- **Don't ship A's frontier layers as part of the committed slice.** B is the planning boundary — build
  it first. A is the target, not the v1 scope.
- **Don't let drag and the numeric/preset inputs diverge into two code paths.** They must write the same
  X/Y model (the 007-A requirement); divergence is the failure mode this sketch exists to prevent.
- **Don't drag mid-render.** Direct manipulation is disabled while the single-job pipeline runs.
- **Don't treat the composite as a new design.** It introduces nothing — every token, component, and rule
  comes from sketches 001–014. If the composite needs something new, that's a gap in an upstream sketch.

## Origin
Synthesized from sketch 015 (north-star-composite, winner A; B kept as the committed-scope slice). Composes
013-B, 001-D, 004-A/005-C/011-C/012-B, plus frontier 007-A (`references/preview-direct-manipulation.md`)
and 010-A (`references/render-export-surface.md`). Source file in `sources/015-north-star-composite/`
(winner `#v-a`, marked ★ in the variant nav).
