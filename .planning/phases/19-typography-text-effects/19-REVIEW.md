---
phase: 19-typography-text-effects
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - services/remotion-studio/src/pipeline-config.ts
  - services/remotion-studio/src/fonts.ts
  - services/remotion-studio/src/compositions/shared-styles.ts
  - services/remotion-studio/src/compositions/TikTokLayout.tsx
  - services/remotion-studio/src/compositions/BarLayout.tsx
  - services/remotion-studio/src/compositions/KaraokeLayout.tsx
  - services/remotion-studio/src/compositions/SentenceLayout.tsx
  - services/remotion-studio/src/compositions/TitleOverlay.tsx
  - services/remotion-studio/src/compositions/typography.test.ts
  - services/remotion-studio/src/editor/components/StyleControls.tsx
  - services/remotion-studio/src/editor/components/TitleEditor.tsx
  - services/remotion-renderer/src/pipeline-config.ts
  - services/remotion-renderer/src/fonts.ts
  - services/remotion-renderer/src/compositions/shared-styles.ts
  - services/remotion-renderer/src/compositions/TikTokLayout.tsx
  - services/remotion-renderer/src/compositions/BarLayout.tsx
  - services/remotion-renderer/src/compositions/KaraokeLayout.tsx
  - services/remotion-renderer/src/compositions/SentenceLayout.tsx
  - services/remotion-renderer/src/compositions/TitleOverlay.tsx
  - services/remotion-renderer/src/compositions/typography.test.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: fixed
fixed: 2026-05-29T02:30:00Z
---

# Phase 19: Code Review Report

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 19 adds Plus Jakarta Sans as the new default font, introduces `OuterGlow` / `fontWeight` / `fontStyle` fields across the schema, adds `getOuterGlowStyle()` in shared-styles, and extends UI controls in `StyleControls.tsx` and `TitleEditor.tsx`. Renderer files are byte-for-byte identical to studio files (confirmed by diff). The core schema, glow CSS helper, and font loading logic are solid. Two behavioral bugs exist: KaraokeLayout loses all past-word state during inter-token silence gaps (producing a visual glitch), and TitleOverlay initializes `fontLoaded` state but never gates rendering on it (defeating the `delayRender` / `continueRender` font-wait contract for its own component tree). Several warnings cover a hardcoded fps assumption, a default font mismatch between editor and renderer, an unvalidated title `outerGlow`, and a `fontWeight` inconsistency on the TitleOverlay subtitle span.

---

## Critical Issues

### CR-01: KaraokeLayout — `wasActive` always false during inter-token silence gaps

**File:** `services/remotion-studio/src/compositions/KaraokeLayout.tsx:231` (identical in renderer)
**Issue:** When `currentTokenIdx === -1` (the frame falls between two tokens), the expression `i < currentTokenIdx` evaluates to `i < -1`, which is `false` for every non-negative index. Every already-spoken word therefore reports `wasActive = false`, which causes:
1. The karaoke fill layer (`clipPercent`) to snap from 100% back to 0% for all past words.
2. The past-word opacity fade to reset to full opacity instead of the configured dimmed value.
The net effect is a visible flash/reset of the entire caption during normal inter-word pauses — a broken karaoke animation every time Whisper timestamps leave a gap between words.

This is in contrast to TikTokLayout and BarLayout, which both carry a `wasActiveThreshold` variable that accumulates past tokens even when `currentTokenIdx === -1`.

**Fix:**
```typescript
// KaraokePage — mirror the wasActiveThreshold pattern from TikTokLayout

let currentTokenIdx = -1;
for (let i = 0; i < tokens.length; i++) {
  const t = tokens[i];
  const fromFrame = Math.round(t.fromMs * (fps / 1000)) - pageFromFrame;
  const toFrame = Math.round(t.toMs * (fps / 1000)) - pageFromFrame;
  if (frame >= fromFrame && frame < toFrame) {
    currentTokenIdx = i;
    break;
  }
}

// Accumulate past-word threshold when between tokens (currentTokenIdx === -1)
let wasActiveThreshold = currentTokenIdx;
if (currentTokenIdx === -1) {
  for (let i = 0; i < tokens.length; i++) {
    const toFrame = Math.round(tokens[i].toMs * (fps / 1000)) - pageFromFrame;
    if (frame >= toFrame) wasActiveThreshold = i + 1;
  }
}

// Then in the token map:
const wasActive = i < (currentTokenIdx !== -1 ? currentTokenIdx : wasActiveThreshold);
```

