# Video Effects — Transitions Tab + the Dropped Auto-Zoom

What's left of whole-clip video effects after a **product decision**, and where the one survivor lives
in the shell. Read the auto-zoom decision first — it's why this surface is as small as it is.

## Design Decisions

### Auto-emphasis-zoom DROPPED (product decision, 2026-06-01 — the framing decision)
The old `ZoomConfig` / `detectZoomEvents` fired a **1.15× zoom on words with Whisper confidence < 0.6**
— i.e. **mumbled / unclear words, not emphasized ones**. The premise (confidence = emphasis) is simply
**wrong**, so it produced meaningless per-word zoom flashes that read **off-brand for a professional
profile** (the user had already disabled it). **Removed.**

- **Kept:** `TransitionConfig` — the gentle **1.08× push / crop-shift** that masks the jump-cut where
  silence was removed. A legitimate, professional technique.
- **Build implications:** remove the `detectZoomEvents` wiring and the auto-zoom timeline lane (see
  `references/timeline-temporal.md`); keep `TransitionConfig`. If emphasis-zoom is ever revived it must
  re-found on a **real signal** — prosody / LLM-punchline detection / manual marking — with a **slow held
  push**, not a per-word flash, and as a **separate spike**. Canonical record: memory `auto-zoom-dropped`.

This decision is *why* sketch 021 reframed from "how do you review auto-zoom events" to "where does the
**one remaining** whole-clip effect live?"

### A minimal "Video" tab (sketch 021-A — winner)
With transitions as the lone whole-clip effect, three homes were tried:

- **021-A minimal "Video" tab (WINNER)** — a **4th tab** holding just the transition: **type cards**
  (Zoom push / Crop-shift / Ninguna, each previewing its motion) + a **Duración** slider + a "Suavizar
  los cortes" master switch. Deliberately near-empty — the sketch's own copy *asks* whether one control
  earns a tab.
- **021-B global setting (header popover)** — transitions behind a "⚙ Ajustes de video" button, framed
  as a pre-render global (same family as quality/format); the three tabs stay reserved for per-element
  styling.
- **021-C folded into the Render surface** — the transition control next to the Render action (sketch
  010), since it's a render-time decision.

