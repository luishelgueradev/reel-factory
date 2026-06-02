# Error & Failure States — What "Something Broke" Looks Like in the Calm Pro Register

Sketch 008 covered the *happy-path-off* states (empty, 3/3 cap, no-video, Whisper-loading) and 035
covered render-OOM **completion** as an async notification. But the genuine **error vocabulary** —
what real faults look like *in the editor, as they happen* — was unsketched. Sketch 040 settles it.

The real failure modes, grounded in the architecture:

| Fault | Cause line (real) | Severity | Where it surfaces |
|-------|-------------------|----------|-------------------|
| **Upload rejected** | `ffprobe: moov atom not found` (corrupt/unsupported codec) | recoverable | the dropzone |
| **Whisper unreachable** | `POST whisper-api/transcribe → ECONNREFUSED` (externalized HTTP service, Phase 15) | fatal for transcription | calm panel over the dimmed stage |
| **Disk full** | `ENOSPC: no space left on device (/output)` | fatal for render | stage panel/takeover |
| **Save failed** | `PUT /api/config → 500` | recoverable | the header chip + button |
| **Render OOM** | `remotion-renderer killed (OOM, signal 9)` (single-job / Chrome RAM) | fatal for render | stage panel (035 recompose, editor-resident) |

## Design Decisions

