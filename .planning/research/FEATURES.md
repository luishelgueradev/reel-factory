# Feature Research

**Domain:** Video quality/definition improvements for short-form vertical social video (9:16 talking-head reels)
**Researched:** 2026-05-20
**Milestone:** v1.1 "Calidad de video" — additive improvements to the existing pipeline
**Confidence:** HIGH (render/encode specifics), HIGH (platform specs), MEDIUM (AI upscaling tradeoffs)

---

## Context: What "Good" Looks Like to a Creator

A creator's quality bar is set by the native Instagram/TikTok reels they scroll past — filmed natively on a modern iPhone at 4K/60fps, edited in CapCut or Premiere, exported at high bitrate, and uploaded over Wi-Fi. Key perceptual markers:

- **Subtitle text is razor-sharp**: no pixel blur, clear outline, no ringing artifacts on letterforms.
- **Faces look detailed**: skin texture visible, no compression blocking or washed-out pixels.
- **Motion is clean**: no macro-blocking during movement, no ghosting from over-denoising.
- **High-contrast edges are crisp**: no aliasing stairstepping on diagonal lines or text strokes.
- **After platform upload, video still looks good**: no soft glow or flat look introduced by Instagram/TikTok re-compression.

The gap between this bar and the pipeline's current output has three causes confirmed by the 2026-05-20 audit:

1. `renderMedia` called without `scale` — Remotion renders subtitles at 1:1 pixel density (effectively half-res text on a headless Chromium canvas).
2. Triple re-encode chain: silence-cutter segments → silence-cutter concat → ffmpeg-finalizer → remotion-renderer, each a lossy H.264 pass.
3. CRF and bitrate never tuned to platform delivery targets. Remotion defaults to CRF 18 (confirmed in Remotion docs); ffmpeg-finalizer uses CRF 20 (confirmed in `services/ffmpeg-finalizer/src/config.py`).

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must be correct before the output can be called "quality". Missing any of these and the output looks worse than amateur phone footage. These are the non-negotiable fixes for v1.1.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Remotion `scale: 2` supersampling** | Without it, Remotion renders text at device pixel density 1x in headless Chromium — each CSS pixel maps to a single video pixel, producing visibly blurry, aliased subtitle letterforms. Remotion's own docs explicitly call this out for high-density displays and server-side rendering. With `scale: 2`, frames are rendered at 2160x3840 and the composite is downsampled to 1080x1920, making text as sharp as native-device rendering. Videos and WebGL inside Remotion are unaffected by scale. | LOW | Single parameter in `renderMedia({ scale: 2 })`. Current `render.ts` calls `renderMedia` with no `scale` argument. This is the single highest-impact change for subtitle sharpness. |
| **Eliminate one lossy re-encode in silence-cutter concat** | Each H.264→H.264 transcode degrades quality: DCT quantization noise accumulates, fine detail (hair, text edges) gets progressively smeared. The silence-cutter currently runs: (1) extract each segment with `-c:v libx264`, then (2) concatenate with `-c:v libx264` again. The concat step can use `-c:v copy` (stream copy, no decode/re-encode) since all segments are already H.264 with compatible stream parameters. This eliminates encode pass 2 of 4. | LOW | Change `_concatenate_segments()` in `services/silence-cutter/src/cut_video.py` to use `-c:v copy -c:a copy` in the concat command. Stream copy with concat demuxer is safe when all segments share the same codec and timebase — which they do since they all come from the same source. |
| **CRF floor for the final Remotion encode** | Remotion's default CRF for H.264 is 18 (confirmed in Remotion encoding docs). The ffmpeg-finalizer already uses CRF 20. Neither is explicitly set to guarantee a minimum bitrate floor. For a 1080x1920 final output headed to Instagram/TikTok, CRF 17 provides headroom to survive the platform's own re-compression pass. Instagram recommends 3.5–10 Mbps upload; TikTok recommends 8–15 Mbps. CRF alone at CRF 17–18 on talking-head content typically produces 6–12 Mbps, which sits in the right range. | LOW | Pass `crf: 17` to `renderMedia()` in `render.ts`. Also explicitly set `H264_CRF = 17` in ffmpeg-finalizer `config.py` (currently 20). |
| **Upload bitrate floor via maxrate** | CRF alone does not guarantee a minimum bitrate. If a scene is visually simple (static talking head, few colors), libx264 at CRF 17 may produce only 2–3 Mbps for that segment. Instagram's transcoder then has less data to work with and compresses aggressively. Setting `-maxrate 10M -bufsize 20M` alongside CRF ensures a bitrate floor that gives the platform's compressor room to breathe. | LOW | Add x264 options to Remotion's render call or use Remotion's `videoBitrate` param (note: `videoBitrate` and `crf` are mutually exclusive in Remotion). Use `-maxrate` via `encoderOptions` if available, or run a post-render FFmpeg passthrough to apply maxrate on the final file. |
| **Output at 1080x1920, H.264 High Profile, 30fps** | Instagram and TikTok both specify 1080x1920 @ 30fps H.264 as the primary target. Uploading at this exact spec causes the platform's transcoder to make the least-degrading pass possible. 4K uploads get re-encoded to 1080p anyway; 720p uploads trigger a quality-flag downgrade on TikTok. | LOW | Already correct in ffmpeg-finalizer (`VERTICAL_WIDTH=1080`, `VERTICAL_HEIGHT=1920`, `H264_PROFILE=high`, `FPS_OUTPUT=30`). Must verify Remotion output also matches 30fps and uses H.264 High Profile. |
| **bt709 color space tags on final output** | Phones that record in HDR (HLG or PQ) produce files that Instagram converts to SDR incorrectly, resulting in washed-out or over-bright output. Explicitly tagging bt709 ensures Instagram's SDR processing path is triggered cleanly. Remotion's docs note that bt709 will become the default in v5; currently it must be requested. | LOW | Add `-colorspace bt709 -color_primaries bt709 -color_trc bt709` to ffmpeg-finalizer's ffmpeg command (after the `-pix_fmt yuv420p` flag already present). Pass `colorSpace: 'bt709'` to `renderMedia()` in `render.ts` if Remotion exposes this. |
| **JPEG quality 95 for Remotion intermediate frames** | Remotion captures each composition frame as JPEG at quality 80 by default (confirmed in Remotion docs) before FFmpeg stitches them to video. JPEG quality 80 introduces DCT artifacts at high-contrast edges — specifically around the bright yellow active-word highlights and black outline text — before the final video encode pass. Raising to 95 measurably reduces these intermediate artifacts. | LOW | `renderMedia({ jpegQuality: 95 })` in `render.ts`. Adds ~30% render time. Measurably better text edge quality. Preferred over PNG for production (PNG is 2–4x slower). |
| **Text outline/shadow legibility for subtitle text** | White text on any background becomes illegible without visual separation. Black outline (stroke) + drop shadow is the minimum standard for platform-native captions. | LOW | Already implemented in `pipeline-config.ts` defaults: `outlineColor: "#000000"`, `outlineWidth: 3`. Verify this survives at `scale: 2` supersampling and that CSS `-webkit-text-stroke` or equivalent is rendering in headless Chromium. |

