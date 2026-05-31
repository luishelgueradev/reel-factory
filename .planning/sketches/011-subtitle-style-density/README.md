---
sketch: 011
name: subtitle-style-density
question: "With the full real caption field set (~20 controls), how does the Subtitles Estilo/Avanzado section stay a scannable, deliberate panel instead of a wall of rows — and where do you see the style take effect?"
winner: "C"
tags: [subtitles, density, styling, typography, effects, color, stress-test, impeccable]
---

# Sketch 011: Subtitle Style Density

## Design Question
Sketches 005/006 restructured the Subtitles tab shell but showed a **simplified** Estilo (size · peso ·
color · resalte · fuente). The **real** caption config is far denser — ~20 styling controls:

- **Tipografía:** `fontFamily` (26 fonts, default Plus Jakarta Sans), `fontSize`, `fontWeight`,
  `fontStyle` *(new, Phase 19)*, `letterSpacing`, `lineHeight`
- **Color (4 roles):** `activeColor`, `inactiveColor`, `highlightColor`, `outlineColor` + `outlineWidth`
- **Efectos *(new, Phase 19)*:** `outerGlow` {color, intensity, softness}, `backgroundHighlight`
  {color, padding, radius}
- **Ritmo de resaltado:** layout `modo` (tiktok/frase/barra/karaoke), `palabras/pág`,
  `highlightTransition`, `highlightDurationMs`, `pastWordOpacity`
- **Animación:** appear / duration

This is the density stress-test sketch 002 anticipated: does the always-open Posición→Estilo→Avanzado
vocabulary survive the real field count, and how is the styling previewed?

## How to View
open .planning/sketches/011-subtitle-style-density/index.html

All controls are live: type in the sample text, drag sizes, pick colors, toggle weight/italic,
switch fonts, flip the effect switches — the phone caption (and the in-panel specimen in C) update in
real time.

## Variants
- **A: Plana ortodoxa** — literal 002-A. Every real field as a flat always-open `.row`, distributed
  Posición + Avanzado (left) / Estilo (right). Maximum consistency, path of least resistance. Tests
  whether "show everything flat" still reads as deliberate at ~20 controls or becomes a wall.
- **B: Clusters + efectos plegables** — keeps the numbered sections but adds lightweight sub-labels
  inside them (Tipografía · Color · Ritmo), a **2×2 color-role matrix** instead of four color rows,
  and **effect toggle-rows** (Glow, Fondo) that collapse to a single switch line when off and reveal
  their params when on. Disclosure *within* always-open: unused effects cost one row.
- **C: Specimen + modos** — leads the section with a **live in-panel caption specimen** and a
  **layout-mode preset row** (TikTok / Barra / Frase / Karaoke) that bundles a look, then fine
  controls below. Every edit changes something you see without leaving the panel.

## What to Look For
- **Scan cost:** which one lets you find a specific control fastest, and which reads as "a wall"?
- **Density honesty:** does B's collapsing of off-effects actually feel calmer, or does the switch
  machinery add noise (the exact tension 002 rejected for collapsible sections)?
- **Color roles:** four stacked color rows (A) vs the 2×2 matrix (B/C) — which makes the four roles
  legible?
- **Preview proximity:** is C's in-panel specimen worth the vertical cost when the phone preview is
  right there, or is it redundant?
- **Coherence:** all three must still feel like the *same panel* as the Titles/Overlays tabs (006-A
  rule: textarea/specimen/mode-row full-width; the form stays the 2-col grid). Does any variant break
  the shared rhythm?
- **Restraint:** blue = selection only, green = the single primary (Guardar). No new chromatic UI
  color despite four caption colors being edited.

## Decision

**Winner: C — specimen-led + layout-mode presets.**

The section leads with a **live in-panel caption specimen** and a **4-up layout-mode preset row**
(TikTok / Barra / Frase / Karaoke), then drops into the standard 2-col form (Tipografía + Posición
left, Color + Efectos right). Why it won:

- **Mode-first matches how the field is actually set.** The `layout` mode is the highest-leverage
  caption decision (it bundles a whole look); promoting it to picture-cards above the fine controls
  means you choose the family, then tune — instead of hunting for a `Modo` dropdown buried in
  Avanzado (where A/B put it).
- **The specimen earns its height.** Even with the phone preview right there, an at-the-controls
  specimen keeps cause-and-effect in one glance while you drag size / pick colors — you're not
  ping-ponging your eyes to the far preview. It's the in-panel echo of the 007-A "preview as editing
  surface" instinct.
- **It absorbs B's best atoms.** C keeps the **2×2 color-role matrix** and the **collapsible
  effect-rows** (Glow / Fondo off = one switch line each), so the four colors and the two Phase-19
  effects stay legible and cheap-when-unused — without A's flat wall of ~20 rows.
- **Coherence holds (006-A).** The textarea, specimen, and mode-row are the full-width lead elements;
  the form stays the 2-col grid. The tab still reads as the same panel as Titles/Overlays.

Rejected: **A (flat orthodox)** confirmed the wall — ~20 stacked rows scan as undifferentiated, and
burying `Modo` among them hides the most important control. **B (clusters)** was the right
*components* (matrix + collapsing effects, both carried into C) but without the specimen/mode lead it
was still a form-first read.

### Carry-forward for the real build
- **Layout-mode = preset picker cards, not a dropdown.** Each card previews its highlight behavior;
  selecting one sets sensible defaults for that mode (the fine controls then override).
- **2×2 color matrix** for the four roles (activo / inactivo / resalte / borde) — swatch + label,
  native `<input type=color>` behind a styled swatch with a mono hex/rgba readout.
- **Effect-rows collapse when off:** `outerGlow` and `backgroundHighlight` each render as a single
  switch line; expanding reveals their params. This is disclosure *inside* an always-open section —
  distinct from the collapsible *sections* 002 rejected, because the effect is genuinely on/off.
- **In-panel specimen** mirrors the live caption from the current style + sample text; cheap subset
  if cut, since the phone preview already exists, but validated as worth keeping.
- Font picker stays the 2-up `.fontgrid` card with a `+ N fuentes` overflow (26 fonts; needs a
  full picker/search in the real build, not 4 cards).
