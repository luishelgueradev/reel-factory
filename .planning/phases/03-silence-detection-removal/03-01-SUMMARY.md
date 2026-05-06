---
phase: 03-silence-detection-removal
plan: 01
subsystem: silence-detection
tags: [ffmpeg, silencedetect, pydantic, cross-reference, docker, cumulative-shift]

# Dependency graph
requires:
  - phase: 02-whisper-transcription
    provides: Whisper container infrastructure, transcript.json schema with no_speech_prob, config pattern with D-XX references
provides:
  - Silence cutter container Dockerfile inheriting from video-pipeline-base-python
  - FFmpeg silencedetect parsing module producing SilenceSegment candidates
  - Cross-reference engine merging FFmpeg silence with Whisper no_speech data (D-01/D-02/D-03)
  - silence-cuts.json Pydantic schema with cumulative_shift (D-07/D-08)
  - Docker Compose silence-cutter service with TRANSCRIPT_PATH env var
affects: [04-vertical-rendering, 05-subtitle-rendering, 08-srt-export]

# Tech tracking
tech-stack:
  added: [pydantic>=2.0.0 (silence-cutter), ffmpeg-silencedetect]
  patterns: [ffmpeg-cross-reference-intersection, cumulative-shift-timestamp-remapping, config-constants-with-decision-traceability]

key-files:
  created:
    - services/silence-cutter/Dockerfile
    - services/silence-cutter/requirements.txt
    - services/silence-cutter/src/__init__.py
    - services/silence-cutter/src/config.py
    - services/silence-cutter/src/silencedetect.py
    - services/silence-cutter/src/cross_reference.py
    - services/silence-cutter/src/schema.py
  modified:
    - docker-compose.yml

key-decisions:
  - "Dockerfile inherits FROM video-pipeline-base-python — no GPU needed (FFmpeg CPU-only)"
  - "SilenceSegment uses dataclass (intermediate type, not serialized artifact) while SilenceCut uses Pydantic (serialized to silence-cuts.json)"
  - "FFmpeg silencedetect runs first, then Whisper no_speech_prob confirms candidates (D-02: FFmpeg drives)"
  - "D-03 ANY-word threshold: single high no_speech_prob word confirms silence"
  - "D-06: 50ms SILENCE_CUT_PADDING is fixed constant, not configurable via env var"
  - "D-07: cumulative_shift enables trivial Phase 8 SRT remapping (new_ts = original_ts - cumulative_shift)"

patterns-established:
  - "Cross-reference intersection pattern: FFmpeg candidates → Whisper confirmation → confirmed cuts"
  - "Cumulative shift for timestamp remapping across pipeline phases"
  - "Config constants with D-XX decision traceability (continuing from whisper container pattern)"

requirements-completed: [SILC-01, SILC-04]

# Metrics
duration: 10min
completed: 2026-05-06
---

# Phase 3 Plan 1: Silence Cutter Infrastructure Summary

**Silence cutter container infrastructure, FFmpeg silencedetect parsing, cross-reference engine merging FFmpeg + Whisper data (D-01/D-02/D-03), and silence-cuts.json Pydantic schema with cumulative_shift (D-07/D-08)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-06T11:54:50Z
- **Completed:** 2026-05-06T12:05:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Silence cutter container builds from video-pipeline-base-python (CPU-only, no GPU)
- FFmpeg silencedetect module parses stderr output into SilenceSegment candidates with start/end/duration
- Cross-reference engine confirms FFmpeg silence candidates against Whisper no_speech_prob (D-01 intersection, D-03 ANY-word threshold)
- silence-cuts.json Pydantic schema includes cumulative_shift for Phase 8 SRT timestamp remapping
- SilenceSource enum tracks detection origin (both/ffmpeg/whisper) per D-01
- All config constants trace back to CONTEXT.md decisions (D-02, D-03, D-04, D-05, D-06)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create silence cutter container infrastructure and config** - `936c670` (feat)
2. **Task 2: Create FFmpeg silencedetect parsing module** - `7c3ac27` (feat)
3. **Task 3: Create cross-reference engine and silence-cuts.json Pydantic schema** - `eccf10e` (feat)

## Files Created/Modified
- `services/silence-cutter/Dockerfile` - Inherits FROM video-pipeline-base-python, CPU-only (no GPU)
- `services/silence-cutter/requirements.txt` - Minimal deps: pydantic only (no Whisper/torch)
- `services/silence-cutter/src/__init__.py` - Empty init for Python package
- `services/silence-cutter/src/config.py` - All silence detection config constants with D-XX traceability
- `services/silence-cutter/src/silencedetect.py` - FFmpeg silencedetect parsing into SilenceSegment candidates
- `services/silence-cutter/src/cross_reference.py` - Cross-reference engine: FFmpeg + Whisper confirmation (D-01/D-02/D-03)
- `services/silence-cutter/src/schema.py` - SilenceCut, SilenceCutList, SilenceSource Pydantic models
- `docker-compose.yml` - Added silence-cutter service depending on whisper with TRANSCRIPT_PATH

## Decisions Made
- SilenceSegment uses dataclass (intermediate/internal type) while SilenceCut uses Pydantic BaseModel (serialized artifact) — matching the pattern from whisper container
- FFmpeg silencedetect runs first for candidates, then Whisper no_speech_prob confirms via D-03 ANY-word threshold
- 50ms SILENCE_CUT_PADDING is a fixed constant (not env-var configurable) — deliberate design choice per D-06
- cumulative_shift in SilenceCut enables trivial Phase 8 SRT remapping: new_ts = original_ts - cumulative_shift
- Docker Compose silence-cutter has shorter start_period (15s vs 30s for whisper) — no model loading needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Silence cutter container infrastructure ready for Plan 03-02 (main.py entry point)
- silencedetect.py module can be imported and used by main.py for FFmpeg silence detection
- cross_reference.py module ready for consuming whisper transcript.json and confirming silence
- Docker Compose silence-cutter service configured with depends_on whisper, TRANSCRIPT_PATH, SILENCE_MIN_DURATION env vars
- Schema (silence-cuts.json) ready for Phase 5 (subtitle timestamp remapping) and Phase 8 (SRT generation)

## Self-Check: PASSED

- All 8 key files exist on disk: Dockerfile, requirements.txt, __init__.py, config.py, silencedetect.py, cross_reference.py, schema.py, docker-compose.yml
- 3 feature commits found in git log: 936c670, 7c3ac27, eccf10e
- All verification criteria verified: FROM base-python, pydantic deps, D-XX constants, silencedetect parsing, cross-reference D-01/D-02/D-03, schema cumulative_shift, docker-compose TRANSCRIPT_PATH

---
*Phase: 03-silence-detection-removal*
*Completed: 2026-05-06*