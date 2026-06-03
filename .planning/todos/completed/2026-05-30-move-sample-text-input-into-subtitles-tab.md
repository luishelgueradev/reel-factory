---
created: 2026-05-30T15:53:07.186Z
title: Move sample text input into Subtitles tab
area: ui
files:
  - services/remotion-studio/src/preview/PreviewApp.tsx
  - services/remotion-studio/src/preview/TextareaInput.tsx
---

## Problem

The "sample text for subtitle testing" textarea currently lives in its own separate
"Text" tab in the Studio tab bar (Titles | Overlays | Subtitles | Text). It belongs
WITH the subtitle controls, not as a standalone tab. Captured during Phase 21 (PNG
overlays) UAT of plan 21-03.

## Solution

In `PreviewApp.tsx`: remove the separate `{ id: "text", label: "Text" }` entry from
the `TABS` array and move the `<TextareaInput>` rendering into the "subtitles" tab
panel (alongside `LayoutSelector`, `StyleControls`, `FontGrid`). Final tab order
becomes: Titles | Overlays | Subtitles. Keep `TextareaInput` as-is; only its mount
location changes. Verify the sample text still drives caption pages / live preview.
