---
phase: 15-whisper-externalization
plan: 01
subsystem: infra
tags: [whisper, http-client, requests, ffprobe, pipeline-step, transcription]

# Dependency graph
requires:
  - phase: 02-whisper
    provides: "transcript.json reels schema (Transcript/Segment/Word) + STEP_NAME='whisper' contract"
  - phase: 14-quality-finalizer
    provides: "step contract skeleton (env-in/file-out/manifest/exit-code) + ffprobe list-argv idiom"
provides:
  - "services/whisper-http-step/ — a thin HTTP-client pipeline step replacing the embedded GPU Whisper container"
  - "transcribe_http.py: ffprobe duration probe + sync/async whisper-api client + 503 backoff + error mapping"
  - "main.py: env-in / probe / HTTP transcribe / verbatim file-out / manifest.json (step_name=whisper) / exit codes"
  - "Unit suite (14 tests) against a mocked whisper-api — no live service required"
affects: [15-02-orchestrator-compose-wiring, 15-03-validation-parity-retire-old-whisper]

# Tech tracking
tech-stack:
  added: ["requests>=2.31.0 (first HTTP client in the repo; greenfield)"]
  patterns:
    - "HTTP pipeline step: probe duration -> route sync/async -> write bare body verbatim -> manifest"
    - "503 QUEUE_FULL backoff (Retry-After, capped) + bounded async poll (POLL_TIMEOUT_S)"
    - "mock-whisper-api unit tests via unittest.mock on requests.post/get + monkeypatched subprocess"

key-files:
  created:
    - services/whisper-http-step/main.py
    - services/whisper-http-step/src/config.py
    - services/whisper-http-step/src/transcribe_http.py
    - services/whisper-http-step/src/schema.py
    - services/whisper-http-step/Dockerfile
    - services/whisper-http-step/requirements.txt
    - services/whisper-http-step/tests/test_transcribe_http.py
  modified: []

key-decisions:
  - "NO_AUDIO_STREAM now FAILS the step (vs legacy empty-transcript + exit 0) — behavior change flagged for 15-03 parity test"
  - "Used unittest.mock (not requests-mock) for the HTTP layer — no extra dev/runtime dependency"
  - "requests (sync) chosen over httpx for a one-shot blocking step (per 15-PATTERNS recommendation)"

patterns-established:
  - "HTTP-client pipeline step: greenfield client built from the contract, returns bare body verbatim to preserve the file-based step contract"
  - "Injection-safe ffprobe duration probe ported from quality-finalizer/downscale.py"

requirements-completed: []

# Metrics
duration: ~12min
completed: 2026-05-23
---

# Phase 15 Plan 01: whisper-http-step Summary

**A Python HTTP-client pipeline step that externalizes transcription to the standalone whisper-api — probes input duration, routes sync `/transcribe` (≤120s) vs async `/jobs`+poll, and writes the bare `profile=reels` body verbatim to `transcript.json`, preserving the file-based step contract (STEP_NAME stays `whisper`) so every downstream step is untouched.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-05-23T00:38Z
- **Tasks:** 3
- **Files created:** 9 (incl. 2 package `__init__.py`)

## Accomplishments

- New self-contained step container `services/whisper-http-step/` on `video-pipeline-base-python:latest` with NO GPU stanza (D-4 — the external service owns the GPU).
- `transcribe_http.py`: injection-safe ffprobe `probe_duration` + `transcribe_via_http` that pre-rejects oversize duration (D-6, no HTTP call), routes by `SYNC_THRESHOLD_S` (D-2), honors 503 `QUEUE_FULL` `Retry-After` capped at `MAX_QUEUE_RETRIES`, bounds the async poll by `POLL_TIMEOUT_S`, and maps every whisper-api error code to a `RuntimeError`.
- `main.py`: copies the quality-finalizer step skeleton; adds up-front `WHISPER_API_KEY` validation; writes the bare reels body verbatim and `manifest.json` with `step_name="whisper"`; any failure → error manifest + exit 1 (orchestrator-readable `PipelineStepError`).
- 14 unit tests against a MOCKED whisper-api (no live service) — all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold container shell** — `1efdae0` (feat)
2. **Task 2: Implement transcribe_http.py (TDD)** — `a995ac5` (test, RED) → `c5d8006` (feat, GREEN)
3. **Task 3: Implement main.py** — `0711cf1` (feat)

