/**
 * SRT and VTT format generators for subtitle export.
 *
 * Per D-04: Cue segmentation uses Whisper segments[] boundaries.
 * Per D-05: Long segments (>10 words) split at nearest punctuation.
 * Per D-06: Words inside silence cuts are excluded.
 * Per D-07: SRT format with sequential numbers, comma-separated timestamps.
 * Per D-08: VTT format with WEBVTT header, dot-separated timestamps, no styling.
 * Per D-09: SRT and VTT contain identical text content.
 * Per D-10: Timestamps remapped to post-silence-removal timeline.
 */

import type { SrtCue, WhisperTranscript, WhisperWord, SilenceCutList } from "./types";
import { remapTimestamps } from "./timestamp-remap";

// ─── Timestamp formatters ──────────────────────────────────────────────────

/**
 * Format milliseconds as SRT timestamp: HH:MM:SS,mmm (comma separator per D-07)
 */
export function formatSrtTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/**
 * Format milliseconds as WebVTT timestamp: HH:MM:SS.mmm (dot separator per D-08)
 */
export function formatVttTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// ─── Cue building ──────────────────────────────────────────────────────────

/** Punctuation marks for long segment splitting per D-05 */
const SPLIT_PUNCTUATION = /[.,;!?]/;
/** Approximate word threshold for splitting long segments per D-05 */
const LONG_SEGMENT_THRESHOLD = 10;

/**
 * Build SrtCue[] from Whisper transcript using segment boundaries.
 *
 * Per D-04: Each Whisper segment becomes one cue (sentence-per-cue).
 * Per D-05: Long segments (>10 words) split at nearest punctuation.
 * Per D-06: Words inside silence cuts are excluded (handled by remapWordTimestamps in caller).
 * Per D-10: Segment start/end timestamps remapped to post-silence timeline.
 */
export function buildCuesFromTranscript(
  transcript: WhisperTranscript,
  silenceCuts: SilenceCutList | null
): SrtCue[] {
  if (!transcript.segments || transcript.segments.length === 0) {
    return [];
  }

  const cues: SrtCue[] = [];
  let cueIndex = 1;

  for (const segment of transcript.segments) {
    // Remap segment start/end to post-silence timeline per D-10
    const startTimeMs = Math.round(remapTimestamps(segment.start * 1000, silenceCuts));
    const endTimeMs = Math.round(remapTimestamps(segment.end * 1000, silenceCuts));

    // Skip segments with zero or negative duration after remapping per D-06
    if (endTimeMs <= startTimeMs) {
      continue;
    }

    const text = segment.text.trim();
    if (!text) {
      continue;
    }

    // Per D-05: Split long segments at punctuation
    const words = text.split(/\s+/);
    if (words.length > LONG_SEGMENT_THRESHOLD) {
      const subCues = splitLongSegment(text, startTimeMs, endTimeMs, cueIndex);
      cueIndex += subCues.length;
      cues.push(...subCues);
    } else {
      cues.push({
        index: cueIndex++,
        startTimeMs,
        endTimeMs,
        text,
      });
    }
  }

  return cues;
}

/**
 * Split a long segment at the nearest punctuation mark.
 * Per D-05: Split at comma, period, semicolon. If no punctuation, keep as one cue.
 */
function splitLongSegment(
  text: string,
  startTimeMs: number,
  endTimeMs: number,
  startIndex: number
): SrtCue[] {
  const words = text.split(/\s+/);
  const totalWords = words.length;
  const durationMs = endTimeMs - startTimeMs;

  if (totalWords <= 1) {
    return [{ index: startIndex, startTimeMs, endTimeMs, text }];
  }

  // Find the word index closest to the midpoint that ends with punctuation
  const midWordIdx = Math.floor(totalWords / 2);
  let splitAfterIdx = -1;

  // Search outward from midpoint for a word ending with punctuation
  for (let offset = 0; offset <= midWordIdx; offset++) {
    // Search forward from midpoint
    const forwardIdx = midWordIdx + offset;
    if (forwardIdx < totalWords && SPLIT_PUNCTUATION.test(words[forwardIdx][words[forwardIdx].length - 1])) {
      // Don't split on the last word (would create empty second cue)
      if (forwardIdx < totalWords - 1) {
        splitAfterIdx = forwardIdx;
        break;
      }
    }
    // Search backward from midpoint
    if (offset > 0) {
      const backwardIdx = midWordIdx - offset;
      if (backwardIdx >= 0 && SPLIT_PUNCTUATION.test(words[backwardIdx][words[backwardIdx].length - 1])) {
        if (backwardIdx < totalWords - 1) {
          splitAfterIdx = backwardIdx;
          break;
        }
      }
    }
  }

  if (splitAfterIdx === -1) {
    // No punctuation found — keep as one cue per D-05
    return [{ index: startIndex, startTimeMs, endTimeMs, text }];
  }

  const firstHalf = words.slice(0, splitAfterIdx + 1).join(" ");
  const secondHalf = words.slice(splitAfterIdx + 1).join(" ");

  if (!secondHalf.trim()) {
    return [{ index: startIndex, startTimeMs, endTimeMs, text }];
  }

  const splitMs = startTimeMs + Math.round(((splitAfterIdx + 1) / totalWords) * durationMs);

  return [
    { index: startIndex, startTimeMs, endTimeMs: splitMs, text: firstHalf },
    { index: startIndex + 1, startTimeMs: splitMs, endTimeMs, text: secondHalf },
  ];
}

// ─── Format generators ──────────────────────────────────────────────────────

/**
 * Generate SRT subtitle content from cues.
 * Per D-07: Sequential cue numbers, comma-separated timestamps, blank line separators.
 */
export function generateSrt(cues: SrtCue[]): string {
  if (cues.length === 0) {
    return "";
  }

  return cues
    .map((cue) => {
      const start = formatSrtTimestamp(cue.startTimeMs);
      const end = formatSrtTimestamp(cue.endTimeMs);
      return `${cue.index}\n${start} --> ${end}\n${cue.text}`;
    })
    .join("\n\n");
}

/**
 * Generate WebVTT subtitle content from cues.
 * Per D-08: WEBVTT header, dot-separated timestamps, no styling.
 */
export function generateVtt(cues: SrtCue[]): string {
  const header = "WEBVTT\n";

  if (cues.length === 0) {
    return header + "\n";
  }

  const body = cues
    .map((cue) => {
      const start = formatVttTimestamp(cue.startTimeMs);
      const end = formatVttTimestamp(cue.endTimeMs);
      return `${start} --> ${end}\n${cue.text}`;
    })
    .join("\n\n");

  return `${header}\n${body}`;
}