Apply the same fix to the renderer copy at `services/remotion-renderer/src/compositions/KaraokeLayout.tsx:231`.

---

### CR-02: TitleOverlay — `fontLoaded` state is set but never read; `delayRender` handle is leaked when the effect re-runs

**File:** `services/remotion-studio/src/compositions/TitleOverlay.tsx:81-110` (identical in renderer)
**Issue:** Two sub-problems that compound each other:

1. `fontLoaded` is set to `true` inside the effect and inside `.then()`/`.catch()` callbacks, but the component never consults it anywhere in the render output. No conditional rendering, no early return. The Remotion `delayRender` / `continueRender` contract is met for the font-loading callback, but the component itself renders immediately at frame 0 using whatever CSS `fontFamily` string is available — the fonts may not be loaded yet in the browser when those first frames are captured.

2. If `titleFontFamily` or `subtitleFontFamily` change (effect dependency array changes), a **new** `delayRender` handle is allocated before the previous effect has necessarily completed. The previous `pending` counter and `handle` are closed over in the old closure and will still call `continueRender(handle)` on the old handle. The new `handle` is never released if the old loading resolves the old handle while the new loading is still in flight. This is a classic stale-closure / leaked `delayRender` handle pattern.

**Fix (minimal — address the render-before-load problem):**
```tsx
// Add a render guard so frames are not captured before fonts resolve
if (!fontLoaded) return null; // Remotion will not capture null frames while delayRender is active
```
For the leaked-handle problem, use a cleanup function in the effect:
```tsx
React.useEffect(() => {
  let cancelled = false;
  // ... existing font-loading logic, but check `cancelled` before calling continueRender
  const handle = delayRender(`Loading title fonts: ...`);
  // inside .then() / .catch():
  if (!cancelled && pending === 0) {
    setFontLoaded(true);
    continueRender(handle);
  }
  return () => { cancelled = true; };
}, [titleFontFamily, subtitleFontFamily]);
```

Apply to both studio and renderer copies.

---

## Warnings

### WR-01: `getOuterGlowStyle` produces `NaN` channel values with 3-character hex colors

**File:** `services/remotion-studio/src/compositions/shared-styles.ts:87-94` (identical in renderer)
**Issue:** The hex parser strips `#` then slices positions 0-2, 2-4, 4-6. A 3-character color string (e.g., `"#fff"`) after stripping yields `"fff"`, and `parseInt("ff", 16) = 255`, `parseInt("f", 16) = 15`, `parseInt("", 16) = NaN`. The CSS output becomes `rgba(255, 15, NaN, ...)` which browsers silently drop, making the glow invisible with no error thrown.

The pipeline-config validator does enforce 6-digit hex (line 316), but `getOuterGlowStyle` can be called directly in tests or future code paths without going through validation. The `lerpColor` function in layout files handles 3-char hex correctly (it normalises them); `getOuterGlowStyle` does not.

**Fix:**
```typescript
export function getOuterGlowStyle(
  outerGlow: OuterGlow | undefined,
  existingTextShadow?: string
): React.CSSProperties {
  if (!outerGlow || !outerGlow.enabled) {
    return existingTextShadow ? { textShadow: existingTextShadow } : {};
  }
  let hex = outerGlow.color.replace("#", "");
  // Expand 3-char shorthand to 6-char
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // ...
```

---

### WR-02: `TitleOverlay` subtitle span ignores the `fontWeight` config — hardcoded to 500

