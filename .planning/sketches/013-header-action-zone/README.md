---
sketch: 013
name: header-action-zone
question: "When 008-B's save status-chip and 010-A's Render-takes-green / Guardar-demotes land in the SAME header, is the action zone legible across idle → dirty → saving → rendering → done? And where does the save chip go while a render is running?"
winner: "B"
tags: [consistency, header, save, render, actions, states, phase-22]
---

# Sketch 013: Header Action Zone

## Design Question
Two frontier decisions collided on the same real estate and were never drawn together:
- **008-B** put a save **status chip** (`● Cambios sin guardar` → `Guardando…` → `✓ Guardado recién`)
  in the header next to a stay-put button.
- **010-A** ruled that **Render Video takes the green primary** and `Guardar config` **demotes to a
  secondary outline button** (green = the surface's one true primary action).

Stack those and the header must hold three things at once: **status chip · Guardar (outline) · Render
(green)** — plus a real edge case nobody sketched: *where does the dirty/saving chip go while a render
is running?* (The pipeline is single-job, `MAX_CONCURRENT_JOBS = 1`, so save and render can't both be
mid-flight, but the header still has to resolve the transition gracefully.)

**The reconciliation baked into all three variants:** Render is the **only** green. `Guardar config`
is **always an outline button** — its dirtiness is carried by the **chip**, never by the button going
green. That keeps the design-system rule "never two greens at once" true at all times. The variants
differ only in how the zone is *organized*.

## How to View
open .planning/sketches/013-header-action-zone/index.html

**Try it:** edit any control → header goes **dirty**; click **Guardar config** → `saving` → `saved` →
settles to `clean`. Click **Render Video** to run the 3-step pipeline on the stage. Use the two
**jumpers** (bottom-left) to drive `guardar` and `render` states independently and inspect every
combination.

## Variants
- **A: Trio, right-aligned** — `[chip] [Guardar · outline] [Render · green]` clustered on the right.
  Simplest; the chip sits inline with the buttons. While rendering, Render shows `Renderizando…`
  (disabled) and Guardar disables (can't save mid-render); the chip persists with the last save state.
- **B ★ (winner): Split zones** — **status on the left** (chip rides next to the brand as
  ambient context), **actions on the right** (`Guardar` ⟍ `Render`, separated by a hairline divider).
  Semantic split: left = *where things stand*, right = *what you can do*. The chip never competes with
  the buttons for the same corner, and it has a stable home during render.
- **C: Render-priority collapse** — idle/dirty shows the full trio; the moment a render starts, the
  save cluster **collapses** and the header morphs to an **inline progress strip** (step · bar · % ·
  Cancelar). Leans into the single-job truth: while rendering, saving is meaningless, so the header
  commits its width to the one thing happening.

## What to Look For
- **The mid-render transition.** Start a render in each variant. Does the chip/Guardar disappearing
  (C), persisting inline (A), or holding the left zone (B) feel calmest? This is the untested case.
- **Two-greens check.** Confirm Render is the only green in every state — Guardar never greens, even
  when dirty. Does the chip alone carry "you have unsaved changes" strongly enough?
- **Corner contention (A vs B).** In A the chip + two buttons share the right corner. Does it get
  busy? Does B's left/right split read more like a pro tool (Linear/Figma header)?
- **Done state.** After render completes, the Reel-listo card owns the stage. Does the header settle
  back to the editing trio cleanly, or does Render-de-nuevo + Guardar + chip feel cluttered?
