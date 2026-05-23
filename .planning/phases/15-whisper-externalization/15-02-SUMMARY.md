---
phase: 15-whisper-externalization
plan: 02
subsystem: orchestration
tags: [whisper, orchestrator, docker-compose, http-step, gpu-removal, wiring]

# Dependency graph
requires:
  - phase: 15-01
    provides: "services/whisper-http-step/ container (image reel-factory-whisper-http-step) + INPUT/OUTPUT/PIPELINE_JOB_ID/WHISPER_API_URL/WHISPER_API_KEY env contract"
provides:
  - "Orchestrator whisper STEP now points at reel-factory-whisper-http-step (name + transcript.json path unchanged)"
  - "GPU plumbing fully removed (orchestrator NVIDIA DeviceRequests + compose deploy.devices stanza)"
  - "docker-compose whisper service builds ./services/whisper-http-step with host.docker.internal reachability + WHISPER_API_URL/KEY"
  - "api-server carries WHISPER_API_URL/KEY so orchestrator process.env resolves at module load"
affects: [15-03-validation-parity-retire-old-whisper]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Externalized GPU work via host.docker.internal:host-gateway extra_hosts (Linux/WSL2 bridge reachability)"
    - "process.env-sourced step env threaded from api-server compose env into spawned sibling containers"

key-files:
  created:
    - .planning/phases/15-whisper-externalization/15-02-SUMMARY.md
  modified:
    - services/api-server/src/orchestrator.ts
    - services/api-server/src/orchestrator.test.ts
    - docker-compose.yml

key-decisions:
  - "Confirmed via grep that the NVIDIA DeviceRequests block was whisper-only before deletion (T-15-07) — exactly one block at orchestrator.ts:245-247, no other step triggered it"
  - "WHISPER_API_KEY sourced from ${WHISPER_API_KEY} (.env) with empty default — never hardcoded in committed compose (T-15-05)"
  - "Dropped the explicit `dockerfile: Dockerfile` line; the whisper-http-step Dockerfile sits at the context root and compose defaults to it"

patterns-established:
  - "STEP image swap with name/path invariance: change image only, keep name + OUTPUT_PATH dir so the file-based contract leaves all downstream steps untouched"

requirements-completed: []

# Metrics
duration: ~8min
completed: 2026-05-23
---

# Phase 15 Plan 02: Orchestrator + compose wiring Summary

**Wired the externalized whisper-http-step (15-01) into the running pipeline by swapping `STEPS[0].image` to `reel-factory-whisper-http-step`, removing all GPU plumbing (orchestrator NVIDIA DeviceRequests + compose `deploy.devices`), and threading `WHISPER_API_URL`/`WHISPER_API_KEY` + `host.docker.internal:host-gateway` reachability through both the orchestrator step env and the api-server — keeping STEP name `whisper` and the `whisper/transcript.json` path identical so every downstream step is untouched.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-05-23
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `orchestrator.ts` STEPS[0]: image `reel-factory-whisper` → `reel-factory-whisper-http-step`; `name` stays `"whisper"`; `HF_HOME` dropped; `WHISPER_API_URL` (default `http://host.docker.internal:8000`) + `WHISPER_API_KEY` (default `""`) added, sourced from `process.env` at module load (`resolveEnvVars` only substitutes `{jobId}`, which is correct here).
- Removed the whisper-only NVIDIA `DeviceRequests` block (D-4) — grep-confirmed it was the sole `DeviceRequests`/`nvidia` reference in the file before deletion.
- `orchestrator.test.ts`: new image assertion, `WHISPER_API_URL`/`WHISPER_API_KEY` present, `HF_HOME` absent, `firstCall.HostConfig.DeviceRequests` undefined. Vitest orchestrator suite green (13/13).
- `docker-compose.yml` whisper service: builds `./services/whisper-http-step`, image `reel-factory-whisper-http-step:latest`, no `HF_HOME`, no `deploy.resources` GPU stanza, `WHISPER_API_URL`/`WHISPER_API_KEY` env, `extra_hosts host.docker.internal:host-gateway`, `start_period` 30s → 15s. Service KEY + `OUTPUT_PATH` dir unchanged → `srt-exporter.depends_on.whisper` and all `TRANSCRIPT_PATH` refs keep resolving.
- `docker-compose.yml` api-server: added `WHISPER_API_URL`/`WHISPER_API_KEY` env so `process.env.WHISPER_API_KEY` resolves when STEPS is constructed.

