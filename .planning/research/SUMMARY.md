# Project Research Summary

**Project:** reel-factory — v1.1 Calidad de Video
**Domain:** Video quality/definition improvements for containerized Remotion + FFmpeg talking-head pipeline
**Researched:** 2026-05-20
**Confidence:** HIGH

## Executive Summary

The reel-factory pipeline reaches end users through three lossy H.264 re-encode passes before Remotion even renders subtitles, with no explicit CRF settings in the silence-cutter and no color-space metadata on any output. These upstream losses compound: by the time Remotion composites text at 1x scale (the current default), the background video has already been through CRF 23 twice and CRF 20 once. The result is visible blocking on faces, soft subtitle letterforms, and washed-out color on devices that interpret untagged HD video as BT.601 rather than BT.709. Research confirms that the majority of the perceptual quality gap with native Instagram Reels can be closed through parameter-only changes — no new Docker containers, no GPU dependency, no model weights.

Two implementation paths are clearly differentiated. **Path A (settings-only)** addresses encode quality, Remotion supersampling, and color tagging: silence-cutter switches to `-c copy` for the concat step (stream-copy, zero generation loss), the finalizer tunes CRF 18 + Lanczos downscale + mild `unsharp` + BT.709 color tags, and `renderMedia` adds `scale: 2`, `crf: 16`, `x264Preset: 'slow'`, `colorSpace: 'bt709'`, and `jpegQuality: 95`. These changes are all additive parameters with zero structural risk. **Path B (AI upscaling)** uses Real-ESRGAN PyTorch (`RealESRGAN_x4plus`, CPU fallback `--device cpu`) as a new Docker step inserted after Remotion. Path B is deferred: it requires GPU for production use, adds significant render time (10-60 min per video on RTX 3060), and delivers marginal ROI on high-quality 1080p mobile source material that Path A already handles well.

The critical nuance guiding build order: Remotion `scale: 2` sharpens subtitle text and all React-rendered overlays (they re-rasterize at 2160x3840 deviceScaleFactor), but it does **not** improve the background video track — `<OffthreadVideo>` decodes at the source's native resolution regardless of scale. Video sharpness for the talking-head footage comes from eliminating upstream re-encodes, tuning CRF, applying Lanczos + mild `unsharp` in the finalizer, and (optionally) Real-ESRGAN. The recommended build order is therefore: (1) encode-quality config wins, (2) Remotion supersampling + quality-finalizer downscale step, (3) optional AI upscaling gated on a confirmed remaining gap and verified GPU availability.

## Key Findings

### Recommended Stack

The existing stack requires no new dependencies for Path A. Remotion 4.0.457 already supports `scale`, `crf`, `x264Preset`, `colorSpace`, and `jpegQuality` in `renderMedia()` — all parameters simply need to be passed. FFmpeg 7.1.1 (compiled in base-python) has Lanczos scaling (`flags=lanczos`), the `unsharp` filter, and `-c copy` stream copy all available natively. The only structural addition for Path A is a new `quality-finalizer` Docker container (Python + FFmpeg, same base image as ffmpeg-finalizer) that receives the 2160x3840 Remotion output and downscales it to the 1080x1920 deliverable — this is the mandatory companion step whenever `scale: 2` is used, because Remotion with `scale: 2` outputs a 2160x3840 file that Instagram rejects at that resolution.

Path B adds a new `upscaler` container (CUDA base image, `realesrgan==0.3.0` + `torch` + `basicsr`) with a `USE_GPU` env var. CPU mode exists but is development-only (~0.3-0.5 fps; a 2-min video takes 4-8 hours). The container must run **after** `remotion-renderer` to avoid upscaling raw footage and then having Remotion re-encode it back to 1080x1920 anyway, which would destroy all AI-upscaling work.

