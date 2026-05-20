# Stack Research — v1.1 Calidad de Video

**Domain:** Video quality/definition improvements for a containerized Remotion + FFmpeg pipeline
**Researched:** 2026-05-20
**Confidence:** HIGH (Remotion options verified via Context7 + official docs; FFmpeg settings verified via official guides; Real-ESRGAN CPU/GPU tradeoffs verified via multiple sources)

---

## Context: What the Audit Found

The v1.0 pipeline applies **three H.264 encode passes** to the video before delivery:

| Step | Encode | CRF / preset | Problem |
|------|--------|--------------|---------|
| silence-cutter `_extract_segments` | libx264 | not set (FFmpeg default: 23) | Full re-encode per segment |
| silence-cutter `_concatenate_segments` | libx264 | not set (FFmpeg default: 23) | Full re-encode of assembled output |
| ffmpeg-finalizer `apply_finalizer` | libx264 | CRF 20, preset `medium` | Crop + encode |
| remotion-renderer `renderMedia` | h264 | no `scale`, no `x264Preset`, no `crf` set | Renders at 1:1 — no supersampling |

Every generation after the first loses quality. The Remotion render also uses JPEG frame intermediates at quality 80 (default), no supersampling, and likely default colorSpace — all fixable with parameters only, no new infrastructure.

---

## Recommended Stack

### Path A — Settings-Only (No New Infrastructure)

This path fixes the majority of visible quality loss with zero new Docker containers, zero new models, zero GPU dependency. Implement this first before any AI upscaling.

#### Core Technologies

| Technology | Current Version | Purpose | Change Required |
|------------|-----------------|---------|-----------------|
| Remotion `renderMedia` | 4.0.457 | Subtitle burn-in | Add `scale: 2`, `crf: 16`, `x264Preset: 'slow'`, `colorSpace: 'bt709'` |
| FFmpeg 7.1.1 | 7.1.1 (compiled from source in base-python) | All encode/decode/filter | Change silence-cutter to `-c copy`; tune finalizer CRF + preset + scale algorithm |
| libx264 | bundled with FFmpeg 7.1.1 build | H.264 encode | Already present; needs parameter tuning only |

---

#### Remotion renderMedia — Parameters to Add

All parameters verified against Context7 (`/remotion-dev/remotion`) and official Remotion docs.

| Parameter | Current | Recommended | Effect | Confidence |
|-----------|---------|-------------|--------|------------|
| `scale` | not set (implicit 1.0) | `2` | Chromium renders at 2160x3840 then Remotion downscales to 1080x1920 — text/SVG overlays get anti-aliased at 4x pixel density; most impactful single change for subtitle sharpness | HIGH |
| `crf` | not set (Remotion H.264 default: 18) | `16` | Increases bitrate moderately, sharpens final encode especially at text edges after downscale from 2x render | HIGH |
| `x264Preset` | not set (default: `'medium'`) | `'slow'` | Better compression curve = same CRF produces higher quality output; +20–40% encode time, acceptable for async batch pipeline | HIGH |
| `colorSpace` | not set (default: `'default'`) | `'bt709'` | Correct BT.709 color tagging AND conversion; requires Remotion ≥ 4.0.138 for actual color conversion (not metadata-only). 4.0.457 is well past this. | HIGH |
| `imageFormat` | not set (default: `'jpeg'`) | Start with `'jpeg'`, optionally switch to `'png'` | PNG = lossless intermediates, no JPEG artifacts on subtitle edges; but ~2–3x slower frame render. Start with jpeg+scale=2 and only switch to png if artifacts remain after A/B testing. | MEDIUM |
| `jpegQuality` | not set (default: 80) | `95` if staying on jpeg | Reduces JPEG quantization artifacts on text edges before encoding; pair with scale=2 for additive benefit | HIGH |

**Critical note on `scale: 2`:** Remotion renders the HTML/CSS/SVG overlay at 2160x3840, then the built-in libx264 encoder compresses to 1080x1920. The supersampling applies to subtitle text, borders, and all React-rendered elements. It does NOT upscale the background video — `<OffthreadVideo>` pixels are still sourced at 1080x1920. Scale is the correct mechanism; changing composition dimensions is not (it would require rewriting all layout math).

