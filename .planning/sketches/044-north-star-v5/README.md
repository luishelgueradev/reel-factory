---
sketch: 044
name: north-star-v5
question: "Do the four newest laws (040 errors, 041 z-ladder, 042 canvas handles, 043 intro/outro) cohere in the canonical Editor — and does the stage get over-busy when every on-canvas affordance is live at once?"
winner: "B"
tags: [consistency, composite, north-star, integration, recompose]
---

# Sketch 044: North-Star v5

## Design Question
The canonical Editor screen is **037 (v4)**, but it predates the last four sketches shipped:
**040** (inline error vocabulary), **041** (the modal z-ladder), **042** (on-canvas resize
handles + anchor snap + layer chips), **043** (intro/outro timeline endcaps). By the project's
~10-sketch recompose cadence (015 → 023/027 → 037), a v5 integration check is due. Specifically:
**042's direct-manipulation stage has never been composed with 039's PNG + 007 drag + the live
caption all at once** — does the stage drown? And do 040's faults + 041's layering law hold in the
full rail shell?

## How to View
open .planning/sketches/044-north-star-v5/index.html

Try the three `▸` law-buttons on the stage in each variant: simulate Whisper down (040),
open the ⚙ sheet (041 z-ladder), fire a toast over it (z60).

## Variants
- **A: Máxima (everything on)** — handles + 9-anchor field + layer chips + animated caption + intro/outro endcaps + expanded timeline, all live simultaneously. The saturation stress test.
- **B: Committed slice** — the ship-first cut: live caption + click-to-select (handles only on selection), timeline collapsed, intro/outro dormant. Frontier layers present but at rest. Follows the A↔B scope-boundary tradition of 015/023/027/037.
- **C: Progressive (one affordance at a time)** — nothing extra on the canvas until you select; timeline expands on demand; intro/outro dashed (dormant). The discipline answer to A's busy-ness.

## What to Look For
- **Does A drown?** With handles + anchors + chips + caption + endcaps all on, is the stage legible or noisy? This is the core integration question.
- **Does the z-ladder hold?** Fire a toast while the ⚙ sheet is open — toast (z60) should sit over the scrim+sheet (z20) without closing it; Esc closes the sheet, leaves the toast.
- **Does the fault stay calm?** The Whisper-down panel dims the stage but keeps the editor working; danger is low-chroma red, never action-green.
- **Where do intro/outro live?** Endcaps bracket the timeline body track (whole-clip category) — legible as "bookends"? And honest as dormant in C?
- **A↔B as the plan-split boundary** — same as prior north-stars: B ships, A's frontier layers bolt on later.
