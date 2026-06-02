---
sketch: 033
name: nav-shell-v4
question: "Now that the Editor⇄Cola switch (030), the ⚙ Procesamiento sheet (032), and the run-flow spine (031) all exist, how does the whole app's resting-state wayfinding cohere — does the 013-B header still hold every entry point, or does the tool need an app-level nav surface distinct from the editor's contextual bar?"
winner: "B"
tags: [consistency, composite, north-star, navigation, app-shell, integration]
---

# Sketch 033: Nav Shell v4 (whole-app wayfinding)

## Design Question
The canonical screen (027 / north-star v3) was frozen before 030, 031, and 032 existed. Since then three navigation entry points were bolted onto the header without ever being drawn together: the **Editor⇄Cola** mode switch (030), the **⚙ Procesamiento** slide-over trigger (032), and the **run-flow spine's** inline render + "Revisar" pull (031). The header contract (013-B: status chip left · Guardar+Render right) was designed for *just the editor*. Does it still hold once it must also reach the queue, the results screen, and the global settings? This is the same recompose cadence that produced 015→023→027 — each time new surfaces accreted, the canonical screen went stale. It's due again, now at the **whole-app** level rather than the run-flow (which 031 already resolved).

## How to View
open .planning/sketches/033-nav-shell-v4/index.html

Switch destinations (Editor · Cola · Resultados) in each variant, and open the ⚙ slide-over, to feel the wayfinding.

## Variants
- **A: Todo en el header** — the top bar carries everything: brand · Editor⇄Cola⇄Resultados switch · ⚙ · status chip · Guardar · Render, with the four content tabs pushed to a sub-bar. One navigation row, but the header densifies and the app-level switch competes with the editor's own actions.
- **B: Riel de actividad (left)** — a thin 56px icon rail (Editor · Cola · Resultados · ⚙ · ?) owns "where am I in the app"; the header becomes the purely-contextual bar of the current destination (tabs + status + actions). The Linear/Figma idiom: separates app navigation from screen actions, header stays clean, scales to more destinations without crowding.
- **C: Híbrido** — the **Editor⇄Cola** switch (the two frequent modes) stays a header segment; the set-once-ish destinations (Resultados · ⚙ · command palette · shortcuts) collapse into a "⋯" app menu. Fewest visible pieces, the rare things hidden-but-reachable.

## What to Look For
- Does the **header crowd** in A once the app switch sits next to Guardar/Render? Two "navigation-shaped" controls (mode switch + content tabs) plus two actions plus a chip plus ⚙ is a lot for one bar.
- In B, does pulling app-nav to a left rail make the **header legible** again, and does the "contextual bar changes per destination" model read clearly (tabs only appear in Editor)?
- In C, is the **Editor⇄Cola-in-header / everything-else-in-⋯** split intuitive, or does burying Resultados feel like hiding the payoff of the whole tool?
- Across all three: is **green discipline** held (Render the only green; ⚙ neutral; Aplicar green only inside its own sheet)?
- Which model best honors "the tool disappears into the task" while staying honest about the 5 real destinations the app now has?
