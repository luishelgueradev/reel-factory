---
phase: 20-title-block-precision
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - services/remotion-studio/src/pipeline-config.ts
  - services/remotion-renderer/src/pipeline-config.ts
  - services/remotion-renderer/src/pipeline-config.test.ts
  - services/remotion-studio/src/compositions/TitleOverlay.tsx
  - services/remotion-studio/src/editor/components/TitleEditor.tsx
  - services/remotion-studio/src/SubtitledVideo.tsx
  - services/remotion-renderer/src/compositions/TitleOverlay.tsx
  - services/remotion-renderer/src/compositions/typography.test.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 20 migrates `TitleStyleProps` from `topOffset`-based positioning to explicit pixel `x`/`y` coordinates, adds `borderRadius` to the schema, removes the subtitle sub-block from the title overlay, and syncs renderer files to be identical to studio files. The schema, renderer, and editor are structurally consistent. The two critical findings are a `delayRender` handle that is never released on component cleanup (renderer hang risk) and NaN silently passing all numeric field validators (corrupts pipeline config). Three warnings cover a stale test that tests a nonexistent field (vacuous), a lineHeight error message that contradicts its own bounds check, and hardcoded `fps=30` in `SubtitledVideo.tsx`. Two info items cover the orphaned `textColor` field and missing upper-bound validation on `x`/`y`.

---

## Critical Issues

### CR-01: `delayRender` handle leaked when component unmounts or font family changes mid-load

**File:** `services/remotion-studio/src/compositions/TitleOverlay.tsx:82-111`
(identical code in `services/remotion-renderer/src/compositions/TitleOverlay.tsx:82-111`)

**Issue:** `delayRender(handle)` is called inside the font-loading `useEffect`. The cleanup function only sets `cancelled = true` but never calls `continueRender(handle)`. If the component unmounts (or `titleFontFamily` changes triggering effect re-execution) while a `loadFont()` promise is still in flight, the old handle is permanently leaked. The subsequent promise resolution is suppressed by the `!cancelled` guard, so `continueRender` is never reached. In Remotion's server-side renderer this causes the render worker to wait indefinitely for the unresolved handle, eventually timing out and failing the job. In the Studio Player the symptoms are subtler (frame capture stalls) but still incorrect.

**Fix:** Track the handle in the closure and call `continueRender` unconditionally in the cleanup:

```tsx
React.useEffect(() => {
  let cancelled = false;
  const fontsToLoad = [titleFontFamily].filter(
    (f, i, arr) => f && f !== "monospace" && arr.indexOf(f) === i
  );
  if (fontsToLoad.length === 0) {
    setFontLoaded(true);
    return;
  }
  let pending = fontsToLoad.length;
  let handle: number | null = delayRender(`Loading title fonts: ${fontsToLoad.join(", ")}`);

  const finish = () => {
    if (handle !== null) {
      continueRender(handle);
      handle = null;
    }
  };

  for (const f of fontsToLoad) {
    loadFont(f)
      .then(() => {
        pending--;
        if (pending === 0) {
          if (!cancelled) setFontLoaded(true);
          finish();
        }
      })
      .catch(() => {
        pending--;
        if (pending === 0) {
          if (!cancelled) setFontLoaded(true);
          finish();
        }
      });
  }
  return () => {
    cancelled = true;
    finish(); // release the handle even if promises have not settled yet
  };
}, [titleFontFamily]);
```

Apply the same fix to both `services/remotion-studio/src/compositions/TitleOverlay.tsx` and `services/remotion-renderer/src/compositions/TitleOverlay.tsx`.

---

### CR-02: NaN passes all numeric field validators in `validatePipelineConfig`

**File:** `services/remotion-studio/src/pipeline-config.ts:406-419`
(identical code in `services/remotion-renderer/src/pipeline-config.ts:406-419`)

**Issue:** Every numeric guard in the title style validation block uses the pattern:

```ts
if (s.x !== undefined && (typeof s.x !== "number" || s.x < 0)) { ... }
```

`typeof NaN === "number"` is `true` in JavaScript. `NaN < 0` is `false`. So `NaN` satisfies `typeof s.x !== "number" || s.x < 0` as `false || false = false`, meaning no error is pushed and `NaN` is accepted as a valid coordinate. This affects `x`, `y`, `borderRadius`, `titleFontSize`, `padding`, and `lineHeight` in the title style block (same structural issue exists in the subtitle block for `fontSize`, `outlineWidth`, `lineHeight`, `pastWordOpacity`, `highlightDurationMs`, `subtitleWidth`).

`parseInt("")` returns `NaN` (when user clears an `<input type="number">` in `TitleEditor`), and `Number("")` also returns `0`/`NaN` depending on context. Once `NaN` is stored in config it serializes to JSON as `null`, which then fails at render time with an incorrect CSS value (`"NaN%"`), positioning the title block at an undefined location with no actionable error.

**Fix:** Add an `isFinite` (or `Number.isFinite`) guard to each numeric check:

```ts
// Before
if (s.x !== undefined && (typeof s.x !== "number" || s.x < 0)) {

// After
if (s.x !== undefined && (typeof s.x !== "number" || !Number.isFinite(s.x) || s.x < 0)) {
```

Apply this pattern to every numeric field check in both `pipeline-config.ts` copies. The same fix also closes the gap for `subtitle.*` numeric fields.

---

## Warnings

