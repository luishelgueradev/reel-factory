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
  const millis = Math.round(ms % 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/**
 * Format milliseconds as WebVTT timestamp: HH:MM:SS.mmm (dot separator per D-08)
 */
export function formatVttTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.round(ms % 1000);
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
  // Find split positions at punctuation
  const splitPositions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (SPLIT_PUNCTUATION.test(text[i])) {
      splitPositions.push(i);
    }
  }

  if (splitPositions.length === 0) {
    // No punctuation — keep as one cue per D-05
    return [{ index: startIndex, startTimeMs, endTimeMs, text }];
  }

  const words = text.split(/\s+/);
  const totalWords = words.length;
  const durationMs = endTimeMs - startTimeMs;

  // Split at roughly the midpoint punctuation
  const midPoint = Math.floor(splitPositions.length / 2);
  const splitCharPos = splitPositions[midPoint];

  // Find which word contains the split character position
  // Build a word-position map to find the split point
  let charPos = 0;
  let splitWordIdx = 0;
  for (let i = 0; i < words.length; i++) {
    if (charPos <= splitCharPos && charPos + words[i].length >= splitCharPos) {
      splitWordIdx = i;
      break;
    }
    charPos += words[i].length + 1; // +1 for the space
  }

  // Split into two cues at the word boundary
  const firstHalf = words.slice(0, splitWordIdx + 1).join(" ");
  const secondHalf = words.slice(splitWordIdx + 1).join(" ");

  if (!secondHalf.trim()) {
    // Split would create empty second cue — keep as one
    return [{ index: startIndex, startTimeMs, endTimeMs, text }];
  }

  const midpointMs = startTimeMs + Math.round((splitWordIdx / totalWords) * durationMs);

  return [
    { index: startIndex, startTimeMs, endTimeMs: midpointMs, text: firstHalf },
    { index: startIndex + 1, startTimeMs: midpointMs, endTimeMs, text: secondHalf },
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