---
slug: subtitle-style-fields-not-passed-through
date: 2026-05-29
status: complete
---

# Quick Task: Subtitle style fields (fontWeight, fontStyle, outerGlow) not passed through to renderer

## Problem

Both `SubtitledVideo.tsx` (studio player) and `Root.tsx` (renderer) manually enumerate config fields when constructing the local `config` object from `subtitleConfig` prop. Three fields were missing from this enumeration:

- `fontWeight` — silently dropped → always renders as bold (default `fontWeight !== false ? 700 : 400`)
- `fontStyle` — silently dropped → always renders as normal
- `outerGlow` — silently dropped → `getOuterGlowStyle(undefined)` returns `{}`, glow never renders

The renderer's `Root.tsx` also missed `subtitleWidth`.

The values were correctly saved in pipeline-config.json and loaded into React state, but discarded at the rendering boundary.

## Fix

Added the missing fields to the config object construction in:

1. `services/remotion-studio/src/SubtitledVideo.tsx` — added `fontWeight`, `fontStyle`, `outerGlow`
2. `services/remotion-renderer/src/Root.tsx` — added `fontWeight`, `fontStyle`, `outerGlow`, `subtitleWidth`
