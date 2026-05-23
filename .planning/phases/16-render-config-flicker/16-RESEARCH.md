# Phase 16: Render config + flicker fixes — Research

**Researched:** 2026-05-23
**Domain:** Remotion rendering pipeline, config propagation, subtitle fade-gap elimination
**Confidence:** HIGH — both bugs fully traced to source code; fixes are surgical one-file changes

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Issue A fix:** `PUT /api/config` in `services/remotion-studio/src/server.ts` must ALSO write the clean config (no `_meta`) to `ACTIVE_PIPELINE_CONFIG_PATH` (`/data/pipeline/pipeline-config.json`) — the global "active" path the `/process` route seeds from.
- **Sequencing:** Fix Issue A first (so a correct-layout render exists), then RE-MEASURE Issue B on a `bar`-layout render before deciding the exact flicker fix.
- **Renderer-sync convention (CLAUDE.md):** Any edits to `src/*.ts` and `compositions/*` shared files must be copied studio→renderer per the CLAUDE.md sync pattern.
- **UI work:** Any frontend-touching task MUST invoke the `impeccable` skill and the `frontend-design` plugin at plan/execute start (non-negotiable per CLAUDE.md).

### Claude's Discretion

- Issue B candidate fix approach: hold page visible until next page starts (extend `durationInFrames` to next page's `startMs`) vs. reduce/remove fade-out between contiguous pages vs. keep bar container mounted across pages. Planner chooses the most surgical option based on measured gaps.

### Deferred Ideas (OUT OF SCOPE)

- Cross-fade or animated page transition effects (any visual polish beyond eliminating the blank gap)
- Authentication on `PUT /api/config`
- Any other config-threading improvements beyond the single `PUT /api/config` write
</user_constraints>

---

## Summary

Phase 16 closes two pre-existing render-path bugs surfaced during the Phase 15 e2e run. Neither is a whisper regression — both are infrastructure defects in the config propagation path and the caption timing model.

**Issue A** is a missing write: the studio's `PUT /api/config` handler already strips `_meta` and writes a clean config, but writes only to `resolveConfigPath()` — which, in the Docker Compose environment, resolves to the per-job path `PIPELINE_CONFIG_PATH=/data/pipeline/${PIPELINE_JOB_ID}/remotion-renderer/pipeline-config.json`. When `PIPELINE_JOB_ID` is empty (standalone studio mode), this path is malformed. In neither case does it write to `/data/pipeline/pipeline-config.json` — the `ACTIVE_PIPELINE_CONFIG_PATH` constant that `process.ts` checks before seeding each job. The fix is a single `fs.writeFileSync` call added to the existing `PUT /api/config` handler.

**Issue B** requires re-measurement after Issue A is fixed. The measured 20–241ms inter-page gaps combined with `FADE_OUT_MS=300` guarantee a visible blank-to-black blink at every page boundary. Both `BarLayout.tsx` and `TikTokLayout.tsx` use an identical `Sequence` duration formula: `safeEndMs = min(lastTokenEnd + FADE_OUT, nextPageStart - PAGE_OVERLAP_GUARD)` — which bakes in a gap. The cleanest fix is to extend each page's `Sequence` duration to `nextPageStart` (instead of `lastTokenEnd + FADE_OUT_MS`), so the fade-out runs into the first frame of the next page rather than into empty air. This is a layout-level change that must be synced to the renderer.

**Primary recommendation:** Add one `fs.writeFileSync(ACTIVE_PIPELINE_CONFIG_PATH, ...)` to `PUT /api/config`, then run a real `bar`-layout render to measure remaining flicker before touching the layout duration formula.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Active config persistence | Studio server (Node.js, `server.ts`) | — | Studio is the editor; it owns the write |
| Config seeding per-job | API server (`process.ts`) | — | Reads `ACTIVE_PIPELINE_CONFIG_PATH`, copies to per-job path |
| Config consumption at render time | Renderer (`render.ts`) | — | Reads per-job `PIPELINE_CONFIG_PATH` set by orchestrator |
| Caption page timing | Renderer + Studio (shared layout TSX) | captions.ts | `BarLayout`/`TikTokLayout` compute `Sequence` `durationInFrames`; `captions.ts` (via `@remotion/captions`) sets `startMs`/`durationMs` |
| Page gap elimination | Layout components (BarLayout, TikTokLayout) | shared-styles.ts constants | Fade-out duration constant and `durationInFrames` formula live here |

---

## Issue A: Config Propagation — Root Cause Trace

### The broken chain (verified in codebase)

```
User saves config in studio editor
  → PUT /api/config hits server.ts:101
  → resolveConfigPath() called (server.ts:204)
  → if PIPELINE_CONFIG_PATH env is set → use that
      In docker-compose: PIPELINE_CONFIG_PATH=/data/pipeline/${PIPELINE_JOB_ID}/remotion-renderer/pipeline-config.json
      When PIPELINE_JOB_ID="" → "/data/pipeline//remotion-renderer/pipeline-config.json" (malformed)
      When PIPELINE_JOB_ID="some-job" → writes to that job's dir (job-scoped, not global active)
  → ACTIVE_PIPELINE_CONFIG_PATH = "/data/pipeline/pipeline-config.json" (constants.ts:21)
  → NEVER written by studio

/process request arrives at process.ts:123
  → existsSync(ACTIVE_PIPELINE_CONFIG_PATH) → always false
  → seeding block is a no-op
  → orchestrator sets PIPELINE_CONFIG_PATH=/data/pipeline/{jobId}/remotion-renderer/pipeline-config.json
  → render.ts:168: existsSync(pipelineConfigPath) → false (file never created)
  → pipelineConfig = null → falls back to env vars → tiktok layout, no titles
```

### The locked fix (one change in server.ts)

In `PUT /api/config`, after the existing `fs.writeFileSync(configPath, ...)`, add a second write to `ACTIVE_PIPELINE_CONFIG_PATH`. The constant must be imported or read from `process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json"` (matching `api-server/src/constants.ts:21`).

```typescript
// After the existing write to configPath:
const activePath = process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json";
const activeDir = path.dirname(activePath);
if (!fs.existsSync(activeDir)) {
  fs.mkdirSync(activeDir, { recursive: true });
}
fs.writeFileSync(activePath, JSON.stringify(configToWrite, null, 2));
console.log("[studio] Active config mirrored to:", activePath);
```

**`_meta` stripping:** The existing handler already does `const { _meta, ...configToWrite } = body`. The same `configToWrite` (already clean) goes to both paths — no additional stripping needed.

**XSS sanitization:** The existing `sanitizeTitles()` call runs on `configToWrite.titles` before the first write — the sanitized data is reused for both writes automatically.

**Volume availability:** `remotion-studio` uses `<<: *pipeline-common` which mounts `./pipeline:/data/pipeline` (docker-compose.yml:164/2-3). The studio container CAN write to `/data/pipeline/pipeline-config.json`. Confirmed. [VERIFIED: codebase grep]

**ACTIVE_PIPELINE_CONFIG_PATH is not currently passed as env to studio:** The `remotion-studio` service definition does NOT include `ACTIVE_PIPELINE_CONFIG_PATH` in its environment block (docker-compose.yml:174-178). The server.ts fix should use the same hardcoded default as `api-server/src/constants.ts` — `"/data/pipeline/pipeline-config.json"` — or add the env var to docker-compose. Simplest: use the env var with the same default.

**docker-compose env addition needed:** Add `ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json` to the `remotion-studio` environment block for clarity (optional if hardcoded default matches, but explicit is better). [ASSUMED — needs planner decision]

---

## Issue B: Subtitle Flicker — Root Cause Trace

### The gap formula (verified in BarLayout.tsx and TikTokLayout.tsx — identical in both)

```typescript
// Both BarLayout.tsx and TikTokLayout.tsx (lines ~246-255):
const lastTokenEndMs = page.tokens[page.tokens.length - 1].toMs;
const nextPageStartMs = i + 1 < captionPages.length ? captionPages[i + 1].startMs : Infinity;
const displayEndMs = lastTokenEndMs + FADE_OUT_MS;                          // lastToken + 300ms
const safeEndMs = Math.min(displayEndMs, nextPageStartMs - PAGE_OVERLAP_GUARD_MS); // cap at next-100
const durationInFrames = Math.ceil((clampedEndMs - page.startMs) * (fps / 1000));
```

**What this creates:** For pages with `(nextPageStartMs - lastTokenEndMs) < FADE_OUT_MS + PAGE_OVERLAP_GUARD_MS` = 400ms, the `safeEndMs` clamp fires, cutting the fade-out short. The page fully fades out BEFORE the next page starts (because `safeEndMs < nextPageStartMs` by at least `PAGE_OVERLAP_GUARD_MS=100ms`). Result: a 100ms+ blank gap at every such boundary.

**The constants:** `FADE_IN_MS=100`, `FADE_OUT_MS=300`, `PAGE_OVERLAP_GUARD_MS=100` (shared-styles.ts:6-8). `FADE_OUT_MS=300` is the dominant factor — the page needs 300ms to fade out, but many inter-page gaps are 20–180ms.

**TikTokPage.durationMs** from `@remotion/captions`: set by `createTikTokStyleCaptions` to `lastToken.toMs - startMs`. This is NOT the display duration — it's the token span. The layout component sets its own `durationInFrames`.

### Candidate fix analysis

**Option 1 — Extend Sequence to next page start (recommended):**
Change `safeEndMs` to `nextPageStartMs` for all non-last pages. The page's `Sequence` runs until the next page begins. The fade-out still animates (starts at `lastTokenEndMs`, spans `FADE_OUT_MS`), but it now OVERLAPS with the next page's fade-in rather than occurring in empty space. No blank gap possible.

```typescript
// Non-last page: run Sequence until nextPage starts
const displayEndMs = i + 1 < captionPages.length
  ? captionPages[i + 1].startMs      // hold until next page — no gap
  : lastTokenEndMs + FADE_OUT_MS;    // last page: fade naturally
```

This changes behavior: for large inter-page gaps (silence cuts), the page lingers visibly after the last word. This is debatable. The CONTEXT.md sequencing instruction (re-measure after Issue A) is specifically to determine whether this matters with the `bar` layout on real content.

**Option 2 — Remove/reduce FADE_OUT between contiguous pages:**
Detect "contiguous" pages (gap < threshold) and set `FADE_OUT_MS=0` for those transitions. More logic, more edge cases.

**Option 3 — Set PAGE_OVERLAP_GUARD_MS=0:**
Removes the 100ms safety buffer. The gap reduces from `>=100ms` to 0ms but the `displayEndMs = lastTokenEnd + FADE_OUT` still causes a gap when `nextPageStart - lastTokenEnd < FADE_OUT_MS`. Doesn't fully fix short-gap cases.

**Planner guidance:** Option 1 is the most surgical. The remaining question (whether lingering for silence-cut gaps looks bad) is answered by re-measuring after Issue A fix — the CONTEXT.md mandates this sequence.

### Files that change for Issue B

Both `BarLayout.tsx` and `TikTokLayout.tsx` use the identical duration formula. Both need the change. `shared-styles.ts` constants (`FADE_OUT_MS`, `PAGE_OVERLAP_GUARD_MS`) may also be adjusted if needed (e.g., reducing `PAGE_OVERLAP_GUARD_MS`), but Option 1 makes those constants less critical.

**Renderer-sync required:** `BarLayout.tsx` and `TikTokLayout.tsx` are `compositions/*` files — they MUST be copied studio→renderer per CLAUDE.md. If `shared-styles.ts` changes, it also syncs.

---

## Standard Stack

No new packages are needed for this phase. All changes are within existing TypeScript source files.

| File | Service | Change Type |
|------|---------|-------------|
| `services/remotion-studio/src/server.ts` | remotion-studio | Add second `fs.writeFileSync` to `PUT /api/config` |
| `services/remotion-studio/src/compositions/BarLayout.tsx` | remotion-studio | Fix duration formula |
| `services/remotion-studio/src/compositions/TikTokLayout.tsx` | remotion-studio | Fix duration formula (same change) |
| `services/remotion-renderer/src/compositions/BarLayout.tsx` | remotion-renderer | Sync copy of studio's BarLayout.tsx |
| `services/remotion-renderer/src/compositions/TikTokLayout.tsx` | remotion-renderer | Sync copy of studio's TikTokLayout.tsx |
| `docker-compose.yml` | infra | Add `ACTIVE_PIPELINE_CONFIG_PATH` env to remotion-studio service (optional but recommended) |

**No npm install needed.** No new dependencies.

---

## Package Legitimacy Audit

> No external packages are installed in this phase. Section not applicable.

---

## Architecture Patterns

### Config write path (post-fix)

```
PUT /api/config (server.ts)
  │
  ├─ validate PipelineConfig (validatePipelineConfig)
  ├─ strip _meta → configToWrite
  ├─ sanitize titles (sanitizeTitles, CR-02)
  │
  ├─ Write to resolveConfigPath()          ← existing (per-job or local-dev)
  └─ Write to ACTIVE_PIPELINE_CONFIG_PATH  ← NEW (/data/pipeline/pipeline-config.json)
       │
       └─ POST /process (process.ts)
            └─ existsSync(ACTIVE_PIPELINE_CONFIG_PATH) → true → copyFile to per-job dir
                  └─ orchestrator sets PIPELINE_CONFIG_PATH → render.ts reads it
                        └─ pipeline_config: {loaded: true, source: ..., subtitle_layout: "bar"}
```

### Caption page Sequence duration (post-fix, Option 1)

```
Page i:
  fromFrame = page.startMs * (fps/1000)
  
  // Pre-fix: page ends at min(lastToken + FADE_OUT, nextPage - GUARD) → gap
  // Post-fix: page ends at nextPage.startMs → no gap
  endMs = (i < last) ? captionPages[i+1].startMs : lastTokenEnd + FADE_OUT_MS
  durationInFrames = ceil((endMs - page.startMs) * fps / 1000)
  
  <Sequence from={fromFrame} durationInFrames={durationInFrames}>
    <BarPage> or <CaptionPage>
      // Internal fade-out still animates from lastTokenEndFrame
      // But now it overlaps with next page's fade-in rather than empty air
  </Sequence>
```

### Renderer-sync convention (from CLAUDE.md)

After modifying compositions:
```bash
cp services/remotion-studio/src/compositions/BarLayout.tsx \
   services/remotion-renderer/src/compositions/
cp services/remotion-studio/src/compositions/TikTokLayout.tsx \
   services/remotion-renderer/src/compositions/
# If shared-styles.ts changes:
# cp services/remotion-studio/src/compositions/shared-styles.ts \
#    services/remotion-renderer/src/compositions/
```

Do NOT sync `server.ts`, `Root.tsx`, or `SubtitledVideo.tsx` — these are service-specific.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config schema validation | Custom validator | `validatePipelineConfig()` in `pipeline-config.ts` | Already exists, used by both studio and renderer |
| `_meta` stripping | Regex/manual | Existing destructuring `const { _meta, ...configToWrite } = body` in server.ts:123 | Already in the PUT handler |
| Title text sanitization | Custom escaping | Existing `sanitizeTitles()` in server.ts:24 | Already in the PUT handler, CR-02 compliant |
| Remotion frame math | Custom lerp | `Math.round/ceil(ms * fps / 1000)` pattern already in BarLayout/TikTokLayout | Consistent with existing code |

---

## Common Pitfalls

### Pitfall 1: Double-write calling resolveConfigPath() vs hardcoded active path
**What goes wrong:** If the planner changes `resolveConfigPath()` to return the active path, the per-job-path write breaks — the studio's local-dev mode (no env vars) would write to the global `/data/pipeline/pipeline-config.json` instead of `cwd/pipeline-config.json`.
**Why it happens:** Conflating the "current session config" path with the "active production config" path.
**How to avoid:** Keep `resolveConfigPath()` unchanged. Add an independent `activePath` constant that mirrors `api-server/src/constants.ts:21`. Two separate writes.
**Warning signs:** The GET /api/config healthcheck in docker-compose reads from `resolveConfigPath()` — if that changes, the healthcheck breaks.

### Pitfall 2: Missing directory creation for ACTIVE_PIPELINE_CONFIG_PATH
**What goes wrong:** On a fresh system where `pipeline/` is empty, `fs.writeFileSync("/data/pipeline/pipeline-config.json", ...)` throws `ENOENT` (directory does not exist).
**Why it happens:** `./pipeline` is mounted but may be empty on first run.
**How to avoid:** `fs.mkdirSync(path.dirname(activePath), { recursive: true })` before the write. Pattern already used in the existing PUT handler at server.ts:118-120.

### Pitfall 3: Flicker re-measurement skipped — fixing blindly
**What goes wrong:** Issue B fix applied to BarLayout/TikTokLayout before a real bar-layout render is run, so the fix addresses unmeasured symptoms.
**Why it happens:** Temptation to fix both issues in one wave without re-measuring.
**How to avoid:** CONTEXT.md is explicit: fix Issue A → run a real bar-layout render → measure remaining flicker → then apply Issue B fix. The plan should enforce this sequencing with a human-verify checkpoint between the two issues.

### Pitfall 4: PAGE_OVERLAP_GUARD_MS forces a gap even after Option 1 fix
**What goes wrong:** Option 1 removes the gap by extending to `nextPageStartMs`, but if the implementation accidentally uses `nextPageStartMs - PAGE_OVERLAP_GUARD_MS` in the endMs calculation, a 100ms gap persists.
**Why it happens:** Copy-paste from existing formula that subtracts `PAGE_OVERLAP_GUARD_MS`.
**How to avoid:** For the non-last-page case, the new endMs is exactly `captionPages[i+1].startMs` with NO guard subtracted. The guard was there to prevent overlapping Sequences — it's no longer needed when extending to exactly the next page's start frame.

### Pitfall 5: Renderer-sync omitted after layout changes
**What goes wrong:** `BarLayout.tsx` is changed in `services/remotion-studio/src/compositions/` but the copy in `services/remotion-renderer/src/compositions/` is not updated → production renders still flicker.
**Why it happens:** Forgetting the CLAUDE.md sync step.
**How to avoid:** Each plan task that edits a shared composition file must include the `cp` sync step as the next action. Both files are currently identical (verified by diff); the fix must keep them in sync.

### Pitfall 6: studio PIPELINE_CONFIG_PATH env masks the active path write
**What goes wrong:** `resolveConfigPath()` uses `PIPELINE_CONFIG_PATH` if set. In the docker-compose environment `PIPELINE_CONFIG_PATH` is always set (to a per-job path), so any attempt to "fix" `resolveConfigPath()` to fall through to the active path would still be masked.
**Why it happens:** Misreading `resolveConfigPath()` as the problem.
**How to avoid:** `resolveConfigPath()` is NOT the problem and should NOT change. The active path write is independent of `resolveConfigPath()`.

---

## Code Examples

### Existing PUT /api/config write block (server.ts:115-129) — add active write here

```typescript
// [VERIFIED: codebase read, server.ts:115-135]
// Ensure directory exists
const dir = path.dirname(configPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Write config, stripping _meta if present, sanitizing title text (CR-02)
const { _meta, ...configToWrite } = body as PipelineConfig & { _meta?: unknown };
if (configToWrite.titles && Array.isArray(configToWrite.titles)) {
  configToWrite.titles = sanitizeTitles(configToWrite.titles);
}
fs.writeFileSync(configPath, JSON.stringify(configToWrite, null, 2));
console.log("[studio] Config written to:", configPath);

// ← INSERT ACTIVE PATH WRITE HERE (after existing write):
// const activePath = process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json";
// const activeDir = path.dirname(activePath);
// if (!fs.existsSync(activeDir)) { fs.mkdirSync(activeDir, { recursive: true }); }
// fs.writeFileSync(activePath, JSON.stringify(configToWrite, null, 2));
// console.log("[studio] Active config mirrored to:", activePath);
```

### ACTIVE_PIPELINE_CONFIG_PATH in api-server/src/constants.ts (reference — do not change)

```typescript
// [VERIFIED: codebase read, api-server/src/constants.ts:20-21]
export const ACTIVE_PIPELINE_CONFIG_PATH =
  process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json";
```

### Current BarLayout/TikTokLayout duration formula (identical in both — Issue B)

```typescript
// [VERIFIED: codebase read, BarLayout.tsx:247-255, TikTokLayout.tsx:223-231]
const nextPageStartMs = i + 1 < captionPages.length ? captionPages[i + 1].startMs : Infinity;
const displayEndMs = lastTokenEndMs + FADE_OUT_MS;
const safeEndMs = Math.min(displayEndMs, nextPageStartMs - PAGE_OVERLAP_GUARD_MS);
// safeEndMs < nextPageStartMs by at least PAGE_OVERLAP_GUARD_MS (100ms) → gap guaranteed
const durationInFrames = Math.max(1, Math.ceil((clampedEndMs - page.startMs) * (fps / 1000)));
```

### Option 1 fix (extend to next page start):

```typescript
// Replace the safeEndMs / displayEndMs block:
const isLastPage = i === captionPages.length - 1;
const nextPageStartMs = !isLastPage ? captionPages[i + 1].startMs : Infinity;

// Non-last pages: run Sequence until next page starts (eliminates inter-page gap)
// Last page: fade out naturally after last token
const displayEndMs = !isLastPage ? nextPageStartMs : lastTokenEndMs + FADE_OUT_MS;

const clampedEndMs = (isLastPage && totalDurationMs)
  ? Math.min(displayEndMs, totalDurationMs)
  : displayEndMs;
const durationInFrames = Math.max(1, Math.ceil((clampedEndMs - page.startMs) * (fps / 1000)));
```

### Verification command for pipeline_config loaded status

```bash
# After a /process render, check remotion-info.json in the job dir:
cat pipeline/{jobId}/remotion-renderer/remotion-info.json | python3 -m json.tool | grep -A5 "pipeline_config"
# Expected post-fix: {"loaded": true, "source": "...", "subtitle_layout": "bar", "titles_count": N}
# Broken state: {"loaded": false, "source": "env_vars", "subtitle_layout": "tiktok", "titles_count": 0}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Studio writes only to `resolveConfigPath()` | Studio also writes to `ACTIVE_PIPELINE_CONFIG_PATH` | Phase 16 (this phase) | `/process` jobs now pick up studio config |
| Page Sequence ends at `lastToken + FADE_OUT` capped by `nextPage - GUARD` (gap) | Page Sequence extends to `nextPage.startMs` (no gap) | Phase 16 (this phase) | Subtitle flicker eliminated |

---

## Runtime State Inventory

> Greenfield bug-fixes — no rename/refactor. Section not applicable.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Compose | E2E validation render | ✓ | v2 | — |
| `pipeline/` directory (host) | Studio active-config write | ✓ | — | Created by `mkdir -p` in server.ts |
| vitest | Renderer unit tests | ✓ | ^4.1.5 (renderer package.json) | — |
| short test clip MP4 | Issue B re-measurement | ✓ | existing in pipeline/ dirs | any clip in pipeline/ |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.x |
| Config file | `services/remotion-renderer/vitest.config.ts` (inferred from package.json) |
| Quick run command | `cd services/remotion-renderer && npm test` |
| Full suite command | `cd services/remotion-renderer && npm test` |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| PUT /api/config writes to ACTIVE_PIPELINE_CONFIG_PATH | integration (manual verify via curl) | `curl -X PUT http://localhost:3123/api/config -H "Content-Type: application/json" -d '{"subtitle":{"layout":"bar"},"titles":[]}' && cat pipeline/pipeline-config.json` | manual — no unit test file for server.ts |
| /process job picks up studio config (pipeline_config.loaded=true) | e2e | `curl -X POST http://localhost:3000/process -F video=@test.mp4` → check remotion-info.json | manual |
| Caption pages have no inter-page gap (Option 1 fix) | unit | `cd services/remotion-renderer && npm test` | ❌ new test needed in captions.test.ts or layout test |
| BarLayout/TikTokLayout Sequence extends to nextPageStartMs | unit | `cd services/remotion-renderer && npm test` (layout duration test) | ❌ new test needed |

### Wave 0 Gaps

- [ ] `services/remotion-renderer/src/captions.test.ts` — add test for "page Sequence duration extends to nextPageStart when gap < FADE_OUT_MS" (covers Issue B regression prevention)
- [ ] Manual verify script for Issue A: confirm `pipeline/pipeline-config.json` is created after `PUT /api/config` and that a subsequent `/process` render reports `loaded: true`

*(No new test framework install needed — vitest already present in remotion-renderer)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | PUT /api/config already has WR-06 warning; no change in auth posture |
| V5 Input Validation | yes | `validatePipelineConfig()` + `sanitizeTitles()` already applied to the new write path — same `configToWrite` object |
| V6 Cryptography | no | — |

**No new attack surface introduced.** The active-path write uses the same sanitized, validated `configToWrite` object already written to `configPath`. XSS protection (CR-02) and schema validation carry over automatically.

---

## Open Questions (RESOLVED)

1. **Should `ACTIVE_PIPELINE_CONFIG_PATH` be added to docker-compose `remotion-studio` environment block?**
   - What we know: The default hardcoded in server.ts (if we use `process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json"`) matches `api-server/src/constants.ts:21`. No env var strictly needed.
   - What's unclear: Whether having it explicit in docker-compose aids observability and allows overriding without rebuild.
   - Recommendation: Add it to docker-compose for clarity. Low-risk one-line change.
   - **RESOLVED: YES** — Plan 16-01 Task 2 adds  to the remotion-studio environment block in docker-compose.yml. Explicit declaration improves observability and allows env override without rebuild.

2. **Does Issue B (flicker) fully disappear on `bar` layout after Issue A, even without the duration fix?**
   - What we know: The `bar` layout is more continuous than `tiktok` (single bar vs. per-word pop). The e2e flicker was measured on tiktok layout (wrong-layout fallback from Issue A). Short inter-page gaps (20ms) with 300ms FADE_OUT still cause blank gaps regardless of layout.
   - What's unclear: Whether the `bar` layout's opaque background bar visually masks the gap more than tiktok does.
   - Recommendation: Mandatory re-measure after Issue A fix before touching layout files. The plan must encode this as a checkpoint.
   - **RESOLVED: TO BE MEASURED** — Plan 16-02 checkpoint measures flicker on a real bar-layout render. The human resume signal (approved: loaded=true, flicker=none/present/reduced) documents the outcome before Plan 16-03 executes the duration fix.

3. **Should `PAGE_OVERLAP_GUARD_MS` be set to 0 as part of Option 1?**
   - What we know: With Option 1, `PAGE_OVERLAP_GUARD_MS` is only relevant to the last-page clamping logic and the `safeEndMs` formula which is being replaced. It becomes a dead constant.
   - Recommendation: Remove it from the `durationInFrames` calculation when applying Option 1; do not change its declaration in `shared-styles.ts` (other code may reference it, and removing the constant itself is cosmetic risk).
   - **RESOLVED: NO** — `PAGE_OVERLAP_GUARD_MS` constant is preserved in `shared-styles.ts` unchanged. Plan 16-03 Task 1 stops using it in the duration formula (Option 1 makes it redundant for non-last pages) but does NOT remove or zero the declaration.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ACTIVE_PIPELINE_CONFIG_PATH` env var not currently passed to `remotion-studio` in docker-compose | Issue A analysis | If it IS set, the fix still works; no risk |
| A2 | `./pipeline:/data/pipeline` volume mount covers the studio container (via `x-pipeline-common`) | Issue A analysis | LOW — confirmed by docker-compose YAML inspection |

**Claims A2 is effectively verified.** `remotion-studio` uses `<<: *pipeline-common` which includes `volumes: - ./pipeline:/data/pipeline`. [VERIFIED: codebase grep]

---

## Sources

### Primary (HIGH confidence — verified in codebase this session)

- `services/remotion-studio/src/server.ts` — `PUT /api/config` handler, `resolveConfigPath()` (lines 101-143, 204-220)
- `services/api-server/src/constants.ts` — `ACTIVE_PIPELINE_CONFIG_PATH` constant (line 20-21)
- `services/api-server/src/routes/process.ts` — seeding logic (lines 122-136)
- `services/remotion-renderer/src/render.ts` — config load logic (lines 165-187), diagnostic output (lines 367-379)
- `services/remotion-studio/src/compositions/BarLayout.tsx` — Sequence duration formula (lines 246-255)
- `services/remotion-studio/src/compositions/TikTokLayout.tsx` — Sequence duration formula (lines 222-231)
- `services/remotion-studio/src/compositions/shared-styles.ts` — `FADE_IN_MS=100`, `FADE_OUT_MS=300`, `PAGE_OVERLAP_GUARD_MS=100`
- `docker-compose.yml` — `remotion-studio` service env + volume (lines 163-184)
- `@remotion/captions/dist/create-tiktok-style-captions.d.ts` — `TikTokPage` type: `{startMs, durationMs, tokens}` [VERIFIED: node_modules]
- `.planning/phases/16-render-config-flicker/16-CONTEXT.md` — root cause analysis and locked decisions

### Secondary (MEDIUM confidence)

- CLAUDE.md renderer-sync convention — copy commands and scope rules

---

## Metadata

**Confidence breakdown:**
- Issue A root cause: HIGH — code trace is complete; the missing write is unambiguous
- Issue A fix: HIGH — one `fs.writeFileSync` call; pattern already in the handler
- Issue B root cause: HIGH — formula verified in both layout files; gap mechanism is deterministic
- Issue B fix (Option 1): MEDIUM — the fix is correct but re-measurement after Issue A is required before applying

**Research date:** 2026-05-23
**Valid until:** Stable (no external dependencies change; pure internal code fix)
