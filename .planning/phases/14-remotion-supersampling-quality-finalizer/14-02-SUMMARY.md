---
phase: 14-remotion-supersampling-quality-finalizer
plan: 02
subsystem: infra
tags: [docker, python, ffmpeg, lanczos, downscale, pydantic, bt709, quality-finalizer, remotion]

# Dependency graph
requires:
  - phase: 13-encode-quality
    provides: ffmpeg-finalizer scaffold pattern (Dockerfile, src/config/schema/validate, main.py)
provides:
  - quality-finalizer Docker container (Python + FFmpeg) — probe-gated Lanczos downscale to 1080x1920
  - DownscaleInfo pydantic schema (downscale-info.json contract)
  - validate_color_tags / validate_duration_parity / validate_dimensions (RENDER-03 validators)
  - probe_video / needs_downscale / apply_downscale logic functions
affects: [14-03 (orchestrator wiring of quality-finalizer step), future phases consuming quality-finalizer output]

# Tech tracking
tech-stack:
  added: []  # No new tech — pydantic, FFmpeg, Python already in stack
  patterns:
    - "Probe-gated idempotency: ffprobe input → branch Lanczos encode vs stream-copy passthrough"
    - "Validator error-prefix convention: errors tagged with originating requirement (RENDER-03:) for traceability"
    - "Sibling-step scaffold cloning: new pipeline step mirrors ffmpeg-finalizer module layout (Dockerfile / src / tests)"

key-files:
  created:
    - services/quality-finalizer/Dockerfile
    - services/quality-finalizer/requirements.txt
    - services/quality-finalizer/main.py
    - services/quality-finalizer/src/__init__.py
    - services/quality-finalizer/src/config.py
    - services/quality-finalizer/src/schema.py
    - services/quality-finalizer/src/downscale.py
    - services/quality-finalizer/src/validate.py
    - services/quality-finalizer/tests/__init__.py
    - services/quality-finalizer/tests/test_downscale.py
  modified: []

key-decisions:
  - "Mirror ffmpeg-finalizer scaffold byte-for-byte (Dockerfile, base image, copy pattern, manifest writer) to keep the pipeline's per-step contract uniform"
  - "Stream-copy passthrough on the already-1080x1920 path (D-08): ffmpeg -c copy emits a bit-identical output, so A/V parity is automatic when the supersampled render is bypassed"
  - "RENDER-03 error prefix on all validators: validators are reused across container and integration tests, so the requirement-tagged prefix is the only way the caller can route errors to the right surface"

patterns-established:
  - "Probe-gated FFmpeg step: ffprobe → boolean gate → Lanczos encode | stream-copy. Any future post-render normalization step (e.g., HDR-to-SDR, frame-rate match) can reuse this idiom."
  - "Validator module per pipeline step: validate_<thing>(path) -> List[str] returning requirement-prefixed errors. Empty list == pass."

requirements-completed:
  - RENDER-03

# Metrics
duration: 5min
completed: 2026-05-21
---

# Phase 14 Plan 02: Quality-Finalizer Container Scaffold Summary

**Probe-gated Lanczos downscale container (1080x1920 deliverable) with BT.709 carry-through, A/V parity validator, and idempotent stream-copy when input is already at target.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-21T21:31:35Z
- **Completed:** 2026-05-21T21:36:21Z
- **Tasks:** 2 (1 scaffold, 1 TDD: RED+GREEN)
- **Files modified:** 10 (all created)

## Accomplishments

- New `services/quality-finalizer/` Docker container, ready to build from `video-pipeline-base-python:latest`, satisfying RENDER-03 (deliverable 1080x1920 normalization step).
- D-08 probe-gated idempotency: input >1080x1920 → Lanczos re-encode; input ==1080x1920 → `ffmpeg -c copy` passthrough.
- D-09 clean downscale: `scale=1080:1920:flags=lanczos,setsar=1` + CRF 18 + `medium` preset + `-c:a copy` + `-movflags +faststart`. **No** sharpening filter (avoids subtitle-text halos after Remotion already burnt subtitles in at 2x density).
- D-11 BT.709 carry-through: `-colorspace bt709 -color_primaries bt709 -color_trc bt709` baked into the encode path; `validate_color_tags` asserts the result.
- D-10 A/V parity: `validate_duration_parity` checks the input→output duration delta is within ±33ms (one frame at 30fps); audio stream-copied bit-identically so the assertion holds by construction on the Lanczos path.
- TDD RED→GREEN cycle on `needs_downscale` with three coverage points (scale=2 input, already-target input, partial-larger-width input).

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold quality-finalizer service directory (Dockerfile, requirements, config, schema)** — `0fcfa81` (feat)
2. **Task 2 — RED: failing tests for needs_downscale probe gate** — `6483f08` (test)
3. **Task 2 — GREEN: implement downscale.py, validate.py, main.py** — `1e34dbe` (feat)

