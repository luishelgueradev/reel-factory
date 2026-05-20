---
phase: 13-encode-quality
plan: 02
subsystem: ffmpeg-finalizer
tags: [encode-quality, crf, lanczos, unsharp, bt709, ffprobe, validation]
dependency_graph:
  requires: []
  provides: [CRF-18-constant, lanczos-filter, unsharp-filter, bt709-metadata-tags, validate_color_tags, validate_bitrate_range, validate_duration_parity]
  affects: [ffmpeg-finalizer/src/config.py, ffmpeg-finalizer/src/crop.py, ffmpeg-finalizer/src/validate.py, ffmpeg-finalizer/tests/test_finalizer.py]
tech_stack:
  added: []
  patterns: [ffprobe-json-parsing, validator-error-string-convention, phase-decision-traceability-comments]
key_files:
  created: []
  modified:
    - services/ffmpeg-finalizer/src/config.py
    - services/ffmpeg-finalizer/src/crop.py
    - services/ffmpeg-finalizer/src/validate.py
    - services/ffmpeg-finalizer/tests/test_finalizer.py
decisions:
  - D-03: H264_CRF=18 (was 20); Phase 4 D-08 superseded by Phase 13 ENC-02; hardcoded constant, no env-var surface
  - D-04: H264_PRESET=medium preserved unchanged (Phase 4 D-04 invariant)
  - D-05/D-06: unsharp=5:5:0.5:5:5:0.3 applied unconditionally after setsar=1 in both filter-chain branches
  - D-08: flags=lanczos on every scale= invocation in both branches (Lanczos vs bicubic ~+10% VMAF on downscale)
  - D-09: BT.709 metadata tags only (not the colorspace filter) — source already YUV from silence-cutter
  - D-13: no-audio (-an) branch inherits all changes via shared cmd/filter_chain — not duplicated
metrics:
  duration: ~5m
  completed_date: "2026-05-20"
  tasks_completed: 3
  files_modified: 4
---

# Phase 13 Plan 02: Encode Quality Core Changes Summary

CRF 20→18, Lanczos+unsharp filter chain, BT.709 metadata tags on ffmpeg-finalizer, plus three new ffprobe validators and exhaustive CRF-18 fixture sweep in test_finalizer.py — suite exits GREEN with 23 tests passed.

## Tasks Completed

### Task 1: Drop H264_CRF 20 → 18 in config.py (ENC-02, D-03) — commit d22aa35

**File:** `services/ffmpeg-finalizer/src/config.py`

Before (lines 24-26):
```python
# D-08: H.264 CRF 20 for quality/filesize balance.
# Good visual quality for 1080x1920 talking-head social content without excessive file sizes.
H264_CRF = 20
```

After (lines 24-29):
```python
# Phase 4 D-08 (superseded by Phase 13 D-03 / ENC-02): H.264 CRF tuned down
# from 20 → 18. Lands in the 5,000–8,000 kbps target band for a 60s
# talking-head fixture, eliminating bloating without slowing the medium
# preset perceptibly. CRF 17 considered and rejected — marginal gain
# given Remotion re-encodes downstream in Phase 14.
H264_CRF = 18
```

`H264_PRESET = "medium"` unchanged (D-04 invariant preserved). No `H264_CRF_ENV` introduced.

### Task 2: Add Lanczos + unsharp + BT.709 to crop.py (ENC-03, ENC-04) — commit 5e5ef11

**File:** `services/ffmpeg-finalizer/src/crop.py`

**PART A — filter_chain (both branches):**

crop_applied branch (before):
```python
filter_chain = (
    f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
    f"crop={target_width}:{target_height},"
    f"setsar=1"
)
```

crop_applied branch (after):
```python
filter_chain = (
    f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase:flags=lanczos,"
    f"crop={target_width}:{target_height},"
    f"setsar=1,"
    f"unsharp=5:5:0.5:5:5:0.3"
)
```

else branch (before):
```python
filter_chain = f"scale={target_width}:{target_height},setsar=1"
```

else branch (after):
```python
filter_chain = (
    f"scale={target_width}:{target_height}:flags=lanczos,"
    f"setsar=1,"
    f"unsharp=5:5:0.5:5:5:0.3"
)
```

**PART B — cmd list:**

Inserted after `-pix_fmt yuv420p`, before `-r`:
```python
# ENC-03 / D-09: BT.709 metadata tags ONLY (not the colorspace filter)...
"-colorspace", "bt709",
"-color_primaries", "bt709",
"-color_trc", "bt709",
```

**PART D — return dict:**

Added 5 new manifest fields after `"h264_preset"`:
```python
"lanczos_scaling": True,
"unsharp_filter": "5:5:0.5:5:5:0.3",
"color_space": "bt709",
"color_primaries": "bt709",
"color_transfer": "bt709",
```

**PART C — no-audio branch:** NOT touched. Inherits all changes via shared cmd/filter_chain (D-13).

### Task 3: Update validate.py + sweep test_finalizer.py CRF fixtures (ENC-02, ENC-03, ENC-05) — commit 0faad63

**File: `services/ffmpeg-finalizer/src/validate.py`**

