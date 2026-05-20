# Pitfalls Research

**Domain:** Video quality / definition improvements on a Docker pipeline (Remotion 4.x + FFmpeg 7.x, 1080x1920 9:16 H.264)
**Researched:** 2026-05-20
**Confidence:** HIGH

> Pitfalls are organized first by path (lightweight encode-settings vs AI-upscaling), then by integration concerns shared by both.

---

## PATH A — Lightweight Encode-Settings Pitfalls

These apply when the approach is: tune CRF/bitrate, reduce re-encode steps, add Remotion `scale`, sharpen with FFmpeg `unsharp`. No AI model required.

---

### Pitfall A-1: Generation Loss from the Existing Triple Re-Encode Chain

**What goes wrong:**
The current pipeline re-encodes video to H.264 three times before the final output: once in `silence-cutter/_extract_segments` (libx264, no CRF flag — defaults to CRF 23), once in `_concatenate_segments` (libx264, again default CRF), and once in `ffmpeg-finalizer` (libx264, CRF 20). Each lossy encode compounds DCT quantization error. Text edges, fine fabric texture, and hair detail accumulate blockiness and ringing with every pass. Remotion `renderMedia` then composites subtitles over a video that has already lost sharpness twice before it even enters Chromium.

**Why it happens:**
The silence-cutter uses `libx264` for segment extraction (not `-c copy`) because frame-accurate cuts require re-encoding — stream copy snaps to keyframes. The concat pass also re-encodes to reset timestamps. These are architecturally necessary but their CRF values are not tuned; both currently inherit libx264's default CRF 23.

**How to avoid:**
- Use a lossless or near-lossless intermediate format for silence-cutter output (e.g., `-c:v libx264 -crf 0` or `-c:v ffv1`) when the downstream step will do a final lossy encode anyway.
- Alternatively, collapse the two silence-cutter passes into one: extract segments and concat in a single filtergraph command so the video is encoded exactly once at that step.
- Ensure ffmpeg-finalizer CRF is set intentionally (currently 20 — fine) and is the last and only lossy encode before Remotion.
- Remotion's own encode (via `renderMedia`) is the final encode and must use a sufficiently low CRF or high bitrate.

**Warning signs:**
- ffprobe shows CRF field absent or "23" in the silence-cutter output segments.
- Visual blocking visible in static areas (background wall) after silence-cutter but before Remotion.
- `remotion-info.json` does not log the CRF used by Remotion — absence of this field means the default was assumed.

**Phase to address:**
Research phase (v1.1 Phase 1 — audit). Implementation in the encode-settings phase. Verify with per-step VMAF or SSIM measurements comparing input to each step's output.

---

### Pitfall A-2: Remotion `scale` Multiplies Chromium Memory and Render Time Non-Linearly

**What goes wrong:**
Remotion's `scale` parameter in `renderMedia` multiplies each frame's pixel dimensions. `scale: 2` on 1080x1920 output produces 2160x3840 frames internally — four times the pixel count. Each Chromium tab renders at this resolution before encoding. In Docker with the default 64 MB `/dev/shm`, Chromium OOMs and crashes mid-render with no useful error message. Even with `--disable-dev-shm-usage` (which the current config routes via `--gl=angle-egl`), render time grows roughly as `scale^2` and memory as `scale^2`.

Crucially: `scale` improves text and SVG sharpness (they are re-rasterized at the higher resolution), but it does NOT improve the sharpness of the source video frames. The `<OffthreadVideo>` element decodes at the video's native resolution. So `scale: 2` sharpens subtitle text but not the talking-head footage.

**Why it happens:**
Developers see "scale = higher quality" and set `scale: 2` expecting improved video detail. The actual benefit is limited to vector/CSS elements. The cost is quadrupled rendering work.

**How to avoid:**
- Use `scale: 1` as default; only raise it if text rendering artifacts (aliased edges on letters at 1x) are confirmed by visual inspection on target device.
- If text sharpness needs improvement, prefer higher `fontSize` + `outlineWidth` tuned values over raising `scale`.
- If `scale: 1.5` is chosen, increase `timeoutInMilliseconds` beyond the current 120000 ms (the current render often finishes in ~30-60s but a 1.5x scale can push individual frame rendering over the per-frame timeout).
- Set Docker memory limits explicitly (`--shm-size=512m`) when testing scale > 1.

