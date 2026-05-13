# Phase 10: Async Batch + Orchestrator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 10-async-batch-orchestrator
**Areas discussed:** Batch API design, Job orchestration, Concurrency & limits

---

## Batch API design

| Option | Description | Selected |
|--------|-------------|----------|
| Multipart multi-file | Client sends multiple files in a single multipart request. Each file becomes a separate job. Simple for small batches, mirrors existing POST /process upload pattern. | ✓ |
| JSON body with file paths | Client sends JSON referencing local file paths on shared volume. No upload overhead but requires pre-placed files. | |
| Two-step: upload then batch | Client uploads via POST /process, then calls POST /batch/start with job IDs. More HTTP calls, decouples upload from queueing. | |

**User's choice:** Multipart multi-file
**Notes:** Straightforward extension of existing Multer upload pattern. Uses `upload.array()` instead of `upload.single()`.

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate job IDs | POST /batch returns immediately with { batchId, jobs: [{jobId, filename, status: 'queued'}] }. Client polls for progress. | ✓ |
| Synchronous wait | POST /batch blocks until all jobs complete. Defeats async purpose. | |

**User's choice:** Immediate job IDs
**Notes:** Standard async pattern, works well with BullMQ.

| Option | Description | Selected |
|--------|-------------|----------|
| batchId grouping | Each batch gets a batchId grouping related jobIds. GET /batch/{batchId} returns all statuses. | ✓ |
| No grouping | Each video is just an independent job. No batch concept. | |

**User's choice:** batchId grouping
**Notes:** Useful for tracking "this upload of 5 videos" as a unit.

---

## Job orchestration

| Option | Description | Selected |
|--------|-------------|----------|
| 1 job = 1 pipeline run | BullMQ job calls runPipeline() for the full step sequence. Simple model, easy per-job tracking. | ✓ |
| 1 job = 1 pipeline step | Per-step BullMQ jobs with dependency management. More granular but complex. | |

**User's choice:** 1 job = 1 pipeline run
**Notes:** Maps naturally to existing `runPipeline()`. Concurrency controlled at queue level.

| Option | Description | Selected |
|--------|-------------|----------|
| Redis hash per job | Job processor updates Redis key (job:{jobId}) with current step/status after each step. Decoupled from BullMQ internals, ready for Phase 11. | ✓ |
| BullMQ job.progress() | Use built-in progress mechanism. Limited to numeric 0-100 by default, mixes with BullMQ internals. | |

**User's choice:** Redis hash per job
**Notes:** Clean separation, easy to extend with step-level details in Phase 11.

| Option | Description | Selected |
|--------|-------------|----------|
| Full pipeline retry | On failure, retry the entire pipeline from step 1. Simple and predictable. | ✓ |
| Retry from failed step | Only retry the failed step, continue from there. Requires step-level state management. | |

**User's choice:** Full pipeline retry
**Notes:** Containers are ephemeral and create fresh state each run. Retry from beginning is clean.

| Option | Description | Selected |
|--------|-------------|----------|
| Jobs independent | Each job is independent. Failed jobs don't affect others. | ✓ |
| Cancel batch on failure | If any job fails, cancel all remaining jobs. "All or nothing" semantics. | |

**User's choice:** Jobs independent
**Notes:** One bad video shouldn't stop others from processing.

---

## Concurrency & limits

| Option | Description | Selected |
|--------|-------------|----------|
| 2 concurrent (default, configurable) | MAX_CONCURRENT_JOBS env var, default 2. Balances throughput with GPU/CPU resources. | ✓ |
| 3 concurrent (aggressive) | Higher throughput, risks GPU contention and memory pressure. | |
| 1 concurrent (sequential) | Safest, simplest, slowest. | |

**User's choice:** 2 concurrent, configurable via MAX_CONCURRENT_JOBS

| Option | Description | Selected |
|--------|-------------|----------|
| Single queue, GPU auto-serializes | One BullMQ queue with concurrency=2. Docker's nvidia runtime serializes GPU access naturally. | ✓ |
| Separate GPU/CPU queues | Whisper on 'gpu' queue (concurrency=1), others on 'cpu' queue. More throughput potential but much more complex. | |

**User's choice:** Single queue, GPU auto-serializes
**Notes:** Simpler orchestration. The single GPU hardware constraint naturally serializes Whisper step access.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-request file limit | Max 10 files per POST /batch. Prevents queue flooding. Configurable via MAX_BATCH_SIZE. | ✓ |
| No limit, queue throttles naturally | Queue handles concurrency, no per-request cap. Simpler API but risks saturation. | |

**User's choice:** Per-request file limit (10 files max, configurable)
**Notes:** Multer upload.array() enforces this at the API level.

---

## the agent's Discretion

- BullMQ retry configuration (attempts, backoff strategy, delay)
- Redis persistence config (RDB vs AOF)
- BullMQ worker in same vs separate Node.js process
- Redis hash schema details (field names, TTL for completed jobs)
- Job cleanup/eviction policy
- Logging format for job lifecycle events
- Redis/BullMQ health check endpoint

## Deferred Ideas

- **Progress tracking endpoint (GET /status/{jobId})** — Phase 11 (PROG-01, PROG-02)
- **Authentication and API key rate limiting** — v2
- **Job result persistence and cleanup policy** — Future phase
- **WebSocket progress notifications** — Phase 11
- **Separate GPU/CPU queue architecture** — v2 optimization
- **Job cancellation API** — BullMQ supports it but not needed in v1
- **Batch-level progress aggregation** — Phase 11 can add summary view