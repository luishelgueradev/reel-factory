# Position Presets (shared 9-point component)

A reusable `PositionPresets` affordance for Titles, Overlays, and Subtitles: a 9-point grid (4
corners + 4 edge-centers + center) that pushes **size-aware** X/Y into the existing draft path.
Replaces the old 3-button subtitle presets. Validated in sketch 003 (winner **B**), Phase 22
decisions D-07 / D-08 / D-09.

## Design Decisions

### Arrow buttons — NOT bare dots, NOT a mini-canvas
A 3×3 grid of buttons with directional glyphs (`↖ ↑ ↗ / ← • → / ↙ ↓ ↘`).

- **B (arrow buttons) won** — the glyph names the anchor at a glance, the buttons are easy click
  targets, and it reads clearly for corner-targeting logos/watermarks.
- **A (bare dots)** was too ambiguous about direction.
- **C (mini-canvas drag)** was the most spatial but **too tall** for the dense 2-column panel.

Compactness matters: B sits inline beside the X/Y row inside sketch 001-D's narrower Posición column.
In the real shell it renders even smaller — `repeat(3, 30px)` cells (see `.pgrid` in 001-D) vs the
40px standalone cells in sketch 003.

### Size-aware math against the 1080×1920 frame, top-left anchor
The preset computes the element's **top-left** position so the element lands at the chosen anchor —
accounting for the element's own width/height. Frame is the real composition `1080×1920`.

```
cols:  left = 0            center = (FRAME_W - EL_W)/2     right  = FRAME_W - EL_W
rows:  top  = 0            middle = (FRAME_H - EL_H)/2     bottom = FRAME_H - EL_H
```

Worked example from the sketch: a 400×120 element, bottom-right anchor → **X 680, Y 1800**
(`1080-400=680`, `1920-120=1800`). Center → X 340, Y 900.

Picking a preset writes X/Y into the same draft inputs the user can still edit by hand; the inputs
**flash** (brief accent ring) to confirm the update. Presets and manual entry share one path.

## CSS Patterns

```css
/* Compact in-panel grid (real-build size, from sketch 001-D) */
.pgrid        { display: inline-grid; grid-template-columns: repeat(3, 30px);
                grid-auto-rows: 30px; gap: 3px; margin-top: var(--s-6); }
.pgrid button { border: 1px solid var(--border); background: var(--surface);
                color: var(--text-muted); border-radius: var(--r-xs); cursor: pointer;
                font-size: 13px; display: grid; place-items: center;
                transition: background var(--dur) var(--ease),
                            color var(--dur) var(--ease), border-color var(--dur) var(--ease); }
.pgrid button:hover { background: var(--surface-2); color: var(--text);
                      border-color: var(--border-strong); }
.pgrid button.on    { background: var(--accent-tint); border-color: var(--accent-strong);
                      color: var(--accent); }      /* active anchor = blue, exactly one */

/* Standalone size (sketch 003, 40px cells) — use when not space-constrained */
.grid         { display: inline-grid; grid-template-columns: repeat(3, 40px);
                grid-auto-rows: 40px; gap: 4px; }

/* X/Y inputs flash on preset apply */
.inp.flash { animation: flash 0.5s var(--ease); }
@keyframes flash { 0% { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-tint); }
                   100% {} }
```

## HTML + JS (the size-aware core)

```html
<div class="two">
  <div class="field"><span class="mini">X</span><input class="inp ix" value="540"></div>
  <div class="field"><span class="mini">Y</span><input class="inp iy" value="220"></div>
</div>
<div class="pgrid">
  <button>↖</button><button class="on">↑</button><button>↗</button>
  <button>←</button><button>•</button><button>→</button>
  <button>↙</button><button>↓</button><button>↘</button>
</div>
```

```js
// Size-aware anchor math — element top-left so it lands at the chosen anchor
const XS = { l: 0, c: (FRAME_W - EL_W)/2, r: FRAME_W - EL_W };
const YS = { t: 0, m: (FRAME_H - EL_H)/2, b: FRAME_H - EL_H };
function coords(id) {                 // id like 'b-r' (row-col)
  const row = id[0], col = id[2];
  const x = col === 'l' ? XS.l : col === 'c' ? XS.c : XS.r;
  const y = row === 't' ? YS.t : row === 'm' ? YS.m : YS.b;
  return [Math.round(x), Math.round(y)];
}
// on click: set .ix/.iy values, re-trigger the .flash animation, mark this button .on
```

The 9 points map row×col: `t/m/b` × `l/c/r`. Glyph table:
`t-l ↖ · t-c ↑ · t-r ↗ / m-l ← · m-c • · m-r → / b-l ↙ · b-c ↓ · b-r ↘`.

## What to Avoid
- **Bare dots** — ambiguous about which direction/anchor each represents.
- **Mini-canvas drag** — spatially nice but too tall for the dense 2-column Posición column. (Keep
  it in mind only if a future full-width position editor is ever needed.)
- **Frame-relative math that ignores element size** — anchor must account for `EL_W/EL_H` so the
  element edge (not its top-left origin) lands on the frame edge.
- **A separate code path for presets vs manual entry** — both write the same draft X/Y; the flash is
  the shared confirmation.
- **Hardcoding 1080×1920 / element size in multiple places** — extract one shared `PositionPresets`
  component used by all three tabs.

## Origin
Synthesized from sketch **003-position-presets** (winner B); compact real-build sizing taken from the
`.pgrid` integration in sketch 001-D.
Sources: `sources/003-position-presets/index.html` (variant `#v-b`),
`sources/001-three-column-shell/index.html` (`.pgrid`).
