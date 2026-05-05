# Project Research Summary

**Project:** Video Pipeline Docker
**Domain:** Self-hosted, Docker-based video processing pipeline (Whisper transcription + Remotion rendering → 9:16 social video)
**Researched:** 2026-05-05
**Confidence:** HIGH

## Executive Summary

This is a containerized video processing pipeline that transforms horizontal talking-head MP4 videos into vertical 9:16 social clips with word-by-word animated subtitles and silence removal. Experts in this space (OpusClip, Descript, Vizard) build similar products as closed SaaS platforms; the key differentiator here is a self-hosted, Docker-native, API-first pipeline where every step is an isolated container producing inspectable artifacts. The architecture follows a sequential step pipeline pattern with shared Docker volumes and file-based step contracts—each container reads input from a well-known path, processes it, writes output to the next path, and exits. This makes the pipeline debuggable, extensible, and language-agnostic (Python for Whisper, Node.js for Remotion).

The recommended approach is to build in strict dependency order: start with the shared volume infrastructure and step contract schemas, then build containers simplest-first (FFmpeg finalizer validates the pattern, then Whisper, silence cutter, Remotion renderer, orchestrator, API gateway). The two hardest technical challenges are (1) accurate word-level timestamps from Whisper (without forced alignment, subtitles visibly desync) and (2) audio-video synchronization after silence removal (FFmpeg cuts can accumulate drift that makes the output unusable). Both must be solved correctly in Phase 1—there's no fixing them later without reprocessing every video. Docker I/O performance (use named volumes, not bind mounts), Remotion Chrome dependencies (use Debian, not Alpine), and GPU resource serialization (Whisper and Remotion share the GPU) are the operational pitfalls that will block you if not designed upfront.

## Key Findings

### Recommended Stack

Two-language Docker Compose pipeline: Python container for transcription/analysis, Node.js container for rendering. Each step is its own container communicating via shared volume files.

**Core technologies:**
- **Faster Whisper 1.2.1** — speech-to-text with word-level timestamps; 4x faster than openai-whisper, built-in VAD filter, CTranslate2 backend
- **Remotion 4.0.457** — programmatic video rendering in React; `@remotion/captions` provides TikTok-style word highlighting; `@remotion/renderer` for SSR Docker renders
- **FFmpeg 7.x (static build)** — audio extraction, silencedetect filter, final H.264 encoding; pinned across all containers to avoid version mismatch
- **FastAPI 0.136.1** — Python REST API for Whisper/analysis container; async-native, Pydantic validation
- **Express.js 5.2.1** — Node.js REST API for render steps; natural fit since Remotion is Node-first
- **BullMQ 5.76.5 + Redis 7.x** — job queue for async batch processing; progress tracking; concurrency management
- **Docker Compose v2** — multi-container orchestration with shared named volumes

**Critical version constraints:** All `@remotion/*` packages must be the same version (4.0.457). Use `node:22-bookworm-slim` (Debian, never Alpine). Use `python:3.12-slim`. BullMQ requires `ioredis`, not the `redis` npm package.

### Expected Features

**Must have (P1 — table stakes):**
- MP4 input acceptance — the pipeline entry point; validate format early
- Whisper transcription with word-level timestamps — foundation for subtitles AND silence detection
- Silence detection and removal (hard cuts) — core value proposition; no transitions per PROJECT.md
- 9:16 vertical output with center-crop — minimum viable reframing for social formats
- Word-by-word animated subtitles (burned-in) — killer feature for short-form; Remotion `@remotion/captions`
- Synchronous REST API (single video) — `POST /process` → processed video; the primary interface
- Intermediate artifact inspection — `GET /artifacts/{jobId}/{step}`; core to debuggability

