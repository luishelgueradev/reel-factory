---
phase: 14-remotion-supersampling-quality-finalizer
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - services/remotion-renderer/src/render.ts
  - services/quality-finalizer/Dockerfile
  - services/quality-finalizer/requirements.txt
  - services/quality-finalizer/main.py
  - services/quality-finalizer/src/config.py
  - services/quality-finalizer/src/schema.py
  - services/quality-finalizer/src/downscale.py
  - services/quality-finalizer/src/validate.py
  - services/quality-finalizer/tests/test_downscale.py
  - services/api-server/src/orchestrator.ts
  - services/api-server/src/routes/process.ts
  - docker-compose.yml
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 14 adds env-var-driven Remotion render quality knobs, a 3-hour render
timeout, and a new `quality-finalizer` container that probe-gates a Lanczos
downscale of supersampled 2160×3840 output back to 1080×1920. The subprocess
usage is sound from a security standpoint — all ffmpeg/ffprobe calls use
list-argv (no `shell=True`), so the documented command-injection concern via
`INPUT_PATH`/`OUTPUT_PATH` env vars does not materialize. No critical issues.

The dominant theme of the findings is a **gap between claimed and actual
behavior**: the phase advertises RENDER-03 output validation and BT.709
carry-through, but the validators are never invoked and the color-tag metadata
in `downscale-info.json` is hardcoded rather than measured — so the stream-copy
path can report `bt709` for a file that carries no such tags. There are also
several robustness gaps (hardcoded scale dimensions diverging from config,
unread override env constants, an aspect-distortion edge case) and a couple of
quality issues.

## Warnings

### WR-01: `validate.py` validators are never invoked — RENDER-03 output validation does not run

**File:** `services/quality-finalizer/src/validate.py:18-192`, `services/quality-finalizer/main.py:74-107`
**Issue:** `validate_color_tags`, `validate_duration_parity`, and
`validate_dimensions` are fully implemented and documented as the "RENDER-03
checks on the downscaled MP4," but `main.py` never imports or calls any of
them. After `apply_downscale` returns, `main.py` writes `downscale-info.json`
and the manifest and exits `success` without verifying output dimensions,
duration parity, or color tags. The entire `validate.py` module is dead code in
this phase, and the step will report `success` even if ffmpeg produced a wrong
size, dropped audio, or lost color tags. This is the most consequential defect:
the claimed quality gate does not exist at runtime.
**Fix:** In `main.py`, after `apply_downscale`, run the validators and fail the
step on errors:
```python
from src.validate import validate_color_tags, validate_duration_parity, validate_dimensions

errors = (
    validate_dimensions(output_path)
    + validate_duration_parity(input_path, output_path)
    + validate_color_tags(output_path)
)
if errors:
    raise RuntimeError("RENDER-03 validation failed: " + "; ".join(errors))
```
If validation is intentionally deferred, remove `validate.py` so it is not
mistaken for an active gate, and note the deferral in the phase summary.

