# Direct-Manipulation Canvas — The Complete On-Canvas Editing Model

Sketch 007 proved **drag-to-position** and 039 proved **PNG-drop-on-canvas** — but as *pieces*. The
complete on-canvas interaction model was never drawn as one thing: selection, resize handles, snap
guides, selecting an element *under* another, reading/changing z-order *from* the canvas, deselect.
Sketch 042 is the highest-leverage deferred frontier — the "preview is also an editing surface"
promise (007-A) **fully realized** — grounded in the real schema: title (`x`/`y` px), PNG overlay
(`x`/`y`, `displayWidth`, `layer`), caption (anchored, full-width).

⚠️ **Scope-expanding.** Beyond the committed control-driven scope; this is the realized version of the
007 drag frontier (`preview-direct-manipulation.md`). The cheap committed subset stays click-to-select.

## Design Decisions

### Winner 042-C — hybrid: direct where direct wins, guided where the anchor system governs
The complete model is **not** "make the canvas a full design tool." It's a deliberate split that
preserves the established **"global places / panel refines"** division (020-C, 022-B, 025-C) while
adding the *one* direct affordance the panel genuinely does worse:
- **Resize = on-canvas handles.** Corner handles on the selected PNG resize it directly. This is the one
  thing a panel slider does *worst* — you want to drag the size while watching it against the frame.
- **Position = drag, snapping to the 9 anchors** (the shared X/Y path everything else already uses).
  Dragging shows the **9-anchor field** + a snap **guide** when within ~18px of an anchor; the position
  stays governed by the same anchor system as the in-panel preset grid (003-B). Free-floating numeric
  X/Y stays in sync (px → 1080×1920 at **×4**).
