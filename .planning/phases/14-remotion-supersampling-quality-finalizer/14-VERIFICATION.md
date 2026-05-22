---
phase: 14-remotion-supersampling-quality-finalizer
verified: 2026-05-22T00:00:00Z
status: human_needed
score: 4/5 roadmap criteria verified (criterion #1 subjective — human-verify pending)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
human_verification:
  - test: "Run a real end-to-end pipeline job (Whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer@scale:2 → quality-finalizer) with a matching transcript and a studio-saved pipeline-config.json, then open quality-finalizer/output.mp4 and compare subtitle/overlay edge sharpness against .planning/phases/13-encode-quality/uat/baseline.mp4."
    expected: "Subtitle text and overlay edges are visibly crisper / show smoother anti-aliasing than the scale:1 baseline (success criterion #1)."
    why_human: "Subjective visual quality — anti-aliasing perceptibility cannot be measured programmatically. The benchmark run could not assess this because benchmark.sh seeded a mismatched transcript (VID_20260518_114955) and omitted PIPELINE_CONFIG_PATH, so rendered captions did not reflect studio config. This is a benchmark-setup limitation, not a pipeline defect."
deferred:
  - truth: "quality-finalizer output reports color_primaries=bt709 and color_transfer=bt709 in H.264 SPS VUI"
    addressed_in: "Tracked follow-up (deferred-items.md § Plan 14-03 — D-11 color tags partial)"
    evidence: "downscale.py passes -colorspace/-color_primaries/-color_trc bt709 but H.264 only persists color_space; 1-line fix (-x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709). The 14-02 must_have only required color_space verification, which PASSES."
---

# Phase 14: Remotion Supersampling + quality-finalizer Verification Report

**Phase Goal:** Los subtítulos y overlays salen nítidos via render a 2x densidad de pixel, y la salida final sigue siendo 1080x1920 entregable via un nuevo step Docker quality-finalizer
**Verified:** 2026-05-22
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Subtitle text in final video is visually sharper than baseline (2x anti-aliasing perceptible) | ? UNCERTAIN | Subjective. Code path delivers scale:2→PNG→Lanczos (verified below), but visual comparison was not assessable in the benchmark run (mismatched transcript + no PIPELINE_CONFIG_PATH). Routed to human end-to-end UAT. |
| 2 | remotion-renderer emits 2160x3840, quality-finalizer emits 1080x1920 | ✓ VERIFIED | Composition is 1080x1920 (Root.tsx:124-125) + `scale: remotionScale` (render.ts:324) with REMOTION_SCALE="2" (orchestrator.ts:105) → benchmark ffprobe: renderer=2160x3840, finalizer=1080x1920 (benchmark-result.txt M2/M3) |
| 3 | quality-finalizer is independent Docker container: INPUT (2160x3840) → OUTPUT (1080x1920) via Lanczos single encode, no existing-step changes | ✓ VERIFIED | services/quality-finalizer/Dockerfile + main.py + downscale.py present; single ffmpeg encode `scale=1080:1920:flags=lanczos,setsar=1` (downscale.py:103-125); additive STEPS entry (orchestrator.ts:110-118), no existing entries modified |
| 4 | scale:2 render time measured on representative clip; downgrade to scale:1.5 if over threshold, document final value | ✓ VERIFIED | Benchmark: 33min42s (2022s) on phase-13.mp4, well under 3h ceiling. scale:1.5 NOT needed; documented in 14-UAT.md + benchmark-result.txt M1 |
| 5 | A/V parity preserved in quality-finalizer output — duration & sync identical to input | ✓ VERIFIED | Audio `-c:a copy` (downscale.py:122); benchmark duration delta = 0.000s (16.533333s == 16.533333s) vs 33ms threshold (benchmark-result.txt M4) |

**Score:** 4/5 criteria verified; 1 (subjective sharpness) pending human UAT.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | color_primaries=bt709 / color_transfer=bt709 in H.264 SPS VUI | Tracked in deferred-items.md (Plan 14-03 D-11 partial) | downscale.py passes all 3 flags; H.264 only persists color_space. 1-line fix tracked. 14-02 must_have required only color_space, which PASSES. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/remotion-renderer/src/render.ts` | Env-driven render params + 3h timeout | ✓ VERIFIED | 6 env reads (lines 88-93), all 6 params in renderMedia (324-329), timeoutInMilliseconds=10_800_000 (336), remotion_info has 6 diag fields (358-363). Phase 14 additions type-clean. |
| `services/quality-finalizer/Dockerfile` | Container build (video-pipeline-base-python) | ✓ VERIFIED | Present, mirrors ffmpeg-finalizer |
| `services/quality-finalizer/main.py` | Entry point, env validation, manifest | ✓ VERIFIED | Reads/validates INPUT/OUTPUT/JOB_ID, probe→apply_downscale→DownscaleInfo→downscale-info.json + manifest step_name="quality-finalizer" |
| `services/quality-finalizer/src/config.py` | Constants w/ D-XX traceability | ✓ VERIFIED | STEP_NAME, TARGET_WIDTH=1080, TARGET_HEIGHT=1920, H264_CRF=18, H264_PRESET=medium |
| `services/quality-finalizer/src/downscale.py` | probe_video + needs_downscale + apply_downscale | ✓ VERIFIED | Lanczos filter chain, CRF 18, BT.709 tags, -c:a copy, +faststart; NO unsharp (grep=0) |
| `services/quality-finalizer/src/schema.py` | DownscaleInfo pydantic model | ✓ VERIFIED | 11 fields including downscale_applied, lanczos_scaling, color_* |
| `services/quality-finalizer/src/validate.py` | color/dimension/parity validators | ✓ VERIFIED | validate_color_tags, validate_duration_parity, validate_dimensions all exposed (import test passed) |
| `services/quality-finalizer/tests/test_downscale.py` | needs_downscale unit tests | ✓ VERIFIED | 3 tests pass (2160x3840→True, 1080x1920→False, 2160x1920→True) |
| `services/api-server/src/orchestrator.ts` | quality-finalizer wired + REMOTION_SCALE=2 | ✓ VERIFIED | STEPS entry between renderer & srt-exporter (110-118), REMOTION_SCALE="2"+PNG (105-106), videoUrl→quality-finalizer (344), step-order comment (53) |
| `services/api-server/src/routes/process.ts` | DEFAULT_TIMEOUT_MS=3h | ✓ VERIFIED | Line 80 = 10800000 |
| `docker-compose.yml` | quality-finalizer service + raised timeout | ✓ VERIFIED | Service block (132-152) w/ build context, depends_on renderer service_completed_successfully, healthcheck; REMOTION_SCALE/IMAGE_FORMAT (119-120); PROCESS_TIMEOUT_MS=10800000 (226) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| process.env.REMOTION_SCALE | renderMedia({ scale }) | parseFloat | ✓ WIRED | render.ts:88 → 324; benchmark confirms 2160x3840 output |
| process.env.REMOTION_IMAGE_FORMAT | renderMedia({ imageFormat }) | cast | ✓ WIRED | render.ts:93 → 329 |
| orchestrator REMOTION_SCALE="2" | renderer container env | envVars object | ✓ WIRED | orchestrator.ts:105 |
| main.py probe_video | apply_downscale | needs_downscale branch | ✓ WIRED | main.py:76→89; downscale.py:98 branch |
| apply_downscale Lanczos branch | ffmpeg scale=...flags=lanczos | subprocess argv list | ✓ WIRED | downscale.py:103-107 |
| orchestrator | videoUrl quality-finalizer/output.mp4 | return statement | ✓ WIRED | orchestrator.ts:344 |
| docker-compose quality-finalizer | reel-factory-quality-finalizer image | build.context | ✓ WIRED | docker-compose.yml:134-136 |
| docker-compose api-server | PROCESS_TIMEOUT_MS=10800000 | environment entry | ✓ WIRED | docker-compose.yml:226 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| quality-finalizer output.mp4 | probe_info dims | ffprobe on real renderer output | Yes — benchmark produced 14.0 MB 1080x1920 file from 45.3 MB 2160x3840 input | ✓ FLOWING |
| renderer output.mp4 | scale param | env REMOTION_SCALE=2 → renderMedia | Yes — 2160x3840 confirmed | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| needs_downscale logic | pytest tests/test_downscale.py | 3 passed | ✓ PASS |
| validators importable | python3 import validate_dimensions/color_tags/duration_parity | validators OK | ✓ PASS |
| No unsharp filter (D-09) | grep -c unsharp downscale.py | 0 | ✓ PASS |
| scale:2 end-to-end render | docker run renderer @ REMOTION_SCALE=2 | 2160x3840 output, exit 0 | ✓ PASS (orchestrator benchmark) |
| Lanczos downscale | docker run quality-finalizer | 1080x1920 output | ✓ PASS (orchestrator benchmark) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RENDER-01 | 14-01 | Remotion uses supersampling scale:2 for sharp subtitles/overlays | ✓ SATISFIED | render.ts scale param + REMOTION_SCALE="2"; renderer output 2160x3840 |
| RENDER-02 | 14-01 | Lossless PNG frame capture when supersampling | ✓ SATISFIED | render.ts imageFormat + REMOTION_IMAGE_FORMAT="png" wired |
| RENDER-03 | 14-02, 14-03 | New quality-finalizer step Lanczos-downscales 2160x3840→1080x1920 single final encode, output stays 9:16 1080x1920 | ✓ SATISFIED | Container + Lanczos single encode; benchmark 1080x1920 output |
| RENDER-04 | 14-03 | Render-time impact measured & acceptable (benchmark gate) | ✓ SATISFIED | 33min42s measured, under 3h ceiling, scale:1.5 not needed, documented |

All 4 declared requirement IDs (RENDER-01..04) are claimed by plans and accounted for. No orphaned requirements: REQUIREMENTS.md maps exactly RENDER-01..04 to Phase 14, all covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TBD/FIXME/XXX in modified files | ℹ️ Info | Clean |

Note: `npx tsc --noEmit` reports errors in render.ts (lines 313/323/339), Root.tsx, and api-server (artifacts.ts, batch.ts, status.ts, shared/schemas module resolution). These are PRE-EXISTING baseline errors (the `args` ChromiumOptions error and RemotionProps index-signature errors existed in the committed render.ts before Phase 14; the Phase 14 additions at lines 88-93/324-329/336 are NOT among the reported errors). Not a Phase 14 regression.

### Human Verification Required

#### 1. Subjective subtitle/overlay sharpness (Success Criterion #1)

**Test:** Run a real end-to-end pipeline job with a matching transcript and a studio-saved pipeline-config.json, then open `quality-finalizer/output.mp4` and compare subtitle/overlay edge sharpness against `.planning/phases/13-encode-quality/uat/baseline.mp4`.
**Expected:** Subtitle text and overlay edges visibly crisper / smoother anti-aliasing than the scale:1 baseline.
**Why human:** Anti-aliasing perceptibility is subjective and cannot be measured programmatically. The benchmark run used a mismatched transcript and skipped PIPELINE_CONFIG_PATH, so its captions were not comparable to baseline (benchmark-setup limitation, not pipeline defect).

### Gaps Summary

No blocking gaps. The full scale:2 → PNG → Lanczos-downscale → 1080x1920 path is implemented, wired end-to-end (orchestrator + docker-compose), and confirmed by the orchestrator-run benchmark: renderer emits 2160x3840, quality-finalizer emits 1080x1920, A/V duration delta is 0.000s, color_space=bt709, and the scale:2 render (33min42s) is well under the 3h ceiling so no scale:1.5 downgrade was required. All 4 requirement IDs are satisfied.

Two items remain open but are NOT blockers:
1. **Success criterion #1 (subjective sharpness)** — genuinely requires a human visual judgment on a real end-to-end run. This drives the `human_needed` status.
2. **D-11 color_primaries/color_transfer** — a tracked 1-line ffmpeg follow-up; the Phase 14 must_have only required color_space (which passes), so this is deferred, not failed.

---

_Verified: 2026-05-22_
_Verifier: Claude (gsd-verifier)_
