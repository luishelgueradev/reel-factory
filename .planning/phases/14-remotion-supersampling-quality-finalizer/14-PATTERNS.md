# Phase 14: Remotion Supersampling + quality-finalizer - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `services/quality-finalizer/Dockerfile` | config | file-I/O | `services/ffmpeg-finalizer/Dockerfile` | exact |
| `services/quality-finalizer/main.py` | service | request-response | `services/ffmpeg-finalizer/main.py` | exact |
| `services/quality-finalizer/src/config.py` | config | — | `services/ffmpeg-finalizer/src/config.py` | exact |
| `services/quality-finalizer/src/downscale.py` | utility | file-I/O | `services/ffmpeg-finalizer/src/crop.py` | role-match |
| `services/remotion-renderer/src/render.ts` | service | request-response | self (modify existing) | — |
| `services/api-server/src/orchestrator.ts` | service | batch | self (modify existing) | — |

---

## Pattern Assignments

### `services/quality-finalizer/Dockerfile` (config, file-I/O)

**Analog:** `services/ffmpeg-finalizer/Dockerfile` (lines 1–10)

**Exact copy pattern** — the base image, WORKDIR, copy sequence, and CMD are identical:

```dockerfile
FROM video-pipeline-base-python:latest

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY src/ src/

CMD ["python", "main.py"]
```

No deviation needed. The base image already ships FFmpeg and Python 3.12.

---

### `services/quality-finalizer/main.py` (service, request-response)

**Analog:** `services/ffmpeg-finalizer/main.py` (entire file, 177 lines)

**Imports pattern** (lines 1–22):
```python
import os
import sys
import time
import json

from src import config
from src.downscale import probe_video, apply_downscale   # renamed from crop
from src.schema import DownscaleInfo                     # renamed from FinalizerInfo
```

**Env var reading pattern** (lines 29–50) — read INPUT_PATH, OUTPUT_PATH, PIPELINE_JOB_ID; then optional env overrides:
```python
input_path = os.environ.get("INPUT_PATH")
output_path = os.environ.get("OUTPUT_PATH")
job_id = os.environ.get("PIPELINE_JOB_ID")
```
For quality-finalizer: no looping env override block is needed (D-06 says Phase 14 uses baked-in constants for the finalizer; tunable knobs live in render.ts env vars, not here).

**Required-env-var validation pattern** (lines 57–67):
```python
if not input_path:
    print("ERROR: INPUT_PATH environment variable is not set", file=sys.stderr)
    sys.exit(1)

if not output_path:
    print("ERROR: OUTPUT_PATH environment variable is not set", file=sys.stderr)
    sys.exit(1)

if not job_id:
    print("ERROR: PIPELINE_JOB_ID environment variable is not set", file=sys.stderr)
    sys.exit(1)
```

**Input-file existence check** (lines 73–85) — write manifest with status "error" before exit:
```python
if not os.path.exists(input_path):
    error_msg = f"Input file not found at {input_path}"
    print(f"ERROR: {error_msg}", file=sys.stderr)
    _write_manifest(
        input_file=input_path,
        output_files=[],
        duration_seconds=time.time() - start_time,
        status="error",
        exit_code=1,
        error_message=error_msg,
    )
    sys.exit(1)
```

**Core step pattern** (lines 91–114) — probe → process → write info JSON → write manifest:
```python
try:
    probe_info = probe_video(input_path)
    meta = apply_downscale(input_path, output_path, probe_info)   # quality-finalizer variant

    info = DownscaleInfo(**meta)
    info_path = os.path.join(output_dir, "downscale-info.json")
    with open(info_path, "w") as f:
        f.write(info.model_dump_json(indent=2))

    duration = time.time() - start_time
    _write_manifest(
        input_file=input_path,
        output_files=[output_path, info_path],
        duration_seconds=duration,
        status="success",
        exit_code=0,
    )
    sys.exit(0)

except Exception as e:
    error_msg = f"Finalizer failed: {e}"
    print(f"ERROR: {error_msg}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    _write_manifest(...)
    sys.exit(1)
```

