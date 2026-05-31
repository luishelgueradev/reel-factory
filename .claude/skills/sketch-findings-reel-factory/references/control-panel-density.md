# Control Panel Density & Disclosure

How controls group, order, and disclose *inside* a single tab (Titles / Overlays / Subtitles) so the
panel reads as a deliberate Linear/Figma-grade control surface, not stacked inline forms. Validated
in sketch 002 (winner **A**), composed with the 2-column shell from sketch 001.

## Design Decisions

### Always-open titled sections — NOT collapsible, NOT accordion
Each tab orders its controls **Posición → Estilo → Avanzado**, every section open. Numbered section
headers (`1 Posición · 2 Estilo · 3 Avanzado`) with hairline dividers and uppercase micro-labels give
the "deliberate panel" read **without any disclosure machinery**.

- **A (always-open) won** — fastest scan, zero clicks to reach any control.
- **B (collapsible per-section)** and **C (accordion, one open)** traded scanability for saved
  height — height we no longer need to save, because sketch 001-D distributes sections across **two
  internal columns**. The collapsed-summary line + dirty-dot in B were judged "noise" for this panel.

This is the core `impeccable` decision of Phase 22 (D-06, D-11). The height cost of showing
everything is paid by the 2-column layout, not by hiding controls.

### "Avanzado" stays compact at the bottom
Rarely-used controls (background radius, appear delay, duration, shadow toggle) live in a third
`Avanzado` section with a `· rara vez` note. Visible but de-emphasized — not hidden behind a click.

### The pattern must generalize across all three tabs
Titles / Overlays / Subtitles use the **identical** Posición → Estilo → Avanzado structure. Same
section component, same row rhythm, same atoms. Do not special-case one tab's layout.

## CSS Patterns

```css
/* Always-open titled section with hairline divider + numbered chip */
.sec   { padding: var(--s-6) 0; border-top: 1px solid var(--border-faint); }
.sec:first-child { border-top: none; }
.sec > .h { display: flex; align-items: center; gap: var(--s-5);
            font-size: var(--t-2xs); font-weight: 700; letter-spacing: 0.1em;
            text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--s-6); }
.sec > .h .num { width: 16px; height: 16px; border-radius: var(--r-xs);
                 background: var(--surface-2); display: grid; place-items: center;
                 font-size: var(--t-2xs); color: var(--text-2); }
.sec > .h::after { content: ""; flex: 1; height: 1px; background: var(--border-faint); }

/* Control atoms — the shared vocabulary every tab reuses */
.row   { display: grid; grid-template-columns: 80px 1fr;   /* 72px inside .ctrl-2col */
         align-items: center; gap: var(--s-6); margin-bottom: var(--s-5); }
.row > label { font-size: var(--t-sm); color: var(--text-2); }

.inp, .sel { font: inherit; font-size: var(--t-md); color: var(--text);
             background: var(--surface-2); border: 1px solid var(--border);
             border-radius: var(--r-sm); padding: 6px 9px; width: 100%; }
.inp:focus, .sel:focus { outline: none; border-color: var(--accent-strong);
                         box-shadow: 0 0 0 3px var(--accent-tint); }      /* blue focus ring */

.two   { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-5); }  /* X/Y pair */
.field { display: flex; flex-direction: column; gap: var(--s-3); }
.field .mini { font-size: var(--t-2xs); color: var(--text-muted);
               text-transform: uppercase; letter-spacing: 0.06em; }

/* Segmented control (weight, anchor, yes/no) — selection in blue, never green */
.seg          { display: flex; background: var(--surface); border: 1px solid var(--border);
                border-radius: var(--r-sm); padding: 2px; gap: 2px; }
.seg button   { flex: 1; font: inherit; font-size: var(--t-sm); color: var(--text-2);
                background: none; border: none; padding: 5px; border-radius: var(--r-xs); }
.seg button.on { background: var(--accent-tint); color: var(--accent); font-weight: 600; }

/* Color swatches — selected gets a double blue ring */
.sw    { width: 24px; height: 24px; border-radius: var(--r-sm);
         border: 1px solid var(--border-strong); cursor: pointer; }
.sw.on { box-shadow: 0 0 0 2px var(--accent-strong), 0 0 0 4px var(--accent-tint); }

/* Range slider — accent thumb */
input[type=range] { -webkit-appearance: none; width: 100%; height: 4px;
                    border-radius: var(--r-full); background: var(--surface-hover); }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px;
                    border-radius: 50%; background: var(--accent); cursor: pointer; }
```

## HTML Structure

```html
<div class="ctrl-body">
  <div class="sec"><div class="h"><span class="num">1</span>Posición</div>
    <div class="two">
      <div class="field"><span class="mini">X (px)</span><input class="inp" value="540"></div>
      <div class="field"><span class="mini">Y (px)</span><input class="inp" value="220"></div>
    </div>
    <!-- 9-point preset grid goes here — see position-presets.md -->
  </div>
  <div class="sec"><div class="h"><span class="num">2</span>Estilo</div>
    <div class="row"><label>Texto</label><input class="inp"></div>
    <div class="row"><label>Fuente</label><select class="sel">…</select></div>
    <div class="row"><label>Tamaño</label><input type="range"></div>
    <div class="row"><label>Peso</label><div class="seg">Regular·Bold·Black</div></div>
    <div class="row"><label>Color</label><div class="swatch-row">…</div></div>
  </div>
  <div class="sec"><div class="h"><span class="num">3</span>Avanzado <span class="adv-note">· rara vez</span></div>
    <div class="row"><label>Radio fondo</label><input type="range"></div>
    <div class="row"><label>Aparece</label><input class="inp" value="0.0 s"></div>
    <div class="row"><label>Duración</label><input class="inp" value="3.0 s"></div>
  </div>
</div>
```

Row rhythm: `label (80px / 72px in 2-col) + control`. Section header is a small uppercase chip-number
+ caps title + hairline rule filling the rest of the line.

## What to Avoid
- **Collapsible sections (B)** and **accordion (C)** — they save height the 2-column layout already
  saved, at the cost of scanability and extra clicks.
- **Collapsed-summary line + dirty-dot** (B's `Inter · Bold · 40`) — judged noise for this dense panel.
- **Hiding "Advanced" behind a disclosure** — keep it visible but de-emphasized at the bottom.
- **Per-tab bespoke layouts** — the Posición → Estilo → Avanzado structure is identical across
  Titles / Overlays / Subtitles.
- **Inline-styled stacked forms** with no grouping — the section headers + dividers are what make it
  read as deliberate.

## Origin
Synthesized from sketch **002-control-density-disclosure** (winner A), composed into the 2-column
controls column of sketch 001-D.
Source: `sources/002-control-density-disclosure/index.html` (variant `#v-a`).
