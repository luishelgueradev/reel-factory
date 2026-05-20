# Architecture Research

**Domain:** Video quality/definition improvements in a Docker step pipeline
**Researched:** 2026-05-20
**Confidence:** HIGH (code audit + verified docs)

## Standard Architecture

### Existing Pipeline — Verified State

```
input/video.mp4 (raw mobile talking-head)
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ Step 1: whisper                                               │
│   CUDA GPU (DeviceRequests: nvidia, count=-1)                 │
│   Reads: input/video.mp4                                      │
│   Writes: whisper/transcript.json                             │
│   Codec: no video encode (audio extraction only)              │
└───────────────────────────────────────────────────────────────┘
    │ transcript.json (timestamps on ORIGINAL timeline)
    ▼
┌───────────────────────────────────────────────────────────────┐
│ Step 2: silence-cutter                                        │
│   Reads: input/video.mp4 + transcript.json                    │
│   Writes: silence-cutter/output.mp4 + silence-cuts.json       │
│   Codec: RE-ENCODE #1 — libx264 (no CRF specified = default   │
│          23) for per-segment extraction; libx264 again for    │
│          concat output (no CRF = default 23)                  │
│   Note: TWO libx264 passes inside this single step            │
└───────────────────────────────────────────────────────────────┘
    │ output.mp4 (H.264, CRF 23 x2, original resolution)
    ▼
┌───────────────────────────────────────────────────────────────┐
│ Step 3: ffmpeg-finalizer                                      │
│   Reads: silence-cutter/output.mp4                            │
│   Writes: ffmpeg-finalizer/output.mp4 + finalizer-info.json   │
│   Codec: RE-ENCODE #2 — libx264 CRF 20, preset medium         │
│          scale+crop to 1080x1920, loudnorm audio              │
└───────────────────────────────────────────────────────────────┘
    │ output.mp4 (H.264 CRF 20, 1080x1920, 30fps)
    ▼
┌───────────────────────────────────────────────────────────────┐
│ Step 4: remotion-renderer                                      │
│   Reads: ffmpeg-finalizer/output.mp4 + transcript + cuts      │
│   Writes: remotion-renderer/output.mp4                        │
│   Codec: RE-ENCODE #3 — Remotion renderMedia codec:h264       │
│          scale: NOT SET (defaults to 1, no supersampling)      │
│          imageFormat: jpeg (default, lossy frame capture)      │
│          Chromium --disable-gpu (CPU-only headless render)     │
│   Time: ~693s observed for short clip                         │
└───────────────────────────────────────────────────────────────┘
    │ output.mp4 (H.264, third encode, subtitle burn-in)
    ▼
┌───────────────────────────────────────────────────────────────┐
│ Step 5: srt-exporter (parallel-capable)                        │
│   Reads: input/video.mp4 + transcript + cuts                  │
│   Writes: srt-exporter/output.vtt                             │
│   No video encode                                             │
└───────────────────────────────────────────────────────────────┘
```

### Step Contract (shared/schemas/)

Every step receives `INPUT_PATH`, `OUTPUT_PATH`, `PIPELINE_JOB_ID` via environment variables.
Every step writes `manifest.json` with `{status, output_files, duration_seconds}`.
The orchestrator (api-server) reads `manifest.json` after each container exits to detect failure.
New steps are added by inserting a container into the STEPS array in `orchestrator.ts` — no existing step code changes.

---

## Diagnosed Quality Problems

### Problem 1: Triple H.264 Re-encode

The video is re-encoded with H.264 (lossy) three times:
- silence-cutter: segments extracted at CRF 23, then concatenated at CRF 23 (two passes, one step)
- ffmpeg-finalizer: encoded at CRF 20
- remotion-renderer: encoded again at Remotion's default CRF

Each lossy encode compounds generation loss (blocking artifacts, detail smearing).
The silence-cutter double-encode is the largest source of loss because CRF 23 (default, no explicit setting) runs twice.

### Problem 2: Remotion scale Not Set

`renderMedia()` is called with no `scale` parameter, defaulting to `1`.
The composition renders at exactly 1080x1920. Vector elements (fonts, SVG-based subtitles) render at 1x density.
On high-DPI mobile screens, the subtitle text appears soft because there is no supersampling.

