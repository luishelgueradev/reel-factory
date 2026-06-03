---
sketch: 046
name: help-destination
question: "What lives behind the rail's '?' and the palette's Ayuda group — keyboard cheatsheet, single-job/OOM concurrency explainer, about/version, tunnel-auth info — and is it a sheet, a destination, or a popover?"
winner: "A"
tags: [frontier, help, onboarding, keyboard, about, rail-destination]
---

# Sketch 046: Help Destination

## Design Question
The rail (033-B) has a `?` entry and the ⌘K palette (036) has an "Ayuda" group — both **promise a
help surface that was never sketched**. What's actually behind it? Three honest content blocks:
the **keyboard cheatsheet** (036 kept variant B in reserve), the **"why one job at a time"
concurrency explainer** (`MAX_CONCURRENT_JOBS=1` / Chrome OOM), and **about/version** (the
whisper-api endpoint, the v1.2 Cloudflare-tunnel + basic-auth note, port 3123, output dir). The
question is the *vessel*: sheet, destination, or popover?

## How to View
open .planning/sketches/046-help-destination/index.html

Click the **?** in the rail (or the button on the stub) in each variant.

## Variants
- **A: Slide-over sheet** — `?` opens a help sheet over the editor, reusing the established 016 font-picker / 032 ⚙ slide-over idiom. Atajos + Cómo funciona + Acerca de in one scroll. Right-sized for a single-purpose local tool; Esc closes, editor stays behind.
- **B: Full destination** — `?` is a place like Resultados/Cola, with a left sub-nav (Atajos · Cómo funciona · Acerca de). Heavier; more weight than a small tool's help needs, but scales if docs grow.
- **C: Popover cheatsheet** — `?` shows only the most-wanted (shortcuts) anchored to the rail, with "Cómo funciona" / "Acerca de" as links. Minimal; the concurrency explainer lives inline in the queue rather than centralized. Fast but fragments help.

## What to Look For
- **Right-sizing** — a local studio's help is genuinely small (shortcuts + one explainer + version). Does A feel correctly scaled, or does B's destination read as over-built? Does C feel too thin?
- **Idiom consistency** — A reuses the slide-over the tool already uses twice (016, 032). Does reusing it for help read as "the tool's established sheet pattern" or does help deserve its own treatment?
- **The concurrency explainer** — does centralizing "why one job at a time" in help help, or is it better left inline at the queue (035/030)? C splits it out deliberately.
- **Honesty** — every line is grounded in the real project (whisper medium, tunnel+auth, port 3123, the OOM reason). No invented features.
- **Green discipline** — help has no primary action; nothing greens.
