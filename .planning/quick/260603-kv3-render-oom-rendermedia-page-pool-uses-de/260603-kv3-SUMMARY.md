---
quick_id: 260603-kv3
status: complete
completed_date: 2026-06-03
duration_minutes: 10
files_modified:
  - services/remotion-renderer/src/render.ts
  - services/api-server/src/orchestrator.ts
commits:
  - type: fix
    scope: 260603-kv3
    message: "cap render concurrency via REMOTION_CONCURRENCY to prevent Chrome OOM"
---

# Quick Fix 260603-kv3: Bounded Render Concurrency via REMOTION_CONCURRENCY

**One-liner:** Wired `REMOTION_CONCURRENCY=2` end-to-end — env read in render.ts, passed as `concurrency` to `renderMedia`, and propagated from orchestrator — so Remotion's Chrome page-pool stays within RAM budget on a 16-core/7.5 GB-available host instead of defaulting to ~8 concurrent Chrome processes.

## Root Cause

`renderMedia` in `render.ts` had no `concurrency` option. Remotion defaults to `Math.floor(cpus / 2)` — on a 16-core host that's 8 Chrome processes. With `enableMultiProcessOnLinux: true`, each Chrome process is multi-process itself, decoding a video and a PNG overlay. At frame 0, the page-pool's `Promise.all` (index 2 = third page) exhausts the ~7.5 GB available RAM, causing the page tab to crash → `getPool → makePage → gotoPageOrThrow → "got no response"`. `selectComposition` (1 page) succeeds; only the multi-page pool dies.

## Changes

### `services/remotion-renderer/src/render.ts`

- Added `remotionConcurrency` env read near the other `REMOTION_*` reads (line ~97):
  ```ts
  const remotionConcurrency = Math.max(1, parseInt(process.env.REMOTION_CONCURRENCY || "2", 10) || 2);
  ```
  Guard pattern: `parseInt(...) || 2` catches NaN from non-numeric env values; `Math.max(1, ...)` floors at 1.
- Added one-line log before render: `console.log("  Concurrency:", remotionConcurrency);`
- Passed `concurrency: remotionConcurrency` to `renderMedia` alongside existing params. No other render params changed.

### `services/api-server/src/orchestrator.ts`

- Added `REMOTION_CONCURRENCY: "2"` to the `remotion-renderer` step's `envVars`, with a comment explaining the OOM rationale.

## Verification

TypeScript check method: ran `tsc --noEmit` from main checkout with worktree files swapped in, then restored. Result: zero new errors introduced in either service. Pre-existing errors (3 in renderer, 2 in api-server) are unchanged and pre-date this fix.

Docker image rebuild + actual render verification: handled by the orchestrator after merge (per plan constraints — not run here).

## Deviations

None. Plan executed exactly as written.