**API usage (render.ts):**

```typescript
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  outputLocation: outputPath,
  inputProps,
  scale: 2,                    // ADD: 2x supersampling for subtitle sharpness
  crf: 16,                     // ADD: higher bitrate than Remotion default 18
  x264Preset: "slow",          // ADD: better compression vs medium, acceptable time cost
  colorSpace: "bt709",         // ADD: correct color tagging and conversion
  // imageFormat: "png",       // OPTIONAL: add only if JPEG artifacts persist after above
  // jpegQuality: 95,          // ADD if keeping jpeg
  onProgress: ({ progress }) => { ... },
  timeoutInMilliseconds: 120000,
  chromiumOptions: {
    enableMultiProcessOnLinux: true,
    args: ['--gl=angle-egl', '--disable-gpu'],
  },
});
```

---

#### FFmpeg Silence-Cutter — Remove Two Encode Passes

The current `_extract_segments` function re-encodes every segment to libx264 for frame-accuracy. This is the largest source of quality loss and the one furthest upstream.

**Recommended fix:** Switch to `-c copy` (stream copy) in both `_extract_segments` and `_concatenate_segments`. Stream copy is byte-for-byte lossless and only cuts at keyframe boundaries — acceptable for silence removal because silence boundary positions do not require sub-frame precision.

```python
# CURRENT (re-encodes every segment — 2 generation losses):
cmd = [
    "ffmpeg", "-y",
    "-ss", str(start),
    "-i", input_path,
    "-t", str(duration),
    "-c:v", "libx264",   # re-encodes
    "-c:a", "aac",       # re-encodes
    "-af", "apad",
    segment_path
]

# RECOMMENDED (stream copy — lossless):
cmd = [
    "ffmpeg", "-y",
    "-ss", str(start),
    "-i", input_path,
    "-t", str(duration),
    "-c", "copy",        # lossless byte copy
    segment_path
]
```

`_concatenate_segments` similarly changes from re-encoding to `-c copy`:

```python
# CURRENT: "-c:v", "libx264", "-c:a", "aac", "-reset_timestamps", "1"
# RECOMMENDED: "-c", "copy", "-reset_timestamps", "1"
```

**Stream copy constraint:** Cuts are snapped to the nearest keyframe, not the exact timestamp. For silence removal (removing 0.5s+ segments) this is acceptable — the worst-case error is one keyframe interval (~1/30s at 30fps default). If the source video has keyframes every 2–5 seconds (default for phone cameras), cuts snap within that window. Test with real content.

**The `-apad` audio padding trick** (currently used to prevent audio-shorter-than-video drift) is not needed with `-c copy` because audio/video are copied verbatim with original timestamps. The `-reset_timestamps 1` flag in the concat step remains important.

**Net result:** Silence-cutter goes from 2 generation losses → 0 generation losses.

---

#### FFmpeg Finalizer — Tune the One Remaining Encode Pass

After stream-copy in silence-cutter, the finalizer becomes the only H.264 encode pass before Remotion. Make it count:

| Setting | Current | Recommended | Rationale |
|---------|---------|-------------|-----------|
| `-crf` | 20 | 18 | Visually transparent for 1080x1920 social content; ~30% larger file vs CRF 20 but source arrives at Remotion with much more detail preserved |
| `-preset` | `medium` | `slow` | Better compression curve at same CRF; +20–40% encoding time; the finalizer runs once, the time cost is acceptable |
| `-vf scale flags` | default (bicubic) | `flags=lanczos` | Lanczos is measurably sharper than bicubic/bilinear for scaling; verified via VMAF benchmarks (Streaming Learning Center study: ~10% VMAF gain vs default algorithm) |
| `-tune` | not set | `film` | Optimizes for live-action content (talking head) — biases quantization for detail, not grain preservation |
| `unsharp` filter | not set | `unsharp=5:5:0.5:5:5:0.3` | Post-scale sharpening to compensate for slight softening from Lanczos; luma 0.5 + chroma 0.3 are conservative starting values |
| `-pix_fmt` | `yuv420p` | `yuv420p` | Keep as-is — required for Instagram/TikTok compatibility |
| `-profile:v` | `high` | `high` | Keep as-is — broadest social media compatibility |