**`_write_manifest` helper** (lines 134–173) — copy verbatim; only `step_name` key changes:
```python
manifest = {
    "step_name": config.STEP_NAME,    # "quality-finalizer"
    "input_file": input_file,
    "output_files": output_files,
    "duration_seconds": round(duration_seconds, 2),
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    "status": status,
    "exit_code": exit_code,
}
if error_message:
    manifest["error_message"] = error_message
os.makedirs(manifest_dir, exist_ok=True)
with open(manifest_path, "w") as f:
    json.dump(manifest, f, indent=2)
```

---

### `services/quality-finalizer/src/config.py` (config)

**Analog:** `services/ffmpeg-finalizer/src/config.py` (entire file, 81 lines)

**Constant + `_ENV` naming pattern** — every tunable constant has a paired `CONSTANT_ENV = "CONSTANT_NAME"` string. Quality-finalizer needs fewer constants (no crop geometry, no audio, no safe zones); keep only what applies:

```python
"""Quality-finalizer container configuration constants.

Each constant is tied to a decision from the Phase 14 context (14-CONTEXT.md)
to maintain traceability between configuration and rationale.
"""

# D-08: Deliverable output size — probe gate compares input against these.
TARGET_WIDTH = 1080
TARGET_HEIGHT = 1920

# D-09: Lanczos downscale CRF. Lower than ffmpeg-finalizer (18) because this is
# a downscale from a 2x supersampled source, so fidelity budget is generous.
H264_CRF = 18
H264_CRF_ENV = "DOWNSCALE_CRF"

# D-09: Preset for the downscale encode. "medium" matches ffmpeg-finalizer default.
H264_PRESET = "medium"
H264_PRESET_ENV = "DOWNSCALE_PRESET"

# Step name matching shared/constants.ts STEP_NAMES (to be added).
STEP_NAME = "quality-finalizer"
```

**Decision-comment style** — every constant gets a `# D-XX:` inline comment referencing the 14-CONTEXT.md decision that governs it. Follow ffmpeg-finalizer/src/config.py lines 7–16 exactly.

---

### `services/quality-finalizer/src/downscale.py` (utility, file-I/O)

**Analog:** `services/ffmpeg-finalizer/src/crop.py` (entire file, 226 lines)

**`probe_video` function** (lines 35–71) — copy nearly verbatim; the ffprobe query, stream parsing, and `has_audio` logic are identical. Quality-finalizer also needs `has_audio` to decide whether to use `-c:a copy` or `-an`:

```python
def probe_video(input_path: str) -> dict:
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
    # ... parse streams for width, height, has_audio, duration
```

**Probe-gated idempotency logic** (D-08) — replaces `is_already_target_ratio` / `compute_crop`:
```python
def needs_downscale(probe_info: dict, target_width: int = 1080, target_height: int = 1920) -> bool:
    """True if input is larger than target (scale:2 case); False if already 1080x1920 (stream-copy path)."""
    return probe_info["width"] > target_width or probe_info["height"] > target_height
```

**`apply_downscale` function** — the structural parallel to `apply_finalizer` (lines 107–226):
```python
def apply_downscale(input_path: str, output_path: str, probe_info: dict) -> dict:
    if needs_downscale(probe_info):
        # D-09: Lanczos downscale to 1080x1920
        filter_chain = "scale=1080:1920:flags=lanczos,setsar=1"
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-vf", filter_chain,
            "-c:v", "libx264",
            "-crf", str(config.H264_CRF),
            "-preset", config.H264_PRESET,
            "-pix_fmt", "yuv420p",
            # D-11: Carry BT.709 tags through the downscale (no re-interpretation)
            "-colorspace", "bt709",
            "-color_primaries", "bt709",
            "-color_trc", "bt709",
            "-movflags", "+faststart",
            "-map_metadata", "-1",
            "-map", "0:v:0",
        ]
        # D-09: audio stream-copied bit-identically (A/V parity, success criterion #5)
        if probe_info["has_audio"]:
            cmd.extend(["-map", "0:a:0", "-c:a", "copy"])
        else:
            cmd.append("-an")
        cmd.append(output_path)
        downscale_applied = True
    else:
        # D-08: Input already 1080x1920 — stream-copy, no re-encode
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-c", "copy",
            output_path,
        ]
        downscale_applied = False

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg downscale failed: {result.stderr}")
    return { ... }   # downscale_applied, input_w/h, output_w/h, crf, lanczos_scaling, color tags
```

