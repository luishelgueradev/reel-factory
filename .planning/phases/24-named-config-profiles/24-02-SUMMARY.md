---
phase: 24-named-config-profiles
plan: "02"
subsystem: remotion-studio/profiles-api
tags: [profiles, express-routes, supertest, atomic-write, path-traversal, typescript]
dependency_graph:
  requires: [profiles.ts (24-01), pipeline-config.ts]
  provides: [server.ts profiles routes, profiles-api.test.ts]
  affects: [24-03-ui]
tech_stack:
  added: []
  patterns: [lazy-env-getter, atomic-write-shared-helper, injected-dir-testability, supertest-integration]
key_files:
  created:
    - services/remotion-studio/src/profiles-api.test.ts
  modified:
    - services/remotion-studio/src/server.ts
decisions:
  - "D-05 apply = server-side: PUT /api/profiles/:slug/apply atomically writes profile config to ACTIVE_PIPELINE_CONFIG_PATH via shared atomicWriteConfig() helper"
  - "D-08 startup ensure: mkdirSync guarded under NODE_ENV!=test to avoid EACCES in test env without bind mount"
  - "Lazy getters: PROFILES_DIR and ACTIVE_PIPELINE_CONFIG_PATH read via functions at call time (not module load) so test overrides work when server.ts is cached across test files in the same vitest worker"
  - "atomicWriteConfig() extracted as shared helper: reused by PUT /api/config and PUT /api/profiles/:slug/apply (CR-02, D-04)"
  - "Separate profiles-api.test.ts (not added to server.test.ts): avoids collision with existing server.test.ts env setup; sets temp PROFILES_DIR + ACTIVE_PIPELINE_CONFIG_PATH before app import"
metrics:
  duration: "~9 minutes"
  completed: "2026-06-04"
  tasks_completed: 3
  files_created: 1
  tests_passing: 247
---

# Phase 24 Plan 02: Profiles API Routes Summary

Six profiles CRUD + apply routes wired into the Studio Express server, all registered before the SPA catch-all, with a 19-test supertest suite proving save→list→get→apply→rename→delete and all error paths; active-config disk-sync proven on apply.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | PROFILES_DIR + startup ensure + profiles CRUD/apply routes | c3975d9 | services/remotion-studio/src/server.ts |
| 3 | profiles-api.test.ts integration tests + lazy path fix | 2210f48 | services/remotion-studio/src/server.ts, services/remotion-studio/src/profiles-api.test.ts |

## What Was Built

### server.ts changes

**New imports:** `listProfiles`, `readProfile`, `saveProfile`, `renameProfile`, `removeProfile`, `isValidSlug`, `ProfileConflictError`, `ProfileValidationError` from `./profiles.js` (24-01).

**`getActivePipelineConfigPath()` (lazy getter):** Replaces module-level `ACTIVE_PIPELINE_CONFIG_PATH` constant so `process.env.ACTIVE_PIPELINE_CONFIG_PATH` overrides work at request time even when the module is cached across test files.

**`getProfilesDir()` (lazy getter, D-01, D-08):** Reads `process.env.PROFILES_DIR || dirname(activePath)/profiles` at call time. Same testability rationale.

**`atomicWriteConfig(config)` (shared helper, CR-02, D-04):** Extracted from `PUT /api/config` inline code. Uses temp file + `fs.renameSync` pattern. Used by both `PUT /api/config` and `PUT /api/profiles/:slug/apply`.

**Startup `mkdirSync`:** Ensures profiles dir exists, guarded under `NODE_ENV !== "test" && !VITEST` to prevent EACCES when tests run without the Docker bind mount.

**6 profiles routes (registered before `serveSpa` catch-all, T-18-03-01):**