Full recommended `-vf` chain for the finalizer:

```python
# Crop path (input wider than 9:16):
filter_chain = (
    f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase:flags=lanczos,"
    f"crop={target_width}:{target_height},"
    f"unsharp=5:5:0.5:5:5:0.3,"
    f"setsar=1"
)

# Scale-only path (input already 9:16):
filter_chain = (
    f"scale={target_width}:{target_height}:flags=lanczos,"
    f"unsharp=5:5:0.5:5:5:0.3,"
    f"setsar=1"
)
```

And the encode flags:
```python
"-c:v", "libx264",
"-crf", "18",          # was 20
"-preset", "slow",    # was medium
"-tune", "film",      # ADD: live-action talking head
"-profile:v", "high",
"-pix_fmt", "yuv420p",
```

---

### Path B — AI Upscaling (New Docker Container, GPU Required for Production)

Add this as an optional step after Remotion renderer only after Path A is validated and further visual improvement is still required. This step adds significant complexity and has a hard GPU dependency for practical use.

#### Technology Decision: Real-ESRGAN Implementation

| Implementation | Pros | Cons | Verdict |
|----------------|------|------|---------|
| **Real-ESRGAN PyTorch** (`pip install realesrgan 0.3.0`) | CPU fallback via `--device cpu`, Python-native (fits base-python), actively maintained forks | CUDA required for practical speed; CPU: ~0.3–0.5 fps per 1080p frame = 4–8 hours for a 2-min video | **Recommended if GPU available** |
| **Real-ESRGAN-ncnn-vulkan** (C++ binary) | C++, no Python overhead, cross-platform | Vulkan required (no CPU fallback), last release April 2022 (stale), designed for images not video (no piping support) | Avoid: stale and GPU-only |
| **video2x v6.x** (k4yt3x/video2x) | Docker image available, wraps Real-ESRGAN + RIFE | Same Vulkan dependency, adds abstraction layer, less flexible for custom pipelines | Avoid: adds complexity without benefit |

**Recommendation:** Real-ESRGAN PyTorch (`realesrgan` 0.3.0) inside a new `upscaler` Docker container inheriting `video-pipeline-base-python:latest`. Expose a `USE_GPU` env var; document CPU mode as development-only.

#### Models for Live-Action Talking Head Video

| Model | Use Case | Scale | Recommendation |
|-------|----------|-------|---------------|
| `RealESRGAN_x4plus` | General live-action, talking head | 4x | **Use this.** Handles faces and skin tones well; the standard for real-world video |
| `realesr-general-x4v3` | General video with adjustable denoise | 4x | Alternative when source is visibly noisy; set `--denoise_strength 0.5` |
| `realesrgan-x2plus` | When 2x is enough | 2x | Faster; use when output doesn't need full 4x pipeline |
| `realesr-animevideov3` | Anime/animation only | 4x | Do NOT use for talking head — produces unnatural skin tones |

