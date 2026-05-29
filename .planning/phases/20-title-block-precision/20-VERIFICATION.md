---
phase: 20-title-block-precision
verified: 2026-05-29T16:00:00Z
status: human_needed
score: 12/12
overrides_applied: 0
human_verification:
  - test: "TITLE-01 — Title block renders flush at top-left when X=0, Y=0"
    expected: "Title block top-left corner anchored to frame top-left; no centering offset visible"
    why_human: "Pixel-coordinate positioning requires visual inspection of Remotion preview; grep confirms the CSS formula is correct but cannot verify rendered output anchor point"
  - test: "TITLE-01 — Setting X=540, Y=960 moves block to frame center"
    expected: "Title block visually positioned at horizontal/vertical center of the 1080×1920 frame"
    why_human: "Visual spatial check required; cannot be confirmed programmatically"
  - test: "TITLE-02 — Border Radius slider from 0 to 50 changes corner appearance in live preview"
    expected: "0 = sharp corners; 50 = fully rounded (pill-shaped) corners visible in preview"
    why_human: "Live preview visual change; CSS value is confirmed correct in code but corner rendering requires human observation"
  - test: "TITLE-03 — Add/edit form shows no Subtitle text input, no Subtitle Color, no Subtitle Size, no Subtitle Font controls"
    expected: "Form contains only: Title Text, Start Time, Duration, X(px)/Y(px), Entrance Animation, Background color/opacity, Title Color, Title Size, Border Radius, Line Height/Padding, Title Font, Font Weight, Font Style, Outer Glow"
    why_human: "UI element absence requires visual inspection of rendered studio at http://localhost:3123"
---

# Phase 20: Title Block Precision Verification Report