**Core technologies:**
- **Remotion 4.0.457**: subtitle burn-in via headless Chromium — add `scale: 2`, `crf: 16`, `x264Preset: 'slow'`, `colorSpace: 'bt709'`, `jpegQuality: 95`
- **FFmpeg 7.1.1 (libx264)**: all encode/decode/filter — silence-cutter concat switches to `-c copy`; finalizer tunes CRF 18 + Lanczos + `unsharp=5:5:0.5:5:5:0.3` + BT.709 color tags
- **quality-finalizer (new container)**: Lanczos downscale 2160x3840 to 1080x1920, CRF 18, `-c:a copy` — mandatory companion to `scale: 2`
- **Real-ESRGAN PyTorch 0.3.0 (optional, Path B)**: `RealESRGAN_x4plus` model; GPU-only for production; deferred until Path A is validated

### Expected Features

**Must have for v1.1 (P1 — close the quality gap, zero new infrastructure):**
- `scale: 2` in `renderMedia` — fixes the most visible defect (blurry subtitle text); single parameter addition to `render.ts`
- `jpegQuality: 95` in `renderMedia` — reduces JPEG DCT artifacts at high-contrast text edges before final encode
- `crf: 16` in `renderMedia` — explicit quality floor for Remotion's final H.264 encode
- Stream copy (`-c copy`) in silence-cutter concat step — eliminates one full lossy H.264 re-encode with zero quality cost
- BT.709 color tags in ffmpeg-finalizer — prevents washed-out output from HDR-to-SDR mishandling on Instagram; `color_space=bt709` currently MISSING from all outputs
- CRF 18 in ffmpeg-finalizer (was CRF 20) — consistent high-quality encode for the pre-Remotion pass
- `quality-finalizer` new container — Lanczos downscale of `scale: 2` Remotion output to deliverable 1080x1920

**Should have after P1 validation (v1.1.x):**
- Mild `hqdn3d=1.5:1.5:6:6` denoise in ffmpeg-finalizer — better bitrate efficiency on noisy source footage; keep luma_spatial at or below 1.5 to avoid ghosting
- `imageFormat: 'png'` opt-in flag — for archive renders where render time is acceptable; marginal benefit over `scale: 2` + `jpegQuality: 95`

**Defer to v1.2+ (Path B, GPU required):**
- Real-ESRGAN AI upscaling step — only after GPU availability is confirmed and Path A demonstrably does not close the gap
- Per-platform bitrate profile config — when creators deliver to multiple platforms with different specs

