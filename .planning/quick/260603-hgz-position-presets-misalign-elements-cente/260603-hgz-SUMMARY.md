---
quick_id: 260603-hgz
status: complete
description: "Position presets misalign elements — measure the real rendered size instead of estimating"
commits:
  - 9ae2aa6 fix(260603-hgz): overlay presets use real aspect-ratio height
  - 3dfca09 fix(260603-hgz): title presets use measured text box instead of estimate
---

# 260603-hgz Summary — Position presets use the real element size

## Root cause
`computePresetXY` math was correct, but consumers fed it a wrong element size, so
size-dependent anchors (center/right/bottom) misaligned while size-independent
ones (left=0/top=0) worked. TitleEditor estimated `width = titleFontSize*6 +
padding*2`; OverlayEditor passed `elementHeight = displayWidth` (used width as
height). Fix (user-locked): measure the real size.

## What was done
**Task 1 — Overlays (commit 9ae2aa6):** added exported pure helper
`computeOverlayElementHeight(displayWidth, naturalWidth, naturalHeight)` in
`PositionPresets.tsx` (returns `displayWidth * naturalHeight/naturalWidth`,
integer-rounded; falls back to `displayWidth` when natural dims unknown).
`OverlayEditor` loads natural PNG dims via `Image()` in a `useEffect` keyed on
`draft.imageData`, stores them as state (`natW`/`natH`), and feeds the computed
height to `PositionPresets`. Natural dims are runtime-only — never persisted to
pipeline-config.json. 7 unit tests added.

**Task 2 — Titles (commit 3dfca09):** added `measureTitleBox()` in
`TitleEditor.tsx` — a detached DOM node that exactly replicates `TitleOverlay`'s
box (`width: 80%` = 864px of 1080, `padding: ${padding}px 24px`, flex-centered;
inner span with fontSize/fontWeight/fontStyle/fontFamily/lineHeight/pre-wrap),
appended to `document.body`, measured via `offsetWidth`/`offsetHeight`, removed.
Re-measures on text/style change, awaiting `document.fonts.ready` for correct
web-font metrics. The `fontSize*6` / `*1.5` estimate was removed.

## Verification
- Studio vitest: 142 passed (135 + 7 new overlay-height tests).
- `npm run build:editor`: exit 0.
- Editor-only change — no composition/renderer edits, so no renderer-sync needed.
- DOM-based title measurement cannot be unit-tested under jsdom (no layout →
  offsetWidth=0); verified via build + live human re-check on port 3123.

## Self-Check: PASSED
- Overlay presets use real PNG aspect ratio ✓
- Title presets use measured text box; estimate removed ✓
- No runtime-only fields leak into saved config ✓
- Tests green, build exit 0 ✓