Verified from Remotion docs: `scale` sets `deviceScaleFactor` in headless Chromium. A value of `2` renders at 2160x3840 (then ffmpeg muxes that as the output resolution). The scale factor directly corresponds to Chromium's device pixel ratio, so text is rendered at 2x sharpness. The output resolution IS the scaled resolution — Remotion does not auto-downscale.

Therefore, using `scale: 2` with a 1080x1920 composition produces a 2160x3840 final MP4 — which is too large for Instagram Reels. The correct workflow is: render at `scale: 2` to get 2160x3840, then a post-render ffmpeg pass downscales to 1080x1920. This is the supersampling pattern: render at 2x, output at 1x, keep the sharpness gained from higher-density rendering.

### Problem 3: imageFormat Defaults to jpeg

`renderMedia()` default `imageFormat` is `jpeg`. Each frame is captured as a JPEG (lossy) before being muxed into the video. Switching to `imageFormat: 'png'` captures lossless PNG frames — higher quality but slower render time.

### Problem 4: No Upscaling Step

The mobile camera source (typically 1080p or 720p) is cropped/scaled to 1080x1920 with bilinear/bicubic interpolation only. No AI-based super-resolution is applied. The finalizer scales smaller inputs up to 1080x1920 (`force_original_aspect_ratio=increase`) using standard ffmpeg scaling — which adds blur rather than detail.

---

## Integration Architecture for v1.1

### Constraint: No Refactoring

The step contract (INPUT_PATH → process → OUTPUT_PATH + manifest.json) must be honored.
Existing steps (whisper, silence-cutter, ffmpeg-finalizer, remotion-renderer, srt-exporter) must not be modified.
New steps are new Docker containers inserted into the STEPS array in `orchestrator.ts`.

### Clarification on "No Refactor"

Two categories of changes are acceptable:
- **New step (NEW container):** Always allowed by constraint.
- **Config extension (add env var to existing step):** Allowed because the step contract — manifest.json schema, input/output paths — does not change. The step's behavior is made configurable, not restructured.
- **Structural refactor (change data flow, split steps, change manifest schema):** Not allowed.

### Option Analysis: Where to Eliminate Generation Loss

#### Option A: Visually-Lossless Intermediate Between silence-cutter and finalizer

Change silence-cutter's output codec to CRF 17 (visually lossless H.264) or FFV1. This is a pure config change (replace CRF default in `_extract_segments()` and `_concatenate_segments()`). **FFV1 in MKV** produces ~5-10x larger intermediate files. **CRF 17 H.264** is visually indistinguishable from lossless at ~20-30% larger files than CRF 23. Keeps MP4 container. No step contract changes.

**Verdict:** CRF 17 H.264 for silence-cutter output. A config change, not a refactor.

#### Option B: Reduce Silence-Cutter to One Encode Pass

The silence-cutter currently does: encode each segment (CRF 23) → concat demuxer → encode again (CRF 23). The double-encode is the single largest source of generation loss. The second encode exists because `-c:v copy` after concat demuxer loses timestamps in some scenarios.

Using CRF 17 for both passes is the safe fix. Attempting stream-copy for the concat pass would require verifying timestamp behavior — it is a code change, not a config change, and is riskier.

**Verdict:** Apply CRF 17 to both passes within silence-cutter (2-line config change). Consider single-pass optimization later with proper testing.

#### Option C: Post-render Downscale Step (NEW step)

Insert a new `quality-finalizer` container after `remotion-renderer`.
It receives the 2x-scaled Remotion output and downscales to 1080x1920 with Lanczos filter, applies final CRF 18 encoding, and is effectively the one high-quality encode for the deliverable. This is a **new step** — fully compliant with the constraint.

### Recommended Architecture: Layered Quality Improvements

```
input/video.mp4
    │
    ▼
[whisper]                       UNCHANGED
    │ transcript.json
    ▼
[silence-cutter]                CONFIG CHANGE: CRF 17 on both encode passes
    │ output.mp4  (H.264 CRF 17, near-lossless, original resolution)
    ▼
[ffmpeg-finalizer]              CONFIG CHANGE: CRF 17 output (was CRF 20)
    │ output.mp4  (H.264 CRF 17, 1080x1920, 30fps)
    ▼
[remotion-renderer]             CONFIG EXTENSION: REMOTION_SCALE + REMOTION_CRF env vars
    │                           scale=2 → renders at 2160x3840 with 2x text sharpness
    │                           imageFormat='png' → lossless frame capture
    │ output.mp4  (H.264 at 2160x3840, subtitle-burned with sharp text)
    ▼
[quality-finalizer]             NEW STEP: downscale 2160x3840 → 1080x1920 Lanczos
    │                           CRF 18, preset slow (FINAL encode, deliverable)
    │ output.mp4  (H.264 CRF 18, 1080x1920, final deliverable)
    ▼
[upscaler]                      NEW STEP (optional, heavy): Real-ESRGAN 4x on final video
    │                           GPU: CUDA (same NVIDIA runtime as whisper)
    │                           input: quality-finalizer/output.mp4
    │ output.mp4  (4K AI-upscaled)
    ▼
[srt-exporter]                  UNCHANGED (reads original input + transcript)
```

