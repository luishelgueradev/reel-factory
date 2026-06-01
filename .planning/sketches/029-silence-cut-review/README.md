---
sketch: 029
name: silence-cut-review
question: "The headline feature is 'elimina silencios' — yet no surface shows what got cut or lets you toggle a cut back in. Where does the cut list / review live, and how much control does the user want: veto each cut, tune the sensitivity, or both?"
winner: "B"
tags: [frontier, silence, cuts, review, pipeline-inspection, core-value, scope-expanding]
---

# Sketch 029: Silence-Cut Review

## Design Question
"Transformar un video crudo... eliminando silencios" is the project's **core value** — and the
`silence-cutter` step is a real, independent, inspectable pipeline stage producing
`SilenceCut{original_start/end, new_start/end, duration, source, cumulative_shift}` (detected by
intersecting FFmpeg level-detection with Whisper word-gaps, hence `source: both|ffmpeg|whisper`).
Yet **no Studio surface shows what was removed**. Where does the cut review live, and how much
control does the user actually want — veto individual cuts, or just tune the sensitivity?

## How to View
open .planning/sketches/029-silence-cut-review/index.html

All three share the **same 14 real cuts** (108s → 72s, −36s). Restoring a cut updates the before/
after duration live. Source badges: `×2` = confirmed by both detectors (the standard case).

## Variants
- **A: Timeline-lane review** — extends the 020-C timeline strip with a **Silencios lane**: the
  original 1:48 track shows speech blocks (blue) and removed silences (hatched red); below it the
  compacted 1:12 result. Click a red gap → popover with its range + source + "Devolver". Lives
  *inside the editor*, reuses the timeline idiom. Good if silence-review is just one more lane.
- **B: Full-screen cut-review step** ★ (default) — a dedicated pipeline step (step-rail: Audio ✓ →
  Transcripción ✓ → **Silencios** → Render). A before/after stat (1:48 → 1:12, −0:36), a **waveform**
  with every removed silence marked in red (click to restore), then a **per-cut list**: timestamp
  range, duration-removed bar, source badge, and a quitado/devuelto **toggle** each. The honest
  "here's exactly what I removed, veto any." Primary green = "Confirmar cortes →".
- **C: Aggregate + sensitivity dial** — leads with the *outcome* ("Quité 36 s en 14 pausas") and a
  **sensitivity panel** (umbral dB · duración mínima · aire alrededor + "Volver a analizar")
  instead of per-cut surgery. The 14 cuts hide behind a "Ver los 14 cortes" disclosure. Argues most
  users tune the knob, they don't toggle cuts one by one.

## What to Look For
- **How much control is right?** B treats every cut as reviewable (powerful, but 14 toggles is a
  lot). C bets nobody wants that and offers a dial. A splits the difference inside the editor. Which
  matches a one-person talking-head workflow?
- Does the **source badge** (`×2` / FFmpeg / Whisper) add trust ("two detectors agreed") or noise?
- In B, does the **waveform-with-red-blocks** make "what got removed" instantly legible — the thing
  the whole feature is named for? Does clicking the wave vs the list toggle feel redundant or
  complementary?
- Is the silence step better as a **gate you pass through** (B/C full-screen, "Confirmar →
  continuar") or an **always-available lane** (A) you can revisit while editing?
- Re-render constraint honesty: changing cuts means the silence-cutter re-runs; C's "Volver a
  analizar" surfaces that cost, A/B imply a lighter local restore. Which is truthful to the pipeline?
