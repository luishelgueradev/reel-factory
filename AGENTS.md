<!-- GSD:project-start source:PROJECT.md -->
## Project

**Video Pipeline Docker**

Un pipeline de procesamiento de video containerizado en Docker que toma un MP4 como entrada, lo procesa automáticamente (transcripción con Whisper, corte de silencios, subtítulos dinámicos con Remotion) y genera videos optimizados para redes sociales en formato vertical 9:16. Sirve todo via API REST con capacidad de procesamiento individual y por lotes. Cada paso del pipeline es independiente e inspeccionable, permitiendo revisar salidas intermedias antes de continuar.

**Core Value:** Transformar un video crudo de una persona hablando en un video dinámico para redes sociales con un solo comando API, eliminando silencios y agregando subtítulos automáticamente.

### Constraints

- **Tech Stack**: Docker + Node.js (Remotion) + Python (Whisper) — lenguajes fijos por las herramientas
- **Architecture**: Pipeline basado en steps independientes, no monolito
- **Output Format**: 9:16 vertical como mínimo en v1
- **Video Input**: MP4, talking head, una persona hablando
- **Extensibility**: Cualquier nuevo paso debe poder incorporarse como container Docker en la secuencia sin refactorizar el pipeline
- **UI/frontend work — REQUIRED tooling (no-negociable)**: Toda fase o tarea que toque el frontend (remotion-studio editor/preview, componentes, layout, estilos, UX) DEBE invocar al inicio del plan o execute (no como afterthought):
  1. La skill `impeccable` — disponible en Claude Code y opencode
  2. El plugin `frontend-design` de Claude Code — usar cuando se trabaja en Claude Code; en opencode usar equivalente disponible o documentar el skip
  Esto es la garantía de calidad visual del proyecto: ninguna decisión de UI improvisada.

### Development Conventions

- **remotion-studio port**: ALWAYS port **3123**. Never use any other port. Start with `cd services/remotion-studio && setsid env PORT=3123 EDITOR_DIST=$(pwd)/dist/editor ACTIVE_PIPELINE_CONFIG_PATH=$(pwd)/../../pipeline/pipeline-config.json npx tsx src/server.ts > /tmp/remotion-server.log 2>&1 &` — use `setsid` so the process survives shell termination. `ACTIVE_PIPELINE_CONFIG_PATH` must point to the project-root `pipeline/pipeline-config.json` so that settings saved in the Studio UI propagate to the pipeline.
- **remotion-studio build**: `npm run build:editor` from `services/remotion-studio/`
- **Renderer sync pattern**: After modifying compositions or shared files in remotion-studio, copy to remotion-renderer. Component files live in `compositions/` in BOTH services; shared logic modules live at `src/` root in both. From `services/remotion-studio/`:
  ```bash
  cp src/compositions/* ../remotion-renderer/src/compositions/        # layouts, shared-styles, tests
  cp src/pipeline-config.ts src/fonts.ts src/captions.ts src/zoom-detection.ts ../remotion-renderer/src/
  ```
  Do NOT copy `*.tsx` into `../remotion-renderer/src/` root — that creates dead orphan copies, since `LayoutDispatcher` imports layouts from `./compositions/`. Do NOT sync `Root.tsx` or `SubtitledVideo.tsx`: the renderer's `Root.tsx` registers a `<Composition>` for CLI rendering (studio's drives a `<Player>`), and the renderer defines `SubtitledVideo` inline in `Root.tsx`.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Faster Whisper** | 1.2.1 | Speech-to-text transcription with word-level timestamps | 4x faster than openai-whisper, lower memory, CTranslate2 backend. Built-in VAD filter for silence detection. Word-level timestamps critical for word-by-word subtitles. HIGH confidence — verified via Context7 + PyPI. |