---

## Component Details

### Component Responsibilities

| Component | Type | Responsibility | Change for v1.1 |
|-----------|------|----------------|-----------------|
| whisper | Existing | Speech-to-text, timestamps | None |
| silence-cutter | Existing | Remove silent segments | Config: CRF 17 for both encode passes |
| ffmpeg-finalizer | Existing | 9:16 crop + scale + audio normalize | Config: CRF 17 output |
| remotion-renderer | Existing | Burn subtitles via headless Chromium | Config extension: REMOTION_SCALE=2, REMOTION_CRF, imageFormat |
| quality-finalizer | NEW | Downscale 2x Remotion output to 1080x1920 final encode | New Docker container |
| upscaler | NEW (optional) | AI super-resolution on final video | New Docker container, GPU required |
| srt-exporter | Existing | VTT/SRT sidecar | None |
| api-server | Existing | Orchestration via Docker socket | Add new steps to STEPS array |

### Intermediate Format Strategy

| Boundary | Current | v1.1 Recommended | Rationale |
|----------|---------|-------------------|-----------|
| silence-cutter → finalizer | H.264 CRF 23 | H.264 CRF 17 | Near-lossless, no container change |
| finalizer → remotion-renderer | H.264 CRF 20 | H.264 CRF 17 | Better input quality for renderer |
| remotion-renderer → quality-finalizer | (new boundary) | H.264 2160x3840 | 2x supersampled, not deliverable size |
| quality-finalizer → output | (new) | H.264 CRF 18, 1080x1920 Lanczos | Final deliverable, one quality encode |
| quality-finalizer → upscaler | (optional) | H.264 CRF 17 | High-quality input for AI upscaling |
| upscaler → output | (optional) | H.264 CRF 18, 4K | AI-upscaled deliverable |

**Why not FFV1 between steps?**
FFV1 in MKV would eliminate all intermediate quality loss but produces files 5-10x larger than H.264 CRF 17 and requires longer encode/decode times. For a local pipeline, CRF 17 H.264 provides visually indistinguishable quality with acceptable file size and the existing MP4 container. FFV1 is the right choice only if disk space is unlimited and archival-grade intermediates are required.

---

## Recommended Project Structure

```
services/
├── whisper/                    # Existing — unchanged
├── silence-cutter/             # Existing — 2-line CRF config change
├── ffmpeg-finalizer/           # Existing — 1-line CRF config change
├── remotion-renderer/          # Existing — 5-line env var extension
│   └── src/render.ts           # Add scale/crf/imageFormat env var support
├── quality-finalizer/          # NEW — ffmpeg Lanczos downscale + final encode
│   ├── Dockerfile              # Inherits video-pipeline-base-python
│   ├── main.py
│   └── src/
│       ├── config.py           # OUTPUT_CRF, OUTPUT_WIDTH, OUTPUT_HEIGHT
│       └── downscale.py        # ffmpeg Lanczos + -c:a copy
├── upscaler/                   # NEW (optional) — Real-ESRGAN GPU step
│   ├── Dockerfile              # nvidia/cuda base image
│   ├── main.py
│   └── src/
│       ├── config.py           # UPSCALE_FACTOR, MODEL_NAME, TILE_SIZE
│       ├── extract_frames.py   # ffmpeg PNG frame extraction
│       ├── upscale.py          # Real-ESRGAN inference
│       └── reassemble.py       # ffmpeg frame → MP4 + audio copy
└── api-server/
    └── src/orchestrator.ts     # Add quality-finalizer + upscaler to STEPS array
```

### Structure Rationale

