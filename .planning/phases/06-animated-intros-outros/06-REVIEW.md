---
phase: 06-animated-intros-outros
reviewed: 2026-05-10T12:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - services/remotion-renderer/src/pipeline-config.ts
  - services/remotion-renderer/src/pipeline-config.test.ts
  - services/remotion-renderer/src/Root.tsx
  - services/remotion-renderer/src/render.ts
  - services/remotion-renderer/src/validate.ts
  - services/remotion-renderer/src/validate.test.ts
  - services/remotion-renderer/src/fonts.ts
  - services/remotion-renderer/src/compositions/LayoutDispatcher.tsx
  - services/remotion-renderer/src/compositions/TitleOverlay.tsx
  - services/remotion-renderer/src/compositions/TikTokLayout.tsx
  - services/remotion-renderer/src/compositions/SentenceLayout.tsx
  - services/remotion-renderer/src/compositions/BarLayout.tsx
  - services/remotion-renderer/src/compositions/KaraokeLayout.tsx
  - services/remotion-renderer/src/compositions/Subtitles.tsx
  - services/remotion-studio/src/server.ts
  - services/remotion-studio/src/index.ts
  - services/remotion-studio/src/editor/App.tsx
  - services/remotion-studio/src/editor/index.tsx
  - services/remotion-studio/src/editor/index.html
  - services/remotion-studio/src/editor/components/LayoutSelector.tsx
  - services/remotion-studio/src/editor/components/StyleControls.tsx
  - services/remotion-studio/src/editor/components/TitleEditor.tsx
  - services/remotion-studio/src/editor/components/ConfigPreview.tsx
  - services/remotion-studio/Dockerfile
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed the Phase 6 (animated-intros-outros) implementation which adds: PipelineConfig TypeScript interfaces, config-driven composition rendering, four subtitle layout modes (TikTok/Sentence/Bar/Karaoke), TitleOverlay animations, Remotion Studio Express server with config API, and a config editor React SPA. The codebase is well-structured with good validation coverage, but has two security vulnerabilities (command injection in render.ts, XSS in TitleOverlay.tsx), several logic bugs in the editor/validation code, and some quality issues.

## Critical Issues

### CR-01: Command injection via unsanitized `videoPath` in `execSync`

**File:** `services/remotion-renderer/src/render.ts:14-16`
**Issue:** The `getVideoDimensions` function interpolates `videoPath` directly into a shell command passed to `execSync`:
```typescript
const probeOut = execSync(
  `ffprobe -v error -show_entries stream=width,height -show_entries format=duration -of json "${videoPath}"`,
  { encoding: "utf-8" }
);
```
Although the value is double-quoted, a path containing `"` or `$()` characters would break out of the quoting. The `videoPath` comes from the `INPUT_PATH` environment variable, which is set by the pipeline orchestrator — but env vars can be manipulated by anyone who can set environment variables in the container. A path like `/data/pipeline/$(malicious_cmd)/video.mp4` would execute arbitrary commands. This is the standard Node.js `execSync` command injection pattern.

**Fix:** Use `execFileSync` with an argument array instead of shell interpolation:
```typescript
import { execFileSync } from "child_process";

function getVideoDimensions(videoPath: string): { width: number; height: number; durationSec: number } {
  const probeOut = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=width,height",
    "-show_entries", "format=duration",
    "-of", "json",
    videoPath,
  ], { encoding: "utf-8" });
  // ... rest of parsing
}
```

### CR-02: XSS — TitleOverlay renders arbitrary user text as React text content, but sanitizeText in TitleEditor is insufficient and unused in render path

**File:** `services/remotion-renderer/src/compositions/TitleOverlay.tsx:154-167`
**Issue:** The `TitleOverlay` component renders `text` and `subtitle` props directly as React text content:
```tsx
<span style={{...}}>
  {text}
</span>
```
While React escapes text content by default (preventing `<script>` injection), the `sanitizeText` function in `TitleEditor.tsx` (lines 27-34) suggests the developers recognized XSS risk — yet this sanitization is applied only in the editor UI, not in the render path. More critically, if this title data were ever passed through a context where React's JSX escaping is bypassed (e.g., `dangerouslySetInnerHTML`, HTML attributes, or if someone refactors to use `innerHTML`), it would be vulnerable. Additionally, the `sanitizeText` function itself is only applied in the editor list view — it is not applied when saving to `pipeline-config.json` or during render.

