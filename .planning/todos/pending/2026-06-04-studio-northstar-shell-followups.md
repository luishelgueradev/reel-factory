---
created: 2026-06-04T00:00:00.000Z
title: North-star shell follow-ups deferred from Phase 26 (rail, header consolidation, live specimen)
area: ui
files:
  - services/remotion-studio/src/preview/PreviewApp.tsx
  - services/remotion-studio/src/editor/components/StyleControls.tsx
---

## Problem

Phase 26 (UI convergence) deliberately converged WITHIN the existing 3-column shell and
explicitly deferred the heavier north-star moves (26-CONTEXT D-02/D-03, 26-RESEARCH §OUT)
because they are a large/high-risk app-shell refactor — inappropriate for an unattended run.

## Deferred items (north-star depth, not divergence)

1. **Left activity rail** (sketch 033-nav-shell-v4) — an app-level nav rail (Editor · Cola ·
   Resultados · ⚙) that separates app-wayfinding from screen actions. Requires a top-level
   AppShell refactor (~40h, HIGH RISK; touches app architecture + state).
2. **Header preset bar + TabBar consolidation into one dense row** (sketch 037-north-star-v4) —
   depends on the rail to free the header; layout-brittleness risk; needs a sub-bar fallback.
3. **Live specimen animation** (sketch 025-caption-animation-preview) — word-by-word caption
   animation looping in the Subtitles/Titles panels; depends on caption-renderer integration
   in edit mode. Phase 26 shipped STATIC preset cards instead.
4. **Frontier screens** (separate phases): results library (038), batch queue (030), pipeline
   inspection / transcript + silence-cut review (028/029), command palette (036), settings
   sheet (032), intro/outro home (043).

## Solution

Plan these as a dedicated Phase 27+ (or a new milestone). The rail + header consolidation
are the highest-payoff/highest-risk pair and should be done with the user present (visual,
architectural). Anchor to the same sketch corpus in `.planning/sketches/`.

## Context

Captured at the close of milestone v1.4 (Studio como producto usable, phases 23-26).
UICONV-01/02 were met within the existing shell; this is the next tier of polish.