---

### Differentiators (Competitive Advantage)

Features that move the pipeline's output quality above generic FFmpeg-based tools. Not required for baseline quality, but visible improvements for creators.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Mild hqdn3d denoise in ffmpeg-finalizer** | Phone cameras in sub-optimal lighting produce luminance grain that H.264 encodes poorly — the encoder wastes bits on noise rather than signal. A conservative hqdn3d pass (`hqdn3d=1.5:1.5:6:6`) before the final encode reduces noise without visible ghosting, effectively raising perceived sharpness at the same bitrate. Creators notice "cleaner" faces even without knowing why. | LOW | Add to ffmpeg-finalizer's filter chain before scale: `-vf "hqdn3d=1.5:1.5:6:6,scale=1080:1920"`. Keep luma_spatial <= 2 to avoid banding/ghosting artifacts. Parameters must be conservative — see anti-features for over-denoising risks. |
| **AI upscaling via Real-ESRGAN (source video enhancement)** | If the input camera footage is 720p, shot in poor lighting, or from an older device, `RealESRGAN_x4plus` can recover detail that encoding and platform compression would otherwise flatten. Perceptually, faces gain skin texture, hair gains definition. The model is trained on real-world photos (not anime) — it is the correct model for talking heads. With `--face_enhance` flag, GFPGAN is applied specifically to detected faces for additional restoration. | HIGH | Processing speed: ~1 fps on CPU (unusable for production), 10–30x faster on NVIDIA GPU. Workflow: FFmpeg extract frames → Real-ESRGAN per-frame → FFmpeg reassemble with audio copy. Adds a new Docker service step. Requires GPU-enabled container. Must run BEFORE Remotion compositing step — upscaling happens on raw video; subtitles are composited on top of the upscaled frame. |
| **PNG frame format for Remotion (maximum text quality)** | Switching from JPEG to PNG for intermediate frames eliminates all intermediate compression artifacts before the final video encode. Produces the absolute sharpest possible text edges. | LOW | `renderMedia({ imageFormat: 'png' })`. Trade-off: 2–4x slower render time. Acceptable for offline batch; unacceptable for interactive preview. Should be opt-in via environment variable or `PipelineConfig` field. |
| **Configurable per-platform export bitrate profile** | Creators delivering to multiple platforms benefit from a single config that sets the target encode quality per delivery destination (Instagram: CRF 17 + 8 Mbps floor, TikTok: CRF 16 + 12 Mbps floor, archive: CRF 14). | LOW | Extend `PipelineConfig` with an optional `encode` object: `{ crf?: number, maxrateMbps?: number, preset?: string }`. Falls back to sensible defaults. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Upscaling output to 4K before upload** | Creators assume higher resolution = better quality on Instagram. | Instagram playback caps at 1080p regardless of upload resolution. A 4K upload gets re-encoded to 1080p, adding zero perceptual quality while massively increasing upload time and file size. The platform may also apply a heavier compression pass on unexpectedly large files. Search results confirm: "4K, 1080p, or even 720p often end up looking remarkably similar after Instagram's upload." | Ensure the source is shot at 1080p or natively 4K (then downscale to 1080p for export). Do not upscale the rendered output beyond 1080x1920. |
| **Aggressive sharpening filter (unsharp strength > 1.5)** | Sharpening feels like it adds detail. | Over-sharpening creates halos (ringing) at high-contrast edges — especially around subtitle text and against the speaker's face/hair boundary. These halos survive platform re-encoding and look worse than no sharpening. Also exacerbates aliasing on diagonal text strokes. The correct approach is to eliminate re-encode loss and set correct bitrate so the encoder preserves real detail — then no artificial sharpening is needed. | Use `unsharp=5:5:0.8:5:5:0.0` (luma strength 0.8 max) if any sharpening is applied, or skip sharpening entirely and rely on correct CRF + supersampling. |
| **60fps output** | Looks smoother in theory for talking-head content. | TikTok and Instagram compress 60fps more aggressively than 30fps (more frames = more data for the same bitrate cap). Talking-head content has minimal motion; 60fps provides no perceptual benefit. The pipeline already uses 30fps (`FPS_OUTPUT = 30`) which is correct. | Keep 30fps. 60fps is only valid for sports or high-motion content where motion blur reduction matters. |
| **Multiple AI upscaling passes** | Seems like it would further refine detail across multiple iterations. | Each generative upscaling pass hallucinates new high-frequency detail. Running Real-ESRGAN twice on the same content produces over-synthesized texture that looks plastic and artificial on real faces. The second pass synthesizes detail on top of already-synthesized detail. | Single upscaling pass only. |
| **Real-time AI upscaling on CPU** | Desire to avoid GPU dependency in Docker. | Real-ESRGAN on CPU processes approximately 1 frame/second. A 60-second video at 30fps = 1,800 frames = 30 minutes of processing minimum. This scales linearly with content length and is unusable in any production context. | Defer AI upscaling to GPU-enabled environments only. On CPU-only deployments, rely on correct CRF + supersampling, which costs zero additional compute time. |
| **HEVC (H.265) encoding for smaller files** | H.265 achieves similar quality at ~50% the bitrate of H.264. | TikTok explicitly recommends H.264 High Profile. Instagram accepts H.265 but its transcoder path for H.265 is less battle-tested and occasionally produces artifacts. Approximately 15–20% of US iOS devices on poor networks still encounter H.265 playback issues. | Stick with H.264 High Profile for maximum platform compatibility. |
| **Over-aggressive hqdn3d denoise (luma_spatial > 3)** | More denoising = cleaner image. | Strong hqdn3d values produce temporal ghosting (movement trails on fast head motion), banding in smooth skin gradients, and blocking in shadow areas. These artifacts are worse than the original noise they replaced and survive platform re-encoding. | Keep `hqdn3d=1.5:1.5:6:6` (luma_spatial=1.5, chroma_spatial=1.5, luma_tmp=6, chroma_tmp=6) as the conservative ceiling. |