**No `unsharp` filter** — D-09 explicitly forbids it. The filter chain is `scale=1080:1920:flags=lanczos,setsar=1` only, unlike crop.py which appends `unsharp=5:5:0.5:5:5:0.3`.

---

### `services/remotion-renderer/src/render.ts` (service, request-response)

**Analog:** self — targeted modification to the existing `renderMedia()` call

**Env var reading pattern** — copy the style of lines 77–82 (existing env var reads), adding 6 new reads before the `renderMedia()` call block:

```typescript
// D-06 (Phase 14): Render quality params from env vars with safe backward-compatible defaults.
// Defaults: scale=1, imageFormat='jpeg', matching current behavior outside the orchestrator.
// The orchestrator sets REMOTION_SCALE=2 + REMOTION_IMAGE_FORMAT=png for the pipeline.
const remotionScale = parseFloat(process.env.REMOTION_SCALE || "1");
const remotionCrf = parseInt(process.env.REMOTION_CRF || "18", 10);
const remotionX264Preset = (process.env.REMOTION_X264_PRESET || "medium") as "medium" | "slow" | "fast";
const remotionColorSpace = (process.env.REMOTION_COLOR_SPACE || "bt709") as "bt709";
const remotionJpegQuality = parseInt(process.env.REMOTION_JPEG_QUALITY || "95", 10);
const remotionImageFormat = (process.env.REMOTION_IMAGE_FORMAT || "jpeg") as "jpeg" | "png";
```

**`renderMedia()` call modification** — lines 307–323 currently:
```typescript
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  outputLocation: outputPath,
  inputProps,
  onProgress: ({ progress }) => { ... },
  timeoutInMilliseconds: 120000,       // D-03 (Phase 14): RAISE to ~3h (10_800_000)
  chromiumOptions: { ... },
});
```

Add the 6 new params inside the call object:
```typescript
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  outputLocation: outputPath,
  inputProps,
  scale: remotionScale,                    // RENDER-01 / D-06
  crf: remotionCrf,                        // RENDER-01 / D-06
  x264Preset: remotionX264Preset,          // RENDER-01 / D-06
  colorSpace: remotionColorSpace,          // D-11 (Phase 14)
  jpegQuality: remotionJpegQuality,        // RENDER-02 / D-05
  imageFormat: remotionImageFormat,        // RENDER-02 / D-04
  onProgress: ({ progress }) => { ... },
  timeoutInMilliseconds: 10_800_000,       // D-03 (Phase 14): 3h ceiling; was 120000
  chromiumOptions: {
    enableMultiProcessOnLinux: true,
    args: ['--gl=angle-egl', '--disable-gpu'],
  },
});
```

**`renderInfo` object** (lines 326–362) — add the 6 new params as diagnostic fields, following the existing `codec: "h264", fps: 30` pattern:
```typescript
const renderInfo = {
  // ... existing fields ...
  remotion_info: {
    use_angle_egl: true,
    scale: remotionScale,
    image_format: remotionImageFormat,
    crf: remotionCrf,
    x264_preset: remotionX264Preset,
    color_space: remotionColorSpace,
    jpeg_quality: remotionJpegQuality,
  },
  // ...
};
```

---

### `services/api-server/src/orchestrator.ts` (service, batch)

**Analog:** self — targeted modification to the STEPS array and `videoUrl`

**STEPS array entry contract** (lines 56–117) — the exact shape of an entry to copy when inserting `quality-finalizer` after `remotion-renderer` at line 105:

```typescript
// Existing remotion-renderer entry to modify — add REMOTION_SCALE=2 + REMOTION_IMAGE_FORMAT=png:
{
  name: "remotion-renderer",
  image: "reel-factory-remotion-renderer",
  envVars: {
    INPUT_PATH: "/data/pipeline/{jobId}/ffmpeg-finalizer/output.mp4",
    OUTPUT_PATH: "/data/pipeline/{jobId}/remotion-renderer/output.mp4",
    PIPELINE_JOB_ID: "{jobId}",
    TRANSCRIPT_PATH: "/data/pipeline/{jobId}/whisper/transcript.json",
    SILENCE_CUTS_PATH: "/data/pipeline/{jobId}/silence-cutter/silence-cuts.json",
    FINALIZER_INFO_PATH: "/data/pipeline/{jobId}/ffmpeg-finalizer/finalizer-info.json",
    ACTIVE_COLOR: "#FFFF00",
    INACTIVE_COLOR: "#FFFFFF",
    FONT_SIZE: "58",
    // Phase 14 additions (D-06, D-07):
    REMOTION_SCALE: "2",
    REMOTION_IMAGE_FORMAT: "png",
  },
},
// New quality-finalizer entry — insert here, before srt-exporter:
{
  name: "quality-finalizer",
  image: "reel-factory-quality-finalizer",
  envVars: {
    INPUT_PATH: "/data/pipeline/{jobId}/remotion-renderer/output.mp4",
    OUTPUT_PATH: "/data/pipeline/{jobId}/quality-finalizer/output.mp4",
    PIPELINE_JOB_ID: "{jobId}",
  },
},
```

