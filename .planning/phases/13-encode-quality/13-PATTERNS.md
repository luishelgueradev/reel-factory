# Phase 13: Encode Quality - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 5 source files (modified) + 2 test modules + 1 UAT artifact directory (new)
**Analogs found:** 7 / 7 (every Phase 13 touchpoint has direct in-repo precedent)

## File Classification

All Phase 13 touchpoints are *modifications* to existing files — no new modules are created in `src/`. The only new artifacts land in `.planning/phases/13-encode-quality/uat/` and (optionally) `tests/`.

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `services/silence-cutter/src/cut_video.py` (`_concatenate_segments`) | service / FFmpeg subprocess wrapper | file-I/O (subprocess + filesystem) | `_extract_segments` in same file (lines 129–179) | **exact** (sibling function, same module, same `-c copy` target) |
| `services/silence-cutter/src/validate.py` | utility / data assertion | transform (dict → list[str]) | Same file's existing `validate_silence_cuts` (lines 11–111) | **exact** (extend in place) |
| `services/ffmpeg-finalizer/src/config.py` (`H264_CRF`) | config / constants | n/a (module-level constants) | Same file's existing `H264_CRF`/`H264_PRESET`/`LOUDNORM_*` block (lines 24–50) | **exact** (single-line constant change, Phase 4 D-XX comment convention) |
| `services/ffmpeg-finalizer/src/crop.py` (`apply_finalizer` filter chain + encode flags) | service / FFmpeg subprocess wrapper | file-I/O (subprocess + filesystem) | Same file's existing filter-chain branches (lines 126–166) | **exact** (mutate in-place, two conditional branches already exist) |
| `services/ffmpeg-finalizer/src/validate.py` | utility / data assertion | transform (dict → list[str]) | Same file's existing `validate_finalizer_info` (lines 11–101) + new ffprobe pattern from `crop.py::probe_video` lines 35–71 | **exact** (extend in place; ffprobe call pattern already in `probe_video`) |
| `services/ffmpeg-finalizer/tests/test_finalizer.py` (test extensions) | test | request-response (pytest fixtures + asserts) | Same file's `TestConfig` class (lines 98–121) + `TestValidation` class (lines 279–376) | **exact** (extend test classes; D-XX traceability docstring already present) |
| `.planning/phases/13-encode-quality/uat/` (new visual A/B artifacts) | docs / human-review artifact | n/a | `.planning/phases/12-subtitle-preview-lab/12-UAT.md` + `.planning/phases/04-9-16-vertical-output/04-UAT.md` | **role-match** (UAT.md exists; the `uat/` subdirectory with MP4 fixtures is new but follows the `phases/<padded>/...` convention) |

## Pattern Assignments

### `services/silence-cutter/src/cut_video.py` — `_concatenate_segments` (lines 200–237)

**Analog:** sibling function `_extract_segments` in the same file (lines 129–179). Stream-copy is already in the project for the *extraction* half of the cut/concat pipeline; Phase 13 extends the same convention to the concat half. The change is mechanical: two `-c:v libx264`/`-c:a aac` args become `-c copy`.

**Current state — what to replace** (`services/silence-cutter/src/cut_video.py:214-226`):
```python
cmd = [
    "ffmpeg",
    "-y",                                    # Overwrite output
    "-f", "concat",                          # Concat demuxer
    "-safe", "0",                             # Allow absolute paths in concat list
    "-i", concat_list_path,                   # Input from concat list
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-c:v", "libx264",                        # Re-encode video for clean timestamps
    "-c:a", "aac",                            # Re-encode audio for clean timestamps
    "-reset_timestamps", "1",                 # Reset timestamps at each segment (SILC-03)
    output_path
]
```

