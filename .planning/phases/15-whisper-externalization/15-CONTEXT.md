# Phase 15 — Whisper externalization (CONTEXT)

**Milestone:** v1.2 (Infrastructure / shared services)
**Status:** awaiting whisper standalone Phase 5 completion → ready to plan/execute
**Source of truth for design decisions:** `.planning/contracts/whisper-service-integration.md`

## Phase goal
Replace the embedded `services/whisper` Docker container in reel-factory's pipeline with HTTP calls to the standalone whisper-api service at `/home/luis/proyectos/whisper` (FastAPI + WhisperX large-v3, GPU). Preserve the reels contract drop-in (verified field-by-field — see spec). Validate the highlight-sync drift fix end-to-end on a real mid-speech-cut clip (now possible because the external service has GPU).

## Decisions already locked (per spec §7)
- ✅ Explicit `timeline: "original"` marker on the reels contract (renderer side done; whisper-side default in old `services/whisper`; external service must emit it when integrated — 1-line additive in `app/transcript.py`).
- ✅ HTTP step shape: small container/script that writes `transcript.json` to the standard pipeline path (preserves the file-based step contract → zero downstream change).

## Still open (decide during plan/execute)
- **D-2** sync-vs-async threshold (suggest probe duration; `/jobs` above ~120 s).
- **D-3** `WHISPER_API_URL` + `WHISPER_API_KEY` env vars + network reachability between stacks (shared Docker network? host:port?).
- **D-5** retire `services/whisper/` + its orchestrator step after the HTTP step is verified.
- **D-6** confirm 600 s / 200 MB service limits cover reel-factory inputs (or raise via `MAX_DURATION_S` / `MAX_FILE_MB`).
- Apply the `timeline: "original"` 1-liner in the external whisper-api codebase opportunistically.

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
`/gsd-plan-phase 15` — uses this CONTEXT + the contract spec to produce `15-01-PLAN.md` ... `15-03-PLAN.md`. discuss-phase optional (the spec already captures the design rationale); only useful if open decisions D-2/D-3/D-5/D-6 need adaptive questioning.
