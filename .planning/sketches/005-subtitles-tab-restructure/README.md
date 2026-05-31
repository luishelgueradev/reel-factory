---
sketch: 005
name: subtitles-tab-restructure
question: "Does the sample-text textarea moved to the top of the Subtitles tab (D-10) sit gracefully above Posición→Estilo→Avanzado in the dense 2-col grid, or break the row rhythm?"
winner: "C"
tags: [subtitles, tabs, textarea, phase-22, D-10]
---

# Sketch 005: Subtitles Tab Restructure

## Design Question
Phase 22 **D-10** removes the standalone "Text" tab and moves the sample-text `<TextareaInput>` to the **top of the Subtitles tab**, above the layout/style/font controls. Final tabs: Titles | Overlays | Subtitles.

The textarea is the one control much **taller** than the compact rows the density vocabulary (sketch 002) was tuned for, and 001-D's controls now live in a **two-column grid**. So: where does a multi-line textarea go without breaking the dense rhythm — and does it stay clear that this text *drives the live preview but is not exported*?

## How to View
open .planning/sketches/005-subtitles-tab-restructure/index.html

## Variants
- **A: Full-width banner** — the textarea is a full-bleed "Texto de muestra" section spanning the whole controls width, sitting **above** the 2-col grid (Posición + Avanzado | Estilo). The big input gets room; the dense grid stays intact below.
- **B: In-column section** — the textarea is the first section inside the **left column** of the 2-col grid, strictly preserving the two-column structure. More compact, but the textarea is narrower / more cramped.
- **C: Condensed / expanding** — the textarea starts as a single-line condensed field and expands on focus. Treats sample text as set-once, keeping maximum density when you're not editing it. (Focus the field to see it grow.)

## Winner: C — rationale
**Condensed / expanding** won. Sample text is a *set-once* input that drives the preview but isn't
exported, so it shouldn't permanently occupy the most valuable vertical space above the controls.
Collapsed to a single line, it keeps the dense panel intact and the Posición→Estilo→Avanzado grid
front-and-center; on focus it grows to a comfortable multi-line editor, then settles back. The blue
"Alimenta los subtítulos" dot keeps its role legible in either state. The full-width banner (A) was
the safest and most obvious but spent height on a field you rarely re-edit; the in-column textarea
(B) preserved the strict 2-col grid but felt cramped for editing a full sentence.

Real-build notes: condense to one line by default (`white-space: nowrap; text-overflow: ellipsis`),
expand on `:focus`/`:focus-within`. Sits at the **top of the Subtitles tab** above the 2-col grid
(D-10). Keep the "no se exporta" affordance so it never reads as an export/caption-override field.

## What to Look For
- **Type in the textarea** — the live caption in the phone updates word-by-word. Reinforces "this feeds the subtitles."
- Does the full-width banner (A) feel right, or does breaking out of the 2-col grid look like an exception? Does the in-column textarea (B) feel too cramped for editing a sentence? Is the condensed field (C) clever or annoying (hides content you might want to see)?
- The **"Alimenta los subtítulos · no se exporta"** affordance (blue dot) — does it make the textarea's role legible vs an export field?
- Coherence with the validated pattern: the Subtitles tab now carries Posición (with the shared 9-point presets), Estilo (size/weight/color/highlight + font grid), Avanzado (words-per-page / highlight mode). Does it still read as the same panel as Titles/Overlays?
- This is also half the **consistency** test for sketch 006 — pick the variant that will compose cleanly with the other two tabs.
