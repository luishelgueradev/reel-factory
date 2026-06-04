---
created: 2026-06-04T00:00:00.000Z
title: Dynamic Google Font add/remove mechanism (no manual vendoring)
area: fonts
files:
  - services/remotion-renderer/src/fonts.ts
  - services/remotion-studio/src/fonts.ts
  - services/remotion-renderer/public/fonts/
  - services/remotion-studio/public/fonts/
---

## Problem

RENDER-05 (Phase 23) is only satisfiable by vendoring every selectable font as a
local woff2. The gstatic tier (`@remotion/google-fonts` `loadFont()`) registers an
`@font-face` lazily, so a blocked/slow gstatic fetch surfaces only inside Chrome at
render time and aborts the render — `loadFont`'s try/catch never sees it. Today the
full 26-font catalog is hand-vendored (commit `3b8883e`), and a coverage test fails
if a picker font is added without its woff2. That works, but **every new font is a
manual download + image rebuild**, which doesn't scale and is easy to forget.

## Solution (future phase)

Build a mechanism to add/remove Google Fonts dynamically so we never hand-vendor again:

- A vendoring helper that, given any `@remotion/google-fonts` family, pulls the
  latin-subset woff2 on demand and writes `public/fonts/<Font>-{Regular,Bold}.woff2`.
  Pattern proven in `3b8883e`: `getInfo().fonts.normal[weight].latin` → `fetch` →
  save; variable fonts reuse one file for both weights.
- Wire it to the Studio font picker: selecting a not-yet-vendored font auto-vendors
  it (and triggers/queues a renderer image rebuild so it ships offline), or surface
  a clear "vendoring…" state.
- Keep both services (renderer + studio `public/fonts/`) and `VENDORED_FONTS` in
  sync automatically instead of by hand.
- Consider letting the user remove fonts they don't use to keep the image lean.

## Context

- Memory: `font-vendoring-vs-dynamic-management`
- Relates to the Studio font picker and the Phase 26 UI convergence work.
- Requested by the user on 2026-06-04 right after the Phase 23 RENDER-05 gap-closure.
