---
status: testing
phase: 03-silence-detection-removal
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md
started: 2026-05-06T14:33:18Z
updated: 2026-05-06T14:33:18Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running containers. Start the application from scratch with docker compose up --build. The base-python image builds, the silence-cutter container starts, and a basic health check (docker compose ps shows services running) succeeds without errors.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running containers. Start the application from scratch with docker compose up --build. The base-python image builds, the silence-cutter container starts, and a basic health check (docker compose ps shows services running) succeeds without errors.
result: [pending]

### 2. Silence Detection Pipeline Execution
expected: Run the silence-cutter container against a real MP4 input with a whisper transcript.json. The container produces output.mp4 (shorter than input), silence-cuts.json (valid JSON with confirmed cuts), and manifest.json (success status).
result: [pending]

### 3. A/V Sync Verification on Real Video
expected: Audio and video stay perfectly synchronized throughout the output video — no drift, no lag, no audio skipping ahead or behind.
result: [pending]

### 4. Cross-Reference Accuracy on Real Data
expected: silence-cuts.json contains only cuts with source: "both" (confirmed by both FFmpeg AND Whisper). No cuts have source "ffmpeg" or "whisper" alone in normal operation.
result: [pending]

### 5. Unit Tests Pass
expected: All 38 unit tests in services/silence-cutter/tests/ pass when running pytest inside the container or locally.
result: [pending]

### 6. E2E Docker Test Script
expected: Running scripts/test-silence-cutter.sh completes successfully, validating the full step contract from input through detection, cross-reference, cutting, to output artifacts.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]