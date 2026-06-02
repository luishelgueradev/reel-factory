# PNG Overlay Acquisition (drop → preview → place)

**Phase 21 (png-overlays) is live.** The Overlays tab (`tab-patterns.md`, 019-C list-forward) was
sketched managing *existing* overlays — per-item width / opacity / Capa (Detrás/Delante) / 9-point anchor.
But the **acquisition moment** — drop or upload a PNG, see its **transparency** legibly, **place** it on
the 9:16 canvas, and the **empty→first-overlay** transition — was never its focus. This fills that gap,
honest about the real schema: overlays carry width / opacity / layer / 9-point anchor (003 presets),
**max 3** (the OOM-adjacent resource cap), and PNG transparency rendered as a **checkerboard** so a
transparent asset reads as transparent, not a black box.

The impeccable **"no modal-as-first-thought"** law shaped every variant: the file-picker-modal temptation
is reframed as an **inline** step, and the canvas-drop / inline-dropzone paths lead.

## Design Decisions

### B — drop the PNG directly onto the 9:16 canvas (winner): acquire = place
Drag a PNG **onto the stage**; it **lands where you drop it**, then appears in the 019-C list. **Acquire
and place are one gesture** — tied to the 007 drag-to-position frontier. Hovering the mini dropzone
**arms** the canvas drop target (a dashed accent zone with a "Soltá el PNG donde quieras" pill). For a
precise control tool, "lands where I drop it" beat "lands at a known anchor, then refine" (A/C's
separated model). Clicking the mini dropzone instead drops to the **center** as the pointer-free fallback.

### Transparency reads as transparency — the checkerboard (critical for Phase 21)
A PNG with alpha must **not** look like a black box. Transparency is rendered as a **checkerboard**, both
on the **list-card thumbnail** and as the **on-canvas backing** behind the placed overlay. At a glance a
transparent logo reads as transparent. This is the single most load-bearing visual decision of the
sketch — a logo with alpha that renders black would read as broken.

### The 3-overlay cap is calm, not an error
A `N/3` counter sits in the tab label; at **3/3** the dropzone **disables** (solid border, dimmed,
"Tope de 3 overlays alcanzado · borrá uno para agregar otro"). It matches the 008-B **cap state** — a
neutral limit, never a red error. The counter turns `--warning` (amber) at full, not danger.

### Empty→first transition teaches in place
Each variant **starts empty**. In B (and A) the tab's empty state **is** the acquisition affordance —
it teaches "drop a PNG here" without a separate onboarding step. After the first overlay, the dropzone
**shrinks to a mini "drop another"** affordance so the list leads. Adding lands the overlay on the stage
with a `landin` pop and slots a `cardin` card into the list.

### Flows into the 019-C list-forward cards (not bolted on)
The added cards **are** the list-forward overlay cards from 019-C — checkerboard thumb · mono filename ·
inline width / opacity / Capa segmented-control / 9-point `posmini` anchor grid. Acquisition flows *into*
the existing management surface; selecting a card highlights its overlay on the stage and vice-versa.

### Green discipline (the named test)
**Render stays the only green.** The dropzone, the `＋ Agregar` button, and the placement-confirm are all
**accent / outline**. **Delete is a quiet danger-on-hover** (the `✕` greys until hovered, then `--danger`)
— never a standing red button.

### A and C kept as fallbacks
- **A (dropzone in the tab)** — the build's *path of least resistance*: reuses 019-C cards + the 017
  dropzone; the empty Overlays tab is the dropzone, shrinking to mini after the first. Fully inline, no
  modal. Use if canvas-drop drag plumbing slips the Phase-21 budget.
- **C (`＋ Agregar` → inline placement bar)** — the most guided: a button picks the file, then an
  **inline placement bar** (position presets + "o arrastralo en el video" + Agregar/Cancelar) confirms
  before committing. **Deliberately not a modal** — the bar lives in the panel. Tests whether an explicit
  place-step helps a rarely-used feature or just adds friction; B's answer is that it adds friction.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### Checkerboard = PNG transparency (the load-bearing pattern)
```css
.checker {
  background-image:
    linear-gradient(45deg,  oklch(0.5 0.01 280) 25%, transparent 25%),
    linear-gradient(-45deg, oklch(0.5 0.01 280) 25%, transparent 25%),
    linear-gradient(45deg,  transparent 75%, oklch(0.5 0.01 280) 75%),
    linear-gradient(-45deg, transparent 75%, oklch(0.5 0.01 280) 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
  background-color: oklch(0.4 0.01 280);
}
/* applied to BOTH the list-card thumb AND the on-canvas overlay backing */
```

