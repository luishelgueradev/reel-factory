# Quick 260607-uzv-05: Symmetric visible word-background padding (live-UAT follow-up) Summary

Live-UAT follow-up to item-04's per-word tiktok background. The highlighted
word's color bar looked "pegado" to the next word, with no clean, symmetric L/R
color padding. Fixed by switching the bar from `padding + negative-margin` to a
`box-shadow` spread ring. FRONTEND (Remotion composition) + renderer sync.

## Tooling (frontend mandate)

- `impeccable` skill: invoked at start. No `PRODUCT.md` / `DESIGN.md` present
  (`load-context.mjs` → `hasProduct:false`); nudged toward `/impeccable document`
  and proceeded under the **product** register with the shared design laws.
- `sketch-findings-reel-factory`: the project's codified design context, honored.
- Live browser verification via `playwright-cli` (Firefox, no embedded creds) per
  the `playwright-studio-auth-gotcha` memory.

## Root cause (proven with DOM measurement, not guessed)

The stated hypothesis ("the negative margin lets neighbors overlap and nullify
the padding") was **partially right but mis-located**:

- The padding *inside* the bg box was already symmetric (3px / 3px to its own
  text) — geometrically present, not cancelled.
- The real defect: `margin: 0 -${p}px` cancels the padding's **inline advance**
  by pulling all *following* content left by `p`px. That is asymmetric — the
  previous word keeps full inter-word spacing while the next word is dragged flush
  against (or, at larger `p`, *over*) the bar.

Measured (Studio Player, scale 0.31, composition px):

| Active word | padL/padR (within bg) | prevGlyph → bar | bar → nextGlyph |
|---|---|---|---|
| "el" (p=3, OLD) | 3 / 3 | 13px | **1px** |
| "contigo" (p=12, OLD) | 12 / 12 | 4px | **−8px (overlap)** |

Compounding factor: the Player renders the 1080-wide composition at **scale
0.31**, so a real 3px band → **0.93px on screen** (sub-pixel), invisible in the
preview regardless of geometry.

## Fix

`getWordBackgroundStyle` (`shared-styles.ts`) now returns a box-shadow spread
ring instead of padding+margin:

```
backgroundColor: rgba(...)            // fills the word (tight, padding 0)
borderRadius:    `${borderRadius}px`
boxShadow:       `0 0 0 ${p}px rgba(...)`   // symmetric L/R/T/B color band
```

An outer box-shadow (a) contributes nothing to layout → no shift when the bar
appears AND neighbors are never pulled toward it (the band reaches symmetrically
into the inter-word whitespace on both sides), and (b) is clipped to *outside*
the border box, so it tiles seamlessly with the inner fill — uniform alpha even
at opacity < 1 (no double-composite seam). The lead/trail-whitespace split in
`CaptionWord` is unchanged (bar still wraps only the trimmed core).

## Live verification (playwright DOM, box-shadow live)

| Value | band L/R (around word) | prevGlyph → band | band → nextGlyph |
|---|---|---|---|
| p=12 | 12 / 12 | 4px | 4px (symmetric, no overlap) |
| **p=3 (production)** | **3 / 3** | **13px** | **13px** (symmetric) |

Screenshots confirmed: balanced color on both sides, clean breathing room to
neighbors, no "pegado" effect. Was 13/1 asymmetric under the old code; now 13/13.

## Renderer sync

- Per-file `cp` studio→renderer for `shared-styles.ts`, `TikTokLayout.tsx`,
  `typography.test.ts`, `tiktok-word-background.test.tsx`; `diff -q` byte-identical.
- Pre-sync `git diff` confirmed no renderer-only fix was clobbered.
- Full renderer vitest re-run post-sync (clobber-hazard check) — green.
- `Root.tsx` / `SubtitledVideo.tsx` NOT synced (per the sync rules).

## Tests updated

- `typography.test.ts` (both services): `getWordBackgroundStyle` shape assertions
  now expect `boxShadow: "0 0 0 Npx rgba(...)"` (no `padding` / `margin`).
- `tiktok-word-background.test.tsx` (both services): render-smoke asserts the bar
  span carries the box-shadow and has empty `padding`/`margin`.

## Gate

| Check | Result |
|-------|--------|
| Studio vitest | 550 passed / 29 files |
| Renderer vitest | 359 passed / 12 files |
| `npm run build:editor` | PASS |
| Renderer mirror parity | byte-identical (4 files) |
| Docker images rebuilt | studio + renderer (`docker compose build`) |
| Live UAT | symmetric 3px band, no shift, no overlap (DOM-measured + screenshots) |

## Deploy

- Both images rebuilt; `remotion-studio` recreated. Basic auth restored (root → 401).
- `pipeline/pipeline-config.json` was temporarily set to magenta/large padding for
  measurement, then **restored from backup** (no diff vs committed).

## Commit

| Item | Hash | Type |
|------|------|------|
| Symmetric word-bg via box-shadow spread | `0ed060b` | fix |