For this pipeline: `RealESRGAN_x4plus` at 4x, then scale back to 1080x1920 with FFmpeg. This acts as per-pixel supersampling on the final composite (not just the overlay like Remotion's `scale`).

#### Pipeline Position

```
whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → [upscaler] → srt-exporter
```

The `upscaler` container receives the Remotion output (1080x1920 H.264), upscales 4x to 4320x7680, then scales back to 1080x1920 (or optionally 2160x3840 if delivery supports it). Re-encode once at CRF 16, preset slow.

#### Performance Expectations

These are LOW confidence estimates from community reports (no official benchmarks published):

| Hardware | Input Resolution | Throughput | 2-min video time |
|----------|-----------------|-----------|-----------------|
| RTX 3060 12GB (CUDA, FP16) | 1080x1920 | ~2–5 fps | ~24–60 min |
| RTX 3090 (CUDA, FP16) | 1080x1920 | ~5–10 fps | ~12–24 min |
| CPU only (Intel i7, FP32) | 1080x1920 | ~0.3–0.5 fps | ~4–8 hours |

**Bottom line:** Path B is impractical for production without a CUDA-capable GPU. Do not add Path B to the pipeline if the deployment environment is CPU-only.

#### Docker Container Sketch

```dockerfile
FROM video-pipeline-base-python:latest

# CPU mode (development):
RUN pip install --no-cache-dir realesrgan==0.3.0 torch torchvision opencv-python-headless

# GPU mode (production — uncomment and comment above):
# RUN pip install --no-cache-dir realesrgan==0.3.0 \
#     torch torchvision --index-url https://download.pytorch.org/whl/cu121 \
#     opencv-python-headless

RUN mkdir -p /app/models && \
    curl -L "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth" \
    -o /app/models/RealESRGAN_x4plus.pth

COPY main.py .
CMD ["python", "main.py"]
```

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `-preset veryslow` or `placebo` in FFmpeg/Remotion | Diminishing returns past `slow`; 5–10x slower for <2% measurable quality gain | `slow` preset |
| Two-pass encoding (`-pass 1 -pass 2`) | Two-pass is designed for CBR/target-bitrate streaming; with CRF the first pass is meaningless — quality is controlled by the rate factor, not a target bitrate | Single-pass CRF (always) |
| H.265/HEVC output | Instagram does not support H.265 upload. TikTok accepts it but re-encodes anyway. Breaks social platform compatibility for no benefit. | H.264 (`libx264`) only |
| `crf` below 16 in Remotion | File bloats with no perceptible gain; social platforms (Instagram, TikTok) aggressively re-encode on upload, discarding the extra bits | CRF 16 |
| Skipping Path A and going straight to Real-ESRGAN | AI upscaling on top of JPEG-quantized, triple-re-encoded input amplifies compression artifacts rather than restoring detail | Fix encoding first (Path A), then evaluate whether upscaling is still needed |
| `realesr-animevideov3` on talking head | Designed for cel-shading; produces unnatural hair and skin texture on real faces | `RealESRGAN_x4plus` |
| Running Real-ESRGAN before Remotion render | Remotion draws subtitle overlays at 1080x1920 regardless — any upscaling done before Remotion is immediately re-encoded to 1080x1920 by the Remotion renderer | Run after Remotion |
| Remotion `imageFormat: 'png'` without benchmarking first | ~2–3x slower frame render; may not be necessary if `scale: 2` + `jpegQuality: 95` already eliminates visible artifacts | Benchmark with scale=2 + jpegQuality=95 first |

---

## Supporting Libraries (Path B Only)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `realesrgan` | 0.3.0 | Real-ESRGAN Python API | Last upstream release Sept 2022; stable |
| `basicsr` | ≥1.4.2 | ESRGAN model architecture and loading | Auto-installed as realesrgan dependency |
| `torch` + `torchvision` | ≥1.7 (pin to CUDA version) | PyTorch inference | Pin to `cu121` wheel if CUDA 12.x |
| `opencv-python-headless` | ≥4.x | Frame read/write for video piping | Headless variant — no GUI dependencies |
| `numpy` | bundled with torch | Array operations | No separate install needed |

No new Node.js libraries. All Remotion changes are parameter-only additions to the existing `renderMedia()` call.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `remotion` 4.0.457 | `colorSpace: 'bt709'` | Requires ≥ 4.0.138 for actual color conversion; 4.0.457 is well past this |
| `remotion` 4.0.457 | `x264Preset` | Available since v4.2.2; 4.0.457 has it |
| `remotion` 4.0.457 | `scale: 2` | Since v4.0.328 rounding is automatic; no non-even pixel issues |
| `realesrgan` 0.3.0 | Python 3.12 | Compatible; basicsr supports 3.8+ |
| FFmpeg 7.1.1 | `-c copy` in concat | Standard; no rebuild needed |
| FFmpeg 7.1.1 | `flags=lanczos` in `-vf scale` | Built-in scaling algorithm; no rebuild or new codec needed |
| FFmpeg 7.1.1 | `unsharp` filter | Built-in via `--enable-avfilter` (confirmed in base-python Dockerfile) |
| libx264 | `-tune film` | Standard tune option in libx264; present in current build |

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `scale: 2` in `renderMedia` | Change composition dimensions to 2160x3840 | Would require rewriting all layout math, subtitle positioning, and safe zone calculations in React components; `scale` is the correct mechanism for supersampling |
| `x264Preset: 'slow'` | `veryslow` or `placebo` | Diminishing returns past `slow`; 3–10x slower for under 2% quality gain |
| Stream copy in silence-cutter | Re-encode at higher quality per segment | Still adds a generation of quality loss; stream copy is lossless and the architecturally correct tool for lossless cutting |
| `RealESRGAN_x4plus` (real-world model) | GFPGAN | GFPGAN is a face restoration tool (for removing blur, artifacts from damaged photos), not a super-resolution upscaler; wrong tool for this use case |
| `RealESRGAN_x4plus` | Waifu2x | Optimized for anime; worse on live-action skin and hair |
| `RealESRGAN_x4plus` | BSRGAN | Less community support; no clear quality advantage for live-action video |
| FFmpeg `unsharp` filter | `cas` (contrast adaptive sharpening) | CAS is available in FFmpeg but less documented and harder to tune; `unsharp` is the established standard with well-understood parameter ranges |

---

## Implementation Order

1. **Phase 1 — Remotion parameters** (zero risk, zero new dependencies): Add `scale: 2`, `crf: 16`, `x264Preset: 'slow'`, `colorSpace: 'bt709'`, `jpegQuality: 95` to `renderMedia()` in `render.ts`. A/B test output quality.

2. **Phase 2 — Silence-cutter stream copy** (low risk): Switch `_extract_segments` and `_concatenate_segments` to `-c copy`. Validate that A/V sync holds and that cut accuracy is sufficient for silence removal. Test with multiple videos — edge case is sources with very low keyframe density.

3. **Phase 3 — Finalizer tuning** (low risk): Change CRF 20→18, preset `medium`→`slow`, add `flags=lanczos` + `unsharp` to filter chain, add `-tune film`. Re-run existing test suite.

4. **Phase 4 — Upscaler container** (optional, GPU required): Implement only if Path A result still does not close the gap with Instagram reels after A/B review. Requires GPU hardware.

---

## Sources

- Context7 `/remotion-dev/remotion` — `scale`, `crf`, `x264Preset`, `colorSpace`, `imageFormat`, `jpegQuality` parameters (HIGH confidence)
- https://www.remotion.dev/docs/scaling — `scale` option behavior: what it affects (HTML/SVG, not video pixels), max value 16, automatic rounding since v4.0.328
- https://www.remotion.dev/docs/quality — quality guide: bt709 colorspace, PNG vs JPEG, CRF
- https://ffmpeg.party/guides/x264/ — CRF ranges, preset recommendations, `-tune film` for live-action, x264 keyint and aq-mode params
- https://streaminglearningcenter.com/ffmpeg/maximizing-quality-and-throughput-in-ffmpeg-scaling.html — Lanczos vs bicubic VMAF benchmark (~10% gain), recommendation to never use `-s` default scaling
- https://slhck.info/video/2017/02/24/crf-guide.html — CRF guide: CRF 18 = visually transparent for H.264 (MEDIUM confidence — dated but widely cited)
- https://github.com/xinntao/Real-ESRGAN — model names, CPU/GPU requirements, Python API, PyPI installation
- https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan — NCNN implementation: GPU-only, no CPU fallback confirmed, last release April 2022
- https://github.com/flickleafy/real-esrgan-reboot — CPU fallback via `--device cpu`, Python 3.8+
- Real-ESRGAN CPU performance: GitHub issue #22 (xinntao/Real-ESRGAN), community NAS reports (LOW confidence — community estimates, no official benchmarks)
- Social platform codec compatibility: Instagram H.264-only confirmed via community documentation (MEDIUM confidence)

---

*Stack research for: v1.1 Calidad de Video — video quality/definition improvements*
*Researched: 2026-05-20*