| **Remotion** | 4.0.457 | Programmatic video rendering (captions, intros, zooms) | Only framework that lets you render video overlays (subtitles, B-roll placeholders, zooms) as React code. Built-in `@remotion/captions` for TikTok-style word highlighting. Official Docker support with `npx remotion browser ensure`. HIGH confidence — verified via Context7 + npm. |
| **FFmpeg** | 7.x (static build) | Audio extraction, silence detection, video re-encoding | Industry standard for video/audio manipulation. Used for: extracting audio from MP4 for Whisper, detecting silence segments via `silencedetect` filter, cutting/final encoding to 9:16. Required by Remotion for rendering. HIGH confidence. |
| **FastAPI** | 0.136.1 | Python REST API for Whisper/analysis steps | Native fit for the Python Whisper container. File upload via `UploadFile`, background tasks for async processing, Pydantic validation for pipeline data contracts. Async-native for I/O-bound video processing. HIGH confidence — verified via Context7 + PyPI. |
| **Express.js** | 5.2.1 | Node.js REST API for Remotion/render steps | Natural fit since Remotion is Node.js-based. Remotion's `renderMedia()` and `bundle()` APIs are Node-first. Avoids cross-language IPC for the render step. v5 is stable. HIGH confidence — verified via npm. |
| **BullMQ** | 5.76.5 | Job queue for batch/async processing | Redis-backed job queue with retries, prioritization, job progress tracking. Perfect for long-running video renders. Works in Node.js (same runtime as Remotion). Better than Bull v4 — active development, no abandoned issues. HIGH confidence — verified via npm. |
| **Redis** | 7.x | Job queue backing store + pipeline state cache | Required by BullMQ. Also useful for caching pipeline step results and tracking job progress. Lightweight, battle-tested. HIGH confidence. |
| **Docker Compose** | v2 (compose specification) | Multi-container orchestration | Each pipeline step = one container. Compose defines the sequence, shared volumes, network. Standard tool, no alternatives needed. HIGH confidence. |
### Python Container (Whisper + Analysis)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **faster-whisper** | 1.2.1 | Transcription engine | Every video — core pipeline step |
| **ctranslate2** | 4.7.1 | CTranslate2 backend for faster-whisper | Installed as faster-whisper dependency. Use `float16` on GPU, `int8` on CPU |
| **pydantic** | 2.13.3 | Data validation for pipeline I/O contracts | Define schemas for transcription output, silence segments, pipeline step results |
| **python-multipart** | 0.0.27 | File upload support for FastAPI | Required for uploading MP4 files via the API |
| **uvicorn** | 0.46.0 | ASGI server for FastAPI | Production server — use `--workers` for concurrency |
### Node.js Container (Remotion + Render)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **remotion** | 4.0.457 | Core Remotion framework | Required — defines compositions, `<Sequence>`, `<AbsoluteFill>` |
| **@remotion/cli** | 4.0.457 | CLI for `npx remotion render`, `npx remotion browser ensure` | Docker setup, local dev preview |
| **@remotion/renderer** | 4.0.457 | Server-side `renderMedia()`, `selectComposition()` | Production rendering from API calls |
| **@remotion/bundler** | 4.0.457 | Webpack bundling for SSR rendering | Called once before render, bundle cached for reuse |
| **@remotion/captions** | 4.0.457 | `createTikTokStyleCaptions()`, `TikTokPage` type | Converts word-level timestamps into paged subtitle groups |
| **@remotion/install-whisper-cpp** | 4.0.457 | Alternative Whisper.cpp transcription from Node.js | **Use only if you want ALL processing in Node.js.** For this project, prefer Faster Whisper in Python container — better GPU support, batched inference, VAD filter built-in |
| **@remotion/media-utils** | 4.0.457 | Audio waveform analysis, video metadata | For getting video duration, audio levels in React components |
| **@remotion/paths** | 4.0.457 | SVG path utilities for animated graphics | For intro/outro animation paths |
| **bullmq** | 5.76.5 | Job queue client | Async batch processing, job progress tracking |
| **ioredis** | 5.12.1 | Redis client | BullMQ requires it. Also for pipeline state tracking |
| **zod** | 4.4.3 | Schema validation for API I/O | Validate pipeline step data between containers |
| **uuid** | 14.0.0 | Job/pipeline ID generation | Unique identifiers for each processing run |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **Docker** | Container runtime | Each pipeline step = isolated container. Use `node:22-bookworm-slim` for Remotion, `python:3.12-slim` for Whisper |
| **Docker Compose v2** | Multi-container orchestration | Define service dependencies, shared volumes, health checks |
| **ffmpeg (static build)** | Audio/video processing | Install via `johnvansickle/ffmpeg-builds` static binary in Docker, or `apt-get install ffmpeg` |
| **NVIDIA Container Toolkit** | GPU passthrough for Whisper | Required for CUDA in Docker. Add `deploy.resources.reservations.devices` in Compose |
| **Remotion Studio** | Local dev preview | `npx remotion studio` — live preview of captions, zooms, intros before Dockerizing |
## Installation
# === Python container (Whisper + Analysis) ===
# === Node.js container (Remotion + Render) ===
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|------------|-------------------------|
| **Faster Whisper (Python)** | **openai-whisper (Python)** | When you need OpenAI's exact API compatibility or are fine-tuning Whisper models. openai-whisper is slower (no CTranslate2) but is the reference implementation. Version 20250625. |
| **Faster Whisper (Python)** | **@remotion/install-whisper-cpp (Node.js)** | When you want to avoid a Python container entirely and do everything in Node.js. Trade-off: whisper.cpp is fast but lacks Faster Whisper's `BatchedInferencePipeline`, built-in VAD filtering, and GPU batching. For this project, the Python container is worth the overhead. |
| **Faster Whisper (Python)** | **whisper.cpp (C++ direct)** | When you need maximum speed on CPU-only systems with minimal dependencies. Harder to integrate into a Docker pipeline. Faster Whisper wraps CTranslate2 which already uses whisper.cpp models. |
| **FastAPI** | **Flask** | When you need maximum simplicity and don't care about async, auto-docs, or Pydantic validation. Flask is simpler but lacks native async — a problem for I/O-bound video processing. |
| **Express.js** | **Fastify** | When you need maximum HTTP throughput (>10K req/s). Fastify is faster but Express v5 with async support is sufficient for a video pipeline API that processes maybe 1-5 concurrent jobs. |
| **BullMQ** | **Celery (Python)** | When the entire pipeline is Python. BullMQ is better here because the render step runs in Node.js — avoiding a Python↔Node IPC for queue management. |
| **BullMQ** | **RQ (Python)** | When you need a minimal Python queue and don't need prioritization. RQ is too basic for a multi-step pipeline with progress tracking. |
| **Docker Compose** | **Kubernetes** | When you need horizontal auto-scaling across multiple nodes. Overkill for a single-server video pipeline. Compose is the right tool. |
| **FFmpeg silencedetect** | **pydub/silence** | When you need only Python-native silence detection without FFmpeg. pydub wraps FFmpeg anyway, so just use FFmpeg directly. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **openai-whisper** | 4x slower than Faster Whisper, higher VRAM, no built-in VAD filter, no batched inference. Still useful as reference but not for production pipeline. | Faster Whisper 1.2.1 |
| **MoviePy** | Python video editing library. Slow (re-encodes everything), single-threaded, poor memory management. Not suitable for production video processing. | FFmpeg directly for cutting/encoding, Remotion for overlay rendering |
| **Deepgram API** | Cloud-only transcription. Adds network latency, API costs, and external dependency. Conflicts with "runs locally in Docker" requirement. | Faster Whisper (runs locally in container) |
| **Puppeteer-based rendering** | Managing Chrome/Puppeteer manually for video rendering. Remotion handles all Chrome lifecycle, bundling, frame capture internally. | Remotion's `@remotion/renderer` |
| **Bull v3 (npm: bull)** | Abandoned. Last meaningful update was years ago. BullMQ is the successor, actively maintained, same author. | BullMQ 5.x |
| **Redis 6.x** | Redis 7.x has better memory efficiency, ACLs, and function support. No reason to use older version. | Redis 7.x |
| **Node 18** | Node 18 enters maintenance. Node 22 LTS is current and recommended by Remotion docs for Docker. | Node 22 (bookworm-slim) |
| **Python 3.10 or earlier** | Faster Whisper and CTranslate2 benefit from Python 3.12 performance improvements. Pydantic v2 requires 3.8+ but 3.12 is recommended. | Python 3.12-slim |
| **webm/VP9 output** | Slower encoding, larger files, worse compatibility than H.264. Social platforms prefer H.264. | H.264 (codec in Remotion's `renderMedia`) |
## Stack Patterns by Variant
- Faster Whisper: use `device="cuda"`, `compute_type="float16"`, model `"large-v3"` or `"turbo"`
- Docker: add NVIDIA Container Toolkit, `deploy.resources.reservations.devices` in Compose
- Remotion: add `--gl=angle-egl` flag, `chromiumOptions: { enableMultiProcessOnLinux: true }`
- Because: GPU gives 4-10x speedup on Whisper; angle-egl enables hardware-accelerated rendering in Remotion Docker
- Faster Whisper: use `device="cpu"`, `compute_type="int8"`, model `"small"` or `"medium"`
- Remotion: default chrome flags, no GPU flags needed
- Because: int8 quantization halves memory with minimal accuracy loss; smaller models fit CPU constraints
- Faster Whisper: DO NOT use `.en` models (English-only), use `"medium"` or `"large-v3"` for multilingual
- Set `language="es"` explicitly to skip language detection and improve accuracy
- Because: `.en` models fail on Spanish; multilingual models handle Spanish well but need explicit language hint for best accuracy
## Architecture Mapping: Stack to Containers
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| faster-whisper@1.2.1 | ctranslate2@4.7.1 | Auto-installed as dependency. Do not pin ctranslate2 separately unless you have version conflicts |
| remotion@4.0.457 | @remotion/*@4.0.457 | **All @remotion packages must be the same version.** Mismatched versions cause cryptic render failures |
| @remotion/captions@4.0.457 | remotion@4.0.457 | Strict peer dependency — must match exactly |
| bullmq@5.76.5 | ioredis@5.12.1 | BullMQ requires ioredis. redis@5.x (npm) is NOT compatible — use ioredis |
| fastapi@0.136.1 | pydantic@2.13.3 | FastAPI requires Pydantic v2. Pydantic v1 is NOT compatible |
| Node 22 | Remotion 4.0.x | Remotion docs explicitly recommend Node 22 for Docker |
| Chrome Headless Shell | Remotion 4.0.x | Installed via `npx remotion browser ensure` — automatically gets compatible version |
## Whisper Model Selection Guide
| Model | VRAM (GPU) | RAM (CPU) | Speed | Accuracy | Use When |
|-------|-----------|----------|-------|----------|----------|
| `tiny` | ~1 GB | ~1 GB | Fastest | Lowest | Quick testing, not production |
| `base` | ~1 GB | ~1 GB | Very fast | Low | Prototyping |
| `small` | ~2 GB | ~2 GB | Fast | Good | CPU-only, Spanish ok |
| `medium` | ~5 GB | ~5 GB | Medium | Very good | **Recommended default** — balance of speed/accuracy, multilingual |
| `large-v3` | ~10 GB | ~10 GB | Slow | Best | GPU only, need maximum accuracy |
| `turbo` | ~6 GB | ~6 GB | Fast | Very good | GPU only, best speed/accuracy ratio on CUDA |
## Sources
- Context7 `/systran/faster-whisper` — Faster Whisper transcription, VAD, word timestamps (HIGH confidence)
- Context7 `/remotion-dev/remotion` — Remotion SSR rendering, Docker setup, captions, whisper.cpp integration (HIGH confidence)
- Context7 `/fastapi/fastapi` — FastAPI file upload, background tasks (HIGH confidence)
- Context7 `/openai/whisper` — OpenAI Whisper reference API, word timestamps (HIGH confidence)
- PyPI — Version verification: faster-whisper 1.2.1, openai-whisper 20250625, fastapi 0.136.1, pydantic 2.13.3, uvicorn 0.46.0, ctranslate2 4.7.1 (HIGH confidence)
- npm — Version verification: remotion 4.0.457, express 5.2.1, bullmq 5.76.5, ioredis 5.12.1, zod 4.4.3 (HIGH confidence)
- Remotion official Docker docs — Dockerfile pattern, Chrome dependencies, `npx remotion browser ensure` (HIGH confidence)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