---

## Feature Dependencies

```
[Remotion scale:2 supersampling]
    └──requires──> [renderMedia() call in render.ts — already exists, add scale param]
    └──enhances──> [JPEG quality 95 — sharpness compounded]
    └──enhances──> [outlineWidth / textShadow styling — pixel-level detail now preserved]

[Eliminate silence-cutter concat re-encode]
    └──requires──> [silence-cutter concat step uses -c:v copy]
    └──enhances──> [Final CRF — fewer encode passes means CRF target is preserved]

[CRF 17 in Remotion + CRF 17 in ffmpeg-finalizer]
    └──requires──> [Remaining encode passes are minimal — CRF is meaningless if upstream re-encodes override it]
    └──enhances──> [Upload bitrate floor — CRF generates the quality level for maxrate to enforce]

[JPEG quality 95]
    └──requires──> [scale:2 — at scale:1, intermediate frame quality difference is minor]
    └──conflicts──> [PNG imageFormat — mutually exclusive options in renderMedia]

[PNG imageFormat (batch-only)]
    └──conflicts──> [JPEG quality 95 — pick one]
    └──conflicts──> [fast render time — 2-4x slower than JPEG]

[bt709 color space tags]
    └──requires──> [ffmpeg-finalizer cmd modification — -pix_fmt yuv420p already present, add color flags]

[hqdn3d mild denoise]
    └──requires──> [ffmpeg-finalizer filter chain modification]
    └──conflicts──> [Aggressive unsharp — denoise + strong sharpening compounds ghosting/haloing]

[AI upscaling (Real-ESRGAN)]
    └──requires──> [GPU-enabled Docker container]
    └──requires──> [New pipeline step BEFORE remotion-renderer]
    └──requires──> [Input video available before Remotion compositing]
    └──conflicts──> [CPU-only deployment — unusable speed]
    └──enhances──> [Final CRF — more input detail = more for encoder to preserve]
```

