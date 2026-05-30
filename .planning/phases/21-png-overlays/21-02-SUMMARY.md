---
phase: 21-png-overlays
plan: "02"
subsystem: remotion-compositions
tags: [remotion, png-overlay, render-pipeline, tdd, renderer-sync]
dependency_graph:
  requires:
    - PngOverlayConfig interface in pipeline-config.ts (21-01)
  provides:
    - PngOverlay React component (studio + renderer)
    - overlays prop in SubtitledVideo (studio) and Root.tsx (renderer)
    - render.ts base64 decode + upscale warning before bundle()
    - overlay.test.ts with 8 pure-logic tests
  affects:
    - services/remotion-studio/src/compositions/PngOverlay.tsx
    - services/remotion-studio/src/compositions/overlay.test.ts
    - services/remotion-studio/src/SubtitledVideo.tsx
    - services/remotion-renderer/src/compositions/PngOverlay.tsx
    - services/remotion-renderer/src/compositions/overlay.test.ts
    - services/remotion-renderer/src/Root.tsx
    - services/remotion-renderer/src/render.ts
tech_stack:
  added: []
  patterns:
    - Dual src path (rawImageSrc for Player/browser, staticFile for render context)
    - Base64 decode to public/ before bundle() — same pattern as video copy
    - Pure helper functions exported for testability without JSX renderer
    - Renderer sync: cp studio/compositions/* renderer/compositions/
key_files:
  created:
    - services/remotion-studio/src/compositions/PngOverlay.tsx
    - services/remotion-studio/src/compositions/overlay.test.ts
    - services/remotion-renderer/src/compositions/PngOverlay.tsx (synced)
    - services/remotion-renderer/src/compositions/overlay.test.ts (synced)
  modified:
    - services/remotion-studio/src/SubtitledVideo.tsx
    - services/remotion-renderer/src/Root.tsx
    - services/remotion-renderer/src/render.ts
decisions:
  - "computeOverlaySrc and computeOverlayOpacity exported as pure helpers so overlay.test.ts can run without a React renderer (no JSX in vitest)"
  - "T-21-04 validation checks startsWith('data:image/png;base64,') — rejects non-PNG binary data before writeFileSync"
  - "D-05 upscale heuristic: warn when pngBuffer.byteLength < displayWidth * displayWidth * 0.5 (buffer size estimate)"
  - "typography.test.ts sync: studio version had a test description fix (titleFontSize→subtitleFontSize name) carried through the compositions cp"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-30"
  tasks_completed: 3
  files_modified: 7
---

# Phase 21 Plan 02: PNG Overlay Render Path Summary

**One-liner:** Built PngOverlay Remotion composition with dual src path (data URL for Player, staticFile for render), integrated overlays into SubtitledVideo + Root.tsx, and added base64 decode + upscale warning in render.ts before bundle().

## What Was Built

### Task 1: PngOverlay.tsx + overlay.test.ts

Created `services/remotion-studio/src/compositions/PngOverlay.tsx`:

- **Component:** `PngOverlay: React.FC<PngOverlayProps>` — AbsoluteFill wrapper (no backgroundColor, T-21-06) + single `<Img>` element from remotion (not native `<img>`)
- **Props:** `overlay: PngOverlayConfig`, `rawImageSrc?: string`
- **Src selection (D-11):** `rawImageSrc` wins if truthy (Player/browser context); falls back to `staticFile(overlay._resolvedFile ?? "overlay-0.png")` for render context
- **Style:** pixel-to-percentage coordinates (`left: (x/1080)*100%`, `top: (y/1920)*100%`); `width: displayWidth`, `height: "auto"`; `imageRendering: "auto"` (Chromium bilinear, D-04); `opacity: overlay.opacity ?? 1` (D-06)
- **Helpers exported:** `computeOverlaySrc()` and `computeOverlayOpacity()` — pure functions enabling tests without a React renderer

Created `services/remotion-studio/src/compositions/overlay.test.ts` with 8 tests:
- Export existence for both helper functions
- src selection: staticFile when rawImageSrc=undefined, rawImageSrc wins when provided, fallback to overlay-0.png when both undefined
- Opacity: defaults to 1 when undefined, returns configured value, returns 0 when 0

### Task 2: Wire overlays into SubtitledVideo, Root.tsx, render.ts

**studio `SubtitledVideo.tsx`:**
- Added `import { PngOverlay }` from `./compositions/PngOverlay`
- Added `overlays?: PngOverlayConfig[]` to `RemotionProps` interface
- Added `overlays = []` to component destructure
- Renders `{overlays.map((ov, i) => <PngOverlay key={`overlay-${i}`} overlay={ov} rawImageSrc={ov.imageData} />)}` after titles (higher z-order, D-11)

**renderer `Root.tsx`:**
- Added `import { PngOverlay }` from `./compositions/PngOverlay`
- Added `overlays?: PngOverlayConfig[]` to `RemotionProps` interface
- Added `overlays = []` to destructure
- Renders `{overlays.map((ov, i) => <PngOverlay key={`overlay-${i}`} overlay={ov} />)}` — NO rawImageSrc in render context (staticFile path used)
- Added `overlays: [] as PngOverlayConfig[]` to `defaultProps`

**renderer `render.ts`:**
- Added `PngOverlayConfig` to imports from `./pipeline-config`
- Inserted PNG decode block after video copy, BEFORE `bundle()` (Pitfall 1 compliance):
  - Reads `pipelineConfig?.overlays ?? []`
  - T-21-04: validates `imageData.startsWith("data:image/png;base64,")` — warns and skips if not
  - Strips data URL prefix; decodes `Buffer.from(base64, "base64")`
  - D-05 upscale heuristic: `console.warn` when `pngBuffer.byteLength < displayWidth * displayWidth * 0.5`
  - T-21-05: filename = `overlay-${i}.png` (integer index only, no path traversal)
  - `fs.writeFileSync(path.join(publicDir, fileName), pngBuffer)` — writes to public/ before bundle
  - Returns `{ ...overlay, _resolvedFile: fileName }`
- Passes `overlays: resolvedOverlays` in `inputProps`

### Task 3: Renderer sync + test suite

- `cp services/remotion-studio/src/compositions/* services/remotion-renderer/src/compositions/`
- Synced: PngOverlay.tsx, overlay.test.ts (new), typography.test.ts (test description fix from studio)
- `diff studio/pipeline-config.ts renderer/pipeline-config.ts`: identical (no re-sync needed)
- Full renderer test suite: **285 tests pass (8 files)**
- PngOverlay.tsx diff studio vs renderer: exits 0 (identical)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 4f12e1b | test(21-02) | PngOverlay component with src/opacity pure helpers and overlay.test.ts |
| 5e821a8 | feat(21-02) | Wire PNG overlays into SubtitledVideo, Root.tsx, and render.ts |
| 1046f70 | chore(21-02) | Sync renderer compositions — add PngOverlay.tsx + overlay.test.ts |

## Verification Results

- Full renderer test suite: **285 tests pass (8 files)**
- `diff studio/PngOverlay.tsx renderer/PngOverlay.tsx`: **identical**
- `grep -n "writeFileSync.*overlay" render.ts`: line 281 (BEFORE bundle() at line 288)
- `grep "data:image/png;base64" render.ts`: 2 matches (check + warn message)
- `grep -c "PngOverlay" renderer/Root.tsx`: 6 (import + interface + JSX + defaultProps)
- TypeScript: pre-existing errors only (same as 21-01 baseline — subtitle prop + LooseComponentType issues in Root.tsx and render.ts)

## Deviations from Plan

### Auto-carried sync side effects

**typography.test.ts description fix:** The `cp` sync command (per AGENTS.md) copies ALL compositions files from studio, including typography.test.ts which had a test description fix (`titleFontSize` → `subtitleFontSize` in the test name — not a functional change). This was an intentional carry-through of studio state, not a deviation.

All other plan steps executed exactly as written.

## Known Stubs

None — all render paths are fully wired. PngOverlay renders from real data (data URL in Player, decoded PNG file in renderer). No placeholder values flow to UI rendering.

## Threat Flags

None — T-21-04 (imageData prefix validation), T-21-05 (sanitized integer filename), T-21-06 (no backgroundColor on AbsoluteFill) are all implemented as planned. No new trust surfaces introduced beyond the plan's threat model.

## Self-Check: PASSED

- `services/remotion-studio/src/compositions/PngOverlay.tsx` exists
- `services/remotion-studio/src/compositions/overlay.test.ts` exists
- `services/remotion-renderer/src/compositions/PngOverlay.tsx` exists (synced)
- `services/remotion-renderer/src/compositions/overlay.test.ts` exists (synced)
- `services/remotion-renderer/src/Root.tsx` contains `PngOverlay` (6 occurrences)
- `services/remotion-renderer/src/render.ts` contains `writeFileSync` at line 281 (before bundle() at 288)
- `services/remotion-renderer/src/render.ts` contains `data:image/png;base64` (T-21-04)
- Commits 4f12e1b, 5e821a8, 1046f70 exist in git log
