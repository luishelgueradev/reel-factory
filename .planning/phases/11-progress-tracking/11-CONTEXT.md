# Phase 11: Progress Tracking - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Source:** Derived from ROADMAP.md requirements and prior phase context

<domain>
## Phase Boundary

GET /status/{jobId} endpoint returning real-time per-step progress for pipeline jobs — current step name, overall progress percentage, completed steps list, and step fraction. This phase extends the existing api-server with a new status endpoint that reads from the Redis progress hashes already created by Phase 10's worker.ts.

This phase does NOT change any processing containers or the BullMQ worker pipeline. It adds: (1) a GET /status/{jobId} Express route with Zod response validation, (2) extension of the progress.ts module to store completed steps list and current step startedAt, (3) progress tracking for synchronous POST /process jobs (not just batch), (4) E2E validation of step transitions.

**Key requirements:** PROG-01 (per-step progress with step name), PROG-02 (completion percentage where available).

</domain>

<decisions>
## Implementation Decisions

### Response Shape
- **D-01:** GET /status/{jobId} returns a step-aware response: `{ jobId, status, currentStep, progress, stepInfo, steps, startedAt, error }`. The `steps` array contains completed step names (strings). The `currentStep` is the name of the active or last step. The `progress` field is a step-index percentage (0, 20, 40, 60, 80, 100 for 5 steps). The `stepInfo` field is a fraction string like "3/5" for human readability.
- **D-02:** Completed steps are stored as a list of names (strings) only — no per-step timestamps in the response or in Redis. Lightweight, fast, and aligned with the existing progress hash structure.
- **D-03:** Unknown or expired jobId (24h TTL) returns HTTP 404. No separate 410 Gone status — Redis TTL expiration means the data is gone.
- **D-04:** GET /status/{jobId} works for both batch-submitted jobs (Phase 10) and synchronous POST /process jobs (Phase 9). The POST /process endpoint will be extended to write initial progress to Redis before pipeline execution, and update progress during execution via the onStepStart callback (same pattern as worker.ts).

### Progress Percentage
- **D-05:** Progress percentage uses step-index calculation: `((stepIndex + 1) / totalSteps) * 100`. With 5 pipeline steps: queued=0%, whisper=20%, silence-cutter=40%, ffmpeg-finalizer=60%, remotion-renderer=80%, srt-exporter=100%. The percentage jumps at step boundaries — no interpolation within steps.
- **D-06:** The response includes `stepInfo` (e.g., "3/5") alongside `progress` so clients can understand which step is active without parsing step names.

### the agent's Discretion
- Exact Zod schema field names and types for the status response
- Whether `startedAt` on the response refers to job creation time or first step start time
- Redis hash field naming convention for completed steps list (comma-joined string vs JSON array)
- Whether to add a `totalSteps` field to the response (redundant with stepInfo "3/5" but explicit)
- Whether the GET /status route is a separate router file or added to existing routes
- Error response format for 404 (JSON body structure)
- Whether `steps` in the response includes the current step or only completed steps
- Whether POST /process should return a jobId in its response for status polling

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions (Docker pipeline architecture, extensible step contracts)
- `.planning/REQUIREMENTS.md` — PROG-01, PROG-02 requirements
- `.planning/ROADMAP.md` — Phase 11 goal, success criteria, plan breakdown
- `.planning/STATE.md` — Current project position

### Prior Phase Context (Foundation)
- `.planning/phases/10-async-batch-orchestrator/10-CONTEXT.md` — BullMQ queue architecture, Redis progress hashes, batch endpoint, worker onStepStart callback (D-01 to D-10)
- `.planning/phases/09-synchronous-api/09-CONTEXT.md` — API server architecture, POST /process route pattern, Zod validation, Dockerode orchestration

