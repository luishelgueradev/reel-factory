---
phase: 16-render-config-flicker
plan: 03
subsystem: ui
tags: [remotion, captions, subtitle-timing, sequence-duration, vitest]

# Dependency graph
requires:
  - phase: 16-render-config-flicker
    plan: 02
    provides: "Confirmed bar-layout loaded=true, flicker=present (Issue B verified present)"

provides:
  - "isLastPage-conditional durationInFrames formula in BarLayout.tsx and TikTokLayout.tsx (studio)"
  - "Renderer copies synced (BarLayout + TikTokLayout identical to studio)"
  - "4-case unit test suite guarding the no-gap formula in captions.test.ts"
  - "Non-last pages hold Sequence until next captionPage.startMs — no blank inter-page gap"

affects:
  - "16-render-config-flicker phase (Issue B closure)"
  - "Any future phase touching caption page Sequence timing"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isLastPage-conditional durationInFrames: non-last pages extend to captionPages[i+1].startMs; last page fades after lastTokenEndMs + FADE_OUT_MS"
    - "Pure arithmetic test helper for Remotion duration formula: replicates layout logic without React/Remotion runtime"

key-files:
  created:
    - ".planning/phases/16-render-config-flicker/16-03-SUMMARY.md"
  modified:
    - "services/remotion-studio/src/compositions/BarLayout.tsx"
    - "services/remotion-studio/src/compositions/TikTokLayout.tsx"
    - "services/remotion-renderer/src/compositions/BarLayout.tsx"
    - "services/remotion-renderer/src/compositions/TikTokLayout.tsx"
    - "services/remotion-renderer/src/captions.test.ts"

key-decisions:
  - "PAGE_OVERLAP_GUARD_MS removed from duration formula for non-last pages — it was the source of the 100ms+ blank gap"
  - "Non-last page Sequence extends exactly to captionPages[i+1].startMs with no guard subtracted (Option 1 from RESEARCH.md)"
  - "PAGE_OVERLAP_GUARD_MS constant preserved in shared-styles.ts and imports (other code may reference it)"
  - "totalDurationMs clamping applied only to last page (isLastPage guard on clampedEndMs)"

patterns-established:
  - "Renderer sync: cp compositions/BarLayout.tsx and TikTokLayout.tsx studio→renderer after every layout change"
  - "Layout duration formula tests: use pure arithmetic helper in captions.test.ts — no React/Remotion runtime needed"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-05-23
---

# Phase 16 Plan 03: Fix Issue B — Subtitle Flicker via isLastPage-Conditional Sequence Duration

**Replaced safeEndMs/PAGE_OVERLAP_GUARD_MS gap formula with isLastPage-conditional durationInFrames: non-last pages extend Sequence to nextPageStartMs, last page fades after FADE_OUT_MS=300ms — eliminating blank inter-page blinks in BarLayout and TikTokLayout.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-23T20:45:00Z
- **Completed:** 2026-05-23T20:51:55Z
- **Tasks:** 2 of 3 (Task 3 is the human-verify checkpoint — awaiting)
- **Files modified:** 5

## Accomplishments

- Fixed the durationInFrames formula in both BarLayout.tsx and TikTokLayout.tsx (studio) — non-last pages now extend their Sequence to captionPages[i+1].startMs, eliminating the 100ms+ blank gap that caused the subtitle flicker
- Synced renderer copies: both BarLayout.tsx and TikTokLayout.tsx in services/remotion-renderer/src/compositions/ are byte-for-byte identical to studio
- Added 4-case unit test suite in captions.test.ts (pure arithmetic helper, no React/Remotion runtime): all 246 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix durationInFrames formula in BarLayout.tsx and TikTokLayout.tsx (studio)** - `118d757` (fix)
2. **Task 2: Add unit tests for no-gap formula + renderer sync** - `c6016fd` (test)
3. **Task 3: Human-verify checkpoint** - awaiting user observation of render output

**Plan metadata (SUMMARY + docs):** committed after checkpoint return

## Files Created/Modified

- `services/remotion-studio/src/compositions/BarLayout.tsx` — replaced safeEndMs formula with isLastPage-conditional; non-last pages extend to captionPages[i+1].startMs
- `services/remotion-studio/src/compositions/TikTokLayout.tsx` — identical formula replacement (CaptionPage JSX unchanged)
- `services/remotion-renderer/src/compositions/BarLayout.tsx` — synced from studio (cp, diff empty)
- `services/remotion-renderer/src/compositions/TikTokLayout.tsx` — synced from studio (cp, diff empty)
- `services/remotion-renderer/src/captions.test.ts` — added describe block "layout durationInFrames formula (Issue B fix)" with 4 pure-arithmetic cases

## Decisions Made

- Used Option 1 from RESEARCH.md (extend Sequence to next page start) as the most surgical fix — no new packages, no fade-animation changes
- PAGE_OVERLAP_GUARD_MS removed from the non-last-page calculation but kept in shared-styles.ts and import (non-breaking)
- totalDurationMs clamping kept for last page only (isLastPage guard on clampedEndMs) — ensures last subtitle doesn't extend past video end

## Deviations from Plan

None — plan executed exactly as written.

## TypeScript Compile Status

**remotion-studio:** No errors in BarLayout.tsx or TikTokLayout.tsx. Pre-existing errors in Root.tsx (RemotionProps type mismatch) and test files (vitest module not found) — unrelated to this plan, out of scope.

**remotion-renderer:** No errors in BarLayout.tsx or TikTokLayout.tsx. Pre-existing errors in Root.tsx and render.ts — unrelated to this plan, out of scope.

## Test Results

```
Test Files  7 passed (7)
     Tests  246 passed (246)
  Duration  972ms
```

New test cases verified:
- Case 1: non-last page (40ms gap) extends to nextPageStartMs → 26 frames (not 23 from old formula)
- Case 2: last page fades after final token → 32 frames
- Case 3: single page with totalDurationMs > fade-out end → 66 frames
- Case 4: last page clamped by totalDurationMs → 150 frames

## Diff Status (Renderer Sync)

```
diff services/remotion-studio/src/compositions/BarLayout.tsx services/remotion-renderer/src/compositions/BarLayout.tsx
(empty — files identical)

diff services/remotion-studio/src/compositions/TikTokLayout.tsx services/remotion-renderer/src/compositions/TikTokLayout.tsx
(empty — files identical)
```

## Threat Flags

None — pure arithmetic formula change with no external input, no new network endpoints, no auth path changes.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

All files exist, commits verified (118d757, c6016fd), isLastPage formula present in all 4 layout files, diff empty for both renderer sync files, 246 tests pass.

## Next Phase Readiness

- Issue B formula fix in place (studio + renderer synced)
- Unit test regression guard active
- Awaiting human verify checkpoint: user runs a /process render and observes subtitle behavior in output.mp4
- Expected outcome: subtitle bar holds visible continuously between pages — no blank/black flash between caption page transitions
- Resume signals: "approved: no flicker, Issue B closed" / "approved: flicker reduced, acceptable" / "failed: flicker persists"

---
*Phase: 16-render-config-flicker*
*Completed: 2026-05-23*
