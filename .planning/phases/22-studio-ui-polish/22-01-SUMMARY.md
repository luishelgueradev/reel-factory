---
phase: 22-studio-ui-polish
plan: "01"
subsystem: pipeline-config-schema
tags: [schema, validation, tdd, overlay, layer, d-03]
dependency_graph:
  requires: []
  provides: [PngOverlayConfig.layer field, layer validator]
  affects: [22-03-overlay-editor, 22-04-layering-implementation]
tech_stack:
  added: []
  patterns: [optional-field validator branch (analog to opacity)]
key_files:
  created: []
  modified:
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.test.ts
decisions:
  - "D-03 layer field is OPTIONAL with no default enforced by validator — missing layer is valid (back applied at runtime by 22-04 consumers)"
  - "Validator error uses index template: overlays[N].layer must be \"back\" or \"front\""
  - "Studio + renderer pipeline-config.ts kept byte-identical for PngOverlayConfig + validator per renderer-sync convention"
metrics:
  duration: "185s"
  completed_date: "2026-06-03"
  tasks_completed: 1
  files_changed: 3
---

# Phase 22 Plan 01: PngOverlayConfig Layer Field (D-03/D-04) Summary

**One-liner:** Added `layer?: "back" | "front"` to PngOverlayConfig schema + validator in both studio and renderer pipeline-config.ts, with 5 TDD test cases covering the enum contract.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing layer test cases | ebb6570 | services/remotion-renderer/src/pipeline-config.test.ts |
| 1 (GREEN) | Layer field + validator implementation | 986c96c | services/remotion-studio/src/pipeline-config.ts, services/remotion-renderer/src/pipeline-config.ts |

## What Was Built

Added the `layer` enum field to `PngOverlayConfig` in both the studio and renderer copies of `pipeline-config.ts`, following the same optional-field pattern established by `opacity`. The validator rejects any `layer` value not in `{"back", "front"}` while treating a missing `layer` as valid (runtime default of `"back"` is applied by consumers in 22-04, not by the schema).

The 5 new renderer test cases follow the existing overlay test structure in `pipeline-config.test.ts` (Tests 9–13 in the D-03 block).

## Acceptance Criteria Results

- `grep -c 'layer?: "back" | "front"' services/remotion-studio/src/pipeline-config.ts` → 1 PASS
- `grep -c 'layer?: "back" | "front"' services/remotion-renderer/src/pipeline-config.ts` → 1 PASS
- Validator error string present in both files PASS
- `diff <(grep -A8 'interface PngOverlayConfig' studio/pipeline-config.ts) <(grep -A8 'interface PngOverlayConfig' renderer/pipeline-config.ts)` → empty PASS
- `npm test pipeline-config.test.ts` → 60/60 tests pass (55 existing + 5 new layer) PASS
- Full renderer suite → 298/298 tests pass PASS
- Missing-layer overlays validate clean (regression guard for Phase 21 configs) PASS

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan only adds schema fields and a validator branch. No UI or data rendering is involved.

## Threat Flags

None — the `layer` field is a closed enum with validator enforcement (T-22-01 mitigated). No new network surface.

## TDD Gate Compliance

- RED gate commit: ebb6570 (`test(22-01): add failing layer field test cases for D-03`)
- GREEN gate commit: 986c96c (`feat(22-01): add PngOverlayConfig.layer field + validator to studio and renderer`)
- REFACTOR gate: not needed (minimal implementation, no cleanup required)

## Self-Check: PASSED

- services/remotion-studio/src/pipeline-config.ts — layer field present FOUND
- services/remotion-renderer/src/pipeline-config.ts — layer field present FOUND
- services/remotion-renderer/src/pipeline-config.test.ts — 5 D-03 tests present FOUND
- Commit ebb6570 exists FOUND
- Commit 986c96c exists FOUND
- Full test suite 298/298 PASSED