- **quality-finalizer/:** Follows exact pattern of ffmpeg-finalizer (Python + ffmpeg). Same base image, same step contract. Lowest friction to build.
- **upscaler/:** Requires CUDA base image separate from base-python. Cannot reuse base-python. Isolates heavy ML deps (torch, basicsr, facexlib).
- **shared schemas unchanged:** Both new steps honor the existing `PipelineManifest` interface.

---

## Architectural Patterns

### Pattern 1: Config Extension for Existing Step

**What:** Add env var support to `renderMedia()` in remotion-renderer without changing the step contract.
**When to use:** When an existing step needs tunable parameters that were previously hardcoded.
**Trade-offs:** Small code change inside existing step, but no structural change. Backward compatible when env var has a safe default.

```typescript
// In render.ts — add to renderMedia() call:
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  outputLocation: outputPath,
  inputProps,
  scale: Number(process.env.REMOTION_SCALE ?? "1"),
  crf: Number(process.env.REMOTION_CRF ?? "18"),
  imageFormat: (process.env.REMOTION_IMAGE_FORMAT as "jpeg" | "png") ?? "jpeg",
  // existing options unchanged...
});
```

The orchestrator passes `REMOTION_SCALE=2` and `REMOTION_IMAGE_FORMAT=png`. Default `"1"` preserves behavior if env var is absent.

**Critical:** When `scale: 2`, the output MP4 from remotion-renderer is 2160x3840. The quality-finalizer step must always follow when scale > 1.

### Pattern 2: New Step Insertion

**What:** A new Python+FFmpeg container that downscales and applies final encode.
**When to use:** When post-processing must not modify the step that produced the data.

```python
# quality-finalizer/src/downscale.py
cmd = [
    "ffmpeg", "-y",
    "-i", input_path,                          # 2160x3840 from remotion-renderer
    "-vf", "scale=1080:1920:flags=lanczos",    # High-quality downscale
    "-c:v", "libx264",
    "-crf", str(config.OUTPUT_CRF),            # 18 — final deliverable quality
    "-preset", "slow",                          # Better compression for final
    "-profile:v", "high",
    "-pix_fmt", "yuv420p",
    "-c:a", "copy",                            # Audio already normalized — copy only
    "-movflags", "+faststart",
    output_path
]
```

The quality-finalizer reads `INPUT_PATH` (remotion output) and writes `OUTPUT_PATH` (deliverable). It writes `manifest.json`. Insertable into STEPS array with zero changes to surrounding steps.

### Pattern 3: GPU-Accelerated Upscaler Step

**What:** Docker container running Real-ESRGAN with NVIDIA runtime for AI super-resolution.
**When to use:** When target quality requires exceeding the source camera's native resolution.
**Trade-offs:** Requires NVIDIA GPU, 10-60 minutes per video depending on length and GPU.

Real-ESRGAN video pipeline (frame-extract → AI-upscale → reassemble):
```
1. ffprobe input → get fps, duration, audio streams
2. ffmpeg → extract all frames as PNG sequence (lossless)
3. realesrgan-ncnn-vulkan OR inference_realesrgan.py → upscale each PNG
   Model: RealESRGAN_x4plus (photorealistic, not anime variant)
   Scale: 4x (1080x1920 → 4320x7680, then downscale in reassembly)
4. ffmpeg → reassemble frames + -map 1:a:0 -c:a copy (audio from original)
```

Audio is never re-encoded. Audio comes from the quality-finalizer output (already normalized).

### Pattern 4: Supersampling for Subtitle Sharpness

**What:** Render Remotion at 2x scale, then downscale via quality-finalizer.
**When to use:** When subtitle text appears blurry on high-DPI mobile screens.
**Trade-offs:** 4x the pixel count to render (Chromium renders 2160x3840), ~4x slower Remotion render, requires quality-finalizer step.

```
composition dimensions: 1080x1920 (unchanged — layout CSS still works at 1080px widths)
renderMedia scale: 2
actual Chromium viewport: 2160x3840 at deviceScaleFactor=2
Chromium renders text at 2x sharpness (vector elements scale perfectly)
output file from Remotion: 2160x3840 MP4

→ quality-finalizer downscales to 1080x1920 using Lanczos
→ final file: 1080x1920 with 2x more detail in text rendering
```

**Confirmed limitation from Remotion docs:** `scale` affects vector elements (text, SVGs) but NOT the background video element — `<Video>` components in Remotion cannot be scaled up by Chromium's deviceScaleFactor. Video quality improvement for the background clip comes from CRF improvements (steps 1-3) and optionally the AI upscaler step.

