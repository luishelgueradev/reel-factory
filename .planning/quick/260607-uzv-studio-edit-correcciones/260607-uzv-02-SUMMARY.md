---
phase: 260607-uzv-studio-edit-correcciones
plan: 02
subsystem: remotion-studio / remotion-renderer (Títulos)
tags: [titles, title-overlay, schema, validation, renderer-sync, frontend]
requirements: [TITLE-WIDTH-01, TITLE-GRADIENT-01]
provides:
  - "TitleStyleProps.backgroundWidth (0–100%, default 80) — configurable title box width"
  - "TitleStyleProps.backgroundGradient { enabled, fromColor, toColor } — optional vertical (top→bottom) gradient"
  - "validatePipelineConfig coverage for both fields (both services)"
  - "TitleEditor 'Ancho caja' slider + 'Degradado' FxBlock toggle + 2 color swatches"
affects:
  - services/remotion-studio/src/pipeline-config.ts
  - services/remotion-studio/src/compositions/TitleOverlay.tsx
  - services/remotion-studio/src/editor/components/TitleEditor.tsx
  - services/remotion-renderer/src/pipeline-config.ts
  - services/remotion-renderer/src/compositions/TitleOverlay.tsx
key-files:
  modified:
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-studio/src/pipeline-config.test.ts
    - services/remotion-studio/src/compositions/TitleOverlay.tsx
    - services/remotion-studio/src/editor/components/TitleEditor.tsx
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.test.ts
    - services/remotion-renderer/src/compositions/TitleOverlay.tsx
decisions:
  - "background shorthand: TitleOverlay box now uses `background: boxBackground` (was `backgroundColor`). When gradient disabled, boxBackground === the flat backgroundColor string, so `background: <color>` is equivalent — default behavior preserved."
  - "Gradient is vertical (to bottom) only — no direction control, per CONTEXT item 3 lock."
  - "Both fields OPTIONAL/additive — configs without them validate and render identically (default 80% flat box)."
metrics:
  duration: ~10m
  tasks: 3
  files: 7
  completed: 2026-06-07
---

# Phase 260607-uzv Plan 02: TÍTULOS — configurable box width + linear gradient (top→bottom) Summary

Made the title background-box width configurable (replacing the hardcoded `width:"80%"` with a `backgroundWidth` percentage, default 80) and added an optional vertical `linear-gradient(to bottom, fromColor, toColor)` on the title box (`backgroundGradient { enabled, fromColor, toColor }`), wired through both services with editor controls and validation.

## What was built

- **Schema (both services):** `TitleStyleProps` gains `backgroundWidth?: number` and `backgroundGradient?: { enabled, fromColor, toColor }`. Both optional, back-compatible.
- **Validation (both services):** `validatePipelineConfig` validates `backgroundWidth` (number 0–100) and `backgroundGradient` (object-shape + 6-digit hex on both colors), mirroring the existing `outerGlow` idiom. Errors namespaced `titles[i].style.backgroundWidth` / `...backgroundGradient.*`.
- **TitleOverlay (both services):** `DEFAULT_TITLE_STYLE` gains `backgroundWidth: 80` and `backgroundGradient: { enabled:false, fromColor:"#000000", toColor:"#000000" }`. Box width is now `` `${backgroundWidth}%` ``; box background is `linear-gradient(to bottom, from, to)` when `backgroundGradient.enabled`, else the flat `backgroundColor`.
- **TitleEditor (studio):** "Ancho caja" RangeRow (0–100%, default 80, `${v}%`) in the Caja section; "Degradado" FxBlock Off/On toggle + "Desde (arriba)" / "Hasta (abajo)" color swatches (reusing the `outerGlow` toggle + `ColorSwatch` idiom). Draft→style mapping extended to persist both fields.

## Tasks & commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Schema + validation (studio) — TDD | `b843117` |
| 2 | Apply width + gradient in TitleOverlay; slider + gradient controls in TitleEditor (studio) | `9d58a3e` |
| 3 | Renderer sync (TitleOverlay + pipeline-config) + renderer tests | `8af119b` |

## Renderer sync

Mirrored ONLY the two changed files studio→renderer (`cp src/compositions/TitleOverlay.tsx` + `cp src/pipeline-config.ts`) — no bulk glob, Root.tsx/SubtitledVideo.tsx untouched. Both mirrors verified byte-identical (`diff -q`). Renderer vitest re-run after sync stayed at the 349 baseline (no clobbered renderer-only fixes), then renderer test additions brought it to 354.

## Verification

- `npm run build:editor` (studio): PASSED.
- Studio vitest: 529 passed (27 files) — was 518 baseline + 11 new title cases.
- Renderer vitest: 354 passed (11 files) — was 349 baseline + 5 new title cases.
- `grep -c 'linear-gradient(to bottom' TitleOverlay.tsx` == 1 in both services; hardcoded `width: "80%"` removed.

## UI tooling note

`impeccable` skill and the `frontend-design` plugin are not invokable as tools in this execution environment — documented skip. The `sketch-findings-reel-factory` SKILL.md was loaded and honored: new controls reuse the existing TitleEditor idioms (`RangeRow` for the slider; `segBtnStyle` toggle + `ColorSwatch` for the gradient) and use `--accent`/neutral only — green-discipline held (no `--action` green; that stays the Render CTA).

## Deviations from Plan

**1. [Rule 3 - Blocking] worktree setup**
- The expected base `4b3e0f1c` was not an ancestor of the worktree HEAD (`8c941963`); reset to `4b3e0f1c` per the worktree_branch_check recovery line. The `260607-uzv-02-PLAN.md` was not committed at that base, so it was copied in from the main checkout (untracked, not committed). node_modules absent in the worktree — symlinked from the main checkout (no installs), per the GATE constraint.

Otherwise: plan executed as written.

## Manual follow-up (not done here, per constraints)

Live Docker UAT: width slider resizes the title box; enabling "Degradado" paints a top→bottom gradient; disabling reverts to flat color. (Studio is Docker-baked — `docker compose build/up` is the user's manual step.)

## Self-Check: PASSED
- Commits `b843117`, `9d58a3e`, `8af119b` present in `git log`.
- All 7 modified files exist; both mirrors byte-identical; both vitest suites + build:editor green.
