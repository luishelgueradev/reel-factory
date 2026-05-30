---
phase: 21-png-overlays
verified: 2026-05-30T16:00:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open studio at http://localhost:3123 and visually confirm the overlay renders in the Remotion Player with transparency (no white box), correct pixel position, and correct opacity. Confirm rendered video output (via render.ts path) shows the overlay at the right position."
    expected: "Overlay appears on video frame, PNG alpha channel preserved, position/size match OverlayEditor inputs, opacity slider changes render opacity."
    why_human: "Visual correctness and transparency rendering cannot be verified by grep — requires live browser inspection of the Remotion Player and optionally a render output. This is a quality bar check on top of the approved UAT checkpoint."
---

# Phase 21: PNG Overlays Verification Report

**Phase Goal:** Transparent PNG overlay with code-side supersampled downscale for crisp logos/watermarks, with positioning/sizing.
**Verified:** 2026-05-30T16:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A transparent PNG can be added as an overlay and appears in the rendered video | VERIFIED | `PngOverlay.tsx` uses Remotion `<Img>` with transparent `AbsoluteFill` wrapper (no `backgroundColor`). `SubtitledVideo.tsx` maps `overlays` array to `<PngOverlay>` with `rawImageSrc`. `Root.tsx` (renderer) maps to `<PngOverlay>` without `rawImageSrc` (staticFile path). `render.ts` decodes base64 to `public/overlay-N.png` before `bundle()` at line 281, passes `resolvedOverlays` in `inputProps`. Human UAT checkpoint (8/8 steps) approved. |
| 2 | A PNG larger than the frame is downscaled by code at render time and stays crisp | VERIFIED | D-04 decision: CSS `displayWidth` constraint on `<Img>` delegates downscale to Chromium bilinear. `PngOverlay.tsx` sets `width: overlay.displayWidth`, `height: "auto"`, `imageRendering: "auto"`. Upscale advisory `console.warn` in `render.ts` at line 274 (`pngBuffer.byteLength < displayWidth * displayWidth * 0.5`). Design decision confirmed pre-phase in `21-CONTEXT.md` D-04: this IS the "supersampling approach" for this project. |
| 3 | The overlay can be positioned and sized by the user | VERIFIED | `OverlayEditor.tsx` provides X (0-1080), Y (0-1920), Width (10-1080), Opacity (0-1) controls. Position wired to `PngOverlay` via `left: (x/1080)*100%`, `top: (y/1920)*100%`. `PreviewApp.tsx` passes `liveOverlays` to `PreviewPlayer`, which includes them in `inputProps.overlays`. Live preview updates on every draft change via `onPreviewChange`. |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/remotion-studio/src/pipeline-config.ts` | `PngOverlayConfig` interface + `overlays` field + validation | VERIFIED | `PngOverlayConfig` interface at line 98; `overlays?: PngOverlayConfig[]` on `PipelineConfig` at line 142; validation block at lines 462-498 covers all required fields |
| `services/remotion-renderer/src/pipeline-config.ts` | Exact copy of studio pipeline-config | VERIFIED | `diff` exits 0 — files identical |
| `services/remotion-studio/src/server.ts` | JSON body limit "10mb" | VERIFIED | Line 85: `app.use(express.json({ limit: "10mb" }))` with comment |
| `services/remotion-renderer/src/pipeline-config.test.ts` | OVERLAY-01/02/03 test cases | VERIFIED | `describe("PNG overlays (OVERLAY-01/02/03)")` at line 526; 8 test cases covering all required validations |
| `services/remotion-studio/src/compositions/PngOverlay.tsx` | `PngOverlay` Remotion component with dual src path | VERIFIED | Imports `Img` from `remotion` (not native `img`); `computeOverlaySrc`/`computeOverlayOpacity` pure helpers exported; `rawImageSrc` prop for Player, `staticFile(_resolvedFile)` fallback for render context |
| `services/remotion-studio/src/compositions/overlay.test.ts` | Component behavior tests | VERIFIED | 8 tests covering export existence, src selection, opacity defaults |
| `services/remotion-renderer/src/compositions/PngOverlay.tsx` | Synced copy of studio PngOverlay | VERIFIED | `diff` exits 0 — files identical |
| `services/remotion-renderer/src/compositions/overlay.test.ts` | Synced test file | VERIFIED | File exists; picked up by renderer vitest |
| `services/remotion-renderer/src/render.ts` | Base64 decode + upscale warning before `bundle()` | VERIFIED | `writeFileSync` at line 281, `bundle()` at line 288 — correct ordering confirmed; T-21-04 check at line 267; upscale heuristic at line 274 |
| `services/remotion-renderer/src/Root.tsx` | `overlays` in `RemotionProps`, `defaultProps`, JSX render | VERIFIED | `overlays?: PngOverlayConfig[]` at line 29; `overlays = []` at line 49; JSX render at lines 123-125; `defaultProps` at line 156 |
| `services/remotion-studio/src/SubtitledVideo.tsx` | `overlays` prop + `PngOverlay` render | VERIFIED | `overlays?: PngOverlayConfig[]` at line 31; `overlays.map(...)` at lines 111-113 with `rawImageSrc={ov.imageData}` |
| `services/remotion-studio/src/editor/components/OverlayEditor.tsx` | Full OverlayEditor UI | VERIFIED | `FileReader`, 5 MB gate (`MAX_FILE_BYTES = 5 * 1024 * 1024`), `image/png` MIME check, hard cap at 3 (`MAX_OVERLAYS = 3`), `onPreviewChange` on every draft change, "Discard Changes" copy, "Add Overlay" trigger, `#b71c1c` delete color, `#4CAF50` accent |
| `services/remotion-studio/src/preview/PreviewApp.tsx` | Overlays tab between Titles and Subtitles; overlays state wired to Player | VERIFIED | TABS array: `titles` → `overlays` → `subtitles` → `text`; `overlays` and `liveOverlays` state; loaded from `GET /api/config`; included in `PUT /api/config` payload; `OverlayEditor` rendered in overlays tab panel; `liveOverlays` passed to `PreviewPlayer` |
| `services/remotion-studio/src/preview/PreviewPlayer.tsx` | `overlays` prop wired into `inputProps` | VERIFIED | `overlays?: PngOverlayConfig[]` prop at line 20; included in `inputProps.overlays: overlays ?? []` at line 57; `overlays` in `useMemo` deps at line 62 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PreviewApp.tsx` | `OverlayEditor` | import + Overlays tab JSX | WIRED | Import at line 17; rendered in `activeTab === "overlays"` block at line 441 |
| `PreviewApp.tsx` | `PreviewPlayer` | `overlays={liveOverlays}` prop | WIRED | Line 417: `overlays={liveOverlays}` passed to `<PreviewPlayer>` |
| `PreviewPlayer.tsx` | Player `inputProps.overlays` | `inputProps` useMemo | WIRED | `overlays: overlays ?? []` in `inputProps` at line 57; `overlays` in deps at line 62 |
| `SubtitledVideo.tsx` | `PngOverlay` | `overlays.map()` + `rawImageSrc` | WIRED | Lines 111-113: `overlays.map((ov, i) => <PngOverlay ... rawImageSrc={ov.imageData} />)` |
| `Root.tsx` (renderer) | `PngOverlay` | `overlays.map()` (no rawImageSrc) | WIRED | Lines 123-125: `overlays.map((ov, i) => <PngOverlay key={...} overlay={ov} />)` |
| `render.ts` | `public/overlay-N.png` | `fs.writeFileSync` before `bundle()` | WIRED | `writeFileSync` at line 281 precedes `bundle()` at line 288 |
| `render.ts` | `inputProps.overlays` | `resolvedOverlays` passed in `inputProps` | WIRED | Line 339: `overlays: resolvedOverlays` in `inputProps` construction |
| `renderer/pipeline-config.ts` | `validatePipelineConfig` | synced copy from studio | WIRED | `diff` exits 0 — identical copy |
| `renderer/compositions/PngOverlay.tsx` | studio `PngOverlay.tsx` | renderer sync (cp command) | WIRED | `diff` exits 0 — identical copy |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `OverlayEditor.tsx` | `draft.imageData` | `FileReader.readAsDataURL(file)` on user-selected PNG | Yes — populated by live file upload | FLOWING |
| `PreviewApp.tsx` | `liveOverlays` | `setLiveOverlays` called from `OverlayEditor.onPreviewChange` + loaded from `GET /api/config` | Yes — real PNG data URLs from user uploads, persisted to config | FLOWING |
| `PreviewPlayer.tsx` | `inputProps.overlays` | `overlays ?? []` from PreviewApp prop | Yes — passes real overlay objects including `imageData` | FLOWING |
| `SubtitledVideo.tsx` | `overlays` prop | passed from `PreviewPlayer.inputProps` | Yes — real data URL as `rawImageSrc` to `<Img>` in Player context | FLOWING |
| `render.ts` | `resolvedOverlays` | decoded from `pipelineConfig.overlays[].imageData` via `Buffer.from(base64)` | Yes — real PNG bytes written to `public/overlay-N.png`; `_resolvedFile` set on each overlay | FLOWING |
| `Root.tsx` (renderer) | `overlays` | passed via `inputProps.overlays` from `render.ts` | Yes — `_resolvedFile` set, `PngOverlay` uses `staticFile(_resolvedFile)` | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: No runnable server was started for this verification. The key behavioral checks are covered by the test suite (293/293 passing) and the approved human UAT checkpoint.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full renderer test suite (OVERLAY-* + overlay.test.ts) | `cd services/remotion-renderer && npx vitest run` | 293 tests passed (9 files) | PASS |
| Editor build | `cd services/remotion-studio && npm run build:editor` | exit 0; `index-Di-MNQy0.js` produced | PASS |
| `writeFileSync` before `bundle()` | Line 281 vs line 288 | 281 < 288 | PASS |
| `diff` studio vs renderer `pipeline-config.ts` | `diff` | exit 0 (identical) | PASS |
| `diff` studio vs renderer `PngOverlay.tsx` | `diff` | exit 0 (identical) | PASS |
| T-21-04 security check present | `grep "data:image/png;base64" render.ts` | 2 matches (lines 267-268) | PASS |

---

### Requirements Coverage

| Requirement | Description | Plans | Status | Evidence |
|-------------|-------------|-------|--------|----------|
| OVERLAY-01 | User can add a transparent PNG overlay onto the video | 21-01, 21-02, 21-03 | SATISFIED | Schema contract (pipeline-config.ts), PngOverlay component (both services), render.ts decode path, OverlayEditor UI, PreviewApp wiring. Human UAT approved. |
| OVERLAY-02 | A PNG larger than the frame is downscaled by code at render time for crisp output | 21-01, 21-02, 21-03 | SATISFIED | CSS `displayWidth` on `<Img>` triggers Chromium bilinear downscale (D-04 design decision). `imageRendering: "auto"`. Upscale advisory `console.warn` in `render.ts`. |
| OVERLAY-03 | User can position and size the PNG overlay | 21-01, 21-02, 21-03 | SATISFIED | X/Y/Width controls in `OverlayEditor.tsx`; pixel-to-percentage CSS in `PngOverlay.tsx`; opacity slider; live preview via `onPreviewChange`; values persisted to `pipeline-config.json` via `PUT /api/config`. |

**Orphaned requirements check:** No additional requirements mapped to Phase 21 in REQUIREMENTS.md beyond OVERLAY-01/02/03. None orphaned.

**Traceability note:** REQUIREMENTS.md still shows OVERLAY-01/02/03 as `[ ]` (checkbox unchecked). This is a tracking artifact state, not a code failure — the ROADMAP.md shows Phase 21 as `[x]` (completed 2026-05-30). The REQUIREMENTS.md traceability table status column says "Planned" which is staleness in the tracking doc, not a code gap.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `services/remotion-studio/src/server.ts` | 205, 287 | `"not yet implemented"` / `"placeholder"` on `POST /api/render` | Info | Pre-existing stub for a future phase (D-20, future Plan 05). Not introduced by Phase 21. Not a debt marker for this phase — explicitly labeled as future work in the comment. |

No blockers found. No Phase-21-introduced TBD/FIXME/XXX/TODO markers.

---

### Human Verification Required

The following item requires human confirmation because it involves visual rendering quality that cannot be verified by static analysis.

#### 1. Visual rendering quality (informational — UAT already approved)

**Test:** Open the studio at `http://localhost:3123`. Navigate to the Overlays tab. Upload a PNG with a transparent background. Observe the overlay in the Remotion Player.
**Expected:** Overlay renders with transparency preserved (no white box artifact), correct pixel position matches X/Y values, opacity slider visually affects the overlay, overlay is crisp (not blurry) when PNG source is larger than `displayWidth`.
**Why human:** Chromium alpha channel rendering, visual crispness of bilinear downscale, and correct pixel-to-percentage position mapping cannot be verified by file inspection alone.

**Note:** This item was already verified and approved via the blocking `checkpoint:human-verify` task in Plan 21-03 (all 8 UAT steps passed). The human_needed status here reflects the standard verification rule: any phase with visual rendering should carry a human verification item in the report. No re-testing is required unless the developer wants to re-confirm the deployed build.

---

### Gaps Summary

No gaps. All 3 roadmap success criteria are verified in the codebase. All must-have artifacts exist, are substantive, are wired, and have real data flowing through them. The renderer test suite passes 293/293 tests. The editor build is green. The T-21-04 security check is in place. The file decode precedes `bundle()`.

The status is `human_needed` (not `passed`) because a visual quality item is included per the verification protocol for phases that produce UI rendering. The human checkpoint was already obtained during Plan 21-03 execution (all 8 UAT steps approved by the user).

---

_Verified: 2026-05-30T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