**Why A won (user's call):** the user chose a **dedicated tab** over the fewer-surfaces alternatives.
The tab gives transitions a clear, persistent, previewable home alongside the other per-output controls,
rather than tucking the one global effect behind a popover or pairing it with Render. Note the honest
tension the sketch itself raises — *one control is a thin tab* — so if more whole-clip effects never
materialize, B/C remain the fallback framing.

### Transition type cards (same kit as mode/entrance cards)
The transition picker reuses the **preset-card vocabulary** (011-C mode cards, 014-C entrance cards): a
3-up grid of cards, each with a small **motion preview** that loops its actual behavior — Zoom = a 1.08×
push, Crop-shift = a ~20px slide, Ninguna = a static dimmed pane (dry cut). Selection = blue
(`--accent-strong` border + `--accent-tint-2` fill). The preview is **honest**: it shows the *subtle*
push/shift that hides a silence cut, never a flashy emphasis zoom.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### Transition type cards with looping motion preview (021-A)
```css
.tcards { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-5); margin-bottom: var(--s-8); }
.tcard  { padding: var(--s-6) var(--s-4) var(--s-5); background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-md); cursor: pointer; text-align: center;
          transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease); }
.tcard.on { border-color: var(--accent-strong); background: var(--accent-tint-2); }   /* blue = selected */
.tcard .vis  { height: 46px; border-radius: var(--r-sm); background: var(--stage); margin-bottom: var(--s-5);
               overflow: hidden; position: relative; display: grid; place-items: center; }
.tcard .vis .pane { width: 60%; height: 64%; border-radius: var(--r-xs);
                    background: linear-gradient(135deg, oklch(0.42 0.07 250), oklch(0.28 0.05 285)); }
/* each card loops its own motion so the choice is legible without clicking */
.tcard .vis.zoom  .pane { animation: tz 2.4s var(--ease) infinite; }
@keyframes tz { 0%,60%{transform:scale(0.86)} 78%{transform:scale(1)} 100%{transform:scale(0.86)} }
.tcard .vis.shift .pane { animation: ts 2.4s var(--ease) infinite; }
@keyframes ts { 0%,60%{transform:translateX(-18%)} 80%{transform:translateX(0)} 100%{transform:translateX(-18%)} }
.tcard .vis.none  .pane { opacity: 0.5; }   /* dry cut = static dimmed pane */
.tcard .nm  { font-size: var(--t-sm); color: var(--text-2); font-weight: 600; }
.tcard.on .nm { color: var(--accent); }
.tcard .sub { font-size: var(--t-2xs); color: var(--text-faint); margin-top: 2px; }
```

### Honest cut-transition preview on the stage (021)
```css
/* the preview shows the SUBTLE push/shift that hides a silence cut — not an emphasis flash */
.cutscene.play.zoom  .frameimg { animation: pushz 1.2s var(--ease); }
@keyframes pushz { 0%{transform:scale(1)} 40%{transform:scale(1.08)} 100%{transform:scale(1)} }
.cutscene.play.shift .frameimg { animation: pushs 1.2s var(--ease); }
@keyframes pushs { 0%{transform:translateX(0)} 40%{transform:translateX(-5%)} 100%{transform:translateX(0)} }
```

## HTML Structures

### The "Video" tab — 4th tab, transition only (021-A)
```html
<div class="tabs">
  <button class="tab">Títulos</button><button class="tab">Overlays</button>
  <button class="tab">Subtítulos</button><button class="tab sel">Video</button>   <!-- the 4th tab -->
</div>
<div class="ctrl-body narrow">
  <div class="sec"><div class="sec-h"><span class="num">1</span>Transición entre cortes
      <span class="note">· al sacar silencios</span></div>
    <div class="switchline"><span class="switch on"></span><span class="lbl">Suavizar los cortes</span></div>
    <div class="tcards">
      <div class="tcard on" data-vis="zoom"><div class="vis zoom"><div class="pane"></div></div><div class="nm">Zoom</div><div class="sub">empuje 1.08×</div></div>
      <div class="tcard" data-vis="shift"><div class="vis shift"><div class="pane"></div></div><div class="nm">Crop-shift</div><div class="sub">desliza 20px</div></div>
      <div class="tcard" data-vis="none"><div class="vis none"><div class="pane"></div></div><div class="nm">Ninguna</div><div class="sub">corte seco</div></div>
    </div>
    <div class="row"><label>Duración</label><div class="rng"><input type="range" min="100" max="500" value="250"><output>250</output></div></div>
  </div>
</div>
```
The header `tag` reads `Vertical 9:16 · Video` when this tab is active, matching the per-tab tag pattern.

## What to Avoid
- **Auto-emphasis-zoom in any per-word/confidence form** — wrong signal, off-brand, removed. Don't
  rebuild `detectZoomEvents`. A future emphasis effect must use a real signal (prosody / LLM / manual)
  and a slow held push, scoped as its own spike.
- **A flashy/dramatic transition preview** — the technique is a *subtle* 1.08× push / ~20px shift to
  hide a silence cut. A loud preview misrepresents it and reads off-brand.
- **Over-filling the Video tab to justify it** — the tab is honestly thin (one control). Don't invent
  effects to bulk it up (the 019-B invented-controls anti-pattern). If whole-clip effects stay at one,
  reconsider 021-B (global popover) / 021-C (folded into Render).

## Origin
Synthesized from sketch 021 (video-effects-surface, winner A — minimal "Video" tab) and the
auto-emphasis-zoom **product decision** (2026-06-01, memory `auto-zoom-dropped`). The dropped zoom also
removed a timeline lane — see `references/timeline-temporal.md`. Source file in
`sources/021-video-effects-surface/` (winner `#v-a`, marked ★ in the variant nav). Real schema:
`TransitionConfig` (kept) within the former `VisualEffectsConfig`; `ZoomConfig` / `detectZoomEvents`
removed.
