---
phase: 28-subt-tulos-pro-bar-background-por-palabra
plan: 01
subsystem: subtitles / remotion compositions
tags: [subtitles, tiktok, wordBackground, parity, validation]
requires:
  - SubtitleConfig + validatePipelineConfig (pipeline-config.ts)
  - getOuterGlowStyle hex→rgb idiom (shared-styles.ts)
  - TikTokLayout CaptionWord/CaptionPage render path
provides:
  - WordBackground interface + SubtitleConfig.wordBackground (optional, default off)
  - getWordBackgroundStyle() shared helper (rgba bar, active-word-only)
  - per-word bar fill behind the highlighted tiktok word
  - byte-identical studio↔renderer mirror (SUB-03 parity)
affects:
  - any future editor UI that binds wordBackground controls (plan 28-03)
tech-stack:
  added: []
  patterns:
    - "hex+opacity → rgba via getOuterGlowStyle parse idiom (3-char shorthand safe)"
    - "active-word-only style: helper returns {} unless enabled && isActive"
key-files:
  created:
    - services/remotion-studio/src/compositions/tiktok-word-background.test.tsx
  modified:
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-studio/src/compositions/shared-styles.ts
    - services/remotion-studio/src/compositions/TikTokLayout.tsx
    - services/remotion-studio/src/pipeline-config.test.ts
    - services/remotion-studio/src/compositions/typography.test.ts
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-renderer/src/compositions/shared-styles.ts
    - services/remotion-renderer/src/compositions/TikTokLayout.tsx
    - services/remotion-renderer/src/compositions/typography.test.ts
    - services/remotion-renderer/src/pipeline-config.test.ts
decisions:
  - "Renderer-side React-render test (.tsx) NOT carried: renderer vitest includes only src/**/*.test.ts and lacks jsdom/@testing-library. Parity is proven on TikTokLayout.tsx/shared-styles.ts/pipeline-config.ts diff instead."
metrics:
  duration: ~25m
  completed: 2026-06-07
  tasks: 3
  files: 10
requirements: [SUB-01, SUB-02, SUB-03]
---

# Phase 28 Plan 01: Per-word bar background (wordBackground) Summary

Added a configurable rounded-rectangle "fondo por palabra" background drawn behind the highlighted tiktok word — disabled by default, with color/opacity (→ rgba)/borderRadius/padding, validated and mirrored byte-identically into the renderer for preview↔render parity (SUB-03).

## What was built

- **Schema (SUB-01/02):** `WordBackground { enabled, color, opacity, borderRadius, padding }` interface + optional `SubtitleConfig.wordBackground`. Not added to `DEFAULT_SUBTITLE_CONFIG` — stays `undefined` = off, so existing renders are unchanged.
- **Validation (T-28-01):** `validatePipelineConfig` rejects non-object, non-boolean `enabled`, non-string `color`, `opacity` outside 0–1, and negative `borderRadius`/`padding` with the exact error messages from the plan.
- **Helper (T-28-02):** `getWordBackgroundStyle(wordBackground, isActive)` returns `{}` unless enabled AND active; otherwise converts hex+opacity → `rgba(...)` (reusing the `getOuterGlowStyle` parse idiom, 3-char shorthand safe; never throws) and returns `backgroundColor` + `borderRadius` + `padding`.
- **Render (SUB-01):** `CaptionWord` exported and takes a `wordBackgroundStyle` prop spread last on the word `<span>`; `CaptionPage` computes the style per token (`{}` for non-active tokens) so the bar paints behind the highlighted word only. The "0 2px" default padding is untouched when disabled.
- **Mirror (SUB-03):** AGENTS.md `cp` sync ran; `TikTokLayout.tsx`, `shared-styles.ts`, `pipeline-config.ts` are byte-identical studio↔renderer (diff empty). Renderer `pipeline-config.test.ts` (separate copy) got the same wordBackground validation cases.

## TDD gates

- Studio Task 1: RED (`a067773`) → GREEN (`a0e5239`).
- Studio Task 2: RED (`d6e348c`) → GREEN (`b67601a`).
- Task 3 (sync, non-TDD): `99a24da`.

## Test results

- **Studio vitest: 495 passed** (baseline 477 + 18: 9 wordBackground validation, 6 getWordBackgroundStyle, 3 render-smoke).
- **Renderer vitest: 347 passed** (baseline 332 + 15: 9 wordBackground validation, 6 getWordBackgroundStyle).
- Parity gate: `TikTokLayout.tsx` / `shared-styles.ts` / `pipeline-config.ts` diff empty studio↔renderer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom padding serialization in render-smoke test**
- **Found during:** Task 2 GREEN.
- **Issue:** Test asserted `span.style.padding === "0 2px"` but jsdom serializes the shorthand to `"0px 2px"`. Test-expectation artifact, not a behavior change — the default padding is genuinely preserved when disabled.
- **Fix:** Updated the expectation to `"0px 2px"`.
- **Files modified:** services/remotion-studio/src/compositions/tiktok-word-background.test.tsx
- **Commit:** b67601a

**2. [Rule 3 - Blocking] renderer cannot run the .tsx React-render test**
- **Found during:** Task 3 sync.
- **Issue:** The AGENTS.md `cp src/compositions/*` carried `tiktok-word-background.test.tsx` into the renderer, but the renderer vitest config includes only `src/**/*.test.ts` and the renderer has no jsdom/@testing-library — the file would be a dead orphan (and would fail if ever picked up).
- **Fix:** Removed the orphan `.tsx` test from the renderer after the cp. SUB-03 parity is still fully proven via the byte-identical diff gate on the three source files; the renderer validation contract is covered by the wordBackground cases added to the renderer's own `pipeline-config.test.ts`.
- **Files modified:** (renderer orphan removed; renderer pipeline-config.test.ts extended)
- **Commit:** 99a24da

## Environment notes (not committed)

- Worktree lacked `node_modules`; symlinked from the main checkout for both services (no installs). The symlinks were deliberately NOT staged.

## Known Stubs

None — the feature is fully wired (schema → validation → helper → render → mirror). The editor UI controls are intentionally out of scope (deferred to plan 28-03, which binds to this contract).

## Self-Check: PASSED

- Files created/modified verified present (see key-files).
- Commits verified: a067773, a0e5239, d6e348c, b67601a, 99a24da all in `git log`.
- Both vitest suites green; parity diffs empty.
