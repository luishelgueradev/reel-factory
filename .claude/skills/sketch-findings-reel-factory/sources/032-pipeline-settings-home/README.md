---
sketch: 032
name: pipeline-settings-home
question: "Every tab configures the look. Where do the non-look params that drive pipeline-config.json live — Whisper model (tiny→large-v3), language, silence sensitivity, output res/codec?"
winner: "A"
tags: [settings, pipeline, whisper, output, frontier, scope-expanding]
---

# Sketch 032: Pipeline Settings Home

## Design Question
The four tabs (Títulos / Overlays / Subtítulos / Video) all configure the **look** — per-element styling. But the params that actually drive `pipeline-config.json` and the processing run have **no home in any of the 31 prior sketches**:

- **Whisper model** (tiny / base / small / medium / large-v3 / turbo — medium recommended; AGENTS.md model table)
- **Language** (Español/es fixed for accuracy)
- **Silence sensitivity** (silencedetect threshold + min duration + padding)
- **Output** (1080×1920 9:16 locked in v1, FPS, H.264 codec)

These are **global, run-affecting** settings, not per-element styling. Where do they live without breaking the dense control panel?

## How to View
open .planning/sketches/032-pipeline-settings-home/index.html

Interactive — open each surface (the **⚙** trigger / the **Procesamiento** tab / the **⚙** on Render), pick a Whisper model and watch the tradeoff hint update, drag the sensitivity slider.

## Variants
- **A: Slide-over "⚙ Procesamiento" sheet** — a header trigger opens a slide-over over the editor (the **same shared-component pattern as the 016 font picker**). Settings live one click away, off the per-element tabs. Path of least resistance; consistent with an idiom the project already chose.
- **B: 5th "Procesamiento" tab** — settings become a tab alongside Títulos/Overlays/Subtítulos/Video. Everything in one bar, but it **breaks the per-element tab contract** (these are global, not "this title/overlay") and muddies the "per-frame vs global" reading the right-pushed Video tab established. A note in the sketch flags the tension.
- **C: Popover on the Render button** — a **⚙ split on Render** opens a popover with the settings + "Render con estos ajustes →". Settings live **at the point of decision**, which fits the chosen **031-A spine** (render is committed inline from this button). You set the pipeline params exactly when you commit to running it.

## Winner: A — rationale
**Slide-over "⚙ Procesamiento" sheet.** These are set-once-ish, global, run-affecting params — they don't belong in the per-element style tabs, and tying them to the Render button (C) overloads a gesture that the 031-A spine just made the *primary* action. The sheet reuses the **016 font-picker shared-component idiom** the project already committed to, so it costs no new pattern: a header trigger opens a slide-over over the editor, settings get real room (the 6 Whisper-model chips + tradeoff hints + sensitivity scale breathe), and dismiss returns you to the look-work untouched. B (5th tab) was rejected for breaking the per-element tab contract and muddying the "per-frame vs global" reading the right-pushed Video tab established; C (Render popover) was rejected for coupling rarely-touched config to the now-load-bearing render action.

**Build notes:** the sheet writes to `pipeline-config.json` (same propagation path as the Studio's saved config via `ACTIVE_PIPELINE_CONFIG_PATH`). Output resolution stays locked to 1080×1920 9:16 in v1 (shown 🔒, honest not noise). Still flagged **scope-expanding beyond Phase 22** — this is the marker for where pipeline settings land when they're built, not a Phase 22 commitment.

## What to Look For
- **Frequency vs placement:** these settings are *set-once-ish* (you rarely change your Whisper model per video). Does that argue for the tucked-away sheet (A), or for being right where you render (C)?
- **Contract integrity (B):** does a 5th tab read as "belongs here" or as "global settings crammed into a per-element vocabulary"? Watch the note.
- **Coherence with 031-A:** C ties settings to the Render button — the same button that *is* the run spine now. Does that feel like one coherent gesture, or does it overload the render action?
- **The Whisper model chips:** 6 options with a live tradeoff hint + "REC" on medium — dense but legible? Or should the rarely-touched models be disclosed?
- **The 9:16 lock:** output resolution is fixed in v1 (🔒). Is showing a locked control honest, or noise?
- **Scope note:** this is **scope-expanding beyond Phase 22's look-polish** — flag whether it belongs in this milestone at all, or is a marker for later.
