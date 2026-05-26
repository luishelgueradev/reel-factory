# Phase 17: Config Persistence - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `config/pipeline-config.default.json` (new) | config | file-I/O | `services/remotion-studio/pipeline-config.json` | exact (content is identical) |
| `services/remotion-studio/src/server.ts` (modify PUT /api/config + resolveConfigPath) | service | request-response | self — existing file already has the mirror-write at lines 180-186 | self-analog |
| `services/api-server/src/constants.ts` (modify ACTIVE_PIPELINE_CONFIG_PATH default) | config | — | self — env-var constant pattern already established at lines 20-21 | self-analog |
| `docker-compose.yml` (modify api-server env + volumes) | config | — | existing api-server + studio stanzas at lines 222-259 and 164-193 | self-analog |
| `services/api-server/src/index.ts` (add startup seed-copy hook) | service | file-I/O | `services/api-server/src/orchestrator.ts` lines 235-248 (existsSync + copyFile try/catch) | exact |
| `services/api-server/src/routes/process.ts` (keep per-job seed, no change) | route | CRUD | self — seed pattern already at lines 122-136 | no change needed |

## Pattern Assignments

### `config/pipeline-config.default.json` (new — git-tracked default template)

**Analog:** `services/remotion-studio/pipeline-config.json`

Content is byte-equivalent to the existing git-tracked studio file. Copy as-is into the new location — this becomes the seed source on fresh install. No structural changes.

**Full file content to copy from** (`services/remotion-studio/pipeline-config.json`, lines 1-85):
```json
{
  "subtitle": {
    "layout": "bar",
    "fontSize": 49,
    "activeColor": "#FFFFFF",
    "inactiveColor": "#545454",
    "outlineColor": "#000000",
    "outlineWidth": 3,
    "position": "bottom-center",
    "lineHeight": 1.1,
    "bottomOffset": 440,
    "pastWordOpacity": 1,
    "highlightColor": "#00aaff",
    "highlightDurationMs": 400,
    "highlightTransition": "fade",
    "subtitleWidth": 710,
    "fontFamily": "Inter",
    "letterSpacing": 0,
    "backgroundHighlight": {
      "enabled": false,
      "color": "rgba(0,0,0,0.5)",
      "padding": 8,
      "borderRadius": 4
    }
  },
  "titles": [ ... ]
}
```
(Full titles array from `services/remotion-studio/pipeline-config.json` lines 26-84.)

---

### `services/remotion-studio/src/server.ts` — Fix `PUT /api/config` write target (lines 149-200) and `resolveConfigPath()` (lines 262-278)

**Analog:** self — existing mirror-write block at lines 180-186

**Current behavior to understand (lines 149-201):**
- `PUT /api/config` calls `resolveConfigPath()` to get the *primary* write destination, then also mirror-writes to `ACTIVE_PIPELINE_CONFIG_PATH` at lines 181-186.
- `resolveConfigPath()` at lines 262-278 checks `PIPELINE_CONFIG_PATH` first (which in Docker is set to the *per-job* path `/data/pipeline/${PIPELINE_JOB_ID}/remotion-renderer/pipeline-config.json`), causing saves to land in ephemeral job dirs during live processing.

**Fix pattern — replace the dual-write in PUT /api/config with a single write to `ACTIVE_PIPELINE_CONFIG_PATH`:**
```typescript
// Source pattern from server.ts lines 180-186 (the mirror-write that already works)
// D-04: write ONLY to the active path; drop the resolveConfigPath() write destination
const activePath = process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json";
const activeDir = path.dirname(activePath);
if (!fs.existsSync(activeDir)) {
  fs.mkdirSync(activeDir, { recursive: true });
}
fs.writeFileSync(activePath, JSON.stringify(configToWrite, null, 2));
console.log("[studio] Config written to:", activePath);
```

**resolveConfigPath() — for GET /api/config only (read, not write):**
The `resolveConfigPath()` function at lines 262-278 is fine for reads (it previews the per-job config when processing). It must not be called from the PUT write path. No change to the function body; change is to stop calling it from PUT.

**Error handling pattern to copy** (server.ts lines 193-200):
```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : "Unknown error writing config";
  console.error("[studio] Error writing config:", message);
  return res.status(500).json({
    error: "Failed to write config",
    message,
  });
}
```

**Env-var extraction pattern** (server.ts lines 33-35, module top level):
```typescript
const PORT = parseInt(process.env.PORT || "3123", 10);
const PIPELINE_CONFIG_PATH = process.env.PIPELINE_CONFIG_PATH || "";
const INPUT_PATH = process.env.INPUT_PATH || "";
```
ACTIVE_PIPELINE_CONFIG_PATH should be extracted the same way — read once at module level, not inline inside the handler.

---

### `services/api-server/src/constants.ts` — Verify/update `ACTIVE_PIPELINE_CONFIG_PATH` default (lines 20-21)

**Analog:** self — the constant already reads from env with the right fallback.

