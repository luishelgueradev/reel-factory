---
phase: 25-ai-social-metadata
plan: "02"
subsystem: remotion-studio/metadata-api
tags: [api-routes, supertest, fetch-mock, docker-compose, ai-metadata, router-client]
dependency_graph:
  requires: [metadata-core]
  provides: [metadata-api-routes]
  affects:
    - services/remotion-studio/src/server.ts
    - docker-compose.yml
    - .env.example
tech_stack:
  added: []
  patterns: [lazy-getter-for-testability, atomic-write-job-file, injectable-error-classes, fetch-with-abortsignal-timeout]
key_files:
  created:
    - services/remotion-studio/src/metadata-api.test.ts
  modified:
    - services/remotion-studio/src/server.ts
    - docker-compose.yml
    - .env.example
decisions:
  - "routerChatClient uses AbortSignal.timeout(90000) — cloud cold-load can be slow (AI-SPEC §3 common pitfalls)"
  - "PIPELINE_DATA_DIR lazy getter mirrors getProfilesDir/getActivePipelineConfigPath pattern so tests override per-file without module re-load"
  - "atomicWriteJobFile is a generalized version of atomicWriteConfig operating on arbitrary job-dir paths"
  - "Both metadata routes registered before serveSpa static catch-all (T-18-03-01)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-04T22:09:00Z"
  tasks_completed: 3
  files_created: 1
  files_modified: 3
---

# Phase 25 Plan 02: Metadata API Routes + Docker Wiring Summary

POST/GET `/api/metadata` routes on the Studio server backed by `routerChatClient` (fetch to local-llms OpenAI surface), with typed error classes, atomic persistence to `{jobId}/metadata.json`, lazy getters for testability, docker-compose `extra_hosts` + `METADATA_*` env, and 16 supertest integration tests (mocked router, all 349 studio tests pass).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | POST/GET /api/metadata + routerChatClient | f41cc23 | services/remotion-studio/src/server.ts |
| 2 | docker-compose + .env.example wiring | 73d6f27 | docker-compose.yml, .env.example |
| 3 | metadata-api.test.ts integration tests | 59f9c8d | services/remotion-studio/src/metadata-api.test.ts |

## What Was Built

### server.ts additions (~247 lines)

**Lazy getters (module-caching safe):**
- `getMetadataApiUrl()` — default `http://host.docker.internal:3210`
- `getMetadataApiKey()` — empty by default (→ 503 until set)
- `getMetadataModel()` — default `big-cloud`
- `getPipelineDataDir()` — `PIPELINE_DATA_DIR` env or `dirname(ACTIVE_PIPELINE_CONFIG_PATH)` = `/data/pipeline`

**Typed error classes:**
- `RouterNotConfiguredError` — empty key scenario → 503
- `RouterError(status, body)` — non-200 router response → 502

**`routerChatClient({system, user})`:**
- `fetch(${url}/v1/chat/completions)`, Bearer key, `json_object` mode, `temperature:0.7`, `max_tokens:500`, `AbortSignal.timeout(90000)`
- Logs `X-Model-Backend` + `X-Cost-Cents` for observability (AI-SPEC §7)
- Throws `RouterNotConfiguredError` if key is empty

**`atomicWriteJobFile(filePath, data)`:**
- Generalized atomic write (temp+rename) for arbitrary job-dir files; mirrors `atomicWriteConfig`

**`POST /api/metadata`:**
- Body: `{ jobId, platform, tone }`
- Validates jobId (UUID regex), platform (must be in `PLATFORMS`), tone (must be in `TONES`)
- Reads `{PIPELINE_DATA_DIR}/{jobId}/whisper/transcript.json` → 404 if missing
- Calls `generateMetadata(..., client: routerChatClient)` (25-01 core)
- Persists result atomically to `{jobId}/metadata.json` (D-05)
- Returns `{ title, description, hashtags, _meta: { model } }`
- Error mapping: `RouterNotConfiguredError`→503, `RouterError`→502, `EmptyTranscriptError`→422, `MetadataValidationError`→502, `TimeoutError`→502

**`GET /api/metadata/:jobId`:**
- UUID-validates jobId, reads `{jobId}/metadata.json`, returns 200 or 404
- Survives reload (D-05)

Both routes registered before `serveSpa` catch-all (T-18-03-01).

### docker-compose.yml

Added to `remotion-studio` service:
- `extra_hosts: ["host.docker.internal:host-gateway"]` — reaches the local-llms router on the host (D-04)
- `METADATA_API_URL=${METADATA_API_URL:-http://host.docker.internal:3210}`
- `METADATA_API_KEY=${METADATA_API_KEY:-}` — empty by default (no secret hardcoded)
- `METADATA_MODEL=${METADATA_MODEL:-big-cloud}`

### .env.example

Added `# ─── AI social metadata (Phase 25)` section documenting all three vars with model options (big-cloud vs chat-local).

### metadata-api.test.ts (302 lines, 16 tests)

Supertest + `vi.stubGlobal("fetch", mockFetch)` — zero real network calls:

- **POST /api/metadata:**
  - Happy path → 200, title/description/hashtags, `_meta.model`, `metadata.json` persisted
  - Invalid jobId → 400 (fetch not called)
  - Path-traversal jobId `../evil` → 400
  - Unknown platform → 400
  - Unknown tone → 400
  - Missing transcript → 404
  - Empty `METADATA_API_KEY` → 503 "router no configurado"
  - Router HTTP 500 → 502
  - Double-invalid JSON response → 502 MetadataValidationError (retry exhausted)
  - Empty transcript (no segments) → 422
  - instagram + profesional → 200
  - youtube_shorts + llamativo → 200

- **GET /api/metadata/:jobId:**
  - Returns persisted metadata after POST → 200 with correct title
  - No metadata.json → 404
  - Invalid UUID → 400
  - Path-traversal → 400

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This is a server-side API module; no UI rendering.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-network-endpoint | services/remotion-studio/src/server.ts | POST /api/metadata calls external HTTP endpoint (local-llms router); mitigated by: empty key→503, AbortSignal.timeout(90s), all errors caught and mapped to typed responses, never propagates raw stack traces |

The router call is intentional (the feature's purpose). Mitigations applied: key-required guard, timeout, typed error isolation.

## Self-Check: PASSED

- [x] `services/remotion-studio/src/server.ts` contains POST + GET /api/metadata before serveSpa
- [x] `services/remotion-studio/src/metadata-api.test.ts` exists (302 lines, 16 tests)
- [x] `docker-compose.yml` contains `METADATA_API_KEY`, `METADATA_API_URL`, `METADATA_MODEL`, `host.docker.internal:host-gateway`
- [x] `.env.example` contains AI social metadata section
- [x] Commit f41cc23 exists: feat(25-02) server.ts routes + routerChatClient
- [x] Commit 73d6f27 exists: feat(25-02) docker-compose + .env.example wiring
- [x] Commit 59f9c8d exists: test(25-02) metadata-api integration tests
- [x] 349/349 studio tests pass (16 test files, 0 failures)
- [x] `docker compose config` exits 0 (valid)
- [x] No secrets hardcoded (METADATA_API_KEY defaults to empty)
