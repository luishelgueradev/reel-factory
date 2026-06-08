---
quick_id: 260608-ka1
title: Even out word-background highlight vertical vs horizontal padding
status: complete
date: 2026-06-08
commit: d6efc47
---

# Quick 260608-ka1 — Word-background highlight padding evenness Summary

Follow-up to 260607-uzv-05 (box-shadow word bg). User live-UAT: the highlight's
top/bottom padding was visibly larger than left/right, and grew faster vertically
when the size slider was increased. Fixed by hugging the glyph vertically with a
tight line-height on the bar. FRONTEND (Remotion composition) + renderer sync.

## Tooling (frontend mandate)

- `impeccable` skill invoked (product register; no PRODUCT.md/DESIGN.md present).
- Live browser verification via `playwright-cli` (Firefox, no embedded creds) per
  [[playwright-studio-auth-gotcha]]; DOM measurement of colored region vs glyph
  ink (canvas `actualBoundingBox`) at the Studio Player's 0.31 preview scale.

## Root cause (DOM-measured, not guessed)

The bar span is `display:inline-block`, so its border-box **height = line-height**.
It inherits the caption's spacing (config Interlínea = 1.3 → `1.3×60 = 78px`),
while its **width hugs the glyph advance**. The glyph ink is only ~46–57px tall.
The `box-shadow` spread (the size control) is uniform on all sides, so:

| | composition px |
|---|---|
| bar box height (line-height) | 78 |
| glyph ink height | 46–57 |
| vertical padding / side | **19** |
| horizontal padding / side | **3** |
| ratio | **6.3×** |

Complaint #2 (grows more vertically): horizontal band growth collides with
neighbor words (gets visually covered); vertical grows unobstructed.

## Fix

`getWordBackgroundStyle` (`shared-styles.ts`) now adds `lineHeight: 0.95`
(`WORD_BG_LINE_HEIGHT`) to the active word's bar style, shrinking the box to ≈ the
glyph em so the uniform box-shadow spread reads as even padding on all sides.

`0.95` chosen by live measurement: the tallest words (ink 57 + 5px stroke = 62)
become exactly even (3px/side) and stay fully covered (colored height 63 ≥ 62);
box 57 ≥ fill ink 57 means no clipping even at padding 0. Line-height only changes
the box height — the glyph stays baseline-anchored, so no horizontal shift and no
vertical jump on activation.

## Live verification (playwright DOM, after rebuild)

| Word (ink) | horizPad | vertPad | ratio | covers | baseline jump |
|---|---|---|---|---|---|
| pronunciamos (56) | 3 | 3.5 | **1.17** | yes | 0 |
| compartir (56) | 3 | 3.5 | **1.17** | yes | 0 |
| de (46) | 3 | 8.5 | 2.83 | yes | 0 |

Was uniformly 6.3× before. Tall words now even; short words much improved (and at
the user's actual padding=10 the short-word ratio is ~1.5×). No clipping, no
baseline shift (`lineBottomDelta_vs_neighbor = 0` for all). Real-size screenshot
confirms a balanced pill.

## Known limitation

Short x-height words (no ascender/descender, e.g. "de", "el") keep the font's
baseline **descent reservation** below the glyph, so their bar is slightly
bottom-heavy. This is inherent to baseline-relative inline backgrounds; only
`text-box-trim` removes it, and its support differs between the Studio preview
browser and the renderer's Chrome, so it was not used (would desync preview vs
final render). Documented for a possible future enhancement.

## Renderer sync

- Per-file `cp` studio→renderer: `shared-styles.ts`, `typography.test.ts`,
  `tiktok-word-background.test.tsx`; `diff -q` byte-identical.
- Pre-sync `git diff` confirmed no renderer-only fix clobbered. Full renderer
  vitest re-run post-sync. `TikTokLayout.tsx` not touched this task.

## Gate

| Check | Result |
|-------|--------|
| Studio vitest | 550 passed / 29 files |
| Renderer vitest | 359 passed / 12 files |
| `npm run build:editor` | PASS |
| Renderer mirror parity | byte-identical (3 files) |
| Docker images rebuilt | studio + renderer |
| Live UAT | tall words even (1.17×), no clip, no shift (DOM-measured + screenshots) |

## Deploy

- Both images rebuilt; `remotion-studio` recreated. Basic auth restored (root → 401).
- `pipeline/pipeline-config.json` temporarily set to magenta for measurement, then
  restored from backup (no diff vs committed; user's real config padding=10 intact).

## Commit

| Item | Hash | Type |
|------|------|------|
| Even word-bg padding via tight line-height | `d6efc47` | fix |