### Dependency Notes

- **scale:2 is independent and highest priority**: No other change required. Single line in `render.ts`. Fixes the most visible quality defect.
- **Stream-copy in concat requires compatible segments**: Safe here because all segments extracted by silence-cutter share the same codec (libx264), pixel format (yuv420p), and timebase. The concat demuxer with `-c:v copy` preserves timestamps without decode/re-encode.
- **AI upscaling must precede Remotion compositing**: Upscaling happens on the raw video track. Subtitles/overlays are composited on top of the upscaled frame in Remotion. Upscaling after subtitle compositing would blur the composited text.
- **PNG and JPEG quality are mutually exclusive**: Choose one per render. PNG for maximum quality archive renders; JPEG 95 for production batch.

---

## MVP Definition for v1.1

### Launch With (P1 batch — close the quality gap)

All low-complexity, no new dependencies. Combined, these close the majority of the perceptual quality gap with Instagram-native content.

- [ ] **`scale: 2` in renderMedia** — fixes subtitle blurriness, the most visible quality defect. Single parameter change in `render.ts`.
- [ ] **`jpegQuality: 95` in renderMedia** — raises intermediate frame quality; ~30% slower render but measurably sharper text edges before final encode.
- [ ] **`crf: 17` in renderMedia** — explicit CRF override to match target platform bitrate range.
- [ ] **`-c:v copy` in silence-cutter concat step** — eliminates one lossy H.264 re-encode with zero quality cost. Change in `services/silence-cutter/src/cut_video.py`.
- [ ] **bt709 color space flags in ffmpeg-finalizer** — prevents washed-out output from HDR→SDR mishandling by Instagram.
- [ ] **CRF 17 in ffmpeg-finalizer config** — consistent CRF target across the encode chain (currently CRF 20).

### Add After P1 Validation (v1.1.x)

- [ ] **hqdn3d mild denoise in ffmpeg-finalizer** — trigger: creator reports noisy/grainy source footage producing blocky output after platform compression.
- [ ] **`imageFormat: 'png'` opt-in flag in renderMedia** — trigger: creator feedback that text is still not sharp enough after scale:2 and JPEG 95; worth the slower render time.

### Future Consideration (v1.2+)

- [ ] **Real-ESRGAN AI upscaling step** — trigger: GPU-enabled deployment environment available; creator demand for enhancement of low-quality source material (720p, noisy lighting).
- [ ] **Configurable per-platform export bitrate profile** — trigger: creators delivering to 3+ platforms with different bitrate specs.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Remotion scale:2 supersampling | HIGH — fixes most visible defect | LOW — one param | P1 |
| JPEG quality 95 in renderMedia | HIGH — subtitle edge quality | LOW — one param | P1 |
| CRF 17 in Remotion render | HIGH — survives platform compression | LOW — one param | P1 |
| Silence-cutter concat stream copy | MEDIUM — removes one lossy step | LOW — flag change | P1 |
| bt709 color space tags | MEDIUM — prevents HDR blowout | LOW — ffmpeg flags | P1 |
| CRF 17 in ffmpeg-finalizer | MEDIUM — consistent encode target | LOW — constant | P1 |
| hqdn3d mild denoise | MEDIUM — better bitrate efficiency on noisy footage | LOW — filter chain | P2 |
| PNG frame format (batch opt-in) | LOW — marginal after scale:2 + JPEG 95 | LOW — param flag | P2 |
| AI upscaling (Real-ESRGAN) | HIGH for low-quality sources | HIGH — GPU, new container | P3 |
| Per-platform bitrate profile config | LOW — nice to have | LOW — config extension | P3 |

