---
sketch: 018
name: dense-tabs-at-breakpoint
question: "Do 011-C/014-C's specimen + 4-up mode/entrance cards + 2x2 color matrix survive 006-B's single-column collapse at narrow width?"
winner: "B"
tags: [consistency, responsive, density, breakpoint, disclosure]
---

# Sketch 018: Dense Tabs at the Breakpoint

## Design Question
006-B proved the single-column collapse only on a **simplified** Subtitles tab. 011-C and 014-C
then loaded the tabs with real density — specimen, **4-up mode/entrance cards**, 2×2 color
matrix, font grid, collapsible effects — but always at **2-col desktop**. Those multi-up grids
were never drawn at the narrow breakpoint. This is the consistency check: does the dense styling
surface stay calm when the controls column collapses to one column (~360px)?

(Lower stakes than the frontier sketches — this is a desktop-first local studio — but it's the
one composition 015's north-star didn't cover.)

## How to View
open .planning/sketches/018-dense-tabs-at-breakpoint/index.html

Each variant renders the **Subtitles controls column at a fixed 360px** so the reflow is visible.

## Variants
- **A: Literal stack** — the 2-col form becomes 1-col, but the multi-up grids **don't change**:
  4 mode cards stay in a row, font grid stays 2-up. Shows the cramping (mode cards ~70px, font
  names truncated).
- **B: Reflow the grids** — same sections and order, all single column, but multi-up grids
  **reflow**: mode cards → **2×2**, font grid → **1-up** (full name), color matrix stays 2×2.
  Nothing cramps; cards still preview their behavior. Honors 002-A's always-open rule.
- **C: Priority + disclosure** — under width pressure, only the highest-leverage controls stay
  open (specimen · mode 2×2 · size · active color); the rest (full color, effects, advanced) fold
  behind a **"Más ajustes"** toggle. Deliberately **bends** 002-A's "no collapsible sections"
  rule — but only at the breakpoint. The open question: is that bend justified, or a slippery slope?

## What to Look For
- **Cramp test:** at 360px, do A's 4-up cards become unreadable? Is B's reflow the obvious fix?
- **Rule integrity:** B keeps everything always-open (002-A intact); C trades that for
  scannability. Does narrow width justify disclosure, or should the rule hold everywhere?
- **Card legibility:** do the mode-card behavior previews survive shrinking (A) vs reflowing (B)?
- **One rule, three tabs:** whatever wins must also collapse Títulos (entrance cards) and Overlays
  (list) cleanly — pick the reflow rule that generalizes.
