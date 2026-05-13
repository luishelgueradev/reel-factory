# Phase 11: Progress Tracking - Research

**Researched:** 2026-05-13
**Status:** Complete
**Discovery Level:** 0 (extending established in-repo patterns)

## Standard Stack

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Express.js | 5.2.1 | HTTP API framework (already in api-server) | HIGH — already used |
| BullMQ | 5.76.5 | Job queue (already integrated in Phase 10) | HIGH — already used |
| ioredis | 5.12.1 | Redis client (already integrated) | HIGH — already used |
| Zod | 4.4.3 | Schema validation (already in api-server) | HIGH — already used |
| Redis | 7.x | Key-value store for progress hashes | HIGH — already used |

**No new external dependencies required.** All infrastructure is in place from Phase 10.

## Architecture Patterns

### Current Progress Infrastructure (Phase 10)

The `progress.ts` module already provides:
- `updateJobProgress(jobId, { status, currentStep, error })` — writes to Redis hash `job:{jobId}`
- `getJobProgress(jobId)` — reads full hash, returns `Record<string, string> | null` (null = expired/missing)
- `addJobToBatch(batchId, jobId)` — RPUSH to Redis list `batch:{batchId}`
- `getBatchJobs(batchId)` — LRANGE on batch list
- 24h TTL on job hashes, 25h TTL on batch lists

### Worker Progress Flow (Phase 10)

`worker.ts:processJob()` already has:
- `onStepStart(stepName, stepIndex, totalSteps)` callback that calls `updateJobProgress(jobId, { status: "active", currentStep: stepName })`
- `job.updateProgress(Math.round(((stepIndex + 1) / totalSteps) * 100))` for BullMQ progress
- Status transitions: "queued" → "active" (per step) → "completed" | "failed"

### Orchestrator Step Callback (Phase 10)

`orchestrator.ts:RunPipelineOptions` already includes:
- `onStepStart?: (stepName: string, stepIndex: number, totalSteps: number) => Promise<void>`
- Called in the pipeline loop before each container start
- `STEPS.length = 5` provides the total steps count
- `stepIndex` is 0-based

### Route Patterns (Phase 9-10)

Express routes follow consistent patterns:
- `routes/process.ts` — POST endpoint with Multer upload, Zod response validation
- `routes/batch.ts` — POST/GET endpoints, BullMQ job creation, progress integration
- `schemas/batch.ts` — Zod schemas with `z.object()`, `z.string()`, `z.enum()`
- Error handling via Express error handler in `index.ts`

## Features

### Progress Event Schema

Per D-01, the response shape is:
```typescript
{
  jobId: string;          // UUID
  status: "queued" | "active" | "completed" | "failed";
  currentStep: string;   // Step name or "completed"/"queued"/"unknown"
  progress: number;      // 0, 20, 40, 60, 80, 100 (step-index based per D-05)
  stepInfo: string;      // "3/5" format (stepIndex+1 / totalSteps per D-06)
  steps: string[];       // Completed step names (per D-02, names only)
  startedAt: string;     // ISO timestamp
  error?: string;        // Error message if status = "failed"
}
```

### Redis Hash Extension

Per D-02, completed steps stored as comma-joined string:
- Add `steps` field to `job:{jobId}` hash — e.g., "whisper,silence-cutter,ffmpeg-finalizer"
- Add `startedAt` field — ISO timestamp when job was first activated
- Reading: `hgetall` already returns all fields; parse `steps` field by splitting on comma

### Step-Index Progress Calculation

Per D-05:
- `progress = Math.round(((stepIndex + 1) / totalSteps) * 100)`
- 5 steps: queued=0%, whisper=20%, silence-cutter=40%, ffmpeg-finalizer=60%, remotion-renderer=80%, srt-exporter=100%
- Jump at step boundaries — no interpolation within steps

Per D-06:
- `stepInfo = `${stepIndex + 1}/${totalSteps}`` — e.g., "3/5"

### Synchronous Job Progress (POST /process)

Per D-04: POST /process endpoint extended to write initial progress to Redis before pipeline starts and update during execution via `onStepStart` callback. Pattern same as `worker.ts:processJob()`.

### HTTP Status Codes

Per D-03:
- Unknown or expired jobId (24h TTL) → HTTP 404
- No separate 410 Gone — Redis TTL expiration means data is gone

## Don't Hand Roll

- Use Zod for response validation (don't manually validate)
- Use `getJobProgress()` for Redis reads (already handles null cases)
- Use `videoQueue.getJob(jobId)` for authoritative BullMQ job state (already used in batch.ts)
- Use `updateJobProgress()` for Redis writes (already handles TTL refresh)
- Use `STEPS` from orchestrator.ts for step names and total count
- Use Express error handler for consistent error responses

## Common Pitfalls

| Pitfall | Avoidance |
|---------|-----------|
| Race condition: reading progress mid-write | Redis HSET is atomic; HGETALL reads all fields at once. No race condition. |
| Stale step name in response | `onStepStart` updates before container start. If step completes very fast, next step callback fires. Worst case: response shows previous step — acceptable per D-05 (step-index %, not per-step %). |
| POST /process synchronous jobs don't have progress | Per D-04, must create Redis hash before pipeline starts. Generate UUID jobId, write initial "queued" status, then call `runPipeline()` with `onStepStart` callback. |
| `STEPS.length` in stepInfo denominator | Import from orchestrator.ts — don't hardcode. New steps may be added. |
| Comma-joined steps in Redis | Step names from `STEPS[].name` don't contain commas (whisper, silence-cutter, etc.) — safe to join/split on comma. |
| `hgetall` returns all string values | Progress percentage is a string in Redis. Parse with `Number()` or `parseInt()`. `startedAt` is also a string. |

## Validation Architecture

### Dimension 8: API Contract Validation

| What to validate | How | Pass criteria |
|-----------------|-----|---------------|
| GET /status/{jobId} response schema matches Zod schema | Unit test: `StatusResponseSchema.safeParse()` on actual response | Schema validates without errors |
| Progress calculation is correct per step-index formula | Unit test: verify 0%, 20%, 40%, 60%, 80%, 100% for 5 steps | `progress === Math.round(((stepIndex+1)/5)*100)` |
| stepInfo format is "{n}/{total}" | Unit test: verify "1/5", "2/5", etc. | `stepInfo === "${stepIndex+1}/${totalSteps}"` |
| 404 for unknown jobId | Integration test: GET /status/{unknown-uuid} | Returns 404 |
| Completed steps list accumulates correctly | Integration test: mock onStepStart for 3 steps, verify steps array | `steps = ["whisper", "silence-cutter", "ffmpeg-finalizer"]` |

## Key Decisions (from CONTEXT.md)

- D-01: Response shape with `steps[]` array of completed step names
- D-02: Completed steps stored as comma-joined string in Redis (no per-step timestamps)
- D-03: Unknown/expired jobId → 404 (no 410 Gone)
- D-04: POST /process extended to write progress to Redis (same pattern as worker.ts)
- D-05: Step-index percentage calculation `((stepIndex+1)/totalSteps)*100`
- D-06: `stepInfo` format "3/5" alongside progress

---
*Phase: 11-Progress Tracking*
*Research completed: 2026-05-13*