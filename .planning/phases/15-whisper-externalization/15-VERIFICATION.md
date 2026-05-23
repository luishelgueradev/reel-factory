---
phase: 15-whisper-externalization
verified: 2026-05-23T02:20:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 15: Whisper externalization Verification Report

**Phase Goal:** Replace the embedded `services/whisper` GPU container with HTTP calls to the standalone whisper-api, preserving the reels transcript.json contract drop-in and validating the highlight-sync drift fix end-to-end on a real mid-speech-cut clip.
**Verified:** 2026-05-23T02:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the contract)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Pipeline whisper step calls the external whisper-api and writes the bare reels body verbatim to `pipeline/{jobId}/whisper/transcript.json` (zero downstream change) | ✓ VERIFIED | `transcribe_http.py` returns `resp.json()` / `body["result"]` verbatim; `main.py:98-99` `json.dump(body, ...)` to OUTPUT_PATH; orchestrator STEP name kept `"whisper"`, OUTPUT_PATH `/data/pipeline/{jobId}/whisper/transcript.json` (orchestrator.ts:61-65); all downstream `TRANSCRIPT_PATH` refs still point at `whisper/transcript.json` (orchestrator.ts:81,105,143; compose:115,269) |
| 2 | Sync/async routing, auth, limits, error mapping honor locked decisions; all error codes fail the step via the manifest contract | ✓ VERIFIED | `transcribe_http.py:152-196` D-2 routing (≤120s `/transcribe`, else `/jobs`+poll); D-6 oversize pre-reject before any HTTP call (165-169); `X-API-Key` header (172); `_raise_http_error` for 401/400/413/500/job-failed; `_post_with_queue_retry` 503 backoff honoring Retry-After capped at MAX_QUEUE_RETRIES; NO_AUDIO_STREAM fails the step (no legacy empty-transcript path); `main.py` maps any exception → error manifest + exit 1. 14/14 transcribe unit tests pass |
| 3 | External whisper-api emits `timeline="original"` and the renderer's deterministic remap fires (legacy heuristic retired to fallback) | ✓ VERIFIED | `/home/luis/proyectos/whisper/app/transcript.py:76` `timeline: str = "original"`, committed @ `00bceb2` (in history). Renderer consumer `captions.ts:242-252 shouldSkipSilenceRemap`: `timeline === "original" → false → apply remap` (deterministic); `areTimestampsAlreadyRemapped` heuristic only reached when marker absent (line 252). E2E: `timestamps_already_remapped=false`, `silence_cuts_applied=8` → deterministic path fired (15-03-e2e-parity-result.json) |
| 4 | Highlight-vs-audio sync holds on the back half of a mid-speech-cut clip (Spike 001 drift repro closed) | ✓ VERIFIED | E2E on `videos/video-1.mp4` (54.65s→36.73s, 8 mid-speech cuts, cumulative shift up to 14.48s). Human-verify checkpoint executed and APPROVED (15-03-SUMMARY: user confirmed back-half highlights synchronized). Parity: 76=76 words, max per-word delta 0.000s, 0 out of tolerance, no_speech_prob on all words (15-03-e2e-parity-result.json). NOT a pending human item — checkpoint already passed |
| 5 | Embedded `services/whisper` container retired after parity + e2e pass | ✓ VERIFIED | `test -d services/whisper` → absent; `git rm` commit `266c0ef` in history; docker-compose has no `./services/whisper` build context (only `./services/whisper-http-step`) and no `reel-factory-whisper:latest`; `docker compose config` parses cleanly. Deletion gated behind the approved human checkpoint (D-5) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `services/whisper-http-step/main.py` | Entry: env read/validate, ffprobe gate, HTTP transcribe, manifest, exit codes | ✓ VERIFIED | Validates INPUT/OUTPUT/JOB_ID/API_KEY; probes duration; routes; writes verbatim body + `_write_manifest` (step_name="whisper"); exit-code mapping present |
| `services/whisper-http-step/src/transcribe_http.py` | Duration probe + sync/async client + error mapping + 503 backoff | ✓ VERIFIED | `probe_duration` (list argv, injection-safe), `transcribe_via_http`, `_post_with_queue_retry`, `_poll_job`, `_raise_http_error` all substantive |
| `services/whisper-http-step/src/config.py` | STEP_NAME=whisper + URL/KEY + thresholds | ✓ VERIFIED | `STEP_NAME="whisper"`, WHISPER_API_URL/KEY env-sourced, SYNC_THRESHOLD_S=120 (D-2), MAX_DURATION_S=600 (D-6), MAX_QUEUE_RETRIES=2 |
| `services/whisper-http-step/Dockerfile` | base-python image, no GPU | ✓ VERIFIED | `FROM video-pipeline-base-python:latest`; no GPU stanza |
| `services/whisper-http-step/requirements.txt` | pydantic + requests | ✓ VERIFIED | both pinned (>=) |
| `services/whisper-http-step/tests/test_transcribe_http.py` | mock-api unit tests | ✓ VERIFIED | 14 tests pass (sync/async/503/error/gate/oversize) |
| `services/whisper-http-step/src/parity.py` | parity comparator (stdlib-only, survives retirement) | ✓ VERIFIED | word-count tolerance, ±0.15s per-word, no_speech_prob required, model allowed to differ; 6 parity tests pass |
| `services/api-server/src/orchestrator.ts` | Swapped whisper STEP + removed GPU DeviceRequests | ✓ VERIFIED | image `reel-factory-whisper-http-step`, name `"whisper"` kept, HF_HOME dropped, WHISPER_API_URL/KEY added; zero `DeviceRequests`/`HF_HOME`/`nvidia` in file |
| `docker-compose.yml` | HTTP-step whisper service + host reachability + api-server key env | ✓ VERIFIED | whisper service builds `./services/whisper-http-step`, no deploy/gpu stanza, `extra_hosts: host.docker.internal:host-gateway`, WHISPER_API_URL/KEY on both whisper and api-server services |
| `/home/luis/proyectos/whisper/app/transcript.py` | timeline marker on reels contract | ✓ VERIFIED | `timeline: str = "original"` at line 76, committed @ 00bceb2 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| main.py | transcribe_http.py | `from src.transcribe_http import probe_duration, transcribe_via_http` | ✓ WIRED | import + both functions called (main.py:34,90,95) |
| main.py | orchestrator manifest reader | manifest.json step_name/status/exit_code/error_message | ✓ WIRED | `_write_manifest` writes all fields next to OUTPUT_PATH |
| orchestrator.ts | reel-factory-whisper-http-step image | STEPS[0].image swap | ✓ WIRED | line 62 |
| docker-compose whisper | host whisper-api:8000 | WHISPER_API_URL + extra_hosts host-gateway | ✓ WIRED | compose:62-67 |
| docker-compose api-server | orchestrator process.env.WHISPER_API_KEY | environment WHISPER_API_KEY | ✓ WIRED | compose:246-247; orchestrator.ts:71 reads process.env.WHISPER_API_KEY |
| external transcript.py Transcript model | reels body via model_dump | pydantic default field | ✓ WIRED | field default serializes automatically (no inference.py change needed) |
| transcript.json timeline=original | renderer deterministic remap (captions.ts) | shouldSkipSilenceRemap reads timeline | ✓ WIRED | captions.ts:249-250 marker-first decision |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| transcript.json | `body` | live whisper-api `/transcribe` or `/jobs` result | Yes — e2e run returned 76 real words w/ no_speech_prob; parity max delta 0.000s | ✓ FLOWING |
| captions remap decision | `transcript.timeline` | external whisper-api default field | Yes — `"original"` present in new-path transcript; deterministic path fired (cuts=8, already_remapped=false) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| whisper-http-step unit suite | `python3 -m pytest -q` | 20 passed | ✓ PASS |
| orchestrator suite | `npx vitest run src/orchestrator.test.ts` | 13 passed | ✓ PASS |
| api-server type-check (no new errors) | `npx tsc --noEmit` | 20 errors, all pre-existing baseline (manifest.js module-resolution, Dockerode namespace, route/test typing) — none from the whisper swap | ✓ PASS |
| compose parses | `docker compose config` | PARSES OK | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` declared for this phase; validation is the contract §6 plan, executed via the unit suites + e2e/parity run above. N/A.

### Requirements Coverage

No formal REQUIREMENTS.md IDs for this v1.2 single infra phase (per phase context). Acceptance bar = contract §6 validation plan + ROADMAP goal + locked decisions D-2/D-3/D-5/D-6. All four §6 items satisfied: (1) contract test — parity.py + schema.py reference; (2) drift repro — e2e human-verified; (3) parity test — 76=76, 0.000s; (4) end-to-end — full pipeline ran on HTTP step. No traceability gap flagged (as instructed).

### Anti-Patterns Found

None. No TBD/FIXME/XXX/HACK/PLACEHOLDER/TODO markers in any modified or created file (main.py, transcribe_http.py, config.py, parity.py, orchestrator.ts, docker-compose.yml).

### Deferred / Out-of-Scope (NOT Phase 15 gaps)

Two pre-existing render-path issues surfaced during the Task 2 UAT, documented in 15-03-SUMMARY §"Deferred / out-of-scope" (lines 102-116). Both are confirmed DOCUMENTED (not fixed, not required to be fixed for this phase) and are NOT whisper regressions — parity passed and the transcript is correct:
- **Issue A — studio config not applied** (`ACTIVE_PIPELINE_CONFIG_PATH` never populated; v1.1 producer-side config-seeding gap). Render-path bug, independent of whisper.
- **Issue B — subtitle flicker** (inter-page fade gaps + FADE timings; amplified by Issue A's tiktok-layout fallback). Renderer caption-paging bug, independent of whisper.

These do not downgrade the verdict.

### Human Verification Required

None pending. The phase's only human checkpoint (15-03 Task 2 visual back-half sync) was already executed and APPROVED during phase execution — its evidence is recorded in 15-03-e2e-parity-result.json and 15-03-SUMMARY. It is a closed, passed checkpoint, not an open verification item.

### Gaps Summary

No gaps. The embedded GPU whisper container is fully replaced by the thin HTTP-client step; STEP name, OUTPUT_PATH, and all downstream TRANSCRIPT_PATH references are byte-identical so the file-based contract is drop-in (zero downstream change). Routing/auth/limits/error-mapping honor the locked decisions and all unit tests pass. The external whisper-api emits `timeline="original"` and the renderer's deterministic remap path is confirmed firing in a live 8-mid-speech-cut e2e run with old-vs-new parity at 0.000s max delta and human-confirmed back-half sync. `services/whisper/` is retired behind the approved human gate. All 5 ROADMAP success criteria and all 4 contract §6 validation items are satisfied.

---

_Verified: 2026-05-23T02:20:00Z_
_Verifier: Claude (gsd-verifier)_
