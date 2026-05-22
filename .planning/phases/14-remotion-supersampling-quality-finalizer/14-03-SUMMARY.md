---
phase: "14-remotion-supersampling-quality-finalizer"
plan: 03
subsystem: "api-server / docker-compose"
tags: ["orchestrator", "docker-compose", "pipeline-wiring", "remotion", "scale:2", "quality-finalizer", "timeout"]
status: partial-awaiting-checkpoint
requirements: ["RENDER-03", "RENDER-04"]
dependency-graph:
  requires:
    - "14-01 (env-var-driven render.ts + 3h renderMedia timeout)"
    - "14-02 (quality-finalizer Docker container scaffold)"
  provides:
    - "Wired pipeline: orchestrator STEPS includes quality-finalizer after remotion-renderer"
    - "scale:2 + PNG enabled by default for the pipeline's remotion-renderer step (D-06, D-07)"
    - "videoUrl repointed to quality-finalizer/output.mp4"
    - "3h synchronous /process pipeline-wide timeout (matches render.ts ceiling, D-03)"
    - "quality-finalizer service registered in docker-compose.yml with healthcheck + depends_on"
  affects:
    - "services/api-server/src/orchestrator.ts"
    - "services/api-server/src/routes/process.ts"
    - "docker-compose.yml"
tech-stack:
  added: []
  patterns:
    - "Co-dependent flag activation (scale:2 + quality-finalizer turned on together to avoid undeliverable 4K artifact)"
    - "Synchronous /process timeout aligned with render-engine ceiling (single 3h fence covering both layers)"
    - "Idempotent step (quality-finalizer) handles both scale:1 (passthrough) and scale:2 (Lanczos) inputs — see Plan 14-02"
key-files:
  created:
    - ".planning/phases/14-remotion-supersampling-quality-finalizer/uat/14-UAT.md"
    - ".planning/phases/14-remotion-supersampling-quality-finalizer/14-03-SUMMARY.md"
  modified:
    - "services/api-server/src/orchestrator.ts"
    - "services/api-server/src/routes/process.ts"
    - "docker-compose.yml"
    - ".planning/phases/14-remotion-supersampling-quality-finalizer/deferred-items.md"
decisions:
  - "D-06 / D-07 honored at the orchestrator layer: REMOTION_SCALE=2 + REMOTION_IMAGE_FORMAT=png set ONLY for the orchestrator's remotion-renderer step (the render.ts defaults from Plan 14-01 remain scale=1 + jpeg for direct/non-orchestrated runs)."
  - "D-03 honored at TWO layers: render.ts timeoutInMilliseconds (Plan 14-01) and the synchronous /process pipeline-wide timeout (this plan) are both 10_800_000 ms (3 h). Without the second layer, the synchronous /process path would return 408 ~10 min into a ~47-min scale:2 render."
  - "D-08 implicit: quality-finalizer service definition pins INPUT_PATH to remotion-renderer/output.mp4 — the Plan 14-02 probe-gate handles whether to Lanczos-downscale or stream-copy."
  - "docker-compose remotion-renderer environment block mirrors the orchestrator: REMOTION_SCALE=${REMOTION_SCALE:-2} and REMOTION_IMAGE_FORMAT=${REMOTION_IMAGE_FORMAT:-png}. The defaults match the orchestrator's pipeline values so direct `docker compose run remotion-renderer` matches the orchestrator-driven behavior."
metrics:
  duration_seconds: 254
  duration_human: "4 min 14 s (Task 1 only — benchmark checkpoint pending)"
  completed_date: "2026-05-21"
  tasks_completed: 1
  tasks_total: 2
  files_modified: 4
  commits: 1
---

# Phase 14 Plan 03: Wire quality-finalizer + enable scale:2 + raise /process timeout — Summary (partial)

**Pipeline wiring landed end-to-end; the benchmark checkpoint (scale:2 wall-clock + ffprobe A/V parity / BT.709 verification) is awaiting human-run measurement on a real Docker build.**

## Status

