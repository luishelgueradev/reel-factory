---
sketch: 010
name: render-export-surface
question: "The whole tool exists to produce a reel — where does render/export live in the shell, and what are its in-progress / done / failed states? (Touches the single-job pipeline: Whisper → silence-cut → Remotion.)"
winner: "A"
tags: [frontier, render, export, pipeline, states, phase-22]
---

# Sketch 010: Render / Export Surface

## Design Question
**Lateral / frontier — beyond Phase 22's committed scope.** Sketches 001–009 polished the *editing*
surface (preview · controls · metadata-placeholder), but the tool's whole reason to exist is to
**produce a reel** — and that action has no home in any sketch. "Render Video" has been a disabled
`Próximamente` ghost button the entire time.

So: where does render/export live, and what do its **idle → running → done → failed** states look
like? This is grounded in the real pipeline — **single-job** (`MAX_CONCURRENT_JOBS = 1`, can't run two
renders at once) running three steps: **Whisper transcription → FFmpeg silence-cut → Remotion render**.

**Surfaced tension (note for planning):** the design system reserves green for the *single* primary
action, currently `Guardar config`. But rendering is arguably the tool's *true* primary action. In all
three variants here, **Render Video takes the green** and `Guardar config` demotes to a secondary
outline button. That reassignment is a real decision to ratify or reject.

## How to View
open .planning/sketches/010-render-export-surface/index.html

**Try it:** click **Render Video** to run the pipeline (animated progress through the 3 steps → done).
Use the **estado** jumper (bottom-left) to inspect `idle / running / done / failed` directly in each
variant.

## Variants
- **A: On the preview** — Render is the green primary in the header. Running **overlays the dimmed
  preview** with a progress ring (% + current step) and the 3-step pipeline list; done swaps to a "Reel
  listo" card (file info + Descargar MP4 / Ver / Render de nuevo); failed shows the error inline (e.g.
  Remotion OOM at frame 612 + Reintentar). No modal — the stage *is* the render surface. Cost: you lose
  sight of the preview while it renders.
- **B: Bottom dock** — a **persistent render bar** docked under the controls column. Idle: "Listo para
  renderizar · Whisper → silencios → Remotion ~40 s" + the green button. Running: a horizontal stepper +
  progress bar + Cancelar, **with the preview still fully visible**. Done: a compact file row (reel.mp4 ·
  8.4 MB · Descargar / Ver). Always-present, low-drama, never hides the video.
- **C: Output column** — render moves into the **right column that was the metadata placeholder**. Trigger
  at the top; running shows the stepper there; done shows the finished reel **thumbnail + file actions**,
  and directly below it the (still-ghosted) **AI social metadata** — output and its caption living
  together. This is the variant that finally *justifies the third column's existence* before the AI phase
  ships.

## Winner: A — rationale (frontier / scope-expanding)
**Render on the preview** won. Making the dimmed preview *itself* the render surface — progress ring +
% + the live 3-step pipeline (Whisper → silence-cut → Remotion), then a "Reel listo" card with the file
and Descargar/Ver/Render-de-nuevo — keeps render where attention already is and needs no modal and no
new persistent chrome. For a single-job (`MAX_CONCURRENT_JOBS = 1`) ~40 s render, briefly covering the
preview is acceptable: you're not editing while it renders, and the focused progress reads *calmer*
than a dock blinking in the corner. The bottom dock (B) keeps the preview live and is the natural
fallback if losing the preview proves annoying in practice; the output column (C) had the best idea —
pairing the finished reel with its future AI metadata, the one thing that *justifies the third column* —
but overloads a column already earmarked for AI metadata, so keep C's "output + metadata together"
concept in reserve for the AI-metadata phase rather than now.

**Design-system decision ratified: Render takes the green.** Producing the reel is the tool's true
primary action, so `Render Video` becomes the green primary and `Guardar config` demotes to a secondary
outline button. This is a deliberate exception to the prior "single green = Guardar config" rule (and is
the *opposite* call from sketch 008, where the chip keeps Save as the lone green primary) — at planning
time, reconcile the two: green marks *the* primary action of the surface, which is Render here and Save
in the editing-only state. The fix in 008-B's note and this one must be read together.

Real-build notes: the pipeline steps map to real stages (Whisper transcription, FFmpeg silence-cut,
Remotion render); surface the single-job constraint by disabling Render while one is running; the
failure state should foreground the supersampling hint given the project's render-OOM history
(`[[renderer-sync-clobber-hazard]]`, scale:2 memory pressure).

## What to Look For
- **The green-reassignment:** does Render-as-primary-green (with Guardar config demoted) feel right, or
  does saving deserve to stay the primary? Can both be green, or does that break the "one primary" rule?
- **Preview visibility while rendering:** A hides the preview behind progress; B and C keep it live. For a
  ~40 s single-job render, does covering the preview matter, or is the focused progress (A) actually
  calmer?
- **Where does "done" want to live?** A celebrates in the stage; B tucks it into a file row; C parks it in
  a column you can leave open. Which matches how you'd actually grab the MP4 and move on?
- **Single-job reality:** the pipeline can only run one render at a time. Which surface communicates "a
  render is in progress, you can't start another" most naturally? (B's persistent dock and C's column both
  hold that state without a modal.)
- **C's column bet:** does folding render-output into the metadata column read as elegant consolidation,
  or does it overload a column that's also meant to hold AI metadata later? Does "Salida → then metadata"
  sequence make sense?
- **Failure:** is the error state (OOM at a frame + Reintentar / Ver log) actionable, or does it need the
  supersampling hint surfaced more prominently given the project's render-memory history?
