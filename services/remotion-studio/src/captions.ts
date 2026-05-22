import { createTikTokStyleCaptions, type TikTokPage, type Caption } from "@remotion/captions";

// ─── TypeScript interfaces mirroring Python schemas ──────────────────────

// Mirror of services/silence-cutter/src/schema.py SilenceCut / SilenceCutList
interface SilenceCut {
  original_start: number;
  original_end: number;
  new_start: number;
  new_end: number;
  duration: number;
  source: "both" | "ffmpeg" | "whisper";
  cumulative_shift: number;
}

interface SilenceCutList {
  total_segments_removed: number;
  total_silence_removed: number;
  original_duration: number;
  new_duration: number;
  cuts: SilenceCut[];
}

// Mirror of services/ffmpeg-finalizer/src/schema.py SafeZone / FinalizerInfo
interface SafeZone {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface FinalizerInfo {
  input_width: number;
  input_height: number;
  input_aspect_ratio?: string;
  output_width: number;
  output_height: number;
  output_aspect_ratio?: string;
  crop_strategy?: string;
  crop_applied?: boolean;
  crop_x?: number;
  crop_y?: number;
  crop_width?: number;
  crop_height?: number;
  h264_crf?: number;
  h264_preset?: string;
  audio_normalization?: boolean;
  safe_zone: SafeZone;
  [key: string]: unknown;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  no_speech_prob: number;
}

interface WhisperTranscript {
  language: string;
  model: string;
  // Explicit declaration of which audio timeline word timestamps are on.
  // "original" → produced from the uncut audio; the renderer MUST apply the
  // silence remap. "silence-removed" → produced from the already-cut audio;
  // remap MUST be skipped. When absent (legacy transcripts), the renderer
  // falls back to the maxWordEnd heuristic (areTimestampsAlreadyRemapped).
  // The marker makes the decision deterministic and kills the heuristic's
  // mid-speech-cut drift bug. See .planning/contracts/whisper-service-integration.md.
  timeline?: "original" | "silence-removed";
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    words: WhisperWord[];
  }>;
  words: WhisperWord[];
  duration: number;
}

// ─── Timestamp remapping ────────────────────────────────────────────────

/**
 * Remap a single timestamp from original video timeline to silence-removed timeline.
 *
 * Uses binary search through silence cuts (sorted by original_start) to find
 * the applicable shift. The algorithm distinguishes three cases:
 *
 * 1. Timestamp BEFORE a cut's original_start → shift from prior cuts only.
 * 2. Timestamp INSIDE a cut (original_start <= time < original_end) → partial
 *    shift: cumulative_shift + (time - original_start). This handles words
 *    that overlap with the edge of a silence region.
 * 3. Timestamp AFTER a cut's original_end → full shift:
 *    cumulative_shift + cut.duration. The cumulative_shift field represents
 *    the shift from all PREVIOUS cuts only — it does NOT include the current
 *    cut's own duration.
 *
 * If no cuts apply (time is before the first cut), returns the original time unchanged.
 *
 * Per D-02: This is a FULL TIMELINE REMAP, not per-word subtraction.
 */
