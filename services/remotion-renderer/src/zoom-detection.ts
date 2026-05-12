// ─── Zoom Detection: Identify emphasis moments from transcript data (VISU-03, D-01–D-04) ───
//
// detectZoomEvents reads Whisper confidence scores and silence boundaries to
// produce ZoomEvent[] — zoom-in moments that the ZoomContainer Remotion
// component (07-02) will render. Two signals are combined:
//
//   Signal 1: Words with confidence < threshold trigger a full-scale zoom (D-02)
//   Signal 2: First word after each silence boundary gets a mild zoom (D-02)
//
// Overlapping/nearby events within mergeGapMs are merged (D-04).
// Timestamps are remapped to the silence-removed timeline (same logic as captions).

import {
  remapTimestamps,
  areTimestampsAlreadyRemapped,
  type WhisperTranscript,
  type SilenceCutList,
} from "./captions.js";
import { type ZoomConfig, DEFAULT_ZOOM_CONFIG } from "./pipeline-config.js";

// ─── ZoomEvent interface ─────────────────────────────────────────────────────

/** A single zoom event produced by detectZoomEvents */
export interface ZoomEvent {
  /** When the zoom-in ramp starts (ms, on the remapped timeline) */
  startTimeMs: number;
  /** Duration of the emphasis moment in ms (excluding ramp-in/out) */
  durationMs: number;
  /** Peak zoom scale (default 1.15 for confidence dips, ~1.0 for sentence starts) */
  scale: number;
}

// ─── Internal signal types ──────────────────────────────────────────────────

interface RawZoomEvent {
  startTimeMs: number;
  durationMs: number;
  scale: number;
}

// ─── detectZoomEvents ───────────────────────────────────────────────────────

/**
 * Detect zoom events from transcript confidence dips and silence boundaries.
 *
 * Per D-01: The function operates on the **remapped** timeline (same as captions).
 * Per D-02: Two signals contribute zoom events — confidence dips and sentence starts after silence.
 * Per D-04: Nearby events within mergeGapMs are merged.
 * Per D-12: If config.enabled is false, returns empty array.
 *
 * @param transcript Whisper transcript with words array (each word has start, end, confidence)
 * @param silenceCuts Silence cut list from ffmpeg-finalizer (null = no silence data available)
 * @param config Optional ZoomConfig to override defaults
 * @returns Sorted array of ZoomEvent (by startTimeMs ascending)
 */
export function detectZoomEvents(
  transcript: WhisperTranscript,
  silenceCuts: SilenceCutList | null,
  config?: ZoomConfig
): ZoomEvent[] {
  // Merge config with defaults
  const cfg: Required<ZoomConfig> = {
    enabled: config?.enabled ?? DEFAULT_ZOOM_CONFIG.enabled,
    confidenceThreshold: config?.confidenceThreshold ?? DEFAULT_ZOOM_CONFIG.confidenceThreshold,
    maxScale: config?.maxScale ?? DEFAULT_ZOOM_CONFIG.maxScale,
    rampMs: config?.rampMs ?? DEFAULT_ZOOM_CONFIG.rampMs,
    mergeGapMs: config?.mergeGapMs ?? DEFAULT_ZOOM_CONFIG.mergeGapMs,
  };

  // D-12: If zooms are disabled, return empty array
  if (!cfg.enabled) {
    return [];
  }

  // Empty transcript — no events
  if (!transcript.words || transcript.words.length === 0) {
    return [];
  }

  const words = transcript.words;

  // Determine whether timestamps need remapping (D-01)
  const alreadyRemapped = areTimestampsAlreadyRemapped(words, silenceCuts);
  const effectiveSilenceCuts = alreadyRemapped ? null : silenceCuts;

  // Helper: remap a timestamp (in ms) to the silence-removed timeline
  const remapMs = (ms: number): number => {
    if (!effectiveSilenceCuts || effectiveSilenceCuts.cuts.length === 0) {
      return ms;
    }
    return remapTimestamps(ms, effectiveSilenceCuts);
  };

  const rawEvents: RawZoomEvent[] = [];

  // ─── Signal 1: Confidence dips (D-02) ────────────────────────────────────
  // Words with confidence < threshold trigger a zoom event.
  // The event starts at the word's remapped start time and lasts for the
  // word's duration. Scale is maxScale (default 1.15).
  for (const word of words) {
    if (word.confidence < cfg.confidenceThreshold) {
      const wordStartMs = Math.round(word.start * 1000);
      const wordEndMs = Math.round(word.end * 1000);
      const wordDurationMs = wordEndMs - wordStartMs;

      rawEvents.push({
        startTimeMs: remapMs(wordStartMs),
        durationMs: Math.max(wordDurationMs, 300), // minimum 300ms duration
        scale: cfg.maxScale,
      });
    }
  }

  // ─── Signal 2: Sentence starts after silence (D-02) ────────────────────────
  // For each silence cut boundary, find the first word whose remapped start
  // time falls within 500ms after new_end * 1000. Create a mild zoom event
  // with scale = maxScale * 0.87 (≈1.0 for default maxScale 1.15).
  if (silenceCuts && silenceCuts.cuts.length > 0) {
    const thresholdAfterSilenceMs = 500;

    for (const cut of silenceCuts.cuts) {
      const cutEndTimeMs = Math.round(cut.new_end * 1000);
      const windowEndMs = cutEndTimeMs + thresholdAfterSilenceMs;

      // Find the first word whose remapped start time is within the window
      let foundWord = false;
      for (const word of words) {
        const wordStartMs = remapMs(Math.round(word.start * 1000));

        if (wordStartMs >= cutEndTimeMs && wordStartMs <= windowEndMs) {
          rawEvents.push({
            startTimeMs: wordStartMs,
            durationMs: 300,
            scale: cfg.maxScale * 0.87,
          });
          foundWord = true;
          break; // Only the first word after each silence boundary
        }

        // Note: We do NOT break on wordStartMs > windowEndMs because
        // remapped timestamps can be out of order relative to the original
        // word array. A word that appears later in the array might have an
        // earlier remapped timestamp, so we must check all words.
      }
    }
  }

  // ─── Merge overlapping events (D-04) ──────────────────────────────────────
  // Sort by startTimeMs, then merge events within mergeGapMs of each other.
  if (rawEvents.length === 0) {
    return [];
  }

  rawEvents.sort((a, b) => a.startTimeMs - b.startTimeMs);

  const merged: ZoomEvent[] = [{ ...rawEvents[0] }];
  for (let i = 1; i < rawEvents.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = rawEvents[i];
    const gap = curr.startTimeMs - (prev.startTimeMs + prev.durationMs);

    if (gap < cfg.mergeGapMs) {
      // Merge: extend previous event to cover current, take max scale
      const mergedEnd = Math.max(
        prev.startTimeMs + prev.durationMs,
        curr.startTimeMs + curr.durationMs
      );
      prev.durationMs = mergedEnd - prev.startTimeMs;
      prev.scale = Math.max(prev.scale, curr.scale);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}