### Winner 040-A — inline at the source: context explains the fault
Each fault surfaces **where it originated**, with no global error chrome. The location *is* part of the
explanation:
- **Upload rejected** → the **dropzone** turns `.bad` (danger border + a one-time `nudge` shake) and
  shows the real `ffprobe` reason inline plus a plain-language fix ("probá con H.264 — el formato que
  exporta cualquier cámara o teléfono").
- **Whisper down / disk full / OOM (fatal)** → the 9:16 stage **dims** and a `.stage-fault` panel floats
  over it: icon, title, plain-language body, the real cause line in mono, and the single recovery action.
  Crucially the copy reassures **"el resto del editor sigue funcionando"** — a fatal-for-transcription
  fault doesn't lock the whole tool.
- **Save failed** → the header **chip flips to `err`** (`No se guardó`, danger tint + nudge) and the
  **Guardar button becomes `Reintentar guardado`**. This reuses the 013/008 chip vocabulary in an error
  tone — the chip is the ambient carrier, exactly as it carries dirty/saving/saved.

### Why A beat the alternatives
- **vs B (single header error banner):** one persistent banner under the header that carries the active
  fault + cause + recovery. It scales to *fatal* faults but **over-weights a small recoverable one** — a
  rejected upload doesn't deserve app-level chrome. A keeps a small problem small.
- **vs C (severity triage takeover):** recoverable faults stay inline; fatal ones take a calm **stage
  takeover**. C's recoverable-vs-fatal split is sound, but a full takeover is heavier than most faults
  need. **C's takeover idiom folds *into* A** for the genuinely fatal cases (Whisper/disk/OOM) — A's
  `.stage-fault` over the dimmed stage *is* C's calm takeover, scoped to the stage rather than the whole
  screen. So the synthesis is: **A's at-source placement + the chip as ambient carrier, with C's takeover
  reserved for fatal blocks.**

### Danger is its own low-chroma red — never borrows action-green
Every error treatment uses a **calm `--danger`** (low-chroma red, `oklch(0.63 0.185 25)`), as a tint
behind icons and a thin border — never a saturated red banner that alarms. The reserved **action-green
never appears in an error**. The register stays *pro-calm*: precise, reassuring, recoverable.

### The cause line is reassuring-precise, not hidden
The real technical cause (`ECONNREFUSED`, `ENOSPC`, `signal 9`, `moov atom not found`) is shown in
**mono, muted** — present for the user who wants it, subordinate to the plain-language explanation above
it. This is the same honesty the queue's concurrency banner and the 035 OOM toast carry: state the real
constraint plainly rather than paper over it.

## CSS / HTML Patterns

All patterns use the shared tokens in `sources/themes/default.css` and compose inside the 033-B rail
shell + 013-B contextual header.

### The header chip flips to an error tone (save-failed) — reuses 008/013 vocabulary
```css
.chip      { display:inline-flex; align-items:center; gap:7px; font-size:var(--t-xs); font-weight:600;
             padding:5px 11px; border-radius:var(--r-full); background:var(--surface-2); color:var(--text-2); }
.chip.dirty{ color:var(--warning); }
.chip.err  { color:var(--danger); background:oklch(0.63 0.185 25 / 0.12); animation:nudge .3s var(--ease); }
@keyframes nudge { 0%,100%{transform:none} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
```
```js
// save-failed: chip → error, Guardar button → Reintentar (the chip is the ambient carrier)
chip.className='chip err'; chip.innerHTML='<span class="dot"></span>No se guardó';
save.textContent='Reintentar guardado'; save.className='btn btn-out';   // never greens
```

### The dropzone rejects in place (upload rejected)
```css
.dropzone     { width:210px; height:373px; border:2px dashed var(--border-strong); border-radius:var(--r-md);
                display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--s-5); }
.dropzone.bad { border-color:var(--danger); animation:nudge .3s var(--ease); }
.dropzone .rejline { margin-top:var(--s-3); font-size:var(--t-xs); color:var(--danger);
                     display:flex; align-items:center; gap:6px; max-width:180px; }   /* real ffprobe reason inline */
```

### The fatal fault panel over the dimmed stage (Whisper / disk / OOM)
```css
.stage9x16.dim   { filter:saturate(.4) brightness(.5); }
.stage-fault     { position:absolute; inset:var(--s-10); border-radius:var(--r-md);
                   background:oklch(0.18 0.03 280 / .9); backdrop-filter:blur(2px);
                   display:flex; flex-direction:column; align-items:center; justify-content:center;
                   gap:var(--s-5); text-align:center; padding:var(--s-10); animation:fadein .2s var(--ease); }
.stage-fault .fi { width:44px; height:44px; border-radius:50%;
                   background:oklch(0.63 0.185 25 / 0.15); color:var(--danger); display:grid; place-items:center; }
.stage-fault .fd { font-size:var(--t-xs); color:var(--text-2); max-width:230px; line-height:1.5; }
.stage-fault .fcause { font-size:var(--t-2xs); color:var(--text-faint); font-family:var(--mono); }  /* the real cause, subordinate */
```

### The fault model (one object per fault, drives every variant)
```js
const FAULTS = {
  upload:  { sev:'recoverable', title:'No pude leer ese archivo',
             desc:'El MP4 parece corrupto o usa un códec que el pipeline no soporta. Probá con H.264.',
             cause:'ffprobe: moov atom not found', action:'Elegir otro archivo' },
  whisper: { sev:'fatal', title:'El servicio de transcripción no responde',
             desc:'Whisper corre como servicio aparte y no contesta. Sin transcripción no hay subtítulos ni cortes — el resto del editor sigue funcionando.',
             cause:'POST whisper-api/transcribe → ECONNREFUSED', action:'Reintentar conexión', action2:'Ver estado del servicio' },
  disk:    { sev:'fatal', title:'No queda espacio para renderizar',
             cause:'ENOSPC: no space left on device (/output)', action:'Ir a Resultados', action2:'Reintentar' },
  save:    { sev:'recoverable', title:'No se pudo guardar la configuración',
             cause:'PUT /api/config → 500', action:'Reintentar guardado' },
  oom:     { sev:'fatal', title:'El render se quedó sin memoria',
             desc:'Chrome consumió toda la RAM. El pipeline procesa un video a la vez por esto mismo — esperá la cola y reintentá.',
             cause:'remotion-renderer killed (OOM, signal 9)', action:'Reintentar render', action2:'Ver en Cola' },
};
// severity routes the form: recoverable → inline at source; fatal → calm panel over the dimmed stage
```

## What to Avoid
- **Don't add global error chrome for recoverable faults.** A rejected upload belongs in the dropzone, a
  failed save on the chip — not a header banner (040-B over-weights small problems).
- **Don't alarm.** No saturated red banners; danger is **low-chroma `--danger`** as tint + thin border.
- **Don't borrow action-green** for any error treatment. Render-green is reserved.
- **Don't hide the real cause** *or* lead with it — show the plain-language explanation first, the
  `ECONNREFUSED`/`ENOSPC`/`signal 9` line muted in mono beneath.
- **Don't lock the whole editor on a transcription fault.** Say "el resto del editor sigue funcionando";
  the fatal-for-transcription panel dims only the stage.
- **Don't make the OOM error generic.** Name the single-job / Chrome-RAM cause plainly (same honesty as
  `batch-queue.md` and `background-notifications.md`); always offer Reintentar + Ver en Cola.

## Origin
Synthesized from sketch 040 (error-failure-states, winner **A** — inline at source; B = single header
banner over-weights small faults, C = severity triage takeover whose takeover idiom **folds into A** for
fatal blocks). Completes the off-happy-path coverage begun in `states-and-save-feedback.md` (008,
happy-path-off) and `background-notifications.md` (035, OOM *completion* as async toast — 040 is the
OOM/Whisper/disk fault *in the editor as it happens*). The save-failed chip extends
`header-action-zone.md` (013). Source file in `sources/040-error-failure-states/` (winner `#v-a`).
