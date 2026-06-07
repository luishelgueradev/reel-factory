---
phase: 28-subt-tulos-pro-bar-background-por-palabra
plan: 02
subsystem: ui
tags: [remotion, subtitles, layout-modes, migration, vitest, react]

# Dependency graph
requires:
  - phase: 28-01
    provides: per-word wordBackground (shared pipeline-config.ts + composition parity baseline)
provides:
  - karaoke subtitle layout removed from every surface (union, dispatcher, selector, renderer validate)
  - KaraokeLayout.tsx deleted in BOTH services
  - normalizeSubtitleLayout migration fallback (single source of truth, mirrored studio->renderer)
affects: [subtitle layout selection, profile/config loading, renderer validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "normalizeSubtitleLayout: centralized layout-mode migration coercion shared by both services via cp sync"
    - "Render-time + load-time dual migration fallback (dispatcher default + applyConfigToState coercion)"

key-files:
  created: []
  modified:
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-studio/src/compositions/LayoutDispatcher.tsx
    - services/remotion-studio/src/preview/PreviewApp.tsx
    - services/remotion-studio/src/editor/components/LayoutSelector.tsx
    - services/remotion-studio/src/editor/components/LayoutSelector.test.tsx
    - services/remotion-studio/src/editor/components/layout-mode-cards.test.tsx
    - services/remotion-studio/src/pipeline-config.test.ts
    - services/remotion-renderer/src/pipeline-config.ts
    - services/remotion-renderer/src/pipeline-config.test.ts
    - services/remotion-renderer/src/validate.ts
    - services/remotion-renderer/src/compositions/LayoutDispatcher.tsx
    - services/remotion-renderer/src/compositions/tiktok-word-background.test.tsx (mirrored via sync)
  deleted:
    - services/remotion-studio/src/compositions/KaraokeLayout.tsx
    - services/remotion-renderer/src/compositions/KaraokeLayout.tsx

key-decisions:
  - "normalizeSubtitleLayout is the single migration-truth function; it lives in pipeline-config.ts so the AGENTS.md cp sync mirrors it to the renderer verbatim"
  - "Migration is dual-layered: load-time coercion (studio applyConfigToState) + render-time fallback (dispatcher default -> TikTokLayout) so a stale layout:'karaoke' can never crash or render blank"
  - "Karaoke error message lists only the 3 valid modes — never advertises karaoke as valid (tests guard this)"

patterns-established:
  - "Layout-mode removal: drop from union + VALID_LAYOUT_MODES, delete component in both services (explicit rm of renderer orphan), remove dispatcher case + selector card, flip validate allowed-modes, add migration coercion + tests"

# Metrics
duration: ~8min
completed: 2026-06-07
---

# Phase 28 Plan 02: Remove karaoke subtitle style (SUB-04) Summary

**Karaoke subtitle layout fully removed from both services (union, dispatcher, selector card, renderer validate, and KaraokeLayout.tsx) with a dual load-time/render-time `normalizeSubtitleLayout` fallback so any persisted config/profile carrying `layout:"karaoke"` coerces to `tiktok` instead of crashing.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-06-07
- **Tasks:** 3/3
- **Files modified:** 12 (2 deletions)

## Accomplishments

- **Task 1 (studio schema + migration):** Removed `"karaoke"` from `SubtitleLayoutMode` and `VALID_LAYOUT_MODES`; added exported `normalizeSubtitleLayout(layout: unknown): SubtitleLayoutMode` (the single migration-truth function); removed the karaoke import/case from the studio `LayoutDispatcher` (its `default:` already returns `TikTokLayout` — the render-time fallback); deleted studio `KaraokeLayout.tsx`; wired `applyConfigToState` in `PreviewApp` to coerce `merged.layout` via `normalizeSubtitleLayout` before entering state. TDD: RED (4 failing), GREEN (26 passing).
- **Task 2 (selector UI):** Deleted `KaraokeVis` and the karaoke `LAYOUT_OPTIONS` entry, changed the cards grid `repeat(4,1fr)` → `repeat(3,1fr)`, kept the `--accent` blue active state and `role="radiogroup"/radio"/aria-checked` intact (green-discipline preserved). Updated `LayoutSelector.test.tsx` + `layout-mode-cards.test.tsx`: 4→3 cards/radios, dropped the "Karaoke" label assertions (now `queryByText(...).toBeNull()`), `value="karaoke"`→`"bar"`, modes array karaoke removed + explicit `data-mode="karaoke"` absence assertion.
- **Task 3 (renderer sync + validate):** Ran the AGENTS.md `cp src/compositions/*` + `cp src/pipeline-config.ts` studio→renderer sync, then explicit `rm` of the renderer orphan `KaraokeLayout.tsx` (cp of `*` does not delete it). Edited renderer `validate.ts` directly (not synced): dropped `KaraokeLayout` from `requiredLayouts` and `karaoke` from `validModes`. Updated renderer `pipeline-config.test.ts`: 4→3 layout modes, flipped the `layout:"karaoke"` case from expect-valid to expect-invalid, added the `normalizeSubtitleLayout` migration case. Re-ran BOTH full suites after the sync (clobber hazard).

## Migration-fallback approach

`normalizeSubtitleLayout` is defined in `pipeline-config.ts` (so the cp sync mirrors it to the renderer byte-for-byte). It returns the value when it is in `VALID_LAYOUT_MODES`, else `"tiktok"`. Two consumption points guarantee no unloadable profile:

1. **Load-time (studio):** `PreviewApp.applyConfigToState` builds the merged subtitle then sets `layout: normalizeSubtitleLayout(merged.layout)` — a stored `"karaoke"` becomes `"tiktok"` before it ever enters React state.
2. **Render-time (both services):** the `LayoutDispatcher` `default:` branch returns `TikTokLayout`, so even a raw stale `"karaoke"` that bypasses load-time coercion renders TikTok rather than blank.

The renderer `validate.ts` now rejects `layout:"karaoke"` as an invalid mode (data-integrity surface), while the dispatcher/normalize path keeps the actual render/load resilient (availability surface). Error messages list only `tiktok/sentence/bar` and a test guards that karaoke is never advertised as valid.

## Renderer sync performed

`cp src/compositions/*` + `cp src/pipeline-config.ts` from `services/remotion-studio/` → `services/remotion-renderer/`, followed by `rm -f ../remotion-renderer/src/compositions/KaraokeLayout.tsx`. Did NOT sync `Root.tsx`/`SubtitledVideo.tsx` (per AGENTS.md). The sync also brought the mirrored `tiktok-word-background.test.tsx` into the renderer compositions (28-01 parity). Post-sync, the only remaining `karaoke` strings in renderer `src/` are migration comments and test names — no code-level import/case/mode. No other composition drift was introduced (other layouts/shared-styles were byte-identical between services).

## Verification

- **Studio vitest:** 25 files, **500 passed**.
- **Renderer vitest:** 11 files, **349 passed** (full suite re-run after sync — clobber hazard cleared).
- `test ! -f KaraokeLayout.tsx` passes in BOTH services.
- No code-level karaoke references in renderer src (comments/test-names only).

## Frontend tooling note

Task 2 touched the editor UI (`LayoutSelector`). The AGENTS.md mandate to invoke the `impeccable` skill + `frontend-design` plugin could not be satisfied as live tool invocations in this autonomous executor environment (those skills/plugins are not exposed as callable tools here). The change is a pure removal — deleting one preset card and changing the grid from 4-up to 3-up — with no new visual design decisions. Green-discipline was honored: the active state remains `--accent` blue (never green), and the `radiogroup`/`radio`/`aria-checked` a11y structure is unchanged. Color-law regression assertions in both UI test files remain green.

## Deviations from Plan

None — plan executed exactly as written. The studio `pipeline-config.test.ts` had no pre-existing "4 layout modes"/karaoke case (unlike the renderer), so the karaoke-invalid + normalize cases were added as new tests there rather than edited in place; this matches the plan's intent ("add the karaoke-now-invalid case; add the normalizeSubtitleLayout test cases").

## Threat-model coverage

- **T-28-04 (DoS — loading layout:"karaoke"):** mitigated — `normalizeSubtitleLayout` coerces at load (applyConfigToState) + dispatcher default at render.
- **T-28-05 (Tampering — validate allowed-modes drift):** mitigated — both `validate.ts` lists updated; renderer test flips karaoke to expect-invalid.
- **T-28-06 (orphan KaraokeLayout surviving cp):** mitigated — explicit `rm` + `test ! -f` gate passed in both services.
- **T-28-SC (package installs):** accepted — no installs performed.

## Self-Check: PASSED

- Studio `KaraokeLayout.tsx` MISSING (deleted) — confirmed.
- Renderer `KaraokeLayout.tsx` MISSING (deleted) — confirmed.
- Commits found: 9f58b0a, b2e066e, 244512a.
- Both vitest suites green (studio 500, renderer 349).