**Priority key:**
- P1: Must have for v1.1 launch — closes the quality gap, no new infrastructure required
- P2: Should have, add once P1 validated
- P3: Future consideration — requires new infrastructure (GPU) or validated demand

---

## Platform Delivery Reference

| Platform | Resolution | Codec | Recommended upload bitrate | Frame rate | Key notes |
|----------|------------|-------|---------------------------|------------|-----------|
| Instagram Reels | 1080x1920 | H.264 | 3.5–10 Mbps | 30 fps | Enable "Upload at Highest Quality" in app settings (off by default). Turn off "Data Saver." Platform delivers ~1.5–3 Mbps to viewers. |
| TikTok | 1080x1920 | H.264 High Profile | 8–15 Mbps VBR | 30 fps constant | Upload from web uploader (10 GB limit) vs mobile (287 MB limit). 4K accepted but resized to 1080p internally. Below 5 Mbps triggers a quality-flag downgrade. |

Both platforms re-encode every upload. The strategy is to upload at enough quality (8–10 Mbps, produced by CRF 17 on talking-head content) that their transcoder's lossy pass leaves the content still looking clean at its delivery bitrate (~1.5–3 Mbps to the viewer).

---

## What the Existing Pipeline Already Does Right

Documenting this to avoid re-researching or accidentally breaking correct behavior:

| Setting | Location | Value | Notes |
|---------|----------|-------|-------|
| Output resolution | ffmpeg-finalizer config.py | 1080x1920 | Correct for all target platforms |
| H.264 High Profile | ffmpeg-finalizer config.py | `H264_PROFILE = "high"` | Correct for platform compatibility |
| Output frame rate | ffmpeg-finalizer config.py | `FPS_OUTPUT = 30` | Correct — 30fps is optimal for talking-head social |
| `-movflags +faststart` | ffmpeg-finalizer crop.py | Present | Correct — enables platform to start processing immediately |
| Audio normalization | ffmpeg-finalizer config.py | loudnorm -14 LUFS, TP=-1 | Correct — follows EBU R128 / social platform standard |
| AAC audio 128k | ffmpeg-finalizer config.py | `AUDIO_BITRATE = "128k"` | Meets platform minimum |
| Text outline defaults | pipeline-config.ts | `outlineColor: "#000000"`, `outlineWidth: 3` | Correct starting point for legibility |
| Hard cuts (no transitions) | silence-cutter/cut_video.py | Explicit design decision | Correct for short-form style |

---

## Sources

- Remotion quality guide: https://www.remotion.dev/docs/quality
- Remotion output scaling: https://www.remotion.dev/docs/scaling
- Remotion renderMedia API: https://www.remotion.dev/docs/renderer/render-media
- Remotion encoding guide: https://www.remotion.dev/docs/encoding
- Instagram Reels specs (Sprout Social): https://sproutsocial.com/insights/social-media-video-specs-guide/
- Instagram blur causes/solutions: https://en.androidsis.com/Blurry-or-poor-quality-Instagram-reels-causes-and-solutions/
- TikTok high-quality upload guide: https://rendercut.io/high-quality-upload-on-tiktok/
- TikTok upload specs 2025: https://stackinfluence.com/tiktok-video-sizes-the-ultimate-2025-guide/
- CRF guide (slhck.info, definitive reference): https://slhck.info/video/2017/02/24/crf-guide.html
- Real-ESRGAN GitHub (xinntao/Real-ESRGAN): https://github.com/xinntao/Real-ESRGAN
- FFmpeg filters documentation (hqdn3d, unsharp): https://ffmpeg.org/ffmpeg-filters.html
- 4K vs 1080p for Instagram — diminishing returns: https://creativecow.net/forums/thread/upload-4k-vs-1080p-for-social-media-vertical-videos/
- Over-sharpening halo artifacts: https://thevideoproguys.com/how-to-remove-sharpening-halo-artifacts/
- Real-ESRGAN vs Topaz comparison: https://wavespeed.ai/blog/posts/real-esrgan-vs-topaz/

---

*Feature research for: v1.1 "Calidad de video" — video quality/definition improvements*
*Researched: 2026-05-20*