_Task 2 was TDD: failing mock-api tests committed first, then the implementation made them green. No refactor commit needed._

## Files Created/Modified

- `services/whisper-http-step/Dockerfile` — base-python image, no GPU, copies main.py + src/.
- `services/whisper-http-step/requirements.txt` — `pydantic` + `requests`; dev-deps note (tests use stdlib mock, no runtime test dep).
- `services/whisper-http-step/src/config.py` — `STEP_NAME="whisper"` (pinned) + D-2/D-3/D-6 constants (URL/KEY, thresholds, timeouts).
- `services/whisper-http-step/src/schema.py` — ported `Transcript`/`TranscriptSegment`/`TranscriptWord` pydantic models (contract reference for 15-03, D-5).
- `services/whisper-http-step/src/transcribe_http.py` — ffprobe probe + sync/async HTTP client + 503 backoff + error mapping.
- `services/whisper-http-step/main.py` — step entry: env read/validate, probe, transcribe, verbatim file-out, manifest, exit codes.
- `services/whisper-http-step/tests/test_transcribe_http.py` — 14 mock-api unit tests.
- `services/whisper-http-step/{src,tests}/__init__.py` — package files.

## Decisions Made

- **NO_AUDIO_STREAM fail-step (BEHAVIOR CHANGE — FLAGGED for 15-03):** The legacy `services/whisper/main.py` wrote an EMPTY transcript and exited 0 when the input had no audio stream. The new contract returns `400 NO_AUDIO_STREAM`, and this step adopts the contract's FAIL-THE-STEP semantics — it raises, producing an error manifest + exit 1 instead of an empty transcript. This is recorded in the `transcribe_http.py` module docstring and the `main.py` header. **15-03's parity test must NOT expect parity on the no-audio case** — old=empty/exit-0, new=fail/exit-1 is intentional and correct.
- **unittest.mock over requests-mock:** `requests-mock` is not installed in the environment; the plan permitted either. Using stdlib `unittest.mock` on `requests.post`/`requests.get` (and monkeypatched `subprocess.run` for ffprobe) keeps the test suite dependency-free.
- **`requests` (sync) chosen:** one-shot blocking step favors `requests` over `httpx` (per 15-PATTERNS recommendation). First HTTP client in the repo (greenfield).

## Deviations from Plan

None — plan executed exactly as written. The plan's verify commands reference `python`; this environment only exposes `python3`, so verifications were run with `python3` (no code impact — the Dockerfile `CMD ["python", ...]` runs inside the base-python image where `python` is on PATH).

## Issues Encountered

- `python` is not on the host PATH (only `python3`); verification commands were run with `python3`. No impact on the container, which uses `video-pipeline-base-python:latest` where `python` resolves.

## Threat Surface Scan

No new threat surface beyond the plan's `<threat_model>`. The mitigations there were implemented: injection-safe ffprobe list argv (T-15-01), API key read from env and never logged — error messages reference the variable name only (T-15-02), and bounded sync timeout + poll budget + 503 retry cap (T-15-03).

## Next Phase Readiness

- The step directory is complete and unit-tested but is **NOT yet referenced by the orchestrator or `docker-compose.yml`** — that wiring is **15-02** (swap `STEPS[0].image` to `reel-factory-whisper-http-step`, drop the GPU `DeviceRequests` block + `HF_HOME`, add `WHISPER_API_URL`/`WHISPER_API_KEY` + `host.docker.internal`; update `orchestrator.test.ts`).
- **15-03** validates against the live whisper-api (parity + e2e) and retires `services/whisper/`. It must account for the NO_AUDIO_STREAM behavior change flagged above.

## Self-Check: PASSED

All 7 source/test artifacts exist on disk; all 4 task commits (`1efdae0`, `a995ac5`, `c5d8006`, `0711cf1`) present in git history.

---
*Phase: 15-whisper-externalization*
*Completed: 2026-05-23*
