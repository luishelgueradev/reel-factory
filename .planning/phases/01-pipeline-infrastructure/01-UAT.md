---
status: testing
phase: 01-pipeline-infrastructure
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md
started: 2026-05-13T12:00:00Z
updated: 2026-05-13T20:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running containers. Start the application from scratch with docker compose up --build. The base-python and base-node images build successfully, the smoke-test container starts, and docker compose ps shows services running without errors.
result: pass

### 2. Shared Volume I/O
expected: An MP4 file placed in the shared Docker volume is accessible by a processing container via INPUT_PATH environment variable. A container can write output to OUTPUT_PATH on the shared named volume and the file appears on the host.
result: pass

### 3. Intermediate Artifacts Inspectable
expected: The smoke-test container writes an intermediate analysis.json artifact that is visible as a file on the shared volume, demonstrating that intermediate outputs from any step are inspectable.
result: pass

### 4. Pipeline Extensibility
expected: A new container step can be added to docker-compose.yml and the pipeline sequence without modifying existing step container configurations. Adding the smoke-test service required no changes to other services.
result: pass

### 5. FFmpeg Version Consistency
expected: FFmpeg --version returns the same pinned version (7.1.1) across all containers in the pipeline (base-python and base-node).
result: issue
reported: "both containers show ffmpeg version 7.0.2-static, not the expected 7.1.1. The .env has FFMPEG_VERSION=7.1.1 but the Dockerfiles download from the release tarball URL which yields 7.0.2 - the version env var is not actually used in the download URL"
severity: major

### 6. Step Contract Validation
expected: The smoke-test container reads INPUT_PATH, copies the input file to OUTPUT_PATH, and writes a manifest.json with step_name, status, timestamp, input_file, output_files, and duration_seconds fields.
result: pass

### 7. E2E Smoke Test Script
expected: Running scripts/smoke-test.sh validates all 5 PIPE requirements with pass/fail reporting for each check (shared volume I/O, step contract, manifest generation, extensibility, FFmpeg version consistency).
result: issue
reported: "scripts/smoke-test.sh does not exist - file referenced in SUMMARY as created but missing from disk"
severity: major

## Summary

total: 7
passed: 5
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "FFmpeg --version returns the same pinned version (7.1.1) across all containers"
  status: failed
  reason: "User reported: both containers show ffmpeg version 7.0.2-static, not the expected 7.1.1. The .env has FFMPEG_VERSION=7.1.1 but the Dockerfiles download from the release tarball URL which yields 7.0.0 - the version env var is not actually used in the download URL"
  severity: major
  test: 5
  artifacts: []
  missing: []

- truth: "scripts/smoke-test.sh exists and validates all 5 PIPE requirements"
  status: failed
  reason: "User reported: scripts/smoke-test.sh does not exist - file referenced in SUMMARY as created but missing from disk"
  severity: major
  test: 7
  artifacts: []
  missing: []