---
quick_id: 260608-nkh
title: Word-background (+bold/italic/glow) missing from the rendered output video
status: complete
date: 2026-06-08
commit: 4503f41
---

# Quick 260608-nkh — Per-word background absent in the OUTPUT video

User UAT after 260608-ka1: the per-word subtitle highlight renders in the Studio
preview but is **absent in the exported video**. Real render bug. Renderer-only.

## Root cause (frame-verified, not guessed)

Extracted a frame from the user's actual output (job `b03479b5`, rendered 15:50):
the active word ("están") showed its highlight *color* but had **no background
box**, while the title overlays' background boxes rendered fine.

The renderer has **three** places that rebuild a `SubtitleConfig`:
1. `render.ts` → builds `inputProps.subtitleConfig`, handed to `renderMedia()` — the
   TRUE render-path source.
2. `Root.tsx` → `SubtitledVideo` rebuilds from the incoming prop (runs AFTER #1).
3. studio `SubtitledVideo.tsx` → preview only.

`be565ca` (260607-uzv item 4) added `wordBackground` to #2 and #3 and guarded #2
with a test — but **#1 (`render.ts`) was never touched**. Since #1 runs first and
drops the field, it never reaches #2. So preview (#3) showed it; the render (#1)
silently stripped it → `getWordBackgroundStyle` got `undefined` → returned `{}`.
The regression test guarded the wrong file, giving false confidence.

`render.ts`'s whitelist was also missing `fontWeight`, `fontStyle`, `outerGlow` —
so bold/italic/subtitle-glow set in the UI also never reached the render.

## Fix

`render.ts` inputProps.subtitleConfig now forwards `wordBackground`, `fontWeight`,
`fontStyle`, `outerGlow` from `pipelineConfig.subtitle`. Extended
`root-config-build.test.ts` with a block that guards **render.ts itself** (the real
render-path source) for all four fields.

## Verification (real render, not assumed)

Re-ran the `reel-factory-remotion-renderer` step on the existing job (transcript +
caption-pages already present) with the rebuilt image → extracted frames: the
active word now shows its `#282525` background pill in the output. Confirms both
the fix AND that `box-shadow` renders correctly in Remotion's headless Chrome
(its first real render, since the field was always dropped before). Replaced the
job's stale `output.mp4` with the corrected render.

## Gate

| Check | Result |
|-------|--------|
| Renderer vitest | 363 passed / 12 files (+4 new render.ts guards) |
| Renderer image rebuilt | yes |
| Real render frame check | per-word bg present in output ✅ |

## Renderer sync

`render.ts` is renderer-only (studio preview uses `SubtitledVideo.tsx`, not
render.ts) — edited directly, NOT synced to studio.

## Commit

| Item | Hash | Type |
|------|------|------|
| render.ts whitelist: wordBackground + bold/italic/glow | `4503f41` | fix |

## Note for future

The subtitle-config whitelist trap has **three** sites, not two. Any new
SubtitleConfig field must be added to `render.ts` (render path), `Root.tsx`
(renderer rebuild) AND studio `SubtitledVideo.tsx` (preview) — and the regression
test must guard `render.ts`, the real render source.