**Anti-features confirmed by research (do not implement):**
- 4K output (Instagram caps at 1080p; a 4K upload is re-encoded to 1080p, adding zero perceptual value)
- `unsharp` strength above luma 0.5 (produces visible halos on subtitle text and skin)
- 60fps output (more aggressively compressed by both Instagram and TikTok; no perceptual benefit for talking-head content)
- H.265/HEVC output (Instagram's H.265 path is less tested; TikTok re-encodes anyway)
- Real-ESRGAN on CPU in production (~4-8 hours per 2-min video)

### Architecture Approach

The pipeline honors a strict step contract (INPUT_PATH to process to OUTPUT_PATH + manifest.json) and inserts new behavior either as config extensions to existing containers (adding env vars with safe defaults) or as new Docker containers inserted into the orchestrator STEPS array. No structural refactoring of existing steps is needed. The v1.1 architecture adds one mandatory new step (`quality-finalizer`, always-on when `REMOTION_SCALE > 1`) and one optional new step (`upscaler`, gated by `ENABLE_AI_UPSCALING`). Existing steps receive only parameter changes readable from environment variables.

**Major components and their v1.1 changes:**
1. **silence-cutter** — concat step: `-c:v libx264` changed to `-c copy` (stream copy, lossless)
2. **ffmpeg-finalizer** — CRF 20 to CRF 18, add `flags=lanczos` + `unsharp=5:5:0.5:5:5:0.3` + `-colorspace bt709 -color_primaries bt709 -color_trc bt709`
3. **remotion-renderer** — add `scale: 2`, `crf: 16`, `x264Preset: 'slow'`, `colorSpace: 'bt709'`, `jpegQuality: 95` to `renderMedia()` call; read from env vars with safe defaults
4. **quality-finalizer (NEW)** — Python/FFmpeg container; `scale=1080:1920:flags=lanczos`, CRF 18, `-c:a copy`, `-movflags +faststart`; mandatory when `REMOTION_SCALE=2`
5. **upscaler (NEW, optional, Path B)** — CUDA container; Real-ESRGAN PyTorch; `RealESRGAN_x4plus`; frame-extract to AI-upscale to reassemble; `--tile 256` required to avoid GPU OOM

### Critical Pitfalls

1. **Triple H.264 re-encode compounding generation loss (A-1)** — the silence-cutter concat currently re-encodes at default CRF 23 (no explicit flag), then the finalizer at CRF 20, then Remotion again. Prevention: switch silence-cutter concat to `-c copy`; tune finalizer to CRF 18; confirm Remotion CRF with explicit `crf: 16` param. Verify with ffprobe per-step bitrate.

2. **`scale: 2` on Remotion does NOT improve video sharpness (A-2)** — `scale` sharpens subtitle text and SVG overlays by rendering them at 2x deviceScaleFactor; it does not upscale the background `<OffthreadVideo>` pixels. Misunderstanding this leads to investing in supersampling and expecting video definition improvements that will not appear. Video track sharpness requires CRF tuning + Lanczos + optional AI upscaling.

3. **BT.709 color tags are MISSING from all current outputs (A-6)** — ffmpeg-finalizer emits `-pix_fmt yuv420p` with no color metadata. Players and platforms treat untagged HD output inconsistently (BT.601 vs BT.709 matrix), producing washed-out or green-shifted colors. Adding just `-colorspace bt709` as a metadata tag does NOT perform the conversion — the `colorspace` FFmpeg filter is needed if the source is sRGB. Remotion Chromium renders in sRGB; `colorSpace: 'bt709'` in `renderMedia()` (supported since Remotion 4.0.138, confirmed available in 4.0.457) performs the actual conversion. Verify with `ffprobe -show_streams output.mp4 | grep color`.

4. **`scale: 2` requires a mandatory post-Remotion downscale step (A-2 / architecture anti-pattern)** — Remotion with `scale: 2` produces a 2160x3840 MP4. Using this as the deliverable causes Instagram to reject or aggressively re-compress it. The `quality-finalizer` container must always accompany `scale: 2` in the STEPS array. Never ship a 2x-scaled Remotion output directly.

5. **Real-ESRGAN GPU OOM without tiling and GPU passthrough uncertainty in WSL2 (B-1, B-2)** — Real-ESRGAN processing a full 1080x1920 frame requires 4-8 GB VRAM. Without `--tile 256`, the container crashes with a cryptic exit code. Additionally, GPU passthrough in WSL2 requires explicit Docker Desktop configuration; `nvidia-smi` inside the container must be verified before any Path B implementation begins. Path B is deferred until this is confirmed.

## Implications for Roadmap

Based on combined research, the suggested phase structure is three phases matching the three implementation tiers — lowest-risk/highest-impact first, new-infrastructure second, optional-GPU-dependent third.

### Phase 1: Encode Quality Wins (Config-Only)

**Rationale:** These are the highest-impact changes with the lowest risk. They touch only constants and flag lists in existing files — no new containers, no new dependencies, no Docker changes. Each change is independently revertable. Fixing the root-cause quality losses upstream makes every subsequent step more effective.

**Delivers:** Elimination of the silence-cutter concat re-encode (the largest single source of generation loss), correctly tuned CRF for the finalizer, BT.709 color tags on all outputs (fixes the washed-out color risk that is currently present in production).

**Addresses from FEATURES.md:** Stream-copy in silence-cutter concat, CRF 18 in ffmpeg-finalizer, BT.709 color tags — all P1 table stakes.

**Files changed:**
- `services/silence-cutter/src/cut_video.py` — `_concatenate_segments` switches to `-c copy` (~2 lines)
- `services/ffmpeg-finalizer/src/config.py` — `H264_CRF = 18` (was 20, 1 line)
- `services/ffmpeg-finalizer/src/crop.py` — add `flags=lanczos`, `unsharp=5:5:0.5:5:5:0.3`, `-colorspace bt709 -color_primaries bt709 -color_trc bt709` to filter chain and encode flags

**Avoids:** Pitfall A-1 (triple re-encode), A-3 (CRF too high), A-6 (wrong color space — currently a production risk).

**Research flag:** No additional research needed. All parameters verified against official docs. Standard patterns.

**Verification:** ffprobe color metadata on finalizer output shows `color_space=bt709`; ffprobe bitrate on silence-cutter concat output confirms stream-copy (no new encode timestamp); ffprobe bitrate on finalizer output lands in 5,000-8,000 kbps range for 60s talking-head clip.

---

### Phase 2: Remotion Supersampling + quality-finalizer Step

**Rationale:** Depends on Phase 1: fixing upstream encode quality first means Remotion receives higher-quality input. The `scale: 2` param sharpens subtitles dramatically but requires the new `quality-finalizer` container to downscale the 2160x3840 output back to 1080x1920. These must be built and deployed together — enabling `scale: 2` without `quality-finalizer` produces an undeliverable 4K file.

**Delivers:** Sharp subtitle text at 2x render density, correct Remotion color conversion (BT.709 in `colorSpace` param), reduced JPEG artifact accumulation (`jpegQuality: 95`), and the final deliverable at 1080x1920 via Lanczos downscale with one high-quality encode pass.

**Addresses from FEATURES.md:** `scale: 2` supersampling (P1 highest priority, most visible defect), `jpegQuality: 95`, `crf: 16` in Remotion, `quality-finalizer` Lanczos downscale.

**Files changed / created:**
- `services/remotion-renderer/src/render.ts` — add `scale`, `crf`, `x264Preset`, `colorSpace`, `jpegQuality` to `renderMedia()` call, read from env vars with safe defaults (~5 lines)
- `services/quality-finalizer/` — new Docker container (Python + FFmpeg, inherits base-python); Dockerfile, `main.py`, `src/config.py`, `src/downscale.py`
- `services/api-server/src/orchestrator.ts` — add `quality-finalizer` to STEPS array after `remotion-renderer`; set `REMOTION_SCALE=2` env var for remotion-renderer step; update `videoUrl` to point to `quality-finalizer/output.mp4`

**Avoids:** Pitfall A-2 (scale without downscale step = 4K deliverable); anti-pattern "scale=2 without a downscale step."

**Research flag:** Measure render time impact of `scale: 2` before finalizing. Current render time is ~693s at scale=1; estimate ~2,800s at scale=2. If unacceptable, evaluate `scale: 1.5` (~1,560s estimate) or increase `concurrency` in `renderMedia()`. Benchmark required before finalizing scale value. Also verify that `-reset_timestamps 1` in silence-cutter concat remains compatible with `-c copy` — if A/V sync issues appear after switching to stream-copy, investigate that interaction.

---

### Phase 3: Optional AI Upscaling (Path B, GPU-Gated)

**Rationale:** Deferred until Phases 1 and 2 are complete and a quality gap demonstrably remains after A/B comparison against a reference Instagram Reel. Modern 1080p mobile camera footage is already at sensor resolution limit; AI upscaling on this material delivers diminishing returns and costs 10-60 min of GPU time per video. Path B is high-complexity (new CUDA container, model weights, frame-extract/reassemble pipeline) with uncertain ROI until Path A is measured.

**Delivers:** Per-pixel supersampling of the video track via Real-ESRGAN (`RealESRGAN_x4plus`, 4x upscale then Lanczos downscale back to 1080x1920), providing perceptual sharpness enhancement on the background footage that `scale: 2` alone cannot address.

**Pre-conditions (all must be true before implementing):**
1. `nvidia-smi` runs successfully inside a Docker container in the actual deployment environment
2. A/B visual comparison confirms Path A output still has a visible gap vs reference content
3. GPU VRAM is at least 6 GB (for `--tile 256` mode with `RealESRGAN_x4plus`)

**Files to create:**
- `services/upscaler/` — new Docker container (CUDA base image, not base-python); `realesrgan==0.3.0`, `torch`, `basicsr`, `opencv-python-headless`; frame-extract to AI-upscale to reassemble pipeline; `--tile 256 --tile-pad 16` required
- `services/api-server/src/orchestrator.ts` — add `upscaler` to STEPS array after `quality-finalizer` (optional, gated by `ENABLE_AI_UPSCALING` env var)

**Avoids:** Pitfall B-1 (CPU too slow — only enable with confirmed GPU), B-2 (GPU OOM — always use `--tile 256`), B-3 (temporal flickering — apply `hqdn3d=0:0:3:3` temporal-only pass after upscaling), B-5 (subtitles softened — upscaler runs after Remotion; the 4x-then-downscale pattern acts as a perceptual sharpener on composite output, not a raw subtitle pass).

**Research flag:** GPU passthrough in WSL2 must be confirmed with `nvidia-smi` in container before any Path B work begins. This is the primary blocker. Also run temporal coherence test (5-second static clip, frame-by-frame flat region inspection) before committing to Path B architecture.

---

### Phase Ordering Rationale

- **Phase 1 before Phase 2** because encode-quality wins are prerequisites: `scale: 2` supersampling is most impactful when the input video arriving at Remotion is already high-quality. Fixing CRF and eliminating the concat re-encode upstream means Remotion has better source material to composite.
- **Phase 2 as a unit** because `scale: 2` and `quality-finalizer` are co-dependent — neither is correct without the other. Build, test, and merge them together.
- **Phase 3 last and conditional** because: (a) Path A may close the perceptual gap entirely; (b) GPU availability in WSL2 is unverified; (c) temporal flickering must be validated before committing the architecture.
- **BT.709 color tags span both Phase 1 and Phase 2** — the finalizer gets FFmpeg color flags in Phase 1; Remotion gets `colorSpace: 'bt709'` in Phase 2. Both are needed; the Remotion param is the more important one because it performs the actual sRGB-to-YUV conversion, not just metadata tagging.

### Research Flags

Phases needing measurement/validation during planning:

- **Phase 2:** Measure render-time impact of `scale: 2` on a representative clip before finalizing scale value. If ~2,800s is too slow for the batch workflow, evaluate `scale: 1.5` or increase `renderMedia({ concurrency })`. This benchmark gates the phase plan.
- **Phase 2:** Verify stream-copy (`-c copy`) in silence-cutter concat does not introduce A/V sync drift. Test with multiple clips including those with variable keyframe density. Check A/V stream durations with ffprobe (within plus or minus 33ms).
- **Phase 3:** Confirm `nvidia-smi` accessible inside Docker container in the WSL2 deployment environment. Hard prerequisite for any Phase 3 work.
- **Phase 3:** Run temporal coherence test (5-second static clip, frame-by-frame flat region inspection) before committing to Path B architecture.

Phases with standard, well-documented patterns (skip additional research):

- **Phase 1 (encode settings):** All FFmpeg parameters are official, verified against docs and benchmarks. No research needed during planning.
- **Phase 2 (quality-finalizer container):** Follows the exact same pattern as ffmpeg-finalizer (Python + FFmpeg, same base image, same manifest contract). Architecture is clear from code audit.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All Remotion parameters verified via Context7 + official docs; FFmpeg settings verified via official guides and VMAF benchmarks; library versions confirmed against codebase |
| Features | HIGH | Render/encode specifics verified; platform delivery specs confirmed via official sources; anti-features confirmed with documented rationale |
| Architecture | HIGH | Based on direct code audit of all pipeline services; step contract verified from source; new container pattern matches existing ffmpeg-finalizer exactly |
| Pitfalls | HIGH | Color space pitfall confirmed via ffprobe evidence (color_space missing); generation loss confirmed by CRF audit; Remotion scale behavior confirmed in official docs |

**Overall confidence:** HIGH

### Gaps to Address

- **Render time at scale: 2** — current render time is ~693s at scale=1. Estimate for scale=2 is ~2,800s but this is unverified. Measure on a representative clip before Phase 2 planning. If unacceptable, `scale: 1.5` is a valid middle ground.
- **Stream-copy timestamp compatibility** — the `-reset_timestamps 1` flag in the concat step is currently paired with a re-encode. Verify it works correctly with `-c copy`. Community sources confirm it does, but test with actual pipeline content including edge cases (variable keyframe spacing, audio-shorter-than-video segments).
- **GPU availability in WSL2** — unverified whether Docker Desktop's GPU passthrough is configured for this deployment. Run `nvidia-smi` inside a container with `DeviceRequests: nvidia` before any Path B planning. If unavailable, Path B is off the table entirely.
- **Path A closes the gap?** — the most important open question. After Phases 1 and 2, run an A/B comparison against a reference Instagram Reel on the actual target device. Define "closed" before starting Phase 1 (e.g., "indistinguishable at normal viewing distance on an iPhone 14 screen").

## Sources

### Primary (HIGH confidence)
- Context7 `/remotion-dev/remotion` — `scale`, `crf`, `x264Preset`, `colorSpace`, `imageFormat`, `jpegQuality` parameters verified against source
- https://www.remotion.dev/docs/scaling — scale behavior: what it affects (HTML/SVG, not video), max value, rounding since 4.0.328
- https://www.remotion.dev/docs/quality — bt709 colorspace, PNG vs JPEG, CRF guidance
- https://www.remotion.dev/docs/renderer/render-media — renderMedia() API parameter list
- https://streaminglearningcenter.com/ffmpeg/maximizing-quality-and-throughput-in-ffmpeg-scaling.html — Lanczos vs bicubic VMAF benchmark (~10% gain)
- Code audit: `services/silence-cutter/src/cut_video.py`, `services/ffmpeg-finalizer/src/crop.py`, `services/ffmpeg-finalizer/src/config.py`, `services/remotion-renderer/src/render.ts`, `services/api-server/src/orchestrator.ts`

### Secondary (MEDIUM confidence)
- https://slhck.info/video/2017/02/24/crf-guide.html — CRF 18 = visually transparent for H.264 (widely cited, dated 2017 but consensus holds)
- https://sproutsocial.com/insights/social-media-video-specs-guide/ — Instagram Reels specs (H.264, 1080x1920, 3.5-10 Mbps)
- https://stackinfluence.com/tiktok-video-sizes-the-ultimate-2025-guide/ — TikTok specs (H.264 High Profile, 8-15 Mbps VBR, 30fps)
- https://www.canva.dev/blog/engineering/a-journey-through-colour-space-with-ffmpeg/ — BT.709 vs BT.601 color space matrix in FFmpeg
- https://kdenlive.org/en/project/color-hell-ffmpeg-transcoding-and-preserving-bt-601/ — color space metadata tag vs actual pixel conversion distinction
- https://github.com/xinntao/Real-ESRGAN — model names, CPU/GPU requirements, Python API, PyPI installation

### Tertiary (LOW confidence)
- Real-ESRGAN GPU throughput estimates (RTX 3060: ~2-5 fps, CPU: ~0.3-0.5 fps) — community GitHub issues and NAS forum reports; no official benchmarks published
- Temporal flickering from single-frame SR models — Hedra blog post + arXiv 1807.07930 (perceptual consistency paper); severity on talking-head content is unverified for this specific pipeline

---
*Research completed: 2026-05-20*
*Ready for roadmap: yes*