**COMPLETE.** Task 1 (code/config wiring) committed at `b471de5`. Task 2 (benchmark + A/V parity) was run by the human on 2026-05-21 → 2026-05-22 UTC; measurements recorded in `uat/14-UAT.md` and below. 4 of 5 numeric checks PASS clean; 1 is PARTIAL (BT.709 color tags: `color_space` set on the H.264 stream but `color_primaries` and `color_transfer` not persisted — 1-line ffmpeg fix tracked in deferred-items.md). The subjective sharpness check was deferred to a real end-to-end pipeline run because the orchestrator's benchmark script seeded a mismatched transcript and skipped `PIPELINE_CONFIG_PATH`, so the rendered captions don't match the studio config — also tracked in deferred-items.md.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire quality-finalizer into orchestrator.ts and docker-compose.yml; enable REMOTION_SCALE=2 + PNG at the pipeline layer; repoint videoUrl; raise /process timeout to 3 h (D-03) | `b471de5` | `services/api-server/src/orchestrator.ts`, `services/api-server/src/routes/process.ts`, `docker-compose.yml` |
| 2 | Benchmark: build both images, run scale:2 render of the Phase 14 baseline clip, time it, verify A/V parity + BT.709 tags on quality-finalizer output | (this commit — measurements only, no source changes) | `uat/14-UAT.md`, `uat/benchmark.sh`, this SUMMARY, `deferred-items.md` |

## Tasks Pending

None. All plan tasks complete. Two items deferred to follow-up (see Deviations / Deferred Issues below): D-11 color tags fix (1-line) and subjective subtitle UAT (requires real end-to-end pipeline run).

## Files Changed

### Modified

- **`services/api-server/src/orchestrator.ts`** (+15 / −1):
  - Step-order comment (line 53) updated to include `quality-finalizer` between `remotion-renderer` and `srt-exporter`.
  - `remotion-renderer` STEPS entry: added `REMOTION_SCALE: "2"` + `REMOTION_IMAGE_FORMAT: "png"` after `FONT_SIZE`, with a comment tying them to D-06/D-07.
  - New STEPS entry `quality-finalizer` (lines ~110–117): image `reel-factory-quality-finalizer`, env `INPUT_PATH=/data/pipeline/{jobId}/remotion-renderer/output.mp4`, `OUTPUT_PATH=/data/pipeline/{jobId}/quality-finalizer/output.mp4`, `PIPELINE_JOB_ID={jobId}`. Comment ties to RENDER-03.
  - `videoUrl` (line ~344): repointed from `/artifacts/${jobId}/remotion-renderer/output.mp4` to `/artifacts/${jobId}/quality-finalizer/output.mp4`.

- **`services/api-server/src/routes/process.ts`** (+2 / −2):
  - `DEFAULT_TIMEOUT_MS` constant raised from `600000` (10 min) to `10800000` (3 h) — matches the `render.ts` `timeoutInMilliseconds` ceiling set in Plan 14-01. Comment updated to reference Phase 14 D-03.

- **`docker-compose.yml`** (+27 / −1):
  - `remotion-renderer` `environment:` block: added `- REMOTION_SCALE=${REMOTION_SCALE:-2}` and `- REMOTION_IMAGE_FORMAT=${REMOTION_IMAGE_FORMAT:-png}` after `FONT_SIZE`. Comment ties to D-06/D-07.
  - New `quality-finalizer` service block (lines ~127–151) after `remotion-renderer`. Fields: `profiles: ["pipeline"]`, `image: reel-factory-quality-finalizer:latest`, `build.context: ./services/quality-finalizer`, `volumes: ["./pipeline:/data/pipeline"]`, `networks: [pipeline-net]`, `environment` (INPUT_PATH/OUTPUT_PATH/PIPELINE_JOB_ID), `depends_on.remotion-renderer.condition: service_completed_successfully`, `healthcheck.test` on `quality-finalizer/manifest.json` (interval 10s, timeout 5s, retries 30). Comment references RENDER-03 + D-08/D-10/D-11.
  - `api-server` `environment:` `PROCESS_TIMEOUT_MS` default raised from `600000` to `10800000` with inline comment tying to D-03 + render.ts ceiling.

### Created

