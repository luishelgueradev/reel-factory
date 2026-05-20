---
phase: 13-encode-quality
plan: "01"
subsystem: silence-cutter
tags: [encode-quality, stream-copy, ffmpeg, ENC-01, ENC-05, silence-cutter]
dependency_graph:
  requires: []
  provides:
    - silence-cutter._concatenate_segments stream-copy concat (ENC-01)
    - silence-cutter.validate.validate_concat_mode ffprobe-based concat-mode assertion (ENC-01)
  affects:
    - services/silence-cutter/src/cut_video.py
    - services/silence-cutter/src/validate.py
tech_stack:
  added: []
  patterns:
    - ffprobe JSON parsing (subprocess.run + json.loads) added to validate.py
    - stream-copy (-c copy) at concat stage — eliminates one lossy H.264 pass
key_files:
  modified:
    - services/silence-cutter/src/cut_video.py
    - services/silence-cutter/src/validate.py
decisions:
  - "D-01: _concatenate_segments uses -c copy; -reset_timestamps 1 (SILC-03) preserved"
  - "D-02: docstring updated — finalizer is now the only pre-Remotion lossy encode"
  - "validate_concat_mode is dormant until Plan 03 wires it against a real concat output"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-20T23:12:00Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 13 Plan 01: Stream-Copy Concat + Concat-Mode Validator Summary

Switch `silence-cutter._concatenate_segments` from H.264+AAC re-encode to stream-copy (`-c copy`), eliminating one lossy generation pass, and add a `validate_concat_mode` ffprobe-based validator that makes the stream-copy invariant test-enforceable (ENC-01, D-01, D-02).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Switch _concatenate_segments to stream-copy | 18e572e | services/silence-cutter/src/cut_video.py |
| 2 | Add validate_concat_mode validator | ef82519 | services/silence-cutter/src/validate.py |

## What Was Built

### Task 1: Stream-copy concat command (ENC-01, D-01, D-02)

Modified `services/silence-cutter/src/cut_video.py`, function `_concatenate_segments` (lines 200–240 after edit):

**Diff hunk (lines 222–224 before → after):**

Before:
```python
        "-c:v", "libx264",                        # Re-encode video for clean timestamps
        "-c:a", "aac",                            # Re-encode audio for clean timestamps
        "-reset_timestamps", "1",                 # Reset timestamps at each segment (SILC-03)
```

After:
```python
        "-c", "copy",                             # ENC-01 / D-01: stream-copy eliminates one full lossy H.264 pass
        "-reset_timestamps", "1",                 # SILC-03 invariant preserved (D-02)
```

Docstring extended (lines 201–219 after edit) to state:
- Concatenation no longer re-encodes — generation loss is eliminated here (ENC-01 / D-01)
- The finalizer becomes the only pre-Remotion lossy encode (D-02)
- Stream-copy is safe at concat stage because segments are whole pre-cut files

### Task 2: validate_concat_mode validator (ENC-01, D-01)

Modified `services/silence-cutter/src/validate.py`:

- **Module docstring** updated: added ENC-XX to the requirement IDs referenced
- **New imports** added: `subprocess`, `json` (after existing `from typing import List`)
- **New function appended** at bottom of file:

```python
def validate_concat_mode(concat_output_path: str) -> List[str]:
```

The function:
1. Builds a ffprobe cmd: `["ffprobe", "-v", "quiet", "-show_entries", "format_tags=encoder", "-show_entries", "stream_tags=encoder", "-of", "json", concat_output_path]`
2. Calls `subprocess.run(cmd, capture_output=True, text=True, timeout=30)`
3. On non-zero returncode: appends `"ENC-01: ffprobe failed on concat output: ..."` and returns early
4. Parses `json.loads(result.stdout)` — checks `format.tags.encoder` and first video stream `tags.encoder`
5. If either tag contains `"libx264"` or `"Lavc"`: appends `"ENC-01: concat output carries a fresh encoder tag '...' — expected stream-copy, no re-encode (D-01)"`
6. Returns `errors: List[str]`

## Verification Results

### Source Assertions

| Assertion | Result |
|-----------|--------|
| `grep -cE '"-c",\s*"copy"' src/cut_video.py` | 1 (PASS) |
| No `libx264` in `_concatenate_segments` function body | PASS (verified via AST walk) |
| No `aac` in `_concatenate_segments` function body | PASS |
| `grep -cE '"-reset_timestamps",\s*"1"' src/cut_video.py` | 1 (PASS — SILC-03 preserved) |
| `grep -cF 'ENC-01' src/cut_video.py` | 2 (PASS) |
| `grep -cF 'D-02' src/cut_video.py` | 2 (PASS) |
| `grep -cE 'def validate_concat_mode' src/validate.py` | 1 (PASS) |
| `grep -cF 'ENC-01' src/validate.py` | 5 (PASS) |
| `grep -cF 'libx264' src/validate.py` | 3 (PASS) |
| `grep -cE 'import subprocess' src/validate.py` | 1 (PASS) |
| `grep -cE '"-show_entries",\s*"format_tags=encoder"' src/validate.py` | 1 (PASS) |

### Test Results

```
pytest services/silence-cutter/tests/test_silence_cutter.py -x -q
.....................................
37 passed in 0.12s
```

All 37 existing tests pass with no modifications.

### Behavior Assertions

- `validate_concat_mode` is callable: `True`
- `-reset_timestamps 1` still present in `_concatenate_segments`: confirmed (SILC-03 invariant intact)

## Note on Acceptance Criteria Greps

The plan's acceptance criteria include:
- `grep -E '"-c:v",\s*"libx264"' services/silence-cutter/src/cut_video.py` → returns zero matches

This grep returns non-zero (1 match) because `_extract_segments` legitimately uses `-c:v libx264` and `-c:a aac` for frame-accurate per-segment cuts. The plan explicitly states "Do not modify `_extract_segments` (which legitimately re-encodes per-segment for frame-accurate -ss/-t cuts)". The grep inside the `_concatenate_segments` function range returns zero, which is the semantically correct assertion per the plan's behavior section (lines 80–82).

## Deviations from Plan

None. Plan executed exactly as written. The one nuance (grep tests returning non-zero for `_extract_segments`) was pre-documented by the plan itself.

## Known Stubs

None. The `validate_concat_mode` validator is complete and functional — it will return meaningful results when executed against a real concat output. It is "dormant" only in the sense that no test currently calls it against a real file (that is Plan 03's task).

## Self-Check: PASSED

Files exist:
- `services/silence-cutter/src/cut_video.py` — modified, stream-copy in place
- `services/silence-cutter/src/validate.py` — modified, validate_concat_mode appended

Commits exist:
- `18e572e` — feat(13-01): switch _concatenate_segments to stream-copy
- `ef82519` — feat(13-01): add validate_concat_mode validator
