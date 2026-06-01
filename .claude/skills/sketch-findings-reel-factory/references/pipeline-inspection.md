# Pipeline-Step Inspection — Transcript Review & Silence-Cut Review

AGENTS.md promises every pipeline step is *"independiente e inspeccionable, [permite] revisar salidas
intermedias antes de continuar."* Two intermediate outputs were invisible in the Studio and now earn
**dedicated full-screen review steps**: the **Whisper transcript** (028) and the **silence cuts**
(029). Both resolved to the *same idiom* — a full-screen takeover framed as a **pipeline step**, with a
**step-rail** in the header (Audio → Transcripción → Silencios → Render), a single green **"Confirmar
… →"** CTA, and everything else neutral/accent. This is the inspectability promise made legible.

⚠️ **Scope-expanding** — these are new surfaces beyond the Phase 22 editor shell (they're *steps the
editor passes through*, not tabs). Likely a later milestone, but the idiom is settled.

## Design Decisions

### The shared idiom — a pipeline step, not an in-shell panel
Both sketches tested an in-shell variant (028-A cramped the transcript into a side list; 029-A added a
Silencios lane to the 020-C timeline) and both **rejected it for a full-screen step**. The reasons:
- The intermediate output is **document-scale** (a whole transcript / 14 cuts) — a side panel cramps it.
- Framing it as a **gate you pass through** ("Confirmar → continuar") makes the
  inspect-before-continue promise *legible*, which an always-available lane does not.
- The **step-rail** (Audio ✓ → **Transcripción** → Silencios → Render) gives the user a map of where
  they are in the pipeline — the steps are the product's selling point, so name them.

### 028 Transcript review (winner B) — full-screen script read-through
The transcript reads like a **document**: segments as timestamped paragraphs, ▶ per segment,
**click-to-edit any word in place**. **Confidence is the flag-for-review signal** (its *legitimate* use
— unlike the dropped auto-zoom that misread confidence as emphasis; see `video-effects.md`):
- **Two-tier underline:** `< 0.78` → dotted **amber** (`--warning`); `< 0.6` → dotted **red**
  (`--danger`) + faint tint. A "N palabras dudosas" counter ticks down as you fix them.
- **B beat the triage queue (028-C)** — C shows only the uncertain words one at a time (fastest fix),
  but skips the 90% Whisper got right, so it can't catch a *confidently wrong* word. B reads everything;
  C is kept as the power-user alt. The split is a philosophy: read-everything (trust, slower) vs.
  fix-only-doubts (fast, assumes confidence is a perfect filter).

### 029 Silence-cut review (winner B) — full-screen per-cut review
The core value ("elimina silencios") made inspectable for the first time. Real `SilenceCut{
original_start/end, new_start/end, duration, source, cumulative_shift }`:
- **Before/after stat** up top: `1:48 → 1:12  ·  −0:36 más corto` (the `to` value in accent-blue,
  the delta in `--success`; updates live as cuts are restored).
- **Waveform with every removed silence in red** — the thing the feature is *named for*, made literal.
  Click a red block to restore it (turns green). `.sil` blocks over speech `.bars`.
- **Per-cut list:** timestamp range (mono) · duration-removed bar (red) · **source badge** · a
  **quitado/devuelto toggle** each. The honest "here's exactly what I removed, veto any."
- **Source badge earns trust, isn't noise:** `×2`/both = both detectors agreed (`--success`),
  `ffmpeg` = level-detection only (accent), `whisper` = word-gap only (`--warning`). It answers "why
  did it think this was silence."
- **B beat the sensitivity dial (029-C)** — C leads with the outcome + a umbral-dB/min-duration knob
  ("Volver a analizar") and hides the 14 cuts; faster but no per-cut veto. Kept as the "tune the knob,
  don't micromanage" alt. **Honesty note:** restoring a cut re-runs `silence-cutter`; C's "Volver a
  analizar" surfaces that cost openly, B/A imply a lighter local restore.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### Step-rail — the pipeline map in the header (shared by 028 + 029)
