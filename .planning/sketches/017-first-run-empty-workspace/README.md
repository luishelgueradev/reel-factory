---
sketch: 017
name: first-run-empty-workspace
question: "What does the whole 3-column shell look like cold — no video, nothing configured — and where does the single primary action (load a video → green) live?"
winner: "B"
tags: [frontier, empty, onboarding, first-run, states]
---

# Sketch 017: First-Run Empty Workspace

## Design Question
Sketch 008 validated the *no-video preview tile* in isolation. This sketch asks the bigger
question: what does the **entire 3-column shell** look like the very first time you open the
studio — no video loaded, nothing configured? It's the literal first impression of the tool.

Two sub-questions:
1. Are the rich controls **gated** (nothing to edit yet), **live with defaults** (pre-configure
   your look), or **hidden behind a welcome**?
2. Where does **green** go? Green = the single primary action of the current surface. With no
   video, Guardar and Render are inert — so the one primary action is *load a video*.

## How to View
open .planning/sketches/017-first-run-empty-workspace/index.html

## Variants
- **A: Guided empty (controls gated)** — the stage shows a big dropzone hero; the controls column
  is present but **dimmed behind a soft gate** ("Cargá un video para editar"). One unambiguous
  next step. Green lives only on the dropzone's "Elegir archivo".
- **B: Controls live with defaults** — same dropzone, but the **controls are fully live**. A
  banner frames them as "configurando los valores por defecto". Lets you set your look before the
  video lands. The tool never feels locked.
- **C: Welcome takeover** — a centered welcome card over a dimmed shell: brand, one-line value
  prop, the 3-step pipeline, and a **green "Subir video"** primary + secondary "Ver un ejemplo".
  Dismisses into the working shell after upload.

## What to Look For
- **Invitation vs broken:** does the cold start clearly invite the one action, or read as a
  half-loaded screen?
- **Gated vs live controls:** is the dense panel reassuring when visible (B), or just noise you
  can't act on yet (A/C gate it)?
- **Green discipline:** exactly one green, on the true primary action (load/upload). Guardar
  disabled, Render ghosted — consistent with the 008/010/013 rule.
- **Persistent metadata column:** the "Próximamente" placeholder is present even cold (D-01).
- **Register fit:** is a welcome takeover (C) right for a single-purpose *local* studio, or too
  heavy versus just showing the dropzone (A/B)?