export function remapTimestamps(originalTimeMs: number, silenceCuts: SilenceCutList | null): number {
  if (!silenceCuts) {
    return originalTimeMs; // D-03: graceful handling — no cuts data, return original
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
 * Per D-03: If silenceCuts is null (file missing) or empty (no cuts),
 * returns words unchanged for graceful fallback.
 *
 * Per D-04: Remapping happens BEFORE createTikTokStyleCaptions.
 *
 * Words that start inside a silence cut region are filtered/clipped:
 * - If word is entirely inside a cut → dropped (hallucination during silence)
 * - If word crosses cut boundary (start inside, end after) → start clipped to cut end
 *   Only kept if ≥30% of word duration extends past the cut boundary.
 */
export function remapWordTimestamps(
  words: WhisperWord[],
  silenceCuts: SilenceCutList | null
): WhisperWord[] {
  if (!silenceCuts || silenceCuts.cuts.length === 0) {
    return words; // D-03: graceful handling — use original timestamps
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

// ─── Double-remap detection ──────────────────────────────────────────────

/**
 * Tolerance in seconds for detecting whether timestamps are already on the
 * silence-removed timeline. If the maximum word end timestamp falls within
 * new_duration + TOLERANCE, timestamps are assumed to come from a Whisper
 * run on the already-cut video (so remapWordTimestamps must be skipped).
 */
export const DETECTION_TOLERANCE_SEC = 2.0;

/**
 * Detect whether word timestamps are already on the silence-removed timeline.
 *
 * When Whisper runs on the already-cut video (process.sh: silence-cutter → whisper),
 * timestamps are relative to the cut video's duration, NOT the original. If we
 * remap them again, we get progressive drift and tokens with fromMs > toMs.
 *
 * Detection heuristic: if the max word.end <= new_duration + tolerance,
 * timestamps are from the cut video → return true (skip remap).
 * If max word.end > new_duration + tolerance, they're on the original timeline
 * → return false (apply remap).
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

/**
 * Deterministic remap decision: returns true when the silence remap should be
 * SKIPPED (timestamps already on the cut timeline), false when it should be
 * APPLIED (timestamps on the original timeline).
 *
 * Precedence:
 *  1. Explicit `transcript.timeline` marker wins ("silence-removed" → skip,
 *     "original" → remap). This is authoritative and immune to the maxWordEnd
 *     drift bug.
 *  2. No marker (legacy transcripts) → fall back to the maxWordEnd heuristic.
 *
 * If there are no silence cuts, there is nothing to remap → skip (false-y remap).
 */
export function shouldSkipSilenceRemap(
  transcript: Pick<WhisperTranscript, "words" | "timeline">,
  silenceCuts: SilenceCutList | null
): boolean {
  if (!silenceCuts || silenceCuts.cuts.length === 0 || transcript.words.length === 0) {
    return false;
  }
  if (transcript.timeline === "silence-removed") return true;  // already cut → skip remap
  if (transcript.timeline === "original") return false;        // original → apply remap
  // Legacy transcript with no explicit marker: fall back to the heuristic.
  return areTimestampsAlreadyRemapped(transcript.words, silenceCuts);
}

// ─── Caption page generation ────────────────────────────────────────────

export function transcriptToCaptionPages(
  transcript: WhisperTranscript,
  options: {
    combineTokensWithinMilliseconds?: number;
    silenceCuts?: SilenceCutList | null;
  } = {}
): TikTokPage[] {
  const { combineTokensWithinMilliseconds = 1500, silenceCuts = null } = options;

  // Deterministic remap decision: explicit transcript.timeline marker wins,
  // heuristic is the legacy fallback. Avoids the mid-speech-cut drift bug.
  const alreadyRemapped = shouldSkipSilenceRemap(transcript, silenceCuts);
  const effectiveSilenceCuts = alreadyRemapped ? null : silenceCuts;
  if (alreadyRemapped) {
    const reason = transcript.timeline === "silence-removed" ? "timeline marker" : "heuristic";
    console.log(`Timestamps already on silence-removed timeline (${reason}) — skipping remap`);
  }

  // D-04: Remap timestamps BEFORE createTikTokStyleCaptions
  const words = remapWordTimestamps(transcript.words, effectiveSilenceCuts);

  const captions: Caption[] = words.map((w, i) => ({
    text: i === 0 ? w.word : ` ${w.word}`,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
    confidence: w.confidence,
  }));

  if (captions.length === 0) {
    return [];
  }

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds,
  });

  const PROPER_NOUNS = new Set<string>([]);

  for (const page of pages) {
    for (let i = 0; i < page.tokens.length; i++) {
      const token = page.tokens[i];
      const isProperNoun = PROPER_NOUNS.has(token.text.trim());
      if (isProperNoun) {
        token.text = token.text.charAt(0).toUpperCase() + token.text.slice(1).toLowerCase();
      } else {
        token.text = token.text.toLowerCase();
      }
    }
  }

  return pages;
}

// ─── Type exports ────────────────────────────────────────────────────────

export type { SilenceCut, SilenceCutList, SafeZone, FinalizerInfo, WhisperWord, WhisperTranscript };