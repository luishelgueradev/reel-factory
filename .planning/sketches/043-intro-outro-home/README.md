---
sketch: 043
name: intro-outro-home
question: "Phase 6 shipped intro/outro rendering but the redesigned 4-tab studio gave it no config home — if revived, where does it live, and does the design suggest it's worth reviving?"
winner: "B"
tags: [frontier, intro, outro, phase-6, dormant-feature, scope]
---

# Sketch 043: Intro / Outro Home

## Design Question
Phase 6 ("Animated Intros & Outros") shipped parameterized Remotion intro/outro sequences in v1.0 —
but the redesigned 4-tab editor (Títulos · Overlays · Subtítulos · Video) has **no home for them**,
and the current studio config schema (`pipeline-config.json`: `subtitle`, `titles`, overlays) has
**no intro/outro section**. So this is honestly two questions at once: *if* the capability is revived,
**where does it live** — and does drawing it suggest it's worth reviving at all, or that it doesn't
fit the "raw talking-head → clean reel" core value?

> ⚠️ **Scope note:** intro/outro is currently a *dormant* renderer capability, not a live config. This
> sketch explores reviving it, not rehoming a live surface. Confirm scope before building.

## How to View
open .planning/sketches/043-intro-outro-home/index.html

## Variants
- **A: Dedicated 5th tab** — an "Intro/Outro" tab beside the others, same TabLead/TabForm vocabulary (template → text → duration). Honest, but adds a 5th tab to an already-full bar (Video gets pushed right).
- **B: Timeline endcaps** — intro/outro are *temporal*, so they live as blocks at the **head and tail of the timeline strip** (020-C); clicking one opens its config in the panel. Reads "these bookend the video" — but depends on the timeline frontier, itself scope-expanding.
- **C: Folded into the Video tab** — the Video tab already holds whole-clip effects (transitions); intro/outro are whole-clip too. Sections: Intro / Transiciones / Outro. No new tab; honest grouping (whole-clip vs per-element); path of least resistance.

## What to Look For
- Does intro/outro **earn** its own tab (A), or is it occasional-enough that a Video-tab section (C) is the honest weight?
- B is elegant *if the timeline ships* — but it can't be the only home if the timeline stays deferred. Is it a layer on top of A/C rather than an alternative?
- The meta-question: drawing it, does intro/outro feel **core** to this tool (a talking-head reel maker) or like scope creep borrowed from a general video editor? The sketch is also evidence for a *don't-revive* call.
- Whichever wins: the intro/outro is whole-clip (like transitions), not per-element — does the placement make that category legible?