### Existing Codebase (CRITICAL — extend, don't rebuild)
- `services/api-server/src/progress.ts` — `updateJobProgress()`, `getJobProgress()`, `addJobToBatch()`, `getBatchJobs()` — Redis hash operations for job progress. This is the PRIMARY module to extend for Phase 11.
- `services/api-server/src/worker.ts` — `processJob()` with `onStepStart` callback that calls `updateJobProgress()`. This is where completed steps will be tracked.
- `services/api-server/src/orchestrator.ts` — `runPipeline()`, `PipelineStepConfig`, `STEPS` array (5 steps), `onStepStart` callback interface. The total steps count comes from `STEPS.length`.
- `services/api-server/src/routes/batch.ts` — Pattern for Express routes with Zod validation, Multer, and progress integration. New status route follows same patterns.
- `services/api-server/src/schemas/batch.ts` — Zod schemas for batch responses. New status schemas follow same pattern.
- `services/api-server/src/queue.ts` — `createQueueConnection()`, `videoQueue`. Status endpoint needs the queue to look up BullMQ job state.
- `services/api-server/src/index.ts` — Express app setup, route mounting, error handling.
- `services/api-server/src/constants.ts` — `PIPELINE_DATA_DIR`, `MAX_BATCH_SIZE`, `MAX_CONCURRENT_JOBS`.
- `shared/constants.ts` — `STEP_NAMES` — the authoritative list of pipeline step names.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `progress.ts:updateJobProgress()` — Already stores `status`, `currentStep`, `error`, `updatedAt` in Redis hash `job:{jobId}`. Phase 11 extends this to also store `steps` (completed steps list) and `startedAt` (job start timestamp).
- `progress.ts:getJobProgress()` — Already reads all fields from the Redis hash. Returns `Record<string, string> | null`. Returns null for expired/missing keys — natural 404 boundary.
- `worker.ts:processJob()` — Already calls `updateJobProgress(jobId, { status: "active", currentStep: stepName })` on each step start via `onStepStart`. Phase 11 extends this to also push completed step names to the `steps` list.
- `orchestrator.ts:STEPS` — Provides the total number of steps (`STEPS.length = 5`) and step names for step-index calculation.
- `orchestrator.ts:onStepStart(stepName, stepIndex, totalSteps)` — Already provides all data needed for step-info fraction and progress percentage.
- `batch.ts:getBatchJobs()` — Pattern for looking up jobIds from Redis and fetching their status.
- `schemas/batch.ts` — Pattern for Zod response schemas with enums and optional fields.

### Established Patterns
- Express route + Zod schema validation: every route has a corresponding Zod schema for response validation
- Redis hash for job progress: `job:{jobId}` → `{ status, currentStep, error, updatedAt }` with 24h TTL
- BullMQ job state: `videoQueue.getJob(jobId)` for authoritative completed/failed/active state
- Error handling: Express error handler in index.ts for consistent error responses
- Step contract: names in `STEPS` array match Docker container names and manifest paths

### Integration Points
- `progress.ts` — Add `completedSteps` field to Redis hash, add `startedAt` field for job start time
- `worker.ts` — Extend `onStepStart` callback to update `completedSteps` and `progress` in Redis
- `routes/` — New `status.ts` route file (or extend existing) for GET /status/:jobId
- `schemas/status.ts` — New Zod schema for the status response
- `index.ts` — Mount the new status router
- `routes/process.ts` — Extend POST /process to write initial progress to Redis and update progress during synchronous pipeline execution
- `shared/constants.ts` — May need `STEP_NAMES` or `STEPS.length` exported for step fraction calculation

### Key Gaps in Existing Code
- No GET /status/{jobId} endpoint exists — needs to be created
- No Zod schema for status response exists
- `progress.ts` doesn't store `completedSteps` or `startedAt` — needs extension
- `worker.ts:onStepStart` doesn't track completed steps — needs to push each step name on completion
- POST /process in `routes/process.ts` doesn't write progress to Redis — synchronous jobs have no status tracking
- `schemas/status.ts` doesn't exist — needs creation

</code_context>

<specifics>
## Specific Ideas

- The progress percentage formula is deterministic: `Math.round(((stepIndex + 1) / totalSteps) * 100)`. With 5 steps, this gives 20/40/60/80/100. The "queued" state is 0%. This is already computed in `worker.ts:44` as `job.updateProgress()`.
- The `completedSteps` list can be stored as a comma-joined string in Redis (e.g., "whisper,silence-cutter") since step names don't contain commas. Simple to read/write with `hset`/`hget` on the existing hash. No need for a separate Redis list.
- The status endpoint is a thin read layer over existing data: read Redis hash (`job:{jobId}`), optionally check BullMQ job state for authoritative completed/failed status, compute `progress` and `stepInfo` from the data. No writes needed.
- For POST /process synchronous jobs, the route handler already calls `runPipeline()`. Adding Redis progress writes is a matter of creating a jobId upfront (UUID), writing initial progress to Redis before pipeline starts, and passing an `onStepStart` callback to `runPipeline()` (same pattern as `worker.ts:processJob`).
- The `stepInfo` field format "3/5" uses `stepIndex + 1` from `onStepStart` and `STEPS.length` from the orchestrator. Both are already available.

</specifics>

<deferred>
## Deferred Ideas

- **WebSocket/SSE progress notifications** — Push-based real-time updates via WebSocket or Server-Sent Events. The current design is poll-based (GET /status). Push notifications are a natural v2 enhancement.
- **Per-step duration in status response** — Completed steps currently return names only. Adding `durationSeconds` or `startedAt/completedAt` per step would require storing timestamps in Redis per step. Deferred to keep v1 simple.
- **Job history/listing endpoint** — GET /jobs to list all jobs for a user. Not in v1 requirements.
- **Authentication and API key rate limiting** — v2 concern, not in v1 requirements.
- **Batch-level progress aggregation** — Summary view (X/5 complete, 2/5 processing) could be derived from GET /batch/{batchId} which already exists. No dedicated endpoint needed for v1.

---

*Phase: 11-Progress Tracking*
*Context gathered: 2026-05-13*