### B — the armed canvas drop target
```css
.canvasdrop { position:absolute; inset:var(--s-10); border:2px dashed transparent;
              border-radius:var(--r-md); display:grid; place-items:center;
              pointer-events:none; transition:all var(--dur) var(--ease); }
.canvasdrop.armed { border-color:var(--accent-strong); background:var(--accent-tint-2);
                    pointer-events:auto; }                 /* armed by hovering the mini dropzone */
.canvasdrop .cd { font-size:var(--t-sm); color:var(--accent); font-weight:600; background:var(--surface);
                  padding:6px 12px; border-radius:var(--r-full); border:1px solid var(--accent-strong); }

/* the placed overlay — lands with a pop, drag handle when selected */
.ov { position:absolute; animation:landin .34s var(--ease); cursor:grab; }
.ov.sel { outline:2px solid var(--accent); outline-offset:2px; }
.ov.handle::after { content:""; position:absolute; right:-4px; bottom:-4px; width:9px; height:9px;
                    background:var(--accent); border:1.5px solid var(--stage); border-radius:2px; }
@keyframes landin { 0%{ opacity:0; transform:scale(.82); } 60%{ transform:scale(1.04); } 100%{ opacity:1; transform:scale(1); } }
```

### The dropzone + its mini / disabled (cap) states
```css
.dropzone { border:2px dashed var(--border-strong); border-radius:var(--r-md);
            padding:var(--s-12) var(--s-8); text-align:center; cursor:pointer; }
.dropzone:hover, .dropzone.armed { border-color:var(--accent-strong); background:var(--accent-tint-2); }
.dropzone.mini { padding:var(--s-6); }                     /* shrinks after the first overlay */
.dropzone.disabled { opacity:.45; cursor:default; border-style:solid; }   /* 3/3 cap — calm, not error */

.tablabel .cap-count       { margin-left:auto; font-family:var(--mono); color:var(--text-faint); }
.tablabel .cap-count.full  { color:var(--warning); }       /* amber at 3/3, never danger */
```

### Delete = quiet danger-on-hover (never a standing red button)
```css
.ovcard .del        { background:none; border:none; color:var(--text-faint); }
.ovcard .del:hover  { color:var(--danger); background:var(--surface-2); }
```

## HTML Structures

### Winner B — arm-on-hover dropzone + canvas drop target
```html
<!-- the stage carries the (armed) drop target over the 9:16 preview -->
<div class="stage9x16" id="stage-b">
  …title · caption…
  <!-- each placed overlay: checkerboard backing so transparency reads -->
  <div class="ov checker sel handle" style="left:62%; top:8%; width:54px; …">🅡</div>
  <div class="canvasdrop" id="cdrop-b"><div class="cd">Soltá el PNG donde quieras</div></div>
</div>

<!-- the mini dropzone ARMS the canvas target on hover; click = drop to center -->
<div class="dropzone mini" onmouseenter="armCanvas(true)" onmouseleave="armCanvas(false)" onclick="acquireNext('b')">
  <div class="dt">⤓ Arrastrá un PNG <b>directo al video</b></div>
  <div class="dsub">cae donde lo soltás · o hacé clic para el centro</div>
</div>
```

### The 019-C list card the overlay flows into (checkerboard thumb + inline props)
```html
<div class="ovcard sel">
  <div class="top">
    <div class="thumb checker">🅡</div>                    <!-- transparency reads in the thumb -->
    <div><div class="nm">logo-marca.png</div><div class="meta">420×420 · PNG</div></div>
    <button class="del">✕</button>                          <!-- quiet danger-on-hover -->
  </div>
  <div class="inlinerow">
    <div class="miniprop"><label>Ancho</label><div class="v">216 px</div></div>
    <div class="miniprop"><label>Opacidad</label><div class="v">100%</div></div>
    <div class="miniprop"><label>Capa</label><div class="seg"><button>Detrás</button><button class="on">Delante</button></div></div>
    <div class="miniprop"><label>Posición</label><div class="posmini">…9-point anchor grid (003)…</div></div>
  </div>
</div>
```

## What to Avoid
- **Don't render PNG transparency as black** — the checkerboard (thumb + on-canvas backing) is
  non-negotiable for Phase 21; a logo with alpha must read as transparent at a glance.
- **Don't open a file-picker modal as the acquisition entry** — the impeccable no-modal law: drop onto
  the canvas (B), or an inline dropzone (A) / inline placement bar (C). The bar in C lives in the panel,
  not a dialog.
- **Don't dress the 3/3 cap as an error** — it's a calm limit (008-B cap state): dimmed disabled
  dropzone + amber counter, never red.
- **Don't separate acquire from place when precision matters** — B's "lands where you drop it" beat the
  drop-then-anchor model for a control tool; keep the gesture unified unless drag plumbing forces A.
- **Don't bolt acquisition onto a different surface** — the added cards *are* the 019-C list cards;
  acquisition flows into the existing Overlays management tab, not a separate uploader.
- **Don't give delete a standing red button** — quiet danger-on-hover only.

## Origin
Synthesized from sketch 039 (overlay-png-acquire, winner B — drop onto canvas / acquire = place; A =
dropzone in the tab, C = `＋ Agregar` → inline placement bar). Phase 21 (png-overlays). Flows into the
019-C list-forward Overlays tab (`tab-patterns.md`); uses the 003 9-point anchor presets and the 008-B
cap-state idiom; tied to the 007 drag-to-position frontier (`preview-direct-manipulation.md`). Source file
in `sources/039-overlay-png-acquire/` (winner `#v-b`, ★ in the variant nav; each variant starts empty,
↺ reiniciar returns to empty).
