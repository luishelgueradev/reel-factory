# Preview as Editing Surface (frontier — scope-expanding)

> ⚠️ **Scope flag.** This is a **frontier / lateral** finding (sketch 007). Phase 22's *committed*
> scope is **control-driven only** — positioning and layering happen entirely from the controls
> column (numeric X/Y + 9-point presets in `references/position-presets.md`, layer toggle in
> `references/tab-patterns.md`). Drag-to-position is an **enhancement on top** of that locked
> approach, not a replacement. Adopt it as an additional affordance; **split it into its own slice if
> the phase gets heavy.** The cheapest subset (click-to-select) should ship even if full drag is
> deferred.

## Design Decisions

### Drag-to-position on the full preview (sketch 007-A — adopted, not parked)
The mini-canvas drag affordance was rejected for the *dense panel* (sketch 003-C) **because it was
too tall for the panel** — but the **full-size preview has no such constraint**. So the preview
doubles as the editing surface:

- **Every element (title, subtitle, logo, watermark) is draggable** directly on the phone.
- **Dragging snaps to the same 9 anchors** as the preset grid; blue snap guides appear on snap. The
  preview's presets become "snap targets" — one consistent positioning model.
- **One shared X/Y path — this is the critical constraint.** A drag writes the **same** draft X/Y
  that the 9-point presets and manual numeric entry write, with the **same flash confirmation**. Drag
  is an *additional* affordance, **not a competing mental model**. There is exactly one source of
  truth for position; three ways to set it (drag, preset, type).
- The controls rail acts as **inspector + layer stack** alongside the canvas.

### Why it's worth the extra build
Dragging-and-snapping is more tactile than typing X/Y or clicking a preset, and it **costs nothing in
panel density** because the preview already exists at full size. The only reason it's flagged rather
than locked is **scope honesty**: it expands what Phase 22 committed to.

### The cheap subset (ship-even-if-deferred)
**Click-to-select an element on the preview to focus its controls** (no full drag). This is the
minimum direct-manipulation win and should ship regardless — it's the cheap half of "the preview is
also an editing surface."

### Rejected: layer-map "exploded" view (007-B)
A teaching overlay that renders each element with its **paint-order number** and an exploded/labeled
mode, with the rail as a full front → text-band → back stack. A nice way to *understand* depth, but it
didn't beat the in-panel layer affordances of sketch 004 (the Detrás/Delante badge + drag-reorder
list) for everyday use. **Keep the paint-order-number idea in reserve** for a future "explain depth"
mode — don't build it now.

## CSS Patterns

### Draggable elements + selection
```css
.el { position: absolute; cursor: grab; outline: 1.5px dashed transparent; outline-offset: 3px;
      transition: outline-color var(--dur) var(--ease); }
.el:hover    { outline-color: oklch(0.82 0.095 242 / 0.4); }   /* faint accent on hover = "draggable" */
.el.sel      { outline: 1.5px solid var(--accent); cursor: grabbing; }
.el.dragging { outline-style: solid; }

/* selected element shows a layer/depth chip above it */
.el .tag-chip { position: absolute; top: -22px; left: 0; background: var(--accent); color: var(--stage);
                font-size: var(--t-2xs); font-weight: 700; padding: 2px 7px; border-radius: var(--r-xs);
                display: none; white-space: nowrap; }
.el.sel .tag-chip { display: block; }
```

### Snap guides (appear only while snapped to an anchor)
```css
.guide { position: absolute; background: var(--accent); opacity: 0; pointer-events: none;
         z-index: 200; transition: opacity 90ms; }
.guide.vx { width: 1px; top: 0; bottom: 0; }   /* vertical center/edge guide */
.guide.hy { height: 1px; left: 0; right: 0; }  /* horizontal center/edge guide */
.guide.show { opacity: 0.5; }
```

### Layer-map paint-order badge (007-B — held in reserve, not for the default view)
```css
.znum { position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; border-radius: 50%;
        background: var(--accent); color: var(--stage); font-size: 11px; font-weight: 800;
        display: none; place-items: center; }   /* shown only in exploded/"Vista mapa" mode */
.phone.exploded .el { box-shadow: 0 8px 24px oklch(0.08 0.02 280 / 0.6); }
```

## Interaction Logic (the shared-X/Y path)

The drag handler clamps to the frame, snaps to the 9 anchors within a ~45 frame-unit threshold, and
**writes the same X/Y the inputs use** — live, during the drag. Frame is 1080×1920 with a top-left
anchor (same math as `position-presets.md`):

```js
// 9 snap anchors = {start, centered, end} on each axis, accounting for element size
const ax = [0, (FRAME_W - e.w) / 2, FRAME_W - e.w];
const ay = [0, (FRAME_H - e.h) / 2, FRAME_H - e.h];

function onDragMove(m, e, node, rect) {
  const dx = (m.clientX - sx) / rect.width  * FRAME_W;
  const dy = (m.clientY - sy) / rect.height * FRAME_H;
  let nx = Math.max(0, Math.min(FRAME_W - e.w, ox + dx));
  let ny = Math.max(0, Math.min(FRAME_H - e.h, oy + dy));
  let snapX = null, snapY = null;
  ax.forEach(a => { if (Math.abs(nx - a) < 45) { nx = a; snapX = a; } });
  ay.forEach(a => { if (Math.abs(ny - a) < 45) { ny = a; snapY = a; } });
  e.x = nx; e.y = ny;                               // same draft state presets/typing mutate
  node.style.left = (nx / FRAME_W * 100) + '%';
  node.style.top  = (ny / FRAME_H * 100) + '%';
  guideX.classList.toggle('show', snapX !== null);  // guides only while snapped
  guideY.classList.toggle('show', snapY !== null);
  inputX.value = Math.round(nx);                    // ← write back to the SAME numeric inputs
  inputY.value = Math.round(ny);
}
```

Use Pointer Events (`pointerdown` / `pointermove` / `pointerup` + `setPointerCapture`), re-grab the
node after any re-render, and release guides on `pointerup`.

## What to Avoid
- **Don't let drag become a second source of truth for position.** It must write the same draft X/Y
  as presets and manual entry — one path, three affordances. A separate drag-only position model is
  the failure mode.
- **Don't build the layer-map exploded view (007-B) for daily use** — the in-panel Detrás/Delante
  badge + drag-reorder list (sketch 004) already covers depth management. Reserve 007-B's
  paint-order numbers for a future explain-depth toggle.
- **Don't block on full drag.** If the phase gets heavy, ship click-to-select (focus controls) and
  defer dragging — the snap math and shared-X/Y path are the same when it lands later.

## Origin
Synthesized from sketch 007 (preview as layer map, winner A — drag-to-position, scope-expanding).
Source file in `sources/007-preview-as-layer-map/` (winner ★ `#v-a`; variant B is the held-in-reserve
layer-map view).
