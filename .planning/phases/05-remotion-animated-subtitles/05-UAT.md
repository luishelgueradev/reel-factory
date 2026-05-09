---
status: complete
phase: 05-remotion-animated-subtitles
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md]
started: 2026-05-08T12:00:00Z
updated: 2026-05-08T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Pipeline starts from scratch — remotion-renderer container boots, runs health check (manifest.json test), and completes without crash. Dependencies chain correctly: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer.
result: pass

### 2. Docker Compose Pipeline Order
expected: remotion-renderer service in docker-compose.yml has `depends_on` with ffmpeg-finalizer (condition: service_completed_successfully) ensuring correct pipeline order. Service starts only after ffmpeg-finalizer completes.
result: pass

### 3. Environment Variables Wired
expected: SILENCE_CUTS_PATH, FINALIZER_INFO_PATH, TRANSCRIPT_PATH, INPUT_PATH, and OUTPUT_PATH environment variables are configured in the remotion-renderer service. ACTIVE_COLOR defaults to #FFFF00 when not set. INACTIVE_COLOR defaults to #FFFFFF when not set.
result: pass

### 4. Chromium Flags for Docker
expected: remotion-renderer launches Chrome with --gl=angle-egl and --disable-gpu flags for stable Docker rendering. No GPU-related crashes during video render.
result: pass

### 5. Timestamp Remapping — Silence Cuts Applied
expected: When silence-cuts.json is present, remapTimestamps remaps word timestamps so subtitles appear at the correct time on the silence-removed timeline. Words that were at, say, 15s in the original video appear at their new position after silence removal.
result: pass

### 6. Timestamp Remapping — No Silence Cuts (Backward Compatible)
expected: When silence-cuts.json is missing or null, remapWordTimestamps returns original timestamps unchanged. The pipeline doesn't break — it gracefully falls back to no remapping.
result: pass

### 7. Safe Zone Positioning
expected: Subtitles are positioned using bottomOffset derived from finalizer-info.json safe_zone.bottom. If finalizer-info.json is missing or invalid, bottomOffset falls back to 250px. Subtitles don't overlap the bottom edge of the 9:16 frame.
result: pass

### 8. Word-by-Word TikTok-Style Animation
expected: Subtitles animate word-by-word. The currently spoken word is visually highlighted (yellow/ACTIVE_COLOR) with scale animation. Inactive words appear in white/INACTIVE_COLOR. Words appear in sync with the speaker's voice — no visible lag between audio and highlighted word.
result: issue
reported: "los subtitulos no se colorean palabra por palabra y a lo largo del video pierden la sincronizacion"
severity: major

### 9. Manifest and remotion-info.json Output Artifacts
expected: After rendering, the output directory contains manifest.json (with status "success") and remotion-info.json with fields: silence_cuts_applied (boolean), safe_zone_used (object with bottom_offset number), and bottom_offset (number). These artifacts are inspectable on the shared volume.
result: pass

### 10. Malformed JSON Graceful Handling
expected: If silence-cuts.json or finalizer-info.json contains invalid JSON, the renderer logs a warning and falls back to defaults (no silence cutting, 250px bottom offset). It does NOT crash.
result: pass

### 11. Validation Module (validate.ts)
expected: Running `npx tsx src/validate.ts <output_dir>` validates the remotion-renderer output artifacts. Returns empty array (no errors) for a correct output directory. Returns error arrays with SUBT-XX/D-XX requirement IDs for invalid output.
result: pass

### 12. E2E Docker Test Script
expected: Running `scripts/test-remotion-renderer.sh` creates synthetic test data, runs the remotion-renderer container via Docker Compose, validates output with validate.ts, and reports TEST_PASSED/TEST_FAILED counters. The script exits with 0 on success.
result: issue
reported: "test script failed because ffmpeg-finalizer dependency can't process synthetic video — needs --no-deps or standalone run"
severity: minor

### 13. 9:16 Vertical Output with Burned-In Subtitles
expected: The final output video from remotion-renderer is 1080x1920 pixels (9:16 aspect ratio) with subtitles burned into the video. The subtitle text is part of the video frames, not a separate subtitle track.
result: pass

## Summary

total: 13
passed: 11
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Subtitles animate word-by-word with correct highlighting and stay in sync with audio throughout the entire video"
  status: failed
  reason: "User reported: los subtitulos no se colorean palabra por palabra y a lo largo del video pierden la sincronizacion"
  severity: major
  test: 8
  root_cause: "DOUBLE REMAP BUG: process.sh runs Whisper on the already-cut video (silence-cutter → whisper), so timestamps are already in the silence-removed timeline. remapTimestamps then subtracts silence cuts AGAIN, causing progressive drift — later words get increasingly negative/early timestamps. This also corrupts createTikTokStyleCaptions grouping, producing pages with tokens where fromMs > toMs (e.g. Page 6 token 1: fromMs=14840 > toMs=7512), breaking word-by-word highlight detection. FIX: detect whether whisper timestamps are on original or cut timeline; if on cut timeline, skip remapTimestamps."
  artifacts:
    - path: "services/remotion-renderer/src/render.ts"
      issue: "applies remapTimestamps unconditionally — needs to detect if timestamps are already on cut timeline"
    - path: "services/remotion-renderer/src/captions.ts"
      issue: "remapWordTimestamps called unconditionally in transcriptToCaptionPages"
    - path: "process.sh"
      issue: "runs whisper on cut video but still passes silence-cuts.json to remotion-renderer"
  missing:
    - "Detect if transcript timestamps are on original or cut timeline (compare max timestamp vs input video duration)"
    - "Skip remapTimestamps when whisper already ran on cut video"
    - "Fix E2E test script to run remotion-renderer standalone (--no-deps)"

- truth: "E2E Docker test script runs successfully and reports TEST_PASSED/TEST_FAILED counters"
  status: failed
  reason: "test script failed because ffmpeg-finalizer dependency can't process synthetic video — needs --no-deps or standalone run"
  severity: minor
  test: 12
  root_cause: "scripts/test-remotion-renderer.sh runs docker compose run remotion-renderer which triggers depends_on: ffmpeg-finalizer. The synthetic test video doesn't have the silence-cutter output that ffmpeg-finalizer requires, causing the dependency chain to fail."
  artifacts:
    - path: "scripts/test-remotion-renderer.sh"
      issue: "docker compose run without --no-deps triggers ffmpeg-finalizer dependency which fails with synthetic data"
  missing:
    - "Add --no-deps flag to docker compose run in test script, or create the silence-cutter/output.mp4 symlink"