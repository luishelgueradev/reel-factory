---
sketch: 012
name: subtitle-density-in-shell
question: "Composed in the 001-D shell next to the simple Titles/Overlays list+form, does 011-C's full dense Subtitles (specimen + 4-up mode cards + 2×2 color matrix + collapsible effect-rows) still read as the same panel, or does Subtitles balloon into a different screen?"
winner: "B"
tags: [consistency, subtitles, density, coherence, integration, phase-22]
---

# Sketch 012: Subtitle Density in the Shell

## Design Question
Sketch 006 proved the coherence rule — *lists (Titles/Overlays) and the sample-text textarea span
full width; the Posición→Estilo→Avanzado form is always 2-col* — but it proved it on a **simplified**
Subtitles Estilo (size · peso · color · resalte · fuente). Then sketch 011-C changed Subtitles
dramatically against the real ~20-field caption schema: a full-width **specimen**, a 4-up **layout-mode
card row**, a 2×2 **color-role matrix**, and **collapsible effect-rows**. Those were validated *in
isolation*.

So 006's integration check is stale. This sketch re-runs it with the **real dense Subtitles** in the
shell, next to the still-simple Titles/Overlays. Switch tabs and watch the seam: when you go from a
6-row Título form to the dense Subtítulos surface, does it read as *one panel showing more*, or as a
*different screen*? The fix, if needed, is structural — not cosmetic.

## How to View
open .planning/sketches/012-subtitle-density-in-shell/index.html

**Try it:** each variant opens on **Subtítulos**. Switch to **Títulos** / **Overlays** and back to feel
the density jump. Type in the sample text, pick fonts/modes, toggle the Glow/Fondo effect-rows — the
phone caption (and the in-panel specimen, where present) update live.

## Variants
- **A: As decided (011-C verbatim in shell)** — the honest integration. Subtitles carries the full
  011-C treatment unchanged; Titles/Overlays use the 006-A list+form. Tests whether the as-shipped
  decision already coheres, or whether the density jump is jarring at the tab seam.
- **B ★ (winner): Lead-slot normalized** — formalize a shared skeleton every tab fills:
  a full-width **`tab-lead`** region (Titles/Overlays → card list; Subtitles → textarea + specimen +
  mode cards) followed by the **always-2-col `ctrl-2col` form**. The dashed frames + labels make the
  identical skeleton visible. Tests whether *naming the slot* turns the density jump into "same panel,
  fuller lead" — and hands the React build a literal `<TabLead>` / `<TabForm>` contract.
- **C: Trimmed (no in-panel specimen)** — the lightest Subtitles that still solves density: keep the
  mode cards, drop the in-panel specimen and lean on the full-size phone preview right next to it.
  Tests whether the specimen earns its vertical space when the real preview is one column over.

## What to Look For
- **The tab seam.** Switch Títulos ↔ Subtítulos repeatedly. Does the header/section vocabulary hold, or
  does Subtitles feel like it broke the rhythm? This is the whole question.
- **Lead-slot framing (B).** Do the labeled "ZONA CABECERA / FORMULARIO 2-col" frames make the coherence
  obvious, or do they over-explain something A already gets right?
- **Specimen value (C vs A/B).** With the phone preview right there, does the in-panel specimen still
  pull its weight, or is it redundant chrome?
- **Density read.** At ~20 controls, does Subtitles still feel like a deliberate Linear/Figma-grade
  panel, or does it tip into a wall the moment it's seen next to the lean Títulos form?
