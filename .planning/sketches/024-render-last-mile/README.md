---
sketch: 024
name: render-last-mile
question: "010 stops at the 'Reel listo' card. Where does the finished reel actually land — download / locate the MP4, re-render, play — and does the metadata column wake up with the AI caption as the render's true payoff?"
winner: "B"
tags: [frontier, render, output, handoff, metadata, core-value, phase-22]
---

# Sketch 024: Render Last-Mile

## Design Question
Sketch 010 took the render *in-progress* surface to "Reel listo" and stopped. But the whole tool
exists to **produce a publishable reel** — and the last tramo was never drawn: where does the finished
MP4 go? Can you download it, find it on disk, play it, re-render after a tweak? And critically — does
the **metadata column** (a "Próximamente" placeholder in all 22 prior sketches) finally **wake up**,
turning the render's completion into its real payoff (the AI-generated caption + hashtags)?

This closes the core-value loop: *raw video → edited reel → ready to publish*.

## How to View
open .planning/sketches/024-render-last-mile/index.html

## Variants
- **A: Done-card on the stage + metadata wakes** — the render finishes over the preview (extends
  010-A): a "Reel listo" card with download, file path, and re-render, *without leaving the editor*.
  Separately, the metadata column transitions from asleep → **Generado**, animating in the AI caption.
  Lightest touch; you stay in the editing context.
- **B: Full-screen results takeover** — render completion routes to a dedicated results screen: the
  reel big and playable, with all deliverables (file + metadata) gathered. "I'm done, time to publish."
  Strong sense of completion; costs you the editor (one click back).
- **C: Output consolidates into the right column** — the stage returns to editing immediately; the
  metadata column becomes a **"Listo para publicar"** deliverables panel (file + caption + hashtags),
  reusing the space always reserved for it (echoes 010-C's output+metadata pairing). Finished reel and
  its metadata live together, the editor never blocks.

## What to Look For
- Where does your eye go when the render completes — does the finished file feel *findable* and
  *actionable* (download / path / play / re-render)?
- The **metadata wake** (A): switch to tab A to replay it. Does turning render-completion into the
  moment the AI caption appears feel like the right payoff, or like two unrelated things happening?
- Does pairing the output **with** the metadata (C) read as elegant consolidation, or does the right
  column get overloaded?
- Re-render: with the single-job pipeline constraint, does "↻ Render de nuevo" belong on the card (A),
  the results screen (B), or the deliverables panel (C)?
- Green discipline: note that **copy/generate use accent (blue)**, the green stays on Render only.

## Outcome — Winner: B (full results takeover)
The finished reel earns a **dedicated results screen** — big, playable, with the file + AI metadata
gathered as one "done, time to publish" moment. Chosen over the lighter stage-card (A) and the
right-column consolidation (C): the payoff of the whole pipeline deserves a real surface, not a card
tucked over the editor. Cost acknowledged (it leaves the editor; one click back). Pairs naturally with
**026-C** as the place the per-platform metadata lands.
