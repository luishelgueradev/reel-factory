# Phase 10: Async Batch + Orchestrator - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Source:** Derived from ROADMAP.md requirements and prior phase context

<domain>
## Phase Boundary

BullMQ queue, Redis, and pipeline orchestrator for batch video processing. Users submit multiple videos via POST /batch, receive a batchId and individual jobIds per video, and the orchestrator executes the full pipeline step sequence per job with configurable concurrency. This phase extends the existing api-server (Phase 9) with async batch capabilities and BullMQ job management.

This phase does NOT change any processing containers — it adds queue infrastructure (Redis + BullMQ), a batch endpoint, and an async orchestration layer on top of the existing synchronous `runPipeline()` function. The API server gains a new BullMQ worker process that consumes jobs from the queue and runs the same pipeline steps.

**Key requirements:** APIA-01 (POST /batch with job IDs), APIA-02 (BullMQ + Redis with rate limiting), APIA-03 (orchestrator manages container lifecycle per job).

</domain>

<decisions>
## Implementation Decisions

### Batch API Design
- **D-01:** POST /batch accepts multiple video files in a single multipart request (same Multer pattern as POST /process, with multiple file fields). Each file becomes a separate BullMQ job. This is the simplest extension of the existing upload pattern — no new upload mechanism needed, just `upload.array("videos", MAX_BATCH_SIZE)`.
- **D-02:** POST /batch returns immediately with `{ batchId, jobs: [{ jobId, filename, status: "queued" }, ...] }`. The client polls GET /status/{jobId} (Phase 11) for progress. No synchronous waiting — async-first design.
- **D-03:** Each batch upload gets a `batchId` that groups related `jobIds`. GET /batch/{batchId} returns all jobs' statuses for the batch. This provides a unit-of-work concept for clients tracking "this upload of 5 videos" without coupling individual job processing.

### Job Orchestration
- **D-04:** Each BullMQ job = one full pipeline run (whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → srt-exporter). The existing `runPipeline()` function becomes the BullMQ job processor. Simple mental model, easy per-job progress tracking.
- **D-05:** Per-step progress is tracked via a Redis hash per job (key: `job:{jobId}`, fields: `currentStep`, `status`, `error`, timestamps per step). This is decoupled from BullMQ internals and ready for Phase 11 to extend with step-level progress details and completion percentages.
- **D-06:** On job failure, BullMQ retries the entire pipeline from the beginning (full pipeline retry). This is simple and predictable — if Whisper fails, the whole job retries from step 1. Partial outputs from the failed run are cleaned up before retry. Matches the sequential dependency chain where each step depends on the previous step's output.
- **D-07:** Jobs within a batch are independent — if job 2 of 5 fails, jobs 1, 3-5 continue unaffected. Failed jobs are marked with error details. The client checks per-job status. No "all or nothing" batch semantics.

### Concurrency & Rate Limiting
- **D-08:** Default max 2 concurrent pipeline jobs, configurable via `MAX_CONCURRENT_JOBS` env var. Balances throughput (two videos processing simultaneously) with resource constraints (GPU for Whisper, Chrome memory for Remotion).
- **D-09:** GPU access for Whisper is implicitly serialized because there's only one GPU on the Docker host. A single BullMQ queue with concurrency=2 means at most 2 pipeline runs active at a time — if both are in the Whisper step, Docker handles GPU scheduling (one runs, the other waits). No separate GPU queue needed — the hardware constraint is the natural serializer.
- **D-10:** Per-request batch size limit of 10 files max (configurable via `MAX_BATCH_SIZE` env var). Prevents a single client from flooding the queue with hundreds of jobs. The Multer upload.array() call enforces this at the API level.

