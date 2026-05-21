---
status: in_progress
phase: 13-encode-quality
source: 13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md
started: 2026-05-21T02:38:24Z
---

## Current Test

pending: visual A/B human verification (entry 5)

## Tests

### 1. ENC-01: silence-cutter concat output is stream-copied

expected: `pytest services/silence-cutter/tests/test_silence_cutter.py::TestConcatMode::test_validate_concat_mode_stream_copy -x -q` exits 0; `validate_concat_mode` returns [] on a real stream-copied concat output. Additionally, TestConcatEdgeCases proves `-c copy` preserves duration on variable-keyframe and audio-shorter-than-video inputs (D-14).
result: pass

### 2. ENC-02: finalizer encodes at CRF 18 with bitrate in production band

expected: `pytest services/ffmpeg-finalizer/tests/test_encode_quality.py::TestEncodeQuality::test_finalizer_crf_is_18 -x -q` and `::test_finalizer_bitrate_in_band -x -q` both exit 0; Plan 04 Task 3 awk gate (`ffprobe -v quiet -show_entries format=bit_rate -of default=nw=1:nk=1 .planning/phases/13-encode-quality/uat/phase-13.mp4 | awk '{kbps=$1/1000; exit !(kbps>=5000 && kbps<=8000)}'`) exits 0. Measured: 6,559 kbps on `pipeline/VID_20260518_114955/silence-cutter/output.mp4`.
result: pass

### 3. ENC-03: BT.709 metadata tags on finalizer output

expected: phase-13.mp4 reports `color_space=bt709`, `color_primaries=bt709`, `color_transfer=bt709` via ffprobe (asserted both by pytest and by the Task 3 CLI checks). baseline.mp4 also reports bt709 tags because the silence-cutter source already carried them (libx264 side-data propagation) — see BT.709 isolation note in `uat/README.md`. ENC-03 requirement ("Phase 13 output carries BT.709 metadata") is satisfied regardless.
result: pass

### 4. ENC-04 (mechanical): Lanczos + unsharp manifest fields

expected: `pytest services/ffmpeg-finalizer/tests/test_encode_quality.py::TestEncodeQuality::test_finalizer_unsharp_and_lanczos_in_manifest -x -q` exits 0. Manifest contains `flags=lanczos` in the scale vf argument and `unsharp=5:5:0.5:5:5:0.3` in the filter chain.
result: pass

### 5. ENC-04 (perceptual): NO visible halos in phase-13.mp4 vs baseline.mp4

expected: A human reviewer opens both files in mpv/VLC side-by-side per `.planning/phases/13-encode-quality/uat/README.md` and confirms: (a) phase-13 looks perceptibly sharper than baseline on skin texture, hair strands, and eye highlights; (b) no visible halos on high-contrast edges (eyeglass frames, jaw lines, text) in phase-13; (c) colors look correct and natural in phase-13 (monitor-dependent — see BT.709 isolation note); (d) both videos remain frame-synchronized when played simultaneously (ENC-05 cross-check).
result: pending

### 6. ENC-05: duration parity ±33ms

expected: `pytest services/ffmpeg-finalizer/tests/test_encode_quality.py::TestEncodeQuality::test_duration_parity_after_finalizer -x -q` exits 0; TestConcatEdgeCases (variable-keyframe + audio-shorter-than-video) exit 0; visual A/B shows no frame drift during simultaneous playback. Measured: both baseline.mp4 and phase-13.mp4 = 16.500 s (exact parity).
result: pass

## Summary

total: 6
passed: 5
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

- **Entry 5 (ENC-04 perceptual)** — Human visual verification of "sin halos perceptibles" is pending. Open both MP4s side-by-side per `uat/README.md` and reply with one of the documented resume signals (`approved`, `halos at <edge>`, `no sharpness gain`, `color identical`, `duration drift`). Once the verdict is received, entry 5 is updated and `status` flips to `complete`.
