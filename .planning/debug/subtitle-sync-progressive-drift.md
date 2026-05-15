---
status: resolved
trigger: Words dont sync with audio and progressive drift problem
created: "2026-05-08"
updated: "2026-05-15"
---

# Subtitle Sync — Progressive Drift

## Symptoms

- **Expected behavior:** Word-by-word subtitles highlight precisely when each word is spoken in the audio. Timing should match the audio track throughout the entire video.
- **Actual behavior:** Subtitles do not sync with audio. There is a progressive drift — subtitle timing gradually shifts further from the audio over time. Words may start approximately in sync but become increasingly misaligned as the video plays.
- **Error messages:** No errors. The render completes successfully but produces a video with misaligned subtitles.
- **Timeline:** Subtitle sync has never worked correctly since Phase 5 implementation.
- **Reproduction:** Full pipeline Docker run end-to-end with a real video.

## Current Focus

- **hypothesis:** CONFIRMED — `remapTimestamps` in `captions.ts` uses `cumulative_shift` incorrectly due to off-by-one in how cumulative_shift is stored vs used
- **next_action:** complete
- **reasoning_checkpoint:** Root cause identified, fix applied, all 21 tests pass including regression test

## Evidence

- 2026-05-08: Analyzed `cross_reference.py` lines 69-79 and `main.py` lines 136-146 — `cumulative_shift` is set BEFORE incrementing by current cut duration, so it represents shift from PREVIOUS cuts only, not including current cut
- 2026-05-08: `remapTimestamps` in `captions.ts` uses binary search to find last cut where `original_start <= originalTimeSec`, then subtracts that cut's `cumulative_shift` — but this misses the current cut's own duration for timestamps falling after `original_end`
- 2026-05-08: Concrete example with Cut 1 (start=3, end=5, duration=2, cumulative_shift=0) and Cut 2 (start=10, end=13, duration=3, cumulative_shift=2):
  - Word at 7s: remapped to 7-0=7s instead of 7-2=5s (2s drift)
  - Word at 15s: remapped to 15-2=13s instead of 15-5=10s (5s drift)
  - Drift grows with each silence cut — classic progressive drift
- 2026-05-08: Python's `_find_shift_at_time` in `remap_transcript.py` computes shift correctly via linear scan, independent of `cumulative_shift`
- 2026-05-08: `docker-compose.yml` passes `SILENCE_CUTS_PATH` to remotion-renderer, triggering the broken remap. `process.sh` intentionally omits it (line 55-56 comment: "Whisper runs on the cut video so timestamps already remapped"), which works around the bug but only by skipping remapping entirely

## Eliminated

- Double-remap: `areTimestampsAlreadyRemapped` detection logic is correct — it checks max word end vs new_duration + tolerance
- Python remap: `_find_shift_at_time` in `remap_transcript.py` is correct — linear scan that accumulates durations properly

## Resolution

### Root Cause

The `remapTimestamps()` function in `services/remotion-renderer/src/captions.ts` has a bug in how it applies `cumulative_shift` from silence cuts. The binary search finds the last cut where `original_start <= originalTimeSec`, but the `cumulative_shift` field in the SilenceCut data represents the total shift from all PREVIOUS cuts (not including the current cut's own duration). This means timestamps that fall between a cut's `original_end` and the next cut's `original_start` are shifted by one fewer silence duration than they should be, causing progressive drift that worsens with each silence cut in the video.

### Fix

**Applied: Option A** — Fix `remapTimestamps` to add current cut's duration when timestamp is after its original_end.

The fix was applied in `services/remotion-renderer/src/captions.ts` lines 122-126:
```typescript
if (originalTimeSec >= applicableCut.original_end) {
  return originalTimeMs - Math.round((applicableCut.cumulative_shift + applicableCut.duration) * 1000);
}
```

This correctly computes the full shift as `cumulative_shift + cut.duration` when the timestamp falls after a cut's `original_end`, because `cumulative_shift` represents shift from PREVIOUS cuts only.

**Verification:** All 21 unit tests pass, including the regression test `"remaps correctly across multiple cuts without progressive drift (regression)"` which validates the exact drift scenario from the bug report (Cut 1: 3-5s, Cut 2: 10-13s, verifying words at 2s/7s/9s/15s/20s remap correctly).

**File changed:** `services/remotion-renderer/src/captions.ts`
**Test file:** `services/remotion-renderer/src/captions.test.ts` (regression test added)

### specialist_hint: typescript