| Route | Status | Description |
|-------|--------|-------------|
| `GET /api/profiles` | 200 | `{ profiles: ProfileSummary[] }` sorted by updatedAt desc (D-11) |
| `POST /api/profiles` | 201 / 400 | Save profile; validatePipelineConfig first; maps ProfileValidationError→400 |
| `GET /api/profiles/:slug` | 200 / 400 / 404 | Read single profile; isValidSlug guard → 400; missing → 404 |
| `PUT /api/profiles/:slug/apply` | 200 / 400 / 404 / 422 | Read profile (404 if missing); validate config (422 if invalid, D-07); atomicWriteConfig; return `{ ...config, _meta: { source: "profile", slug } }` |
| `PATCH /api/profiles/:slug` | 200 / 400 / 404 / 409 | Rename; ProfileConflictError→409; "does not exist" → 404; invalid name→400 |
| `DELETE /api/profiles/:slug` | 200 / 400 / 404 | Delete; existed=false→404; invalid slug→400 |

All handlers validate slug with `isValidSlug()` before any fs touch (path-traversal guard, D-03).

### profiles-api.test.ts

19 supertest integration tests. Env vars (`PROFILES_DIR`, `ACTIVE_PIPELINE_CONFIG_PATH`) set to `mkdtemp` temp dirs before the `import app from "./server.js"` line. Temp dir cleaned in `afterAll`.

Coverage:
- `POST /api/profiles` valid → 201 + full ProfileFile (PROFILE-01)
- `POST` with invalid config → 400; missing name → 400; missing config → 400
- `GET /api/profiles` lists saved profile (PROFILE-03 list)
- `GET /api/profiles/:slug` → 200 with verbatim config; unknown → 404; `../x` → 400; `a.json` → 400 (D-03)
- `PUT /api/profiles/:slug/apply` → 200; disk file equals profile config (PROFILE-02 + active-sync proof); unknown → 404; invalid slug → 400
- `PATCH` rename → 200 + new slug in list, old gone; conflict → 409; missing → 404 (PROFILE-03)
- `DELETE` → 200 then not in list; missing → 404; invalid slug → 400 (PROFILE-03)
- Persistence (PROFILE-04): asserts profile JSON file written under `TEST_PROFILES_DIR`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy getters for PROFILES_DIR and ACTIVE_PIPELINE_CONFIG_PATH**
- **Found during:** Task 3 test execution
- **Issue:** `PROFILES_DIR` and `ACTIVE_PIPELINE_CONFIG_PATH` were resolved as module-level constants at import time. When vitest caches `server.ts` across test files in the same worker, `profiles-api.test.ts`'s `process.env.PROFILES_DIR = TEST_PROFILES_DIR` assignment had no effect — the module already loaded with the original default (`/data/pipeline/...`) which is inaccessible in CI/non-Docker.
- **Fix:** Replaced both constants with lazy getter functions (`getProfilesDir()`, `getActivePipelineConfigPath()`) that read `process.env.*` at call time. Guarded the startup `mkdirSync` under `NODE_ENV !== "test"` for the same reason.
- **Files modified:** `services/remotion-studio/src/server.ts`
- **Commit:** 2210f48

## Verification

- `npx vitest run` (studio): **247 tests passing (12 files)** — includes 19 new profiles-api tests
- `grep /api/profiles src/server.ts`: **6 routes before serveSpa** (lines 341-490, serveSpa at 524)
- Apply test asserts `fs.readFileSync(TEST_ACTIVE_CONFIG)` equals profile config: **proven on disk**
- `npx tsc --noEmit`: no new errors in server.ts (one pre-existing `Readable.fromWeb` type error on line ~324 is pre-existing, not introduced here)

## Known Stubs

None. This is a server-side API with no UI rendering.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-write-endpoint | server.ts | POST /api/profiles, PUT /api/profiles/:slug/apply — new endpoints that write to the filesystem. Same trust model as PUT /api/config (internal Docker network only, WR-06). Path-traversal guarded via isValidSlug(). No auth beyond existing Basic Auth middleware. |

## Self-Check: PASSED

- `services/remotion-studio/src/profiles-api.test.ts`: FOUND
- `services/remotion-studio/src/server.ts` (modified): FOUND
- Commit c3975d9 (Tasks 1+2): FOUND
- Commit 2210f48 (Task 3): FOUND