**Should have (P2 — competitive advantage):**
- Batch processing queue (BullMQ async) — essential for podcast→clips use case
- Smart reframing (subject tracking) — replaces center-crop when speaker moves; requires face detection
- Progress tracking API — long videos need feedback; `GET /status/{jobId}`
- SRT/VTT subtitle export — sidecar files for YouTube/Vimeo; straightforward conversion

**Defer (v3 — future):**
- Automatic zoom/jump cuts — needs careful timing logic
- Intro/outro animated templates — requires template management
- B-roll placeholder overlay system — infrastructure easy, content hard
- Multi-format output — doubles QA surface
- AI clip selection / viral moment detection — full ML problem, orthogonal to pipeline
- Web UI / editor — separate product category

### Architecture Approach

Sequential step pipeline with shared Docker named volumes. Each processing step runs in its own container, reads from and writes to files on a shared volume via a uniform step contract (INPUT_PATH/OUTPUT_PATH env vars, exit code 0 = success). The orchestrator invokes containers in sequence via `docker run`. Steps never communicate over HTTP—only through artifact files. The Remotion container uses React compositions parameterized with transcript/marker data as `inputProps`.

**Major components:**
1. **API Gateway** (Express.js) — accepts uploads, enqueues jobs, serves results
2. **Pipeline Orchestrator** (Node.js) — executes step sequence, manages container lifecycle, tracks progress
3. **Whisper Container** (Python + FastAPI + faster-whisper) — transcribes audio → JSON with word timestamps
4. **Silence Cutter Container** (Python + FFmpeg) — detects silence → generates cut list → removes silent sections
5. **Remotion Renderer Container** (Node.js + Chrome headless) — renders subtitles, overlays at 9:16; uses `@remotion/renderer` SSR APIs
6. **FFmpeg Finalizer Container** (Python + FFmpeg) — crops to 9:16, encodes final H.264, normalizes audio
7. **Shared Named Volume** — `/pipeline/artifacts/{jobId}/`; all intermediate artifacts live here
8. **Redis** — BullMQ job state + pipeline progress tracking

### Critical Pitfalls

1. **Whisper hallucinations in silent sections** — Whisper invents text during silence, causing phantom subtitles and wrong silence boundaries. Always set `hallucination_silence_threshold=2.0` and cross-reference with FFmpeg `silencedetect`.
2. **Audio-video desync after silence removal** — FFmpeg cuts accumulate micro-drift between audio/video streams. Use `reset_timestamps` + `asetpts=PTS-STARTPTS` after every cut; validate with `ffprobe -show_frames`.
3. **Whisper word-level timestamp drift** — 100-500ms offset from actual speech, ruining subtitle sync. Use `medium` or `large` model minimum; consider whisperx/whisper-timestamped for forced alignment.
4. **Remotion Docker Chrome missing dependencies** — ~15 shared libraries required. Use Remotion's official Docker template exactly; base on `node:22-bookworm-slim`, never Alpine.
5. **Docker bind mount I/O bottleneck** — 5-10x slower than native for large video files. Use Docker named volumes for all working data, not bind mounts.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Pipeline Infrastructure + Core Processing Steps
**Rationale:** Everything depends on the shared volume pattern, step contracts, and the two foundational processing steps (Whisper + silence cutting). The build order from ARCHITECTURE.md is explicit: infrastructure → simplest container first → dependent containers. Getting Whisper right from the start is critical because reprocessing all videos to fix hallucinations or timestamp drift is expensive.
**Delivers:** Working end-to-end pipeline: MP4 → transcription → silence removal → 9:16 output with center-crop. All intermediate artifacts inspectable via shared volume.
**Addresses:** P1 features — MP4 input, Whisper transcription, silence detection/removal, 9:16 output, intermediate inspection
**Avoids:** Pitfalls 1 (hallucinations), 2 (timestamp drift), 5 (A/V desync), 6 (I/O bottleneck), 8 (FFmpeg version mismatch)
**Stack:** Faster Whisper, FFmpeg, FastAPI, Docker Compose, Python 3.12

