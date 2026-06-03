---
created: 2026-05-30T17:28:06.147Z
title: Full Studio UI polish with impeccable skill
area: ui
resolves_phase: 26
files:
  - services/remotion-studio/src/preview/PreviewApp.tsx
  - services/remotion-studio/src/editor/components/TitleEditor.tsx
  - services/remotion-studio/src/editor/components/OverlayEditor.tsx
  - services/remotion-studio/src/editor/components/StyleControls.tsx
  - services/remotion-studio/src/editor/components/LayoutSelector.tsx
---

## Problem

The Studio control panel needs a full design polish pass. Concretely: the controls
take up too much vertical/horizontal space and are not laid out in an optimal order.
The current panels (TitleEditor, OverlayEditor, StyleControls, subtitle controls,
font grid) accumulated organically across phases 12-21 as stacked inline-styled
forms — dense, repetitive, and not prioritized by frequency of use. Captured after
Phase 21 (PNG overlays).

## Solution

Run a complete interface polish with the **`impeccable` skill** (per AGENTS.md this
is a frontend task → impeccable + frontend-design plugin are non-negotiable). Goals:
- Reduce the footprint of each control group (tighter spacing rhythm, collapse rarely
  used options, group related controls, consider columns / accordions / disclosure
  instead of one long vertical stack).
- Reorder controls by priority and task flow (most-used first), consistent across
  Titles / Overlays / Subtitles.
- Keep the established dark-theme design system but elevate hierarchy, alignment, and
  density so it reads as a deliberate, professional control panel — not stacked forms.

Scope: whole Studio right-panel UI, not a single component. Likely pairs well with the
already-captured todos: [[move sample text input into the Subtitles tab]] and the
auto-position-buttons todo (fewer raw inputs = less clutter). Consider a `/gsd-ui-phase`
(UI-SPEC) or `/gsd-sketch` pass first since this is a redesign, not a tweak.
