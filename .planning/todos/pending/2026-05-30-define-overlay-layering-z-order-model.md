---
created: 2026-05-30T15:53:07.186Z
title: Define overlay layering / z-order model
area: ui
files:
  - services/remotion-studio/src/SubtitledVideo.tsx
  - services/remotion-renderer/src/Root.tsx
  - services/remotion-studio/src/compositions/PngOverlay.tsx
---

## Problem

There is no defined model for how PNG overlays stack — neither among themselves nor
relative to titles and subtitles. Today (Phase 21, plan 21-02) `SubtitledVideo`
renders overlays AFTER titles, so overlays sit ABOVE the text. That is likely the
wrong default: overlays are decorators (logos, watermarks, frames) and should
generally sit BELOW titles/subtitles, not cover them. Captured during 21-03 UAT.

## Solution

TBD — design decision needed. Open questions:
- Default layer order: overlays BELOW titles/subtitles (proposed default), or
  configurable per-overlay z-index / "send to back / bring to front".
- Ordering among multiple overlays (array order = paint order? explicit z field?).
- Apply the chosen model consistently in BOTH `SubtitledVideo` (studio) and the
  renderer (`Root.tsx` inline `SubtitledVideo`), keeping studio/renderer in sync.
Consider running `/gsd-discuss-phase` (or a short spec) before implementing, since
this is partly a UX/design choice, not just a code change.
