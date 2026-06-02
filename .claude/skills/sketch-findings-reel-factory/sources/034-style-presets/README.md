---
sketch: 034
name: style-presets
question: "The tool re-configures from defaults on every video (017-B), but it's a batch/repeat-use tool — where do named, saved looks ('Mi estilo TikTok') live, and how do you save / apply / manage them across all four tabs at once?"
winner: "A"
tags: [frontier, presets, templates, save-a-look, batch, reuse]
---

# Sketch 034: Style Presets (save a look)

## Design Question
First-run (017-B) starts every video from defaults, and the editor's whole job is to dial in a look across four tabs (Títulos · Overlays · Subtítulos · Video). But this is explicitly a batch / repeat-use tool ("procesamiento individual y por lotes", real BullMQ queue). A professional making the same kind of reel weekly should not re-dial the look each time. Where do **named, saved configurations** live, how do you **apply** one (it overwrites all four tabs at once), how do you **save the current config** as a new look, and how is the **"applied a preset, then tweaked it"** state communicated? Green discipline: applying/saving a look is *not* the surface's primary action (Render owns green), so those affordances use accent/outline.

## How to View
open .planning/sketches/034-style-presets/index.html

Apply a look and watch the preview retint. Hit "Editar un control" to see the **Modificado** state appear (a preset diverged from).

## Variants
- **A: Header preset bar** — an always-visible `Estilo: [Mi estilo TikTok ▾]` trigger by the brand. The dropdown lists saved looks (swatch + name + descriptor + ✓ on the active one) and offers "Guardar el actual como estilo…" (enabled only when the current config has diverged). Frictionless for frequent switching; the active look and its dirty state are always on screen.
- **B: Slide-over gallery** — reuses the 016 font-picker / 032 settings idiom: a `◫ Estilos` trigger opens a sheet of **preview cards**, each a mini 9:16 thumbnail rendering the actual look (font + color + title-box). The active card carries an "Activo" badge and reveals Renombrar / Duplicar; a dashed "Guardar el actual" card closes the set. Room for thumbnails and management the dropdown can't give.
- **C: First-run strip + recall** — ties presets to onboarding (017-B): the cold workspace offers the dropzone *and* a strip of look-cards to start from (plus "Empezar limpio"). Once chosen, a compact `Desde [look] ✕` recall chip sits in the header so you always know which look you branched off. Presets as the *starting point*, not a mid-task switcher.

## What to Look For
- Does the saved look read as **"all four tabs at once"** (the real payload) rather than just a font/color swatch? The thumbnails try to make a full configuration legible at a glance.
- Is the **Modificado / diverged-from-preset** state clear and non-alarming? It must coexist with the existing "Cambios sin guardar" save-chip without reading as a second warning.
- A vs B: is an always-on **header bar** (fast, low ceremony) better than an on-demand **gallery** (richer, more management), for a tool where you switch looks occasionally but manage them rarely?
- C: does anchoring presets to first-run make them **discoverable** without making them feel like a one-time-only choice (the recall chip is the answer)?
- **Green discipline:** confirm Aplicar / Guardar-como / Duplicar all use accent or outline, never the reserved action-green.
