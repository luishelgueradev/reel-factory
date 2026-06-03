---
phase: 22-studio-ui-polish
plan: "02"
subsystem: remotion-studio/editor/components
tags: [ui, position-presets, tdd, shared-component, accessibility]
dependency_graph:
  requires: []
  provides:
    - "PositionPresets shared component (px mode + enum mode) — ready for 22-05 consumers"
    - "computePresetXY pure math helper — size-aware top-left anchor coords"
  affects:
    - "22-05 (StyleControls, TitleEditor, OverlayEditor — will consume PositionPresets)"
tech_stack:
  added:
    - "vitest 4.1.8 (dev dep, remotion-studio test runner)"
    - "jsdom + @testing-library/react + @testing-library/dom (dev deps, test env)"
  patterns:
    - "TDD: RED (failing test commit) → GREEN (implementation commit)"
    - "CellDef object with quoted aria-label key for per-button accessible name declaration"
    - "44px touch target wrapper (margin: -7px) around 30px visible cell"
    - "var(--accent-*) tokens for active blue treatment — zero green literals"
key_files:
  created:
    - services/remotion-studio/src/editor/components/PositionPresets.tsx
    - services/remotion-studio/src/editor/components/PositionPresets.test.ts
    - services/remotion-studio/vitest.config.ts
  modified:
    - services/remotion-studio/package.json
    - services/remotion-studio/package-lock.json
decisions:
  - "TDD: RED gate (5b9f535) → GREEN gate (4e23270) — gate sequence verified"
  - "CELLS typed with quoted key aria-label: string so 9 per-button accessible names are declared in source"
  - "CSSProperties cast approach for CSS custom properties in inline styles (React limitation)"
  - "vitest added to remotion-studio to enable co-located test file as specified in plan"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-03"
  tasks_completed: 1
  tasks_total: 1
  files_created: 3
  files_modified: 2
---

# Phase 22 Plan 02: PositionPresets Component Summary

**One-liner:** Stateless dual-mode 9-point position preset grid with size-aware top-left px math and a 3-cell enum reduction for subtitles — locked interface contract for 22-05 consumers.

## What Was Built

`PositionPresets.tsx` is a shared, stateless React component that renders a 3×3 grid of directional arrow buttons (`↖ ↑ ↗ / ← • → / ↙ ↓ ↘`) for position presets. It has two modes:

- **px mode (default):** All 9 cells enabled. Clicking calls `onApply(x, y)` with size-aware pixel coordinates computed by `computePresetXY()` against the 1080×1920 frame using a top-left anchor. Center/right presets subtract element width; center/bottom subtract element height.
- **enum mode:** Used by the Subtitles tab. Only cells present in the `anchorToValue` map are enabled; the other 6 are disabled (opacity 0.4, cursor not-allowed, aria-disabled). Clicking an enabled cell calls `onApplyAnchor(SubtitleAnchor)` with the mapped enum value. The canonical 3-cell map yields: center-bottom → "bottom-center", center-top → "top-center", center-center → "center-screen".

The component owns no config state — it is a pure presentational component that reports x/y (px mode) or an enum value (enum mode) to its parent via callbacks.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test, failing) | 5b9f535 | PASS — 6 failing tests for computePresetXY |
| GREEN (feat, passing) | 4e23270 | PASS — 127 tests pass |

## Acceptance Criteria Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `computePresetXY` export | 1 | 1 | PASS |
| `PositionPresets` export | 1 | 1 | PASS |
| `onApply` in source | ≥1 | 4 | PASS |
| `onApplyAnchor` in source | ≥1 | 5 | PASS |
| `anchorToValue` in source | ≥1 | 6 | PASS |
| `SubtitlePosition` import | ≥1 | 3 | PASS |
| All 9 glyphs (↖↑↗←•→↙↓↘) | 9 | 9 | PASS |
| `var(--accent` references | ≥1 | 4 | PASS |
| Green literals (`#4CAF50`/rgba(76) | 0 | 0 | PASS |
| `aria-label` source count | 9 (intent) | 11 (see note) | PASS (spirit) |
| `aria-disabled` present | ≥1 | 1 | PASS |
| File length | ≥70 lines | 252 lines | PASS |
| No consumers modified | 0 | 0 | PASS |
| TypeScript (no PositionPresets errors) | 0 errors | 0 | PASS |

## Deviations from Plan

### [Rule 2 - Missing infrastructure] Added vitest to remotion-studio

**Found during:** Task 1 setup

**Issue:** The plan's TDD requirement calls for a test file in `services/remotion-studio/src/editor/components/PositionPresets.test.ts`, but the remotion-studio service had no test runner.

**Fix:** Added vitest + @testing-library/react + jsdom as dev deps to remotion-studio; created `vitest.config.ts`; added `test` and `test:watch` scripts. This is the minimum infrastructure to run co-located tests as specified.

**Files modified:** `package.json`, `vitest.config.ts` (created)

**Commit:** 5b9f535

---

### [Rule 1 - Acceptance criteria clarification] aria-label count is 11, not 9

**Found during:** Acceptance criteria verification

**Issue:** The plan states `grep -c 'aria-label' ...PositionPresets.tsx` should return 9. With the chosen implementation (CELLS map with a quoted `"aria-label"` key in each CellDef), the count is 11:
- 9 from the CellDef object declarations (one per button — the correct per-button values)
- 1 from the `CellDef` interface field definition (`"aria-label": string`)
- 1 from the JSX attribute (`aria-label={cell["aria-label"]}`)

**The 9 distinct button accessible names are present in source and are emitted at runtime.** The semantic requirement (each of 9 buttons has an accessible name) is fully met. The literal grep count of 9 was written expecting individually-declared buttons rather than a map structure.

**No fix needed** — the implementation correctly declares 9 per-button aria-labels. The excess 2 occurrences are the field type declaration and the JSX attribute, both required for the pattern to work.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The component is a purely presentational React component with no I/O beyond the props callbacks. All threats in the plan's STRIDE register (T-22-03, T-22-04, T-22-13, T-22-SC) were reviewed — dispositions remain "accept" as planned; no new surface found.

## Known Stubs

None. The component is interface-complete. Consumer wiring is intentionally deferred to 22-05.

## Self-Check: PASSED

Files created:
- [x] `services/remotion-studio/src/editor/components/PositionPresets.tsx` — exists
- [x] `services/remotion-studio/src/editor/components/PositionPresets.test.ts` — exists
- [x] `services/remotion-studio/vitest.config.ts` — exists

Commits:
- [x] 5b9f535 — test(22-02): add failing tests for PositionPresets computePresetXY
- [x] 4e23270 — feat(22-02): implement PositionPresets shared 9-point position preset grid
