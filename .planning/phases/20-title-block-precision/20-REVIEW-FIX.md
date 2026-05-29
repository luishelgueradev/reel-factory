---
phase: 20-title-block-precision
fixed_at: 2026-05-29T16:07:00Z
review_path: .planning/phases/20-title-block-precision/20-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 20: Code Review Fix Report

**Fixed at:** 2026-05-29T16:07:00Z
**Source review:** .planning/phases/20-title-block-precision/20-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: `delayRender` handle leaked when component unmounts or font family changes mid-load

**Files modified:** `services/remotion-studio/src/compositions/TitleOverlay.tsx`, `services/remotion-renderer/src/compositions/TitleOverlay.tsx`
**Commit:** b88a157
**Applied fix:** Changed `const handle` to `let handle: number | null` and introduced a `finish()` helper that calls `continueRender(handle)` exactly once (guarded by `handle !== null`) then sets `handle = null`. The cleanup function now calls `finish()` unconditionally, ensuring the handle is always released even when the component unmounts while a `loadFont()` promise is still in flight. Also restructured the `then`/`catch` callbacks to call `finish()` after the `pending === 0` check regardless of the `cancelled` flag (state update is still guarded by `!cancelled`, but the render handle release is not).

---

### CR-02: NaN passes all numeric field validators in `validatePipelineConfig`

**Files modified:** `services/remotion-studio/src/pipeline-config.ts`, `services/remotion-renderer/src/pipeline-config.ts`
**Commit:** 38efc8b
**Applied fix:** Added `!Number.isFinite(s.x)` (and equivalent) guards to every numeric field check in the title style validation block: `titleFontSize`, `x`, `y`, `borderRadius`, `lineHeight`, and `padding`. This closes the NaN bypass where `typeof NaN === "number"` and `NaN < 0 === false` caused NaN to pass all range checks silently.

---

### WR-01: `typography.test.ts` — stale test uses nonexistent field `subtitleFontSize`

**Files modified:** `services/remotion-renderer/src/compositions/typography.test.ts`
**Commit:** 2d44025
**Applied fix:** Renamed the test from `"accepts title style subtitleFontSize = 200 (new max)"` to `"accepts title style titleFontSize = 200 (new max)"` and replaced `style: { subtitleFontSize: 200 }` with `style: { titleFontSize: 200 }`. The test now actually exercises the 200-max boundary on the correct field rather than passing vacuously on a nonexistent property.

---

### WR-02: `lineHeight` error message contradicts its own validation bounds

**Files modified:** `services/remotion-studio/src/pipeline-config.ts`, `services/remotion-renderer/src/pipeline-config.ts`
**Commit:** 38efc8b (committed together with CR-02 — same lines in same files)
**Applied fix:** Changed the `lineHeight` check from `s.lineHeight <= 0` to `s.lineHeight < 0.1` so the actual validation matches the error message that already said `"must be a number between 0.1 and 3"`. Also added `!Number.isFinite(s.lineHeight)` as part of the CR-02 fix applied to the same line.

---

### WR-03: `fps` hardcoded as `30` in `SubtitledVideo.tsx`

**Files modified:** `services/remotion-studio/src/SubtitledVideo.tsx`
**Commit:** d4e806e
**Applied fix:** Added `useVideoConfig` to the remotion import and called `const { fps } = useVideoConfig()` at the top of the `SubtitledVideo` component (before the `.map()` — respecting React rules of hooks). Removed the `const fps = 30` that was previously declared inside the `.map()` callback. The `fromFrame` and `durationInFrames` calculations in the title Sequence loop now use the composition's actual fps.

---

_Fixed: 2026-05-29T16:07:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
