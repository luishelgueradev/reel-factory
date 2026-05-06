---
phase: 03-silence-detection-removal
plan: 02
subsystem: silence-cutter
tags: [ffmpeg, concat-demuxer, reset_timestamps, av-sync, hard-cut, stream-copy, ffprobe]

# Dependency graph
requires:
  - phase: 02-whisper-transcription
    provides: transcript.json schema with no_speech_prob, config pattern with D-XX references
  - phase: 03-silence-detection-removal
    provides: Plan 01 infrastructure (Dockerfile, config.py, silencedetect.py, cross_reference.py, schema.py)
provides:
  - FFmpeg concat demuxer hard-cut video assembly preserving A/V sync (SILC-02, SILC-03)
  - _compute_keep_segments inverse-of-cuts algorithm
  - main.py container entry point wiring full silence-cutter pipeline
  - Complete step output: output.mp4 + silence-cuts.json + manifest.json
affects: [04-vertical-rendering, 05-subtitle-rendering, 08-srt-export]

# Tech tracking
tech-stack:
  added: [ffmpeg-concat-demuxer, ffprobe-duration-query]
  patterns: [keep-segments-inverse-computation, concat-demuxer-with-reset-timestamps, stream-copy-fast-extraction]

key-files:
  created:
    - services/silence-cutter/src/cut_video.py
    - services/silence-cutter/main.py
  modified: []

key-decisions:
  - "Keep segments computed as inverse of silence cuts — clearer than specifying what to remove"
  - "Stream copy (-c copy) for both segment extraction and concatenation — no re-encoding, preserves quality"
  - "concat demuxer with reset_timestamps for A/V sync — avoids drift from naive filter_complex approaches"
  - "main.py follows whisper/main.py pattern exactly — env vars, steps, manifest, error handling"
  - "Empty cut_list case copies input to output rather than failing"

patterns-established:
  - "Keep-segment inverse computation: silence cuts → segments to preserve"
  - "FFmpeg concat demuxer with reset_timestamps for multi-segment A/V sync preservation"
  - "Step entry point pattern: env var parsing → validate → pipeline steps → write outputs + manifest"

requirements-completed: [SILC-02, SILC-03]

# Metrics
duration: 5min
completed: 2026-05-06
---

# Phase 3 Plan 2: Hard-Cut Assembly & Pipeline Wiring Summary

**FFmpeg concat demuxer hard-cut video assembly preserving A/V sync via reset_timestamps, and main.py entry point wiring detect → cross-reference → cut pipeline with output.mp4 + silence-cuts.json + manifest.json (SILC-02, SILC-03)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-06T12:12:44Z
- **Completed:** 2026-05-06T12:17:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Hard-cut video assembly removes silence using FFmpeg concat demuxer with reset_timestamps (SILC-02: hard cuts, SILC-03: A/V sync)
- Keep segments computed as inverse of silence cuts — clear, predictable segment extraction
- Stream copy (-c copy) preserves original quality and enables fast processing without re-encoding
- main.py wires full pipeline: get duration → detect silence → cross-reference → cut video → write outputs
- Complete step contract: INPUT_PATH + TRANSCRIPT_PATH → output.mp4 + silence-cuts.json + manifest.json
- SILENCE_MIN_DURATION env var override via config.SILENCE_MIN_DURATION_ENV (D-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create hard-cut video assembly module with A/V sync preservation** - `c72b46c` (feat)
2. **Task 2: Create main.py entry point wiring full silence-cutter pipeline** - `d337673` (feat)

## Files Created/Modified
- `services/silence-cutter/src/cut_video.py` - FFmpeg concat demuxer hard-cut assembly with reset_timestamps, keep-segment computation, stream copy, get_video_duration utility
- `services/silence-cutter/main.py` - Container entry point wiring detect → cross-reference → cut pipeline, env vars, manifest.json, error handling

## Decisions Made
- Keep segments computed as inverse of silence cuts rather than specifying what to remove — simpler mental model, naturally handles sequential cuts
- Stream copy (-c copy) for both segment extraction and concatenation — preserves original codec and quality, avoids re-encoding overhead
- concat demuxer with reset_timestamps chosen over filter_complex approaches — avoids cumulative A/V timestamp drift across segment boundaries
- main.py follows whisper/main.py pattern exactly for consistency across pipeline steps
- Empty cut_list handled gracefully by copying input to output (not raising an error)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Silence cutter container is now fully wired: Dockerfile → config → silencedetect → cross_reference → cut_video → main.py
- Ready for Plan 03-03 (validation/testing or integration testing)
- cut_video.py provides get_video_duration() for any module needing duration queries
- main.py produces the three standard output artifacts: output.mp4, silence-cuts.json, manifest.json
- SILENCE_MIN_DURATION env var override works via Docker Compose environment passthrough

## Self-Check: PASSED

- Both key files exist on disk: cut_video.py, main.py
- Both feature commits found in git log: c72b46c, d337673
- All 7 plan verification criteria verified: cut_silences, reset_timestamps, _compute_keep_segments, _concatenate_segments, whisper pattern, pipeline sequence, env var override

---
*Phase: 03-silence-detection-removal*
*Completed: 2026-05-06*