**File:** `services/remotion-studio/src/compositions/TitleOverlay.tsx:234` (identical in renderer)
**Issue:** The main title span correctly reads `style?.fontWeight !== false ? 700 : 400` (line 215). The subtitle span unconditionally applies `fontWeight: 500`, completely ignoring the `style.fontWeight` config field. A user who enables Regular weight (fontWeight: false) will see a regular-weight title but a medium-weight subtitle, creating visual inconsistency.

**Fix:**
```tsx
{subtitle && (
  <span
    style={{
      ...
      fontWeight: style?.fontWeight !== false ? 700 : 400, // was: 500
      ...
    }}
  >
```

---

### WR-03: `TitleEditor` `DEFAULT_TITLE_STYLE` uses `PlusJakartaSans` but `TitleOverlay` `DEFAULT_TITLE_STYLE` uses `"Inter"`

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:38-39` vs `services/remotion-studio/src/compositions/TitleOverlay.tsx:42-43`
**Issue:** When a new title is created in the editor, the form initialises with `titleFontFamily: "PlusJakartaSans"`. The saved config therefore stores `titleFontFamily: "PlusJakartaSans"` (from TitleEditor's DEFAULT). However, when the title is rendered by `TitleOverlay` without a style override (e.g., a config created before Phase 19, or any path that omits `style`), `TitleOverlay` falls back to its internal default `"Inter"`. These two defaults are inconsistent. Users editing a title in the studio will see PlusJakartaSans in the preview (the saved value), but any rendering path that constructs a `TitleConfig` programmatically without a `style` field will silently use Inter.

**Fix:** Align the two defaults:
```typescript
// TitleOverlay.tsx
const DEFAULT_TITLE_STYLE: Required<TitleStyleProps> = {
  titleFontFamily: "PlusJakartaSans",  // was: "Inter"
  subtitleFontFamily: "PlusJakartaSans", // was: "Inter"
  // ...
};
// Also update fontFamily prop default:
export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  fontFamily = "PlusJakartaSans",  // was: "Inter"
  ...
```

---

### WR-04: Title style `outerGlow` is never validated in `validatePipelineConfig`

**File:** `services/remotion-studio/src/pipeline-config.ts:390-428`
**Issue:** The `titles[].style` validation block validates `entranceAnimation`, `titleFontSize`, `subtitleFontSize`, `topOffset`, `lineHeight`, `padding`, `fontWeight`, and `fontStyle` — but not `outerGlow`. A pipeline config with an invalid `titles[0].style.outerGlow` (wrong color format, out-of-range intensity, etc.) will pass `validatePipelineConfig` and only fail silently at render time when `getOuterGlowStyle` receives bad data.

**Fix:** Add validation inside the `if (t.style !== undefined)` block:
```typescript
// Validate title style outerGlow (optional — T-19-04 parity with subtitle.outerGlow)
if (s.outerGlow !== undefined) {
  const og = s.outerGlow as Record<string, unknown>;
  if (typeof og !== "object" || og === null || Array.isArray(og)) {
    errors.push(`titles[${index}].style.outerGlow must be an object`);
  } else {
    if (typeof og.enabled !== "boolean")
      errors.push(`titles[${index}].style.outerGlow.enabled must be a boolean`);
    if (typeof og.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(og.color as string))
      errors.push(`titles[${index}].style.outerGlow.color must be a 6-digit hex color`);
    if (typeof og.intensity !== "number" || og.intensity < 0 || og.intensity > 1)
      errors.push(`titles[${index}].style.outerGlow.intensity must be between 0 and 1`);
    if (typeof og.softness !== "number" || og.softness < 0)
      errors.push(`titles[${index}].style.outerGlow.softness must be >= 0`);
  }
}
```
Apply identical change to the renderer copy.

---

### WR-05: `HIGHLIGHT_FADE_MS / 33` is a hardcoded 30fps assumption in four layout components

**File:** `services/remotion-studio/src/compositions/TikTokLayout.tsx:84`, `BarLayout.tsx:86`, `KaraokeLayout.tsx:90`, `SentenceLayout.tsx:166` (identical in renderer)
**Issue:** `fadeFrames` is computed as `Math.round(HIGHLIGHT_FADE_MS / 33)` — 33ms assumes 30fps. At 24fps a frame is ~41ms; at 60fps it is ~16ms. Rendering at 60fps (a common choice for smooth captions) means `80/33 ≈ 2` frames, whereas the correct value at 60fps is `80/(1000/60) ≈ 5` frames — a 60% underestimate that makes the past-word opacity transition faster than intended. The `fps` value is already available in every call site as either a prop (`CaptionWord`, `BarWord`, `KaraokeWord`) or from `useVideoConfig()`.

**Fix (all four components):**
```typescript
// Replace:
const fadeFrames = Math.max(1, Math.round(HIGHLIGHT_FADE_MS / 33));
// With (fps is a prop or available via useVideoConfig):
const fadeFrames = Math.max(1, Math.round(HIGHLIGHT_FADE_MS * (fps / 1000)));
```

---

### WR-06: `FONT_OPTIONS` in `TitleEditor` is a manual duplicate of `AVAILABLE_FONTS` and excludes `"monospace"`

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:21-28`
**Issue:** `FONT_OPTIONS` is a hardcoded string array that duplicates the `AVAILABLE_FONTS` constant from `fonts.ts`. The two are already diverged: `AVAILABLE_FONTS` includes `"monospace"` as the last entry; `FONT_OPTIONS` omits it. Any future font additions to `fonts.ts` must be manually mirrored here. This is a maintenance hazard.