### the agent's Discretion
- BullMQ retry configuration (attempts, backoff strategy, delay between retries)
- Redis persistence config (RDB vs AOF for job queue durability)
- Whether the BullMQ worker runs in the same Node.js process as the Express server or as a separate process
- Exact Redis hash schema design (field names, TTL policy for completed jobs)
- Job cleanup/eviction policy for completed jobs in Redis
- Logging format for job lifecycle events
- Whether to add a dedicated health check endpoint for Redis and BullMQ connection status

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions (Docker pipeline architecture, extensible step contracts)
- `.planning/REQUIREMENTS.md` — APIA-01, APIA-02, APIA-03 requirements
- `.planning/ROADMAP.md` — Phase 10 goal, success criteria, plan breakdown
- `.planning/STATE.md` — Current project position

### Prior Phase Context (Foundation)
- `.planning/phases/09-synchronous-api/09-CONTEXT.md` — API server architecture (D-01 to D-11), Dockerode orchestration, POST /process pattern, artifact URLs, timeout handling
- `.planning/phases/01-pipeline-infrastructure/01-CONTEXT.md` — Volume strategy (D-01 to D-04), step contract (D-05 to D-07), artifact naming (D-10 to D-13)

### Technology Stack
- `.planning/research/STACK.md` — BullMQ 5.76.5, ioredis 5.12.1, Redis 7.x, Express.js 5, Zod 4.4.3