### WR-01: `typography.test.ts` — stale test uses nonexistent field `subtitleFontSize`

**File:** `services/remotion-renderer/src/compositions/typography.test.ts:189-202`

**Issue:** The test titled `"accepts title style subtitleFontSize = 200 (new max)"` passes `style: { subtitleFontSize: 200 }`. The field `subtitleFontSize` does not exist in `TitleStyleProps`; the correct field is `titleFontSize`. Because `validatePipelineConfig` is permissive (does not reject unknown fields), the test passes trivially — it is not testing the 200-max boundary at all. The actual acceptance of `titleFontSize: 200` is not covered by any passing test, only its rejection at 201 is (line 204-218).

**Fix:** Replace the stale field name:

```ts
it("accepts title style titleFontSize = 200 (new max)", () => {
  const result = validatePipelineConfig({
    subtitle: { layout: "tiktok" },
    titles: [
      {
        text: "Test title",
        startTimeMs: 0,
        durationMs: 3000,
        style: { titleFontSize: 200 },  // was: subtitleFontSize
      },
    ],
  });
  expect(result.valid).toBe(true);
});
```

---

### WR-02: `lineHeight` error message contradicts its own validation bounds

**File:** `services/remotion-studio/src/pipeline-config.ts:415-416`
(identical in `services/remotion-renderer/src/pipeline-config.ts:415-416`)

**Issue:** The error message for title style `lineHeight` says `"must be a number between 0.1 and 3"` but the actual guard is `s.lineHeight <= 0 || s.lineHeight > 3`. A value of `0.05` passes the guard (`0.05 > 0` is true) but the error message implies it should be rejected (minimum is 0.1). Consumers relying on the error message to understand acceptable ranges will be misled; the contract visible to API callers is incorrect.

**Fix:** Either tighten the check to match the message:

```ts
if (s.lineHeight !== undefined && (typeof s.lineHeight !== "number" || s.lineHeight < 0.1 || s.lineHeight > 3)) {
  errors.push(`titles[${index}].style.lineHeight must be a number between 0.1 and 3`);
}
```

Or update the message to match the check (`> 0`):

```ts
errors.push(`titles[${index}].style.lineHeight must be a positive number <= 3`);
```

Pick one and apply consistently to both `pipeline-config.ts` copies.

---

### WR-03: `fps` hardcoded as `30` in `SubtitledVideo.tsx` for `Sequence` frame calculation

**File:** `services/remotion-studio/src/SubtitledVideo.tsx:88`

**Issue:** The `Sequence` `from`/`durationInFrames` values for title overlays are computed with a hardcoded `const fps = 30`. `TitleOverlay` itself correctly uses `useVideoConfig()` for its internal frame math. If the composition's FPS is ever changed (currently both `Root.tsx` files specify 30, but this is a fragile contract), `SubtitledVideo` will produce incorrect `Sequence` boundaries while `TitleOverlay` computes correct internal timing — causing visible desync between when a title appears/disappears and what the title component renders.

**Fix:** Read fps from `useVideoConfig()` in `SubtitledVideo`:

```tsx
import { AbsoluteFill, OffthreadVideo, staticFile, Sequence, delayRender, continueRender, useVideoConfig } from "remotion";

// Inside the component:
const { fps } = useVideoConfig();
// Remove: const fps = 30;
```

---

## Info

### IN-01: Deprecated `textColor` field retained in `TitleStyleProps` without annotation

**File:** `services/remotion-studio/src/pipeline-config.ts:75`
(identical in `services/remotion-renderer/src/pipeline-config.ts:75`)

**Issue:** `TitleStyleProps` still carries `textColor?: string` (line 75). The active field is `titleColor`. `TitleOverlay` falls back `style?.titleColor ?? style?.textColor ?? DEFAULT_TITLE_STYLE.titleColor` (line 65) — preserving `textColor` for backward compatibility is fine — but neither `TitleEditor` nor the validator acknowledges `textColor`. Callers reading the schema will not know this field is deprecated. The validator also does not warn if `textColor` is supplied without `titleColor`, which could silently mask typos.

**Fix:** Mark the field with a JSDoc `@deprecated` annotation:

```ts
/** @deprecated Use titleColor instead */
textColor?: string;
```

---

### IN-02: No upper-bound validation on `x` and `y` coordinates

**File:** `services/remotion-studio/src/pipeline-config.ts:406-410`
(identical in `services/remotion-renderer/src/pipeline-config.ts:406-410`)

**Issue:** `x` is validated as `>= 0` but has no upper bound. `TitleEditor` caps the UI input at `max={1080}` / `max={1920}`, but the validator accepts any non-negative value (e.g., `x: 5000`). Since `TitleOverlay` converts `x` to `left: ${(x / 1080) * 100}%`, an out-of-range value silently positions the title block off-screen with no validation error. Config delivered through the pipeline API bypasses the editor's `max` constraints.

**Fix:**

```ts
if (s.x !== undefined && (typeof s.x !== "number" || !Number.isFinite(s.x) || s.x < 0 || s.x > 1080)) {
  errors.push(`titles[${index}].style.x must be a number between 0 and 1080`);
}
if (s.y !== undefined && (typeof s.y !== "number" || !Number.isFinite(s.y) || s.y < 0 || s.y > 1920)) {
  errors.push(`titles[${index}].style.y must be a number between 0 and 1920`);
}
```

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