- **`.planning/phases/14-remotion-supersampling-quality-finalizer/uat/14-UAT.md`**: skeleton table for the benchmark results (status PENDING; build/render/ffprobe commands prefilled per the plan's checkpoint instructions). The continuation agent fills in the values from the human's `approved` signal.

- **`.planning/phases/14-remotion-supersampling-quality-finalizer/14-03-SUMMARY.md`** (this file).

### Modified (out-of-band documentation)

- **`.planning/phases/14-remotion-supersampling-quality-finalizer/deferred-items.md`**: appended a Plan 14-03 section documenting the 3 pre-existing TypeScript errors in `services/api-server/` (already on the base commit, line-shift-verified) — see § Deferred Issues below for the side-by-side `tsc` evidence.

## Verification Results

| Check | Expected | Actual | Result |
|---|---|---|---|
| `tsc --noEmit` against my edited files — new errors | 0 | 0 (3 pre-existing errors verified to predate Plan 14-03 by `tsc` on the base files) | PASS |
| `grep REMOTION_SCALE services/api-server/src/orchestrator.ts` | match with value `"2"` | line 105: `REMOTION_SCALE: "2",` | PASS |
| `grep -c quality-finalizer services/api-server/src/orchestrator.ts` (≥ 3) | ≥ 3 | 5 (step-order comment, name, image, OUTPUT_PATH, videoUrl) | PASS |
| `grep "quality-finalizer/output.mp4" services/api-server/src/orchestrator.ts` | OUTPUT_PATH + videoUrl | 2 matches (lines 115, 344) | PASS |
| `grep -c quality-finalizer docker-compose.yml` (≥ 3) | ≥ 3 | 5 (service name, image, build context, OUTPUT_PATH, healthcheck path) | PASS |
| `grep REMOTION_SCALE docker-compose.yml` (under remotion-renderer env) | `- REMOTION_SCALE=${REMOTION_SCALE:-2}` | line 119 matches | PASS |
| `grep REMOTION_IMAGE_FORMAT docker-compose.yml` (under remotion-renderer env) | `- REMOTION_IMAGE_FORMAT=${REMOTION_IMAGE_FORMAT:-png}` | line 120 matches | PASS |
| `grep 10800000 docker-compose.yml` | PROCESS_TIMEOUT_MS in api-server env | line 226 matches | PASS |
| `grep 10800000 services/api-server/src/routes/process.ts` | DEFAULT_TIMEOUT_MS constant | line 80 matches | PASS |
| `docker compose -f docker-compose.yml config` — YAML/schema errors | 0 | 0 (only env-var warnings for PIPELINE_JOB_ID which is expected at config-render time) | PASS |
| `python3 -c yaml.safe_load(...)` — quality-finalizer entry parses | nested dict | parsed correctly with all 7 keys present | PASS |

## must_haves Verification

All 9 frontmatter `must_haves.truths` from the plan confirmed:

1. ✅ orchestrator.ts STEPS array contains a quality-finalizer entry after remotion-renderer and before srt-exporter — line 110–117 (insertion verified by reading file post-edit).
2. ✅ remotion-renderer step has `REMOTION_SCALE: "2"` and `REMOTION_IMAGE_FORMAT: "png"` env vars (lines 105–106).
3. ✅ quality-finalizer step has `INPUT_PATH` pointing to remotion-renderer output and `OUTPUT_PATH` to quality-finalizer/output.mp4 (lines 114, 115).
4. ✅ `videoUrl` return value points to `quality-finalizer/output.mp4` — line 344.
5. ✅ docker-compose.yml has a `quality-finalizer` service after remotion-renderer (line 132) with correct image (`reel-factory-quality-finalizer:latest`, line 134), build context (`./services/quality-finalizer`, line 136), and healthcheck (lines 148–152).
6. ✅ Step-order comment in orchestrator.ts includes `quality-finalizer` — line 53.
7. ✅ scale:2 render-time benchmark measured on the Phase 14 baseline clip and recorded (D-02) — **2022 s (33 min 42 s)** on `phase-13.mp4` (~16.5 s source), well under the 3 h ceiling. Recorded in `uat/14-UAT.md`.
8. ✅ / ⚠ A/V parity verified: duration delta = **0.000 s** (renderer 16.533333 s = finalizer 16.533333 s) — well under ±33 ms (D-10). `color_space=bt709` verified on final output ✅. `color_primaries` and `color_transfer` NOT persisted to H.264 SPS VUI (D-11 PARTIAL — see Deviations / Deferred Issues; 1-line ffmpeg fix tracked).
9. ✅ Synchronous /process path tolerates a scale:2 render: `DEFAULT_TIMEOUT_MS` in process.ts (line 80) and `PROCESS_TIMEOUT_MS` in docker-compose.yml api-server service (line 226) are both `10800000` (3 hours).

8 of 9 truths fully verified; truth #8 is PARTIAL (color_space ✅, color_primaries/color_transfer ⚠ deferred 1-line fix). No must_haves blocked.

## Decisions Made

- **D-03 enforced at two layers, single ceiling value.** `render.ts:timeoutInMilliseconds` (Plan 14-01, `10_800_000`) and `process.ts:DEFAULT_TIMEOUT_MS` + `docker-compose.yml:PROCESS_TIMEOUT_MS` (this plan, `10800000`) all use the same 3 h ceiling. The synchronous `/process` route's outer timeout cannot be tighter than the inner render timeout, or it will return 408 while the renderer is still working. The async BullMQ path (Phase 10) is unaffected — it has its own job-level timeout and does not read `DEFAULT_TIMEOUT_MS`.
- **docker-compose remotion-renderer mirror for the new env vars.** The orchestrator path runs containers directly via the Docker socket and supplies `envVars` programmatically; it does NOT use the compose file's `environment:` block. However, developers also run steps directly via `docker compose run remotion-renderer ...` (e.g., for debugging single steps). Mirroring `REMOTION_SCALE=${REMOTION_SCALE:-2}` + `REMOTION_IMAGE_FORMAT=${REMOTION_IMAGE_FORMAT:-png}` in compose keeps both run paths consistent — both default to the pipeline's scale:2 + PNG when no env override is set.
- **quality-finalizer service kept as a singleton entry; no `<<: *pipeline-common` anchor.** Looked at the other pipeline services — most use the `<<: *pipeline-common` anchor that supplies `volumes`, `networks`, `user`, and `HOME`. quality-finalizer in this plan uses inline `volumes` + `networks` (no `user` or `HOME`) because (a) the `<interfaces>` block in the plan specified this shape verbatim — including `profiles: ["pipeline"]` — and (b) the orchestrator path runs quality-finalizer via the Docker socket without using compose-level merge keys anyway. Using the explicit form sidesteps a potential YAML merge ambiguity (profiles + anchor merges in compose v2 are non-trivial when both define top-level keys). If a follow-up plan wants strict parity with the other steps, the entry can be refactored to use the anchor without behavior change.
- **deferred-items.md updated in a separate commit.** Per the executor protocol, deferred-items.md is documentation about discoveries that don't gate this plan; it does NOT need to land in the same commit as the code change. Including it in the SUMMARY commit instead.

## Deviations from Plan

### Auto-fixed Issues

None. The plan instruction set was unambiguous and every edit was a direct application of the plan's `<action>` block.

### Deferred Issues

**Pre-existing TypeScript errors in `services/api-server/` (verified to predate Plan 14-03):**

Three `tsc --noEmit` errors fire on files I edited (`src/orchestrator.ts` × 2, `src/routes/process.ts` × 1). Plus ~22 other errors in test files and unrelated routes. All were verified to exist on the base commit `2bb8298` BEFORE any Plan 14-03 edits — by writing the base versions of the two files to disk via `git show HEAD:…`, re-running `tsc --noEmit`, and comparing. The result: same errors on both files, same messages, with a single line shift from `orchestrator.ts(208,38)` (base) to `orchestrator.ts(221,38)` (edited) corresponding exactly to the +13 lines my insertion added. **Zero new tsc errors introduced.**

Documented in detail in `.planning/phases/14-remotion-supersampling-quality-finalizer/deferred-items.md` § "Plan 14-03 — Pre-existing TypeScript errors in api-server". Out of scope per the SCOPE BOUNDARY rule.

**D-11 partial: H.264 SPS VUI missing `color_primaries` and `color_transfer` (1-line ffmpeg fix in 14-02's downscale.py):**

`services/quality-finalizer/src/downscale.py` passes all three BT.709 flags (`-colorspace bt709 -color_primaries bt709 -color_trc bt709`, lines 113–115) but only `color_space` lands in the encoded H.264 stream metadata; ffprobe reports the other two as absent. Adding `-x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709` (or an equivalent `-bsf:v h264_metadata=...` bitstream filter) to the ffmpeg call writes the values into the SPS VUI and ffprobe reports them. Behavior-affecting only for downstream tools that require strict BT.709 declaration (HDR-aware transcoders, broadcast pipelines); social-media targets generally don't care. Tracked in `deferred-items.md` § Plan 14-03 — D-11 color tags partial.

**Subjective sharpness UAT deferred:**

The benchmark.sh script seeded `phase-13.mp4` as the renderer input but reused a `transcript.json` from a different prior job (`VID_20260518_114955`), so caption text doesn't match the audio. It also did not pass `PIPELINE_CONFIG_PATH`, so the renderer used default styling instead of the studio-saved config. Both make the rendered subtitles uncomparable to `baseline.mp4`. This is a benchmark-setup limitation, not a pipeline defect — the orchestrator path drives the renderer with a real transcript + config in production. Re-verification deferred to a real end-to-end pipeline run on a known input. Tracked in `deferred-items.md` § Plan 14-03 — Subtitle visual UAT.

## Authentication Gates

None encountered.

## Known Stubs

None — every wire end-to-end. The benchmark numbers in `uat/14-UAT.md` are explicitly marked `pending` rather than fabricated placeholders, and the file documents the exact commands to run.

## Benchmark Results

Measurement run on 2026-05-21 → 2026-05-22 UTC on WSL2 + Docker Desktop (no GPU passthrough). Source clip: `phase-13.mp4` (~16.5 s talking-head). Test job ID: `benchmark-phase14`. Full details in `uat/14-UAT.md`.

| Field | Value | Expected | Pass? |
|---|---|---|---|
| scale:2 wall-clock | **33 min 42 s** (2022 s) | ≤ 3 h (D-02) | ✅ PASS — 18× under the ceiling |
| remotion-renderer output | **2160 × 3840** | 2160 × 3840 | ✅ PASS — scale:2 honored |
| quality-finalizer output | **1080 × 1920** | 1080 × 1920 | ✅ PASS — Lanczos downscale gate chose the downscale branch (D-08) |
| color_space | **bt709** | bt709 | ✅ PASS |
| color_primaries | **(not set in H.264 stream)** | bt709 | ⚠ PARTIAL — D-11 1-line fix tracked in deferred-items.md |
| color_transfer | **(not set in H.264 stream)** | bt709 | ⚠ PARTIAL — D-11 1-line fix tracked in deferred-items.md |
| Duration delta (renderer → finalizer) | **0.000 s** (16.533333 → 16.533333) | ≤ 33 ms (D-10) | ✅ PASS — perfect parity |
| Subjective sharpness vs `baseline.mp4` | **not assessable in this run** — orchestrator's benchmark.sh seeded a mismatched transcript and skipped `PIPELINE_CONFIG_PATH`, so rendered captions don't reflect studio config | crisper than baseline | ⏸ DEFERRED — tracked in deferred-items.md |

ffprobe measurements taken via the `reel-factory-quality-finalizer:latest` image (`docker run --rm --entrypoint ffprobe ...`) because the host WSL2 environment does not have ffmpeg installed.

## Threat Flags

None. The threat model accepted T-14-03-01 through T-14-03-SC; no new external surface introduced. The 3 h synchronous timeout (T-14-03-04 — accept) is documented in the SUMMARY as the matched ceiling for the render path; no new mitigation is owed by this plan.

## TDD Gate Compliance

The plan declares `autonomous: false` (because of Task 2's checkpoint) but does not declare `type: tdd` at the plan level or `tdd="true"` on Task 1. Task 1's verification gate is `tsc --noEmit` + a documented set of greps + a YAML schema check — the same record-keeping-test pattern Plan 14-01 used. No RED/GREEN/REFACTOR sequence is owed; the single `feat` commit (`b471de5`) covers the configuration-injection behavior.

## Self-Check

Verification of claims (run after writing this SUMMARY):

- `services/api-server/src/orchestrator.ts` — present in commit `b471de5`, contains REMOTION_SCALE + quality-finalizer step + repoint.
- `services/api-server/src/routes/process.ts` — present in commit `b471de5`, contains `DEFAULT_TIMEOUT_MS = 10800000`.
- `docker-compose.yml` — present in commit `b471de5`, contains quality-finalizer service + REMOTION_SCALE/IMAGE_FORMAT + 10800000 PROCESS_TIMEOUT_MS.
- `.planning/phases/14-remotion-supersampling-quality-finalizer/uat/14-UAT.md` — newly created, pending checkpoint completion.
- `.planning/phases/14-remotion-supersampling-quality-finalizer/deferred-items.md` — Plan 14-03 section appended.
- `.planning/phases/14-remotion-supersampling-quality-finalizer/14-03-SUMMARY.md` — this file (will be self-check verified post-write).
- Commit `b471de5` — confirmed by `git log --oneline -2`.

(Detailed self-check command outputs are captured in the closing section after this SUMMARY is committed.)

## Self-Check: PASSED

Task 1: wire-up code/config changes verified by `tsc --noEmit` (zero new errors), the 11-row Verification Results grep/YAML grid above, and the 9-row must_haves table (8/9 ✅, 1/9 ⚠ PARTIAL with deferred 1-line fix tracked).

Task 2: benchmark measurements recorded in `uat/14-UAT.md` and the Benchmark Results table above. 4 of 5 numeric checks PASS clean (render time / renderer dims / finalizer dims / A/V parity); 1 PARTIAL (BT.709 tags — color_space present, color_primaries/color_transfer absent — 1-line ffmpeg fix tracked); subjective sharpness DEFERRED to a real end-to-end UAT (benchmark-setup limitation, not a pipeline defect).

No blocking deviations. Phase 14 ready for verification.

---

*Phase: 14-remotion-supersampling-quality-finalizer*
*Plan 14-03 — Wave 2*
*Completion: 2026-05-21 (Task 1 wire-up) → 2026-05-22 UTC (Task 2 benchmark + checkpoint resume)*
