/**
 * Timestamp remapping functions for SRT/VTT subtitle export.
 * Adapted from services/remotion-renderer/src/captions.ts
 *
 * Per D-03: Copied from captions.ts rather than shared npm package.
 * These functions map original-video timestamps to the silence-removed timeline.
 */

import type { SilenceCutList, WhisperWord } from "./types";

/**
 * Tolerance in seconds for detecting whether timestamps are already on the
 * silence-removed timeline.
 */
export const DETECTION_TOLERANCE_SEC = 2.0;

/**
 * Remap a single timestamp from original video timeline to silence-removed timeline.
 *
 * Uses binary search through silence cuts (sorted by original_start) to find
 * the applicable shift. Three cases:
 *
 * 1. Timestamp BEFORE a cut's original_start → shift from prior cuts only.
 * 2. Timestamp INSIDE a cut (original_start <= time < original_end) → partial
 *    shift: cumulative_shift + (time - original_start).
 * 3. Timestamp AFTER a cut's original_end → full shift:
 *    cumulative_shift + cut.duration.
 *
 * Adapted from services/remotion-renderer/src/captions.ts
 */
export function remapTimestamps(originalTimeMs: number, silenceCuts: SilenceCutList | null): number {
  if (!silenceCuts) {
    return originalTimeMs;
  }
  const originalTimeSec = originalTimeMs / 1000;
  const cuts = silenceCuts.cuts;

  // Binary search: find the last cut where original_start <= originalTimeSec
  let left = 0;
  let right = cuts.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (cuts[mid].original_start <= originalTimeSec) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // left - 1 is the index of the last cut that starts before originalTimeSec
  const applicableCutIndex = left - 1;
  if (applicableCutIndex < 0) {
    return originalTimeMs; // Before any silence cut
  }

  const applicableCut = cuts[applicableCutIndex];

  // If timestamp falls AFTER the cut's original_end, add the cut's own duration
  // to the shift. cumulative_shift only includes shifts from PREVIOUS cuts.
  if (originalTimeSec >= applicableCut.original_end) {
    return originalTimeMs - Math.round((applicableCut.cumulative_shift + applicableCut.duration) * 1000);
  }

  // Timestamp is INSIDE the cut (original_start <= time < original_end).
  // Partial shift: shift by the elapsed portion of the silence so far.
  return originalTimeMs - Math.round((applicableCut.cumulative_shift + (originalTimeSec - applicableCut.original_start)) * 1000);
}

/**
 * Remap all word timestamps using silence cuts information.
 *
 * Per D-03: If silenceCuts is null or empty, returns words unchanged.
 *
 * Words that start inside a silence cut region are filtered/clipped:
 * - If word is entirely inside a cut → dropped (hallucination during silence)
 * - If word crosses cut boundary (start inside, end after) → start clipped to cut end
 *   Only kept if >=30% of word duration extends past the cut boundary.
 *
 * Adapted from services/remotion-renderer/src/captions.ts
 */
export function remapWordTimestamps(
  words: WhisperWord[],
  silenceCuts: SilenceCutList | null
): WhisperWord[] {
  if (!silenceCuts || silenceCuts.cuts.length === 0) {
    return words;
  }

  const cuts = silenceCuts.cuts;
  const result: WhisperWord[] = [];

  for (const w of words) {
    const insideCut = cuts.find(
      (c) => w.start >= c.original_start && w.start < c.original_end
    );

    if (insideCut) {
      const afterCutPortion = w.end > insideCut.original_end ? w.end - insideCut.original_end : 0;
      const totalDuration = w.end - w.start;
      const afterPct = totalDuration > 0 ? (afterCutPortion / totalDuration) * 100 : 0;

      if (afterPct < 30) {
        continue;
      }

      result.push({
        ...w,
        start: remapTimestamps(insideCut.original_end * 1000, silenceCuts) / 1000,
        end: remapTimestamps(w.end * 1000, silenceCuts) / 1000,
      });
    } else {
      result.push({
        ...w,
        start: remapTimestamps(w.start * 1000, silenceCuts) / 1000,
        end: remapTimestamps(w.end * 1000, silenceCuts) / 1000,
      });
    }
  }

  return result;
}

/**
 * Detect whether word timestamps are already on the silence-removed timeline.
 *
 * When Whisper runs on the already-cut video, timestamps are relative to the
 * cut video's duration, NOT the original. If we remap them again, we get
 * progressive drift.
 *
 * Detection heuristic: if max word.end <= new_duration + tolerance,
 * timestamps are from the cut video → return true (skip remap).
 *
 * Adapted from services/remotion-renderer/src/captions.ts
 */
export function areTimestampsAlreadyRemapped(
  words: WhisperWord[],
  silenceCuts: SilenceCutList | null
): boolean {
  if (!silenceCuts || silenceCuts.cuts.length === 0 || words.length === 0) {
    return false;
  }
  const maxWordEnd = Math.max(...words.map((w) => w.end));
  return maxWordEnd <= silenceCuts.new_duration + DETECTION_TOLERANCE_SEC;
}