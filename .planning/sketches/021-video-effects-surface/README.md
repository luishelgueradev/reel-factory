---
sketch: 021
name: video-effects-surface
question: "With auto-emphasis-zoom dropped, transitions between cuts are the only whole-clip effect left. Does a single global effect deserve its own tab — or is it a render-time / global setting?"
winner: "A"
tags: [frontier, transitions, effects, global-setting, scope-expanding]
---

# Sketch 021: Transitions Surface

## Design Question
**Reframed after a product decision (2026-06-01):** the auto-emphasis-zoom (`ZoomConfig` /
`detectZoomEvents`) is being **removed** — it fired on Whisper *confidence dips* (mumbled/unclear
words), not emphasis, so it produced meaningless per-word zoom flashes that read off-brand for a
professional profile. See memory `auto-zoom-dropped`.

What's left of `VisualEffectsConfig` is `TransitionConfig`: the gentle push (1.08× zoom) or crop-shift
that **masks the jump-cut where silence was removed** — a legitimate, professional technique. So the
question is no longer "how do you review auto-zoom events" but: **where does the one remaining
whole-clip effect live? Does a single global control deserve a 4th tab, or is it a render-time
setting?**

## How to View
open .planning/sketches/021-video-effects-surface/index.html
Pick a transition type, then **▶ Ver la transición** to preview the push/shift on a simulated cut.

## Variants
- **A: Minimal "Video" tab** — a 4th tab holding just the transition (type cards w/ motion preview +
  duration). Deliberately near-empty; the sketch's own copy asks whether one control earns a tab.
- **B: Global setting (header popover)** — no 4th tab. Transitions sit behind a "⚙ Ajustes de video"
  button in the header, framed as a pre-render global (same family as quality/format). The three tabs
  stay reserved for per-element styling. Fits the professional "fewer surfaces" instinct.
- **C: Folded into the Render surface** — the transition control lives next to the Render action
  (sketch 010's surface), since it's a render-time decision, not styling. Zero new tabs, nothing
  hidden.

## What to Look For
- **Does one global effect justify a tab?** A says yes-but-barely (and admits it); B and C say no.
  Which respects the dense-but-deliberate panel without an almost-empty tab?
- **Mental model:** is a transition *styling* (belongs in a tab) or a *render setting* (belongs near
  Render / in global settings)? B and C bet on the latter.
- **Professional register:** fewer surfaces, global effects discreet and out of the way. Does B/C read
  calmer than a dedicated tab?
- **Preview honesty:** the cut-transition preview shows the gentle 1.08× push / 20px shift that hides
  a silence cut — not a flashy emphasis zoom. Does it read as subtle and professional?

## Note
This replaces the original 021 (auto-zoom review). The dropped-zoom rationale lives in memory
`auto-zoom-dropped` and should inform the real build (remove `detectZoomEvents` wiring; keep
`TransitionConfig`).