---

## Data Flow

### Request Flow (v1.1 Final)

```
POST /process {videoPath}
    │
    ▼
api-server orchestrator (Docker socket)
    │
    ├─ [1] whisper ─────────────────────── GPU (CUDA) — transcript.json
    │
    ├─ [2] silence-cutter ──────────────── CPU (ffmpeg) — CRF 17
    │
    ├─ [3] ffmpeg-finalizer ────────────── CPU (ffmpeg) — CRF 17, 1080x1920
    │
    ├─ [4] remotion-renderer ───────────── CPU (Chromium) — scale=2, PNG frames
    │         output: 2160x3840 H.264
    │
    ├─ [5] quality-finalizer (NEW) ─────── CPU (ffmpeg) — Lanczos 1080x1920, CRF 18
    │         output: 1080x1920 H.264 (final deliverable)
    │
    ├─ [6] upscaler (NEW, optional) ────── GPU (CUDA) — Real-ESRGAN 4x
    │         output: 4K AI-upscaled MP4
    │
    └─ [7] srt-exporter ────────────────── CPU — VTT sidecar
```

### GPU Sharing Pattern

whisper and upscaler both require GPU. They run sequentially in the serial pipeline — no simultaneous GPU use. The NVIDIA container runtime allows multiple containers to share a GPU sequentially. Both containers use the same `DeviceRequests: [{Driver: "nvidia", Count: -1, Capabilities: [["gpu"]]}]` pattern.

NVIDIA MPS (Multi-Process Service) is not needed for a serial pipeline. The GPU is idle between whisper completion and upscaler start (steps 3-5 are CPU-only).

The GPU VRAM concern: Whisper medium model in float16 uses ~3-5 GB VRAM. Real-ESRGAN RealESRGAN_x4plus on 1080x1920 frames requires ~6-8 GB VRAM. Sequential use is fine; simultaneous is not (pipeline is serial by design). If VRAM < 6 GB, use tile mode: `--tile 256` in realesrgan-ncnn-vulkan.

---

## Build Order (Recommended)

Ordered from highest impact / lowest risk to highest impact / highest risk:

### Phase 1: Encode Quality Wins (Config-Only, Lowest Risk)

1. **silence-cutter CRF 17** — Change `"-c:v", "libx264"` lines in `_extract_segments()` and `_concatenate_segments()` to add `"-crf", "17"`. Two-line change. Eliminates the single largest source of generation loss (double CRF 23 encode).
2. **ffmpeg-finalizer CRF 17** — Change `H264_CRF = 20` to `H264_CRF = 17` in `src/config.py`. One-line change.
3. **Verify** on real test video. Compare output sharpness. Intermediate file sizes increase ~20-30% — acceptable.

### Phase 2: Remotion Supersampling (Config Extension + New Step)

4. **remotion-renderer env var extension** — Add `scale`, `crf`, `imageFormat` reading from env vars in `render.ts`. Five-line change. Default `scale=1` preserves existing behavior.
5. **quality-finalizer new container** — New Python/FFmpeg container following the ffmpeg-finalizer pattern. Reads INPUT_PATH, downscales to 1080x1920 Lanczos, writes OUTPUT_PATH + manifest.json.
6. **Update orchestrator STEPS** — Add quality-finalizer after remotion-renderer. Set `REMOTION_SCALE=2` for remotion-renderer step. Update `videoUrl` field to point to `quality-finalizer/output.mp4`.
7. **Verify** text sharpness improvement. Remotion render time increases ~4x (expected trade-off). quality-finalizer adds ~30-60s.

### Phase 3: AI Upscaling (New Step, GPU, Heaviest)

8. **upscaler new container** — Python container with Real-ESRGAN PyTorch + CUDA. Runs after quality-finalizer. Frame-extract → AI upscale → reassemble pattern. Model: `RealESRGAN_x4plus`.
9. **GPU config in orchestrator** — Add NVIDIA DeviceRequests to upscaler step identical to whisper.
10. **Benchmark** on representative clip. Real-ESRGAN at 4x is ~10-60 min per video depending on GPU and length. Consider making upscaler an opt-in step per job request (add `enableUpscaling: boolean` to the job payload) rather than always-on.

---

## Anti-Patterns

