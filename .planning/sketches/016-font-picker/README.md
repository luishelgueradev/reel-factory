---
sketch: 016
name: font-picker
question: "How do you browse / search / pick among the real 26 live-specimen fonts (shared Titles + Subtitles) without breaking the dense panel?"
winner: "C"
tags: [frontier, fonts, picker, shared-component, density]
---

# Sketch 016: Font Picker

## Design Question
The font control was a **4-card stand-in** across sketches 011 and 014 — and 011 explicitly
flagged it for its own sketch: *"26 fonts with live previews is its own problem; the real build
needs a searchable/scrollable picker."* This sketch resolves that open sub-problem.

The picker is consumed by **both** Titles and Subtitles (one shared component), so wherever it
lives it must be self-contained. The hard constraint: 26 fonts, each shown in its **own face**,
without the picker swamping the deliberately dense control panel.

All 26 fonts are the real `AVAILABLE_FONTS` set from
`services/remotion-studio/src/fonts.ts`, loaded live from Google Fonts — every specimen renders
in its actual typeface.

## How to View
open .planning/sketches/016-font-picker/index.html

## Variants
- **A: Inline scroll-box** — the font row is a trigger that expands an in-flow, height-capped
  scroll box (search + category chips + a scrollable list of live single-line specimens) right
  inside the Tipografía section. Never leaves the panel; pushes the form down while open.
- **B: Anchored popover** — the trigger opens a floating popover anchored to it (same search +
  chips + scroll list). The form stays put; closes on select or outside-click. The Linear/Figma
  font-dropdown register.
- **C: Slide-over gallery** — the trigger opens a dedicated slide-over sheet over the controls
  column: a 2-up gallery of larger cards, each rendering the **sample text** in its face, with
  search + category filter. Best for browsing/comparing all 26 at a glance.

## What to Look For
- **Calm vs swamp:** does browsing 26 live specimens stay calm in the dense panel, or does it
  take over? A pushes the form; B floats; C is a deliberate detour.
- **Search + category** (Todas / Sans / Condensada / Display / Serif / Script / Mono) — do they
  make 26 feel like a small set?
- **Selection = blue** (design-system rule): current font marked with `--accent`, never green.
- **Specimen legibility:** single-line names (A/B) vs sample-text cards (C) — which tells you
  more about how the font will actually read in a caption?
- **Shared-component fit:** the same surface has to drop into the Títulos tab too — which
  treatment ports most cleanly?
