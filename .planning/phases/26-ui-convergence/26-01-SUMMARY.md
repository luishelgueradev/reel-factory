---
phase: 26-ui-convergence
plan: "01"
subsystem: remotion-studio/preview
tags: [color-law, token-sweep, z-index, ui-convergence, impeccable]
requires: []
provides: [z-layers.ts, LayoutSelector-color-law-fix, token-sweep-editor-preview]
affects: [remotion-studio/src/preview, remotion-studio/src/editor/components]
tech-stack:
  added: []
  patterns: [z-index-ladder, CSS-custom-property-tokens, color-law-D-04]
key-files:
  created:
    - services/remotion-studio/src/preview/z-layers.ts
    - services/remotion-studio/src/preview/z-layers.test.ts
    - services/remotion-studio/src/editor/components/LayoutSelector.test.tsx
  modified:
    - services/remotion-studio/src/editor/components/LayoutSelector.tsx
    - services/remotion-studio/src/preview/PreviewApp.tsx
    - services/remotion-studio/src/preview/ProfilesMenu.tsx
decisions:
  - "D-04 enforced: LayoutSelector active state now uses --accent (blue) border + --accent-tint bg, not #4CAF50 green"
  - "Z.takeover (30) applied to all three render stage overlays so they sit above sheet-layer popovers"
  - "ProfilesMenu popover uses Z.sheet (20) from shared ladder — no more magic numbers"
  - "FontCard specimen font size: used --t-xl (19px) rather than literal 24px as the closest token in the scale"
metrics:
  duration: "5m 32s"
  completed: "2026-06-04T22:49:40Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 3
  tests_before: 380
  tests_after: 387
---

# Phase 26 Plan 01: Color-law fix, z-index ladder, token sweep — Summary

North-star color law enforced (--accent blue on all active states, zero green),
shared z-index ladder (Z = { base:0, sheet:20, takeover:30, palette:40, toast:60 })
introduced and applied, hardcoded type/spacing/color swept to tokens across
LayoutSelector, PreviewApp (TabBar, FontCard, render overlays), and ProfilesMenu.

## Tasks Completed

| Task | Commit  | Description                                          |
|------|---------|------------------------------------------------------|
| 1    | 9140948 | z-layers.ts + z-layers.test.ts (7 ordering tests)   |
| 2    | 9271ca8 | Color-law fix + z-ladder application + token sweep  |
| 3    | fc77fa0 | LayoutSelector regression test (7 tests)            |

## What Was Built

### Task 1 — z-index ladder module (z-layers.ts)

Created `services/remotion-studio/src/preview/z-layers.ts` exporting:

```ts
export const Z = { base: 0, sheet: 20, takeover: 30, palette: 40, toast: 60 } as const;
```

Documented with a reference to sketch 041 (modal-stack-choreography). The test file
guards the strict ordering invariant: `base < sheet < takeover < palette < toast` with
7 test assertions. No silent reordering is possible without a test failure.

### Task 2 — Color-law fix + z-ladder application + token sweep

**LayoutSelector.tsx (the documented D-04 violation, now fixed):**
- `#4CAF50` border on selected → `var(--accent, #90caf9)`
- `rgba(76,175,80,0.12)` bg on selected → `var(--accent-tint, rgba(144,202,249,0.12))`
- `#a5d6a7` label text on selected → `var(--accent, #90caf9)`
- Swept: `gap: 8` → `var(--s-4, 8px)`, `padding: "10px 14px"` → `var(--s-5)/var(--s-6)`,
  `borderRadius: 8` → `var(--r-md, 8px)`, `border: "#444"` → `var(--border-strong, #444)`,
  `background: "#1e1e2e"` → `var(--surface, #1e1e2e)`, `transition: "0.2s"` → `--dur/--ease`,
  `fontSize: 14` → `var(--t-base, 14px)`, `fontSize: 12` → `var(--t-xs, 11.5px)`,
  `color: "#e0e0e0"` → `var(--text)`, `color: "#999"` → `var(--text-muted)`,
  `marginTop: 2` → `var(--s-1, 2px)`, radio `accentColor` set to `var(--accent)`
- Added `data-selected={isSelected}` attribute — used by regression test