### Anti-Pattern 1: Using FFV1 Between All Steps

**What people do:** Replace all H.264 intermediates with FFV1 in MKV for "true lossless" pipeline.
**Why it's wrong:** FFV1 files are 5-10x larger than H.264 CRF 17. Pipeline steps consume and produce huge files, slowing every step and exceeding disk space on long videos. MKV containers require downstream tool verification.
**Do this instead:** H.264 CRF 17 for intermediates — visually indistinguishable from lossless at manageable sizes.

### Anti-Pattern 2: Applying scale=2 Without a Downscale Step

**What people do:** Set `REMOTION_SCALE=2` and use the Remotion output directly as the deliverable.
**Why it's wrong:** The output is 2160x3840. Instagram Reels maximum resolution is 1080x1920 — 4K outputs are rejected or re-compressed with quality loss by the platform.
**Do this instead:** Always pair `scale=2` with quality-finalizer. The quality-finalizer is the mandatory companion step.

### Anti-Pattern 3: Applying AI Upscaling Before ffmpeg-finalizer

**What people do:** Insert the upscaler early (after silence-cutter) so subsequent steps work at upscaled resolution.
**Why it's wrong:** ffmpeg-finalizer would crop/rescale the AI-upscaled frames back to 1080x1920 using standard bilinear interpolation, destroying all the AI upscaling work. Remotion's `<Video>` component cannot superscale the background clip. Total processing time explodes for zero net benefit.
**Do this instead:** Apply AI upscaling as the LAST video-processing step, on the final deliverable.

### Anti-Pattern 4: Using scale=2 With imageFormat='jpeg'

**What people do:** Enable supersampling via scale but keep jpeg frame capture (the default).
**Why it's wrong:** The sharpness gain from 2x scale is partially undone by JPEG compression artifacts in the frame capture. Text edge quality degrades visibly.
**Do this instead:** When `scale >= 2`, use `imageFormat: 'png'`. The render is already slower at 2x; the additional cost of PNG vs JPEG is minor relative to the overall render time. PNG eliminates frame-capture lossy compression entirely.

### Anti-Pattern 5: Re-encoding Audio in quality-finalizer

**What people do:** quality-finalizer applies loudnorm or re-encodes audio.
**Why it's wrong:** Audio was already normalized by ffmpeg-finalizer (EBU R128, I=-14 LUFS, TP=-1). A third audio encode adds noise and no benefit.
**Do this instead:** quality-finalizer uses `-c:a copy` to pass audio through unchanged.

### Anti-Pattern 6: Simultaneous GPU Containers

**What people do:** Try to run whisper and upscaler in parallel for speed.
**Why it's wrong:** The pipeline is serial by design (each step depends on the previous step's output). Parallelism is not possible without structural changes. Forcing simultaneous GPU use risks VRAM exhaustion.
**Do this instead:** Accept sequential GPU use. The GPU sits idle between steps 1 and 6 — this is fine. If throughput matters, run multiple jobs with different job IDs, not multiple steps of the same job.

---

## Integration Points

### Existing Steps: What Changes

| Step | Change | File | Lines |
|------|--------|------|-------|
| silence-cutter | CRF 17 in both encode calls | `src/cut_video.py` | 2 |
| ffmpeg-finalizer | CRF 17 output | `src/config.py` | 1 |
| remotion-renderer | Add scale/crf/imageFormat env var support | `src/render.ts` | ~5 |
| api-server orchestrator | Add quality-finalizer (+ upscaler) to STEPS, update videoUrl | `src/orchestrator.ts` | ~20 |

### New Steps: What to Build

**quality-finalizer** (NEW container, LOW complexity):
- Base image: `video-pipeline-base-python` (already has ffmpeg)
- Language: Python (consistent with ffmpeg-finalizer)
- Contract: `INPUT_PATH` → ffmpeg Lanczos → `OUTPUT_PATH` + `manifest.json`
- Key ffmpeg flags: `-vf scale=1080:1920:flags=lanczos`, `-crf 18`, `-preset slow`, `-c:a copy`
- Env vars: `INPUT_PATH`, `OUTPUT_PATH`, `PIPELINE_JOB_ID`, `OUTPUT_WIDTH` (default 1080), `OUTPUT_HEIGHT` (default 1920), `OUTPUT_CRF` (default 18)

