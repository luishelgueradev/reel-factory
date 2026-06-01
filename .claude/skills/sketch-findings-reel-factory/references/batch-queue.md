# Batch Queue / Multi-Job Status

The project promises *"capacidad de procesamiento individual y por lotes"* and ships a real `queue.ts`
(BullMQ) with `BatchJob{ jobId, filename, status: queued|active|completed|failed, currentStep?, error? }`
— but the Studio only ever shows **one** video. The design problem is **honesty**: show N videos moving
through a pipeline that runs **exactly one at a time** (`MAX_CONCURRENT_JOBS=1` — two renders spawn two
headless-Chrome instances and **OOM**), with per-job step/status/error and add/reorder/cancel/retry.

⚠️ **Scope-expanding / ops** — reachable via an **Editor ⇄ Cola** view switch in the header. Likely a
later milestone; for a one-person local studio it may be an ops view, not core. Idiom is settled.

## Design Decisions

### A — queue list (winner): honest, dense, scannable
Sectioned rows, the single active job unmistakable:
- **Procesando ahora** — one expanded row with an **inline 3-step pipeline** + progress bar + ETA.
- **En espera** — numbered (`1.`, `2.` …), **drag-to-reorder**.
- **Fallaron** — the failed job with its **real error** and a single **↻ Reintentar**.
- **Terminados** — done jobs with **⤓ Descargar**.
- **A concurrency banner** states the 1-at-a-time rule plainly (full string below). This is the design's
  whole point: the constraint is stated as fact, not hidden or apologized for.

### Why A over the alternatives
- **B (kanban: Queued · Procesando · Listos · Fallaron)** — visual, but the "Procesando" column is
  hard-capped at 1 (labelled `· máx 1`), which **exposes how little parallelism exists**. A kanban
  *implies flow* the single-job pipeline doesn't have — the metaphor oversells. Rejected for dishonesty.
- **C (active-job hero + strip)** — a big card for the one job rendering now (scanning thumbnail,
  3-step pipeline, progress ring, ETA, cancel) with everything else in a compact strip. Honest and
  focused, but a full hero for one job under-uses the width when you're managing a batch. Kept as the
  "foreground what's happening now" alt.

### The honesty rule (the finding)
**State the single-job constraint as plain fact, not apology.** A's banner does it best because it's
*ambient context* (top of the list), not a structural cap the user bumps into (B's capped column) or
the whole layout premise (C). The **real OOM error** shown on the failed job — `Render agotó la memoria
(OOM) — Chrome headless. Reintentá solo.` — reads as **trustworthy** (the documented two-renders hazard,
surfaced), not alarming, *because* the banner already explained why only one runs.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### Concurrency banner — the honesty surface (ambient, accent-tinted, not a warning)
```css
.concbar { display:flex; align-items:center; gap:var(--s-5); padding:var(--s-5) var(--s-12);
           background:var(--accent-tint-2); border-bottom:1px solid var(--border);
           font-size:var(--t-xs); color:var(--text-2); }
.concbar .ic { color:var(--accent); }      /* ⚙ — accent, NOT a danger/warning color */
.concbar b   { color:var(--text); font-weight:600; }
```
```html
<div class="concbar"><span class="ic">⚙</span>El pipeline procesa <b>un video a la vez</b> — cada job
  levanta Chrome headless para renderizar, y dos en paralelo agotan la RAM. Los demás esperan en orden.</div>
```

### Status atoms — dot + pill, color-coded by `BatchJob.status`
```css
.d.queued { background:var(--text-muted); } .d.active { background:var(--accent); }
.d.completed { background:var(--success); }  .d.failed { background:var(--danger); }
.st.queued { color:var(--text-muted); background:var(--surface-2); }
.st.active { color:var(--accent);     background:var(--accent-tint); }   /* + a spinner */
.st.failed { color:var(--danger);     background:oklch(0.63 0.185 25 / 0.12); }
```

### Active row — inline pipeline steps + live progress (the one expanded job)
```css
.jrow.activej { border-color:var(--accent-strong); background:var(--accent-tint-2); }  /* the active job stands out */
.jrow .drag   { color:var(--text-faint); cursor:grab; }                                /* waiting rows reorder */
.psteps .ps.done .pn { background:var(--success); color:var(--stage); border-color:transparent; }
.progress   { height:5px; border-radius:var(--r-full); background:var(--surface-2); overflow:hidden; }
.progress i { display:block; height:100%; background:var(--accent); transition:width .25s var(--ease); }
.eta { font-size:var(--t-xs); color:var(--text-2); font-variant-numeric:tabular-nums; }
```

### The failed job — real OOM error + single retry
```js
{ jobId:'d9a4', filename:'detras-de-camara.mp4', status:'failed',
  error:'Render agotó la memoria (OOM) — Chrome headless. Reintentá solo.' }
```
```html
<div class="errline">⚠ ${j.error}</div> <button class="ibtn">↻ Reintentar</button>
```

### Green discipline
The progress/active accents are **blue**; the action-green is **not** spent on queue chrome. A render's
green primary belongs on the editor/render surface, not multiplied across queue rows.

## What to Avoid
- **Don't use a kanban** (B) for this pipeline — it implies parallel flow that `MAX_CONCURRENT_JOBS=1`
  forbids, then has to hard-cap the "Procesando" column at 1, which looks awkward and oversells capacity.
- **Don't hide or apologize for the single-job limit.** State it as plain ambient fact (the accent-tinted
  banner). It's a deliberate constraint (Chrome OOM), not a shortcoming to bury.
- **Don't dress the OOM failure as a generic error.** Show the *real* documented cause + a single retry;
  paired with the banner it reads as honest, not alarming.
- **Don't multiply action-green across queue rows.** Status is accent/semantic; green stays the render
  primary on its own surface.
- **Don't over-build for a personal tool** — drag-to-reorder the waiting queue is the ceiling of control
  worth adding; this is a local single-person studio, not a render farm.

## Origin
Synthesized from sketch 030 (batch-queue, winner A — queue list; B = kanban [oversells parallelism],
C = active-hero + strip). Grounded in the real `queue.ts` BullMQ `BatchJob` shape and the hard
`MAX_CONCURRENT_JOBS=1` / Chrome-OOM constraint from AGENTS.md. Reached via the header Editor ⇄ Cola
switch. Source file in `sources/030-batch-queue/` (winner `#v-a`, marked ★ in the variant nav).
