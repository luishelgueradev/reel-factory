# Phase 9: Synchronous API - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning
**Source:** Derived from ROADMAP.md requirements and prior phase context

<domain>
## Phase Boundary

POST /process endpoint for single-video on-demand processing. Users submit an MP4 video and receive a fully processed 9:16 vertical video with animated subtitles, plus URLs to all intermediate artifacts. The API wraps the existing Docker-based pipeline into a synchronous REST endpoint with Express.js, handling file upload, pipeline orchestration, artifact collection, and timeout management.

This phase does NOT change any processing containers — it exposes the existing pipeline steps (whisper, silence-cutter, ffmpeg-finalizer, remotion-renderer, srt-exporter) through a new Express.js API service. The API is a thin orchestration layer that programmatically runs the same `docker compose run` commands currently executed by process.sh, collecting results and responding with processed video + artifact URLs.

</domain>

<decisions>
## Implementation Decisions

### Architecture
- **D-01:** The API service runs as a new `api-server` Docker container built on Node.js (same runtime as remotion-renderer). Express.js 5 serves the REST API per STACK.md. The container joins the pipeline network and accesses the shared Docker volume.
- **D-02:** Pipeline execution follows the existing step sequence: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → srt-exporter. The API invokes each step using Docker Compose programmatic API (dockerode) or child process `docker compose run`, preserving the same env vars and healthcheck pattern as process.sh.
- **D-03:** The API server reads artifact URLs from the shared pipeline volume at `/data/pipeline/{jobId}/` — each step's output directory contains manifest.json + output files. The API constructs URLs relative to the server's base URL using the step name and filename pattern.

### Endpoint Design
- **D-04:** POST /process accepts MP4 upload via multipart/form-data, returns processed video and artifact URLs in the response body. Synchronous endpoint — the client waits until processing completes.
- **D-05:** Response includes a JSON object with: `jobId`, `videoUrl` (processed 9:16 video), `artifacts` (map of step name → list of artifact URLs), `duration` (processing time in seconds).
- **D-06:** Intermediate artifact URLs follow the pattern `/artifacts/{jobId}/{stepName}/{filename}` served via Express static middleware from the shared pipeline volume.

### Timeout & Error Handling
- **D-07:** Configurable timeout for pipeline execution (default: 10 minutes). Exposed via `PROCESS_TIMEOUT_MS` env var. If pipeline exceeds timeout, the API returns HTTP 408 with a meaningful error message including which step timed out.
- **D-08:** Pipeline step failures are caught per-step. If a container exits with non-zero code, the API returns HTTP 500 with the step name, exit code, and error message from that step's manifest.json.
- **D-09:** Job directory cleanup is the agent's Discretion — synchronous processing means the client receives the response before cleanup can happen. Default behavior: leave artifacts for inspection. A future async phase can add cleanup.

### Pipeline Orchestration
- **D-10:** The API orchestrates pipeline steps sequentially using the same order as process.sh: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → srt-exporter. Each step's depends_on and healthcheck are respected via Docker Compose.
- **D-11:** The API generates a unique `jobId` (UUID v4) for each request, creates the job directory structure at `/data/pipeline/{jobId}/input/video.mp4`, and manages the full lifecycle programmatically.

### the agent's Discretion
- Whether to use dockerode (programmatic Docker API) or child_process.spawn for Docker Compose invocation
- Exact Express middleware stack (cors, rate limiting, request size limits)
- Whether to add a GET /health endpoint alongside POST /process
- Request validation library (Zod per STACK.md or native Express validation)
- Whether to stream the processed video in the response body or return a URL
- Cleanup policy for job artifacts after response
- Logging library and format

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions (Docker pipeline architecture, extensible step contracts)
- `.planning/REQUIREMENTS.md` — APIS-01, APIS-02, APIS-03 requirements
- `.planning/ROADMAP.md` — Phase 9 goal, success criteria, plan breakdown
- `.planning/STATE.md` — Current project position

### Prior Phase Context (Foundation)
- `.planning/phases/01-pipeline-infrastructure/01-CONTEXT.md` — Volume strategy (D-01 to D-04), step contract (D-05 to D-07), artifact naming (D-10 to D-13)
- `.planning/phases/08-srt-vtt-subtitle-export/08-CONTEXT.md` — SRT/VTT exporter as step container, parallel with remotion-renderer

### Technology Stack
- `.planning/research/STACK.md` — Express.js 5, Node.js 22, Zod, FastAPI (not used for API server — Express per D-01)

### Existing Codebase (CRITICAL — pipeline patterns to reuse)
- `process.sh` — Current bash orchestration script that the API replaces programmatically
- `docker-compose.yml` — Service definitions, env vars, healthcheck patterns, volume mount
- `shared/constants.ts` — Job directory structure, step names, output filenames, path helpers
- `shared/schemas/step-contract.ts` — INPUT_PATH, OUTPUT_PATH, PIPELINE_JOB_ID env var contract
- `shared/schemas/manifest.ts` — PipelineManifest schema for reading step output status
- `services/remotion-renderer/src/render.ts` — Reference for how pipeline services are invoked and error-handled

</canonical_refs>

<specifics>
## Specific Ideas

- The API is a thin orchestration layer — it doesn't process video itself, it programmatically runs the same Docker containers that process.sh runs manually. The key difference is that it handles upload, job creation, step sequencing, result collection, and error handling in a single HTTP request.
- Express.js 5 (per STACK.md) with async/await support is the right choice for the API since the pipeline orchestration involves sequential async operations.
- The shared pipeline volume at `./pipeline` (mounted as `/data/pipeline` in Docker) is already the right mechanism for artifact collection. The API reads from the same volume to construct artifact URLs.
- The `manifest.json` pattern from Phase 1 (shared/schemas/manifest.ts) already provides per-step status tracking — the API reads these manifests to detect which step failed.
- Zod (per STACK.md) should validate the multipart upload (file presence, file type check for video/mp4).
- The API container itself doesn't need to depend on pipeline services in docker-compose.yml since it orchestrates them programmatically via `docker compose run` commands, similar to how process.sh works but from within a container.

</specifics>

<deferred>
## Deferred Ideas

- **Async batch processing (POST /batch)** — Phase 10 scope (APIA-01, APIA-02, APIA-03)
- **Progress tracking (GET /status/{jobId})** — Phase 11 scope (PROG-01, PROG-02)
- **Authentication and rate limiting** — v2 concern, not in v1 requirements
- **Job result persistence and cleanup** — The API leaves artifacts for inspection; a future phase can add lifecycle management
- **WebSocket progress notifications** — Phase 11 scope (PROG-01, PROG-02)
- **API documentation (OpenAPI/Swagger)** — Nice to have but not required for v1

</deferred>

---

*Phase: 09-synchronous-api*
*Context gathered: 2026-05-12*