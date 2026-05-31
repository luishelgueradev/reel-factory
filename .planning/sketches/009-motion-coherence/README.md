---
sketch: 009
name: motion-coherence
question: "Composed in the shell, do the per-sketch micro-motions (tab switch · textarea expand · preset flash · drag snap · save confirm) read as one motion vocabulary? Which timing calibration is right?"
winner: "A"
tags: [consistency, motion, timing, feel, phase-22]
---

# Sketch 009: Motion Coherence

## Design Question
The theme defines motion tokens (`--dur` 170ms, `--ease` ease-out-quart) and every prior sketch
animated *its own* thing in isolation: the tab switch, the 005-C textarea **expand-on-focus**, the
003 preset **flash**, the 007 drag **snap**, the 008 save **morph**. None were ever felt *in
sequence*. The risk is five individually-tasteful animations that don't add up to one calm,
deliberate feel.

This consistency sketch composes all five in one panel and lets you trigger them — individually via
the **Motion** bar, or all at once via **▶ Secuencia**. The variant axis is the **timing
calibration**: same motions, three different speed/curve personalities, so you can judge which one
matches the "Linear / Figma / Raycast-grade, the tool disappears into the task" register.

The five motions, all reading from the same `--dur` / `--ease` tokens:
1. **Tab switch** — sliding accent underline + a subtle body enter (fade/translate).
2. **Textarea expand** — the condensed sample-text field grows on focus (D-10 / 005-C).
3. **Preset flash** — X/Y inputs pulse accent-tint when a 9-point preset is applied (003).
4. **Drag snap** — the title jumps to an anchor, blue snap-guides flash, the element rings (007).
5. **Save confirm** — the green action morphs dirty → saving (spinner) → saved ✓ (008).

## How to View
open .planning/sketches/009-motion-coherence/index.html

**Try it:** click each Motion button to feel one transition; then **▶ Secuencia** to watch them play
back-to-back. Switch variants (A/B/C) to compare the same sequence at three timing calibrations. The
header shows each variant's live `--dur` / `--ease`.

## Variants
- **A: Calm — 170ms, ease-out-quart** (the current theme tokens). The locked default: confident,
  unhurried, motion that conveys state without drawing attention. Subtle 4px body enter.
- **B: Snappy — 100ms, tight ease-out**. Faster, more "instant pro tool." Transitions register as
  immediate feedback rather than animation. Minimal 2px enter. Risk: can feel abrupt / mechanical.
- **C: Expressive — 240ms, ease-out-expo + bigger enter**. More visible motion: a 10px translate +
  slight scale on body enter, longer position glides. More delight / more "alive." Risk: feels slow on
  a panel you operate constantly.

## Winner: A — rationale
**Calm (170ms, ease-out-quart)** won, confirming the existing theme tokens. The five micro-motions
*do* cohere as one vocabulary — same ease-out-quart curve family, durations proportional to the
distance each element travels (quick state changes at `--dur`, slightly longer position glides at
`--dur2`) — so the question reduced to calibration, and Calm is right for a tool you operate at high
frequency. Snappy (B, 100ms) read as immediate feedback but tipped into abrupt/mechanical on the save
morph and tab underline, where a beat of motion *is* the reassurance. Expressive (C, 240ms + larger
enter translate/scale) was the most alive in isolation but crossed into "I'm waiting for the panel"
after a few preset clicks — exactly the failure mode a dense pro tool can't afford.

Real-build notes: keep `--dur: 170ms`, `--ease: cubic-bezier(0.22, 1, 0.36, 1)`, and the two-tier
timing (state at `--dur`, travel at `--dur2 ≈ 300ms`). All five motions must collapse under
`prefers-reduced-motion` to instant state changes with no travel/enter — not shown in the sketch but
required in the build.

## What to Look For
- **Coherence first, speed second:** in ▶ Secuencia, do the five motions feel like **one vocabulary**
  (same curve family, proportional durations) or like five different libraries? That's the real
  question — the timing variant just calibrates a vocabulary that should already cohere.
- **Operating cadence:** you tune a reel by making *many* small adjustments. Which speed stays
  invisible after the 20th preset click — Calm, or does Snappy win for a high-frequency tool? Does
  Expressive cross from "delightful" into "I'm waiting for the panel"?
- **Position glide (snap):** the title uses a longer `--dur2` for its X/Y travel than for state
  changes. Does that two-tier timing (quick state, slightly slower travel) read as intentional?
- **Save morph:** is the spinner→✓ transition reassuring at each speed, or does Snappy make "Guardado"
  flash by too fast to register?
- **Reduced-motion:** note for the real build — all of this must collapse gracefully under
  `prefers-reduced-motion` (instant state changes, no travel/enter). Not shown here.
