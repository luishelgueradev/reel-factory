---
sketch: 039
name: overlay-png-acquire
question: "How do you add a PNG overlay — acquire (drop/upload) → preview (transparency checkerboard) → place (on the 9:16 canvas) — and what's the empty→first-overlay transition + the live 3-overlay cap? The Overlays tab (019) managed existing overlays; the acquisition moment was never its focus."
winner: "B"
tags: [frontier, overlays, png, upload, canvas, phase-21]
---

# Sketch 039: PNG Overlay Acquisition (drop → preview → place)

## Design Question
Phase 21 (png-overlays) is live. The Overlays tab (**019-C**, list-forward) was sketched managing
*existing* overlays: per-item width / opacity / Capa (Detrás/Delante) / anchor. But the **acquisition
moment** — drop or upload a PNG, see its **transparency** legibly, **place** it on the 9:16 canvas, and
the **empty→first-overlay** transition — was never its focus. This sketch fills that gap, honest about
the real schema: overlays carry width / opacity / layer / 9-point anchor (003 presets), **max 3** (the
cap, OOM-adjacent resource limit), and PNG transparency rendered as a **checkerboard** so a transparent
asset reads as transparent, not black.

The impeccable **"no modal-as-first-thought"** law shaped the variants: the file-picker-modal temptation
(C) is reframed as an *inline* placement step, and the inline-dropzone / canvas-drop paths lead.

## How to View
open .planning/sketches/039-overlay-png-acquire/index.html

Each variant **starts empty**. Add PNGs (clicking the dropzone/button "drops" a canned asset — logo,
arrow, subscribe) and watch the empty→first transition, the checkerboard thumbnails, and the **3/3 cap**
disable acquisition. Use **↺ reiniciar** (header) to return to empty. Select an overlay to edit it inline
(opacity / Capa / position presets) and see it move on the stage.

## Variants
- **A: Dropzone in the tab** — the Overlays tab's empty state **is** a dropzone; dropping a PNG adds a
  019-C list card (checkerboard thumb) and lands the overlay on the canvas at its default anchor. After
  the first, the dropzone shrinks to a mini "drop another" affordance. Fully inline, no modal. 3/3
  disables it. *(The path of least resistance for the React build: it reuses 019-C + 017's dropzone.)*
- **B: Drop onto the canvas** — drag a PNG **directly onto the 9:16 stage**; it lands **where you drop
  it** (tied to the 007 drag-to-position frontier), then appears in the list. **Acquire = place**, one
  gesture. Hovering the mini dropzone arms the canvas drop target.
- **C: Add button → inline placement step** — an `＋ Agregar overlay PNG` button picks the file, then an
  **inline placement bar** (position presets + "or drag it on the video" + Agregar/Cancelar) confirms
  before committing. The most guided; tests whether an explicit place-step helps or just adds friction.
  *(Deliberately not a modal — the bar lives in the panel.)*

## What to Look For
- **Empty→first transition:** does the tab teach "drop a PNG here" in its empty state (A/B) without a
  separate onboarding, or does the explicit button (C) read clearer for a rarely-used feature?
- **Transparency legibility:** the checkerboard thumb + checkerboard on-canvas backing — does a PNG with
  transparency read as transparent at a glance? (Critical for Phase 21: a logo with alpha must not look
  like a black box.)
- **Acquire vs place:** B unifies them (drop = position); A and C separate them (drop, then adjust). For
  a precise control tool, is "lands where I drop it" better, or "lands at a known anchor, then I refine"?
- **The 3-cap:** is the `3/3` counter + disabled dropzone honest and calm, matching the 008-B cap state,
  rather than an error?
- **Coherence with 019-C:** the added cards are the list-forward overlay cards from 019 — does acquisition
  flow *into* that existing surface cleanly, or does it feel bolted on?
- **Green discipline:** Render stays the only green; the dropzone, add button, and placement-confirm are
  all accent / outline. Delete is a quiet danger-on-hover, not a red button.