**Fix:**
```typescript
import { AVAILABLE_FONTS } from "../../fonts.js";
// Remove FONT_OPTIONS and use AVAILABLE_FONTS.filter(f => f !== "monospace") 
// if monospace is intentionally excluded from title fonts, or use AVAILABLE_FONTS directly.
```

---

## Info

### IN-01: `AbsoluteFill` imported but unused in TikTokLayout, BarLayout, SentenceLayout

**File:** `services/remotion-studio/src/compositions/TikTokLayout.tsx:3`, `BarLayout.tsx:3`, `SentenceLayout.tsx:3` (identical in renderer)
**Issue:** `AbsoluteFill` is imported from `remotion` in all three files but never used in the JSX output. The TSX renders `<>...</>` fragments, not `<AbsoluteFill>`. This is a dead import that may trigger linter warnings and adds noise.
**Fix:** Remove `AbsoluteFill` from the import statements in all three files.

---

### IN-02: `getHighlightWordColor` and `getHighlightOpacity` are exported from `shared-styles` but never imported anywhere

**File:** `services/remotion-studio/src/compositions/shared-styles.ts:117-197` (identical in renderer)
**Issue:** Both functions are exported public API but no file in either service imports or uses them. The actual highlight logic is implemented inline inside each layout component using `lerpColor`. These exports are dead code.
**Fix:** Either remove them or convert to `// @internal` private functions if they are retained for documentation value.

---

### IN-03: `fontLoaded` state variable name has a typo in `getFontFamilyCSS` parameter

**File:** `services/remotion-studio/src/fonts.ts:102`
**Issue:** The parameter is named `modulName` (missing the 'e'). The typo is in both studio and renderer. It is a harmless spelling error but inconsistent with standard naming.
**Fix:** Rename to `moduleName` or `fontModuleName`.

---

### IN-04: `SentenceLayout` — unused variable `pastWordOpacityVal` is an alias for `pastWordOpacity`

**File:** `services/remotion-studio/src/compositions/SentenceLayout.tsx:141`
**Issue:** Line 141 assigns `const pastWordOpacityVal = pastWordOpacity;` and then uses `pastWordOpacityVal` in the interpolate call. This is a redundant alias with no functional purpose — `pastWordOpacity` could be used directly.
**Fix:** Remove the alias and use `pastWordOpacity` directly in the interpolate call at line 171.

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