**upscaler** (NEW container, HIGH complexity, GPU):
- Base image: `nvidia/cuda:11.8-runtime-ubuntu22.04` — separate from base-python (heavy ML deps)
- Language: Python with Real-ESRGAN PyTorch deps (basicsr, facexlib, gfpgan)
- Contract: `INPUT_PATH` → frame extract → AI upscale → reassemble → `OUTPUT_PATH` + `manifest.json`
- Env vars: `INPUT_PATH`, `OUTPUT_PATH`, `PIPELINE_JOB_ID`, `UPSCALE_FACTOR` (default 4), `MODEL_NAME` (default `RealESRGAN_x4plus`), `TILE_SIZE` (default 0 = auto)
- GPU: `DeviceRequests: [{Driver: "nvidia", Count: -1, Capabilities: [["gpu"]]}]`

### Orchestrator STEPS Array Additions

```typescript
// quality-finalizer — insert after remotion-renderer (index 4)
{
  name: "quality-finalizer",
  image: "reel-factory-quality-finalizer",
  envVars: {
    INPUT_PATH: "/data/pipeline/{jobId}/remotion-renderer/output.mp4",
    OUTPUT_PATH: "/data/pipeline/{jobId}/quality-finalizer/output.mp4",
    PIPELINE_JOB_ID: "{jobId}",
    OUTPUT_WIDTH: "1080",
    OUTPUT_HEIGHT: "1920",
    OUTPUT_CRF: "18",
  },
},

// upscaler — insert after quality-finalizer (optional, GPU)
{
  name: "upscaler",
  image: "reel-factory-upscaler",
  envVars: {
    INPUT_PATH: "/data/pipeline/{jobId}/quality-finalizer/output.mp4",
    OUTPUT_PATH: "/data/pipeline/{jobId}/upscaler/output.mp4",
    PIPELINE_JOB_ID: "{jobId}",
    UPSCALE_FACTOR: "4",
    MODEL_NAME: "RealESRGAN_x4plus",
    TILE_SIZE: "256",
  },
},
```

The orchestrator's `videoUrl` field currently points to `remotion-renderer/output.mp4`. After quality-finalizer: `videoUrl: /artifacts/{jobId}/quality-finalizer/output.mp4`. After upscaler: `videoUrl: /artifacts/{jobId}/upscaler/output.mp4`.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 jobs | Current serial Docker pipeline is sufficient |
| 5-20 jobs | `MAX_CONCURRENT_JOBS=2` already in place; upscaler becomes bottleneck |
| 20+ jobs | Upscaler needs dedicated GPU job queue; consider opt-in per job request |

### Scaling Priorities

1. **First bottleneck at scale=2:** Remotion render time (~700s at scale=1, estimated ~2800s at scale=2). This is a Chromium CPU bottleneck. Remotion supports `concurrency` option in `renderMedia()` — increase to use all CPU cores.
2. **Second bottleneck:** AI upscaler GPU time. 10-60 min per video. Make it opt-in (`enableUpscaling: boolean` in job request) rather than always-on. Users who don't need AI upscaling shouldn't pay the time cost.

---

## Sources

- Remotion renderMedia() docs: https://www.remotion.dev/docs/renderer/render-media
- Remotion Output Scaling: https://www.remotion.dev/docs/scaling
- Remotion Quality Guide: https://www.remotion.dev/docs/quality
- Real-ESRGAN GitHub (xinntao): https://github.com/xinntao/Real-ESRGAN
- Real-ESRGAN Docker (gdagil): https://github.com/gdagil/Real-ESRGAN-docker
- Real-ESRGAN Docker Hub (nuvic): https://hub.docker.com/r/nuvic/real-esrgan
- FFV1 Wikipedia: https://en.wikipedia.org/wiki/FFV1
- FFmpeg CRF Guide: https://shotstack.io/learn/ffmpegcrf/
- Docker GPU docs: https://docs.docker.com/engine/containers/gpu/
- NVIDIA GPU sharing: https://github.com/NVIDIA/nvidia-container-toolkit/issues/1534
- Code audit: `services/silence-cutter/src/cut_video.py`, `services/ffmpeg-finalizer/src/crop.py`, `services/ffmpeg-finalizer/src/config.py`, `services/remotion-renderer/src/render.ts`, `services/api-server/src/orchestrator.ts`

---
*Architecture research for: Video quality/definition improvements in Docker step pipeline*
*Researched: 2026-05-20*
