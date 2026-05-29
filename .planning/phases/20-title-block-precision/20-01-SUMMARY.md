---
phase: 20-title-block-precision
plan: "01"
subsystem: pipeline-config
tags: [schema, tdd, title-overlay, typescript]
dependency_graph:
  requires: []
  provides: [TitleStyleProps-x-y-borderRadius, TitleConfig-no-subtitle, validatePipelineConfig-Phase20]
  affects: [TitleOverlay.tsx, TitleEditor.tsx, remotion-renderer/pipeline-config.ts]
tech_stack:
  added: []
  patterns: [TDD-RED-GREEN, renderer-sync]
key_files:
  created: []
  modified:
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.test.ts
decisions:
  - "D-05/D-08 clean break: removed topOffset, subtitleFontSize, subtitleColor, subtitleFontFamily from TitleStyleProps with no backward-compat path"
  - "D-07: removed subtitle?: string from TitleConfig"
  - "D-09: added borderRadius?: number to TitleStyleProps; existing hardcoded 12px becomes default"
  - "Validation: x/y/borderRadius validated as non-negative numbers only (no upper-bound enforcement per RESEARCH.md recommendation)"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-29"
  tasks_completed: 2
  files_changed: 3
---

# Phase 20 Plan 01: Schema Migration — TitleStyleProps/TitleConfig Summary

Schema migration establishes the Phase 20 type contract: TitleStyleProps gains x/y pixel positioning and configurable borderRadius; subtitle-related fields and topOffset removed; validatePipelineConfig updated to match; all 47 vitest tests green.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Update pipeline-config.test.ts — Phase 20 test cases (RED) | 240eb4b | services/remotion-renderer/src/pipeline-config.test.ts |
| 2 | Schema migration — TitleStyleProps, TitleConfig, validatePipelineConfig (GREEN) | f5d99b4 | services/remotion-studio/src/pipeline-config.ts, services/remotion-renderer/src/pipeline-config.ts |

## What Was Built

**TDD RED (Task 1):**
- Removed `subtitle: "Episode 1"` from the full-config fixture in existing test (field deleted from TitleConfig)
- Added 3 valid-config tests: accepts `x`/`y` fields, accepts `borderRadius: 24`, accepts `borderRadius: 0`
- Added 3 invalid-config tests: rejects negative `x`, negative `y`, negative `borderRadius`
- Confirmed RED: 3 new "rejects" tests failed as expected (schema not yet updated)

**TDD GREEN (Task 2):**
- `TitleStyleProps` — removed `subtitleFontSize`, `subtitleColor`, `subtitleFontFamily`, `topOffset`; added `x?: number`, `y?: number`, `borderRadius?: number`
- `TitleConfig` — removed `subtitle?: string`
- `validatePipelineConfig` — removed subtitleFontSize and topOffset validation blocks; added x/y/borderRadius non-negative checks
- Synced updated `pipeline-config.ts` from studio to renderer via `cp`
- All 47 vitest tests pass (41 pre-existing + 6 new)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is schema-only; no UI rendering or component wiring.

## Threat Flags

None — schema changes are TypeScript-only types and local validation. No new network surface.

## Self-Check: PASSED

- `services/remotion-studio/src/pipeline-config.ts` — verified: `x?: number` present (2 matches), `subtitle?: string` absent (0 matches), removed fields absent
- `services/remotion-renderer/src/pipeline-config.ts` — synced from studio
- `services/remotion-renderer/src/pipeline-config.test.ts` — 47 tests, all green
- Commits 240eb4b and f5d99b4 — both verified in git log
