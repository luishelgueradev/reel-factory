---
created: 2026-06-04T00:00:00.000Z
title: Clean up pre-existing tsc --noEmit errors in remotion-studio
area: tech-debt
files:
  - services/remotion-studio/src/Root.tsx
  - services/remotion-studio/src/fonts.ts
  - services/remotion-studio/src/index.ts
  - services/remotion-studio/src/preview/PreviewPlayer.tsx
  - services/remotion-studio/src/server.ts
---

## Problem

`npx tsc --noEmit` in `services/remotion-studio` reports several type errors that the
build never catches because the build uses Vite/esbuild (transpile-only, no full
typecheck). Surfaced during the Phase 24 unattended run. NONE are in Phase 24 code
(profiles.ts / ProfilesMenu.tsx / *-profiles* tests are clean) — they are pre-existing
debt from earlier phases:

- `Root.tsx:41` — `{}` not assignable to `number`
- `fonts.ts:252` — `result` is of type `unknown` (gstatic tier, 23-03)
- `index.ts:10,18` — `server` possibly `undefined` (phase 6)
- `PreviewPlayer.tsx:135` — `FC<RemotionProps>` vs `LooseComponentType` mismatch (23-04)
- `server.ts` (result proxy) — `ReadableStream` / `Readable.fromWeb(upstream.body!)` typing (23-02)

## Solution

Fix the type errors so `tsc --noEmit` passes clean, then add a `typecheck` script and
wire it into the test/CI gate so type regressions are caught. Do it as a focused
tech-debt pass (not mixed into a feature phase) to avoid destabilizing phase-23/6 code.

## Context

Build (`npm run build:editor`) and all vitest suites are green; this is type-only debt.
Captured during Phase 24 (named config profiles) verification.
