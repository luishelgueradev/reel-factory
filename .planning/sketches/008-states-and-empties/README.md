---
sketch: 008
name: states-and-empties
question: "What does the dense panel look like off the happy path — 0 overlays, the 3-overlay cap (Add disabled), the Guardar config dirty→saving→saved loop, and a no-video / loading preview? Which save-feedback mechanism fits the calm pro tool?"
winner: "B"
tags: [consistency, states, empty, save, edge-cases, phase-22]
---

# Sketch 008: States & Empties

## Design Question
Every prior sketch (001–007) rendered a tab **full of content, at rest, mid-edit**. The dense panel
was never drawn *off the happy path*. This consistency sketch fills the holes the findings only
described in prose:

- **Empty overlay list** (0 of 3) — the `OverlayEditor` with nothing in it.
- **The cap** — 3 of 3 overlays, **Add disabled**, "Máximo 3" made legible (real `MAX_OVERLAYS`).
- **The save loop** — the single green action (`Guardar config`) is the one primary action in the
  whole panel; its **dirty → saving → saved → clean** feedback was never sketched. Sketch 002-B floated
  a "dirty-dot" but that variant lost, so the question is open.
- **No-video / processing preview** — the stage before an MP4 is loaded, and during the single-job
  pipeline's first step (Whisper transcription).

The contested decision is **where save-state lives**, so that's the variant axis. The empty / cap /
no-video / loading states are exercised by the shared **Escenario** switcher (the dashed bar inside
the controls — sketch chrome, not part of the real app) so each save treatment is judged against the
same states.

Grounded in the real model: `MAX_OVERLAYS = 3`, overlays default `layer:"back"`, the pipeline is
**single-job** (`MAX_CONCURRENT_JOBS = 1`) and runs Whisper → silence-cut → Remotion.

## How to View
open .planning/sketches/008-states-and-empties/index.html

**Try it:** edit any control (or hit a scenario's Add) → the panel goes **dirty**; click the save
affordance → **saving** (spinner) → **saved ✓** → settles back to **clean**. Flip the **Escenario**
pills to see the empty list, the cap, and the no-video / processing preview under each variant.

## Variants
- **A: Save = the button** — the green action *is* the status. Clean = quiet/disabled "Guardado"; a
  pending edit turns it green with a dirty dot + "Guardar config"; click → "Guardando…" (spinner) →
  "✓ Guardado", then it settles back to quiet. One element carries the whole loop; zero extra chrome.
- **B: Save = header status chip** — a dedicated status chip sits left of the actions ("● Cambios sin
  guardar" amber → "Guardando…" → "✓ Guardado recién"); the `Guardar config` button stays put and just
  enables/disables. State is *named* in words, separate from the trigger.
- **C: Save = footer action bar** — the panel stays clean until you edit; then a bar slides up from the
  bottom of the controls column ("Tenés cambios sin guardar" · Descartar · Guardar config), Linear /
  Figma-style. Strong "you have unsaved work" signal; costs vertical space + a slide animation while present.

## Winner: B — rationale
**Header status chip** won. Naming the state in words ("● Cambios sin guardar" / "Guardando…" /
"✓ Guardado recién") next to a button that stays put is the calmest, most legible read for a panel you
save constantly — the status is *information*, the button is the *action*, and keeping them separate
avoids the ambiguity of a single element doing both. The morphing button (A) was the most minimal but
made "you have unsaved changes" too easy to miss in a dense dark panel (the dirty signal is just a small
green tint on one button). The footer bar (C) was the loudest and unmissable, but it costs vertical
space and a slide animation on *every* edit — too much drama for a tool where you tweak-and-save
dozens of times a session.

Real-build notes: the chip is an idle/dirty/saving/saved state machine left of the actions; the
`Guardar config` button enables only when dirty (and stays the design-system's single green primary —
note this is the *opposite* call from 010, where Render takes the green). The amber dirty dot uses
`--warning`; saved uses `--success`; both sit at low chroma so the chip informs without alarming. The
empty-overlay state ("Sin overlays todavía" + dashed Add CTA), the 3/3 cap (disabled Add + "Máximo 3"
hint), and the no-video / Whisper-loading preview states are all validated and carry across all three
save treatments unchanged — adopt them as drawn.

## What to Look For
- **Save legibility:** which treatment makes "you have unsaved changes" unmissable *without* nagging in
  a calm pro panel? Is the morphing button (A) too subtle, the chip (B) just-right, the bar (C) too loud
  for a tool you save constantly?
- **Green-reservation rule:** the design system reserves green for the *single* primary action. A turns
  the button green only when dirty (green = "there's an action to take") — does that read right, or
  should green be constant?
- **Empty overlay state:** does "Sin overlays todavía" + the dashed Add CTA feel inviting and on-brand,
  or like a broken/unfinished panel? Does it match the calm density of the populated tabs?
- **The cap:** is "3 / 3 · al tope" + disabled Add + the "Máximo 3" hint clear, or does a disabled
  button with no explanation read as a bug?
- **No-video & processing:** does the blank stage ("Sin video cargado" / drop affordance) and the
  Whisper "Transcribiendo… paso 1 de 3" shimmer hold the same visual quality as the live preview? The
  dimmed `1080×1920 / 9:16 / 00:10` pills — helpful context or noise when there's nothing to show?
