# Phase 15 — Whisper externalization (CONTEXT)

**Milestone:** v1.2 (Infrastructure / shared services)
**Status:** whisper standalone COMPLETE (Phases 1-5 done, live UAT verified 2026-05-22) → ready to plan/execute
**Source of truth for design decisions:** `.planning/contracts/whisper-service-integration.md`

## Phase goal
Replace the embedded `services/whisper` Docker container in reel-factory's pipeline with HTTP calls to the standalone whisper-api service at `/home/luis/proyectos/whisper` (FastAPI + WhisperX large-v3, GPU). Preserve the reels contract drop-in (verified field-by-field — see spec). Validate the highlight-sync drift fix end-to-end on a real mid-speech-cut clip (now possible because the external service has GPU).

## Decisions already locked (per spec §7)
- ✅ Explicit `timeline: "original"` marker on the reels contract (renderer side done; whisper-side default in old `services/whisper`; external service must emit it when integrated — 1-line additive in `app/transcript.py`).
- ✅ HTTP step shape: small container/script that writes `transcript.json` to the standard pipeline path (preserves the file-based step contract → zero downstream change).

## Decisions locked (2026-05-22, after whisper-api Phase 5 inspection)
- ✅ **D-3 network**: `host.docker.internal:8000`. whisper-api publishes `8000:8000` on the host; reel-factory's HTTP step calls `http://host.docker.internal:8000` from its own compose stack. Works out-of-the-box on Docker Desktop / WSL2 (user's env). Zero docker-network coordination. Configurable via `WHISPER_API_URL` (default `http://host.docker.internal:8000`).
- ✅ **D-3 auth**: `X-API-Key` header from `WHISPER_API_KEY` env on reel-factory side. whisper-api fails fast (500) if its `API_KEY` is unset; missing/invalid key → 401 UNAUTHORIZED → step fails.
- ✅ **D-6 limits**: whisper-api ships `MAX_FILE_MB=200`, `MAX_DURATION_S=600` (10 min) — sufficient for talking-head clips. HTTP step pre-validates duration via ffprobe and surfaces a friendly `PipelineStepError` if exceeded. Longer content → raise the env on the whisper-api side; no reel-factory change.
- ✅ **D-2 sync-vs-async** (default; plan may refine): probe duration via ffprobe → `POST /transcribe` (sync) when ≤ 120 s, else `POST /jobs` + poll `GET /jobs/{job_id}` ~every 2 s until terminal. `503 QUEUE_FULL` → honor `Retry-After` header, backoff, max 2 retries. `done.result` → write to `OUTPUT_PATH`; `failed` → `PipelineStepError`.
- ✅ **D-5 retire old whisper**: yes — Plan 15-03 deletes `services/whisper/` + its compose service after parity + e2e drift repro pass. Contract already captured in `.planning/contracts/`; no need to keep the old code.

## Operational facts (confirmed from whisper-api docker-compose, 2026-05-22)
- Service: `whisper-api`, image `whisper-api:latest`, port `8000:8000`, `restart: unless-stopped`, `stop_grace_period: 60s`, GPU reserved.
- Health: `GET /health` → `{status:"ok", device, models_loaded, version}` (no auth).
- Endpoints: `POST /transcribe` (sync), `POST /jobs` + `GET /jobs/{id}` (async). All require `X-API-Key` except `/health`.
- `profile=reels` request → BARE body `{language, model, segments, words, duration}` (no envelope); this is what reel-factory writes verbatim to `transcript.json`.
- Errors: uniform JSON `{status:"error", code, message}`. Codes: UNAUTHORIZED(401), INVALID_LANGUAGE(400), NO_AUDIO_STREAM(400), FILE_TOO_LARGE(413), QUEUE_FULL(503,+Retry-After), JOB_NOT_FOUND(404), MODEL_ERROR(500).

## Pending opportunistic add (in the EXTERNAL whisper repo, not blocking)
- `/home/luis/proyectos/whisper/app/transcript.py` `Transcript` model still lacks `timeline: str = "original"` (verified absent in sync.json: keys are `[language, model, segments, words, duration]`). Adding it makes the reel-factory renderer's deterministic resolver fire directly; without it, the heuristic fallback handles the common case correctly. Plan 15-03 should add it (or note the skip) so the drift-repro test exercises the marker path, not just the fallback.

## Proposed plan shape (3 plans, ~2.5 sessions total)

| Plan | What it builds |
|---|---|
| **15-01** | New HTTP whisper step container/script: reads `INPUT_PATH`, probes duration, calls `/transcribe` (sync) or `/jobs`+poll (async), writes response to `OUTPUT_PATH`. Error mapping → `PipelineStepError`. Unit tests against a mock whisper-api. |
| **15-02** | Orchestrator + compose wiring: swap the `whisper` STEP image to the new HTTP step; add `WHISPER_API_URL`/`WHISPER_API_KEY` env; remove `HF_HOME`; configure inter-stack network. docker-compose updates. |
| **15-03** | Validation + retirement: end-to-end run with a mid-speech-cut clip → assert highlight-sync drift is GONE (closes the deferred Spike 001 visual repro); parity test (old vs new whisper diff); retire `services/whisper/`. |

## Files this phase will touch (probable)
- New: `services/whisper-http-step/` (Dockerfile + main.py or main.ts + tests)
- Edit: `services/api-server/src/orchestrator.ts` (STEP swap)
- Edit: `docker-compose.yml` (remove old whisper service; add new step; network config)
- Delete: `services/whisper/` (after verification)

## Entry point when ready
`/gsd-plan-phase 15` — uses this CONTEXT + the contract spec to produce `15-01-PLAN.md` ... `15-03-PLAN.md`. discuss-phase NOT needed: all gray-area decisions (D-2/D-3/D-5/D-6) are locked above. whisper-api is complete and live.