**Phase Goal:** Implement precise pixel-level title block positioning and border-radius control, removing the subtitle field from the schema/UI.
**Verified:** 2026-05-29T16:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TitleStyleProps no longer contains topOffset, subtitleFontSize, subtitleColor, or subtitleFontFamily | VERIFIED | Interface at lines 72–87 of pipeline-config.ts (studio + renderer identical): none of these fields present |
| 2 | TitleStyleProps contains x?: number, y?: number, borderRadius?: number | VERIFIED | Lines 79–81 of pipeline-config.ts confirm all three fields present with correct types and comments |
| 3 | TitleConfig no longer contains subtitle?: string | VERIFIED | TitleConfig interface (lines 90–95) has only text, startTimeMs, durationMs, style fields |
| 4 | validatePipelineConfig accepts x/y/borderRadius and rejects negative values | VERIFIED | Lines 406–413 of pipeline-config.ts: s.x < 0, s.y < 0, s.borderRadius < 0 each emit titled error strings; 6 Phase 20 tests pass (47/47 in pipeline-config.test.ts) |
| 5 | All 47 vitest tests pass in pipeline-config.test.ts; full suite 277/277 green | VERIFIED | `npx vitest run src/pipeline-config.test.ts` → 47 passed; `npx vitest run` → 277 passed (8 test files) |
| 6 | TitleOverlay renders at left=(x/1080)*100%, top=(y/1920)*100% — no centering transform | VERIFIED | Lines 202–204 of TitleOverlay.tsx confirm formula; no translate(-50%,-50%) present |
| 7 | TitleOverlay borderRadius is config-driven: borderRadius ?? 12 px | VERIFIED | Line 77 reads `style?.borderRadius ?? DEFAULT_TITLE_STYLE.borderRadius`; line 208 CSS: `${borderRadius}px` |
| 8 | TitleOverlay does not render a subtitle block | VERIFIED | No subtitle JSX block in TitleOverlay.tsx (studio or renderer); only one mention is a comment line 17 |
| 9 | DEFAULT_TITLE_STYLE in TitleOverlay.tsx contains x:200, y:960, borderRadius:12 and no removed fields | VERIFIED | Lines 35–50: x:200, y:960, borderRadius:12 present; topOffset/subtitle fields absent |
| 10 | fontsToLoad array contains only titleFontFamily | VERIFIED | Line 84: `[titleFontFamily].filter(...)` — single-element array |
| 11 | TitleEditor form shows X(px) and Y(px) inputs and Border Radius slider; no subtitle controls | VERIFIED | grep confirms "X (px)" at line 255, "Y (px)" at line 276, "Border Radius:" at line 399/402, accentColor:"#4CAF50" at line 414; zero functional subtitle references |
| 12 | Renderer files (TitleOverlay.tsx, pipeline-config.ts) are identical to studio files | VERIFIED | `diff` of both file pairs returns empty — files are byte-for-byte identical |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/remotion-studio/src/pipeline-config.ts` | Updated TitleStyleProps/TitleConfig/validatePipelineConfig | VERIFIED | Contains `x?: number` at line 79; no subtitle/topOffset fields in TitleStyleProps or TitleConfig |
| `services/remotion-renderer/src/pipeline-config.test.ts` | Phase 20 test cases for x/y/borderRadius and subtitle removal | VERIFIED | Lines 72–257 contain all 6 Phase 20 tests; test "accepts x and y fields in title style" at line 72 |
| `services/remotion-studio/src/compositions/TitleOverlay.tsx` | Updated pixel-coordinate positioning, no subtitle | VERIFIED | Contains `(x / 1080) * 100` at line 202; no subtitle JSX |
| `services/remotion-studio/src/editor/components/TitleEditor.tsx` | X/Y inputs, borderRadius slider, subtitle fields removed | VERIFIED | Contains "X (px)" at line 255; DEFAULT_TITLE_STYLE has x:200, y:960, borderRadius:12 |
| `services/remotion-renderer/src/compositions/TitleOverlay.tsx` | Renderer sync — pixel-coordinate positioning | VERIFIED | Identical to studio file; `(x / 1080) * 100` confirmed at line 202 |
| `services/remotion-renderer/src/pipeline-config.ts` | Renderer sync — updated schema | VERIFIED | Identical to studio file |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TitleOverlay.tsx` (studio) | `pipeline-config.ts` | `TitleStyleProps` import | WIRED | Line 10: `import type { TitleStyleProps } from "../pipeline-config"` |
| `TitleEditor.tsx` | `pipeline-config.ts` | `TitleConfig` type in state and handlers | WIRED | Line 8: `import type { TitleConfig, TitleEntranceAnimation } from "../../pipeline-config.js"` |
| `pipeline-config.test.ts` | `pipeline-config.ts` | `validatePipelineConfig` import | WIRED | Tests call validatePipelineConfig; 47 tests pass |
| `SubtitledVideo.tsx` | `TitleOverlay.tsx` | `<TitleOverlay>` usage — no subtitle prop | WIRED | Lines 93–98: TitleOverlay called with text, style, durationMs, fontFamily only — subtitle prop absent |
| `renderer/TitleOverlay.tsx` | `renderer/pipeline-config.ts` | TitleStyleProps import (post-sync) | WIRED | Files are identical to studio; import is on line 10 of both |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `TitleOverlay.tsx` | x, y, borderRadius | `style?.x ?? DEFAULT_TITLE_STYLE.x` (config-driven) | Yes — reads from TitleConfig.style passed in as prop; TitleConfig comes from pipeline-config.json | FLOWING |
| `TitleEditor.tsx` | newTitle.style.x, .y, .borderRadius | React controlled inputs → in-memory state → onChange handlers | Yes — onChange spreads state and updates field; persisted via Save through onChange(titles) prop | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 47 Phase 20 tests pass (x/y/borderRadius acceptance + rejection) | `npx vitest run src/pipeline-config.test.ts` | 47 passed, 0 failed | PASS |
| Full renderer test suite (277 tests) | `npx vitest run` | 277 passed, 0 failed | PASS |
| Editor build clean | `npm run build:editor` | Exit 0, 105 modules, 679 kB bundle | PASS |
| No removed fields in studio TitleOverlay | `grep topOffset\|subtitle... TitleOverlay.tsx` | 0 functional matches (1 comment only) | PASS |
| No centering transform | `grep "translate(-50%"` | 0 matches | PASS |
| Renderer and studio TitleOverlay identical | `diff` | No diff | PASS |
| Renderer and studio pipeline-config identical | `diff` | No diff | PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files for this phase; phase is schema+UI, not a migration/tooling phase with declared probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TITLE-01 | 20-01, 20-02, 20-03, 20-04 | User can position title blocks by pixel coordinates (not percentages) | SATISFIED | `x?: number`, `y?: number` in TitleStyleProps; CSS formula `(x/1080)*100%`, `(y/1920)*100%` in TitleOverlay; X(px)/Y(px) inputs in TitleEditor |
| TITLE-02 | 20-01, 20-02, 20-03, 20-04 | User can configure border-radius on title block containers | SATISFIED | `borderRadius?: number` in TitleStyleProps; `${borderRadius}px` in TitleOverlay CSS; slider 0–50px in TitleEditor with accentColor #4CAF50 |
| TITLE-03 | 20-01, 20-02, 20-03, 20-04 | Title blocks have no subtitle field; subtitle added as separate title block | SATISFIED | `subtitle?: string` absent from TitleConfig; no subtitle JSX in TitleOverlay; no subtitle form fields in TitleEditor; SubtitledVideo.tsx passes no subtitle prop |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `typography.test.ts` | 189 | Stale test name "subtitleFontSize = 200 (new max)" still uses `subtitleFontSize` field in fixture; since TitleStyleProps no longer validates this field, the test passes (unknown field = silent ignore) but the name is misleading | Info | Test passes; no behavioral impact; test verifies `result.valid === true` which is correct behavior (unknown fields not rejected). The fix commit (a6c1429) updated the adjacent "rejects" test but left this "accepts" test name stale. |

