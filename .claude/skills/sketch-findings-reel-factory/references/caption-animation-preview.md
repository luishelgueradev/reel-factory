# Caption Animation Preview — the word-by-word motion plays

The defining feature of these reels is the **TikTok-style word-by-word highlight** — each word popping
as it's spoken. Every prior subtitle sketch (011, 014, 012) previewed it as a **static specimen**, a
frozen styled frame you can't judge *rhythm* from. This finding makes the preview **play the
animation** and settles where its playback/scrub control lives. **Updates `subtitle-styling.md`:
static subtitle specimens are retired.**

## Design Decisions

### C — loop + transport, division of labor (winner): two complementary surfaces
The motion gets **two surfaces, each doing one job** — mirroring the 020-C / 022-B "global places,
local refines" split:
- **In-panel specimen loops the *style*** — a continuous word-by-word loop with a ▶/❚❚ toggle (and, in
  the A lineage, a Velocidad slider). Judge the highlight *rhythm* freely, decoupled from real timing.
- **Stage transport scrubs the *real moment*** — play + scrub + clock under the phone (the **same
  transport idiom as the 020 timeline**) drives the actual preview word-by-word.

The competing-motion risk (two animations at once fighting for the eye) was **judged acceptable**: they
answer different questions and you focus on one at a time. Chosen over **A** (specimen plays, stage
static — rhythm judged only in the panel) and **B** (the preview is the sole source of truth, specimen
drops to a static style reference — honest but loses in-panel motion).

### One paint function, two drivers
The same `paint(target, words, idx, mode)` renders the caption into *either* surface — only the driver
differs (continuous loop vs scrub/playback position). This keeps the looping specimen and the scrubbed
stage visually identical and is the core implementation requirement: **don't fork the word renderer.**

### Mode differences become legible in motion
Switching mode (TikTok / Barra / Frase / Karaoke) *while it animates* makes the difference obvious in a
way a still never could — `tiktok` lights one word at the index, `karaoke` lights all words up to the
index, `phrase` shows the whole line lit, `bar` highlights the current word. The mode cards lead the
section (the 011-C decision); now they animate.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### The animated word — shared across stage + specimen
```css
.w         { color: #fff; transition: color 90ms linear, transform 130ms var(--ease); display: inline-block; }
.w.on      { color: #ffea00; transform: scale(1.08); text-shadow: 0 0 18px oklch(0.9 0.18 95 / 0.55); }
.w.pending { opacity: 0.35; }
/* on the stage, layer the pop glow over the legibility shadow */
.cap-stage .w     { text-shadow: 0 2px 12px rgba(0,0,0,.85); }
.cap-stage .w.on  { text-shadow: 0 0 22px oklch(0.9 0.18 95 / 0.6), 0 2px 12px rgba(0,0,0,.85); }
```

### Stage transport (the 020 timeline idiom)
```css
.transport { display: flex; align-items: center; gap: var(--s-5); width: 100%; max-width: 320px; }
.play      { width: 34px; height: 34px; border-radius: 50%; flex: none; border: 1px solid var(--accent-strong);
             background: var(--accent-tint); color: var(--accent); display: grid; place-items: center; }
.scrub     { -webkit-appearance: none; flex: 1; height: 4px; border-radius: var(--r-full); background: var(--surface-hover); }
.clock     { font-size: var(--t-xs); color: var(--text-2); font-variant-numeric: tabular-nums; flex: none; }
/* recording-style "en reproducción" dot blinks only while playing */
.live-tag .rdot         { width: 6px; height: 6px; border-radius: 50%; background: var(--danger); }
.live-tag.playing .rdot { animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0.2; } }
```

### Specimen with its own play affordance + loop progress bar
```css
.specimen   { position: relative; border-radius: var(--r-md); overflow: hidden;
              background: linear-gradient(180deg, oklch(0.30 0.04 255), oklch(0.20 0.03 270));
              border: 1px solid var(--border); min-height: 92px; display: grid; place-items: center; }
.sp-play    { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--accent-strong);
              background: oklch(0.16 0.02 280 / 0.5); color: var(--accent); }
.sp-loop    { position: absolute; bottom: 7px; left: 0; right: 0; height: 2px; }
.sp-loop i  { display: block; height: 100%; background: var(--accent); width: 0; }  /* JS sets width = idx/len % */
```

## Interaction: one renderer, two drivers (the core requirement)
```js
// SHARED — renders words into either surface; only `idx`/`mode` differ between drivers
function paint(target, ws, idx, mode){
  if (mode==='phrase') { target.innerHTML = `<span class="w on" style="transform:none">${ws.join(' ')}</span>`; return; }
  target.innerHTML = ws.map((w,i)=>{
    if (mode==='tiktok')  return `<span class="w${i===idx?' on':''}">${w}</span>`;
    if (mode==='karaoke') return `<span class="w${i<=idx?' on':''}">${w}</span>`;  // cumulative
    if (mode==='bar')     return `<span class="w${i===idx?' on':''}">${w}</span>`;
    return `<span class="w">${w}</span>`;
  }).join(' ');
}
// DRIVER 1 — specimen: continuous loop, advance idx every ~420ms / speed, wrap to -1 (all off) then restart
// DRIVER 2 — stage: idx = floor(scrubPct/100 * words.length); play() steps the scrub, scrub.oninput pauses + repaints
```
`prefers-reduced-motion` must collapse the loop (see `references/motion-and-timing.md`).

## What to Avoid
- **Don't keep static specimens for subtitles.** They can't convey rhythm — the whole reason this
  sketch exists. (Static *style* reference is fine as a secondary surface, as in variant B.)
- **Don't fork the word renderer** into separate "specimen" and "stage" implementations — one `paint()`,
  two drivers, or the two surfaces drift.
- **Don't let both animations run unmanaged on a low-power device** — honor `prefers-reduced-motion`.
- **Don't reuse a different transport idiom than the 020 timeline.** The stage transport and the
  timeline strip must read as one time control, not two.

## Origin
Synthesized from sketch 025 (caption-animation-preview, winner C — loop + transport; A = specimen plays;
B = preview-driven transport only). Updates `references/subtitle-styling.md` (specimens now animate);
shares the transport idiom with `references/timeline-temporal.md` (020). Source file in
`sources/025-caption-animation-preview/` (winner `#v-c`, marked ★ in the variant nav).