**Warning signs:**
- Chromium process killed mid-render with exit code 137 (OOM).
- `timeoutInMilliseconds` exception: "A delayRender() call was not resolved after 120000ms".
- Render time doubles or triples with no noticeable improvement in video (background) sharpness.

**Phase to address:**
Research phase (v1.1 Phase 1). Document the distinction between text-sharpness gains and video-sharpness gains before encoding `scale` into the implementation plan. Test with scale 1 → 1.25 → 1.5 and measure render time + output quality side-by-side.

---

### Pitfall A-3: CRF Too High (Visible Blocking on Subtitle Text Areas)

**What goes wrong:**
H.264 CRF controls quality; higher values mean lower quality. At CRF 23+ (libx264 default), sharp edges in high-contrast text overlays — white/yellow subtitle letters on a dark background — produce DCT blocking and ringing at macroblock boundaries. The blocking is especially visible when text is static (constant across frames) because the encoder cannot distribute the error across motion.

The current `ffmpeg-finalizer` uses CRF 20, which is decent, but the upstream silence-cutter uses default CRF 23 twice. The final Remotion encode uses no explicit CRF (the `renderMedia` call has no `videoBitrate` or quality parameter set — it uses Remotion's internal default, which varies by codec).

**Why it happens:**
No explicit quality flag was set in `renderMedia`. Remotion's internal default for `h264` codec is CRF 18 (confirmed in Remotion v4 docs), but this is not documented in the codebase and could change between Remotion upgrades.

**How to avoid:**
- Add explicit `videoBitrate` or check Remotion's `crf` option in `renderMedia` call for h264. Target CRF 17-18 for the Remotion encode (final encode, text-heavy content).
- Raise ffmpeg-finalizer CRF from 20 to 18 for the pre-Remotion video pass.
- For Instagram Reels/TikTok: target output bitrate 5,000–8,000 kbps for 1080x1920. At 30fps, CRF 18 typically lands in this range for talking-head content.

**Warning signs:**
- Visible 16x16 px blocks around subtitle letter edges visible at 1:1 zoom in VLC.
- FFprobe shows bitrate below 3,000 kbps on the final output for 1080x1920 talking-head content.
- Platforms re-compress the upload (Instagram shows the "processing" spinner for > 15 min).

**Phase to address:**
Encode-settings implementation phase. Use FFprobe to measure per-step bitrate and VMAF to compare CRF 20 vs 18 vs 16 on a representative clip.

---

### Pitfall A-4: CRF Too Low (File Too Large, Platform Re-Compression Defeats the Work)

**What goes wrong:**
Setting CRF below 15 for 1080x1920 30fps produces files of 80+ MB per minute of video. Instagram and TikTok impose upload size limits and silently re-compress uploads that exceed their internal bitrate ceiling (Instagram stores at ~3.5 Mbps, TikTok at ~2.5 Mbps). The platform's re-compression then applies a second lossy encode, undoing the quality investment and often producing worse results than a well-tuned single encode at CRF 18.

**Why it happens:**
"Lower CRF = better quality" is true in isolation but ignores the platform's ingest pipeline. Creators upload lossless or near-lossless files expecting preservation; platforms always transcode.

**How to avoid:**
- Target output bitrate 5,000–8,000 kbps (CRF 17-18 typically achieves this for 30fps 1080x1920 talking-head).
- Add a final `-maxrate 8M -bufsize 16M` constraint to ffmpeg-finalizer or a post-Remotion FFmpeg pass to cap bitrate.
- Verify file size: for a 60-second clip, 5–8 Mbps = 37–60 MB. Files above 100 MB for a 60-second clip are a warning sign.

**Warning signs:**
- Output file larger than 100 MB for a 60-second 1080p clip.
- Platform shows "processing" for unusually long time after upload.
- Downloaded platform copy looks visibly worse than the local file.

**Phase to address:**
Same as A-3. Bitrate floor and ceiling should both be tested and documented as acceptance criteria.

---

### Pitfall A-5: FFmpeg Sharpening Produces Haloing Artifacts on Text Edges and Skin Tone

**What goes wrong:**
FFmpeg's `unsharp` filter (the standard sharpening tool) works by subtracting a blurred version of the image from the original. Applied with too high a strength or too large a radius on video that already has subtitle text burned in, it creates bright halos around letter edges. On skin tones, it amplifies pores and stubble into distracting texture. On jump-cut boundaries, it creates a "pop" of exaggerated sharpness on the first frame after the cut.

**Why it happens:**
Developers use `unsharp=lx:ly:la` values tuned for photography (amount 1.0–2.0) rather than video (amount 0.3–0.6). Larger radius values (5x5 and above) produce visible halos. The filter is applied globally without masking edges vs. flat areas.

**How to avoid:**
- Use conservative values: `unsharp=3:3:0.4:3:3:0.0` (luma amount 0.4, no chroma sharpening to avoid color fringing).
- Apply sharpening BEFORE subtitle burn-in (i.e., to the background video before Remotion composites text), not after. This means sharpening in the ffmpeg-finalizer step, not in a post-Remotion pass.
- Test on a still frame extracted with FFmpeg (`-vframes 1`) before running full render.
- Consider luminance-only sharpening to avoid skin tone artifacts.

**Warning signs:**
- Bright white outlines visible around high-contrast edges when zoomed to 100%.
- Subtitle text appears to have a second glow border outside the designed outline.
- Skin takes on a textured, over-processed look.

**Phase to address:**
Encode-settings implementation phase. Visual QA must include zoomed-in frame inspection at 1:1 pixel ratio, not just playback at full-screen distance.

---

### Pitfall A-6: Wrong Color Space / Pixel Format Causes Washed-Out or Green-Shifted Output

**What goes wrong:**
The current `ffmpeg-finalizer` outputs `-pix_fmt yuv420p` without explicitly tagging BT.709 metadata (`-colorspace bt709 -color_primaries bt709 -color_trc bt709`). FFmpeg defaults to BT.601 matrix assumptions when color metadata is absent, and many players/platforms interpret untagged 1080p video as BT.709. The mismatch between actual matrix (BT.601) and assumed matrix (BT.709) causes saturation and luminance shifts — typically a slight green cast and desaturated skin tones.

Additionally, Remotion renders in sRGB (browser color space), and the subsequent H.264 encode converts to YUV limited range. If this conversion is done with the wrong input transfer function, the result is faded highlights and crushed shadows. Critically: adding `-colorspace bt709` metadata tag does NOT perform the conversion — it only labels the stream. The actual pixel transform requires the FFmpeg `colorspace` filter.

**Why it happens:**
- The current `apply_finalizer` in `crop.py` emits no `-colorspace`, `-color_primaries`, or `-color_trc` flags. The video is tagged as unspecified and treated as BT.601 by default (FFmpeg's fallback for SD-and-below resolutions) or BT.709 for HD — inconsistently across players.
- Remotion's Chromium renderer works in sRGB; its output frames are sRGB. The FFmpeg encode inside Remotion uses libx264 which converts from the intermediate format to YUV limited range. If the color profile flags are not set on the Remotion output, downstream tools guess.

**How to avoid:**
- Add explicit BT.709 tags to `ffmpeg-finalizer` output: `-colorspace 1 -color_primaries 1 -color_trc 1` (numeric values for bt709).
- Do NOT use just metadata flags to perform conversion. If the source is sRGB (e.g., from Chromium), use the `colorspace` filter to correctly transform: `-vf "colorspace=all=bt709:iall=bt709:itrc=srgb"`.
- Verify with FFprobe: `ffprobe -show_streams output.mp4 | grep color` should show `color_space=bt709`, `color_primaries=bt709`, `color_transfer=bt709`.
- Test: side-by-side comparison of a color checker or skin tone reference on a calibrated display.

**Warning signs:**
- FFprobe shows `color_space=unknown` or `color_space=smpte170m` (BT.601) on HD output.
- Slight green tint or desaturated pastels compared to the original camera footage.
- Colors shift when comparing output in VLC vs Chrome vs iPhone.

**Phase to address:**
Research phase (v1.1 Phase 1, confirm current tags). Fix in encode-settings phase. Verification: FFprobe color metadata check as an automated test.

---

### Pitfall A-7: loudnorm Internal Resampling Introduces Subtle Audio Duration Drift

**What goes wrong:**
FFmpeg's `loudnorm` filter (used in the current `apply_finalizer`) internally upsamples audio to 192 kHz for accurate true-peak detection, then resamples back. The current command sets `-ar 44100` which forces the final sample rate, but if the resampling path introduces fractional sample rounding, the audio stream can end up fractionally longer or shorter than the video stream. Across 60+ silence cuts, these sub-millisecond drifts accumulate into a noticeable A/V sync offset at the end of long clips.

**Why it happens:**
Single-pass `loudnorm` is a best-effort estimate. Two-pass loudnorm (first pass measures, second applies) is more accurate but the current implementation does not use it. Additionally, the `apad` filter used in `_extract_segments` pads audio to video duration per-segment, which helps with per-segment sync but the concat step then re-encodes without `apad`, potentially re-introducing fractional drift.

**How to avoid:**
- Implement two-pass `loudnorm` in the ffmpeg-finalizer (measure pass then apply pass).
- After all re-encodes, verify A/V sync with: `ffprobe -show_entries stream=codec_type,duration output.mp4` and confirm video and audio durations agree within ±16ms (one frame at 60fps).
- Add `-async 1` to the final encode to correct minor drift during AAC encoding.

**Warning signs:**
- Audio duration and video duration differ by more than 33ms (one frame at 30fps) in ffprobe output.
- Lip sync appears correct at the start of a long video but drifts out of sync near the end.
- Platform video upload shows audio offset warning.

**Phase to address:**
Encode-settings implementation phase. Add a post-render A/V duration check as a mandatory verification step in the pipeline manifest.

---

## PATH B — AI Upscaling Pitfalls

These apply when the approach includes a super-resolution step (Real-ESRGAN or equivalent) as a Docker service inserted after the ffmpeg-finalizer or before Remotion.

---

### Pitfall B-1: Real-ESRGAN on CPU is Prohibitively Slow (1–3 fps)

**What goes wrong:**
Real-ESRGAN (PyTorch or NCNN) runs at 1–3 fps on CPU for 1080p frames. A 60-second video at 30fps = 1,800 frames. At 2 fps CPU throughput, that is 15 minutes per video. On a GPU-less Docker host (WSL2 on a machine without GPU passthrough), this blocks the pipeline completely.

**Why it happens:**
Real-ESRGAN uses convolutional neural networks with millions of parameters. Inference without GPU acceleration falls back to CPU BLAS, which is orders of magnitude slower than CUDA or Vulkan inference.

**How to avoid:**
- Before implementing the AI-upscaling path, verify GPU availability in the Docker environment: `nvidia-smi` inside the container. If unavailable, do not implement this path.
- Use Real-ESRGAN-ncnn-vulkan as the CPU/GPU-agnostic fallback — it uses Vulkan compute and can run on integrated GPUs at 5–15 fps.
- Set processing timeout in the Docker container to 20 minutes and alert when exceeded.
- Consider frame skipping (upscale 1 in N frames, blend) to reduce load — but this introduces the temporal coherence pitfall (B-3).
- Provide a `ENABLE_AI_UPSCALING=false` env var to skip the step when GPU is absent.

**Warning signs:**
- Container health check timeout hit before processing completes.
- CPU utilization at 100% for >5 minutes on a video that should take <3 minutes.
- No `nvidia-smi` output inside the container.

**Phase to address:**
AI-upscaling research phase (v1.1, before any implementation). GPU availability must be confirmed as a hard prerequisite.

---

### Pitfall B-2: GPU OOM Crash for 1080x1920 Tiles Without Tiling Configuration

**What goes wrong:**
Real-ESRGAN upscaling a full 1080x1920 frame in one pass requires 4–8 GB VRAM for the standard x4 model. Consumer GPUs (RTX 3060: 12 GB, RTX 3070: 8 GB) may fit, but Docker containers without explicit `--gpus all` and `--shm-size` settings crash with cryptic CUDA OOM errors that look like process exits rather than GPU memory errors.

**Why it happens:**
The ESRGAN model allocates the full frame as a tensor in GPU memory. Without tiling, a 1080x1920 input produces a 4320x7680 output tensor. At fp32, this is ~400 MB just for the output, plus intermediate activations.

**How to avoid:**
- Always enable tiling: `--tile 256` or `--tile 512` in the Real-ESRGAN CLI. Tiling divides each frame into smaller patches, processes them individually, and stitches the output. Memory usage drops to 1–2 GB VRAM.
- Tiling introduces seam artifacts if the tile overlap (`--tile-pad`) is too small. Use `--tile-pad 16` minimum.
- Start Docker with `--gpus all --shm-size=4g`.
- Test with the smallest model first: `realesr-general-wdn-x4v3` (lighter than `RealESRGAN_x4plus`).

**Warning signs:**
- Process exits with code 1 and "CUDA error: out of memory" in logs.
- Container killed by Docker OOM killer (check `docker inspect` for `OOMKilled: true`).
- Tiling not configured — all production runs must verify `--tile` is set.

**Phase to address:**
AI-upscaling implementation phase. Docker Compose for the AI service must include explicit GPU flags and shm-size.

---

### Pitfall B-3: Temporal Flickering Between Upscaled Frames

**What goes wrong:**
Real-ESRGAN (and most single-frame super-resolution models) processes each frame independently. For a static background (wall, gradient), the model hallucinates slightly different texture detail in each frame — a patch of plaster that appears slightly smoother in frame N and slightly coarser in frame N+1. At 30fps, this manifests as a shimmering, flickering noise that is highly visible on smooth areas and makes the video look unstable or AI-processed.

**Why it happens:**
Single-image SR models have no temporal loss term — they optimize for perceptual quality of one frame at a time without considering frame-to-frame consistency. The hallucinated detail is non-deterministic across frames even for identical pixel regions.

**How to avoid:**
- Use a video-native SR model (e.g., `realesr-animevideov3`) rather than the photo-oriented `RealESRGAN_x4plus`. Video models incorporate temporal consistency losses.
- Apply a light temporal denoise filter after upscaling: FFmpeg `hqdn3d=0:0:3:3` (spatial=0, temporal=3) to smooth inter-frame variation without blurring spatial detail.
- Test by extracting 100 consecutive frames and inspecting a flat region (wall background) frame-by-frame.
- If flickering persists, reconsider whether AI upscaling is the right tool for talking-head footage where the background is nearly static.

**Warning signs:**
- Shimmering or "boiling" visible in smooth background areas during playback.
- Skin texture changes frame-to-frame on a static subject.
- VBR bitrate spikes to maximum on "unchanged" frames because the encoder detects motion from flickering texture.

**Phase to address:**
AI-upscaling research phase. Temporal flickering test on a representative clip must pass before committing to this path.

---

### Pitfall B-4: AI Hallucination of Detail That Does Not Exist in Source

**What goes wrong:**
Super-resolution models are trained to produce plausible high-frequency texture where none exists in the low-resolution input. For a mobile camera talking-head, this means the model may synthesize facial pores, fabric weave, and background text that was never captured. The result looks "over-sharpened" or "painted" — artificial detail that degrades trust in the footage's authenticity.

Additionally, hallucinated detail in face regions can produce uncanny-valley skin texture. In extreme cases, facial features (eyes, teeth) take on slight distortions as the model tries to reconstruct sub-pixel information.

**Why it happens:**
The model's prior (what it learned plausible HD texture looks like) is applied where the source provides no real information. Modern mobile cameras at 1080p are sharp enough that x4 upscaling to 4320x7680 is almost entirely hallucination — there is no real detail at that scale from a mobile sensor.

**How to avoid:**
- Do not upscale more than x2 for talking-head mobile footage. At x2 (1080p → 2160p), some real detail recovery is plausible; at x4, it is predominantly synthesis.
- Keep the output resolution at 1080x1920 (do not upscale above the target output resolution). Use Real-ESRGAN only as a sharpness enhancement pass, not a resolution increase: upscale to 2160x3840 then downscale back to 1080x1920 in FFmpeg. This uses the model's detail generation but keeps the resolution constant, acting as a perceptual sharpener.
- Compare source frame vs. upscaled frame on a still subject. If fine details (individual hairs, fabric threads) appear that were absent in source, the model is hallucinating.

**Warning signs:**
- Background elements (text on a whiteboard, fabric patterns) appear sharper in the output than in the original and at a different scale.
- Facial features look "painted" or artificially textured.
- VMAF score is high but SSIM is low — VMAF rewards perceptual appeal while SSIM penalizes structural deviations from the reference.

**Phase to address:**
AI-upscaling research phase. Establish reference frame comparisons before deciding on upscaling ratio.

---

### Pitfall B-5: Upscaling After Subtitle Burn-In Softens and Distorts Subtitle Text

**What goes wrong:**
In the current pipeline, Remotion burns subtitles into the video as rendered pixels. If a Real-ESRGAN step is added after Remotion, the SR model processes subtitle text as image content. The model was trained on natural image content, not on typography. It will attempt to "restore" the sub-pixel structure of letters, producing subtly blurry, incorrectly kerned, or color-fringed subtitle text. The crisp subtitle rendering that Remotion produces is degraded.

**Why it happens:**
The pipeline order matters critically. Subtitles that are already burned in are opaque pixels to the upscaler — it has no semantic knowledge that they are text.

**How to avoid:**
- If using AI upscaling, insert the upscaler step BEFORE Remotion (upscale the background video, then let Remotion render sharp subtitles on top of the upscaled background).
- Pipeline order with AI upscaling: `silence-cutter → ffmpeg-finalizer → AI-upscaler → remotion-renderer`.
- If the upscaler must go after Remotion (e.g., to upscale the composited output), use a 1:1 pass that sharpens without upscaling resolution (upscale x2, downscale x2 in the same FFmpeg filter chain).
- The SRT file exporter step is unaffected because SRT timestamps do not embed in pixels — only ensure timestamps remain accurate after any resolution changes.

**Warning signs:**
- Subtitle text appears softer or has color fringing when inspected at 1:1 pixel ratio after the upscaling step.
- Letter edges show ringing or halos that were absent in the Remotion output.
- Text outlines blur into the text fill color.

**Phase to address:**
AI-upscaling architecture phase. Pipeline step ordering must be decided before any implementation work begins.

---

### Pitfall B-6: Diminishing Returns — Mobile Camera Already at Sensor Resolution Limit

**What goes wrong:**
Modern mobile cameras (iPhone 14+, Pixel 7+) record at 1080p or 4K with optical-quality lenses that approach their diffraction limit at the sensor resolution. The ffmpeg-finalizer already outputs 1080x1920 — the same resolution as the source. Running Real-ESRGAN x4 on this content and then downscaling back to 1080x1920 costs significant compute time for marginal visible improvement. The improvement is primarily perceptual sharpness (not resolution), which can be achieved more cheaply with FFmpeg `unsharp` at a fraction of the cost.

**Why it happens:**
AI upscaling was developed for upscaling low-resolution sources (240p → 1080p, old DVD content). Applied to already-HD mobile footage, it offers diminishing returns.

**How to avoid:**
- Benchmark: run the lightweight path (FFmpeg `unsharp` + CRF tuning) first. Measure VMAF and perceptual quality. Only add AI upscaling if the gap to the target quality level remains after the lightweight path is fully optimized.
- Define "target quality" visually (side-by-side with a reference Instagram Reel from a professional creator) before choosing tools.
- AI upscaling is worth the cost for: 720p input content, old recordings, screen recordings with compression artifacts. It offers minimal ROI for high-quality 1080p mobile footage.

**Warning signs:**
- Lightweight path (CRF 17, `unsharp` 3:3:0.4) achieves indistinguishable perceptual quality from the AI path in a blind comparison.
- AI processing time exceeds 5 minutes for a 60-second clip on the available hardware.

**Phase to address:**
Research phase (v1.1 Phase 1). Establish a quality baseline with lightweight settings before evaluating AI upscaling feasibility.

---

## Integration Gotchas

Common mistakes when connecting quality-improvement steps to the existing pipeline services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-----------------|
| silence-cutter → ffmpeg-finalizer | silence-cutter uses default CRF 23 (undocumented), finalizer uses CRF 20 — the worst encode is the first one | Set silence-cutter extraction to CRF 0 (lossless) or use a single re-encode and concat pass |
| ffmpeg-finalizer + colorspace | Adding `-colorspace bt709` metadata tag without the `colorspace` filter — tags the stream but pixels remain in wrong matrix | Use `colorspace=all=bt709:iall=bt709:itrc=srgb` filter OR verify the source is already BT.709 before tagging |
| loudnorm single-pass | Internal 192 kHz upsampling without explicit `-ar` flag produces 192 kHz output | Always pair loudnorm with `-ar 44100` (current config does this correctly — verify it stays in place after any audio chain changes) |
| AI upscaler → Remotion | Inserting upscaler after Remotion degrades burned-in subtitles | Insert upscaler before Remotion; Remotion renders fresh crisp text on top |
| FFmpeg re-encode after Remotion | Adding a "quality fix" pass after Remotion is a 4th lossy encode | Eliminate upstream re-encodes; do not add post-Remotion encodes for quality — only for container format changes |
| Docker GPU + Real-ESRGAN | Running Real-ESRGAN without `--gpus all` in docker-compose — silent fallback to CPU | Explicitly configure GPU resources in docker-compose; add health check that verifies CUDA availability at container start |
| SRT exporter after upscaling | Upscaling does not change timestamps — SRT remains valid | No change needed; verify by comparing silence-cutter timestamps against the final output duration |

---

## Performance Traps

Patterns that work at small scale but fail as video count or length grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No lossless intermediate in silence-cutter | Quality degrades across 3 encodes; tuning last encode does not help | Use lossless (-crf 0) for silence-cutter output | Immediately — even one video |
| Remotion scale 2 without concurrency limit | OOM kills container after 50% of frames rendered | Set scale max to 1.5; test Docker memory with 512 MB shm-size | At ~500 frames (17s of video) |
| Real-ESRGAN without tiling | GPU OOM on first frame at 1080p | Always pass --tile 256 | At 1080p+ resolution with standard x4 model |
| No per-step VMAF/SSIM check | Quality regressions invisible until user report | Add ffmpeg-quality-metrics or vmaf filter after each encode step in CI | Not a scale issue — quality always matters |
| Bitrate uncapped for batch jobs | One long video produces a 300 MB file; platform rejects or re-encodes | Add -maxrate 8M to final encode | At ~8 minutes of content at CRF 16 |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical verification.

- [ ] **Color space:** Output plays correctly in VLC AND in Chrome AND on iPhone — verify all three, not just the development machine player.
- [ ] **CRF tuning:** ffprobe confirms final output bitrate is in the 5,000–8,000 kbps range, not just "lower CRF was set."
- [ ] **Remotion scale:** Text sharpness visually confirmed on a 1:1 pixel crop screenshot — not just full-screen playback.
- [ ] **A/V sync:** `ffprobe` audio duration and video duration differ by < 33ms after all processing steps, not just "sounds OK on playback."
- [ ] **AI upscaling temporal coherence:** 5-second clip of a static background inspected frame-by-frame at 100% zoom — not just watched at real-time speed.
- [ ] **Subtitle integrity after upscaling:** Subtitle text from Remotion output compared to upscaled output at 1:1 pixel crop — crispness confirmed.
- [ ] **GPU availability:** `nvidia-smi` runs inside the Docker container in the actual deployment environment, not just the developer's machine.
- [ ] **Re-encode count:** ffprobe `codec_name` and generation count verified for each intermediate file — not just "the final output looks good."

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Triple re-encode already shipped to production | HIGH | Introduce lossless intermediate; requires silence-cutter change and re-test of full pipeline |
| Wrong colorspace on existing outputs | LOW | Re-run ffmpeg-finalizer with corrected flags; outputs are re-generated per job |
| Remotion scale OOM crash | LOW | Remove `scale` parameter (default 1); re-render affected jobs |
| Real-ESRGAN temporal flickering | MEDIUM | Switch to video-native model (realesr-animevideov3) + hqdn3d post-filter; no pipeline architecture change |
| Subtitles softened by post-Remotion upscaler | HIGH | Reorder pipeline (upscaler before Remotion); requires new step ordering, re-test of full integration |
| A/V sync drift discovered after deploy | MEDIUM | Add two-pass loudnorm and `-async 1` to ffmpeg-finalizer; re-process flagged jobs |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| A-1: Triple re-encode generation loss | Phase 1 (audit) + Phase 2 (encode settings) | ffprobe CRF on each step's output; per-step VMAF |
| A-2: Remotion scale memory/timeout | Phase 1 (audit) + Phase 2 (encode settings) | Render time benchmark at scale 1 vs 1.25 vs 1.5; Docker memory check |
| A-3: CRF too high (blocking on text) | Phase 2 (encode settings) | ffprobe bitrate on final output; visual inspection at 1:1 |
| A-4: CRF too low (platform re-compress) | Phase 2 (encode settings) | File size per minute measurement; post-platform download comparison |
| A-5: Over-sharpening haloing | Phase 2 (encode settings) | Frame screenshot at 100% zoom; unsharp amount <= 0.5 |
| A-6: Wrong color space | Phase 1 (audit) + Phase 2 (encode settings) | ffprobe `color_space=bt709` on all outputs |
| A-7: loudnorm A/V drift | Phase 2 (encode settings) | ffprobe duration comparison audio vs video +/- 33ms |
| B-1: Real-ESRGAN CPU too slow | Phase 3 (AI upscaling research) | Benchmark fps on target hardware before implementing |
| B-2: GPU OOM without tiling | Phase 3 (AI upscaling implementation) | Test with --tile 256 on 1080p frame; Docker OOMKilled=false |
| B-3: Temporal flickering | Phase 3 (AI upscaling research) | Frame-by-frame flat-region inspection on 5-second clip |
| B-4: AI hallucination | Phase 3 (AI upscaling research) | Side-by-side source vs output comparison on face region |
| B-5: Subtitles softened by upscaler | Phase 3 (AI upscaling architecture decision) | Pipeline order confirmed: upscaler before Remotion |
| B-6: Diminishing returns on mobile 1080p | Phase 3 (AI upscaling research) | Blind A/B test: lightweight path vs AI path at same output resolution |

---

## Sources

- Canva Engineering: A journey through colour space with FFmpeg — https://www.canva.dev/blog/engineering/a-journey-through-colour-space-with-ffmpeg/
- sRGB vs REC709 FFmpeg implementations — https://www.pixelsham.com/2025/08/07/srgb-vs-rec709-an-introduction/
- InVideo: Talking About Colorspaces and FFmpeg — https://medium.com/invideo-io/talking-about-colorspaces-and-ffmpeg-f6d0b037cc2f
- Kdenlive: Color Hell — FFmpeg Transcoding and Preserving BT.601 — https://kdenlive.org/en/project/color-hell-ffmpeg-transcoding-and-preserving-bt-601/
- Remotion renderMedia docs — https://www.remotion.dev/docs/renderer/render-media
- Remotion scaling docs — https://www.remotion.dev/docs/scaling
- Remotion Chromium flags — https://www.remotion.dev/docs/chromium-flags
- Headless Chromium at scale (OOM in Docker) — https://rendershot.io/blog/headless-chromium-fleet-memory
- goughlui: x264 CRF generational loss testing — https://goughlui.com/2016/11/22/video-compression-x264-crf-generational-loss-testing/
- slhck: CRF Guide (x264, x265) — https://slhck.info/video/2017/02/24/crf-guide.html
- Best Bitrate for Instagram Reels — https://www.freevisuals.net/post/best-bitrate-for-instagram-reels
- Best Instagram Reels Export Settings 2026 — https://www.stayabundant.com/blog/best-instagram-reels-export-settings
- FFmpeg loudnorm guide — https://32blog.com/en/ffmpeg/ffmpeg-audio-normalization-loudnorm
- Real-ESRGAN GitHub — https://github.com/xinntao/Real-ESRGAN
- Video2X AI upscaling review — https://www.videoproc.com/resource/video2x.htm
- Runpod: Upscaling Videos Using VSGAN and TensorRT — https://www.runpod.io/blog/upscaling-videos-vsgan-tensorrt
- Hedra: Fix Glitchy AI Video (temporal coherence) — https://www.hedra.com/blog/how-to-fix-glitchy-ai-video-consistency-upscaling
- Perceptual Video Super Resolution with Enhanced Temporal Consistency — https://arxiv.org/pdf/1807.07930
- Digital Anarchy: Sharpening Video Footage — https://digitalanarchy.com/blog/video-editing-plugins/sharpening-video-footage/
- John Paul Caponigro: How To Avoid Over-Sharpening Artifacts — https://www.johnpaulcaponigro.com/blog/16833/how-to-avoid-common-over-sharpening-artifacts/
- Mux: Your browser and my browser see different colors — https://www.mux.com/blog/your-browser-and-my-browser-see-different-colors

---
*Pitfalls research for: video quality / definition improvements (reel-factory v1.1 Calidad de video)*
*Researched: 2026-05-20*