**Existing correct pattern** (`constants.ts` lines 19-21):
```typescript
export const ACTIVE_PIPELINE_CONFIG_PATH =
  process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json";
```

The hardcoded default `/data/pipeline/pipeline-config.json` already matches D-01. The only change needed is in `docker-compose.yml` (the api-server's env override `ACTIVE_PIPELINE_CONFIG_PATH=/data/studio/pipeline-config.json` at line 241 must be changed to `/data/pipeline/pipeline-config.json`). The constant itself does not need editing.

**JSDoc pattern to follow** (constants.ts lines 9-19):
```typescript
/**
 * Server-side "active" studio pipeline config.
 *
 * The remotion-studio editor persists the user's subtitle/title design to a
 * pipeline-config.json. The production /process route seeds this active config
 * into each job's renderer dir ...
 *
 * Env-overridable. When the file does not exist, /process skips seeding and the
 * renderer falls back to env defaults ...
 */
```
Update the JSDoc to reflect D-17 (seeding from `config/pipeline-config.default.json` on startup) when updating.

---

### `docker-compose.yml` — Fix api-server env + remove stale volume (lines 235-242)

**Analog:** studio service stanza (lines 164-193) for environment pattern; api-server stanza (lines 222-259) for volumes pattern.

**Lines to change:**

1. Line 241 — change `ACTIVE_PIPELINE_CONFIG_PATH`:
```yaml
# BEFORE (line 241):
      - ACTIVE_PIPELINE_CONFIG_PATH=/data/studio/pipeline-config.json
# AFTER:
      - ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json
```

2. Line 238 — remove the read-only studio mount (no longer needed once api-server reads from `/data/pipeline/`):
```yaml
# REMOVE (line 238):
      - ./services/remotion-studio:/data/studio:ro
```

**Bind mount pattern to follow** (docker-compose.yml line 3 in x-pipeline-common, and studio lines 236):
```yaml
volumes:
  - ./pipeline:/data/pipeline
```
The `./pipeline:/data/pipeline` mount is already in `*pipeline-common` (line 3) which api-server inherits via `<<: *pipeline-common`. No new mount is needed for D-01/D-03.

**Studio env pattern** (docker-compose.yml lines 175-180) — how env vars set container-side paths:
```yaml
    environment:
      - INPUT_PATH=/data/pipeline/${PIPELINE_JOB_ID}/remotion-renderer/output.mp4
      - PIPELINE_JOB_ID=${PIPELINE_JOB_ID}
      - PIPELINE_CONFIG_PATH=/data/pipeline/${PIPELINE_JOB_ID}/remotion-renderer/pipeline-config.json
      - PORT=3123
      - ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json
```
After the fix both studio (line 180) and api-server (line 241 → changed) will carry the same value for `ACTIVE_PIPELINE_CONFIG_PATH`.

---

### `services/api-server/src/index.ts` — Add startup seed-copy hook (new logic)

**Analog:** `services/api-server/src/orchestrator.ts` lines 227-248

This is the closest pattern in the codebase: `existsSync` guard + `fs.mkdir({ recursive: true })` + `fs.copyFile` wrapped in `try/catch` that logs a warning and never throws. The startup hook copies the same operation but runs once at process boot rather than per-job.

**Core pattern to copy** (orchestrator.ts lines 227-248):
```typescript
// Seed the per-job renderer config from the server-side active studio config so
// rendered captions honor the studio design. ...
// If no active config exists (or the copy fails) this is a no-op ... Never fails the job.
try {
  if (existsSync(ACTIVE_PIPELINE_CONFIG_PATH)) {
    const jobRendererDir = path.join(pipelineDir, jobId, "remotion-renderer");
    await fs.mkdir(jobRendererDir, { recursive: true });
    await fs.copyFile(
      ACTIVE_PIPELINE_CONFIG_PATH,
      path.join(jobRendererDir, "pipeline-config.json")
    );
  }
} catch (err) {
  console.warn(
    `[orchestrator] Could not seed active pipeline-config.json for job ${jobId} ` +
      `(renderer will use env defaults): ${err instanceof Error ? err.message : String(err)}`
  );
}
```

**Adapted startup hook pattern for `index.ts`** (to insert before `app.listen`):
```typescript
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { ACTIVE_PIPELINE_CONFIG_PATH } from "./constants.js";

// D-06: Seed default config on fresh install.
// If the active config is missing, copy the git-tracked default template into place.
// Runs once at startup; never throws — a failure logs and falls through gracefully.
const DEFAULT_CONFIG_PATH = process.env.DEFAULT_CONFIG_PATH || "/app/config/pipeline-config.default.json";

function seedDefaultConfig(): void {
  if (existsSync(ACTIVE_PIPELINE_CONFIG_PATH)) return; // already present, nothing to do
  if (!existsSync(DEFAULT_CONFIG_PATH)) {
    console.warn(`[api-server] Default config template not found at ${DEFAULT_CONFIG_PATH}; skipping seed`);
    return;
  }
  try {
    const dir = require("path").dirname(ACTIVE_PIPELINE_CONFIG_PATH);
    mkdirSync(dir, { recursive: true });
    copyFileSync(DEFAULT_CONFIG_PATH, ACTIVE_PIPELINE_CONFIG_PATH);
    console.log(`[api-server] Seeded default config: ${DEFAULT_CONFIG_PATH} → ${ACTIVE_PIPELINE_CONFIG_PATH}`);
  } catch (err) {
    console.warn(`[api-server] Could not seed default config (will use env fallbacks): ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (process.env.NODE_ENV !== "test") {
  seedDefaultConfig();
}
```

**Import pattern for sync fs operations** (process.ts lines 5-6, orchestrator.ts lines 2-3):
```typescript
import fs from "fs/promises";
import { existsSync } from "fs";
```
For the startup hook, sync variants (`existsSync`, `copyFileSync`, `mkdirSync`) are appropriate — they run before `app.listen`, no async context available.

**Server startup pattern to call seedDefaultConfig before listen** (index.ts lines 59-67):
```typescript
if (process.env.NODE_ENV !== "test") {
  seedDefaultConfig(); // ← insert here, before listen
  const server = app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
  });
  // ...
}
```

**Alternative: seed in remotion-studio's server.ts startup block** (server.ts lines 280-292):
```typescript
export const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[remotion-studio] Config API and Editor SPA listening on port ${PORT}`);
  // ...
  console.log(`  Config file: ${resolveConfigPath()}`);
});
```
The same `seedDefaultConfig()` call could precede `app.listen` in studio's `server.ts`. Choose either location; api-server `index.ts` is preferred because it is the service that owns the active config path (D-01).

