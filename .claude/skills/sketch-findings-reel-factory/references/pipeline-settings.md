# Pipeline Settings Home — Where the Non-Look / Processing Params Live

The four tabs (Títulos / Overlays / Subtítulos / Video) all configure the **look** — per-element
styling. But the params that actually drive `pipeline-config.json` and the processing *run* had **no
home in any of the 31 prior sketches**:

- **Whisper model** (tiny / base / small / medium / large-v3 / turbo — *medium* recommended; AGENTS.md model table)
- **Language** (Español/es fixed for accuracy — fixing it skips detection)
- **Silence sensitivity** (`silencedetect` threshold + min silence duration + padding)
- **Output** (1080×1920 9:16 **locked in v1**, FPS, H.264 codec)

These are **global, set-once-ish, run-affecting** settings — *not* per-element styling. Sketch 032
finds them a home that doesn't break the dense per-element control panel.

⚠️ **Scope-expanding beyond Phase 22.** Phase 22 is look-polish; these processing params are a *marker
for where settings land when they're built*, not a Phase 22 commitment. The placement is settled.

## Design Decisions

### Winner 032-A — slide-over "⚙ Procesamiento" sheet
A **header trigger** (`⚙ Procesamiento`) opens a **slide-over sheet over the editor** — the **same
shared-component idiom as the 016 font picker** (see `font-picker.md`). It costs **no new pattern**: a
trigger in the header action zone opens a right-anchored sheet, the settings get real room to breathe
(the 6 Whisper-model chips + tradeoff hints + sensitivity scale + output don't cramp), and dismiss
returns you to the look-work **untouched**. Settings live **one click away, off the per-element tabs**.

### Why the sheet beat the 5th tab and the Render popover
- **B — 5th "Procesamiento" tab:** settings become a tab alongside Títulos/Overlays/Subtítulos/Video.
  One bar, everything visible — but it **breaks the per-element tab contract**: those tabs configure
  *this* title / overlay / subtitle, and global pipeline params crammed in muddy the **"per-frame vs
  global"** reading the right-pushed Video tab (`margin-left:auto`) established. The sketch keeps an
  in-tab `⚠` note naming the tension. Rejected.
- **C — popover on the Render button:** a `⚙` split on Render opens a popover with the settings +
  "Render con estos ajustes →". Settings *at the point of decision* — superficially fits the 031-A
  inline spine (render commits from this button). But it **overloads the now-load-bearing render
  action** (031-A just made Render the *primary* run gesture) by coupling rarely-touched config to it.
  Rejected. *(Kept as the "settings at the moment of commit" alternative if config-per-render is ever wanted.)*

### Frequency argues for tucked-away, not in-your-face
These are **set-once-ish** — you rarely change your Whisper model per video. That frequency is exactly
why the tucked-away sheet wins over a tab that spends permanent bar real estate (B) or a popover bolted
to the most-used button (C). Rare + global + run-affecting → a sheet one click off the main surface.

### Honest about the locked output
Output resolution is **fixed at 1080×1920 9:16 in v1** (project constraint). Show it as a **disabled
select with a 🔒 "vertical 9:16 en v1" caption** — a *visible-but-locked* control is honest (it tells
the user the constraint exists and is deliberate), not noise. Don't hide it; don't make it look editable.

### Writes to pipeline-config.json
The sheet's real target is `pipeline-config.json` — the **same propagation path** as the Studio's saved
config via `ACTIVE_PIPELINE_CONFIG_PATH` (AGENTS.md: must point at the project-root
`pipeline/pipeline-config.json` so Studio-saved settings reach the pipeline). Model / language /
sensitivity / output map to the `faster-whisper` + `silencedetect` + Remotion render params.

### Green discipline holds
The sheet's primary action is **"Aplicar"** in `--action` green; **Cancelar** is the neutral outline.
The `⚙ Procesamiento` trigger itself is a **neutral gear** that turns **accent (blue) when open** —
never green. (The reserved action-green stays on Render / Guardar per the surface, per `header-action-zone.md`.)

## CSS / HTML Patterns

All patterns use the shared tokens in `sources/themes/default.css`. The sheet shell reuses the
font-picker slide-over idiom (`font-picker.md`).

### The slide-over sheet (A) — right-anchored, scrim, slide-in
```css
.scrim { position:absolute; inset:0; background:oklch(0.12 0.02 280 / 0.5); display:none; z-index:8;
         animation:fadein .2s var(--ease); }
.scrim.show { display:block; }
.sheet { position:absolute; top:0; right:0; bottom:0; width:380px; background:var(--surface);
         border-left:1px solid var(--border-strong); box-shadow:var(--shadow-pop); z-index:9;
         display:none; flex-direction:column; }
.sheet.show { display:flex; animation:slidein .24s var(--ease); }
@keyframes slidein { from { transform:translateX(100%); } to { transform:none; } }
.sheet-h    { flex:none; display:flex; align-items:center; gap:var(--s-5);
              padding:var(--s-8) var(--s-10); border-bottom:1px solid var(--border); }
.sheet-body { flex:1; overflow-y:auto; padding:var(--s-10); }
.sheet-foot { flex:none; padding:var(--s-6) var(--s-10); border-top:1px solid var(--border);
              display:flex; gap:var(--s-5); }       /* Cancelar(outline) · Aplicar(green) */
```
```css
.gear      { background:var(--surface); border:1px solid var(--border); color:var(--text-2);
             padding:7px 12px; border-radius:var(--r-sm); }                       /* neutral trigger */
.gear.open { background:var(--accent-tint); border-color:var(--accent-strong); color:var(--accent); } /* accent when open, never green */
```

### Whisper model chips — 6 options, live tradeoff hint, REC badge
The highest-leverage control. Chips (not a dropdown) so the tradeoff is browsable; the recommended
model carries a small **REC** badge; a single hint line updates live on selection.
```css
.mchip       { font-size:var(--t-xs); color:var(--text-2); background:var(--surface-2);
               border:1px solid var(--border); padding:6px 11px; border-radius:var(--r-sm); }
.mchip.on    { background:var(--accent-tint); border-color:var(--accent-strong); color:var(--accent); font-weight:600; }
.mchip .rec  { position:absolute; top:-7px; right:-6px; font-size:8px; background:var(--accent);
               color:var(--stage); font-weight:700; padding:1px 5px; border-radius:var(--r-full); }
```
```js
const MODELS = [
  { k:'tiny',    rec:false, hint:'el más rápido · precisión baja — sólo pruebas' },
  { k:'base',    rec:false, hint:'muy rápido · precisión baja' },
  { k:'small',   rec:false, hint:'rápido · buena en CPU · español ok' },
  { k:'medium',  rec:true,  hint:'equilibrio velocidad/precisión · multilingüe — recomendado' },
  { k:'large-v3',rec:false, hint:'el más preciso · lento · pide GPU (~10 GB)' },
  { k:'turbo',   rec:false, hint:'rápido y muy preciso · sólo GPU' },
];   // mirrors the AGENTS.md Whisper Model Selection Guide
```

### Sensitivity scale + the locked output select
```css
.slider input { flex:1; accent-color:var(--accent); }
.slider .sv   { font-variant-numeric:tabular-nums; min-width:88px; text-align:right; }  /* live label */
.scalelbl     { display:flex; justify-content:space-between; font-size:var(--t-2xs); color:var(--text-faint); }
.sel:disabled { color:var(--text-muted); cursor:default; }   /* the 9:16 lock */
```
```html
<!-- sensitivity reads as words, not raw dB: conservador → suave → equilibrado → agresivo → máximo -->
<div class="slider"><input type="range" min="0" max="100" value="55"><span class="sv">equilibrado</span></div>
<div class="scalelbl"><span>conservador (corta menos)</span><span>agresivo (corta más)</span></div>

<!-- output: visible but locked, honest about the v1 constraint -->
<select class="sel" disabled><option>1080 × 1920 · 9:16</option></select>
<div class="lock">🔒 vertical 9:16 en v1</div>
```

### Section grouping inside the sheet
Three titled groups — **Transcripción (Whisper) · Cortes de silencio · Salida** — each an uppercase
`.gh` header (accent glyph) over stacked `.srow`s, two-up where the params pair (`min silence / padding`,
`resolución / FPS`). Same always-open titled-section vocabulary as the editor's Posición→Estilo→Avanzado
(`control-panel-density.md`), so the sheet reads as the same panel family.

## What to Avoid
- **Don't make pipeline settings a 5th tab (032-B).** They're global/run-affecting, not per-element —
  a tab breaks the per-element contract and muddies the "per-frame vs global" reading the Video tab set up.
- **Don't bolt settings onto the Render button (032-C).** 031-A made Render the load-bearing run
  gesture; coupling rarely-touched config to it overloads the most important button.
- **Don't hide the 9:16 lock.** A visible disabled control with a 🔒 caption is honest about the v1
  constraint; silently omitting it reads as "where's resolution?"
- **Don't green the gear trigger.** The `⚙ Procesamiento` trigger is neutral → accent-when-open;
  green stays reserved for the surface's one primary action (Aplicar inside the sheet; Render outside).
- **Don't invent a new slide-over pattern.** Reuse the 016 font-picker sheet idiom — it's the
  project's committed shared component for "open a focused surface over the editor."

## Origin
Synthesized from sketch 032 (pipeline-settings-home, winner **A** — slide-over "⚙ Procesamiento"
sheet; B = 5th tab rejected for breaking the per-element contract, C = Render popover rejected for
overloading the run action). Reuses the slide-over shared component from `font-picker.md` (016-C);
coheres with the 031-A run spine (`run-flow-spine.md`) by keeping config *off* the render button.
Writes to `pipeline-config.json`. Source file in `sources/032-pipeline-settings-home/` (winner `#v-a`).
