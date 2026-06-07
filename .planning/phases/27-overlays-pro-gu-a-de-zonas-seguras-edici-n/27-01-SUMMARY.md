---
phase: 27-overlays-pro-gu-a-de-zonas-seguras-edici-n
plan: 01
subsystem: overlay-data-model
tags: [overlays, pipeline-config, validation, safe-zone-guide, mirror]
requires: []
provides:
  - "PngOverlayConfig.name (OVERLAY-04) + PngOverlayConfig.isGuide (OVERLAY-01/02/03)"
  - "validatePipelineConfig: name string + isGuide boolean validation (both services)"
  - "partitionGuideOverlays(overlays) -> { guides, renderable } (both services)"
  - "guide-aware splitOverlaysByLayer (guides excluded from back/front bands)"
affects:
  - "Plan 02 (render exclusion) consumes partitionGuideOverlays"
  - "Plan 03 (studio UI + preview) consumes name + isGuide + partitionGuideOverlays"
tech-stack:
  added: []
  patterns:
    - "Hand-maintained studio/renderer pipeline-config.ts mirror (AGENTS.md)"
    - "Optional-field additive validation in validatePipelineConfig per-overlay loop"
key-files:
  created:
    - services/remotion-studio/src/pipeline-config.test.ts
  modified:
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.test.ts
decisions:
  - "isGuide !== true is the renderable predicate (undefined AND false both count as renderable)"
  - "isGuide wins over layer in splitOverlaysByLayer (a guide with layer:front is still excluded)"
metrics:
  duration: ~10m
  completed: 2026-06-07
  tasks: 3
  files: 4
---

# Phase 27 Plan 01: Overlay data-model foundation (name + isGuide) Summary

Extended `PngOverlayConfig` — the hand-mirrored studio/renderer contract — with two additive optional fields (`name` for OVERLAY-04, `isGuide` for OVERLAY-01/02/03), added type validation in `validatePipelineConfig` in both services, and introduced `partitionGuideOverlays` plus guide-aware `splitOverlaysByLayer` so Plans 02 (render exclusion) and 03 (studio UI/preview) build against a single tested contract.

## What was built

- **Task 1 (4aa4795):** Added `name?: string` and `isGuide?: boolean` to `PngOverlayConfig` in both `pipeline-config.ts` files; added per-overlay validation rejecting non-string `name` (`overlays[i].name must be a string`) and non-boolean `isGuide` (`overlays[i].isGuide must be a boolean`). Renderer test coverage added (accept valid, reject wrong-type, additive-non-breaking).
- **Task 2 (4677064):** Added exported `partitionGuideOverlays(overlays) -> { guides, renderable }` (guides = `isGuide === true`, renderable = everything else) and made `splitOverlaysByLayer` filter out guides before banding (guides land in neither `back` nor `front`). Mirrored both helpers byte-identically into studio. The studio file previously had no `splitOverlaysByLayer`; it now carries both helpers.
- **Task 3 (ace4b4c):** Created `services/remotion-studio/src/pipeline-config.test.ts` (did not exist) mirroring the renderer's Phase 27 cases — guards the hand-maintained mirror against silent drift from the studio side.

## Verification

- `cd services/remotion-renderer && npm test` -> 10 files, **326 tests passed**.
- `cd services/remotion-studio && npm test` -> 22 files, **464 tests passed**.
- Mirror parity: interface + both helpers byte-identical across the two `pipeline-config.ts` files (verified via diff of the overlay region).
- No existing overlay/banding test regressed (non-guide back/front behavior unchanged).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing node_modules in worktree services**
- **Found during:** Task 1 RED (vitest could not resolve `vitest/config`).
- **Issue:** The worktree had no `node_modules` for `remotion-studio` / `remotion-renderer` (node_modules do not propagate into git worktrees — documented project gotcha).
- **Fix:** Symlinked each service's `node_modules` from the main checkout (`/home/luis/proyectos/reel-factory/services/<svc>/node_modules`) into the worktree. No package install / no network fetch — declared deps already present in the main checkout (Plan adds zero new packages, per threat T-27-03). Symlinks are build artifacts and were not staged/committed.
- **Files modified:** none committed (symlinks only).
- **Commit:** n/a.

## Threat surface scan

No new security-relevant surface introduced beyond the plan's `<threat_model>`. T-27-01 (wrong-typed name/isGuide) is mitigated by the Task 1 validation; T-27-02 (guide leaking into render) is foundationally mitigated by `partitionGuideOverlays` + guide-free `splitOverlaysByLayer` (consumed by Plan 02); T-27-03 (installs) — no package installs in this plan.

## Known Stubs

None. This is the data-model/contract layer; downstream consumers (render exclusion, UI) are Plans 02/03 by design and are documented as `affects`, not stubs.

## Commits

- `4aa4795` feat(27-01): add name + isGuide fields to PngOverlayConfig + validation
- `4677064` feat(27-01): add partitionGuideOverlays + guide-aware splitOverlaysByLayer
- `ace4b4c` test(27-01): studio pipeline-config coverage for name/isGuide + partition/banding

## Self-Check: PASSED

All created/modified files present on disk; all three task commits present in git log.
