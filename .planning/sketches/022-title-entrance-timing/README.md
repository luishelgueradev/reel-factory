---
sketch: 022
name: title-entrance-timing
question: "014-C nailed the entrance TYPE (Slide/Fade/Ninguna); where do the entrance TIMING controls live — when a title appears (startTimeMs), how long it stays (durationMs), and how fast it enters?"
winner: "B"
tags: [frontier, titles, timing, entrance, temporal]
---

# Sketch 022: Title Entrance Timing

## Design Question
Sketch 014-C established the Títulos tab's entrance **type** cards (Slide↑ / Slide↓ / Fade / Ninguna)
but never the **timing**. The real `TitleConfig` carries `startTimeMs` (when the title appears) and
`durationMs` (how long it stays on screen); `TitleStyleProps.entranceAnimation` is the type. So the
open question: where do *when* and *how long* (and entrance speed) live in the tab, and can you set
them without a full timeline? This is local to one title — the **global** reel timeline is sketch 020.

## How to View
open .planning/sketches/022-title-entrance-timing/index.html

## Variants
- **A: Per-title mini-timeline** — a compact track in the Tiempo section showing this title's block
  against the 0:10 clip. Drag the block to move (startTimeMs), drag edges to resize (durationMs),
  drag the scrub head to preview the entrance on the phone. Numeric readout below (Aparece / Dura /
  Sale). Expressive; you *see* where the title falls.
- **B: Numeric rows only** — "Aparece" / "Dura" fields + "Velocidad" segmented, as plain rows in the
  Tiempo section. Path of least resistance, fits the locked row vocabulary, no new surface.
- **C: Timeline over the clip (full-width lead)** — the timeline takes the TabLead full-width slot
  (like Subtitles' textarea / Overlays' list), with the entrance **ramp** visualized as a gradient
  lead-in on the block. Explicitly anticipates the global timeline of sketch 020.

## What to Look For
- **Blind vs seen:** does typing "0:02" (B) feel fine, or do you need to *see* where the title lands
  in the clip (A/C)? Scrub the head — the title shows/hides in its window.
- **Local vs global:** A/C introduce a per-title track. Does that read as a natural extension, or
  does it pre-empt sketch 020's global timeline and risk two timeline idioms?
- **Vocabulary fit:** B reuses the locked row/seg atoms exactly. A/C add a track affordance — does it
  feel coherent with the dark panel, and does the block/handle/playhead read clearly?
- **Motion:** the entrance preview on scrub uses the calm 0.32s ease-out (009-A vocabulary). Does the
  slide-up/fade read as the same family?