**Pattern to follow — `_extract_segments` already does stream copy** (note: `_extract_segments`'s current code at lines 152–162 still re-encodes per-segment for frame-accurate `-ss`/`-t` cuts; that is correct and **stays unchanged** — see the docstring at lines 17–19 of `cut_video.py`). The *stream-copy convention* lives in the module-level docstring (line 17: *"Note: extraction re-encodes... so that `-ss`/`-t` cuts are frame-accurate; stream copy would snap to keyframes and misplace cut boundaries."*) — confirming the project understands `-c copy` semantics. Phase 13's concat-side `-c copy` is safe because concat operates on whole pre-cut segment files, not on byte offsets.

**Target shape after Phase 13 (ENC-01, D-01, D-02):**
```python
cmd = [
    "ffmpeg",
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concat_list_path,
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-c", "copy",                             # ENC-01 / D-01: stream-copy eliminates one full lossy H.264 pass
    "-reset_timestamps", "1",                 # SILC-03 invariant preserved (D-02 comment)
    output_path
]
```

**Docstring/comment update pattern (D-02)** — match Phase 4's D-XX trailing comment style already used on line 224 of the existing `cmd`. Add a sentence to the `_concatenate_segments` docstring (currently lines 201–213) noting that concatenation no longer re-encodes — generation loss is eliminated here and the finalizer becomes the only pre-Remotion lossy encode.

**Error handling — preserve as-is** (`services/silence-cutter/src/cut_video.py:230-237`):
```python
result = subprocess.run(
    cmd, capture_output=True, text=True, timeout=300
)
if result.returncode != 0:
    raise RuntimeError(
        f"FFmpeg concatenation failed: {result.stderr}"
    )
```
This try/`returncode`/`RuntimeError` pattern is reused verbatim by every FFmpeg subprocess call in both services (see `_extract_segments` lines 167–174, `apply_finalizer` lines 174–176, `probe_video` lines 44–46). No change needed.

---

### `services/silence-cutter/src/validate.py` — extend with concat-mode assertion

**Analog:** the existing `validate_silence_cuts` function in the same file (lines 11–111). Same input/output contract (dict in, `List[str]` out), same SILC-XX/D-XX referencing in error strings (see lines 24–25, 36, 95–98).

**Imports pattern** (`services/silence-cutter/src/validate.py:1-8`):
```python
"""Silence-cuts validation — checks output against SILC requirements and D-XX decisions.

Per the whisper/validate.py pattern: validate functions return a list of
error strings referencing specific requirement IDs (SILC-XX) and decision
IDs (D-XX) for traceability.
"""

from typing import List
```
Reuse this header convention. Phase 13 extends it to also reference ENC-XX IDs.

**Error-string format pattern** (`services/silence-cutter/src/validate.py:24-25`, `94-98`):
```python
errors.append("SILC-04: Missing 'cuts' field in silence-cuts.json")
...
errors.append(
    f"SILC-04: total_silence_removed ({reported}) doesn't match "
    f"sum of cut durations ({total_from_cuts:.4f})"
)
```
Every error string begins with the requirement/decision ID for grep-ability. Phase 13's new validator should follow: `"ENC-01: ..."` or `"D-01: ..."` as the prefix.

**New validator signature (suggested by the planner)** — modeled on `validate_cross_reference_logic` (lines 114–148) which takes raw inputs (not a parsed JSON):
```python
def validate_concat_mode(concat_output_path: str) -> List[str]:
    """Validate that silence-cutter concat output was produced via stream-copy (ENC-01).

    Uses ffprobe to confirm no new encode timestamp was introduced at concat —
    a re-encode would write a fresh `encoder` tag and bump format-level metadata.
    """
    errors: List[str] = []
    # ... ffprobe + assert encoder tag absent / format flags show stream copy
    return errors
```
The ffprobe invocation should mirror `cut_video.py::get_video_duration` (lines 240–273) for the subprocess call pattern, and `crop.py::probe_video` (lines 35–71) for the JSON-parsing pattern (`ffprobe -of json` → `json.loads(result.stdout)`).

---

### `services/ffmpeg-finalizer/src/config.py` — `H264_CRF` constant change (ENC-02, D-03)

**Analog:** the same file's existing constant block, lines 24–50. The Phase 4 D-XX traceability convention is already established and must be preserved.

**Current state — line 24–26 to replace:**
```python
# D-08: H.264 CRF 20 for quality/filesize balance.
# Good visual quality for 1080x1920 talking-head social content without excessive file sizes.
H264_CRF = 20
```

**Pattern to copy — the constant + leading D-XX comment style** is used throughout the file (lines 7–9 for `VERTICAL_WIDTH`, lines 28–30 for `H264_PRESET`, lines 41–50 for the loudnorm block). Phase 13 keeps the comment-then-constant shape and **adds a Phase 13 D-XX reference** alongside the original Phase 4 D-08 reference:

**Target shape after Phase 13 (ENC-02, D-03):**
```python
# Phase 4 D-08 (superseded by Phase 13 D-03 / ENC-02): H.264 CRF tuned down
# from 20 → 18. Lands in the 5,000–8,000 kbps target band for a 60s
# talking-head fixture, eliminating bloating without slowing the medium
# preset perceptibly. CRF 17 considered and rejected — marginal gain
# given Remotion re-encodes downstream in Phase 14.
H264_CRF = 18
```

**Convention: no env-var exposure.** Lines 15–16 (`VERTICAL_WIDTH_ENV`) and line 22 (`CROP_STRATEGY_ENV`) document env-var names *as constants* but `H264_CRF` deliberately has **no `_ENV` counterpart** in the existing file — confirming the Phase 4 "constants over env vars" convention that Phase 13 CONTEXT.md D-03 explicitly preserves. Do not introduce `H264_CRF_ENV`.

**`H264_PRESET = "medium"` stays untouched** (line 30, D-09 — explicitly preserved per Phase 13 D-04).

---

### `services/ffmpeg-finalizer/src/crop.py` — filter chain + encode flags (ENC-03, ENC-04, D-05..D-09)

**Analog:** the same file's `apply_finalizer` function (lines 107–202). Both filter-chain branches and the encode-flag list already exist — Phase 13 is a strict in-place extension.

**Current filter-chain branches** (`services/ffmpeg-finalizer/src/crop.py:126-135`):
```python
if crop_applied:
    # Input is not 9:16 — apply full scale+crop filter chain
    filter_chain = (
        f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
        f"crop={target_width}:{target_height},"
        f"setsar=1"
    )
else:
    # D-03: Input is already 9:16 — scale only, no crop
    filter_chain = f"scale={target_width}:{target_height},setsar=1"
```

**Target shape after Phase 13 (ENC-04, D-05, D-06, D-08)** — add `:flags=lanczos` to **every** `scale=` and append `,unsharp=5:5:0.5:5:5:0.3` **after** `setsar=1` in **both** branches:
```python
if crop_applied:
    # Input is not 9:16 — apply full scale+crop filter chain
    # ENC-04 / D-08: Lanczos scaling (~+10% VMAF vs default bicubic on downscale)
    # ENC-04 / D-05, D-06: mild unsharp after scale+crop, before encode — sharpens
    #   the final 1080×1920 pixels and minimizes halo risk on subtitle text
    #   (subtitles are burned downstream in Remotion, so unsharp runs first).
    filter_chain = (
        f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase:flags=lanczos,"
        f"crop={target_width}:{target_height},"
        f"setsar=1,"
        f"unsharp=5:5:0.5:5:5:0.3"
    )
else:
    # D-03: Input is already 9:16 — scale only, no crop
    # ENC-04 / D-08, D-13: Lanczos + mild unsharp applied unconditionally
    #   (no-audio `-an` branch also inherits these — see D-13).
    filter_chain = (
        f"scale={target_width}:{target_height}:flags=lanczos,"
        f"setsar=1,"
        f"unsharp=5:5:0.5:5:5:0.3"
    )
```

**Current encode-flags block** (`services/ffmpeg-finalizer/src/crop.py:137-150`):
```python
cmd = [
    "ffmpeg", "-y",
    "-i", input_path,
    "-vf", filter_chain,
    "-c:v", "libx264",
    "-crf", str(config.H264_CRF),
    "-preset", config.H264_PRESET,
    "-profile:v", config.H264_PROFILE,
    "-pix_fmt", "yuv420p",
    "-r", str(config.FPS_OUTPUT),
    "-movflags", "+faststart",
    "-map_metadata", "-1",
    "-map", "0:v:0",
]
```

**Target shape after Phase 13 (ENC-03, D-09)** — insert BT.709 metadata flags **after** `-pix_fmt yuv420p`, **before** `-r`:
```python
cmd = [
    "ffmpeg", "-y",
    "-i", input_path,
    "-vf", filter_chain,
    "-c:v", "libx264",
    "-crf", str(config.H264_CRF),
    "-preset", config.H264_PRESET,
    "-profile:v", config.H264_PROFILE,
    "-pix_fmt", "yuv420p",
    # ENC-03 / D-09: BT.709 metadata tags ONLY (not the colorspace filter).
    # Source frames are already YUV from silence-cutter; metadata tagging is
    # the safe fix for the "Instagram lavado de color" symptom. PITFALLS.md A-6
    # documents why the colorspace filter would re-interpret luminance and
    # cause a global brightness/saturation shift.
    "-colorspace", "bt709",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-r", str(config.FPS_OUTPUT),
    "-movflags", "+faststart",
    "-map_metadata", "-1",
    "-map", "0:v:0",
]
```

**No-audio branch inheritance (D-13)** — the `-an` branch at lines 163–164 does NOT re-emit the cmd, it only `.extend`s/`.append`s. The Lanczos + unsharp filter changes and BT.709 tags are already inside the shared `cmd` list, so the no-audio path inherits them automatically. **Do not duplicate logic in the `-an` branch.**

**Return-dict tracing pattern** (`services/ffmpeg-finalizer/src/crop.py:180-202`) — the `apply_finalizer` return dict already records `h264_crf` (line 193) and `h264_preset` (line 194), which feeds the validator's D-08 check. Phase 13 may add new fields like `"color_space": "bt709"`, `"color_primaries": "bt709"`, `"color_transfer": "bt709"`, `"lanczos_scaling": True`, `"unsharp_filter": "5:5:0.5:5:5:0.3"` so the validator can assert against the manifest without re-probing the MP4. Planner picks.

---

### `services/ffmpeg-finalizer/src/validate.py` — extend with color-tag + bitrate-range + duration-parity assertions (D-10, D-11, D-14)

**Analog:** the same file's `validate_finalizer_info` (lines 11–101). Same dict-in / `List[str]`-out contract. Phase 13 extends in place — the planner may add either new top-level functions (e.g., `validate_encode_quality`) or new checks inside `validate_finalizer_info`.

**Existing pattern — single-key check with VERT-XX/D-XX prefix** (`services/ffmpeg-finalizer/src/validate.py:87-91`):
```python
# D-08: H264 CRF must be 20
if "h264_crf" not in info_data:
    errors.append("D-08: Missing 'h264_crf' field")
elif info_data["h264_crf"] != 20:
    errors.append(f"D-08: h264_crf is {info_data['h264_crf']}, expected 20")
```

**Phase 13 must update this check to `H264_CRF == 18`** and reference ENC-02/D-03:
```python
# ENC-02 / D-03: H264 CRF must be 18 (was 20 in Phase 4 D-08; tightened for sharper output)
if "h264_crf" not in info_data:
    errors.append("ENC-02: Missing 'h264_crf' field")
elif info_data["h264_crf"] != 18:
    errors.append(f"ENC-02: h264_crf is {info_data['h264_crf']}, expected 18 (D-03)")
```

**ffprobe invocation pattern — copy from `crop.py::probe_video`** (`services/ffmpeg-finalizer/src/crop.py:35-71`):
```python
def probe_video(input_path: str) -> dict:
    """Probe video metadata using ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-show_entries", "stream=width,height,codec_type,codec_name,r_frame_rate",
        "-show_entries", "format=duration",
        "-of", "json",
        input_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")

    import json
    data = json.loads(result.stdout)
    # ... iterate streams, extract fields
```
**Phase 13's new ffprobe-based validators must reuse this exact shape**: `ffprobe -v quiet -show_entries ... -of json`, then `json.loads(result.stdout)`, then iterate `data["streams"]`. To pull color tags, extend `-show_entries stream=...` with `color_space,color_primaries,color_transfer`. For bitrate, use `-show_entries format=bit_rate,duration`.

**Suggested new validators (per CONTEXT.md D-11):**
| Validator | Asserts | Maps to |
|-----------|---------|---------|
| `validate_color_tags(output_mp4_path)` | ffprobe reports `color_space=bt709`, `color_primaries=bt709`, `color_transfer=bt709` on video stream | ENC-03 / D-10 |
| `validate_bitrate_range(output_mp4_path, min_kbps=5000, max_kbps=8000)` | ffprobe `format.bit_rate / 1000` in [5000, 8000] for the 60s fixture | ENC-02 / D-11 |
| `validate_duration_parity(silence_cutter_output, finalizer_output, tolerance_ms=33)` | Two ffprobe duration calls; abs diff ≤ 33ms (one frame at 30fps) | ENC-05 / D-11, D-14 |

**Error-message format** stays exact-match to existing lines 27–34:
```python
errors.append(f"ENC-03: color_space is '{actual}', expected 'bt709' (D-10)")
```

---

### `services/ffmpeg-finalizer/tests/test_finalizer.py` — test extensions

**Analog:** the existing `TestConfig` class (lines 98–121) for constant assertions, and `TestValidation` class (lines 279–376) for validator assertions. Both use the D-XX traceability docstring convention (lines 1–19) that Phase 13 must extend.

**Test-class docstring pattern** (`services/ffmpeg-finalizer/tests/test_finalizer.py:1-19`):
```python
"""Unit tests for ffmpeg finalizer — crop logic, schema, config, and validation.

Follows the silence-cutter/tests/test_silence_cutter.py pattern with pytest.
Tests validate VERT-01/02/03 requirements and D-01/D-02/D-03/D-04/D-06/D-08/D-09/D-10/D-11 decisions.

Referenced requirements:
- VERT-01: Output is 9:16 vertical format (1080x1920)
...
- D-08: H.264 CRF 20
```
**Phase 13 must extend the referenced-requirements list with ENC-01..05 and D-01..D-14.**

**Constant-assertion pattern (extend `TestConfig`)** (`services/ffmpeg-finalizer/tests/test_finalizer.py:113-116`):
```python
def test_encoding_params(self):
    """H264_CRF=20 (D-08), H264_PRESET='medium' (D-09)."""
    assert config.H264_CRF == 20  # D-08
    assert config.H264_PRESET == "medium"  # D-09
```
**Phase 13 must update this test to `assert config.H264_CRF == 18` and re-tag the docstring `(ENC-02 / D-03)`.**

**Validator-assertion pattern (extend `TestValidation`)** (`services/ffmpeg-finalizer/tests/test_finalizer.py:287-299`):
```python
def test_validate_wrong_dimensions(self):
    """Output not 1080x1920 fails VERT-01."""
    data = {
        "output_width": 720,
        "output_height": 1280,
        "crop_strategy": "center",
        "crop_applied": False,
        "h264_crf": 20,
        "audio_normalization": True,
        "safe_zone": {"top": 100, "bottom": 230, "left": 54, "right": 54},
    }
    errors = validate_finalizer_info(data)
    assert any("VERT-01" in e for e in errors)
```
**New Phase 13 tests follow this exact shape**: build a minimal dict, call the validator, `assert any("ENC-XX" in e for e in errors)`. Update `h264_crf` fixture values from 20 → 18 across the test file's fixtures (lines 54, 82).

**Fixture-update locations** in `test_finalizer.py`:
- Line 54: `"h264_crf": 20,` → `"h264_crf": 18,`
- Line 82: `"h264_crf": 20,` → `"h264_crf": 18,`
- Line 211: `h264_crf=20,` → `h264_crf=18,`
- Line 233: `h264_crf=20,` → `h264_crf=18,`
- Line 268: `h264_crf=20,` → `h264_crf=18,`
- Line 308: `"h264_crf": 20,` → keep as-is (test asserts on `crop_strategy`, CRF is irrelevant)
- Line 322: similar incidental fixture
Planner audits all `h264_crf` literals.

**E2E ffprobe test pattern** — there is no existing E2E test that *runs* ffprobe on a real file inside `tests/`; the existing pattern is to mock or use synthetic dicts. The Phase 13 ffprobe-against-real-output assertions belong in a new `tests/test_encode_quality.py` (planner's call per D-11 Claude's Discretion) and should fixture against a checked-in tiny MP4 (or run as an E2E shell test alongside Phase 4's `04-UAT.md` E2E entry).

---

### `.planning/phases/13-encode-quality/uat/` — new visual A/B artifact directory

**Analog:** Phase 12's `.planning/phases/12-subtitle-preview-lab/12-UAT.md` and Phase 4's `.planning/phases/04-9-16-vertical-output/04-UAT.md`. Both follow a YAML-frontmatter + numbered-test markdown format.

**UAT.md header pattern** (`.planning/phases/12-subtitle-preview-lab/12-UAT.md:1-9`):
```markdown
---
status: complete
phase: 12-subtitle-preview-lab
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md
started: 2026-05-18T13:00:00Z
updated: 2026-05-18T17:30:00Z
---

## Current Test

[testing complete]
```

**Test-entry pattern** (`.planning/phases/12-subtitle-preview-lab/12-UAT.md:15-17`):
```markdown
### 1. Cold Start Smoke Test
expected: Server starts and serves /api/health, /editor, /preview, /preview/fonts. All routes return valid content.
result: pass
```

**Phase 13 extends the convention with binary artifacts:** the `uat/` subdirectory (new, peer to `13-UAT.md`) holds two MP4 files (`baseline.mp4` and `phase-13.mp4`) for the human visual A/B. CONTEXT.md D-11 names this directory explicitly. The README inside `uat/` (or a section inside `13-UAT.md`) should describe how to A/B view them (open both in mpv side-by-side, or a tiny static HTML page — planner picks per CONTEXT.md "Claude's Discretion").

**Summary block pattern** (`.planning/phases/12-subtitle-preview-lab/12-UAT.md:99-110`):
```markdown
## Summary

total: 21
passed: 21
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
```
Required at the bottom of `13-UAT.md`.

---

## Shared Patterns

### FFmpeg subprocess invocation
**Source:** `services/silence-cutter/src/cut_video.py:152-174`, `services/ffmpeg-finalizer/src/crop.py:137-176`
**Apply to:** Both Phase 13 files that touch FFmpeg cmd lists (`cut_video.py`, `crop.py`)

```python
cmd = ["ffmpeg", "-y", ...]
print(f"[{config.STEP_NAME}] Running FFmpeg ...")  # optional but consistent

result = subprocess.run(cmd, capture_output=True, text=True, timeout=<300_or_600>)
if result.returncode != 0:
    raise RuntimeError(f"FFmpeg ... failed: {result.stderr}")
```

Every FFmpeg invocation in both services uses this exact shape:
- `cmd` is a Python list (no shell strings)
- `subprocess.run(..., capture_output=True, text=True, timeout=N)` with N=120 for short ops, 300 for concat, 600 for full finalizer
- Non-zero `returncode` → `RuntimeError(f"... failed: {result.stderr}")`
- A `print(f"[{config.STEP_NAME}] ...")` line precedes the call for log traceability

**Phase 13 does not introduce new subprocess shapes** — all changes are to the cmd args inside this established skeleton.

### ffprobe JSON parsing
**Source:** `services/ffmpeg-finalizer/src/crop.py:36-71`
**Apply to:** New validators in both `silence-cutter/src/validate.py` (concat-mode check) and `ffmpeg-finalizer/src/validate.py` (color tags + bitrate + duration parity)

```python
cmd = [
    "ffprobe", "-v", "quiet",
    "-show_entries", "stream=<fields>",
    "-show_entries", "format=<fields>",
    "-of", "json",
    input_path,
]
result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
if result.returncode != 0:
    raise RuntimeError(f"ffprobe failed: {result.stderr}")

import json
data = json.loads(result.stdout)
# iterate data["streams"] (list) and read data["format"] (dict)
```

For color tags: add `color_space,color_primaries,color_transfer` to the `stream=` field list.
For bitrate: add `bit_rate` to the `format=` field list.
For duration parity: reuse the simpler shape from `cut_video.py:256-272` (`-show_entries format=duration -of csv=p=0` + `float(result.stdout.strip())`).

### Validator error-string convention
**Source:** `services/silence-cutter/src/validate.py:24-25`, `services/ffmpeg-finalizer/src/validate.py:27-34`
**Apply to:** All new Phase 13 validator extensions

```python
errors: List[str] = []
errors.append("ENC-XX: <human-readable error>")          # for "field missing" cases
errors.append(f"ENC-XX: {field} is {actual}, expected {expected} (D-YY)")  # for "wrong value" cases
return errors
```

**Format invariants:**
- Always prefix with `REQUIREMENT-ID:` (or `D-XX:`) for greppability
- Append the deciding `(D-YY)` reference in parentheses at the end when a decision is being enforced
- Empty list (`return []`) = all checks passed
- Return type is always `List[str]` (`from typing import List`)

### Config-constant + traceability comment
**Source:** `services/ffmpeg-finalizer/src/config.py:7-50`
**Apply to:** Phase 13's `H264_CRF` constant change

Every constant in `config.py` has a leading `# D-XX: <rationale>` comment. Phase 13 must:
- Preserve the constant-then-comment shape
- Reference both the superseded Phase 4 D-XX *and* the new Phase 13 D-XX
- **NOT** add an `_ENV` counterpart for `H264_CRF` (per CONTEXT.md "Deferred Ideas" + Phase 4 convention)

### Test-class structure + D-XX docstring traceability
**Source:** `services/ffmpeg-finalizer/tests/test_finalizer.py:1-19, 98-121, 279-376`
**Apply to:** New Phase 13 tests in `test_finalizer.py` (and optionally a new `test_encode_quality.py`)

```python
"""Module docstring listing all referenced requirements (VERT-01, D-08, ENC-02, ...)."""

class TestConfig:
    """Verify config constants match CONTEXT.md decisions."""
    def test_<feature>(self):
        """Brief description (ENC-XX / D-YY)."""
        assert <constant> == <expected_value>

class TestValidation:
    """Verify validate functions per <REQ>-XX/D-XX requirements."""
    def test_validate_<scenario>(self):
        """<expected failure mode>."""
        data = { ... }  # minimal dict
        errors = validate_<fn>(data)
        assert any("<REQ>-XX" in e for e in errors)
```

### Phase artifact layout
**Source:** `.planning/phases/12-subtitle-preview-lab/12-UAT.md`, `.planning/phases/04-9-16-vertical-output/04-UAT.md`
**Apply to:** Phase 13's `13-UAT.md` and the new `uat/` subdirectory

- `<padded>-UAT.md` lives at the phase root with YAML frontmatter and numbered test entries
- Binary artifacts (MP4s for visual A/B) live in `uat/` (new for Phase 13, but follows the `phases/<padded>/...` convention used by all prior phases for human-reviewable artifacts)
- Final `## Summary` block with `total / passed / issues / pending / skipped / blocked` counts is required
- `## Gaps` section: `[none]` when all clean, otherwise enumerate

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | Every Phase 13 touchpoint has a direct in-repo analog. The only "new" surface is the `uat/` subdirectory with MP4 fixtures, and even that follows the established `.planning/phases/<padded>/...` artifact-layout convention from Phases 3, 4, and 12. |

The one *category* without strict precedent is "ffprobe-based assertions that run against a real output MP4 inside a pytest test". Existing tests synthesize dicts; ffprobe is only ever called from production code. Planner's choice (per CONTEXT.md D-11 "Claude's Discretion") is whether to:
1. Add a new pytest module (`tests/test_encode_quality.py`) that runs ffprobe against a fixture MP4 checked into `tests/fixtures/`, OR
2. Run the ffprobe assertions inside the existing E2E shell script (`scripts/test-ffmpeg-finalizer.sh`, referenced in `04-UAT.md` test #3) and keep `validate.py` ffprobe-free.

Either choice has Phase-4 precedent (option 2 maps to the E2E shell-script pattern noted in `04-UAT.md`). Planner picks based on whichever ships first.

---

## Metadata

**Analog search scope:**
- `services/silence-cutter/src/*.py` (5 modules)
- `services/silence-cutter/tests/*.py` (1 module)
- `services/ffmpeg-finalizer/src/*.py` (4 modules)
- `services/ffmpeg-finalizer/tests/*.py` (1 module)
- `services/whisper/src/*.py` (ffprobe pattern cross-check: `audio_extraction.py`, `transcribe.py`)
- `.planning/phases/03-silence-detection-removal/` (UAT + CONTEXT for SILC-03 invariant lineage)
- `.planning/phases/04-9-16-vertical-output/` (UAT + CONTEXT for VERT/D-08 lineage being superseded)
- `.planning/phases/12-subtitle-preview-lab/` (UAT artifact convention)

**Files scanned:** ~18 source + 3 test + 4 phase artifacts
**Pattern extraction date:** 2026-05-20
