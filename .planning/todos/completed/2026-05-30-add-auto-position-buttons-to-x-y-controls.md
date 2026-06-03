---
created: 2026-05-30T15:53:07.186Z
title: Add auto-position buttons to x/y controls
area: ui
files:
  - services/remotion-studio/src/editor/components/OverlayEditor.tsx
  - services/remotion-studio/src/editor/components/TitleEditor.tsx
---

## Problem

Every control that exposes "x"/"y" pixel positioning (titles and PNG overlays) only
offers raw numeric inputs. Subtitles already have quick auto-position presets
(bottom center, top center, center center). Titles and overlays should get the same
affordance. Captured during Phase 21 (PNG overlays) UAT of plan 21-03.

## Solution

Add a row of auto-position buttons next to the X/Y inputs in `OverlayEditor` and
`TitleEditor`: top, bottom, left, right, center-x, center-y (and combined corners/
center as appropriate). Each button computes x/y from the 1080x1920 frame and the
element's size, then updates the draft via the existing `handleDraftChange` so live
preview reflects it. Mirror the subtitle position-preset pattern for consistency.
Consider extracting a small shared `PositionPresets` component so titles/overlays
(and future positioned elements) reuse one implementation. Note: overlay anchor is
top-left of the image at displayWidth; account for image width/height when centering.
