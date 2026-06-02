---
sketch: 041
name: modal-stack-choreography
question: "One layering law for the six independently-sketched floating surfaces — which coexist, which dismisses which, scrim/focus/Esc policy, z-order?"
winner: "B"
tags: [consistency, layering, modals, overlays, focus, integration]
---

# Sketch 041: Modal-Stack Choreography

## Design Question
Six floating surfaces were each sketched in isolation and **never composed**: the font slide-over
(016), the ⚙ settings sheet (032), the ⌘K palette (036), the toast (035), the full-screen results
takeover (024), and the transcript/silence review takeovers (028/029). There's no layering law —
which can coexist, which dismisses which, scrim/focus-trap policy, what `Esc` does when two are
stacked, where the palette sits relative to a sheet. A pro tool with this many overlay idioms needs
one stacking contract before they collide at build.

## How to View
open .planning/sketches/041-modal-stack-choreography/index.html
→ Open surfaces from the **dock at the bottom**; press **Esc** (or the dock's Esc) to pop the top;
**⌘K** opens the palette; click the scrim to dismiss.

## Variants
- **A: Single-surface law** — one floating thing at a time. Opening anything dismisses the prior; the palette replaces a sheet rather than stacking. Calmest, zero focus ambiguity — but you lose "⌘K while a sheet is open."
- **B: Layered z-ladder** — a defined ladder: toast (60, never traps focus) ▸ palette (40, opens *over* a sheet, returns to it on Esc) ▸ takeover (30, owns the screen) ▸ sheets (20). A real stacking contract; the legend shows the live rungs.
- **C: Two planes (transient vs destination)** — reframes the problem: takeovers (Resultados/Revisión) are **destinations** reached via rail/flow, not floats — they replace the editor. Only sheets + palette + toast actually float. Fewest true overlays; most "modals" turn out to be navigation.

## What to Look For
- When a sheet is open and you hit ⌘K — should the palette stack over it (B), replace it (A), or is that combination impossible by construction (C)?
- Does a takeover (results/review) belong in the *float* stack at all, or is it a **destination** (C's claim, consistent with 031 "review = pull" and 033 rail navigation)?
- Toast behavior: it should survive a takeover opening (it's a courtesy record) and never trap focus — do all three honor that?
- Which model needs the *least* explaining? The right layering law is the one the user never has to think about.
- Likely synthesis: **C's two-planes reframe** (takeovers = destinations) for the genuinely-floating few, with **B's z-ladder** governing toast/palette/sheet coexistence.