**`videoUrl` repoint** (line 331 currently):
```typescript
// Before (line 331):
videoUrl: `/artifacts/${jobId}/remotion-renderer/output.mp4`,

// After (Phase 14):
videoUrl: `/artifacts/${jobId}/quality-finalizer/output.mp4`,
```

**Comment update** — the existing comment at line 53 reads `"Step order: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → srt-exporter"`. Update to include `quality-finalizer`:
```typescript
// Step order: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → quality-finalizer → srt-exporter
```

---

## Shared Patterns

### Manifest JSON shape
**Source:** `services/ffmpeg-finalizer/main.py` lines 156–171
**Apply to:** `quality-finalizer/main.py`
```python
manifest = {
    "step_name": config.STEP_NAME,
    "input_file": input_file,
    "output_files": output_files,
    "duration_seconds": round(duration_seconds, 2),
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    "status": status,      # "success" | "error"
    "exit_code": exit_code,
}
# Optional:
if error_message:
    manifest["error_message"] = error_message
```

### ffprobe subprocess pattern
**Source:** `services/ffmpeg-finalizer/src/validate.py` lines 204–215 (used in every ffprobe call)
**Apply to:** `quality-finalizer/src/downscale.py`, `quality-finalizer/tests/`
```python
result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
if result.returncode != 0:
    raise RuntimeError(f"ffprobe failed: {result.stderr}")
data = json.loads(result.stdout)
```

### ffprobe getVideoDimensions (Node.js)
**Source:** `services/remotion-renderer/src/render.ts` lines 17–33
**Apply to:** quality-finalizer's `downscale.py` probes the same fields — use as spec reference for what streams to query

```typescript
const probeOut = execFileSync("ffprobe", [
  "-v", "error",
  "-show_entries", "stream=width,height",
  "-show_entries", "format=duration",
  "-of", "json",
  videoPath,
], { encoding: "utf-8" });
const videoStream = data.streams.find((s: any) => s.width !== undefined && s.height !== undefined);
```

### BT.709 ffmpeg flags
**Source:** `services/ffmpeg-finalizer/src/crop.py` lines 155–162
**Apply to:** `quality-finalizer/src/downscale.py` (carry-through, no colorspace filter — metadata only)
```python
"-colorspace", "bt709",
"-color_primaries", "bt709",
"-color_trc", "bt709",
```

### `validate_color_tags` / `validate_duration_parity` pattern
**Source:** `services/ffmpeg-finalizer/src/validate.py` lines 189–238, 298–350
**Apply to:** `quality-finalizer/tests/` — copy both functions into a `src/validate.py` module in quality-finalizer; add a `validate_dimensions` function that checks ffprobe width=1080, height=1920 (the downscale-specific assertion).

### Requirements.txt
**Source:** `services/ffmpeg-finalizer/requirements.txt` (1 line)
**Apply to:** `quality-finalizer/requirements.txt` — identical; quality-finalizer uses pydantic for its schema module:
```
pydantic>=2.0.0
```

---

## No Analog Found

None. All new files have exact or role-match analogs in the codebase.

---

## Metadata

**Analog search scope:** `services/ffmpeg-finalizer/`, `services/remotion-renderer/src/`, `services/api-server/src/`
**Files scanned:** 10 source files read (Dockerfile, main.py, src/config.py, src/crop.py, src/schema.py, src/validate.py, tests/test_encode_quality.py, render.ts, orchestrator.ts, requirements.txt)
**Pattern extraction date:** 2026-05-21