No TBD, FIXME, or XXX markers found in any Phase 20 modified files.

### Human Verification Required

The automated layer is fully verified. Plan 04 documents human UAT approval in the SUMMARY (Task 2, all 6 checks marked approved). However, per the verification process, human-check items from Plan 04's `checkpoint:human-verify` gate must be surfaced here for the end-of-phase audit trail.

### 1. TITLE-01 — Pixel positioning at X=0, Y=0 (top-left anchor)

**Test:** Start the studio (`cd services/remotion-studio && setsid env PORT=3123 EDITOR_DIST=$(pwd)/dist/editor ACTIVE_PIPELINE_CONFIG_PATH=$(pwd)/../../pipeline/pipeline-config.json npx tsx src/server.ts > /tmp/remotion-server.log 2>&1 &`), open http://localhost:3123, go to Titles tab, add a title with X=0, Y=0.
**Expected:** Title block top-left corner flush with the video frame top-left; no centering offset.
**Why human:** Pixel anchor behavior requires visual inspection of the rendered preview.

### 2. TITLE-01 — Pixel positioning at X=540, Y=960 (frame center)

**Test:** Edit the title to X=540, Y=960.
**Expected:** Block visually moves to horizontal/vertical center of the 1080×1920 frame.
**Why human:** Spatial positioning check requires visual confirmation.

### 3. TITLE-02 — Border Radius slider changes corner appearance

**Test:** Edit a title. Drag Border Radius slider to 0, then to 50.
**Expected:** 0 shows sharp corners; 50 shows fully rounded (pill-shaped) corners in preview.
**Why human:** CSS corner rendering requires visual observation.

### 4. TITLE-03 — No subtitle controls in add/edit form

**Test:** Open add or edit title form.
**Expected:** Form contains no Subtitle text input, no Subtitle Color, no Subtitle Size slider, no Subtitle Font select. Titles list shows no subtitle line under existing entries.
**Why human:** UI element absence requires visual inspection of the rendered studio.

---

### Gaps Summary

No gaps found. All 12 must-haves are verified in the codebase. The human verification items above are checkpoint requirements from Plan 04's `checkpoint:human-verify` gate — they are documented as approved in the 20-04-SUMMARY.md. Surfaced here per the end-of-phase audit pattern.

One informational finding: `typography.test.ts` line 189 has a stale test name ("accepts title style subtitleFontSize = 200") that passes a now-undefined field; the test still passes correctly (valid=true for unknown fields) but the name is misleading. Not a blocker.

---

_Verified: 2026-05-29T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
