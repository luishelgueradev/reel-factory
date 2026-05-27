---
quick_id: 260527-i3v
slug: fix-google-fonts-loadfont-signature-bug
status: complete
date: 2026-05-27
---

# Quick Task 260527-i3v: Fix google-fonts loadFont signature bug

One-liner: Corrected the `@remotion/google-fonts` `loadFont` call in both
`remotion-studio` and `remotion-renderer` `fonts.ts` so the options object is no
longer passed in the `style` argument slot — every font was throwing and falling
back to monospace (generic) in both the studio preview and production renders.

## Root cause

`loadFont(style?, options?)` — first positional arg is the font style. Both
`fonts.ts:122` files called `loader.loadFont({ subsets: ["latin","latin-ext"] })`,
putting the options object in the `style` slot. The lib threw
`The font <X> does not have a style [object Object]`; the surrounding try/catch
returned `"monospace"`, so all 25 Google Fonts rendered generic. Confirmed via
Chrome DevTools console on `https://reel-factory.luishelguera.dev/preview`
(SpaceGrotesk, Rubik). Affected production renders too (renderer had the same call).

## Change

Both `services/remotion-studio/src/fonts.ts` and
`services/remotion-renderer/src/fonts.ts`, line 122:

    - const result = await loader.loadFont({ subsets: ["latin", "latin-ext"] });
    + const result = await loader.loadFont("normal", { subsets: ["latin", "latin-ext"] });

Files kept identical (CLAUDE.md renderer-sync convention).

## Verification

- `npm run build:editor` → exit 0 (no TS errors).
- Rebuilt + recreated `remotion-studio`; rebuilt `remotion-renderer` image (both exit 0).
- Reloaded `/preview` (Firefox via playwright-cli): `does not have a style` console
  errors = **0** (was firing for every font incl. Inter); no `[fonts] Failed` warnings;
  subtitle text computes to `Inter` (default applies, no monospace fallback).
- Note: final *visual* confirmation in Chrome is the user's to make — the host reaches
  fonts.gstatic.com (googleapis = 200), and the signature is now correct, so the chosen
  family will load. Firefox's `resistFingerprinting` blocks the woff2 network fetch, so
  it can't be the visual oracle; the decisive signal here is the eliminated throw.

## Files modified

- services/remotion-studio/src/fonts.ts
- services/remotion-renderer/src/fonts.ts

## Follow-ups / notes

- "Plus Jakarta Sans" is NOT in the font registry (it is a planned milestone feature);
  selecting it will still fall back until added.
- Docker images `remotion-studio` and `remotion-renderer` were rebuilt; if other
  environments run older images they need a rebuild to pick up the fix.
