---
sketch: 019
name: overlays-tab-density
question: "Against the real PngOverlayConfig (position, displayWidth, opacity, layer), does the Overlays tab read as deliberately lean next to the dense Subtitles/Titles tabs — or underfilled and inconsistent?"
winner: "C"
tags: [consistency, overlays, density, tabs, third-tab]
---

# Sketch 019: Overlays Tab Density

## Design Question
Sketches 011 (Subtitles) and 014 (Titles) stress-tested their tabs against real, ~16–20-field
schemas and proved the always-open vocabulary holds. The **Overlays** tab (004-A list + form) never
got that test. But its real schema (`PngOverlayConfig`) is genuinely small: `imageData` (the PNG),
`x` / `y` (pixels from top-left of 1080×1920), `displayWidth`, `opacity`, plus the `Capa
Detrás/Delante` layer toggle (D-03) and the 3-overlay cap. So the real question flips: not "does it
survive density?" but **"does a deliberately lean tab read as calm and intentional, or as
underfilled next to the dense ones?"**

## How to View
open .planning/sketches/019-overlays-tab-density/index.html

## Variants
- **A: Lean by design** — embrace the small schema. List (TabLead) + a single-column, generously
  spaced Posición → Tamaño → Estilo form (9-point anchor, X/Y, width, Capa segmented, opacity). A
  short footer note names *why* it's short. Honest to `PngOverlayConfig`; no invented controls.
- **B: Enriched parity** — bring the tab closer to the others' weight with an in-form overlay
  preview, a nudge pad, lock-aspect, fit (contain/cover) — a fuller 2-col form. Tests whether parity
  is worth inventing controls the schema doesn't have.
- **C: List forward** — the list is the hero: fat per-item cards with inline width / opacity / layer
  / anchor controls, minimal separate form. Direct per-overlay manipulation.

## What to Look For
- **Deliberate vs underfilled:** does A's whitespace read as "this is simply a small thing," or as a
  half-built tab? Does switching from dense Subtitles to lean Overlays feel like a calm change of
  pace or a dropoff?
- **Invented-control smell (B):** lock-aspect / fit / nudge aren't in `PngOverlayConfig`. Does the
  added weight justify controls that don't map to real render props?
- **Coherence:** all three keep the TabLead/TabForm skeleton (012-B), full-width list, section
  vocabulary. Does C's per-item-controls break that contract?
- **The cap & layer language:** 2/3 count, `Capa: Detrás/Delante` badge + segmented, drag = paint
  order — legible in each?