- **Overlap = on-canvas layer-chip stack.** When title + PNG overlap, a small **chip stack** appears
  on-canvas so you can pick the element *underneath* (the one thing pure drag can't do — you can't click
  what's covered). The chip shows current selection in accent.

### Why C beat the alternatives
- **vs A (Figma-style bounding box + 8 handles + edge/center guides against other elements):** the full
  design-tool idiom is **more surface than a dense control panel needs**. Resize is the only thing worth
  the handle chrome; full box-transform + element-to-element guides over-builds for a 3-element canvas.
- **vs B (anchor-snap on canvas + size/layer in panel):** the *most consistent* with "global places /
  panel refines" — but resize stays **indirect** (a slider), which is precisely the operation the canvas
  does better. B keeps the title/caption story clean but loses the one direct win.
- **C takes B's position discipline + A's resize handles + adds the layer-chip for overlap** — direct
  where direct wins (size, layer-pick), guided where the 9-anchor system already governs (position).

### What stays anchored vs free
- **Title & PNG:** drag to move (snaps to 9 anchors), resize via handles (PNG only — title size lives in
  the panel as type size). Numeric X/Y mirrors the drag.
- **Caption/subtitles:** **not** free-dragged — it's anchored to the bottom edge, full-width; position is
  an offset, consistent with how captions render. The canvas selects it (ring) but doesn't free-move it.

### Selection treatment by element
- Selected element gets a **boxed outline + corner handles** (resize-capable: PNG) or a **ring** (move
  /select-only: caption). A small **badge** names the element above it on selection.

## CSS / HTML Patterns

All patterns use the shared tokens in `sources/themes/default.css`. **Canvas px → render px is ×4**
(270×480 canvas → 1080×1920 output) — the drag writes the same `x`/`y` the panel uses.

### The canvas, elements, and selection treatments
```css
.canvas        { width:270px; height:480px; border-radius:var(--r-md); position:relative; overflow:hidden;
                 background:linear-gradient(180deg, oklch(0.36 0.05 250), oklch(0.19 0.03 280)); box-shadow:var(--shadow-md); }
.el            { position:absolute; cursor:grab; } .el:active { cursor:grabbing; }
.el.sel.boxed  { outline:1.5px solid var(--accent); outline-offset:2px; }   /* resize-capable */
.el.sel.ringed { outline:2px solid var(--accent); outline-offset:3px; border-radius:7px; }  /* select/move only (caption) */
.handle        { position:absolute; width:9px; height:9px; background:var(--surface);
                 border:1.5px solid var(--accent); border-radius:2px; z-index:6; }
.handle.nw{left:-6px;top:-6px;cursor:nwse-resize} .handle.se{right:-6px;bottom:-6px;cursor:nwse-resize}
.handle.ne{right:-6px;top:-6px;cursor:nesw-resize} .handle.sw{left:-6px;bottom:-6px;cursor:nesw-resize}
```

### The 9-anchor field + snap guides (shows while dragging)
```css
.anchor          { position:absolute; width:7px; height:7px; border-radius:50%; border:1px solid var(--accent);
                   transform:translate(-50%,-50%); opacity:0; transition:opacity .12s; pointer-events:none; z-index:3; }
.canvas.snapping .anchor { opacity:.35; }                                   /* reveal anchors during a drag */
.anchor.hot      { opacity:1; background:var(--accent); box-shadow:0 0 0 4px var(--accent-tint); }  /* the engaged anchor */
.guide           { position:absolute; background:var(--accent); opacity:.85; z-index:4; pointer-events:none; }
.guide.v{width:1px;top:0;bottom:0} .guide.h{height:1px;left:0;right:0}
```

### The on-canvas layer-chip stack (overlap → pick the element underneath)
```css
.layerchip     { position:absolute; top:6px; right:6px; display:flex; flex-direction:column; gap:3px; z-index:7; }
.layerchip .lc { width:22px; height:18px; border-radius:4px; background:oklch(0.2 0.02 280 / .85);
                 border:1px solid var(--border-strong); font-size:9px; color:var(--text-2);
                 display:grid; place-items:center; cursor:pointer; }
.layerchip .lc.cur { border-color:var(--accent); color:var(--accent); }    /* current selection */
```
```js
// only show the chip stack when two elements actually overlap
if (rectsOverlap(els.title, els.png)) renderLayerChips();  // pick PNG (front) or Título (back)
```

### Drag-with-anchor-snap (the move handler — snap within 18px, write x/y)
```js
const ANCHORS = [ {n:'↖',x:.12,y:.1},{n:'↑',x:.5,y:.1},{n:'↗',x:.88,y:.1},
                  {n:'←',x:.12,y:.5},{n:'•',x:.5,y:.5},{n:'→',x:.88,y:.5},
                  {n:'↙',x:.12,y:.9},{n:'↓',x:.5,y:.9},{n:'↘',x:.88,y:.9} ];
// on mousemove (move mode): clamp to canvas, then snap center to nearest anchor within 18px
let cx = nx + ew/2, cy = ny + eh/2, hot = -1, gx = null, gy = null;
ANCHORS.forEach((a,i) => { const ax=a.x*270, ay=a.y*480;
  if (Math.abs(cx-ax)<18 && Math.abs(cy-ay)<18){ hot=i; nx=ax-ew/2; ny=ay-eh/2; gx=ax; gy=ay; } });
el.x = nx; el.y = ny;  // x/y are the SAME values the panel's X/Y field and preset grid write
// resize mode (handles): el.size = clamp(start + corner-delta, 30, 120)
```

## What to Avoid
- **Don't build the full Figma box-transform** (042-A) — only **resize** earns on-canvas handles; the rest
  is over-chrome for a 3-element dense panel.
- **Don't make resize a panel slider** (042-B) — resize is the one operation the canvas does better.
- **Don't free-drag the caption** — it's bottom-anchored, full-width; position is an offset.
- **Don't let drag and the numeric X/Y diverge** — they're the same truth (px → 1080×1920 at ×4).
- **Don't snap to arbitrary positions** — snap to the **9 anchors** (the shared system); skip
  element-to-element edge/center guides unless they clearly earn their keep (A-only, deferred).
- **Don't make covered elements unselectable** — the layer-chip stack is how you reach the one underneath.

## Origin
Synthesized from sketch 042 (direct-manipulation-canvas, winner **C** — hybrid: handles for size + 9-anchor
snap for position + on-canvas layer chips for overlap; A = full Figma box+handles over-builds, B =
anchors + size-in-panel keeps resize indirect). The realized version of the 007 drag frontier
(`preview-direct-manipulation.md`), composed with 039's PNG-on-canvas (`overlay-png-acquire.md`) and
the shared 9-anchor system (`position-presets.md`); preserves the "global places / panel refines"
division of `timeline-temporal.md` (020-C), `title-styling.md` (022-B), `caption-animation-preview.md`
(025-C). Source file in `sources/042-direct-manipulation-canvas/` (winner `#v-c`).
