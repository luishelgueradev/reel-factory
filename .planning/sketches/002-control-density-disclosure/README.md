---
sketch: 002
name: control-density-disclosure
question: "How should controls group and disclose within a tab so the panel reads as a deliberate control surface, not stacked forms?"
winner: "A"
tags: [density, disclosure, controls, phase-22, impeccable]
---

# Sketch 002: Control Density & Disclosure

## Design Question
The core `impeccable` question of Phase 22 (D-06, D-11): each tab orders its controls **Position → Style → Advanced**, with rarely-used controls disclosed. Which disclosure mechanism makes a dense dark panel feel intentional rather than like a pile of inline-styled forms?

## How to View
open .planning/sketches/002-control-density-disclosure/index.html

## Variants
- **A: Always-open titled sections** — numbered section headers (1 Posición · 2 Estilo · 3 Avanzado) with hairline dividers, everything visible. Fastest scan, tallest column. "Advanced" stays compact at the bottom.
- **B: Collapsible sections** — each group folds independently. Position + Style open by default; Advanced collapsed. Header shows a summary ("Inter · Bold · 40") and a dirty-dot when edited.
- **C: Accordion (one open)** — only one section open at a time; shortest column, but more clicks to move between Position and Style.

## Winner: A — rationale
Always-open titled sections won: fastest scan, no clicks to reach a control, and the height cost is absorbed by sketch 001-D's **two-column** layout (sections distribute across columns instead of one tall scroll). The Position→Style→Advanced order with hairline dividers gives the "deliberate panel" read without disclosure machinery. Collapsible/accordion (B/C) traded scanability for height we no longer need to save.

## What to Look For
- Does grouping + the Position→Style→Advanced order make the panel feel **deliberate**?
- A shows everything (scanability) vs B/C trade height for focus — which matches how you actually tune a reel?
- The collapsed-section summary line (B) and dirty-dot: useful at a glance, or noise?
- Density: section header size, row rhythm (label 80px + control), input/segmented/swatch sizing — does it read as a pro tool (Linear/Figma-grade) in the dark theme?
- This pattern must apply identically across Titles / Overlays / Subtitles — does it generalize?