### Phase 2: Remotion Rendering + Animated Subtitles
**Rationale:** Remotion is the most complex container (Chrome headless + React SSR + Debian dependencies). It depends on Whisper output (transcript) and Silence Cutter output (cut video). Building it as Phase 2 isolates all Remotion-specific Docker pitfalls to one phase where they can be solved systematically.
**Delivers:** Word-by-word animated subtitles burned into 9:16 video. Remotion compositions with `@remotion/captions`. Complete visual output.
**Addresses:** P1 feature — word-by-word animated subtitles
**Avoids:** Pitfalls 3 (Chrome deps), 4 (single-process mode), 7 (Alpine)
**Stack:** Remotion 4.0.457, @remotion/captions, @remotion/renderer, @remotion/bundler, Node 22 bookworm-slim

### Phase 3: API Gateway + Pipeline Orchestrator
**Rationale:** With all processing steps working individually, the orchestrator composes them into a sequence and the API exposes the pipeline to clients. This must come after Phase 1-2 because you need working containers to orchestrate.
**Delivers:** Synchronous REST API (`POST /process`), pipeline orchestrator that runs steps in sequence, job completion with artifact URLs.
**Addresses:** P1 feature — synchronous REST API
**Stack:** Express.js 5.2.1, Docker API for container lifecycle

### Phase 4: Async Processing + Batch Queue + Status
**Rationale:** Batch/async processing requires a stable single-video API as foundation (per FEATURES.md dependency analysis). BullMQ + Redis can only be added once the synchronous path is rock-solid.
**Delivers:** Batch submission (`POST /batch`), job queue with BullMQ, progress tracking (`GET /status/{jobId}`), concurrency limits, retries.
**Addresses:** P2 features — batch processing, progress tracking
**Stack:** BullMQ 5.76.5, Redis 7.x, ioredis

### Phase 5: Smart Reframing + SRT Export
**Rationale:** Smart reframing replaces center-crop as the reframing strategy. This is a P2 feature that enhances the core pipeline output quality. Requires face/person detection (MediaPipe or YOLO) which is a new domain. SRT/VTT export is straightforward format conversion from Whisper data—low effort, good value.
**Delivers:** Subject-tracking 9:16 crop, SRT/VTT sidecar subtitle files.
**Addresses:** P2 features — smart reframing, SRT/VTT export
**Stack:** MediaPipe or YOLO for face detection (needs research)

### Phase Ordering Rationale

- **Phase 1 before 2:** Whisper output (transcript JSON) is the data source for Remotion subtitles. Silence-cutter output (cut video) is the video source for Remotion rendering. Remotion cannot be built without upstream artifacts.
- **Phase 2 before 3:** The API gateway and orchestrator need working containers to invoke. You can't build orchestration without callable services.
- **Phase 3 before 4:** Batch processing requires a reliable single-video endpoint. Per FEATURES.md: "Can't build a batch queue on top of an unreliable single-video endpoint."
- **Phase 5 last among P2:** Smart reframing is HIGH complexity; must not block the core pipeline. It's an enhancement, not a dependency.
- **Grouping logic:** Phase 1 includes FFmpeg finalizer + Whisper + Silence Cutter because they form a minimal usable pipeline without Remotion. Phase 2 adds the visual rendering layer. Phase 3 wraps it in an API. Phase 4 adds operational maturity. Phase 5 adds quality improvements.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Remotion):** Remotion SSR rendering API details, Chrome container tuning for production, `@remotion/captions` TikTokPage format integration with Faster Whisper output format. While official docs are thorough, the integration between Faster Whisper's word-level JSON and Remotion's `TikTokPage` token format needs a concrete mapping validated.
- **Phase 5 (Smart Reframing):** Face/person detection model selection (MediaPipe vs YOLO vs other), bounding-box-to-crop-region mapping algorithm, and fallback strategy. This is a new domain not covered in initial research.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Infrastructure):** Well-documented Docker Compose patterns, FFmpeg silencedetect is standard, Faster Whisper API is well-documented via Context7.
- **Phase 3 (API):** Express.js REST API is standard; Docker container lifecycle management is well-documented.
- **Phase 4 (Queue):** BullMQ patterns are well-documented and widely used.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via Context7 + PyPI + npm. Official Docker docs for Remotion confirmed. Critical version constraints documented. |
| Features | HIGH | Competitor analysis from official sites. Feature dependencies mapped. P1/P2/P3 prioritization based on user value + implementation cost. |
| Architecture | HIGH | Sequential step pipeline with shared volumes is the standard pattern for Docker-based processing. Remotion's own docs prescribe this approach. Build order derived from explicit dependency analysis. |
| Pitfalls | MEDIUM-HIGH | Whisper hallucinations and timestamp drift are documented in official model card. Remotion Docker pitfalls come from official docs. Docker I/O performance data partially from training/general knowledge (not empirically measured in this research). A/V desync mechanisms are well-documented in FFmpeg community. |