_TDD: RED commit precedes GREEN commit; no REFACTOR commit needed (implementation followed the ffmpeg-finalizer analog closely, no duplication to extract)._

## Files Created/Modified

### Created

- `services/quality-finalizer/Dockerfile` — base image `video-pipeline-base-python:latest`, identical layout to `ffmpeg-finalizer/Dockerfile`.
- `services/quality-finalizer/requirements.txt` — `pydantic>=2.0.0` (single dep; FFmpeg ships in the base image).
- `services/quality-finalizer/main.py` — entry point: reads `INPUT_PATH`/`OUTPUT_PATH`/`PIPELINE_JOB_ID`; probes input; branches on `needs_downscale`; writes `downscale-info.json` and `manifest.json` with `step_name="quality-finalizer"`. Error path writes an error manifest before `sys.exit(1)`.
- `services/quality-finalizer/src/__init__.py` — empty package marker (matches `ffmpeg-finalizer/src/__init__.py`).
- `services/quality-finalizer/src/config.py` — `STEP_NAME`, `TARGET_WIDTH=1080`, `TARGET_HEIGHT=1920`, `H264_CRF=18`, `H264_PRESET="medium"` with D-XX traceability comments.
- `services/quality-finalizer/src/schema.py` — `DownscaleInfo` pydantic model (input/output dimensions, `downscale_applied` bool, H264 params, BT.709 color tags).
- `services/quality-finalizer/src/downscale.py` — `probe_video`, `needs_downscale` (D-08 probe gate), `apply_downscale` (Lanczos encode + stream-copy paths). Subprocess argv built as a Python list — never `shell=True` (T-14-02-01 mitigation).
- `services/quality-finalizer/src/validate.py` — `validate_color_tags` (BT.709, D-11), `validate_duration_parity` (±33ms default tolerance, D-10), `validate_dimensions` (1080x1920, D-08). Errors prefixed `RENDER-03:`.
- `services/quality-finalizer/tests/__init__.py` — empty package marker.
- `services/quality-finalizer/tests/test_downscale.py` — three unit tests against `needs_downscale` (2160x3840 → True, 1080x1920 → False, 2160x1920 → True). No ffmpeg/ffprobe invocations; mock probe-info dicts only.

## Decisions Made

- **TDD scope limited to `needs_downscale`** (per plan §behavior). The probe gate is the only pure function in `downscale.py`; `probe_video` and `apply_downscale` are I/O-bound (require real video files and ffmpeg/ffprobe), so they are out of scope for unit tests and will be exercised by the Plan 14-03 integration smoke test.
- **Comment wording chosen to satisfy the verification grep on the same file** — D-09 documentation in `downscale.py` uses "No sharpening filter" rather than the word that would false-positive `grep "unsharp" downscale.py`. The intent is identical and the literal `done` criterion is honored. See Deviations §1.
- **Idempotent stream-copy via `ffmpeg -c copy`** rather than `cp` or hardlink: keeps the step's contract uniform (every step writes a fresh MP4 + manifest under its own output dir) and lets future runs rely on `+faststart` being present even on the no-op path (Lanczos encode writes faststart explicitly; stream-copy preserves whatever the input had). The orchestrator sets `REMOTION_SCALE=2` in Plan 14-03, so the stream-copy path will be rare but must remain correct when a user runs the renderer directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded docstring/comment to satisfy literal-grep verification gates**

