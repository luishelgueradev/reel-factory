---
phase: 15-whisper-externalization
plan: 03
subsystem: infra
tags: [whisper, externalization, timeline-marker, parity, drift-repro, retirement, e2e]

# Dependency graph
requires:
  - phase: 15-01
    provides: "services/whisper-http-step/ container + parity comparator (parity.py) + schema reference"
  - phase: 15-02
    provides: "orchestrator + compose wired to whisper-http-step; GPU plumbing removed; host.docker.internal reachability"
provides:
  - "External whisper-api emits timeline=\"original\" on the reels contract (committed in /home/luis/proyectos/whisper @ 00bceb2)"
  - "Verified e2e: deterministic renderer remap fires (timestamps_already_remapped=false), back-half highlight sync correct on an 8-cut clip (human-verified)"
  - "Parity proven old-vs-new: 76=76 words, 0.000s max delta, no_speech_prob on all words, model whisperx-large-v3 both sides"
  - "services/whisper/ retired — pipeline runs end-to-end on the HTTP step only"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Producer-side timeline marker (external repo) + consumer-side shouldSkipSilenceRemap (already shipped) = deterministic remap, legacy maxWordEnd heuristic demoted to fallback"

key-files:
  created:
    - .planning/phases/15-whisper-externalization/15-03-SUMMARY.md
    - .planning/phases/15-whisper-externalization/15-03-e2e-parity-result.json
  modified:
    - services/srt-exporter/src/types.ts
    - services/silence-cutter/src/config.py
  deleted:
    - services/whisper/ (entire embedded GPU Whisper step — Dockerfile, main.py, requirements.txt, src/*, tests/*)

key-decisions:
  - "D-5 honored: services/whisper/ deleted ONLY after the human-verify checkpoint approved (parity + drift repro pass)"
  - "Timeline marker added in the EXTERNAL repo (/home/luis/proyectos/whisper @ 00bceb2), not reel-factory — the producer owns the contract; reel-factory's consumer support already shipped in the v1.1 sync fix"
  - "Two pre-existing render-path issues surfaced during UAT are OUT OF SCOPE for Phase 15 (deferred to a new phase) — they are NOT whisper regressions and do not affect transcript parity"

patterns-established:
  - "Externalization closeout: prove drop-in via numeric parity (word count + per-word timing tolerance + no_speech_prob, model allowed to differ) THEN retire the embedded service behind a human gate"

requirements-completed: []

# Metrics
duration: ~15min (continuation; excludes prior checkpoint wait)
completed: 2026-05-23
---

# Phase 15 Plan 03: timeline marker + e2e drift repro + parity + retire old whisper Summary

**Closed out the whisper externalization: the external whisper-api now emits `timeline: "original"` so the renderer's deterministic silence remap fires (legacy `maxWordEnd` heuristic demoted to fallback), an end-to-end run on an 8-mid-speech-cut clip proved back-half highlight-vs-audio sync (closing the deferred Spike 001 drift repro, human-verified), a parity test confirmed the new path is a true drop-in (76=76 words, 0.000s max delta), and the embedded `services/whisper/` GPU container was retired — the pipeline now runs entirely on the thin HTTP step.**

## Performance

- **Duration:** ~15 min (continuation agent; the human-verify checkpoint wait is excluded)
- **Completed:** 2026-05-23
- **Tasks:** 3 (Task 1 marker + parity comparator, Task 2 human-verify e2e, Task 3 retirement)

## Accomplishments

- **Timeline marker (Task 1):** Added `timeline: str = "original"` to the external whisper-api `Transcript` model (`/home/luis/proyectos/whisper/app/transcript.py:76`), matching the reel-factory reference schema exactly. Because the reels body is `filtered.model_dump()`, the field serializes automatically — no `inference.py` change. Committed in the external repo at **`00bceb2`** (`feat(reels): emit timeline="original" marker on Transcript contract`). The external repo's contract/shape tests pass with the new field.
- **Parity comparator (Task 1):** `services/whisper-http-step/src/parity.py` — stdlib-only (imports nothing from `services/whisper/`, so it survived the retirement), asserts word-count equality (within tolerance), per-word start/end within ±0.15s, `no_speech_prob` present on every word, and ALLOWS the model value to differ. The NO_AUDIO_STREAM behavior change (15-01) is intentionally excluded from parity.
- **E2E drift repro (Task 2 — human-verified):** Processed `videos/video-1.mp4` (54.65s source → 36.73s output, **8 mid-speech silence cuts**). The user confirmed the back-half highlights ARE synchronized with the audio ("parecieran estar sincronizados bien"). The deferred Spike 001 visual-drift repro is **CLOSED**.
- **Retirement (Task 3):** `git rm -r services/whisper/` (Dockerfile, main.py, requirements.txt, src/*, tests/*); pipeline now runs end-to-end on `reel-factory-whisper-http-step` only. `docker compose config` parses cleanly with no `./services/whisper` build context and no `reel-factory-whisper:latest` image. Re-pointed the two benign mirror-comments to `services/whisper-http-step/src/schema.py`.

## Validation Evidence (recorded: 15-03-e2e-parity-result.json)

| Check | Result |
|-------|--------|
| Clip | `videos/video-1.mp4` — 54.65s → 36.73s, 8 mid-speech cuts (up to 14.48s cumulative shift) |
| New run job | `c59d1234-6986-4c62-ba6e-7a84bf732a03` |
| Baseline (old-path) job | `24c4899d-6292-4751-9f5b-7bc75843923d` |
| `timeline` marker in new transcript | `"original"` |
| `no_speech_prob` on all new words | true |
| Renderer remap | `silence_cuts_applied: 8`, `timestamps_already_remapped: false` → **deterministic remap path fired** |
| Parity word count | old 76 = new 76 (delta 0) |
| Parity max time delta | **0.000s** |
| Words out of tolerance | 0 |
| Model (old / new) | `whisperx-large-v3` / `whisperx-large-v3` |
| Parity failures | none |

Combined with the human visual confirmation, the whisper externalization + highlight-sync drift fix are **VERIFIED**.

## Task Commits

1. **Task 1: timeline marker + parity comparator** — external repo `/home/luis/proyectos/whisper` @ `00bceb2` (marker); reel-factory `parity.py` shipped in 15-01. (No reel-factory commit in this plan for Task 1 — the marker lives in the external repo by design.)
2. **Task 2: human-verify e2e drift repro** — checkpoint, no code commit (validation only; evidence in `15-03-e2e-parity-result.json`).
3. **Task 3: retire services/whisper/** — `266c0ef` (chore).

## Files Created/Modified/Deleted

- **Deleted:** `services/whisper/` (entire embedded GPU Whisper step). All removed files were tracked; leftover `__pycache__`/`.pytest_cache` were untracked build artifacts cleared directly (no `git clean`).
- **Modified:** `services/srt-exporter/src/types.ts` (3 mirror-comments re-pointed to `whisper-http-step`), `services/silence-cutter/src/config.py` (1 comment re-pointed). Benign doc-comments only — zero build impact.
- **External (not reel-factory):** `/home/luis/proyectos/whisper/app/transcript.py` (+1 field, committed @ `00bceb2`).

## Deviations from Plan

None — plan executed exactly as written. The benign mirror-comments in `srt-exporter/types.ts` and `silence-cutter/config.py` were optionally re-pointed (the plan permitted leaving or re-pointing); re-pointing was chosen for cleanliness.

## Deferred / out-of-scope (new phase)

Two pre-existing render-path issues surfaced during the Task 2 UAT. **Neither is a whisper regression** (the new whisper produces a correct transcript and parity passed), so both are explicitly OUT OF SCOPE for Phase 15 and moved to a new dedicated phase. Documented here for traceability; NOT fixed in this plan and they did NOT block retirement.

### Issue A — Studio config not applied (config-seeding gap)

- **Symptom:** The renderer fell back to env defaults (layout `tiktok`, no titles) instead of the user's studio config (layout `bar`, font Inter, 2 titles).
- **Root cause:** `ACTIVE_PIPELINE_CONFIG_PATH` (`/data/pipeline/pipeline-config.json`) is never populated. The v1.1 config-threading wired the CONSUMER (`/process` seeds it) but not the PRODUCER — nothing writes the active config. This run also executed the steps manually (not via `/process`), compounding it.
- **Scope:** render-path / config-seeding bug, independent of whisper.

### Issue B — Subtitle flicker

- **Symptom:** Text fades out-to-nothing then back in ~15 times over 36s.
- **Root cause:** Caption pages have empty gaps (20–241ms) between every page, combined with `FADE_OUT_MS=300` / `FADE_IN_MS=100` — so each inter-page gap triggers a full fade-out/fade-in. Amplified by the wrong (`tiktok`) layout fallback from Issue A.
- **Scope:** renderer caption-paging / fade-timing bug, independent of whisper.

## Threat Surface Scan

No new threat surface beyond the plan's `<threat_model>`. Mitigations honored:
- **T-15-08 (loss):** Contract reference preserved in `services/whisper-http-step/src/schema.py` + `.planning/contracts/whisper-service-integration.md` BEFORE deletion; deletion gated behind the approved human checkpoint.
- **T-15-09 (tampering of external repo):** One-line additive default field only; external repo's contract tests pass — reels invariants untouched.
- **T-15-10 (DoS / down service):** N/A — the e2e run reached a live, healthy whisper-api (parity returned real data).

## Self-Check: PASSED

- `services/whisper/` confirmed absent (`test ! -d`).
- `docker compose config` parses; only `reel-factory-whisper-http-step` whisper service present; no `./services/whisper` build context, no `reel-factory-whisper:latest`.
- Task 3 commit `266c0ef` present in git history.
- External timeline marker `00bceb2` confirmed (field at `transcript.py:76`).
- Parity evidence recorded in `15-03-e2e-parity-result.json`.

---
*Phase: 15-whisper-externalization*
*Completed: 2026-05-23*