- Extended module docstring with ENC-02/ENC-03/ENC-05 references
- Added `import subprocess` and `import json`
- Updated D-08 CRF check: `!= 20` → `!= 18`, error prefix `D-08:` → `ENC-02:`, appended `(D-03)` to error message
- Added `validate_color_tags(output_mp4_path)` — ffprobe `color_space/color_primaries/color_transfer` vs bt709
- Added `validate_bitrate_range(output_mp4_path, min_kbps=5000, max_kbps=8000)` — ffprobe `format.bit_rate` in band
- Added `validate_duration_parity(silence_cutter_output, finalizer_output, tolerance_ms=33)` — ffprobe duration delta

All three validators handle ffprobe failures gracefully (return error string, never raise exception).

**File: `services/ffmpeg-finalizer/tests/test_finalizer.py`**

All 8 CRF fixture occurrences swept 20 → 18:
- Line 54: `valid_finalizer_info_dict` fixture — `"h264_crf": 18`
- Line 82: `no_crop_info_dict` fixture — `"h264_crf": 18`
- Line 211: `test_finalizer_info_with_crop` kwarg — `h264_crf=18`
- Line 234: `test_finalizer_info_without_crop` kwarg — `h264_crf=18`
- Line 268: `test_crop_applied_field_exists` kwarg — `h264_crf=18`
- Line 294: `test_validate_wrong_dimensions` dict — `"h264_crf": 18`
- Line 308: `test_validate_crop_not_center` dict — `"h264_crf": 18`
- Line 322: `test_validate_missing_safe_zone` dict — `"h264_crf": 18`

`TestConfig.test_encoding_params` updated:
- Docstring: `H264_CRF=18 (ENC-02 / D-03), H264_PRESET='medium' (D-04 / Phase 4 D-09 preserved)`
- Assertion: `assert config.H264_CRF == 18  # ENC-02 / D-03`

Module docstring extended with ENC-01..ENC-05 and D-08 (superseded) note.

## Source-Grep Assertion Confirmation

| Assertion | Result |
|-----------|--------|
| `grep -cE '^H264_CRF\s*=\s*18\s*$' config.py` | 1 (PASS) |
| `grep -cE '^H264_CRF\s*=\s*20' config.py` | 0 (PASS) |
| `grep -cE '^H264_PRESET\s*=\s*"medium"\s*$' config.py` | 1 (PASS) |
| `grep -cE '^H264_CRF_ENV' config.py` | 0 (PASS) |
| `grep -cF 'ENC-02' config.py` | 1 (PASS) |
| `grep -cF 'D-03' config.py` | 1 (PASS) |
| `grep -cE 'scale=.*:flags=lanczos' crop.py` | 2 (PASS) |
| `grep -cE 'unsharp=5:5:0\.5:5:5:0\.3' crop.py` | 2 (PASS) |
| `grep -cE '"-colorspace",\s*"bt709"' crop.py` | 1 (PASS) |
| `grep -cE '"-color_primaries",\s*"bt709"' crop.py` | 1 (PASS) |
| `grep -cE '"-color_trc",\s*"bt709"' crop.py` | 1 (PASS) |
| `grep -cE '"colorspace=bt709"' crop.py` | 0 (PASS — no colorspace filter) |
| `grep -cF '"lanczos_scaling": True' crop.py` | 1 (PASS) |
| `grep -cF '"unsharp_filter": "5:5:0.5:5:5:0.3"' crop.py` | 1 (PASS) |
| `grep -cE '"color_space":\s*"bt709"' crop.py` | 1 (PASS) |
| `grep -cE 'def validate_color_tags' validate.py` | 1 (PASS) |
| `grep -cE 'def validate_bitrate_range' validate.py` | 1 (PASS) |
| `grep -cE 'def validate_duration_parity' validate.py` | 1 (PASS) |
| `grep -cE 'info_data\["h264_crf"\]\s*!=\s*18' validate.py` | 1 (PASS) |
| `grep -cE 'info_data\["h264_crf"\]\s*!=\s*20' validate.py` | 0 (PASS) |
| `grep -v '^#' test_finalizer.py \| grep -cE '"h264_crf":\s*18\|h264_crf=18'` | 8 (PASS) |
| `grep -v '^#' test_finalizer.py \| grep -cE '"h264_crf":\s*20\|h264_crf=20'` | 0 (PASS) |
| `grep -cE 'assert\s+config\.H264_CRF\s*==\s*18' test_finalizer.py` | 1 (PASS) |
| `grep -cE 'assert\s+config\.H264_CRF\s*==\s*20' test_finalizer.py` | 0 (PASS) |

## Behavior Confirmations

- `python3 -c "from src import config; assert config.H264_CRF == 18 and config.H264_PRESET == 'medium'"` — exits 0
- `python3 -c "from src.crop import apply_finalizer, probe_video, compute_crop"` — exits 0
- `python3 -c "from src.validate import validate_color_tags, validate_bitrate_range, validate_duration_parity, validate_finalizer_info, validate_crop_logic"` — exits 0
- `pytest tests/test_finalizer.py -x -q` — **23 passed** (GREEN — no half-passing handoff to Plan 03)
- `-an branch` in crop.py: NOT touched, inherits all changes via shared cmd (D-13 verified)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced. The three new validators (`validate_color_tags`, `validate_bitrate_range`, `validate_duration_parity`) follow the same ffprobe subprocess pattern already established by `probe_video` in `crop.py`. ffprobe stderr is captured in error strings only — no network exposure. Consistent with T-13.02-03 (accepted).

## Self-Check: PASSED