**Overall confidence:** HIGH

### Gaps to Address

- **Faster Whisper output → Remotion @remotion/captions input mapping:** Research confirmed both produce/consume word-level timestamp data, but the exact JSON transformation needed between Faster Whisper's segment/word format and `createTikTokStyleCaptions()`/`TikTokPage` token format was not validated. This mapping must be confirmed during Phase 2 planning.
- **Spanish-language transcription quality:** Research identified that `.en` models must be avoided and `language="es"` should be set explicitly. Actual accuracy levels for Spanish word-level timestamps were not empirically validated. Test with Spanish-language talking-head videos during Phase 1.
- **GPU resource contention between Whisper and Remotion:** Both need GPU but cannot run concurrently on the same GPU without OOM. The serialization strategy (queue GPU-bound steps) is documented but exact concurrency limits and memory budgets need measurement with the actual model and video sizes during Phase 1-2 integration.
- **Remotion `angle` renderer memory leak:** Official docs warn about memory leaks for renders >3 minutes with the `angle` renderer. The recommended mitigation (segment splitting + FFmpeg concatenation) adds complexity. Need to validate whether typical talking-head renders trigger this within the pipeline's expected input range.

## Sources

### Primary (HIGH confidence)
- Context7 `/systran/faster-whisper` — Faster Whisper transcription API, VAD filter, word timestamps, batched inference
- Context7 `/remotion-dev/remotion` — Remotion SSR rendering, Docker setup, Chrome dependencies, @remotion/captions, OffthreadVideo
- Context7 `/fastapi/fastapi` — FastAPI file upload, background tasks, Pydantic validation
- Context7 `/openai/whisper` — Whisper model card (hallucination warnings), word_timestamps API
- Context7 `/kkroening/ffmpeg-python` — FFmpeg atrim, asetpts, silencedetect filters
- Remotion official Docker docs — Dockerfile pattern, Chrome deps, Alpine warning, Linux dependencies
- OpenAI Whisper model card — hallucination/repetition limitations officially documented
- PyPI — Version verification for all Python packages
- npm — Version verification for all Node.js packages
- OpusClip official site — competitor feature analysis
- Descript official site — competitor feature analysis

### Secondary (MEDIUM confidence)
- Vizard official site — JS-rendered, feature extraction from landing page only
- Remotion GPU/GL docs — angle renderer memory leak warning, GPU options
- Docker Desktop VirtioFS docs — filesystem performance settings
- NVIDIA CUDA Docker base image recommendations from faster-whisper GitHub README

### Tertiary (LOW confidence)
- Docker named volume vs. bind mount performance benchmarks — general community knowledge, not empirically measured in this research round. Validate during Phase 1 with actual video files.

---
*Research completed: 2026-05-05*
*Ready for roadmap: yes*