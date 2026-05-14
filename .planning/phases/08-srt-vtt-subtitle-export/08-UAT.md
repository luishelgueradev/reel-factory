---
status: partial
phase: 08-srt-vtt-subtitle-export
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md
started: 2026-05-14T03:10:00Z
updated: 2026-05-14T03:30:00Z
---

## Current Test

[testing paused — 3 items outstanding]

## Tests

### 1. Cold Start Smoke Test
expected: docker compose build srt-exporter completes without error. Container image exists.
result: pass

### 2. SRT File Generation
expected: Given transcript.json and silence-cuts.json input, the srt-exporter produces a valid .srt file with sequential cue numbers and comma-separated timestamps
result: blocked
blocked_by: pipeline
reason: "Requires real pipeline output (transcript.json, silence-cuts.json) to run through srt-exporter."

### 3. VTT File Generation
expected: Given the same inputs, produces a valid .vtt file with WEBVTT header and dot-separated timestamps
result: blocked
blocked_by: pipeline
reason: "Requires real pipeline output to run through srt-exporter."

### 4. Timestamp Remapping
expected: SRT/VTT timestamps are remapped to align with silence-processed video (not original timestamps)
result: blocked
blocked_by: pipeline
reason: "Requires real pipeline output to verify timestamp alignment."

## Summary

total: 4
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 3

## Gaps

[none]
