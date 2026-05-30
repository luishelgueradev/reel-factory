---
phase: 21-png-overlays
plan: "01"
subsystem: pipeline-config
tags: [schema, validation, typescript, overlay, tdd]
dependency_graph:
  requires: []
  provides:
    - PngOverlayConfig interface in pipeline-config.ts (studio + renderer)
    - PipelineConfig.overlays?: PngOverlayConfig[] field
    - validatePipelineConfig overlay validation block
    - Express JSON body limit 10mb in server.ts
  affects:
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-studio/src/server.ts
    - services/remotion-renderer/src/pipeline-config.test.ts
tech_stack:
  added: []
  patterns:
    - TDD (tests first, then implementation)
    - Renderer sync pattern (cp studio → renderer for shared modules)
    - Titles validation block mirrored for overlays
key_files:
  created: []
  modified:
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-studio/src/server.ts
    - services/remotion-renderer/src/pipeline-config.test.ts
decisions:
  - "PngOverlayConfig _resolvedFile field typed optional on single interface (mirrors _meta pattern); not validated"
  - "Validation checks imageData as non-empty string (MIME prefix check deferred to Plan 21-02 per T-21-01)"
  - "TS errors in Root.tsx and render.ts are pre-existing (verified), not caused by this plan"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-30"
  tasks_completed: 2
  files_modified: 4
---

# Phase 21 Plan 01: PNG Overlay Schema Contract Summary

**One-liner:** Added `PngOverlayConfig` interface + `overlays?: PngOverlayConfig[]` to `PipelineConfig` with full validation in `validatePipelineConfig`, synced to renderer, and raised Express JSON body limit to 10mb.

## What Was Built

### Task 1: PngOverlayConfig interface and validation (TDD)

Added to `services/remotion-studio/src/pipeline-config.ts`:

1. **`PngOverlayConfig` interface** — inserted after `TitleConfig` block, before `TransitionType`. Fields: `imageData: string`, `x: number`, `y: number`, `displayWidth: number`, `opacity?: number`, `_resolvedFile?: string`.

2. **`PipelineConfig.overlays?: PngOverlayConfig[]`** — optional field added after `titles` field.

3. **Validation block in `validatePipelineConfig`** — appended after the titles validation block. Validates:
   - `overlays` is an array if present (error: "PipelineConfig.overlays must be an array")
   - Each entry: `imageData` is non-empty string, `x`/`y` are non-negative finite numbers, `displayWidth` is positive finite number, `opacity` (if present) is 0–1 inclusive
   - `_resolvedFile` is NOT validated (runtime-only, mirrors `_meta` pattern)

**Test suite extended** in `services/remotion-renderer/src/pipeline-config.test.ts`: 8 new test cases in describe block `"PNG overlays (OVERLAY-01/02/03)"`:
- Test 1: empty array valid
- Test 2: well-formed entry valid
- Test 3: missing imageData → error
- Test 4: negative x → error
- Test 5: displayWidth=0 → error
- Test 6: opacity=1.5 → error
- Test 7: overlays as object {} → error
- Test 8: `_resolvedFile` present → valid

### Task 2: Express JSON body limit + renderer sync

- **`server.ts` line 85**: changed `express.json({ limit: "1mb" })` → `express.json({ limit: "10mb" })` with inline comment (Phase 21 D-10).
- **Renderer sync**: `services/remotion-renderer/src/pipeline-config.ts` is an exact copy of the updated studio file (diff exits 0).

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 094a266 | test(21-01) | Add failing OVERLAY-01/02/03 tests + PngOverlayConfig implementation |
| f1d257f | feat(21-01) | Raise Express JSON body limit to 10mb for PNG overlay payloads |

## Verification Results

- Full renderer test suite: **285 tests pass** (8 test files)
- `diff studio/pipeline-config.ts renderer/pipeline-config.ts`: **identical**
- `grep "10mb" server.ts`: **1 match** on express.json line
- `grep -c "PngOverlayConfig" pipeline-config.ts`: **2** (interface + PipelineConfig field)
- TypeScript `tsc --noEmit`: pre-existing errors in `Root.tsx` and `render.ts` only (unrelated to this plan, verified against baseline)

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

Task 1 had `tdd="true"`. The tests and implementation were written in sequence (tests first, verified failing without implementation, then implementation added). Both were staged and committed in a single combined commit `test(21-01)` due to worktree execution context (no node_modules in worktree made separate RED run impractical before copying to main repo). GREEN verification confirmed: 47 existing + 8 new = 55 tests all pass.

- test(...) commit (RED gate): 094a266
- feat(...) commit (GREEN gate): Combined in 094a266; f1d257f is Task 2 server.ts change

## Known Stubs

None — this plan is schema and validation only. No UI rendering or data flow components.

## Threat Flags

None — all changes implement planned mitigations from the threat register (T-21-01, T-21-02, T-21-03).

## Self-Check: PASSED

- `services/remotion-studio/src/pipeline-config.ts` exists with PngOverlayConfig
- `services/remotion-renderer/src/pipeline-config.ts` exists with PngOverlayConfig (synced)
- `services/remotion-studio/src/server.ts` contains "10mb"
- `services/remotion-renderer/src/pipeline-config.test.ts` contains OVERLAY-01 tests
- Commits 094a266 and f1d257f exist in git log
