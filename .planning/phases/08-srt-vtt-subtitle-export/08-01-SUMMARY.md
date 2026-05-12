---
phase: 08-srt-vtt-subtitle-export
plan: 01
subsystem: subtitle-export
tags: [srt, vtt, subtitles, timestamps, whisper, remap, docker]

# Dependency graph
requires:
  - phase: 05-remotion-animated-subtitles
    provides: remapTimestamps(), remapWordTimestamps(), areTimestampsAlreadyRemapped() logic from captions.ts
  - phase: 03-silence-detection-removal
    provides: silence-cuts.json with cumulative_shift field
  - phase: 02-whisper-transcription
    provides: transcript.json with segments[] and words[]
provides:
  - srt-exporter service source code (Node.js)
  - generateSrt() and generateVtt() format generators
  - buildCuesFromTranscript() sentence-per-cue builder
  - remapTimestamps/remapWordTimestamps/areTimestampsAlreadyRemapped adapted from captions.ts
  - Comprehensive vitest test suite (40 tests)
affects: [08-srt-vtt-subtitle-export-plan-02, 09-pipeline-orchestration]

# Tech tracking
tech-stack:
  added: [typescript, vitest, tsx, node:22]
  patterns: [pipeline-step-contract, copy-rather-than-shared-package, sentence-per-cue-segmentation, binary-search-timestamp-remap]

key-files:
  created:
    - services/srt-exporter/package.json
    - services/srt-exporter/tsconfig.json
    - services/srt-exporter/src/types.ts
    - services/srt-exporter/src/timestamp-remap.ts
    - services/srt-exporter/src/formats.ts
    - services/srt-exporter/src/srt-export.ts
    - services/srt-exporter/src/__tests__/timestamp-remap.test.ts
    - services/srt-exporter/src/__tests__/formats.test.ts
  modified: []

key-decisions:
  - "D-03: Copied remapTimestamps logic from captions.ts rather than shared npm package"
  - "D-04: Sentence-per-cue grouping uses Whisper segments[] boundaries"
  - "D-05: Long segments (>10 words) split at nearest punctuation from midpoint"
  - "D-11: Output files are output.srt, output.vtt, and manifest.json"

patterns-established:
  - "Pipeline step contract: read env vars, load JSON inputs, write outputs + manifest.json"
  - "Copy-adapted modules from other services rather than shared packages (D-03)"
  - "SRT uses comma separator (HH:MM:SS,mmm), VTT uses dot separator (HH:MM:SS.mmm)"
  - "Long segment splitting searches outward from midpoint for punctuation marks"

requirements-completed: [SRTE-01]

# Metrics
duration: 13min
completed: 2026-05-12
---

# Phase 8 Plan 1: SRT/VTT Subtitle Export Service Summary

**SRT and VTT subtitle export service with timestamp remapping, sentence-per-cue segmentation, and 40 passing tests**

## Performance

- **Duration:** 13 min
- **Started:** 2026-05-12T19:40:05Z
- **Completed:** 2026-05-12T19:53:23Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created srt-exporter service scaffold with package.json, tsconfig.json, and TypeScript types mirroring Python schemas
- Adapted remapTimestamps, remapWordTimestamps, areTimestampsAlreadyRemapped from captions.ts (D-03: copy, not shared package)
- Implemented SRT format generator with sequential cue numbers and comma-separated timestamps (D-07)
- Implemented VTT format generator with WEBVTT header and dot-separated timestamps (D-08)
- Built sentence-per-cue segmentation using Whisper segments[] (D-04) with long segment splitting at punctuation (D-05)
- Words inside silence cuts excluded from output (D-06), SRT/VTT contain identical text (D-09)
- Main entrypoint (srt-export.ts) reads env vars, loads inputs, applies double-remap detection, writes output.srt/output.vtt/manifest.json
- 40 vitest tests passing (16 timestamp-remap + 24 formats)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create srt-exporter service scaffold and shared timestamp remapping module** - `a162f11` (feat)
2. **Task 2: Implement SRT and VTT format generators with cue segmentation** - `4470330` (feat)

## Files Created/Modified
- `services/srt-exporter/package.json` - Service definition with vitest, tsx, typescript dev deps
- `services/srt-exporter/tsconfig.json` - TypeScript config matching remotion-renderer pattern (ES2022, bundler resolution)
- `services/srt-exporter/src/types.ts` - SilenceCut, SilenceCutList, WhisperWord, WhisperTranscript, SrtCue, VttCue interfaces
- `services/srt-exporter/src/timestamp-remap.ts` - remapTimestamps (binary search), remapWordTimestamps (30% threshold filter), areTimestampsAlreadyRemapped detection
- `services/srt-exporter/src/formats.ts` - generateSrt, generateVtt, buildCuesFromTranscript, formatSrtTimestamp, formatVttTimestamp
- `services/srt-exporter/src/srt-export.ts` - Main entrypoint: env vars, input loading, double-remap detection, cue building, file output, manifest
- `services/srt-exporter/src/__tests__/timestamp-remap.test.ts` - 16 tests for timestamp remapping functions
- `services/srt-exporter/src/__tests__/formats.test.ts` - 24 tests for SRT/VTT format generators and cue building

## Decisions Made
- D-03: Copied remapTimestamps logic from captions.ts rather than creating a shared npm package — overhead of shared package not justified for a single function
- D-04: Sentence-per-cue grouping uses Whisper segments[] boundaries — each WhisperSegment becomes one cue
- D-05: Long segments (>10 words) split at nearest punctuation mark from midpoint — searches outward for comma, period, semicolon, exclamation, question mark
- D-11: Output files are output.srt, output.vtt, manifest.json following pipeline step naming convention

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed formatSrtTimestamp test expectation**
- **Found during:** Task 2 (format tests)
- **Issue:** Test expected 61730ms to format as "01:01:13,030" but 61730ms = 1min 1sec 730ms = "00:01:01,730"
- **Fix:** Corrected test expectation to "00:01:01,730"
- **Files modified:** services/srt-exporter/src/__tests__/formats.test.ts
- **Verification:** All 40 tests pass
- **Committed in:** 4470330 (Task 2 commit)

**2. [Rule 1 - Bug] Refactored long segment splitting algorithm**
- **Found during:** Task 2 (format tests)
- **Issue:** Character-position-based splitting algorithm failed to find correct word boundaries at punctuation marks because punctuation was embedded within words (e.g., "split,") rather than at separate character positions
- **Fix:** Replaced character-position search with word-array-based outward search from midpoint — finds words ending with punctuation marks instead of scanning character positions in the full text
- **Files modified:** services/srt-exporter/src/formats.ts
- **Verification:** Tests pass with long segment splitting test
- **Committed in:** 4470330 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes improved correctness. The splitting algorithm is now more robust for real Whisper output where punctuation is part of words (e.g., "split,"). No scope creep.

## Issues Encountered
None - both tasks completed cleanly after auto-fixing the splitting algorithm bug.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- srt-exporter service source code is complete and all tests pass
- Ready for Plan 02: Docker Compose integration (adding srt-exporter service to docker-compose.yml, Dockerfile, and end-to-end pipeline test)
- The service follows the established pipeline step contract pattern from render.ts

---
*Phase: 08-srt-vtt-subtitle-export*
*Completed: 2026-05-12*

## Self-Check: PASSED

- All 8 created files verified on disk
- Both task commits present in git log (a162f11, 4470330)
- All 40 tests pass (16 timestamp-remap + 24 formats)
- No accidental file deletions in either commit