---
phase: 10-async-batch-orchestrator
reviewed: 2026-05-13T02:07:23Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - services/api-server/src/queue.ts
  - services/api-server/src/progress.ts
  - services/api-server/src/schemas/batch.ts
  - services/api-server/src/constants.ts
  - services/api-server/src/worker.ts
  - services/api-server/src/routes/batch.ts
  - services/api-server/src/routes/health.ts
  - services/api-server/src/index.ts
  - services/api-server/src/orchestrator.ts
  - shared/constants.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-13T02:07:23Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed 10 source files from the async batch orchestrator phase, covering Redis/BullMQ queue infrastructure, progress tracking, batch upload/status routes, worker processing, health checks, and orchestrator integration. Found 2 critical issues and 5 warnings. The critical issues are a path traversal vulnerability in batch upload and a resource leak in the health check endpoint. Warnings cover NaN from unsanitized env vars, unchecked Redis operations that silently swallow errors, tmp file cleanup gaps on upload failure, and redundant batch size validation.

## Critical Issues

### CR-01: Path traversal via user-controlled `originalname` in batch upload

**File:** `services/api-server/src/routes/batch.ts:27`
**Issue:** The multer `filename` callback uses `path.extname(file.originalname)` to generate temporary filenames. The `originalname` is entirely client-controlled and can contain path traversal sequences like `../../../etc/passwd`. While `path.extname()` itself is mostly safe, the same pattern is duplicated in `process.ts:27` and the `originalname` is later stored in Redis and returned in API responses (batch.ts:127). If `originalname` contains embedded null bytes or path separators, downstream consumers could be vulnerable. More critically, there is no sanitization of `originalname` at all — it flows into BullMQ job data (batch.ts:115) and Redis progress hashes unchecked.

**Fix:**
```typescript
// Add a sanitization function
function sanitizeFilename(name: string): string {
  // Take only the basename to strip any directory components
  const basename = path.basename(name);
  // Remove any non-alphanumeric characters except dash, dot, underscore
  return basename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Use in multer filename callback:
filename: (_req, file, cb) => {
  const ext = path.extname(sanitizeFilename(file.originalname));
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  cb(null, uniqueName);
},

// And when storing in job data:
filename: sanitizeFilename(file.originalname),
```

### CR-02: Redis connection leak in health check endpoint

**File:** `services/api-server/src/routes/health.ts:24`
**Issue:** The health check creates a new Redis connection via `createQueueConnection()` on every request (line 24), then attempts to `quit()` it (line 31). However, if the `pingPromise` succeeds but the `redis.quit()` call fails or the timeout fires first, the connection is never closed — the `catch` block on line 32 only sets `redisStatus = "disconnected"` without closing the connection. Additionally, if the timeout wins the `Promise.race`, the ping promise never has a `.finally()` or `.catch()` handler to clean up, and the `redis.quit()` on line 31 is never reached because execution goes to the `catch` block. This leaks a Redis connection per health check request when Redis is slow or unreachable.

**Fix:**
```typescript
// Check Redis connectivity with 5s timeout
try {
  const redis = createQueueConnection();
  try {
    const pingPromise = redis.ping();
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );
    await Promise.race([pingPromise, timeoutPromise]);
    redisStatus = "connected";
  } finally {
    // Always close the connection, regardless of ping success or failure
    await redis.quit().catch(() => {});
  }
} catch {
  redisStatus = "disconnected";
}
```

## Warnings

### WR-01: `parseInt` on env vars can produce NaN

**File:** `services/api-server/src/constants.ts:30,37`
**Issue:** `parseInt(process.env.MAX_BATCH_SIZE || "10", 10)` and `parseInt(process.env.MAX_CONCURRENT_JOBS || "2", 10)` use `parseInt` which returns `NaN` for non-numeric env values like `MAX_BATCH_SIZE=abc`. NaN propagates silently through comparisons (`NaN > 0` is false, `files.length > NaN` is false), so a typo in the env var would effectively set MAX_BATCH_SIZE to a falsy comparison result rather than defaulting. Similarly, `PORT` in `index.ts:57` has the same issue.

**Fix:**
```typescript
export const MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || "10", 10) || 10;
export const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || "2", 10) || 2;
// PORT in index.ts:
const PORT = parseInt(process.env.PORT || "3000", 10) || 3000;
```
The `|| fallback` after parseInt ensures NaN is coerced to the default. Alternatively, validate explicitly with `Number.isFinite()` and throw/warn on invalid values.

### WR-02: `updateJobProgress` silently swallows Redis errors

