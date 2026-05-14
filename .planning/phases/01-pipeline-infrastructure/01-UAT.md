---
status: complete
phase: 01-pipeline-infrastructure
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md
started: 2026-05-14T00:00:00Z
updated: 2026-05-14T02:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running containers. Start the application from scratch with `docker compose up --build`. The base-python and base-node images build successfully, and `docker compose ps` shows services running without errors.
result: pass

### 2. Shared Volume I/O
expected: An MP4 file placed in the shared Docker volume is accessible by a processing container via INPUT_PATH environment variable. A container can write output to OUTPUT_PATH on the shared named volume and the file appears on the host.
result: pass

### 3. Pipeline Extensibility
expected: A new container step can be added to docker-compose.yml and the pipeline sequence without modifying existing step container configurations. The smoke-test service was added without changes to other services.
result: pass

### 4. Step Contract Validation
expected: The smoke-test container reads INPUT_PATH, copies the input file to OUTPUT_PATH, and writes a manifest.json with step_name, status, timestamp, input_file, output_files, and duration_seconds fields.
result: pass

### 5. FFmpeg Version Consistency
expected: FFmpeg --version returns 7.1.1 (the pinned version) across all containers in the pipeline (base-python and base-node). The .env FFMPEG_VERSION matches the actual installed version.
result: issue
reported: "Both containers show ffmpeg version N-124445-g22d06b39ce-20260513 (BtbN nightly), not the pinned 7.1.1. Both Dockerfiles download from 'ffmpeg-master-latest-linux64-gpl.tar.xz' instead of a version-pinned URL. Versions are consistent between containers but not pinned as required."
severity: major

### 6. E2E Smoke Test Script
expected: Running `./scripts/smoke-test.sh` validates all 5 PIPE requirements with pass/fail reporting for each check (shared volume I/O, step contract, manifest generation, extensibility, FFmpeg version consistency).
result: pass

### 7. Intermediate Artifacts Inspectable
expected: The smoke-test container writes an intermediate analysis.json artifact that is visible as a file on the shared volume, demonstrating that intermediate outputs from any step are inspectable.
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "FFmpeg --version returns 7.1.1 (the pinned version) across all containers"
  status: failed
  reason: "User reported: Both containers show ffmpeg version N-124445-g22d06b39ce-20260513 (BtbN nightly), not the pinned 7.1.1. Both Dockerfiles download from 'ffmpeg-master-latest-linux64-gpl.tar.xz' instead of a version-pinned URL. Versions are consistent between containers but not pinned as required."
  severity: major
  test: 5
  artifacts: []
  missing: []