**Orchestrator verification note (2026-05-22, pessimistic re-check):** Confirmed
that `main.py` does not import or call the validators — the finding is factually
accurate. However, the severity framing ("the most consequential defect", "the
claimed quality gate does not exist") overstates it relative to project context:
this is a **pre-existing project-wide convention, not a Phase 14 regression**.
`grep` across all services shows that `ffmpeg-finalizer`, `silence-cutter`, and
`whisper` ALL ship a `src/validate.py` whose validators are invoked **only by the
test suites** (`tests/test_*.py`), never inline in their `main.py` runtime path.
`quality-finalizer` faithfully replicated this established pattern. The 14-02
`must_haves` only required that `validate.py` *exposes* the three functions
(line 31: "validate.py exposes ... functions") — which is met — not that `main.py`
call them. The validators ARE exercised (by `tests/test_downscale.py` and the
ported parity/color tests). **Conclusion:** valid architectural observation worth
acting on project-wide (runtime quality gates would be a real improvement over
test-only validation), but NOT a Phase-14-blocking defect and NOT unique to this
phase. Tracked for a cross-cutting follow-up rather than a phase-14 fix.

### WR-02: `downscale-info.json` color tags are hardcoded, not measured — stream-copy path can lie

**File:** `services/quality-finalizer/src/downscale.py:130-163`
**Issue:** Both branches return `color_space/color_primaries/color_transfer =
"bt709"` unconditionally. On the Lanczos path this is plausibly correct (the
flags are passed, modulo the known H.264 persistence caveat). On the
stream-copy path, `ffmpeg -c copy` carries through *whatever the input had* —
the code does not probe the input or output color tags, yet still writes
`bt709` into `downscale-info.json`. If an input arrives without BT.709 tags
(e.g. a future scale=1 render that doesn't set `colorSpace`, or a manual rerun
on an arbitrary MP4), the metadata file asserts a color space that was never
verified. Downstream consumers reading `downscale-info.json` will trust a false
value. The module docstring even claims these "report correctly," but nothing
reads them back.
**Fix:** Probe the actual output for color tags and populate the dict from the
real values (or reuse `validate_color_tags` and surface the measured tags),
instead of hardcoding `"bt709"`. At minimum, on the stream-copy path read the
tags from the output via ffprobe rather than asserting them.

### WR-03: Scale filter hardcodes `1080:1920` while the probe gate uses `config.TARGET_WIDTH/HEIGHT`

**File:** `services/quality-finalizer/src/downscale.py:103`
**Issue:** The probe gate (`needs_downscale`) and the returned
`output_width/output_height` are driven by `config.TARGET_WIDTH` /
`config.TARGET_HEIGHT`, but the actual ffmpeg scale filter is the literal string
`"scale=1080:1920:flags=lanczos,setsar=1"`. If anyone changes the config
constants (the file explicitly invites a runtime override mindset by defining
`H264_CRF_ENV`/`H264_PRESET_ENV`), the gate will trigger on the new target while
the encode still hard-scales to 1080×1920 — the reported `output_width`/
`output_height` would then disagree with the real output. The two sources of
truth must not diverge.
**Fix:** Build the filter from config:
```python
filter_chain = f"scale={config.TARGET_WIDTH}:{config.TARGET_HEIGHT}:flags=lanczos,setsar=1"
```

### WR-04: Lanczos path force-scales to a fixed aspect ratio — distorts non-9:16 inputs

**File:** `services/quality-finalizer/src/downscale.py:75,103`
**Issue:** `needs_downscale` returns True when *either* dimension exceeds target
(OR semantics, with `test_needs_downscale_partial_larger` codifying it for a
2160×1920 input). On that branch the filter unconditionally forces output to
`1080:1920`, which would non-uniformly stretch any input whose aspect ratio is
not exactly 9:16 (e.g. 2160×1920 → squashed to 1080×1920). In the current
pipeline the supersampled source is always 2160×3840 so this stays latent, but
the code plus its own test assert support for the partial-larger case while
silently distorting it. A scale that exceeds the target in only one axis is a
logic inconsistency between the gate and the encode.
**Fix:** Either (a) constrain the gate to the exact supersample case
(`width == 2*TARGET_WIDTH and height == 2*TARGET_HEIGHT`) and treat anything
else as an error, or (b) preserve aspect ratio with
`scale=...:force_original_aspect_ratio=decrease` plus pad/crop, and update the
test to reflect the real intended behavior.

### WR-05: Single 3h timeout covers the entire pipeline, but the render alone can consume all of it

**File:** `services/api-server/src/routes/process.ts:80,119,141`, `services/remotion-renderer/src/render.ts:336`
**Issue:** `render.ts` sets `timeoutInMilliseconds: 10_800_000` (3h) for the
Remotion render step, and `/process` sets the *whole-pipeline* timeout to the
same 10,800,000 ms. These are not additive budgets: if a scale=2 render runs
near its own 3h ceiling, the pipeline-level race in `process.ts` can fire at
essentially the same moment, leaving zero headroom for whisper,
silence-cutter, ffmpeg-finalizer, quality-finalizer, and srt-exporter. The
comment claims the values "match," but matching them means the non-render steps
have no time allowance. Additionally, as the code comment in `process.ts:130`
notes, losing the race does **not** cancel the underlying containers — they keep
running and consuming resources after the HTTP 408 is returned.
**Fix:** Make the pipeline timeout strictly greater than the render timeout
(e.g. render 3h + a margin for the other steps), and on timeout, stop/remove the
in-flight container so it does not orphan. At minimum, document that the
pipeline budget must exceed the sum of step ceilings.

### WR-06: `_write_manifest` default-argument and manifest-dir fallback can mask the real failure location

**File:** `services/quality-finalizer/main.py:126-164`
**Issue:** `_write_manifest` uses `error_message: str = None` (should be
`Optional[str]`), and on the error path computes `manifest_dir` from
`os.environ.get("OUTPUT_PATH", "/tmp")`. If `OUTPUT_PATH` is unset the manifest
silently lands in `/tmp/manifest.json` — but the orchestrator
(`orchestrator.ts:269`) reads the manifest from
`{pipelineDir}/{jobId}/quality-finalizer/manifest.json`, so a manifest written
to `/tmp` is never read and the failure surfaces only as the generic non-zero
exit. Since `main.py` already `sys.exit(1)`s when `OUTPUT_PATH` is missing, the
`/tmp` fallback is unreachable in practice, but it is a latent
wrong-location-on-error hazard if the validation order ever changes.
**Fix:** Annotate `error_message: Optional[str] = None`, and have
`_write_manifest` take an explicit `output_dir` argument (already computed in
`main()` as `output_dir`) rather than re-deriving it from the environment, so
the manifest is always written where the orchestrator looks for it.

## Info

### IN-01: `DOWNSCALE_CRF` / `DOWNSCALE_PRESET` env constants are defined but never read

**File:** `services/quality-finalizer/src/config.py:25-33`
**Issue:** `H264_CRF_ENV = "DOWNSCALE_CRF"` and `H264_PRESET_ENV =
"DOWNSCALE_PRESET"` are declared, with comments acknowledging "no override loop
in main.py per D-06." They are never referenced anywhere — dead constants that
imply a runtime override capability that does not exist, which is misleading
given D-06 explicitly says the finalizer has no override loop.
**Fix:** Remove the two `*_ENV` constants (and their comments), or implement the
override and read them in `apply_downscale`.

### IN-02: `requirements.txt` pins only `pydantic>=2.0.0` — unbounded and minimal

**File:** `services/quality-finalizer/requirements.txt:1`
**Issue:** The project conventions (AGENTS.md version table) pin
`pydantic==2.13.3`. An unbounded `>=2.0.0` lets a future `pip install` pull a
newer/incompatible pydantic than the rest of the pipeline uses, undermining the
reproducible-build intent.
**Fix:** Pin to the project-standard version: `pydantic==2.13.3`.

### IN-03: `remotionColorSpace` / `remotionX264Preset` / `remotionImageFormat` use unchecked `as` casts on env input

**File:** `services/remotion-renderer/src/render.ts:90-93`
**Issue:** `process.env.REMOTION_X264_PRESET || "medium"` is cast
`as "medium" | "slow" | "fast"` and `REMOTION_COLOR_SPACE` `as "bt709"`, with no
runtime validation. An invalid env value (e.g. `REMOTION_X264_PRESET=ultrafst`)
is passed straight to `renderMedia`, which will fail deep inside Remotion with a
less obvious error rather than being rejected up front. `remotionScale`/`Crf`/
`JpegQuality` also accept `NaN` from `parseFloat`/`parseInt` on garbage input
without a guard (contrast with the `FONT_SIZE` NaN guard at line 288).
**Fix:** Validate each parsed env value against an allowlist / numeric-range
check and fall back to the default with a warning, mirroring the existing
`Number.isNaN(envFontSize)` guard.

### IN-04: `process.ts` JSDoc still lists the old 5-step pipeline (missing quality-finalizer)

**File:** `services/api-server/src/routes/process.ts:87-88`
**Issue:** The endpoint doc comment reads "whisper → silence-cutter →
ffmpeg-finalizer → remotion-renderer → srt-exporter" — quality-finalizer is
absent. `orchestrator.ts:53` was updated to the 6-step order but the JSDoc here
was not, and the `runPipeline` JSDoc (`orchestrator.ts:185`) still says "all 5
Docker containers." Stale docs about pipeline composition.
**Fix:** Update both comments to the current 6-step order including
quality-finalizer.

### IN-05: `getVideoDimensions` silently falls back to 1080×1920 / 10s on probe miss

**File:** `services/remotion-renderer/src/render.ts:29-31`
**Issue:** When the ffprobe stream/format fields are absent, width/height
default to 1080/1920 and duration to 10s. This is pre-existing behavior, but
combined with the Phase 14 scale=2 path it means a probe miss yields a render at
assumed dimensions/duration with no warning logged — a 10s clip if duration
parsing fails. Not new to this phase, noted for awareness.
**Fix:** Log a warning when falling back to defaults so a probe miss is visible
in the step logs rather than silently producing a wrong-length render.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