- **Found during:** Task 2 (after writing the implementation, running the plan's `done` block)
- **Issue:** The plan's done criteria for Task 2 include `grep "unsharp" services/quality-finalizer/src/downscale.py returns no matches` and the threat-model verification `grep "shell=True" services/quality-finalizer/src/downscale.py` (no matches). My initial `downscale.py` docstring/comments referenced both terms to document *what the file does not do* ("NO unsharp filter — Remotion already rendered crisp subtitles at 2x density…", "subprocess.run with a list argv (never shell=True)"). These are pure documentation but the literal grep gates fail on word-level matches.
- **Fix:** Reworded the two comments to "No sharpening filter" and "no shell interpolation" — same rationale, no false-positive matches.
- **Files modified:** `services/quality-finalizer/src/downscale.py`
- **Verification:** Re-ran the full plan §verification block; all six checks pass (pytest 3 passed; `grep unsharp` no matches; `grep "shell=True"` no matches; `grep lanczos` 6 matches; `STEP_NAME` import OK; `validate_dimensions` import OK).
- **Committed in:** `1e34dbe` (Task 2 GREEN commit — the corrected file was the first version committed)

---

**Total deviations:** 1 auto-fixed (1 blocking — false-positive grep gates on documentation text)
**Impact on plan:** Cosmetic only. The deviation does not change behavior, files, or contracts. The rewording preserves the rationale (sharpening is forbidden by D-09; injection prevention by argv-list) while making the literal grep checks pass.

## Issues Encountered

None. The ffmpeg-finalizer scaffold is a near-perfect analog and the plan's pattern map left no ambiguity. The two grep false-positives surfaced and were resolved in under a minute.

## User Setup Required

None — no external service configuration required. The Dockerfile depends on `video-pipeline-base-python:latest`, which the base-python service produces; that image is already part of the build graph from Phase 11.

## Self-Check

Verified each claimed deliverable:

- `services/quality-finalizer/Dockerfile` — FOUND
- `services/quality-finalizer/requirements.txt` — FOUND
- `services/quality-finalizer/main.py` — FOUND
- `services/quality-finalizer/src/__init__.py` — FOUND
- `services/quality-finalizer/src/config.py` — FOUND
- `services/quality-finalizer/src/schema.py` — FOUND
- `services/quality-finalizer/src/downscale.py` — FOUND
- `services/quality-finalizer/src/validate.py` — FOUND
- `services/quality-finalizer/tests/__init__.py` — FOUND
- `services/quality-finalizer/tests/test_downscale.py` — FOUND
- Commit `0fcfa81` — FOUND (Task 1: scaffold)
- Commit `6483f08` — FOUND (Task 2 RED: failing tests)
- Commit `1e34dbe` — FOUND (Task 2 GREEN: implementation)

## Self-Check: PASSED

## TDD Gate Compliance

- RED gate (test commit): `6483f08` — `test(14-02): add failing tests for needs_downscale probe gate (RED)`
- GREEN gate (feat commit after RED): `1e34dbe` — `feat(14-02): implement probe-gated Lanczos downscale, validators, and main entry (GREEN)`
- REFACTOR gate: not applicable (no duplication to extract; implementation closely follows the ffmpeg-finalizer analog and is single-purpose).

Gate order verified in `git log` order: RED commit precedes GREEN commit.

## Next Phase Readiness

- The container directory is buildable in isolation. Plan 14-03 will: (a) add the `quality-finalizer` build target to docker-compose / build scripts; (b) insert a `quality-finalizer` step entry in `services/api-server/src/orchestrator.ts` after `remotion-renderer`; (c) repoint the `videoUrl` artifact path to `/artifacts/${jobId}/quality-finalizer/output.mp4`; (d) update `STEP_NAMES` in `services/shared/constants.ts` with the new step name; (e) flip `REMOTION_SCALE` to `"2"` and `REMOTION_IMAGE_FORMAT` to `"png"` on the `remotion-renderer` env block so the supersampled output reaches this finalizer.
- No blockers for Plan 14-03. The probe gate (D-08) means Plan 14-03 can safely roll out `REMOTION_SCALE=2` without breaking previously-rendered (1080x1920 direct) outputs.

---
*Phase: 14-remotion-supersampling-quality-finalizer*
*Completed: 2026-05-21*
