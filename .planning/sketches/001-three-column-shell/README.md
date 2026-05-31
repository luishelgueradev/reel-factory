---
sketch: 001
name: three-column-shell
question: "Does the preview | controls | metadata 3-column layout feel right, and how much room should the metadata placeholder column get?"
winner: "D"
tags: [layout, shell, phase-22, metadata-placeholder]
---

# Sketch 001: Three-Column Shell

## Design Question
Phase 22 (D-01) commits to a 3-column workspace: **live 9:16 preview · controls · social-media metadata summary**. The metadata column is a *placeholder only* this phase ("Metadata de redes — próximamente"). How should the three columns share the width, and how present should the not-yet-functional metadata column be?

## How to View
open .planning/sketches/001-three-column-shell/index.html

## Variants
- **A: Balanced thirds** — flexible preview, fixed ~380px controls, persistent ~320px metadata. Metadata always visible, full ghost scaffolding (título / descripción / hashtags / plataformas).
- **B: Preview-dominant + narrow rail** — preview takes the lion's share; metadata shrinks to a slim ~240px rail with condensed ghost fields. Keeps focus on the video.
- **C: Collapsible metadata** — controls get the room; metadata collapses to a 46px edge rail (vertical label) and expands on click.
- **D ★ (winner — synthesis): slim preview + 2-column controls + persistent metadata** — the 9:16 preview is **content-sized** (`flex: 0 1 470px`) so it stops wasting width around the height-bounded phone; the freed space goes to the controls column, which **grows to fill** and lays each tab out in **two internal columns** (left: Posición + Avanzado, right: Estilo). Metadata stays a **persistent ~320px column** (no collapse). Folds the 002-A always-open sections and 003-B arrow presets into the real shell.

## Winner: D — rationale
- The preview is height-bounded; giving it flex *width* only padded empty space. Content-sizing it frees real estate for the information-dense controls column.
- Controls are the work surface, so they get the room — distributed across two internal columns per tab to avoid a tall single-column scroll.
- Metadata stays **always visible** (not collapsible). The collapse animation reflowed the 2-column controls grid and read as a "weird effect"; a fixed, persistent placeholder column is calmer and locks the final layout for the future AI-metadata phase.
- Responsive note for the real build: collapse the controls' two internal columns to one below a width breakpoint.

## What to Look For
- Two-column controls split balance (Posición+Avanzado | Estilo) — comfortable, or regroup?
- Is the preview still large enough to judge subtitle/title crispness (the project's quality bar)?
- The "Próximamente" badge + dashed ghost fields: reads as "coming soon" without looking broken?