## Task Commits

1. **Task 1: Swap orchestrator whisper STEP + remove GPU DeviceRequests + update tests** — `ac3f2dd` (feat)
2. **Task 2: docker-compose whisper HTTP-step service + host reachability + api-server key env** — `a16d2e0` (feat)

## Files Created/Modified

- `services/api-server/src/orchestrator.ts` — STEPS[0] swapped; GPU DeviceRequests block removed.
- `services/api-server/src/orchestrator.test.ts` — whisper assertions updated to new image/env, GPU-undefined assertion added.
- `docker-compose.yml` — whisper service rebuilt against HTTP step; api-server env extended.

## Verification Results

- `grep reel-factory-whisper-http-step src/orchestrator.ts` ✓; `! grep HF_HOME` ✓; `grep WHISPER_API_URL` ✓; `! grep DeviceRequests` ✓.
- `npx vitest run src/orchestrator.test.ts` → 13 passed (1 file).
- `npx tsc --noEmit` → **20 errors, identical to the documented ~20-error api-server baseline. ZERO new errors introduced.** (Pre-existing errors live in `routes/status.ts`, `schemas/response.ts`, etc. — untouched by this plan.)
- `docker compose config` parses cleanly; `PIPELINE_JOB_ID=test docker compose config` resolves the whisper service with the new image, no GPU stanza, `extra_hosts host.docker.internal=host-gateway`, and `WHISPER_API_URL`/`WHISPER_API_KEY`.

## tsc Baseline Delta

Baseline before changes: 20 errors. After changes: 20 errors. **Delta: 0 new errors.** The plan's zero-new-error requirement is met; pre-existing baseline errors were left untouched per the notes.

## host.docker.internal Reachability Assumptions for 15-03

- The whisper service reaches the external whisper-api via `WHISPER_API_URL=http://host.docker.internal:8000`, made resolvable on Linux/WSL2 bridge networks by `extra_hosts: ["host.docker.internal:host-gateway"]`. This is harmless on Docker Desktop where the name resolves natively.
- **15-03 must verify live**: that the external whisper-api at `/home/luis/proyectos/whisper` is up and publishing `8000:8000` on the host, and that the running whisper-http-step container can actually reach `http://host.docker.internal:8000/health` from inside the reel-factory `pipeline-net`. The orchestrator binds `NetworkMode: PIPELINE_NETWORK`; host-gateway should route out, but this is the first live cross-stack call and must be confirmed in the e2e run.
- `WHISPER_API_KEY` is present in reel-factory `.env` (gitignored) and resolved at compose time (confirmed via `docker compose config`). 15-03's e2e run depends on it matching the external service's `API_KEY`.

## Deviations from Plan

None — plan executed exactly as written. The optional `dockerfile:` line was dropped (the step Dockerfile is at the context root) exactly as the plan's Task 2 action specified.

## Threat Surface Scan

No new threat surface beyond the plan's `<threat_model>`. Mitigations applied: `WHISPER_API_KEY` sourced from `${WHISPER_API_KEY}` env with empty default, never hardcoded in the committed compose (T-15-05); `host.docker.internal` is the trusted local host-gateway boundary (T-15-06, accept); GPU `DeviceRequests` removal grep-confirmed whisper-only before deletion (T-15-07).

## Next Phase Readiness

- The pipeline now POINTS at the external whisper-api. The old `services/whisper/` directory is **NOT yet deleted** — that is 15-03, after parity + e2e drift-repro validation.
- 15-03 must: (1) confirm live host.docker.internal reachability per the assumptions above; (2) run the parity test accounting for the NO_AUDIO_STREAM behavior change (old=empty/exit-0, new=fail/exit-1, intentionally non-parity — flagged in 15-01); (3) retire `services/whisper/` + optionally add the `timeline: "original"` marker in the external whisper repo.

## Self-Check: PASSED

All modified files verified on disk; both task commits (`ac3f2dd`, `a16d2e0`) present in git history.

---
*Phase: 15-whisper-externalization*
*Completed: 2026-05-23*
