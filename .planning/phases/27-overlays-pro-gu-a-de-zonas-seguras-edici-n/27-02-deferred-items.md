# Deferred Items — Phase 27

## Pre-existing tsc --noEmit errors in remotion-renderer (out of scope for 27-02)

Discovered during 27-02 Task 1 verify (`npx tsc --noEmit`). These errors exist on the
27-02 base commit (8629f31) independent of this plan's changes — the renderer does not
gate on strict `tsc` (it runs via tsx + vitest; `npm test` is the real gate). Logged, not fixed.

- `src/Root.tsx(168,170)` — `calculateMetadata` width/height typed `{}` vs `number`.
- `src/render.ts(355,366)` — `RemotionProps` lacks an index signature for `Record<string, unknown>` (inputProps).
- `src/render.ts(383)` — `chromiumOptions.args` not in `ChromiumOptions` type (Remotion version drift).
- `src/fonts.test.ts(17,175,182,183,184,192,248)` + `src/fonts.ts(248)` — font test/type drift.

None touch the OVERLAY-02 guide-exclusion code added in 27-02 (render.ts lines ~264-288).
