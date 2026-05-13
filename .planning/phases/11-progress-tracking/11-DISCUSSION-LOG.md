# Phase 11: Progress Tracking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 11-progress-tracking
**Areas discussed:** Response shape, Progress percentage

---

## Response Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Step-aware | Current step name, overall progress, completed steps list (names), active step startedAt. Lightweight, aligned with existing Redis hash. | ✓ |
| Step timeline | Full history of every step with start/end times and duration. Richer, requires per-step timestamps in Redis. | |
| Minimal | Just currentStep, status, error — no percentage, no history. Matches existing progress.ts exactly. | |

**User's choice:** Step-aware
**Notes:** Most informative without adding complexity to Redis schema.

| Option | Description | Selected |
|--------|-------------|----------|
| Names only | Completed steps are string names in a list. Fast, no per-step timing in Redis. Progress inferred from step index/total. | ✓ |
| Names + timestamps | Each completed step includes startedAt/completedAt. More data but requires timestamp writes per step. | |

**User's choice:** Names only
**Notes:** Lightweight and sufficient for v1.

| Option | Description | Selected |
|--------|-------------|----------|
| 404 Not Found | Unknown/expired jobId returns 404. Consistent with Redis semantics. | ✓ |
| 410 Gone / 404 split | 410 for expired, 404 for never-existed. More precise but requires tracking existence separately. | |

**User's choice:** 404 Not Found
**Notes:** Simple, consistent. Expired TTL means data is gone.

| Option | Description | Selected |
|--------|-------------|----------|
| Both endpoints | GET /status/{jobId} works for batch and sync jobs. Add Redis progress writes to POST /process too. | ✓ |
| Batch only | Only batch-submitted jobs tracked. POST /process callers wait for synchronous response. | |

**User's choice:** Both endpoints
**Notes:** Unified status tracking for all jobs.

---

## Progress Percentage

| Option | Description | Selected |
|--------|-------------|----------|
| Step-index percentage | ((stepIndex + 1) / totalSteps) * 100. Whisper=20%, silence-cutter=40%, etc. Deterministic, matches what worker already computes. | ✓ |
| No percentage | Just currentStep name and completed steps list. No time estimation implied. | |
| Weighted percentage | Weight steps by typical duration. More intuitive percentage but requires a static weight table. | |

**User's choice:** Step-index percentage
**Notes:** Honest, deterministic, already computed in worker.ts.

| Option | Description | Selected |
|--------|-------------|----------|
| Include stepInfo | Add "3/5" fraction alongside progress percentage. Client can parse/ignore. | ✓ |
| Percentage only | Just the integer percentage. Client can calculate index from steps array. | |

**User's choice:** Yes, include stepInfo
**Notes:** Human-readable, explicit which step out of how many.

| Option | Description | Selected |
|--------|-------------|----------|
| Jump between steps | Progress stays flat during a step, jumps at boundaries. Honest, no false granularity. | ✓ |
| Smooth interpolation | Attempt to estimate progress within steps. Over-engineering for v1. | |

**User's choice:** Jump between steps
**Notes:** No interpolation within steps — percentage represents which step, not elapsed time.

---

## the agent's Discretion

- Exact Zod schema field names and types for the status response
- Whether startedAt refers to job creation time or first step start time
- Redis hash field naming for completed steps list (comma-joined string vs JSON array)
- Whether to add a totalSteps field to the response
- Whether GET /status route is a separate file or added to existing routes
- Error response format for 404
- Whether steps array includes the current step or only completed steps
- Whether POST /process should return a jobId for status polling

## Deferred Ideas

- WebSocket/SSE push notifications — v2 enhancement, current design is poll-based
- Per-step duration in status response — deferred for simplicity
- Job history/listing endpoint — not in v1 requirements
- Authentication and API key rate limiting — v2 concern
- Batch-level progress aggregation — derive from existing GET /batch/{batchId}