The real risk vector: the PUT `/api/config` endpoint accepts arbitrary title text and writes it to a JSON file. A malicious config with a title like `<img src=x onerror=alert(1)>` would be stored verbatim. If any consumer renders this data outside React's JSX text context (e.g., an HTML email notification, a status page, or a future refactor), it becomes XSS.

**Fix:** Apply input sanitization at the server boundary (PUT `/api/config`) — strip or escape HTML in title text before persisting. Additionally, ensure the render path handles untrusted text safely:
```typescript
// In server.ts, after validation, sanitize title text before writing:
function sanitizeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Apply to each title.text and title.subtitle before write:
const sanitizedTitles = configToWrite.titles?.map(t => ({
  ...t,
  text: sanitizeHtml(t.text),
  subtitle: t.subtitle ? sanitizeHtml(t.subtitle) : undefined,
}));
```

## Warnings

### WR-01: `sanitizeText` in TitleEditor is decorative only — not used on save path

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:27-34,62-75`
**Issue:** The `sanitizeText` function (lines 27-34) is only called when rendering the title list in the editor (lines 140, 142). It is NOT called when creating/saving a title via `handleAdd` (line 65) or `handleSaveEdit` (line 103). The raw, unsanitized text from the input field is saved directly into the `PipelineConfig`. The sanitization is effectively bypassed — it only protects the editor's own display, not the stored data or any downstream consumer.

**Fix:** Either remove the `sanitizeText` function (since React JSX text rendering is inherently safe) or apply sanitization at the point of data persistence (in `handleAdd`/`handleSaveEdit` and in the server's PUT handler). The latter is the correct approach per CR-02.

### WR-02: `fontSize` from env var parsed without validation for non-numeric values

**File:** `services/remotion-renderer/src/render.ts:231`
**Issue:** The `FONT_SIZE` environment variable is parsed with `parseInt`:
```typescript
fontSize: pipelineConfig?.subtitle?.fontSize || parseInt(process.env.FONT_SIZE || "58", 10),
```
If `FONT_SIZE` is set to a non-numeric string like `"abc"`, `parseInt("abc", 10)` returns `NaN`. A `NaN` fontSize would cause all subtitle text to become invisible or unrenderable. There's no NaN check after parsing.

**Fix:** Add a NaN guard:
```typescript
const envFontSize = parseInt(process.env.FONT_SIZE || "58", 10);
fontSize: pipelineConfig?.subtitle?.fontSize || (Number.isNaN(envFontSize) ? 58 : envFontSize),
```

### WR-03: `fontWeight: isCurrentSentence ? fontSize : fontSize * 0.85` — wrong property assigned

**File:** `services/remotion-renderer/src/compositions/SentenceLayout.tsx:206`
**Issue:** In the `SentencePage` component, the `fontWeight` style property appears to be assigned `fontSize` values instead of actual font-weight values:
```tsx
fontWeight: isCurrentSentence ? (isTokenActive ? 800 : 700) : 400,
```
This line is correct, but line 206 has:
```tsx
fontSize: isCurrentSentence ? fontSize : fontSize * 0.85,
```
Wait — actually looking again, line 206 sets `fontSize` to a reduced value for non-current sentences. This is intentional styling (shrinking inactive sentences). Not a bug. However, there IS a real issue: `isCurrentSentence` is hardcoded to `0 === 0` on line 177:

```tsx
const isCurrentSentence = currentSentenceIndex === 0; // line 177
```

Wait, looking more carefully, `currentSentenceIndex` is passed as a prop and then on line 177 it's compared to `0`. This means `isCurrentSentence` is always the same as `currentSentenceIndex === 0`. Since `SentencePageForLayout` (line 296) always passes `currentSentenceIndex={0}`, this will always be `true`. But actually, looking at `SentencePageForLayout`, it passes `currentSentenceIndex={0}` — which means every sentence is treated as "current." This means the conditional fontSize reduction (`fontSize * 0.85`) for non-current sentences is dead code — it's never triggered because `isCurrentSentence` is always `true`.

This is an intentional design (within a Sequence, only one sentence is rendered at a time, so it's always "current" in its own Sequence context). But the variable name is misleading.

Actually, looking more carefully at the flow: `SentencePageForLayout` renders each sentence in its own Remotion `<Sequence>`, passing `currentSentenceIndex={0}`. This is correct because within the Sequence, the sentence IS the current sentence. The `isCurrentSentence` prop is effectively unused.

**WR-03 REVISED:** The `SentencePage` component accepts `currentSentenceIndex` but it's always called with `0`, making `isCurrentSentence` always `true`. The `fontSize: isCurrentSentence ? fontSize : fontSize * 0.85` branch for inactive sentences is dead code — the reduced font size is never applied. This suggests an incomplete implementation or a design that was simplified but not cleaned up.

**File:** `services/remotion-renderer/src/compositions/SentenceLayout.tsx:177,206`
**Fix:** Either remove the `isCurrentSentence` prop and the conditional branch (since it's always `true`), or implement sentence-level highlighting across sequences. At minimum, remove the dead code branch:
```tsx
// Remove isCurrentSentence prop, always use fontSize directly
fontSize: fontSize,
fontWeight: isTokenActive ? 800 : isTokenPast ? 700 : 600,
```

### WR-04: TitleOverlay exit animation skips when entrance animation is "none"

**File:** `services/remotion-renderer/src/compositions/TitleOverlay.tsx:120`
**Issue:** The exit fade animation has a condition:
```tsx
if (frame >= exitFadeStartFrame && entranceAnimation !== "none") {
```
When `entranceAnimation` is `"none"`, the title appears instantly at full opacity (correct) but also exits instantly with no fade-out. This means that for `"none"` animation, the title will abruptly disappear at the end — there's no exit transition at all. This is inconsistent UX — even static titles should fade out gracefully rather than abruptly vanishing.

**Fix:** Remove the `entranceAnimation !== "none"` condition, or apply a separate exit fade for `"none"` mode:
```tsx
// Option A: Always fade out (consistent UX)
if (frame >= exitFadeStartFrame) {
  const exitOpacity = interpolate(frame, [exitFadeStartFrame, exitFadeEndFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  opacity = Math.min(opacity, exitOpacity);
}

// Option B: Add explicit exit for "none" mode with a shorter fade
```

### WR-05: `validateLayoutModes` and `validateTitleOverlays` check source file paths that may not exist at validation time

**File:** `services/remotion-renderer/src/validate.ts:245-267,296-304`
**Issue:** Both `validateLayoutModes()` and `validateTitleOverlays()` check for the existence of `.tsx` source files at hardcoded paths like `${outputDir}/../remotion-renderer/src/compositions/TikTokLayout.tsx`. These paths are relative to the output directory and point to source code, which won't exist in a Docker container running the compiled/bundled code. The path `${outputDir}/../remotion-renderer/src/compositions` is a development-only path that breaks in production.

For the `validateFontInfrastructure` function (line 386-423), it checks for `fonts.ts` using string content matching (`content.includes("AVAILABLE_FONTS")`) which is fragile and won't work on minified/compiled code.

**Fix:** These validators should check output artifacts (e.g., rendered video properties, config files) rather than source file existence. If source file validation is needed, it should be a separate build-time check, not a runtime validation function:
```typescript
// Remove source-file-existence checks from validateLayoutModes/validateTitleOverlays
// Or gate them behind an environment variable for CI-only usage
// Validate only the pipeline-config.json content (which already exists in validatePipelineConfigFile)
```

### WR-06: Config API has no authentication or authorization

**File:** `services/remotion-studio/src/server.ts:84-129`
**Issue:** The PUT `/api/config` endpoint accepts config changes from any network client with no authentication. Combined with the Docker Compose port exposure (`${STUDIO_PORT:-3123}:3123`), anyone with network access can modify the pipeline configuration. This allows an attacker to, at minimum, change subtitle layout modes, inject arbitrary title text, or modify font/color settings. While the validation schema limits the shape of data, there's no rate limiting, auth, or audit logging.

**Fix:** For v1 (internal Docker network), consider:
1. Binding to `127.0.0.1` instead of `0.0.0.0` if only local access is needed
2. Adding API key validation middleware
3. Adding rate limiting on the PUT endpoint
4. Logging all config changes with source IP

At minimum, document that the studio is intended for use within a trusted network and add a comment about auth requirements before external deployment.

### WR-07: `letterSpacing` slider allows negative values that may produce unreadable text

**File:** `services/remotion-studio/src/editor/components/StyleControls.tsx:140-152`
**Issue:** The letter spacing slider allows values from -5 to 20 with no visual warning. A value of -5 creates severely overlapping characters that are unreadable. While not a security issue, this is a usability bug — negative letter spacing values below -0.1em generally produce unreadable text for most fonts.

**Fix:** Change the slider minimum from `-5` to `0` or `-1`, or add a warning label when values below `-0.5` are selected:
```tsx
<input
  type="range"
  min={-1}  // Changed from -5
  max={20}
  // ...
/>
```

## Info

### IN-01: Duplicate `getPositionStyles` function across 4 layout files

**File:** `services/remotion-renderer/src/compositions/TikTokLayout.tsx:22-52`, `SentenceLayout.tsx:22-52`, `BarLayout.tsx:22-52`, `KaraokeLayout.tsx:20-51`
**Issue:** The `getPositionStyles` helper function is copy-pasted identically in TikTokLayout, SentenceLayout, BarLayout, and KaraokeLayout. These 4 copies diverge at line 5-6 (`FADE_IN_MS` etc. are also duplicated). A shared utility file would prevent future drift.

**Fix:** Extract shared utilities (`getPositionStyles`, `getBackgroundHighlightStyle`, timing constants) into a shared module:
```typescript
// compositions/shared-styles.ts
export const FADE_IN_MS = 100;
export const FADE_OUT_MS = 300;
export const PAGE_OVERLAP_GUARD_MS = 100;
export function getPositionStyles(...) { ... }
export function getBackgroundHighlightStyle(...) { ... }
```

### IN-02: `Subtitles.tsx` is a dead/legacy component

**File:** `services/remotion-renderer/src/compositions/Subtitles.tsx`
**Issue:** The old `Subtitles.tsx` is still present but is no longer imported by `Root.tsx`. It has been replaced by the `LayoutDispatcher` which includes `TikTokLayout`. This file contains a standalone `SubtitledVideo` component that duplicates the video rendering and subtitle logic from the new config-driven flow.

**Fix:** Remove `Subtitles.tsx` or mark it as deprecated with a comment pointing to `LayoutDispatcher.tsx`.

### IN-03: Color input in StyleControls doesn't support rgba format for `backgroundColor`

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:280-286`
**Issue:** The `<input type="color">` HTML element only supports hex color values (`#RRGGBB`), but the default `backgroundColor` is `"rgba(0, 0, 0, 0.7)"`. When the user opens the title editor, the color picker can't display rgba values — it will either fail to render or show a black fallback. This means the semi-transparent background overlay is not editable through the color picker.

**Fix:** Either use a custom color picker that supports alpha, or separate the background color and opacity into two controls:
```tsx
<div>
  <input type="color" value={rgbaToHex(bgColor)} ... />
  <input type="range" min={0} max={100} value={alpha * 100} ... /> {/* opacity slider */}
</div>
```

### IN-04: `fonts.ts` fallback returns "sans-serif" for unknown fonts, not "monospace"

**File:** `services/remotion-renderer/src/fonts.ts:53-55`
**Issue:** When an unknown font family is encountered, `loadFont` falls back to `"sans-serif"` (line 55). But the `AVAILABLE_FONTS` array explicitly includes `"monospace"` as a valid option (line 14). The mismatch means if someone specifies an unknown font, they get sans-serif instead of the monospace listed in AVAILABLE_FONTS. The comment on line 4 also mentions "monospace fallback" but the actual fallback is sans-serif.

**Fix:** Either change the fallback to `"monospace"` to match the documented behavior, or update the AVAILABLE_FONTS list and documentation to reflect that sans-serif is the fallback:
```typescript
// Option A: Match the documented monospace fallback
if (!loader) {
  console.warn(`[fonts] Unknown font family "${fontFamily}", falling back to monospace`);
  return "monospace";
}

// Option B: Keep sans-serif but fix the comment
```

---

_Reviewed: 2026-05-10T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_