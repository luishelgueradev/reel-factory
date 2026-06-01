---
sketch: 030
name: batch-queue
question: "The docs promise 'procesamiento individual y por lotes' (real BullMQ queue) but the Studio is single-video. What does a multi-video queue / job-status view look like, representing N videos through a strictly single-job pipeline while surfacing the 1-at-a-time constraint honestly?"
winner: "A"
tags: [frontier, batch, queue, jobs, ops, scope-expanding]
---

# Sketch 030: Batch Queue / Multi-Job Status

## Design Question
The project promises *"capacidad de procesamiento individual y por lotes"* and ships a real
`queue.ts` (BullMQ) with `BatchJob{jobId, filename, status: queued|active|completed|failed,
currentStep?, error?}` — but the Studio only ever shows **one** video. The hard constraint:
`MAX_CONCURRENT_JOBS=1` (two renders spawn two headless-Chrome instances and **OOM**). So the design
challenge is honesty: **how do you show N videos moving through a pipeline that runs exactly one at a
time**, with per-job step/status/error and the ability to add, reorder, cancel, and retry?

## How to View
open .planning/sketches/030-batch-queue/index.html

The active job's progress advances live. The batch has 6 jobs: 2 done, 1 rendering, **1 failed with
a real OOM error**, 2 queued.

## Variants
- **A: Queue list** ★ (default) — sectioned rows: **Procesando ahora** (one expanded row with inline
  3-step pipeline + progress bar + ETA), **En espera** (numbered, drag-to-reorder), **Fallaron**
  (the OOM job with retry), **Terminados** (download). A concurrency banner states the 1-at-a-time
  rule plainly. Dense, honest, scannable; the single active job is unmistakable.
- **B: Kanban columns** — Queued · Procesando · Listos · Fallaron. Visual, but the "Procesando"
  column is hard-capped at 1 (labelled "máx 1"), which exposes how little parallelism there is — a
  kanban implies flow the single-job pipeline doesn't have. Tests whether the metaphor oversells.
- **C: Active-job hero + strip** — a big card for the **one job rendering now** (scanning thumbnail,
  3-step pipeline, progress ring, ETA, cancel), with everything else in a compact queue/done/failed
  strip below. Foregrounds "what's happening right now" given only one thing ever is.

## What to Look For
- **Does the surface tell the truth about concurrency?** A states it in a banner; B exposes it as a
  capped column (maybe awkwardly); C makes it the whole layout premise. Which reads as honest rather
  than apologetic?
- The **OOM failure** is real (the documented two-renders-at-once hazard). Does showing it as a
  failed job with the actual error + a single-retry feel trustworthy, or alarming?
- For a one-person local studio, is a batch queue even the **right surface** in the Studio, or an
  ops view that belongs elsewhere? (Note the Editor ⇄ Cola view switch in the header.)
- Drag-to-reorder the waiting queue (A): meaningful control, or over-engineering for a personal tool?
- Does B's kanban earn its width, or does A/C's "one active, rest waiting" model fit the pipeline's
  reality better?
