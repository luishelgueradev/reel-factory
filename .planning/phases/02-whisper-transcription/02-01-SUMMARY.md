---
phase: 02-whisper-transcription
plan: 01
subsystem: transcription
tags: [whisper, faster-whisper, whisperx, cuda, gpu, ffmpeg, docker, audio-extraction]

# Dependency graph
requires:
  - phase: 01-pipeline-infrastructure
    provides: base-python Docker image, docker-compose volume/network scaffold, smoke-test manifest pattern
provides:
  - Whisper container Dockerfile inheriting from video-pipeline-base-python
  - Python dependency specification (faster-whisper, whisperx, torch, ctranslate2)
  - Audio extraction module (MP4 → 16kHz mono WAV)
  - Docker Compose whisper service with GPU passthrough
  - Configuration constants mapped to CONTEXT.md decisions
affects: [03-silence-detection, 05-remotion-rendering]

# Tech tracking
tech-stack:
  added: [faster-whisper==1.2.1, ctranslate2==4.7.1, whisperx>=3.1.1, torch>=2.0.0, pydantic>=2.0.0, numpy>=1.24.0]
  patterns: [container-inherits-base-image, audio-extraction-ffmpeg-subprocess, config-constants-with-decision-traceability]

key-files:
  created:
    - services/whisper/Dockerfile
    - services/whisper/requirements.txt
    - services/whisper/src/__init__.py
    - services/whisper/src/config.py
    - services/whisper/src/audio_extraction.py
    - services/whisper/main.py
  modified:
    - docker-compose.yml

key-decisions:
  - "Dockerfile inherits FROM video-pipeline-base-python:latest — no FFmpeg re-install needed"
  - "requirements.txt pins whisperx minimum version (3.1.1+) instead of exact — PyPI distribution variability"
  - "main.py is placeholder for Plan 02-02 (transcription engine implementation)"
  - "start_period increased to 30s in healthcheck to accommodate Whisper model loading on first run"

patterns-established:
  - "Config constants with D-XX decision references: each constant maps to a CONTEXT.md decision for traceability"
  - "Audio extraction via FFmpeg subprocess with input validation and timeout"

requirements-completed: [TRAN-01]

# Metrics
duration: 4min
completed: 2026-05-06
---

# Phase 2 Plan 1: Whisper Container Infrastructure Summary

**Whisper container Dockerfile with CUDA dependencies, audio extraction module (MP4 → 16kHz mono WAV via FFmpeg), config constants mapped to CONTEXT.md decisions, and Docker Compose GPU passthrough service**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-06T01:20:09Z
- **Completed:** 2026-05-06T01:24:23Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Whisper container builds from video-pipeline-base-python with CUDA Python packages installed
- Audio extraction converts any MP4 to 16kHz mono WAV using FFmpeg subprocess (D-05, D-06)
- Docker Compose whisper service configured with nvidia GPU reservation and 30s healthcheck start_period
- All config constants trace back to CONTEXT.md decisions (D-02, D-03, D-05, D-10, D-11)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Whisper Dockerfile and requirements.txt with CUDA + Python dependencies** - `8c33357` (feat)
2. **Task 2: Create audio extraction module and Docker Compose whisper service** - `a9efe4f` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `services/whisper/Dockerfile` - Inherits from video-pipeline-base-python, installs Python deps from requirements.txt
- `services/whisper/requirements.txt` - Pins faster-whisper==1.2.1, ctranslate2==4.7.1, whisperx>=3.1.1, torch>=2.0.0, pydantic>=2.0.0, numpy>=1.24.0
- `services/whisper/src/__init__.py` - Empty init for Python package
- `services/whisper/src/config.py` - All CONTEXT.md decision constants with D-XX references
- `services/whisper/src/audio_extraction.py` - FFmpeg subprocess extracting MP4 → 16kHz mono WAV
- `services/whisper/main.py` - Placeholder entry point for Plan 02-02
- `docker-compose.yml` - Whisper service with GPU reservation, healthcheck, depends_on base-python

## Decisions Made
- Dockerfile inherits FROM video-pipeline-base-python:latest — base image already has FFmpeg 7.1.1 and Python 3.12, no need to re-install
- requirements.txt pins whisperx as minimum version (>=3.1.1) rather than exact — PyPI distribution variability across platforms
- main.py is minimal placeholder — full transcription logic will be implemented in Plan 02-02
- start_period set to 30s (vs 10s in template) — Whisper model loading takes significant time on first run

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

**NVIDIA GPU required for Whisper container.** The container requires CUDA/NVIDIA GPU at runtime (D-03). Ensure:
- Install NVIDIA Container Toolkit: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
- Docker Compose auto-configures GPU via `deploy.resources.reservations.devices`
- Container will fail with clear error if no GPU is available (no CPU fallback in v1)

## Next Phase Readiness
- Container infrastructure ready for Plan 02-02 (transcription engine implementation with whisperx/faster-whisper)
- Audio extraction module can be imported and used by main.py transcription logic
- Docker Compose whisper service can be built with `docker compose build whisper`
- GPU passthrough configured — container will auto-detect and use CUDA

## Self-Check: PASSED

- All 7 key files exist on disk: Dockerfile, requirements.txt, __init__.py, config.py, audio_extraction.py, main.py, docker-compose.yml
- 2 feature commits found in git log: 8c33357, a9efe4f
- 1 docs commit: 72d00a6
- All verification criteria from plan verified: FROM base-python, pinned deps, D-XX constants, 16kHz mono extraction, GPU reservation, healthcheck

---
*Phase: 02-whisper-transcription*
*Completed: 2026-05-06*