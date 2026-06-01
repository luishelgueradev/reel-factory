---
sketch: 028
name: transcript-review
question: "Whisper mishears words (especially Spanish) — where and how does the user review and correct the transcription before captions render? Confidence is the signal: which words does it flag, and is the review a read-through, a triage queue, or in-shell?"
winner: "B"
tags: [frontier, transcript, whisper, correction, pipeline-inspection, scope-expanding]
---

# Sketch 028: Transcript Review & Correction

## Design Question
The pipeline transcribes with Whisper into `WhisperWord{word, start, end, confidence}`. Today that
intermediate output is **invisible in the Studio** — yet AGENTS.md promises every step is
"inspeccionable, [permite] revisar salidas intermedias antes de continuar." Whisper mishears,
especially in Spanish. **Where and how does the user review and fix the transcript before it feeds
the captions and the silence cuts?** And how is `confidence` surfaced as the flag-for-review signal
(its legitimate use, unlike the dropped auto-zoom which misread confidence as emphasis)?

## How to View
open .planning/sketches/028-transcript-review/index.html

All three use the **same real transcript shape** (4 segments, word-level confidence). Words below
0.78 get a dotted amber underline; below 0.6 a red underline + tint. Edit any word; the "dudosas"
counter ticks down.

## Variants
- **A: In-shell caption editor** — transcript lives as a tab in the existing 3-column shell: a
  compact line-per-segment list beside the live preview, flagged segments marked ⚠️. Argues
  correction is just another panel. Cheapest, but the whole transcript is cramped into a side list.
- **B: Full-screen script read-through** ★ (default) — a dedicated review *step* (note the pipeline
  step-rail in the header: Audio ✓ → **Transcripción** → Silencios → Render). The transcript reads
  like a **document**: segments as timestamped paragraphs, low-confidence words underlined inline,
  click-to-edit in place, ▶ per segment. Primary action **Confirmar transcripción →** is the
  surface's single green. Best for trusting the whole text top-to-bottom.
- **C: Confidence-triage queue** — same review step, but you only see the **uncertain words**, one
  at a time: the word in sentence context, a (faked) waveform snippet + play, an input pre-filled,
  alternative guesses as chips, and "Siguiente dudosa →". Fastest path to "just fix the errors";
  full transcript kept as a side reference. Skips the 90% Whisper got right.

## What to Look For
- **Is confidence trustworthy as a flag?** Dotted-underline-everything-low could read as noise on a
  clean transcript. Does the amber/red two-tier feel calibrated or alarmist?
- **B vs C is a philosophy split:** read-everything (B, higher trust, slower) vs fix-only-the-doubts
  (C, faster, assumes confidence is a good filter). For a 1-2 min talking-head, which fits?
- Does framing it as a **pipeline step** (the header step-rail + "Confirmar → continuar" green) make
  the intermediate-output-inspection promise legible, or does a full-screen takeover feel heavy for
  what's often a 4-word fix?
- Green discipline: the **single** primary action per surface is "Confirmar transcripción" (green);
  everything else (discard, play, alternatives) stays neutral/accent.
