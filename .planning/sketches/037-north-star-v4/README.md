---
sketch: 037
name: north-star-v4
question: "Composed in the 033-B activity-rail shell, does the real dense editor (027-B: live caption preview + 4 dense tabs) still cohere — and where do the orphaned chrome bits rehome: the 034-A preset bar (its home was beside the brand, now in the rail) and the 035-D ✓3 ✕1 tally (its home was the header Editor⇄Cola vswitch, now deleted by the rail)?"
winner: "B"
tags: [consistency, composite, north-star, app-shell, integration]
---

# Sketch 037: North-Star v4 (real editor in the rail shell)

## Design Question
The chrome model changed under everyone's feet. Sketch **033-B** moved the brand into the **left
activity rail**, replaced the header's **Editor⇄Cola vswitch** with rail buttons, and made the header a
**purely-contextual** bar. But the canonical Editor screen (**027-B**) and two of the newest findings
were drawn against the *old header-resident model*:

- **034-A** put the preset bar `Estilo: [Mi estilo TikTok ▾]` **in the header next to the brand** — but
  the brand is now in the rail, so the bar's home is undefined.
- **035-D** hung the `✓3 ✕1` completion tally on the header **Editor⇄Cola vswitch** — but 033-B deleted
  that vswitch (Editor / Cola are rail icons now).
- **027-B** itself is now stale **as a whole-screen view** — it shows the header-resident frame.

This is the recompose-staleness cadence that already forced 015→023→027, now at the **whole-app** level.
It resolves real *conflicts*, not cosmetics, before the React shell gets built off a stale picture.

This sketch composes the **real dense editor** (live word-by-word caption preview from 025-C + the dense
Subtitles tab from 011-C + transport) inside the **033-B rail shell**, and explores three homes for the
preset bar. **The 035-D tally is rehomed onto the rail's Cola button in all three** (its honest new home
now the vswitch is gone — the rail Cola icon already carried a `.rdot` activity marker).

## How to View
open .planning/sketches/037-north-star-v4/index.html

The caption **plays** in the stage and in the in-panel specimen (one `paint()`, two surfaces, 025-C).
Open the `Estilo ▾` preset in each variant; the `✓3 ✕1` tally sits on the rail Cola button throughout.

## Variants
- **A: Preset in a sub-bar with the tabs** — the contextual header carries only `Editor` + status chip +
  Guardar + Render; a sub-bar below holds `Estilo ▾` (left) and the 4 content tabs. Separates "which look
  · which element" (sub-bar) from "save / render + status" (header). Two rows, each calm.
- **B: One dense row** — the preset takes the brand's freed left slot (the brand lives in the rail now),
  then the 4 tabs, then status + Guardar + Render, all in one header row. Densest, the Linear idiom — but
  the row carries a lot.
- **C: Preset on the rail (app-scope)** — the preset is treated as a *global* concept like ⚙: a mini
  swatch + `Estilo` label + Modificado dot sits at the top of the rail, freeing the header to be just
  tabs + status + actions. Tests whether a saved look is app-scoped (rail) or editor-scoped (header).

## What to Look For
- Does the **real dense editor** (live stage caption + the ~10-control Subtitles tab + 3-column shell)
  cohere inside the rail shell, or does the rail + contextual header feel like a different screen than
  the 027-B everyone has in their head?
- **Preset home:** A keeps the header calm but spends a second bar; B is one-row-dense but the header
  fills; C frees the header entirely but asks you to accept that a *look* is an app-global thing (next to
  ⚙ Procesamiento) rather than an editor control. Which reading of "what scope is a saved look?" is true?
- Is the **rehomed tally** (`✓3 ✕1` on the rail Cola button) legible and honest, or does it want to be
  back near an action?
- **Green discipline:** Render is the only green across all three; the preset, rail, and tally are all
  accent / neutral. Confirm nothing else greens.
- The rail's **active-item spine** (3px accent on the `on` button) is a nav indicator, not a card
  side-stripe — does it read as "you are here" cleanly?
