---
sketch: 014
name: title-style-density
question: "Stress-tested against the real TitleStyleProps (a boxed text card — background/padding/radius — plus an entrance animation, glow, and shared font/color), does the Titles tab hit the same density wall as Subtitles, and does it reuse 011-C's specimen/effect-row vocabulary or need its own?"
winner: "C"
tags: [frontier, titles, density, styling, box, entrance, effects, stress-test, impeccable]
---

# Sketch 014: Title Style Density

## Design Question
Sketch 011 stress-tested the **Subtitles** Estilo against its real ~20-field caption schema. The
**Titles** tab was only ever shown simplified (text · fuente · tamaño · peso · color). But the real
`TitleStyleProps` (`pipeline-config.ts`) is its own dense field set, and notably *different in kind*
from subtitles:

- **Texto:** `text`, `titleFontFamily` (26 fonts), `titleFontSize`, `fontWeight` (bool), `fontStyle`
  (italic bool), `lineHeight`
- **Caja *(title-only)*:** a title is a **boxed text card** — `backgroundColor`, `padding`,
  `borderRadius` (default 12), plus `titleColor`/`textColor`. Subtitles have no container box.
- **Entrada *(title-only)*:** `entranceAnimation` — `slide-up` / `slide-down` / `fade-in` / `none`.
  The single highest-leverage stylistic choice for a title.
- **Efecto:** `outerGlow` {color, intensity, softness} — shared with subtitles.
- **Posición / Tiempo:** `x`, `y`, `startTimeMs`, `durationMs`.

So this is two questions at once: (1) does the always-open vocabulary survive Titles' real field
count, and (2) **does the subtitle styling vocabulary generalize to titles** — or do the box +
entrance demand their own affordances? Titles live in a **list + detail form** (004-A), so this is the
detail form under stress.

## How to View
open .planning/sketches/014-title-style-density/index.html

All controls are live: type the title text, pick a font, drag size/padding/radius, change the text and
**box** colors, toggle the Glow effect-row — the boxed title in the phone (and the in-panel specimen in
C) update in real time. Select either title in the list to switch the detail.

## Variants
- **A: Plana ortodoxa** — the title's real fields as flat always-open rows (Posición + Avanzado left,
  Estilo right), entrance as a plain `<select>`. Maximum consistency with the subtitle 011-A baseline;
  tests whether ~16 flat title rows read as deliberate or become the same wall.
- **B: Clusters + Caja/Glow plegables** — keeps the numbered sections but adds sub-labels (Texto · Caja ·
  Efecto · Tiempo), groups the **container box** (background/padding/radius) into a collapsible
  `Fondo de caja` effect-row, and Glow as a second collapsible — the 011-B treatment applied to titles.
- **C ★ (winner): Specimen + entrance presets** — mirrors 011-C exactly. A full-width
  **specimen showing the boxed title**, then **entrance-animation preset cards** (Slide ↑ / Slide ↓ /
  Fade / Ninguna) promoted above the form as the title's highest-leverage decision (the title analog of
  subtitle layout-mode cards), then the 2-col form with a 1×2 Texto/Caja color pairing and collapsible
  Glow. Proves the 011-C vocabulary transfers: mode-cards → entrance-cards, color-matrix → box/text
  pairing, effect-rows → glow.

## What to Look For
- **Does the box change the picture?** The specimen renders a real *boxed* title (background + padding +
  radius), unlike the bare subtitle caption. Does seeing the box live make the Caja controls obvious?
- **Entrance as a card, not a dropdown (C vs A).** `entranceAnimation` is the title's signature choice.
  Promoted to preset cards (C) vs buried in a select (A) — which reads right?
- **Vocabulary transfer.** Compare C here to 011-C side by side. Do mode-cards→entrance-cards and
  color-matrix→box/text pairing feel like *the same panel for a different element*, or forced?
- **The wall (A).** At the real field count, does flat-orthodox titles tip into a wall the way flat
  subtitles did in 011-A — confirming C is the right call for both?
