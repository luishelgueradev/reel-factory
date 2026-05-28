---
phase: 19-typography-text-effects
plan: "03"
subsystem: ui
tags: [remotion, typescript, react, ui, font-weight, font-style, outer-glow, plus-jakarta-sans]
dependency_graph:
  requires:
    - phase: 19-01
      provides: [OuterGlow-interface, fontWeight-field, fontStyle-field, PlusJakartaSans-font]
    - phase: 19-02
      provides: [getOuterGlowStyle-helper, config-driven-fontWeight-all-layouts]
  provides:
    - StyleControls-font-size-200
    - StyleControls-fontWeight-toggle
    - StyleControls-fontStyle-toggle
    - StyleControls-outer-glow-card
    - StyleControls-PlusJakartaSans-default
    - TitleEditor-PlusJakartaSans-font-option
    - TitleEditor-font-size-200
    - TitleEditor-fontWeight-toggle
    - TitleEditor-fontStyle-toggle
    - TitleEditor-outer-glow-card
  affects: [remotion-studio, StyleControls, TitleEditor]
tech_stack:
  added: []
  patterns:
    - "Segmented toggle button pair (Regular/Bold, Normal/Italic) following Highlight Transition pattern"
    - "Section card with checkbox header (Outer Glow) following Background Highlight card pattern"
    - "IIFE pattern for titleGlow local const inside JSX render scope (TitleEditor)"
    - "fontWeight !== false active-state logic (undefined defaults to Bold/true)"
    - "fontStyle === true active-state logic (undefined defaults to Normal)"
key_files:
  created: []
  modified:
    - services/remotion-studio/src/editor/components/StyleControls.tsx
    - services/remotion-studio/src/editor/components/TitleEditor.tsx
decisions:
  - "StyleControls: glow const initialized at component scope (alongside bh) using OuterGlow type from pipeline-config.ts"
  - "TitleEditor: titleGlow initialized inside JSX via IIFE to keep it in form-render scope without polluting component state"
  - "Font size endpoint hints added to TitleEditor sliders (24/200 and 16/200) for consistency with StyleControls pattern"
  - "No renderer sync needed — Plan 03 only touches UI control files, not compositions or shared modules"
metrics:
  duration_seconds: 480
  completed_date: "2026-05-28"
  tasks_completed: 3
  files_changed: 2
---

# Phase 19 Plan 03: UI Controls — fontWeight/fontStyle Toggles, Outer Glow Card, PlusJakartaSans Summary

**One-liner:** StyleControls.tsx and TitleEditor.tsx extended with Bold/Italic segmented toggles, Outer Glow section card with color/intensity/softness sliders, font size range extended to 200, and PlusJakartaSans set as the default font — completing the user-facing typography controls.

## What Was Built

Added all user-facing typography controls to the Subtitles tab (`StyleControls.tsx`) and Titles tab (`TitleEditor.tsx`):

- **Font size extended to 200**: Subtitle slider max 120→200; title slider max 120→200; subtitle-in-title slider max 80→200
- **PlusJakartaSans as default**: fontFamily fallback changed from Inter to PlusJakartaSans in StyleControls; FONT_OPTIONS[0] and DEFAULT_TITLE_STYLE updated in TitleEditor
- **Font Weight toggle**: Segmented two-button row (Regular / Bold) in both tabs — active logic uses `fontWeight !== false` so undefined defaults to Bold (preserves existing behavior)
- **Font Style toggle**: Segmented two-button row (Normal / Italic) in both tabs — active logic uses `fontStyle === true` so undefined defaults to Normal
- **Outer Glow card**: Collapsible section card with checkbox header, revealing Glow Color (48×36px native color picker + hex display), Intensity slider (0–1 step 0.05), Softness slider (0–60px step 1)
- **Dark theme compliance**: All new controls follow the #bbb/#999 label palette, #4CAF50 accent for active state, #444 border for inactive, #1e1e2e section card background

All controls fire `onChange(partial)` / `setNewTitle()` immediately for live preview per Phase 18 D-09 pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update StyleControls.tsx — font size, fontFamily default, Bold/Italic toggles, Outer Glow card | fb25a2d | StyleControls.tsx |
| 2 | Update TitleEditor.tsx — PlusJakartaSans, extended font sizes, Bold/Italic toggles, Outer Glow card | 4fa77e4 | TitleEditor.tsx |
| 3 | Build editor bundle and run full test suite | (no code change — verification only) | dist/editor/ (gitignored) |

