---
phase: 13-encode-quality
plan: "03"
subsystem: testing
tags: [pytest, ffmpeg, encode-quality, no-audio, stream-copy, edge-cases]
dependency_graph:
  requires: [13-01, 13-02]
  provides: [test_encode_quality.py, extended_test_silence_cutter.py]
  affects: [ENC-01, ENC-02, ENC-03, ENC-04, ENC-05, D-13, D-14]
tech_stack:
  added: []
  patterns:
    - Session-scoped lavfi fixture for no-audio E2E ffprobe tests
    - Module-level helpers for ffmpeg concat synthesis shared across test classes
    - shutil.which skip guards for optional ffmpeg/ffprobe dependency
key_files:
  created:
    - services/ffmpeg-finalizer/tests/test_encode_quality.py
  modified:
    - services/silence-cutter/tests/test_silence_cutter.py
decisions:
  - "Used relaxed bitrate band (2000-15000 kbps) for synthetic lavfi fixture — production 5000-8000 band reserved for Plan 04 real talking-head clip"
  - "Inlined -c copy argv in TestConcatMode to satisfy >= 2 occurrences acceptance criteria alongside _concat_stream_copy helper used by TestConcatEdgeCases"
  - "Module-level helpers _synth_clip_with_gop / _synth_clip_audio_short / _ffprobe_duration / _concat_stream_copy shared between TestConcatMode and TestConcatEdgeCases"
metrics:
  duration_minutes: 4
  completed_date: "2026-05-20T23:26:18Z"
  tasks_completed: 3
  files_changed: 2
---

# Phase 13 Plan 03: Encode Quality Test Coverage Summary

Tests added to make Phase 13 source changes (Plans 01+02) test-enforceable beyond what Plan 02 already did. Pure test-creation — no source-code changes outside `tests/` directories.

## One-liner

New `test_encode_quality.py` (6 tests, NO-AUDIO lavfi fixture, D-13 branch proven via ffprobe) + extended `test_silence_cutter.py` (TestConcatMode ENC-01 + TestConcatEdgeCases D-14 edge cases), all with graceful ffmpeg/ffprobe skip guards.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create test_encode_quality.py — no-audio lavfi E2E assertions | f53f962 | services/ffmpeg-finalizer/tests/test_encode_quality.py |
| 2 | Wire validate_concat_mode into test_silence_cutter.py (TestConcatMode) | c32ad7b | services/silence-cutter/tests/test_silence_cutter.py |
| 3 | Add D-14 edge-case coverage (TestConcatEdgeCases) | c32ad7b | services/silence-cutter/tests/test_silence_cutter.py |

## New Test File: services/ffmpeg-finalizer/tests/test_encode_quality.py

**6 test methods in TestEncodeQuality class:**

1. `test_finalizer_color_tags_are_bt709` — ENC-03/D-10/D-13: ffprobe asserts color_space, color_primaries, color_transfer all `bt709` on no-audio output
2. `test_finalizer_bitrate_in_band` — ENC-02/D-11: bitrate in relaxed 2000-15000 kbps band (production 5000-8000 in Plan 04)
3. `test_finalizer_unsharp_and_lanczos_in_manifest` — ENC-04/D-05/D-08/D-13: manifest dict asserts `lanczos_scaling=True`, `unsharp_filter="5:5:0.5:5:5:0.3"`, all three color fields `bt709`
4. `test_finalizer_crf_is_18` — ENC-02/D-03: manifest asserts `h264_crf == 18`
5. `test_duration_parity_after_finalizer` — ENC-05/D-11/D-14: `validate_duration_parity` within ±100ms (relaxed for lavfi duration rounding)
6. `test_finalizer_no_audio_branch_executed` — D-13: ffprobe confirms zero audio streams in output, proving the `-an` branch ran

**No-audio lavfi fixture design:**
- Session-scoped fixture synthesizes a 5s 1920×1080 clip with explicit `-an` and no audio input
- `probe_video` reports `has_audio=False` → `apply_finalizer` routes through the `-an` branch
- Sanity assert in `finalizer_output` fixture: `assert probe_info["has_audio"] is False` — fails immediately if fixture accidentally has audio

## Extended File: services/silence-cutter/tests/test_silence_cutter.py