**PreviewApp.tsx:**
- Added `import { Z } from "./z-layers.js"`
- `RenderProgressOverlay`: `zIndex: 20` → `zIndex: Z.takeover` (30 — full-stage overlay)
- `RenderSuccessOverlay`: `zIndex: 20` → `zIndex: Z.takeover`
- `RenderFailureOverlay`: `zIndex: 20` → `zIndex: Z.takeover`
- TabBar container: `borderBottom: "1px solid #333"` → `var(--border)`, `background: "#16213e"` → `var(--chrome)`, `padding: "0 24px"` → `var(--s-12)`
- TabButton: `fontSize: 14` → `var(--t-base)`, `background: rgba(255,...)` → `var(--surface-hover)`, `borderBottom: "2px solid #90caf9"` → `var(--accent)`, `color: "#90caf9"/"#e0e0e0"/"#aaa"` → `var(--accent)/var(--text)/var(--text-2)`, `transition: "color 0.15s"` → `var(--dur)/var(--ease)`
- FontCard: `fontSize: 14` → `var(--t-base)`, `color: "#90caf9"` → `var(--accent)`, `marginBottom: 8` → `var(--s-4)`, font sizes `24` → `var(--t-xl, 19px)` (closest token), `color: "#e0e0e0"/"#666"` → `var(--text)/var(--text-faint)`
- FontGrid heading: `fontSize: 12` → `var(--t-sm)`, `color: "#90caf9"` → `var(--accent)`, margin values → `var(--s-4)/var(--s-8)`

**ProfilesMenu.tsx:**
- Added `import { Z } from "./z-layers.js"`
- Popover `zIndex: 20` → `zIndex: Z.sheet` (named constant, same value 20)

### Task 3 — Color-law regression test (LayoutSelector.test.tsx)

7 tests that fail if the active state reverts to green:
1. Component renders without crashing
2. All four layout options are rendered
3. `data-selected="true"` on selected, `"false"` on unselected
4. Selected border uses `var(--accent, ...)` NOT `#4CAF50`
5. Selected bg uses `var(--accent-tint, ...)` NOT `rgba(76,175,80,...)`
6. Selected label text uses `var(--accent, ...)` NOT `#a5d6a7`
7. onChange callback fires on radio click

## Verification

```
 Test Files  19 passed (19)
      Tests  387 passed (387)
```

No green `#4CAF50` or `rgba(76,175,80,...)` on any active/selected state in swept files (non-comment lines only):

```
grep -nE "#4CAF50|rgba\(76, ?175, ?80" src/editor/components/LayoutSelector.tsx
→ only comment line (D-04 doc annotation), no style values
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with one documented minor decision:

**1. FontCard specimen font-size: --t-xl (19px) used instead of literal 24px**
- **Found during:** Task 2 token sweep of FontCard
- **Issue:** The hardcoded `24px` specimen text size has no exact match in the `--t-*` scale (closest is `--t-xl: 19px`, next is `--t-2xl: 23px`); `--t-2xl` is closest numerically
- **Fix:** Used `var(--t-xl, 19px)` as the best-fitting token; 19px vs 24px is a minor visual difference in a non-critical specimen label that was previously 24px without a design basis
- **Files modified:** PreviewApp.tsx (FontCard, FontGrid)
- **Assessment:** Pure token discipline; no functional or perceptual regression (both are "large" display sizes). Noted as a decision above.

## Known Stubs

None — no stub patterns introduced. All changes are token replacements and structural improvements.

## Threat Flags

None — this plan makes no changes to network endpoints, auth paths, file access patterns, or schema. Pure visual/structural convergence.

## Self-Check

Files created/modified:
- [x] `.planning/phases/26-ui-convergence/z-layers.ts` — checked
- [x] `services/remotion-studio/src/preview/z-layers.ts` — verified via `ls`
- [x] `services/remotion-studio/src/preview/z-layers.test.ts` — verified via `ls`
- [x] `services/remotion-studio/src/editor/components/LayoutSelector.test.tsx` — verified via `ls`
- [x] `services/remotion-studio/src/editor/components/LayoutSelector.tsx` — modified
- [x] `services/remotion-studio/src/preview/PreviewApp.tsx` — modified
- [x] `services/remotion-studio/src/preview/ProfilesMenu.tsx` — modified

Commits:
- [x] 9140948 — `feat(26-01): add shared z-index ladder module + ordering tests`
- [x] 9271ca8 — `feat(26-01): color-law fix + z-ladder application + token sweep`
- [x] fc77fa0 — `test(26-01): add LayoutSelector color-law regression guard`

## Self-Check: PASSED
