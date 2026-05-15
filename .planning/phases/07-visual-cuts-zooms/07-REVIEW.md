---
phase: 07-visual-cuts-zooms
reviewed: 2026-05-12T12:00:00Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - services/remotion-renderer/src/Root.tsx
  - services/remotion-renderer/src/compositions/JumpCutTransition.tsx
  - services/remotion-renderer/src/compositions/ZoomContainer.tsx
  - services/remotion-renderer/src/compositions/shared-styles.ts
  - services/remotion-renderer/src/compositions/transition-effect.test.ts
  - services/remotion-renderer/src/compositions/zoom-scale.test.ts
  - services/remotion-renderer/src/pipeline-config.test.ts
  - services/remotion-renderer/src/pipeline-config.ts
  - services/remotion-renderer/src/render.ts
  - services/remotion-renderer/src/validate.test.ts
  - services/remotion-renderer/src/validate.ts
  - services/remotion-renderer/src/zoom-detection.test.ts
  - services/remotion-renderer/src/zoom-detection.ts
findings:
  critical: 0
  warning: 7
  info: 5
  total: 12
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-12T12:00:00Z
**Depth:** deep
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed all 13 source files changed in Phase 07 (Visual Cuts & Zooms). The implementation is generally well-structured with good test coverage, clean separation of concerns (pure compute functions exported for testing alongside React components), and proper config-driven defaults. However, I found several bugs and quality issues:

- **zoom-detection.ts Signal 2** has a subtle optimization bug where `break` on sorting assumption fails when timestamps are on the original timeline
- **JumpCutTransition component** applies its transform to a transparent overlay (`AbsoluteFill`), which means the visual zoom/shift effect won't actually transform the video layer — it appears the transform needs to be applied to the ZoomContainer wrapping the video, or the `JumpCutTransition` needs to coordinate with `ZoomContainer`
- **render.ts** has command injection risk via `ffprobe` and a hardcoded `fps = 30` that can desync from the Remotion composition
- Several quality issues in validation logic, test cleanup, and config merging

## Warnings

### WR-01: JumpCutTransition Transform Applied to Empty Overlay — No Visual Effect on Video

**File:** `services/remotion-renderer/src/compositions/JumpCutTransition.tsx:183-191`
**Also:** `services/remotion-renderer/src/Root.tsx:88-93`

**Issue:** The `JumpCutTransition` renders an `AbsoluteFill` with CSS `transform` (scale and translateX), but this is rendered as a **separate top-level layer** after subtitles and titles in `Root.tsx`. CSS `transform` on an `AbsoluteFill` (which is essentially a `<div>` covering the viewport) only transforms that div and its children. Since `JumpCutTransition` has no children (just `pointerEvents: "none"`), the transform does nothing visible — scaling a transparent overlay div produces no visual change on the video beneath it.

For transitions to affect the video, the transform would need to be applied to the same element wrapping the video (i.e., combined with or communicated to `ZoomContainer`). Currently, zoom effects correctly affect the video because `ZoomContainer wraps` `OffthreadVideo`, but transitions are rendered as a sibling overlay with no connection to the video layer.

**Fix:** Either:
1. Have `JumpCutTransition` communicate its active scale/translate to `ZoomContainer` so the video transform incorporates both, or
2. Restructure so `JumpCutTransition` also wraps the video content (applying its transform to the video layer directly), or
3. Make `JumpCutTransition` render the video content itself inside the transformed `AbsoluteFill`.

```tsx
// Option 1: Combine transitions with ZoomContainer
// In Root.tsx, pass transitionEvents to ZoomContainer:
<ZoomContainer zoomEvents={zoomEvents} transitionEvents={transitionEvents} totalDurationMs={...}>
  {videoSrc && <OffthreadVideo src={staticFile(videoSrc)} />}
</ZoomContainer>
// Remove the separate JumpCutTransition overlay
```

### WR-02: Signal 2 Optimization Breaks When Words Are Not Sorted by Remapped Time

**File:** `services/remotion-renderer/src/zoom-detection.ts:127-143`

**Issue:** The `break` optimization on line 141 (`if (wordStartMs > windowEndMs) break;`) assumes words are sorted by their **remapped** start time. However, `words` from the Whisper transcript are sorted by their **original** start time. When timestamps are remapped (especially with cumulative shifts), the original order may not match the remapped order. If a later word on the original timeline remaps to an earlier time on the cut timeline (which can happen with certain silence cut patterns), the `break` would skip valid matches prematurely.

Additionally, `remapMs()` is called inside the inner loop for each word for each cut — this is an O(words × cuts) computation with the `break` optimization intended to reduce it. Without the `break`, the code is still correct but slower. With the `break`, correctness depends on a sort guarantee that doesn't always hold.