## Decisions Made

1. **`glow` initialized at component scope** in StyleControls (alongside `bh`) using the `OuterGlow` type imported from `pipeline-config.ts` — consistent with the `BackgroundHighlight` initialization pattern.
2. **`titleGlow` initialized via IIFE** in TitleEditor's JSX render — since TitleEditor is a stateful form component and the glow value derives from `newTitle.style?.outerGlow`, placing it inline in JSX scope avoids a separate `const` that would need to be recalculated on every render anyway.
3. **Endpoint hints added to TitleEditor font size sliders** (24/200 and 16/200) — not in the plan but added for consistency with the StyleControls pattern (Rule 2: missing critical UX feedback).
4. **No renderer sync** — Plan 03 only modifies UI control components (`StyleControls.tsx`, `TitleEditor.tsx`). These files are studio-only and are not copied to `remotion-renderer/` per AGENTS.md renderer-sync rules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Font size endpoint hints in TitleEditor sliders**
- **Found during:** Task 2
- **Issue:** TitleEditor title and subtitle font size sliders had no endpoint hint spans (24/200, 16/200). StyleControls has these hints. The plan didn't mention adding them to TitleEditor but they are part of the established slider pattern.
- **Fix:** Added `<div style={{ display: "flex", justifyContent: "space-between" }}>` hint rows below each slider in TitleEditor, matching the StyleControls pattern.
- **Files modified:** `services/remotion-studio/src/editor/components/TitleEditor.tsx`
- **Commit:** 4fa77e4 (included in Task 2)

## Verification Results

- `grep -n "max={200}" services/remotion-studio/src/editor/components/StyleControls.tsx` — returns line 96 match
- `grep -n "Outer Glow" services/remotion-studio/src/editor/components/StyleControls.tsx` — returns lines 441, 454
- `grep -n "Font Weight" services/remotion-studio/src/editor/components/StyleControls.tsx` — returns lines 107, 110
- `grep -n "PlusJakartaSans" services/remotion-studio/src/editor/components/StyleControls.tsx` — returns line 70
- `grep -c '"PlusJakartaSans"' services/remotion-studio/src/editor/components/TitleEditor.tsx` — returns 5 matches
- `grep -n "max={200}" services/remotion-studio/src/editor/components/TitleEditor.tsx` — returns lines 379, 399
- `grep -n "Outer Glow" services/remotion-studio/src/editor/components/TitleEditor.tsx` — returns lines 585, 610
- `npm run build:editor` — exits 0 (✓ built in 1.92s, 105 modules transformed)
- `npx vitest run src/compositions/typography.test.ts` — 25/25 tests pass (0 failures)

## Known Stubs

None — all controls are fully wired:
- `onChange({ fontWeight: ... })` fires immediately in StyleControls
- `setNewTitle((prev) => (...fontWeight...))` fires immediately in TitleEditor
- Outer Glow card writes to `config.outerGlow` / `newTitle.style?.outerGlow` inline
- No hardcoded empty arrays, placeholder text, or TODO/FIXME markers in the new code

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns. The Outer Glow color input uses `<input type="color">` which produces only valid `#rrggbb` values (T-19-01 browser-level mitigation). Server-side validation was added in Plan 01. The fontWeight/fontStyle toggles fire hardcoded booleans (T-19-07 accept disposition). No new packages were installed.

## Self-Check: PASSED

- FOUND: services/remotion-studio/src/editor/components/StyleControls.tsx (max={200}, PlusJakartaSans, Font Weight, Outer Glow)
- FOUND: services/remotion-studio/src/editor/components/TitleEditor.tsx (PlusJakartaSans x5, max={200} x2, Font Weight, Outer Glow)
- FOUND: commit fb25a2d (feat(19-03) — StyleControls changes)
- FOUND: commit 4fa77e4 (feat(19-03) — TitleEditor changes)
- BUILD: npm run build:editor exits 0
- TESTS: 25/25 typography tests pass

---
*Phase: 19-typography-text-effects*
*Completed: 2026-05-28*
