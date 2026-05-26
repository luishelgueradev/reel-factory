---
phase: 17-config-persistence
plan: "01"
subsystem: config-persistence
tags: [config, docker, api-server, remotion-studio, persistence]
dependency_graph:
  requires: []
  provides:
    - config/pipeline-config.default.json (git-tracked seed template)
    - seedDefaultConfig() startup hook in api-server
    - single-write PUT /api/config in remotion-studio
  affects:
    - services/api-server/src/index.ts
    - services/remotion-studio/src/server.ts
    - docker-compose.yml
    - services/api-server/Dockerfile
tech_stack:
  added: []
  patterns:
    - seedDefaultConfig: idempotent startup copy hook (existsSync guard + copyFileSync + warn-not-throw)
    - single-write PUT: module-level ACTIVE_PIPELINE_CONFIG_PATH constant replaces dual-write
key_files:
  created:
    - config/pipeline-config.default.json
  modified:
    - services/api-server/Dockerfile
    - services/api-server/src/index.ts
    - services/remotion-studio/src/server.ts
    - docker-compose.yml
decisions:
  - "D-04: PUT /api/config writes only to ACTIVE_PIPELINE_CONFIG_PATH; resolveConfigPath() removed from write path"
  - "D-06: seedDefaultConfig() hooks before app.listen; idempotent existsSync guard prevents overwriting user config"
  - "D-07: config/pipeline-config.default.json is git-tracked; pipeline/ stays gitignored"
  - "D-02: stale :ro studio mount removed from api-server in docker-compose.yml"
metrics:
  duration: "3m 19s"
  completed: "2026-05-26"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 5
---

# Phase 17 Plan 01: Config Persistence Wiring Summary

**One-liner:** Git-tracked default template + startup seed hook + single-write PUT + docker-compose env alignment, closing the studio-saved config loss on Docker rebuild.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create config/pipeline-config.default.json and COPY into api-server image | 16063ae | config/pipeline-config.default.json, services/api-server/Dockerfile |
| 2 | Add seedDefaultConfig() startup hook to api-server/src/index.ts | 618fc5a | services/api-server/src/index.ts |
| 3 | Fix PUT /api/config single-write + docker-compose.yml api-server env | 1c589c7 | services/remotion-studio/src/server.ts, docker-compose.yml |

## What Was Built

### Task 1: Default config template + Dockerfile COPY

- Created `config/pipeline-config.default.json` as a git-tracked file, byte-equivalent to `services/remotion-studio/pipeline-config.json` (the current studio config). Contains `subtitle` and `titles` keys.
- Added `COPY config/ ./config/` to `services/api-server/Dockerfile` after `COPY src/ ./src/`, making the template available at `/app/config/pipeline-config.default.json` in the container.
- `config/` is NOT gitignored (only `pipeline/` is); confirmed via `git ls-files`.

### Task 2: seedDefaultConfig() startup hook

- Added `import { existsSync, copyFileSync, mkdirSync } from "fs"`, `import path from "path"`, and `import { ACTIVE_PIPELINE_CONFIG_PATH } from "./constants.js"` to `services/api-server/src/index.ts`.
- Added `DEFAULT_CONFIG_PATH` constant (env-overridable, defaults to `/app/config/pipeline-config.default.json`).
- Implemented `seedDefaultConfig()`:
  - Returns immediately if `ACTIVE_PIPELINE_CONFIG_PATH` already exists (idempotent; T-17-04).
  - Warns and returns if `DEFAULT_CONFIG_PATH` is missing (graceful degradation).
  - Uses sync `mkdirSync` + `copyFileSync` (appropriate for startup, before async context).
  - Wraps copy in try/catch; `console.warn` on failure, never throws.
- Called as first statement in the `NODE_ENV !== "test"` block, before `app.listen`.

### Task 3: Single-write PUT /api/config + docker-compose.yml alignment

- Added module-level `const ACTIVE_PIPELINE_CONFIG_PATH = process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json"` to `server.ts` (lines 38-39).
- Rewrote `PUT /api/config` handler: removed the `resolveConfigPath()` call, removed the dual-write mirror block; now writes a single time to `ACTIVE_PIPELINE_CONFIG_PATH`. All safety logic retained: `validatePipelineConfig()` Zod check, `_meta` strip, `sanitizeTitles()` HTML escape (T-17-06, CR-02).
- `resolveConfigPath()` function body is UNCHANGED — still used by `GET /api/config` for job-scoped reads and the startup log.
- In `docker-compose.yml` api-server stanza: removed `- ./services/remotion-studio:/data/studio:ro` volume mount (D-02); changed `ACTIVE_PIPELINE_CONFIG_PATH=/data/studio/pipeline-config.json` to `ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json` (D-01).

## Verification Results

All plan verification checks passed:

1. `resolveConfigPath` in server.ts — function definition + GET call only; PUT handler has NO call to `resolveConfigPath()`. PASS.
2. `writeFileSync` count in server.ts = 1 (single write to ACTIVE_PIPELINE_CONFIG_PATH). PASS.
3. `data/studio` in docker-compose.yml = 0 hits. PASS.
4. `ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json` in docker-compose.yml = 2 hits (studio + api-server). PASS.
5. `COPY config/` in api-server Dockerfile = 1 hit. PASS.
6. `config/pipeline-config.default.json` is valid JSON. PASS.
7. `git ls-files config/pipeline-config.default.json` returns the file (git-tracked). PASS.
8. TypeScript check: `npx tsx --check` on both `server.ts` and `index.ts` = exit 0, no errors. PASS.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All wiring is complete. The seed hook, single-write path, and docker-compose alignment are fully functional.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes were introduced beyond what the plan's threat model covers. The PUT /api/config endpoint was simplified (reduced surface, not expanded). The `:ro` studio mount was removed from api-server (reduced attack surface per T-17-05). All T-17-* mitigations are in place.

## Self-Check: PASSED

- `config/pipeline-config.default.json` exists: FOUND
- `services/api-server/Dockerfile` contains `COPY config/`: FOUND
- `services/api-server/src/index.ts` contains `seedDefaultConfig`: FOUND
- `services/remotion-studio/src/server.ts` module-level `ACTIVE_PIPELINE_CONFIG_PATH`: FOUND
- Commits 16063ae, 618fc5a, 1c589c7: all present in `git log --oneline`
