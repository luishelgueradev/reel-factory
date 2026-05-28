---
phase: 19-typography-text-effects
plan: "01"
subsystem: config-schema
tags: [fonts, schema, validation, remotion, typescript]
dependency_graph:
  requires: []
  provides: [OuterGlow-interface, fontWeight-field, fontStyle-field, PlusJakartaSans-font, typography-tests]
  affects: [remotion-studio, remotion-renderer, pipeline-config]
tech_stack:
  added: []
  patterns: [OuterGlow-interface-sibling-to-TextShadow, boolean-toggle-fields, hex-validation-regex]
key_files:
  created:
    - services/remotion-studio/src/compositions/typography.test.ts
  modified:
    - services/remotion-studio/src/fonts.ts
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-studio/src/compositions/TitleOverlay.tsx
    - services/remotion-renderer/src/fonts.ts
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-renderer/src/compositions/TitleOverlay.tsx
decisions:
  - "OuterGlow interface follows TextShadow pattern exactly (enabled/color/intensity/softness)"
  - "fontWeight and fontStyle as boolean toggles — false=regular/normal, true=bold/italic"
  - "DEFAULT_SUBTITLE_CONFIG.fontWeight=true preserves existing bold behavior when undefined"
  - "outerGlow.color validated via /^#[0-9a-fA-F]{6}$/ regex (T-19-01 mitigation)"
  - "TitleOverlay.tsx DEFAULT_TITLE_STYLE updated to include new Required<TitleStyleProps> fields"
metrics:
  duration_seconds: 166
  completed_date: "2026-05-28"
  tasks_completed: 2
  files_changed: 7
---

# Phase 19 Plan 01: Font Infrastructure & Schema Extension Summary

**One-liner:** PlusJakartaSans registered as default font and OuterGlow/fontWeight/fontStyle schema added to SubtitleConfig and TitleStyleProps with validated security mitigations and 19 passing unit tests.

## What Was Built

Added Plus Jakarta Sans to the font infrastructure as the new default font (TYPO-01), extended the config schema with `fontWeight: boolean`, `fontStyle: boolean`, and `OuterGlow` interface on both `SubtitleConfig` and `TitleStyleProps` (TYPO-03, TYPO-04), extended `subtitleFontSize` validation max from 120 to 200 (TYPO-02), and wrote 19 unit tests pinning all new contracts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PlusJakartaSans + extend schema + update validation | 4001ca4 | fonts.ts, pipeline-config.ts, TitleOverlay.tsx |
| 2 | Write unit tests for TYPO-01, TYPO-02, TYPO-03, TYPO-04 | 3860da9 | typography.test.ts |
| Sync | Renderer sync per AGENTS.md D-10 | 58ad8d8 | remotion-renderer/src/{fonts,pipeline-config,TitleOverlay} |

## Decisions Made

1. `OuterGlow` interface follows the `TextShadow` sibling pattern with fields `enabled/color/intensity/softness`. Color validated as `/^#[0-9a-fA-F]{6}$/` (T-19-01 CSS injection mitigation).
2. `fontWeight` and `fontStyle` are boolean toggles added to both `SubtitleConfig` and `TitleStyleProps`. The mapping `fw !== false ? 700 : 400` preserves the existing bold default when `fontWeight` is `undefined`.
3. `DEFAULT_SUBTITLE_CONFIG.fontFamily = "PlusJakartaSans"` and `.fontWeight = true` — both added to the Pick<> type and defaults object.
4. `TitleOverlay.tsx` `DEFAULT_TITLE_STYLE` required updating to satisfy `Required<TitleStyleProps>` with the new fields — fixed as part of Task 1 (Rule 1 auto-fix, caught by TypeScript compile).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TitleOverlay.tsx DEFAULT_TITLE_STYLE required new fields**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `DEFAULT_TITLE_STYLE: Required<TitleStyleProps>` in `TitleOverlay.tsx` was missing the three new fields (`fontWeight`, `fontStyle`, `outerGlow`) required by `Required<TitleStyleProps>` after the interface extension.
- **Fix:** Added `fontWeight: true, fontStyle: false, outerGlow: { enabled: false, color: "#ffffff", intensity: 0.8, softness: 20 }` to `DEFAULT_TITLE_STYLE`.
- **Files modified:** `services/remotion-studio/src/compositions/TitleOverlay.tsx`
- **Commit:** 4001ca4 (included in Task 1 commit)

**2. [Rule 2 - Missing] Renderer sync for all modified files**
- **Found during:** Post-task review (AGENTS.md D-10 obligation)
- **Issue:** `fonts.ts`, `pipeline-config.ts`, and `TitleOverlay.tsx` changed in studio but not synced to renderer.
- **Fix:** Ran renderer sync per AGENTS.md protocol — committed as chore(19-01).
- **Files modified:** `services/remotion-renderer/src/fonts.ts`, `services/remotion-renderer/src/pipeline-config.ts`, `services/remotion-renderer/src/compositions/TitleOverlay.tsx`
- **Commit:** 58ad8d8

## Verification Results

- `npx vitest run src/compositions/typography.test.ts --reporter verbose` — 19/19 tests pass
- `npx tsc --noEmit` — 0 errors in files modified by this plan (pre-existing errors in Root.tsx, PreviewPlayer.tsx, and vitest module resolution are unrelated to this plan)
- `grep -n "interface OuterGlow" services/remotion-studio/src/pipeline-config.ts` — returns line 34 match
- `grep -n "PlusJakartaSans" services/remotion-studio/src/fonts.ts` — returns import (line 6), AVAILABLE_FONTS (line 37), FONT_LOADERS (line 57)

## Known Stubs

None — this plan is schema-only (no UI controls or renderer consumption). No stubs in the files created/modified.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns. The `outerGlow.color` injection surface was explicitly addressed via the `/^#[0-9a-fA-F]{6}$/` regex validation (T-19-01 in the plan's threat register).

## Self-Check: PASSED

- FOUND: services/remotion-studio/src/fonts.ts
- FOUND: services/remotion-studio/src/pipeline-config.ts
- FOUND: services/remotion-studio/src/compositions/typography.test.ts
- FOUND: commit 4001ca4 (feat — schema + fonts)
- FOUND: commit 3860da9 (test — typography.test.ts)
- FOUND: commit 58ad8d8 (chore — renderer sync)
