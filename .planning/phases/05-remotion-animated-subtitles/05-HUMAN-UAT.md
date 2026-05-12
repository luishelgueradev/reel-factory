---
status: complete
phase: 05-remotion-animated-subtitles
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md
started: "2026-05-11T23:30:00Z"
updated: "2026-05-12T00:30:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. Double-Remap Fix — Word-by-Word Highlight
expected: Subtitles animate word-by-word with the currently spoken word highlighted (yellow). Highlighting stays in sync with audio throughout the entire video — no progressive drift where words highlight earlier/later than they should.
result: pass

### 2. Subtitle Position in 9:16 Safe Zone
expected: Subtitles appear in the lower portion of the 9:16 frame, above the bottom safe zone margin. Text does not overlap the very bottom edge or get cut off.
result: issue
reported: "los subtitulos deben ir mas arriba, quiero que esa posicion sea configurable en el .env tambien"
severity: minor

### 3. Lowercase Subtitle Style
expected: Subtitle text appears in lowercase (except sentence starts). No random capitalization from Whisper artifacts.
result: issue
reported: "tampoco deben tener mayusculas las palabras del principio de la frase, solo los nombres propios. Si crees que incluso es mejor que todo este en minusculas, que asi sea"
severity: minor

### 4. Output Video is 9:16 with Burned-In Subtitles
expected: The rendered output video is 1080x1920 pixels (9:16) with subtitle text burned into the video frames — not as a separate subtitle track.
result: pass

### 5. E2E Test Script Runs Standalone
expected: Running `bash scripts/test-remotion-renderer.sh` completes successfully with TEST_PASSED counters and exit code 0 (using --no-deps, no dependency chain failures).
result: issue
reported: "se clavo, esta frizado no avanza — container created but rendering hangs"
severity: blocker

### 6. Timestamp Detection Logging
expected: When remotion-renderer runs, it logs whether timestamps are on the "cut timeline" (already remapped) or "original timeline" (need remapping). remotion-info.json includes timestamps_already_remapped field.
result: pass

## Summary

total: 6
passed: 3
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Subtitle vertical position is configurable via .env and defaults higher than current position"
  status: failed
  reason: "User reported: los subtitulos deben ir mas arriba, quiero que esa posicion sea configurable en el .env tambien"
  severity: minor
  test: 2

- truth: "All subtitle text is lowercase (no capitalization at all, including sentence starts)"
  status: failed
  reason: "User reported: tampoco deben tener mayusculas las palabras del principio de la frase, solo los nombres propios. Si crees que incluso es mejor que todo este en minusculas, que asi sea"
  severity: minor
  test: 3

- truth: "E2E test script completes successfully with exit code 0"
  status: failed
  reason: "User reported: se clavo, esta frizado no avanza — container created but rendering hangs"
  severity: blocker
  test: 5