**Fix:** Either remove the `break` optimization (acceptable since cuts are typically few), or pre-compute remapped times and sort them before the loop:

```ts
// Option: Pre-compute and sort remapped word start times
const remappedWords = words
  .map(w => ({ startMs: remapMs(Math.round(w.start * 1000)), word: w }))
  .sort((a, b) => a.startMs - b.startMs);

for (const cut of silenceCuts.cuts) {
  const cutEndTimeMs = Math.round(cut.new_end * 1000);
  const windowEndMs = cutEndTimeMs + thresholdAfterSilenceMs;
  for (const { startMs, word } of remappedWords) {
    if (startMs >= cutEndTimeMs && startMs <= windowEndMs) {
      rawEvents.push({ startTimeMs: startMs, durationMs: 300, scale: cfg.maxScale * 0.87 });
      break; // Now safe to break since remappedWords is sorted
    }
    if (startMs > windowEndMs) break;
  }
}
```

### WR-03: Command Injection Risk via ffprobe in render.ts

**File:** `services/remotion-renderer/src/render.ts:17-24`

**Issue:** The `getVideoDimensions` function uses `execFileSync("ffprobe", [videoPath])` where `videoPath` comes from the `INPUT_PATH` environment variable. While `execFileSync` is safer than `execSync` (it doesn't use shell expansion), the `INPUT_PATH` is an environment variable read without validation. If this service is ever containerized where env vars could be influenced by external input, this could be a vector. More immediately, there's no validation that the path is a legitimate file path (no check for path traversal patterns like `..`).

However, within the current Docker pipeline context, `INPUT_PATH` is set by the pipeline orchestrator, so the risk is low. The `fs.existsSync(inputPath)` check on line 98 does at least verify the file exists before rendering, but the ffprobe call happens before that check.

**Fix:** Add path validation before the ffprobe call, and reorder checks so file existence is verified first:

```ts
function getVideoDimensions(videoPath: string): { width: number; height: number; durationSec: number } {
  // Validate path doesn't contain traversal
  const resolvedPath = path.resolve(videoPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Video file not found: ${resolvedPath}`);
  }
  const probeOut = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=width,height",
    "-show_entries", "format=duration",
    "-of", "json",
    resolvedPath,
  ], { encoding: "utf-8" });
  // ... rest unchanged
}
```

### WR-04: Hardcoded `fps = 30` Desyncs from Remotion Composition fps

**File:** `services/remotion-renderer/src/Root.tsx:72-73`

**Issue:** Title overlay timing uses a hardcoded `const fps = 30` inside the render loop, while the Remotion composition's fps is defined separately as `fps: 30` in the `Composition` defaults and `calculateMetadata`. If the composition fps is ever changed (via config or Remotion update), the title timing will be wrong — titles would appear at the wrong frames. The correct approach is to use `useVideoConfig().fps` which is already available in the component scope (via `useCurrentFrame`).

**Fix:**

```tsx
const SubtitledVideo: React.FC<RemotionProps> = ({...}) => {
  const { fps } = useVideoConfig(); // Already available, add this
  // ...
  {(titles ?? []).map((title, i) => {
    const fromFrame = Math.round(title.startTimeMs * (fps / 1000));
    const durationInFrames = Math.max(1, Math.round(title.durationMs * (fps / 1000)));
    // ...
  })};
```

### WR-05: ZoomContainer Renders Scale=1.0 Transform Even When No Active Zoom — Wasted DOM Updates

**File:** `services/remotion-renderer/src/compositions/ZoomContainer.tsx:149-159`

**Issue:** Unlike `JumpCutTransition` which conditionally returns a plain `AbsoluteFill` when no transition is active (line 179-181), `ZoomContainer` always applies `transform: scale(${scale})` even when `scale` resolves to `1.0` (no zoom events). While functionally correct, Remotion will still compute and potentially re-render the transform style on every frame, even when it's a no-op. This is a minor rendering performance concern, not a correctness bug.

**Fix:** Add a condition similar to `JumpCutTransition`:

```tsx
if (zoomEvents.length === 0) {
  return <AbsoluteFill style={{ overflow: "hidden" }}>{children}</AbsoluteFill>;
}
```

Or check `scale === 1.0` and skip the transform string.

### WR-06: validateVisualEffectsConfig Duplicates validatePipelineConfig Logic

**File:** `services/remotion-renderer/src/validate.ts:240-321`

**Issue:** `validateVisualEffectsConfig()` re-implements much of the validation already present in `validatePipelineConfig()` (from `pipeline-config.ts`). Both validate `confidenceThreshold`, `maxScale`, `rampMs`, `mergeGapMs`, `durationMs`, `shiftPx`, `type`, and `enabled` for visual effects config. This duplication means bugs in validation logic can be fixed in one place but missed in the other, and the error messages differ between the two (pipeline-config uses field paths like `visualEffects.zooms.maxScale` while validate.ts uses `VISU-03`/`VISU-04` tags).

**Fix:** Consider having `validateVisualEffectsConfig` call `validatePipelineConfig` with a synthetic config wrapper and extract the visualEffects-specific errors, or extract the shared validation logic into a common function used by both.

### WR-07: zoom-detection Merge Modifies Array in Place During Iteration

**File:** `services/remotion-renderer/src/zoom-detection.ts:156-173`

**Issue:** The merge loop pushes `rawEvents[i]` references into `merged`, then mutates `prev.durationMs` and `prev.scale` on the last `merged` element when merging. Since `prev` is a reference to the `RawZoomEvent` object from `rawEvents`, this mutates the original `rawEvents` array elements. This is not currently a bug because `rawEvents` is not used after the merge, but it violates the principle of immutability and could become a bug if the code is refactored to reuse `rawEvents` (e.g., for debugging or logging).

**Fix:** Clone objects when pushing to `merged`:

```ts
const merged: ZoomEvent[] = [{ ...rawEvents[0] }];
for (let i = 1; i < rawEvents.length; i++) {
  const prev = merged[merged.length - 1];
  const curr = rawEvents[i];
  // ... same logic but with safe mutation since prev is a clone
```

## Info

### IN-01: TransitionEffect Peak Calculation Uses Hardcoded `TRANSITION_PRE_CUT_MS` Instead of Computing from Duration

**File:** `services/remotion-renderer/src/compositions/JumpCutTransition.tsx:82-83`

**Issue:** `computeTransitionEffect` uses `TRANSITION_PRE_CUT_MS` (150ms) as the `peakTimeMs` offset regardless of the event's `durationMs`. The peak is always at `startTimeMs + 150ms`, even though the post-cut ramp-down duration (`durationMs - 150ms`) may differ. For the default 250ms duration (150+100), this is correct, but for custom durations, the peak is always at 150ms from start, which means the pre-cut portion of the transition is always 150ms. This is likely intentional per the design spec (D-05), but the asymmetry is worth documenting clearly in case custom durations are expected.

**Fix:** Consider adding a clarifying comment: "Peak is always at TRANSITION_PRE_CUT_MS (150ms) from startTimeMs per D-05, regardless of total durationMs."

### IN-02: Test Files Create Temp Directories Without Cleanup Guarantees

**File:** `services/remotion-renderer/src/validate.test.ts:566-577`

**Issue:** Several test cases create temp directories under `/tmp/validate-test-*/` and use `fs.rmSync()` for cleanup. If a test fails before the cleanup line runs, the temp directory will leak. This is a minor issue since it's only in test code, but using `finally` blocks or a temp directory helper would be more robust.

### IN-03: render.ts Reads Unvalidated JSON from Transcript Without Schema Check

**File:** `services/remotion-renderer/src/render.ts:205`

**Issue:** Line 205 reads and parses `transcriptPath` with `JSON.parse(fs.readFileSync(...))` and immediately passes it to `transcriptToCaptionPages` without validating its structure. While `transcriptToCaptionPages` likely handles missing fields defensively, there's no explicit schema validation of the transcript data. This is consistent with the existing codebase pattern (other file reads also lack schema validation), so it's informational.

### IN-04: `JumpCutTransition` Component Renders Even When `transitionEvents` Is Empty (Fallback in Root.tsx)

**File:** `services/remotion-renderer/src/Root.tsx:88-93`

**Issue:** Root.tsx has `{transitionEvents.length > 0 && <JumpCutTransition .../>}` which correctly prevents rendering when empty, but the `JumpCutTransition` component itself doesn't short-circuit on empty events — it just returns the `AbsoluteFill` from the no-active-transition path. This is fine because Root.tsx already guards it, but the component could add a defensive early return for empty events.

### IN-05: `computeZoomScale` Default Parameter Doesn't Match All Callers

**File:** `services/remotion-renderer/src/compositions/ZoomContainer.tsx:64`

**Issue:** `computeZoomScale` has `rampMs: number = ZOOM_RAMP_MS` as a default parameter, but the `ZoomContainer` component always explicitly passes `ZOOM_RAMP_MS` on line 147. The parameter default is only used in unit tests (via direct calls without the argument). This is fine but worth noting the dual default definition.

---

_Reviewed: 2026-05-12T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_