```css
.steprail { display:flex; align-items:center; gap:var(--s-4); font-size:var(--t-xs); }
.steprail .s { display:inline-flex; align-items:center; gap:6px; color:var(--text-muted); }
.steprail .s .n { width:18px; height:18px; border-radius:50%; display:grid; place-items:center;
                  font-size:10px; font-weight:700; background:var(--surface-2); color:var(--text-faint);
                  border:1px solid var(--border); }
.steprail .s.done .n { background:var(--success); color:var(--stage); border-color:transparent; } /* ✓ */
.steprail .s.cur  { color:var(--text); }
.steprail .s.cur .n { background:var(--accent); color:var(--stage); border-color:transparent; }   /* current */
.steprail .sep { width:16px; height:1px; background:var(--border); }
```
```html
<div class="steprail">
  <span class="s done"><span class="n">✓</span>Audio</span><span class="sep"></span>
  <span class="s cur"><span class="n">2</span>Transcripción</span><span class="sep"></span>
  <span class="s"><span class="n">3</span>Silencios</span><span class="sep"></span>
  <span class="s"><span class="n">4</span>Render</span>
</div>
```

### 028 — confidence underlines (two-tier, calibrated not alarmist)
```css
.wd.low  { border-bottom: 2px dotted var(--warning); }                              /* < 0.78 */
.wd.vlow { border-bottom: 2px dotted var(--danger); background: oklch(0.63 0.185 25 / 0.07); } /* < 0.6 */
```
```js
const LOW = 0.78, VLOW = 0.6;   // thresholds; counter = words below LOW, minus those edited
```

### 029 — waveform with removed-silence blocks + the restore toggle
```css
.wf  { position:relative; height:84px; background:var(--stage); border:1px solid var(--border);
       border-radius:var(--r-md); overflow:hidden; display:flex; align-items:center; }
.wf .bars b         { flex:1; background:var(--border-strong); }
.wf .bars b.speech  { background:var(--accent); opacity:0.7; }
.sil          { position:absolute; top:0; bottom:0; cursor:pointer; transition:background var(--dur) var(--ease);
                background:oklch(0.63 0.185 25 / 0.16); border-inline:1px solid oklch(0.63 0.185 25 / 0.5); }
.sil:hover    { background:oklch(0.63 0.185 25 / 0.28); }
.sil.restored { background:oklch(0.72 0.14 150 / 0.10); border-color:oklch(0.72 0.14 150 / 0.4); } /* green = kept back in */

/* per-cut list row: play · range · duration-removed bar · source badge · toggle */
.cut { display:grid; grid-template-columns:28px 120px 1fr 80px 84px; align-items:center; gap:var(--s-6); }
.cut.restored { opacity:0.6; }
.src.both    { color:var(--success); background:oklch(0.72 0.14 150 / 0.14); }   /* ×2 — both detectors */
.src.ffmpeg  { color:var(--accent);  background:var(--accent-tint); }
.src.whisper { color:var(--warning); background:oklch(0.80 0.12 78 / 0.14); }
.toggle      { width:38px; height:22px; border-radius:var(--r-full); background:var(--action); } /* quitado = green-on */
.toggle.off  { background:var(--surface-hover); }                                                 /* devuelto = off */
```

### The single green per surface (green discipline holds)
Each step's *only* primary action is the confirm: `Confirmar transcripción →` / `Confirmar cortes →`
in `--action` green. Play, discard, restore, alternatives all stay neutral/accent — never a second green.

## What to Avoid
- **Don't cram these into the editor shell as a tab/side-panel** (028-A / 029-A). They're
  document-scale review *steps* — the full-screen takeover is what makes the inspect-before-continue
  promise legible.
- **Don't underline-everything-low as one flat tone.** The two-tier amber(<0.78)/red(<0.6) is what
  keeps it reading as calibrated triage rather than alarmist noise on a clean transcript.
- **Don't hide the source badge as decoration.** `×2`/ffmpeg/whisper answers "why was this silence,"
  which is the trust the cut review trades on.
- **Don't imply cuts restore for free if the pipeline re-runs.** If toggling a cut re-invokes
  `silence-cutter`, surface that cost (029-C's "Volver a analizar" is the honest model).
- **Don't put a second green on the surface.** One "Confirmar … →" per step; everything else neutral.

## Origin
Synthesized from sketches 028 (transcript-review, winner B — full-screen read-through; C = triage
queue) and 029 (silence-cut-review, winner B — full-screen per-cut review; C = aggregate + sensitivity
dial). Both share the pipeline-step / step-rail / single-confirm-green idiom. Confidence-as-flag here is
the *legitimate* use that the dropped auto-zoom (see `video-effects.md`) misapplied. Source files in
`sources/028-transcript-review/` (winner `#v-b`) and `sources/029-silence-cut-review/` (winner `#v-b`).
