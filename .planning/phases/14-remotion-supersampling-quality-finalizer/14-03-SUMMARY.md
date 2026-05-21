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

**Partial / awaiting checkpoint.** Task 1 (the entire code/config wiring) is complete and
committed. Task 2 is a `checkpoint:human-verify` block that requires running a real
scale:2 render (~47 min wall-clock on a 60s clip) plus ffprobe probes on the produced MP4s.
This executor agent cannot fabricate timing data or A/V parity numbers — the orchestrator
will gather measurements from the user and spawn a continuation agent to (a) update
`.planning/phases/14-remotion-supersampling-quality-finalizer/uat/14-UAT.md` with the
recorded values and (b) update this SUMMARY's `## Benchmark Results` section + frontmatter
status from `partial-awaiting-checkpoint` to `complete`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire quality-finalizer into orchestrator.ts and docker-compose.yml; enable REMOTION_SCALE=2 + PNG at the pipeline layer; repoint videoUrl; raise /process timeout to 3 h (D-03) | `b471de5` | `services/api-server/src/orchestrator.ts`, `services/api-server/src/routes/process.ts`, `docker-compose.yml` |

## Tasks Pending

| # | Task | Why pending | Blocker |
|---|------|-------------|---------|
| 2 | Benchmark: build both images, run scale:2 render of the Phase 14 baseline clip, time it, verify A/V parity + BT.709 tags on quality-finalizer output | `checkpoint:human-verify` — requires real ~47-min Docker render + ffprobe; cannot be done deterministically inside an executor agent | Awaiting orchestrator + human resume signal |

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
7. ⏸ scale:2 render-time benchmark measured on the Phase 14 baseline clip and recorded (D-02) — **PENDING checkpoint**; skeleton at `uat/14-UAT.md`.
8. ⏸ A/V parity verified: ffprobe duration delta between remotion-renderer output and quality-finalizer output is within ±33ms; `color_space=bt709` verified on final output (D-10, D-11) — **PENDING checkpoint**.
9. ✅ Synchronous /process path tolerates a scale:2 render: `DEFAULT_TIMEOUT_MS` in process.ts (line 80) and `PROCESS_TIMEOUT_MS` in docker-compose.yml api-server service (line 226) are both `10800000` (3 hours).

7 of 9 truths fully verified; 2 of 9 (the benchmark measurement + the A/V parity assertions) are blocked on the human-run checkpoint and will be confirmed by the continuation agent.

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

## Authentication Gates

None encountered.

## Known Stubs

None — every wire end-to-end. The benchmark numbers in `uat/14-UAT.md` are explicitly marked `pending` rather than fabricated placeholders, and the file documents the exact commands to run.

## Benchmark Results (PENDING — checkpoint)

The continuation agent populates this section after the human reports the `approved` signal with values. Expected fields:

- scale:2 wall-clock time (target: any value ≤ 3 h ceiling)
- scale:1 baseline time (reference, comparable to Phase 13 UAT)
- remotion-renderer output: 2160 × 3840
- quality-finalizer output: 1080 × 1920
- color_space / color_primaries / color_transfer: all `bt709`
- duration delta: ≤ 33 ms
- subjective sharpness: subtitle text visibly crisper than `.planning/phases/13-encode-quality/uat/baseline.mp4`

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

## Self-Check: PASSED (Task 1) / PENDING (Task 2 checkpoint)

---

*Phase: 14-remotion-supersampling-quality-finalizer*
*Plan 14-03 — Wave 2*
*Partial completion: 2026-05-21 — awaiting Task 2 benchmark checkpoint*
