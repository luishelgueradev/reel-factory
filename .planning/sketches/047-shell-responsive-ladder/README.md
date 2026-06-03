---
sketch: 047
name: shell-responsive-ladder
question: "The whole 3-column shell + 56px rail collapse sequence — 3-col → 2-col → stacked, where the rail and persistent metadata column go (distinct from 018's tab-level reflow)?"
winner: "A"
tags: [consistency, responsive, shell, breakpoint, layout, rail]
---

# Sketch 047: Shell Responsive Ladder

## Design Question
018 reflowed the **dense tabs inside a narrow controls column** (form 2→1 col, cards → 2×2). This
is the tier above it: the **whole shell** — the 56px rail + content-sized preview + controls +
persistent metadata column — in what order does it collapse as the window narrows? The MANIFEST
only notes "collapse the two internal columns"; the shell-level sequence (where the rail goes, when
the persistent metadata column yields, whether preview stacks above controls) was never drawn.

## How to View
open .planning/sketches/047-shell-responsive-ladder/index.html

Each variant shows the shell at **three widths** (≥1100px · ~820px · ≤620px) so you can read the
collapse sequence top to bottom.

## Variants
- **A: Metadata yields first** — the metadata column is a "Próximamente" placeholder (lowest value today), so it folds to a toggle tab at the first squeeze; controls go 1-col; preview stacks last; the rail persists throughout (never a bottom bar). One piece moves per step.
- **B: Internal columns first** — honor 018's 2→1 form rule at shell scale *before* touching metadata (defending the reserved AI-column width longer); metadata folds only at the smallest, where the rail also becomes a bottom bar. Bets the metadata earns its space even when cramped.
- **C: Rail → bottom bar early (preview-priority)** — the rail drops to a bottom bar at the medium width to free horizontal room, treating the 9:16 preview as the hero; mobile-app idiom. Good if the tool is used on tablets, heavy if it's desktop-only (the Linear/Figma rail is the identity).

## What to Look For
- **What should yield first?** A's answer (the placeholder metadata) is the obvious one *while it's still "Próximamente"* — but B bets it'll be the awake per-platform AI column (026) by then and defends its width. Which future do you design for?
- **Does the rail survive?** The 56px activity rail (033-B) is the app's Linear/Figma identity. A/B keep it to the end; C trades it for a bottom bar early. Does losing the rail cost the tool's character?
- **Preview stacking** — when it goes single-column, the 9:16 preview pins to the top and controls scroll below. Does that read right for a preview-driven tool?
- **Relationship to 018** — this is the outer ladder; 018 is the inner one. They should compose: shell goes 1-col (here) → then the tab inside reflows (018).
- **Is multi-viewport even in scope?** This is a local desktop studio (port 3123, also behind a tunnel). If it's desktop-only, A's minimal ladder is enough and C is over-built; flag at build whether tablet matters.
