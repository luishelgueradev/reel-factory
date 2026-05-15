# TODO-001: Fix subtitle desync on long video VID_20260511_154125

**Priority:** High
**Created:** 2026-05-14
**Status:** Completed (2026-05-15)

## Problem

Video `VID_20260511_154125` (570MB, ~3:45 duration) has subtitles that drift out of sync with the audio. This is likely caused by cumulative timestamp drift in long videos — small per-silence-cut remapping errors compound over many cuts (12 cuts in this video).

## Evidence

- `pipeline/batch-VID_20260511_154125/` has all pipeline outputs
- 12 silence cuts detected and applied
- Video is the longest in the batch (~225s), giving the most opportunity for drift to become noticeable
- Shorter videos (10-120s) do NOT exhibit visible desync

## Hypothesis

The `remapTimestamps()` function in `services/remotion-renderer/src/captions.ts` uses `Math.round()` on each cumulative shift computation, and each silence cut's `cumulative_shift` is pre-computed by the silence-cutter. Over 12 cuts, rounding errors in the remapping could accumulate to noticeable drift (~0.5-1s) by the end of the video.

Another possibility: the video's audio track after silence-cutting has slightly different timing than the expected remapped timestamps, especially if FFmpeg's segment concatenation introduces small gaps.

## Action Items

1. **Quantify the drift**: Compare `caption-pages.json` token timestamps vs. the actual audio at multiple points (0s, 60s, 120s, 180s) in the output video
2. **Check cumulative_shift accuracy**: Verify that `silence-cuts.json` cumulative_shift values match actual time differences
3. **Investigate FFmpeg concat precision**: Check if `silence-cutter`'s segment concatenation introduces sub-frame timing gaps
4. **Consider double-remap detection**: Verify `areTimestampsAlreadyRemapped()` logic — for this video, is it correctly identifying original vs. remapped timestamps?
5. **Test fix**: Re-render with corrected timestamps and verify sync at beginning, middle, and end of video

## Resolution

Root cause: `remapTimestamps()` in `services/remotion-renderer/src/captions.ts` had an off-by-one bug where `cumulative_shift` was used alone for timestamps after a cut's `original_end`, but `cumulative_shift` only represents shift from PREVIOUS cuts (not including the current cut's duration). This caused progressive drift — each silence cut added one more unaccounted duration to the total shift error.

Fix applied (Option A): When the timestamp falls after a cut's `original_end`, the full shift is computed as `cumulative_shift + cut.duration` instead of `cumulative_shift` alone. This preserves backward compatibility with existing silence-cuts.json data.

Verified: All 21 unit tests pass including a regression test that validates the multi-cut drift scenario. Debug session: `.planning/debug/subtitle-sync-progressive-drift.md`.

##Related Files

- `services/remotion-renderer/src/captions.ts` — `remapTimestamps()`, `remapWordTimestamps()`, `areTimestampsAlreadyRemapped()`
- `services/silence-cutter/` — silence detection and cut generation
- `pipeline/batch-VID_20260511_154125/whisper/transcript.json` — whisper transcript
- `pipeline/batch-VID_20260511_154125/silence-cutter/silence-cuts.json` — 12 silence cuts
- `pipeline/batch-VID_20260511_154125/remotion-renderer/caption-pages.json` — remapped captions