**File:** `services/api-server/src/progress.ts:44-45`
**Issue:** The `updateJobProgress` function performs `redis.hset()` and `redis.expire()` sequentially but has no error handling. If Redis is temporarily disconnected, these calls will throw unhandled promise rejections that propagate up to the caller (the BullMQ worker's `processJob`). In `worker.ts:39`, `updateJobProgress` is called inside the `onStepStart` callback which is invoked from `runPipeline`. If the Redis write fails, the entire pipeline step will throw, potentially failing a job that was otherwise succeeding. Progress tracking should be best-effort and not crash the pipeline.

**Fix:**
```typescript
export async function updateJobProgress(
  jobId: string,
  data: { currentStep?: string; status: string; error?: string }
): Promise<void> {
  const key = `${JOB_KEY_PREFIX}${jobId}`;
  const fields: Record<string, string> = {
    status: data.status,
    updatedAt: new Date().toISOString(),
  };

  if (data.currentStep !== undefined) {
    fields.currentStep = data.currentStep;
  }
  if (data.error !== undefined) {
    fields.error = data.error;
  }

  try {
    await redis.hset(key, fields);
    await redis.expire(key, JOB_TTL_SECONDS);
  } catch (err) {
    console.error(`Failed to update job progress for ${jobId}:`, err);
    // Best-effort: don't crash the pipeline for progress tracking failures
  }
}
```

### WR-03: Redundant manual batch size check bypasses Multer

**File:** `services/api-server/src/routes/batch.ts:89`
**Issue:** The handler on line 89 checks `files.length > MAX_BATCH_SIZE` and returns 413. However, Multer's `batchUpload.array("videos", MAX_BATCH_SIZE)` on line 79 already enforces `limits.files: MAX_BATCH_SIZE` (line 58) and will trigger a `LIMIT_FILE_COUNT` error before the handler runs if the count exceeds the limit. This means the manual check on line 89 is unreachable under normal circumstances — Multer rejects the request before it reaches the handler code. The only way to reach line 89 is if Multer's `limits.files` and the handler's check are somehow different values (they're both `MAX_BATCH_SIZE`, so they aren't). This is dead code that gives a false sense of security.

**Fix:** Remove the redundant check on lines 89-92, or add a comment explaining it's a defense-in-depth check that shouldn't normally be reached. If defense-in-depth is desired, the check is fine but should be documented as such.

### WR-04: No cleanup of tmp files on batch upload partial failure

**File:** `services/api-server/src/routes/batch.ts:98-131`
**Issue:** When processing multiple files in a batch, if `Promise.all(jobPromises)` on line 132 encounters an error (e.g., the 3rd file's BullMQ `videoQueue.add()` call fails), the previous files have already been moved from `tmp/` to their job directories, and BullMQ jobs have been created for them. The error propagates to Express's error handler (500 response), but: (1) the already-created BullMQ jobs are left orphaned — they'll run but their results won't be accessible via the batch since no `batchId` is returned; (2) files that haven't been moved yet remain in the `tmp/` directory as orphans. This creates both resource leaks and potential phantom processing.

**Fix:** Wrap the `Promise.all(jobPromises)` in a try-catch. On failure, attempt to clean up already-created job directories and optionally remove the already-queued BullMQ jobs. At minimum, document that partial batch failures leave orphaned jobs:
```typescript
try {
  const jobs = await Promise.all(jobPromises);
  // ... success response
} catch (err) {
  // Clean up: remove BullMQ jobs and job directories for already-processed files
  // Or at minimum, log the orphaned jobIds for manual cleanup
  console.error("Partial batch failure, orphaned jobs may exist for batchId:", batchId, err);
  res.status(500).json({ error: "Batch processing failed" });
}
```

### WR-05: Progress module creates a separate Redis connection from the queue module

**File:** `services/api-server/src/progress.ts:7`
**Issue:** `progress.ts` calls `createQueueConnection()` to create its own Redis connection (line 7), while `queue.ts` also calls `createQueueConnection()` for the shared connection (line 25 of queue.ts). This means there are at least 3 Redis connections in total: 1 for the queue, 1 for progress tracking, and 1 per health check request. The SUMMARY comment says "Shared Redis connection reused from queue.ts to avoid connection sprawl," but the code actually creates a *new* connection rather than importing and reusing `sharedConnection` from queue.ts. This is a minor resource waste and deviates from the stated design decision.

**Fix:** Export `sharedConnection` from `queue.ts` and import it in `progress.ts`:
```typescript
// In queue.ts, make sharedConnection accessible:
export { sharedConnection };

// In progress.ts, import and reuse:
import { sharedConnection as redis } from "./queue.js";
// Remove: const redis = createQueueConnection();
```
This should be coordinated with the worker module which also creates its own connection via `createQueueConnection()`.

## Info

### IN-01: Duplicate Multer storage configuration between batch.ts and process.ts

**File:** `services/api-server/src/routes/batch.ts:16-30`, `services/api-server/src/routes/process.ts:16-29`
**Issue:** The `batchStorage` configuration in `batch.ts` and `storage` in `process.ts` are nearly identical — same `destination` callback (tmp dir creation), same `filename` pattern (`Date.now()` + `Math.random()`), same file size limits. This is duplicated code that should be extracted to a shared utility.

**Fix:** Extract the Multer storage configuration and file filter into a shared module like `src/multer-config.ts`, or into the existing `src/schemas/request.ts`.

### IN-02: `Math.random()` used for filename generation

**File:** `services/api-server/src/routes/batch.ts:27`, `services/api-server/src/routes/process.ts:27`
**Issue:** `Math.round(Math.random() * 1e9)` is used for generating unique filenames. While this is fine for temporary file naming (collision probability is low given the `Date.now()` prefix), `Math.random()` is not cryptographically secure and shouldn't be used where unpredictability matters. Since these are tmp file names that are moved to UUID-based job directories, this is acceptable but worth noting.

**Fix:** Low priority. Consider using `crypto.randomBytes(4).toString('hex')` for better uniqueness guarantees if filename collisions become an issue.

### IN-03: `console.log` / `console.error` used for logging

**File:** `services/api-server/src/worker.ts:83,87,91,94`, `services/api-server/src/index.ts:52,61,69`
**Issue:** All logging uses `console.log`/`console.error`. While acceptable for initial implementation, production deployments typically benefit from structured logging (JSON format, log levels, correlation IDs). This is especially relevant for the batch orchestrator where tracking job IDs across log lines is important for debugging.

**Fix:** Low priority. Consider migrating to a structured logger (e.g., `pino`) in a future phase.

---

_Reviewed: 2026-05-13T02:07:23Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_