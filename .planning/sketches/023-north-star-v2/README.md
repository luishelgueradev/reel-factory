---
sketch: 023
name: north-star-v2
question: "The 015 north-star predates 016–022. Recomposed with the 4th 'Video' tab (021), the timeline strip (020-C), list-forward overlays (019-C), and the font-sheet (016) — does the whole tool still cohere, does a 4-tab bar fit the header, and do the strip + numeric timing rows (022) read as coordinated not redundant?"
winner: "B"
tags: [consistency, composite, north-star, four-tabs, timeline, integration, phase-22]
---

# Sketch 023: North-Star v2

## Design Question
Sketch **015** drew "the whole tool in one screen" — but it was sketched *before* the seven decisions
016–022 landed. Since then the canonical composite has gone stale: it shows **3 tabs** (the real bar
now holds **4** — Títulos · Overlays · Subtítulos · **Video**, 021-A), has **no temporal axis**
(020-C added the timeline strip), and uses the old overlay list+form (019-C reconciled overlays to
**list-forward**, departing from the TabLead/TabForm contract). The font control is now a **slide-over
sheet** (016-C), and title timing is **numeric rows** (022-B).

This re-composes everything into one updated north star, and stress-tests three coherence questions
that were never drawn together:
1. **Does a 4-tab bar fit the header rhythm** — and does the thin "Video" tab (one control) belong
   beside three dense tabs? (Pushed right with `margin-left:auto` to read as "global vs per-frame".)
2. **Does the timeline strip + numeric timing rows (022-B) read as coordinated, not redundant** — the
   strip places a title block visually; the Tiempo rows refine `Aparece`/`Dura`/`Velocidad`.
3. **Do list-forward overlays sit coherently** next to the contract-following Títulos/Subtítulos tabs?

## How to View
open .planning/sketches/023-north-star-v2/index.html

## Variants
- **A: North star v2 (everything)** — the full vision post-016–022: 4 tabs incl. Video, the 020-C
  timeline strip under stage+controls (metadata full height), list-forward overlays, the 016 font
  sheet, 022-B numeric timing, drag-on-preview + render-on-stage. The aspiration.
- **B: Committed-scope slice (ships first)** — same 4 tabs (Video is a committed decision), but the
  timeline is collapsed, Render is ghosted, and the preview is click-to-select instead of drag. Names
  the plan-split boundary: B ships, A's frontier layers (007 drag · 010 render · 020 timeline) bolt on
  without rework.

## What to Look For
- Switch through all **four** tabs in A — does Video feel like it belongs, or like a stub crammed in?
- Open the **font sheet** (click the Fuente trigger in Títulos or Subtítulos) — does the slide-over
  sit right over the controls column without disturbing the rest of the shell?
- Scrub the **timeline strip** and click a title block — does jumping to a block + seeing its numeric
  Tiempo rows feel like one coordinated idea or two competing ones?
- Compare the **Overlays** tab (fat list-forward cards) against **Subtítulos** (lead + 2-col form) —
  does the density difference read as "same panel, different schema" or as drift?
- A vs B: is the boundary between *ship-now* and *frontier* legible and clean?

## Outcome — Winner: B (committed-scope slice)
The vision **coheres**, but the chosen direction is the **committed slice that ships first**, not the
everything-at-once north star. The 4-tab bar (Video pushed right) reads as "per-frame vs global"
without crowding; list-forward Overlays sit fine beside the contract tabs; the font sheet drops in
cleanly. The timeline strip + drag + render stay **frontier layers (A)** that bolt on later without
rework — the A↔B contrast names the plan-split boundary, exactly as 015 did. **B ships, A is the
roadmap.** Supersedes 015 as the current canonical screen.
