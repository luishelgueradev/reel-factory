---
phase: 27-overlays-pro-gu-a-de-zonas-seguras-edici-n
plan: 02
subsystem: remotion-renderer
tags: [overlays, safe-zone-guide, render-exclusion, OVERLAY-02, OVERLAY-03]
requires:
  - "27-01: PngOverlayConfig.isGuide + partitionGuideOverlays + guide-aware splitOverlaysByLayer (renderer pipeline-config)"
provides:
  - "render.ts drops guide overlays before any base64 decode / fs.writeFileSync (authoritative OVERLAY-02 cut)"
  - "Root.tsx SubtitledVideo bands via guide-aware splitOverlaysByLayer (defense in depth)"
  - "render-overlay-exclusion.test.ts proving guides never enter the render path"
affects:
  - services/remotion-renderer/src/render.ts
  - services/remotion-renderer/src/Root.tsx
tech-stack:
  added: []
  patterns:
    - "Single authoritative render-side cut (render.ts) + defense-in-depth paint-path guard (Root.tsx) for guide exclusion"
key-files:
  created:
    - services/remotion-renderer/src/render-overlay-exclusion.test.ts
  modified:
    - services/remotion-renderer/src/render.ts
    - services/remotion-renderer/src/Root.tsx
decisions:
  - "render.ts is the authoritative cut: partition BEFORE decode so no guide PNG is ever written to public/ — Root.tsx banding is secondary defense, not the primary gate"
  - "No cp renderer-sync needed: render.ts has no studio twin and Root.tsx differs by design (AGENTS.md); pipeline-config.ts mirror was already identical from 27-01"
metrics:
  duration: ~12m
  completed: 2026-06-07
  tasks: 3
  files: 3
  commits: 2
---

# Phase 27 Plan 02: Render-side guide exclusion Summary

Guide overlays (`isGuide:true`) are now dropped at the authoritative render cut in `render.ts` BEFORE any base64 decode / `fs.writeFileSync`, so no guide PNG ever enters the Remotion bundle (OVERLAY-02), with `Root.tsx` banding routed through the guide-aware `splitOverlaysByLayer` as defense in depth (OVERLAY-03). Non-guide overlays render byte-identically to before.

## What Was Built

- **Task 1 — render.ts authoritative cut (commit 51e871d):** Imported `partitionGuideOverlays` from `./pipeline-config`. Replaced `const rawOverlays = pipelineConfig?.overlays ?? []` + `rawOverlays.map(...)` with `const { guides, renderable } = partitionGuideOverlays(...)` and `renderable.map(...)`. The `fs.writeFileSync(public/overlay-i.png)` call is now reachable only inside `renderable.map`, so a guide PNG can never be decoded or written. Logs `Excluded N guide overlay(s) from render (OVERLAY-02)` when guides are present. Data-URL validation, upscale heuristic, and `_resolvedFile` logic untouched for renderable overlays.
- **Task 2 — Root.tsx defense in depth + test (commit 7a99344):** Replaced the two inline filters (`backOverlays`/`frontOverlays`) with a single `splitOverlaysByLayer(overlays)` destructure. Because 27-01 made that helper guide-aware (`o.isGuide !== true` filter), a guide reaching `inputProps` is painted in neither band. JSX paint loops and back→subtitles→titles→front order unchanged. Added `render-overlay-exclusion.test.ts` (6 pure unit tests, no Chromium) asserting `partitionGuideOverlays` drops guides from `renderable`, `splitOverlaysByLayer` bands contain zero guides (including a `layer:"front"` guide), and non-guide banding matches the old inline filters.
- **Task 3 — parity + full vitest gate (no commit — verification only):** Confirmed `services/remotion-renderer/src/pipeline-config.ts` and `services/remotion-studio/src/pipeline-config.ts` are byte-identical (`diff` → IDENTICAL), so no re-mirroring needed. Ran the FULL renderer vitest suite (clobber-hazard discipline): 11 files, 332 tests, all green (326 baseline + 6 new exclusion tests).

## Verification

- `grep -n "partitionGuideOverlays" services/remotion-renderer/src/render.ts` → matches (import + partition call at line 268; decode maps `renderable` at line 272).
- `grep -n "splitOverlaysByLayer" services/remotion-renderer/src/Root.tsx` → matches (import + banding at line 98).
- No `fs.writeFileSync(public/overlay-*.png)` path is reachable for an `isGuide` overlay (it lives inside `renderable.map`).
- Full renderer vitest: **11 files / 332 tests passed.**
- NOTE (human UAT, not an executor task): a real `docker compose build/up` render of a clip with a guide loaded, confirming the MP4 shows no guide, is the final OVERLAY-02 acceptance — left to the user.

## Deviations from Plan

None for the implementation — plan executed as written.

**Out-of-scope discovery (logged, not fixed):** `npx tsc --noEmit` (Task 1's verify command) surfaces pre-existing strict-tsc errors on the 27-02 base commit (`Root.tsx` calculateMetadata width/height typed `{}`, `render.ts` `RemotionProps` index-signature + `chromiumOptions.args`, several `fonts.ts`/`fonts.test.ts` drift errors). These exist independently of this plan's changes — the renderer runs via tsx + vitest and gates on `npm test`, not strict `tsc`. None touch the OVERLAY-02 guide-exclusion code. Logged to `.planning/phases/27-overlays-pro-gu-a-de-zonas-seguras-edici-n/deferred-items.md`. The new partition code itself type-checks clean (no tsc error references lines 264-292).

## TDD Gate Compliance

Both behavior-adding tasks have `tdd="true"`. render.ts (`main()` runs on import) is a script not directly unit-testable in isolation; its behavior is proven by the Task 2 exclusion test exercising the same `partitionGuideOverlays` helper the decode loop maps over. The new `render-overlay-exclusion.test.ts` validates the contract both files depend on, and the full suite (332 tests) is green. Commits are `feat(...)` (GREEN) — no separate RED commit since the 27-01 helpers (already merged) make the contract pass; the test additionally locks the render-path invariant against future regression.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface introduced. T-27-02 (guide PNG leaking into MP4) is mitigated at both the render cut and paint path per the plan's threat register.

## Self-Check: PASSED

- FOUND: services/remotion-renderer/src/render-overlay-exclusion.test.ts
- FOUND: services/remotion-renderer/src/render.ts (modified)
- FOUND: services/remotion-renderer/src/Root.tsx (modified)
- FOUND commit 51e871d
- FOUND commit 7a99344
