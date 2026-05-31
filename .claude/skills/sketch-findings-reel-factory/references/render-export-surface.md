# Render / Export Surface (frontier)

> ⚠️ **Scope-expanding / frontier.** Like sketch 007, this explores *beyond* Phase 22's committed
> editing-surface scope. The whole tool exists to produce a reel, but "render/export" had no home in
> sketches 001–009 (it was a disabled `Próximamente` ghost button). Treat as validated direction for
> when render lands, not as committed Phase 22 work.

## Design Decisions

**Winner: Sketch 010 variant A — render on the (dimmed) preview. No modal.**

Render is the **green primary in the header**. While running, it **overlays the dimmed preview** with:
- a **progress ring** (% + current step name)
- the **3-step pipeline list** — Whisper transcription → FFmpeg silence-cut → Remotion render

States:
| State | Surface |
|-------|---------|
| idle | green `Render Video` primary in header |
| running | dimmed preview + progress ring + 3-step pipeline (no modal) |
| done | `Reel listo` card — file info + `Descargar MP4` / `Ver` / `Render de nuevo` |
| failed | inline error on the stage (e.g. Remotion OOM at frame 612) + `Reintentar` |

### Why this won
- **Render where attention already is** — the stage *is* the render surface; no modal, no new
  persistent chrome.
- **Calm for a single-job ~40s render** — you're not editing while it renders, so briefly covering
  the preview is acceptable, and focused progress reads calmer than a dock blinking in a corner.
- **Fallbacks held in reserve:**
  - **Variant B (bottom dock)** keeps the preview live throughout — the natural fallback if losing
    the preview proves annoying in practice.
  - **Variant C (output column)** had the best *idea* — pairing the finished reel with its future AI
    social-metadata in the third column, the one thing that finally justifies that column — but
    overloads a column already earmarked for AI metadata. **Keep C's "output + metadata together"
    concept in reserve for the AI-metadata phase.**

## Green-primary rule — RATIFIED (context-dependent)

Producing the reel is the tool's *true* primary action, so **`Render Video` takes the green and
`Guardar config` demotes to a secondary outline button** while render is the surface's focus. This is
the deliberate exception to the prior "single green = Guardar config" rule, and the **opposite call
from sketch 008-B** (where Save keeps the green in the editing-only state).

**Reconciliation (the ratified rule):** green marks **THE single primary action of the *current*
surface** — `Render` when render is in play, `Save` in the editing-only state. Read the 008-B note
and this one together. Never two greens at once.

## Real-build notes
- Pipeline steps map to **real stages**: Whisper transcription, FFmpeg silence-cut, Remotion render.
- **Surface the single-job constraint** (`MAX_CONCURRENT_JOBS = 1`): disable `Render` while one is
  running — communicates "you can't start another" without a modal.
- **Failure state should foreground the supersampling/OOM hint** given the project's render-memory
  history — see `[[renderer-sync-clobber-hazard]]` and the scale:2 memory pressure. Error should be
  actionable (frame of failure + `Reintentar` / `Ver log`), not just "render failed".

## CSS Patterns

```css
/* dimmed preview as render surface */
.preview.is-rendering::after {
  content: ""; position: absolute; inset: 0;
  background: oklch(0.12 0.03 275 / 0.6); border-radius: inherit;
}
.render-overlay { position: absolute; inset: 0; display: grid; place-content: center; gap: var(--s-6); }
.progress-ring { /* SVG stroke-dashoffset driven by % */ }
.pipeline-step.is-active { color: var(--accent); }
.pipeline-step.is-done   { color: var(--success); }

/* green reassignment: Render primary, Save demotes */
.btn-render { background: var(--action); color: #fff; }
.btn-save-secondary { background: transparent; border: 1px solid var(--border); color: var(--text-2); }
```

## What to Avoid
- **A render modal** — breaks the "stage is the surface" calm; unnecessary chrome.
- **Two green buttons at once** (Render + Save both green) — violates the one-primary rule; pick by
  current surface focus.
- **A generic "render failed"** — without the frame/OOM/supersampling context it's not actionable
  given this project's render-memory history.
- **Overloading the metadata column with render output now** (variant C) — reserve that pairing for
  the AI-metadata phase.

## Origin
Synthesized from sketch: 010 (winner A — frontier / scope-expanding)
Source file available in: sources/010-render-export-surface/index.html