---

### `services/api-server/src/routes/process.ts` — Per-job seed (no change)

**Analog:** self — pattern is already correct at lines 115-136.

**Keep as-is** (process.ts lines 122-136):
```typescript
try {
  if (existsSync(ACTIVE_PIPELINE_CONFIG_PATH)) {
    const jobRendererDir = path.join(PIPELINE_DATA_DIR, jobId, "remotion-renderer");
    await fs.mkdir(jobRendererDir, { recursive: true });
    await fs.copyFile(
      ACTIVE_PIPELINE_CONFIG_PATH,
      path.join(jobRendererDir, "pipeline-config.json")
    );
  }
} catch (err) {
  console.warn(
    `[process] Could not seed active pipeline-config.json for job ${jobId} ` +
      `(renderer will use env defaults): ${err instanceof Error ? err.message : String(err)}`
  );
}
```
This reads from the now-unified `ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json`. No change needed — it just works once D-02 removes the divergent api-server env value.

---

## Shared Patterns

### File existence guard before copy
**Source:** `services/api-server/src/orchestrator.ts` lines 235-248, `services/api-server/src/routes/process.ts` lines 122-136
**Apply to:** startup seed-copy hook in `index.ts`
```typescript
if (existsSync(sourcePath)) {
  mkdirSync(path.dirname(destPath), { recursive: true });
  copyFileSync(sourcePath, destPath);
}
```

### Warn-not-throw error pattern for non-critical file operations
**Source:** `services/api-server/src/orchestrator.ts` lines 244-248
**Apply to:** startup seed-copy hook, any config file operation that must not fail the process
```typescript
} catch (err) {
  console.warn(
    `[api-server] Could not ... (will use env fallbacks): ${err instanceof Error ? err.message : String(err)}`
  );
}
```

### Env-var constant with fallback default (module-level, not inline)
**Source:** `services/api-server/src/constants.ts` lines 6-7, 20-21
**Apply to:** any new env-sourced path constant
```typescript
export const ACTIVE_PIPELINE_CONFIG_PATH =
  process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json";
```

### Directory creation before write
**Source:** `services/remotion-studio/src/server.ts` lines 163-167 (PUT /api/config)
**Apply to:** startup seed-copy hook mkdir
```typescript
const dir = path.dirname(configPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
```

### `_meta` strip before write (carry from Phase 16)
**Source:** `services/remotion-studio/src/server.ts` lines 171-174
**Apply to:** PUT /api/config write (already present; must remain in the refactored single-write path)
```typescript
const { _meta, ...configToWrite } = body as PipelineConfig & { _meta?: unknown };
if (configToWrite.titles && Array.isArray(configToWrite.titles)) {
  configToWrite.titles = sanitizeTitles(configToWrite.titles);
}
fs.writeFileSync(configPath, JSON.stringify(configToWrite, null, 2));
```

---

## No Analog Found

No files in this phase are without an analog. All patterns are covered by existing code in the repository.

---

## Metadata

**Analog search scope:** `services/api-server/src/`, `services/remotion-studio/src/`, `docker-compose.yml`, `.gitignore`
**Files scanned:** 9 (server.ts, constants.ts, orchestrator.ts, routes/process.ts, index.ts, docker-compose.yml, Dockerfile×2, pipeline-config.json)
**Pattern extraction date:** 2026-05-26