### Existing Codebase (CRITICAL — reuse and extend)
- `services/api-server/src/orchestrator.ts` — `runPipeline()` function, `PipelineStepConfig[]`, `PipelineResult`, `PipelineStepError`, `STEPS` config, Dockerode container creation and lifecycle — the core orchestration that becomes the BullMQ job processor
- `services/api-server/src/index.ts` — Express app setup, error handler, route mounting
- `services/api-server/src/routes/process.ts` — Multer upload config, POST /process route handler, `UnsupportedMediaTypeError`, `FileTooLargeError` — pattern to reuse for POST /batch
- `services/api-server/src/routes/artifacts.ts` — GET /artifacts/:jobId route for artifact listing and file serving
- `services/api-server/src/schemas/response.ts` — `ArtifactResponseSchema`, Zod response validation — extend for batch response
- `services/api-server/src/constants.ts` — `PIPELINE_DATA_DIR`, `PIPELINE_NETWORK`, `HOST_PIPELINE_DIR` env vars
- `shared/constants.ts` — `PIPELINE_DATA_DIR`, `STEP_NAMES`, `OUTPUT_FILENAMES`, `manifestPath()` — path helpers used by orchestrator
- `docker-compose.yml` — Pipeline service definitions, Docker socket mount, network config — will add Redis service and update api-server with BullMQ env vars

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/api-server/src/orchestrator.ts`: The `runPipeline(jobId, options)` function creates Docker containers via Dockerode, runs each step sequentially, reads manifest.json for status, and returns `PipelineResult`. This becomes the BullMQ job processor — each job calls `runPipeline()`. The `PipelineStepConfig` interface and `STEPS` array define the step sequence and env var templates.
- `services/api-server/src/routes/process.ts`: The POST /process route handles Multer upload, job directory creation, and pipeline execution. The batch endpoint follows the same upload pattern but with `upload.array()` instead of `upload.single()`, and queues jobs instead of running synchronously.
- `services/api-server/src/constants.ts`: `PIPELINE_DATA_DIR`, `PIPELINE_NETWORK`, `HOST_PIPELINE_DIR` — all env-overridable constants needed for Docker orchestration.
- `shared/schemas/manifest.ts`: `PipelineManifest` schema — each step writes this; the orchestrator reads it to detect step failures.
- `docker-compose.yml`: Already has the api-server service with Docker socket mount and volume bind. Adding Redis service and BullMQ env vars follows the established Compose pattern.

### Established Patterns
- Step contract: Read INPUT_PATH, write to OUTPUT_PATH, create manifest.json (D-05/D-07 Phase 1)
- Job directory structure: `/data/pipeline/{jobId}/input/video.mp4` for input, `/data/pipeline/{jobId}/{stepName}/` for outputs
- Dockerode container lifecycle: create → start → wait → read manifest → check status
- Express route + Zod schema pattern: validate request, process, validate response
- Error handling via `PipelineStepError` with step name, exit code, and error message

### Integration Points
- `services/api-server/src/orchestrator.ts`: Core reuse — `runPipeline()` becomes the BullMQ job processor
- `docker-compose.yml`: Add `redis` service, update `api-server` with `REDIS_URL` env var and BullMQ worker config
- `services/api-server/src/routes/process.ts`: New `batchRouter` alongside existing `processRouter`, shares Multer config and error handling
- `services/api-server/src/index.ts`: Mount `batchRouter` and potentially start BullMQ worker process
- Redis: New infrastructure — `job:{jobId}` hashes for progress, BullMQ queue persistence
- `shared/constants.ts`: May need `STEP_NAMES.srtExporter` addition (currently only has whisper, silenceCutter, remotionRenderer, ffmpegFinalizer)

### Key Gaps in Existing Code
- No BullMQ or Redis dependencies in api-server package.json — need to add `bullmq` and `ioredis`
- No Redis service in docker-compose.yml — need to add
- No batch endpoint or batch response schemas — need to create
- No BullMQ worker process or queue configuration — need to create
- No Redis hash schema for job progress — need to design
- `STEP_NAMES` in shared/constants.ts is missing `srt-exporter` entry

</code_context>

<specifics>
## Specific Ideas

- BullMQ's job processor is a simple async function: `const processor = async (job: Job) => { await runPipeline(job.data.jobId); }`. The existing `runPipeline()` already handles Docker container lifecycle, error detection via manifest.json, and result collection. Adding BullMQ wrapping is minimal — the queue just calls `runPipeline()` and updates Redis progress hashes between steps.
- Redis progress hashes should have a TTL (e.g., 24 hours) to prevent stale data accumulation. Completed jobs that aren't fetched within the TTL get cleaned up automatically. This avoids needing a separate cleanup cron job.
- The `upload.array("videos", MAX_BATCH_SIZE)` pattern is a direct extension of the existing `upload.single("video")` in process.ts. Multer handles multi-file validation, size limits, and temp storage.
- The batchId can be a UUID (like jobId) that groups multiple jobIds. BullMQ doesn't have a native "batch" concept, so the batchId is stored as metadata on each job (`job.data.batchId`) and in a Redis hash (`batch:{batchId}` → list of jobIds). GET /batch/{batchId} queries all jobs in the batch by their jobIds.
- Concurrency=2 on a single BullMQ queue is the simplest approach. The GPU serialization for Whisper happens naturally — Docker's nvidia runtime only allocates GPU to one container at a time when GPU memory is limited. If the Whisper model fits in VRAM with room to spare, true parallel GPU execution could be enabled later by increasing `MAX_CONCURRENT_JOBS`.
- Job retry with BullMQ uses `attempts` and `backoff` configuration on the queue. A reasonable default is 1 automatic retry with exponential backoff (30s delay), then mark as permanently failed. The `runPipeline()` function already creates fresh containers per run, so retrying from the beginning is clean.
- The BullMQ worker can run in the same Node.js process as the Express server (simpler deployment, one container) or as a separate process (better isolation, can scale workers independently). For v1, same-process is simpler and the api-server container handles both HTTP requests and job processing.

</specifics>

<deferred>
## Deferred Ideas

- **Progress tracking endpoint (GET /status/{jobId})** — Phase 11 scope (PROG-01, PROG-02)
- **Authentication and API key rate limiting** — v2 concern, not in v1 requirements
- **Job result persistence and cleanup policy** — The API leaves artifacts for inspection; a future phase can add lifecycle management
- **WebSocket progress notifications** — Phase 11 scope (PROG-01, PROG-02)
- **Separate GPU/CPU queue architecture** — Over-engineering for v1; single queue with concurrency=2 and natural GPU serialization is simpler
- **Job cancellation API** — Not in v1 requirements; BullMQ supports it natively but no endpoint needed yet
- **Batch-level progress aggregation** — Phase 11 can add a summary view (X/5 complete, 2/5 processing, 1/5 queued)

---

*Phase: 10-Async Batch + Orchestrator*
*Context gathered: 2026-05-13*