# Pitfalls Research

**Domain:** Docker-based video processing pipeline (Whisper + FFmpeg + Remotion)
**Researched:** 2026-05-05
**Confidence:** MEDIUM-HIGH (official docs + community evidence; Docker volume perf data partially training-based)

## Critical Pitfalls

### Pitfall 1: Whisper Hallucinations in Silent Sections

**What goes wrong:**
Whisper generates text that was never spoken in the audio, especially during silent or low-volume sections. The model "fills in" silence with transcribed text from its training data (repeated phrases, random words, or trailing repetitions). This produces phantom subtitles and incorrect silence detection boundaries — your pipeline thinks someone is speaking when they aren't, so silence cuts are placed wrong or missing entirely.

**Why it happens:**
Whisper's sequence-to-sequence architecture predicts the next word based on general language knowledge while simultaneously transcribing audio. In silent sections, the audio signal is weak and the model falls back on its language model prior, inventing plausible-sounding text. The official model card explicitly documents this: "the predictions may include texts that are not actually spoken in the audio input (i.e. hallucination)."

**How to avoid:**
- Always set `--hallucination_silence_threshold` (CLI) or `hallucination_silence_threshold` (API) to ~2.0 seconds. This is a dedicated parameter specifically for this problem.
- Set `no_speech_threshold` to 0.6 (default is 0.6, but verify it's not lowered).
- Use `condition_on_previous_text=True` carefully — it helps continuity but can propagate hallucinations forward. For talking-head content, it's usually fine, but validate.
- After transcription, post-process segments: flag any segment where the text repeats or the confidence (logprob) is unusually low.
- Cross-reference Whisper's silence segments with FFmpeg's `silencedetect` filter output. If Whisper reports speech where FFmpeg detects silence, that's a hallucination.

**Warning signs:**
- Subtitles appear during visible pauses in the video
- Whisper output contains repeated phrases ("Thank you. Thank you. Thank you.")
- Silence cuts seem wrong (too short or absent)
- Transcription has more segments than expected for the video duration

**Phase to address:**
Phase 1 (Whisper integration) — this must be handled at transcription time, not fixed downstream. Build hallucination filtering into the Whisper step's post-processing from day one.

---

### Pitfall 2: Whisper Word-Level Timestamp Drift

**What goes wrong:**
Word-level timestamps from Whisper drift from actual speech timing, especially at segment boundaries. Words may be timestamped 100-500ms off from where they actually occur. For word-by-word subtitles (the core use case), this means subtitles highlight before or after the speaker says the word — creating a visibly "off" experience that audiences immediately notice.

**Why it happens:**
Whisper processes audio in 30-second sliding windows. Word-level timestamps are derived from cross-attention weights aligned via dynamic time warping (DTW), which is a heuristic approximation — not frame-accurate alignment. Timestamp accuracy degrades at window boundaries and for fast speech. The `.en` models (English-only) are slightly better but still not perfect.

**How to avoid:**
- Use `medium.en` or `large` model for word-level timestamps — smaller models (`tiny`, `base`) have significantly worse alignment.
- Consider `whisper-timestamped` or `whisperx` as drop-in alternatives that add forced alignment (aligning predicted text back to the audio using a secondary alignment model). These provide significantly better word-level timing than vanilla Whisper.
- If using vanilla Whisper, increase `max_initial_timestamp` to 1.0 to reduce the model's tendency to start timestamps too early.
- Implement a small timing offset adjustment in the subtitle renderer: add a configurable delay (typically 50-150ms) so users can tune subtitle sync per-video if needed.
- Validate timestamps against the audio's actual waveform energy (VAD) as a sanity check.

**Warning signs:**
- Subtitles highlight noticeably before/after the speaker says the word
- Last words of a segment are timestamped at the segment end (clumped at boundary)
- Timestamps for consecutive words have identical start/end times (collapsed)
- Manual review of sample videos shows visible subtitle-audio desync

**Phase to address:**
Phase 1 (Whisper integration) — choose the right model and alignment approach before building the subtitle system on top of bad timestamps. Re-doing timestamps later means re-processing all videos.

---

### Pitfall 3: Remotion Docker Container Missing Chrome Dependencies

**What goes wrong:**
The Remotion render container crashes immediately on startup with cryptic errors about shared libraries being missing. The container builds fine, but when `renderMedia()` or `npx remotion render` executes, Chrome Headless Shell cannot launch because required OS-level libraries are not installed in the Docker image.

**Why it happens:**
Chrome Headless Shell requires ~15 specific shared libraries (libnss3, libgbm, libasound2, libatk1.0-0, etc.) that are not included in slim Node.js Docker images. Developers assume `npm install` is sufficient since Remotion installs its own Chrome binary (`npx remotion browser ensure`), but Chrome still depends on OS-level shared libraries.

**How to avoid:**
Use Remotion's official Docker template exactly. The required packages are:
```
libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2
libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1
libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2
```
On Ubuntu 24.04+, use `libasound2t64` instead of `libasound2`.
Always install Chrome via `npx remotion browser ensure` — do NOT rely on system Chromium.
Use `node:22-bookworm-slim` as base image (Debian-based) — NOT Alpine.

**Warning signs:**
- Container exits immediately with "error while loading shared libraries" messages
- Chrome process never starts, Remotion timeout waiting for browser
- Works locally (macOS/Windows) but fails in Docker (Linux)

**Phase to address:**
Phase 2 (Remotion renderer container) — this is the very first blocker you'll hit when containerizing Remotion. Get the Dockerfile right on day one.

---

### Pitfall 4: Remotion Single-Process Mode Killing Render Performance in Docker

**What goes wrong:**
Remotion renders are painfully slow in Docker (2-5x slower than expected for the CPU resources allocated). The container has 8 CPUs but render concurrency doesn't help. One frame at a time processes despite setting concurrency. GPU-accelerated content (shadows, transforms, gradients used in subtitles/intros) renders at a crawl.

**Why it happens:**
On Linux (which Docker uses), Chromium defaults to `--single-process` mode for sandboxing/stability reasons. This prevents Remotion from using multiple renderer processes in parallel, effectively negating the `--concurrency` setting. Additionally, headless Chromium disables GPU by default, so effects like `box-shadow`, `text-shadow`, `filter: blur()`, `transform`, and CSS gradients — all likely used in animated subtitles and intros — fall back to CPU-only rendering.

**How to avoid:**
- Enable multi-process mode: `chromiumOptions: { enableMultiProcessOnLinux: true }` in `renderMedia()`, or `--enable-multi-process-on-linux` CLI flag. **This is now default from Remotion v4.0.137+**, but verify it's not disabled if you override chromium options.
- Enable GPU rendering with `--gl=angle-egl` for Docker Linux + GPU. Without GPU: use `--gl=swangle` (software OpenGL).
- **Critical**: `angle` renderer has known memory leaks. Split long renders (>3 min video) into segment renders and combine with FFmpeg afterward.
- Allocate proper CPU resources: use `--cpus` and `--cpuset-cpus` flags on `docker run` to ensure the container can use available cores.
- Set Remotion `--concurrency` to match available CPU cores.
- If memory is tight, use `--disallow-parallel-encoding` to prevent frame rendering and encoding happening simultaneously.

**Warning signs:**
- Render time per frame >1 second for composition with visual effects
- `--concurrency=8` produces no speed improvement over `--concurrency=1`
- Container CPU usage stays at ~100% of a single core despite multi-core allocation
- GPU-accelerated effects (shadows, gradients) are visibly slower in Docker than in Studio preview

**Phase to address:**
Phase 2 (Remotion renderer container) — this determines whether rendering is viable at all. Test render performance with the actual subtitle/intro compositions in Docker before building any more pipeline steps on top.

---

### Pitfall 5: Docker Bind Mount I/O Bottleneck on Large Video Files

**What goes wrong:**
The pipeline becomes extremely slow when processing video files through Docker bind mounts. A 500MB video that processes in 30 seconds natively takes 3-5 minutes in the container. FFmpeg operations, Whisper audio extraction, and Remotion frame reads all crawl because every disk read/write crosses the host↔container filesystem boundary via the bind mount.

**Why it happens:**
Docker bind mounts (`-v /host/path:/container/path`) on Linux use the `overlay2` storage driver with virtual filesystem translation. For large sequential I/O (video files, frame extraction), the overhead is significant — especially on macOS with Docker Desktop (which adds a VM layer). Each I/O syscall goes through the Docker proxy, and for frame-by-frame processing (Remotion extracting thousands of frames), the overhead multiplies.

**How to avoid:**
- **Use Docker volumes (not bind mounts) for working data**: Named volumes (`docker volume create`) live inside Docker's storage and avoid the bind mount translation layer. They're significantly faster for sequential I/O.
- **Stage data into the container**: For the input step, `docker cp` the input video into a named volume, process everything inside the container, then `docker cp` the output back. This avoids repeated bind-mount reads.
- **Use `/tmp` inside the container**: For intermediate files between pipeline steps, write to the container's `/tmp` (tmpfs if possible) instead of a mounted volume.
- **On macOS specifically**: Docker Desktop's VirtioFS is a significant improvement over the classic gRPC FUSE driver (available since Docker Desktop 4.x). Ensure VirtioFS is enabled in Docker Desktop settings.
- **Architecture pattern**: Use an internal shared Docker volume between pipeline containers. Input comes in via bind mount or API upload (one-time read), all intermediate processing uses the shared named volume, final output goes out.

**Warning signs:**
- `time ffmpeg -i input.mp4 ...` is 5-10x slower inside container vs. host
- Remotion render log shows excessive time on "Fetching frames" vs. "Rendering"
- `iostat` or `iotop` shows low throughput on the bind mount path
- Whisper audio loading takes longer than the transcription itself

**Phase to address:**
Phase 1 (pipeline infrastructure/Docker compose) — volume strategy must be designed before building individual step containers. Changing volume strategy later means touching every container's mount config.

---

### Pitfall 6: Audio-Video Desync After Silence Removal

**What goes wrong:**
After cutting silence segments from the video with FFmpeg, the audio and video tracks gradually drift out of sync. By the end of a 5-minute video, audio could be 0.5-2 seconds ahead or behind the video. Subtitles (timed to the original audio) also desync from the remaining audio.

**Why it happens:**
FFmpeg's `-af silencedetect` and `-vf select` operate on different timeline models. When you cut silence from both audio and video streams independently — even with the same timestamp filter — the two streams can accumulate micro-drift because:
1. Audio and video frames don't align perfectly (audio is continuous, video is discrete at 30fps).
2. FFmpeg's concat filter (`-f concat`) doesn't re-sync streams at segment boundaries by default — it concatenates raw packets.
3. Variable bitrate audio (AAC) uses windowed encoding with priming/padding samples that get lost at cut boundaries.
4. The `asegment`/`vsegment` filters may not produce frame-accurate cuts at identical timestamps for both streams.

**How to avoid:**
- Use FFmpeg's segment+concat approach with `reset_timestamps` and explicitly re-sync: after concatenating, apply `setpts=PTS-STARTPTS` for video and `asetpts=PTS-STARTPTS` for audio to reset both timelines from zero.
- Use the `-shortest` flag in the final mux to trim the longer stream to the shorter one.
- After silence removal, always validate A/V sync by checking the output with `ffprobe -show_frames` — compare audio and video PTS values for drift.
- Consider using the Python library `ffmpeg-python` which handles stream synchronization more carefully than raw command-line invocations.
- **Most reliable approach**: Extract audio to WAV (uncompressed), perform silence detection on WAV, get cut timestamps, apply cuts to both streams using the exact same timestamps, then re-encode. This eliminates AAC priming sample issues.
- After cutting, re-mux with `-map 0:v:0 -map 0:a:0` explicitly to avoid stream selection issues.

**Warning signs:**
- `ffprobe` shows growing PTS difference between audio and video streams
- Lip sync is visibly off after the first silence cut
- Audio ends noticeably before or after video track
- In Remotion, `<OffthreadVideo>` audio and subtitle overlays seem to drift apart in longer videos

**Phase to address:**
Phase 1 (silence detection + cutting step) — this is the core value of the pipeline. If silence cuts break A/V sync, the entire pipeline output is unusable. Validate sync on every test video.

---

### Pitfall 7: Using Alpine Linux for Remotion Docker Image

**What goes wrong:**
The Remotion container builds and starts but has severe issues: Rust-based parts of Remotion take 10+ seconds extra per render, Chrome may crash on startup or fail mysteriously, and you can't pin package versions because Alpine removes old packages from repos when new ones release.

**Why it happens:**
Alpine uses musl libc instead of glibc. Remotion ships with pre-compiled binaries (Chrome, FFmpeg) built against glibc. The musl compatibility layer introduces performance overhead and subtle incompatibilities. Remotion's official docs explicitly recommend against Alpine: "There are two known issues with it when used in conjunction with Remotion" (slow Rust startup, Chrome version pinning).

**How to avoid:**
Use `node:22-bookworm-slim` (Debian-based) as the Docker base image. This is the officially recommended and tested base. Debian doesn't remove old packages from repos, so version pinning works reliably.

**Warning signs:**
- Container start time is >10 seconds before rendering begins
- Chrome crashes with glibc/musl-related errors
- Dockerfile builds break intermittently when Alpine packages update

**Phase to address:**
Phase 2 (Remotion renderer container) — use Debian base image from the start. If you've already built on Alpine, switch immediately.

---

### Pitfall 8: FFmpeg Version Mismatch Between Pipeline Steps

**What goes wrong:**
Different pipeline containers ship different FFmpeg versions (one has 4.x, another 6.x). This causes subtle failures: files produced by one FFmpeg version can't be read by another, codec flags differ, filter options are renamed, and output quality varies unpredictably. Specifically, the `libx264` CRF values produce different results across versions, and the `silencedetect` filter output format changed between FFmpeg 4 and 6.

**Why it happens:**
Each Docker container pulls FFmpeg from its base image's package manager, and different base images ship different versions. Python containers (Whisper step) might have FFmpeg 4.x from `apt`, Node.js containers (Remotion step) have their own FFmpeg bundled by Remotion. When pipeline steps pass files between containers, they implicitly depend on format compatibility.

**How to avoid:**
- Pin FFmpeg version explicitly in every container's Dockerfile.
- Use the same FFmpeg major version across all containers (6.x recommended).
- Remotion v4+ bundles its own FFmpeg — don't install a system FFmpeg in the Remotion container.
- For the Whisper and silence-detection containers, install FFmpeg from a PPA or download the static binary directly from `johnvansickle.com/ffmpeg/` (official static builds) to control the exact version.
- Add a "version check" step at pipeline startup: each container reports its FFmpeg version, and the orchestrator validates they're compatible before starting the pipeline.
- Define a shared "pipeline contract" document: codec, container format, pixel format, sample rate, and channel layout that all steps must use.

**Warning signs:**
- FFmpeg in one container can't decode files produced by another
- `silencedetect` output format differs between containers' logs
- CRF quality varies inexplicably between processing runs
- `ffprobe` shows different metadata for the "same" encoding parameters

**Phase to address:**
Phase 1 (pipeline infrastructure) — define the shared format contract and pin FFmpeg versions before building individual step containers.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using Whisper `base` model instead of `medium`/`large` | 4-7x faster transcription | Garbage word-level timestamps → subtitles visibly off, hallucination in silent sections → wrong silence cuts | Never — word-by-word subtitles depend on accurate alignment |
| Using bind mounts for all video I/O | Simpler Docker compose setup | 5-10x I/O penalty on large files, pipeline becomes unusably slow at scale | MVP prototyping only with small (<100MB) files |
| Processing audio as AAC throughout pipeline | No re-encoding needed, faster | AAC priming samples cause A/V desync at every cut point | Only if no cutting occurs (but this pipeline explicitly cuts silence) |
| Skipping post-cut A/V sync validation | Faster iteration, simpler code | Desync accumulates — by end of 5-min video, 1-2 second drift | Never — this is the core value proposition |
| Using `<Html5Video>` in Remotion instead of `<OffthreadVideo>` | Simpler code, works in preview | Frame-accurate rendering fails — Html5Video can't guarantee exact frame extraction, video seeks are approximate | Preview only — must switch to OffthreadVideo for production renders |
| Hardcoding concurrency/timeout values in render config | Quick setup, works on dev machine | Fails on different hardware, OOM on low-memory containers, underutilizes high-core machines | Never — read from runtime environment |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Whisper → Silence Detection | Using Whisper's segment timestamps as silence boundaries | Use FFmpeg's `silencedetect` for silence detection (it operates on actual audio energy); use Whisper timestamps only for subtitle alignment |
| Whisper → Remotion | Passing raw Whisper JSON directly as subtitle props | Transform Whisper output into Remotion's expected format: `{startFrame, endFrame, text}` using the composition's FPS to convert seconds → frames |
| FFmpeg → Remotion | Assuming Remotion can read any FFmpeg output format | Remotion's `<OffthreadVideo>` supports: H.264, H.265, VP8, VP9, AV1, ProRes. Ensure FFmpeg outputs one of these. Use H.264 for widest compatibility. |
| Docker containers (inter-step) | Passing video files via filesystem paths that differ per container | Use a shared named Docker volume mounted at the same path in every container (e.g., `/pipeline/data/`) |
| Remotion → FFmpeg final mux | Letting Remotion handle final audio/video muxing | If silence cuts modified the audio, render video-only in Remotion (muted), then mux with the FFmpeg-processed audio track separately using FFmpeg concat |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Remotion rendering without GPU flag in Docker | 3-5x slower renders for any composition with shadows/gradients/blurs | Set `--gl=angle-egl` (GPU available) or `--gl=swangle` (no GPU) | Any non-trivial composition |
| Processing 1GB+ video files through Docker bind mounts | Pipeline takes 10x longer than expected, I/O wait dominates | Use Docker named volumes or copy data into container first | Files >200MB on Linux, >50MB on macOS Docker Desktop |
| Remotion `angle` renderer for long videos | OOM crash mid-render, or silent memory leak causing gradual slowdown | Split renders >3 min into segments, use `--disallow-parallel-encoding` if memory constrained | Videos >3 minutes with visual effects |
| Whisper `large` model without GPU | Transcription takes 30+ minutes for 10-minute video | Use `turbo` model (6GB VRAM, 8x faster than large) or `medium` (5GB VRAM, 2x slower) | Any real-time or batch processing at scale |
| Running multiple pipeline instances without resource limits | Containers fight for CPU/RAM, all slow down, OOM kills | Set `--cpus` and `--memory` limits per container, limit concurrent pipeline runs | 3+ simultaneous processing jobs |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting arbitrary video URLs as pipeline input | SSRF — internal network scanning via crafted URLs | Accept only uploaded files or pre-signed URLs from trusted storage |
| Running FFmpeg on untrusted input without sandboxing | FFmpeg has had RCE vulnerabilities (CVE-2024-3147, etc.) | Run FFmpeg in isolated container with no network access, use `--network=none` in Docker |
| Exposing Remotion Studio to public internet | Arbitrary code execution — Studio can run any React component | Studio is for dev only; production API should only accept safe serialized props, not arbitrary code |
| Storing intermediate video files on shared volumes without cleanup | Disk exhaustion from accumulated temp files | Implement mandatory cleanup after each pipeline run, set volume size limits |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Word-by-word subtitles that are 200ms+ off from speech | Feels broken, viewers notice immediately | Use forced-alignment (whisperx/whisper-timestamped) + configurable offset adjustment per video |
| Silence cuts that create micro-pops (audio clicks) | Audio sounds unprofessional, jarring | Apply 10-30ms crossfade at cut points via FFmpeg `acrossfade` after silence removal |
| Pipeline takes 10+ minutes with no progress feedback | User doesn't know if it's working or broken | Stream step-by-step progress via API (Whisper: segments done; FFmpeg: % complete; Remotion: frames rendered) |
| Output video has wrong aspect ratio (not 9:16) | Video looks wrong on social media | Explicitly validate output dimensions with `ffprobe` before accepting pipeline output |

## "Looks Done But Isn't" Checklist

- [ ] **Whisper transcription:** Often missing hallucination filtering — verify `--hallucination_silence_threshold 2.0` is set and that silent sections return empty, not invent text
- [ ] **Silence removal:** Often missing A/V sync verification — verify with `ffprobe -show_frames` that audio and video PTS stay aligned after cutting
- [ ] **Remotion Docker render:** Often missing `enableMultiProcessOnLinux: true` — verify render concurrency actually uses multiple cores (check CPU usage during render)
- [ ] **Remotion frame-accurate video:** Often using `<Html5Video>` instead of `<OffthreadVideo>` — verify the component can seek to exact frames by testing with a known video at specific timestamps
- [ ] **FFmpeg in Docker:** Often wrong version — verify `ffmpeg -version` output matches expected version across all containers
- [ ] **9:16 output:** Often outputs incorrect resolution — verify output is exactly 1080x1920 (or 720x1280) with `ffprobe`
- [ ] **Audio clicks at cuts:** Often missing crossfades — listen to output at every cut point for audio pops/clicks
- [ ] **Word-by-word subtitle timing:** Often timestamps visibly off — manually verify 5+ random words' timestamps against actual speech in the video

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Whisper hallucinations not filtered | LOW | Re-run transcription with `hallucination_silence_threshold`; add post-processing filter to existing results |
| Word-level timestamp drift | MEDIUM | Switch to whisperx/whisper-timestamped and re-process; requires re-running Whisper step for all videos |
| Docker Chrome dependencies missing | LOW | Add missing packages to Dockerfile, rebuild image |
| Single-process rendering mode | LOW | Add `enableMultiProcessOnLinux: true` to render config; immediate improvement |
| A/V desync after silence cuts | HIGH | Re-encode all affected videos with proper `reset_timestamps` and sync verification; may need to re-derive cut points |
| Bind mount I/O bottleneck | MEDIUM | Change Docker compose to use named volumes; update pipeline step container mount configs |
| Alpine base image issues | MEDIUM | Rebuild Dockerfile with Debian base image; requires re-testing all Chrome/FFmpeg functionality |
| FFmpeg version mismatch | MEDIUM | Pin FFmpeg versions in all containers, rebuild, re-validate pipeline contract |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Whisper hallucinations in silence | Phase 1: Whisper step | Transcribe 3 test videos with known silent sections; verify no phantom text in output |
| Word-level timestamp drift | Phase 1: Whisper step | Manually check 10 random word timestamps against audio; verify <100ms average offset |
| Chrome dependencies missing | Phase 2: Remotion container | Docker build + test render on clean machine (no cached layers) |
| Single-process rendering mode | Phase 2: Remotion container | Compare render time with `--concurrency=1` vs `--concurrency=N` in Docker; should see proportional improvement |
| Docker bind mount I/O bottleneck | Phase 1: Pipeline infrastructure | Benchmark FFmpeg read speed inside container vs. host; verify <2x overhead |
| A/V desync after silence cuts | Phase 1: Silence detection step | Run `ffprobe -show_frames` on output; verify audio/video PTS difference stays <1 frame throughout |
| Alpine base image | Phase 2: Remotion container | Not applicable if using Debian from start |
| FFmpeg version mismatch | Phase 1: Pipeline infrastructure | Each container logs `ffmpeg -version` at startup; orchestrator validates compatibility |

## Sources

- OpenAI Whisper model card: https://github.com/openai/whisper/blob/main/model-card.md (official — hallucination and repetition limitations)
- OpenAI Whisper README: https://github.com/openai/whisper (official — model sizes, VRAM requirements, turbo model)
- Remotion Docker docs: https://www.remotion.dev/docs/docker (official — Dockerfile, Chrome deps, Alpine warning)
- Remotion Linux multi-process docs: https://www.remotion.dev/docs/miscellaneous/linux-single-process (official — single-process default, enableMultiProcessOnLinux)
- Remotion GPU docs: https://www.remotion.dev/docs/gpu (official — GPU-disabled in headless, content types accelerated)
- Remotion GL options: https://www.remotion.dev/docs/gl-options (official — angle memory leak warning, renderer backend options)
- Remotion OffthreadVideo: https://www.remotion.dev/docs/offthreadvideo (official — frame extraction outside browser via FFmpeg, supported codecs)
- Remotion hardware acceleration: https://www.remotion.dev/docs/hardware-acceleration (official — macOS-only, not Lambda/Cloud Run)
- Remotion render CLI: https://www.remotion.dev/docs/cli/render (official — all render flags)
- FFmpeg adelay/cue/setpts docs: https://ffmpeg.org/ffmpeg-all.html (official — audio delay, PTS manipulation, sync)
- Docker Desktop VirtioFS: https://docs.docker.com/desktop/settings/ (official — filesystem performance settings)
- Context7 Whisper documentation (verified 2026-05-05)
- Context7 Remotion documentation (verified 2026-05-05)
- Context7 FFmpeg documentation (verified 2026-05-05)

---
*Pitfalls research for: Docker-based video processing pipeline (Whisper + FFmpeg + Remotion)*
*Researched: 2026-05-05*