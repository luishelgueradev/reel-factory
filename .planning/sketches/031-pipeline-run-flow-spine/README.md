---
sketch: 031
name: pipeline-run-flow-spine
question: "When the user hits Render, what is the flow — and how do the independently-sketched winners reconcile (render-inline-on-dimmed-stage 010-A vs full-screen review takeovers w/ step-rail + Confirmar gates 028-B/029-B vs results takeover 024-B vs Editor⇄Cola switch 030)? Is inspection a pull or a push?"
winner: "A"
tags: [spine, run-flow, pipeline, inspection, render, consistency, integration, frontier]
---

# Sketch 031: Pipeline Run-Flow Spine

## Design Question
Four winners were each sketched in isolation and make **contradicting navigation choices that were never composed together**:

- **010-A (render):** render happens *inline on the dimmed preview* — "**no modal**."
- **028-B / 029-B (inspection):** transcript & silence-cut review are **full-screen takeovers** with a shared **step-rail** (Audio→Transcripción→Silencios→Render) and a "**Confirmar … →**" gate.
- **024-B (last-mile):** results is *another* **full-screen takeover**.
- **030-A (queue):** navigation is an **Editor⇄Cola** header switch — a third model.

So when you hit **Render**: does the stage dim (010) or does a stepped review wizard take over (028/029)? The core value promises *"revisar salidas intermedias antes de continuar"* — so inspection must be possible, but forcing it on every render is heavy. The spine question reduces to one axis: **is inspection a PULL (opt-in off an inline run) or a PUSH (forced gates in a takeover wizard)?**

## How to View
open .planning/sketches/031-pipeline-run-flow-spine/index.html

**This sketch is playable** — a flow can only be judged by feeling it. Press **▶ Render** in each variant to run the real states (Transcripción → Silencios → Render → results) and feel where the friction lands.

## Variants
- **A: Inline-first (review = pull)** — keeps 010-A as the spine. Render dims the stage; the 3-step pipeline runs *in the editor*. Each reviewable step **soft-pauses with a 3s auto-continue + a "Revisar" pull** (open 028/029 only if you want it). Editor⇄Cola switch stays present (the run lives in the editor). Lands on a small in-stage results card; the big 024-B takeover opens *if* you ask.
- **B: Gated wizard (review = push)** — Render *enters* a full-screen takeover; the **step-rail becomes the primary chrome** and replaces the Editor⇄Cola switch. **Hard "Confirmar →" gates** at Transcripción & Silencios (028/029 literally are the steps). Ends on the full 024-B results. A "Saltar revisión" escape turns the rest auto. Makes "inspeccionable" the default; cost = every render is a multi-click wizard.
- **C: Hybrid (toggle per render)** — a single **"Revisar cada paso"** toggle next to Render picks the rigor: OFF = A's inline soft run, ON = B's gated takeover. Same step model, one switch. The natural synthesis — trust-the-defaults *and* inspect-every-cut from one surface.

## Winner: A — rationale
**Inline-first, review = pull.** 010-A stays the spine — render runs on the dimmed stage, no wizard — and the run stays *inside the editor* so the Editor⇄Cola switch (030) persists and "I'm mid-render" reads honestly without a separate app mode. Inspection is a **pull**: each reviewable step soft-pauses with a 3s auto-continue + a "Revisar" affordance that opens 028/029 only on demand. This keeps render **fast for a trusted clip** while still honoring the "inspeccionable" promise. Crucially it stays coherent with the single-job/batch truth (030): a queued **batch runs auto** (you can't gate each), and you only ever gate the **one foreground job** you're driving — A models exactly that. B (forced wizard) was too heavy to pay on every render; C (per-render toggle) defers the decision instead of making one.

**Build notes:** the 3s soft countdown is the calibration to validate against real Whisper/cut latency (if a step takes 8s, the "Revisar" pull should stay available for the whole step, not just a 3s window after). The big 024-B results takeover is reachable from the in-stage card ("Abrir resultado →") but never forced.

## What to Look For
- **Does inspection feel earned or in-the-way?** A makes it a pull (fast, but a careless render skips review); B makes it a push (thorough, but heavy for a trusted clip).
- **The Editor⇄Cola relationship:** in A the run stays in-editor (switch persists); in B the wizard replaces the switch. Which reads as "I'm mid-render" more honestly?
- **Single-job coherence (030):** the gated review only makes sense for the *one foreground job you're driving* — a batch from the queue must run **auto** (you can't sit and gate each). Does the spine you pick stay honest about that?
- **The soft auto-continue countdown (A):** does "sigue en 3s… / Revisar" feel calm or anxious? Is 3s the right beat?
- **Where the green lives:** Render is green at idle; inside the flow the only green is the "Confirmar →" gate / "Continuar". Never two greens. Holds across all three?
- **C's toggle placement:** next to Render — clear enough, or should the rigor be a per-project setting instead of a per-render choice?