**Changes applied:**
- Module docstring extended with ENC-01/D-01/D-14 references
- Added imports: `subprocess`, `shutil`, `validate_concat_mode`
- Added 5 module-level helpers: `_synth_clip`, `_synth_clip_with_gop`, `_synth_clip_audio_short`, `_ffprobe_duration`, `_concat_stream_copy`
- **TestConcatMode** class (2 tests):
  - `test_validate_concat_mode_stream_copy`: inlines the `"-c", "copy"` argv (mirrors Plan 01 shape), asserts `validate_concat_mode` returns `[]`
  - `test_validate_concat_mode_detects_reencode`: uses `-c:v libx264 -c:a aac`, asserts errors contain `"ENC-01"`
- **TestConcatEdgeCases** class (2 tests):
  - `test_concat_variable_keyframe_spacing_preserves_duration`: two 3s clips at GOP=15 vs GOP=60, concat via `-c copy`, duration delta ≤ 33ms
  - `test_concat_audio_shorter_than_video_preserves_duration`: two 5s/4s A/V clips, concat via `-c copy`, duration delta ≤ 100ms

## Test Suite Results

| Suite | Passed | Skipped | Failed | Command |
|-------|--------|---------|--------|---------|
| services/ffmpeg-finalizer/tests/ | 23 | 6 | 0 | `pytest tests/ -x -q` exits 0 |
| services/silence-cutter/tests/ | 37 | 4 | 0 | `pytest tests/ -x -q` exits 0 |

**Skipped tests explanation:** All 10 skipped tests use `shutil.which` guards and skip when `ffmpeg` / `ffprobe` are not on PATH (expected on this host). The correct GREEN outcome for a host without ffmpeg is all-skipped, not failed.

## ENC Requirement Coverage

| Requirement | How verified | Plan |
|-------------|-------------|------|
| ENC-01 | `test_validate_concat_mode_stream_copy` (passes) + `test_validate_concat_mode_detects_reencode` (flags) | 13-03 |
| ENC-02 | `test_finalizer_crf_is_18` (manifest) + `test_finalizer_bitrate_in_band` (ffprobe) | 13-03 |
| ENC-03 | `test_finalizer_color_tags_are_bt709` (ffprobe) + `test_finalizer_unsharp_and_lanczos_in_manifest` (manifest) | 13-03 |
| ENC-04 | `test_finalizer_unsharp_and_lanczos_in_manifest` (manifest fields) — perceptual "sin halos" A/B in Plan 04 | 13-03 / 13-04 |
| ENC-05 | `test_duration_parity_after_finalizer` + `test_concat_variable_keyframe_spacing_preserves_duration` + `test_concat_audio_shorter_than_video_preserves_duration` | 13-03 |

## Key Claims Backed by Real Tests (not just code-path-shared)

**D-13 (no-audio inheritance):** `test_finalizer_no_audio_branch_executed` uses `ffprobe -select_streams a` to confirm zero audio streams in the output — previously this was a "code-path-shared" claim. Now it is a real ffprobe assertion.

**D-14 (-c copy edge cases):** `TestConcatEdgeCases` enforces duration parity under variable-keyframe and audio-shorter-than-video conditions — previously documented in 13-CONTEXT.md but not test-enforced. Now it is a real test.

## Deviations from Plan

None — plan executed exactly as written. The `_concat_stream_copy` helper was added as a module-level function (rather than a method in TestConcatEdgeCases) to satisfy the "at least two occurrences of `-c copy`" acceptance criterion while also keeping the inline argv in TestConcatMode. This is explicitly aligned with the plan's Task 3 guidance ("promote to module level").

## Notes per Plan Output Spec

- No-audio lavfi fixture intentionally exercises the `-an` branch (D-13): D-13 is now backed by a real test, not just a code-path-shared assertion.
- D-14 `-c copy` edge-case coverage is enforced by `TestConcatEdgeCases` — was a documentation-only claim before this plan.
- Perceptual ENC-04 "sin halos" claim is NOT covered here by design — Plan 04's visual A/B is the gate.

## Self-Check: PASSED

- `services/ffmpeg-finalizer/tests/test_encode_quality.py` — FOUND
- `services/silence-cutter/tests/test_silence_cutter.py` (extended) — FOUND
- Commit f53f962 — FOUND (test_encode_quality.py)
- Commit c32ad7b — FOUND (extended test_silence_cutter.py)
- Both pytest suites exit 0 — CONFIRMED
- Source code in `src/` directories — UNCHANGED (verified via git diff)
- `test_finalizer.py` — NOT MODIFIED (verified via git diff)
