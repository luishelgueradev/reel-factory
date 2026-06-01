---
sketch: 020
name: timeline-scrubber
question: "Where does a playhead / timeline live in the 001-D shell, and does editing stay 'style the look' or gain a temporal axis (scrub to a moment, place titles/overlays/zoom in time)?"
winner: "C"
tags: [frontier, timeline, scrubber, temporal, shell, scope-expanding]
---

# Sketch 020: Timeline / Scrubber

## Design Question
Every prior sketch is a **static single phone frame**, but the tool produces a *time-based video*:
subtitles run word-by-word, titles carry `startTimeMs + durationMs`. The temporal dimension has **no
home**. This is the biggest structural question the 18 sketches never touched: where does a playhead /
timeline live in the 3-column shell, and how far does the editor lean into "video editor" vs staying
a styling panel? Scope-expanding — frontier, not committed Phase 22.

> **Updated 2026-06-01:** the auto-zoom track was removed after the emphasis-zoom feature was dropped
> (wrong signal, off-brand — see memory `auto-zoom-dropped`). The timeline now carries **Títulos /
> Overlays / Subtítulos** only.

## How to View
open .planning/sketches/020-timeline-scrubber/index.html
**Scrub or hit ▶** — the title appears/disappears in its window, the badge overlay comes and goes,
and the preview pulses zoomed at the ⚡ auto-zoom marks.

## Variants
- **A: Scrubber under the preview** — the lightest touch. A thin scrub bar + transport + an "en
  pantalla ahora" chip set beneath the phone (stage-local). You can *preview* any moment, but timing
  is still edited via the form (Aparece / Dura). Time is previewed, not edited on a track.
- **B: Full-width multi-track dock** — a real editor timeline docked along the bottom spanning all
  three columns: Títulos / Overlays / Subtítulos lanes, a track gutter, a playhead. Click a block to
  focus its controls; drag to retime. The heaviest, most "video editor."
- **C: Strip under stage + controls** — middle ground. The timeline sits under the preview+controls
  only (Títulos / Overlays / Subtítulos lanes), while the **metadata column keeps full height** to the
  right. Between A's scrubber and B's full dock.

## What to Look For
- **How much editor is right?** This is a single-talking-head styling tool with auto subtitles. Does
  the full multi-track dock (B) earn its weight, or is the scrubber (A) all the temporal the tool
  needs? C tests a deliberate middle.
- **Where time belongs in the shell:** under the preview (A), full-width bottom (B), or under
  stage+controls but not metadata (C). Which keeps the 001-D shell coherent?
- **Cards avoided:** the timeline is a real multi-lane track surface (not a card grid). Does it read
  as a calm part of the dark panel?
- **Relationship to 022:** sketch 022's per-title mini-timeline is the *local* version; this is the
  *global* one. Should they be one idiom or two?
