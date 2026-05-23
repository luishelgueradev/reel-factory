---
phase: "16-render-config-flicker"
plan: 01
subsystem: "remotion-studio"
tags: ["config", "pipeline", "docker-compose", "server"]
dependency_graph:
  requires: []
  provides:
    - "ACTIVE_PIPELINE_CONFIG_PATH mirror write in PUT /api/config"
    - "Explicit ACTIVE_PIPELINE_CONFIG_PATH env var in docker-compose remotion-studio service"
  affects:
    - "services/api-server/src/routes/process.ts (consumes ACTIVE_PIPELINE_CONFIG_PATH)"
tech_stack:
  added: []
  patterns:
    - "Dual-write: resolveConfigPath() + ACTIVE_PIPELINE_CONFIG_PATH with mkdirSync guard"
key_files:
  created: []
  modified:
    - "services/remotion-studio/src/server.ts"
    - "docker-compose.yml"
decisions:
  - "Mirror write uses process.env.ACTIVE_PIPELINE_CONFIG_PATH with same default (/data/pipeline/pipeline-config.json) as api-server/src/constants.ts:21 — single source of truth for default path"
  - "Both writeFileSync calls remain inside the existing try/catch block — error handling covers both writes uniformly"
  - "configToWrite (already _meta-stripped and sanitized) is reused for both writes — no double-sanitization"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-23T13:30:30Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 16 Plan 01: Active-Config Mirror Write Summary

**One-liner:** Studio PUT /api/config now dual-writes to ACTIVE_PIPELINE_CONFIG_PATH (/data/pipeline/pipeline-config.json) so /process renders pick up the studio config instead of falling back to tiktok layout + env defaults.

## What Was Built

Fixed Issue A (v1.1 incomplete wire): the config producer side (studio server.ts) was missing the write to ACTIVE_PIPELINE_CONFIG_PATH. The consumer side (process.ts seeds from ACTIVE_PIPELINE_CONFIG_PATH) was already wired in v1.1.

### Task 1: server.ts — active-config mirror write

Inside the `PUT /api/config` handler, after the existing `fs.writeFileSync(configPath, ...)` to `resolveConfigPath()`, inserted:

1. `activePath` declaration using `process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json"`
2. `activeDir = path.dirname(activePath)` with `mkdirSync` guard (same pattern as existing configPath guard)
3. Second `fs.writeFileSync(activePath, JSON.stringify(configToWrite, null, 2))` — reuses the sanitized `configToWrite`
4. Log: `[studio] Active config mirrored to: <activePath>`

No new imports. Both writes inside the existing try/catch block.

### Task 2: docker-compose.yml — explicit env var

Added `- ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json` to the `remotion-studio` service `environment` block, after `- PORT=3123`. Value matches `api-server/src/constants.ts:21` verbatim. Docker compose config validated exit=0.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: server.ts mirror write | 0b464b9 | services/remotion-studio/src/server.ts |
| Task 2: docker-compose env var | 0167077 | docker-compose.yml |

## Verification

- `grep -c "ACTIVE_PIPELINE_CONFIG_PATH" src/server.ts` → 2 (comment + env read — both in the activePath declaration block)
- `grep -cE "writeFileSync.*activePath|activePath.*writeFileSync" src/server.ts` → 1
- `grep -c "ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json" docker-compose.yml` → 1
- `docker compose config --quiet` → exit=0

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None introduced by this plan. The pre-existing `/api/render` placeholder at server.ts:155 is out of scope.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns beyond what is described in the plan's threat model.

## Self-Check: PASSED

- [x] `services/remotion-studio/src/server.ts` — modified, committed at 0b464b9
- [x] `docker-compose.yml` — modified, committed at 0167077
- [x] Commits verified: `git log --oneline | head -5` shows both commits present
