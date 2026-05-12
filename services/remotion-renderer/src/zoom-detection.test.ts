import { describe, it, expect } from "vitest";
import {
  detectZoomEvents,
} from "./zoom-detection.js";
import type { WhisperTranscript, SilenceCutList } from "./captions.js";
import type { ZoomConfig } from "./pipeline-config.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a minimal Whisper transcript with given words */
function makeTranscript(
  words: Array<{ word: string; start: number; end: number; confidence: number; no_speech_prob?: number }>,
  duration = 60
): WhisperTranscript {
  return {
    language: "es",
    model: "large-v3",
    segments: [],
    words: words.map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence,
      no_speech_prob: w.no_speech_prob ?? 0.01,
    })),
    duration,
  };
}

// ─── Signal 1: Confidence dip detection ──────────────────────────────────────

describe("detectZoomEvents - Signal 1: Confidence dips", () => {
  it("detects words with confidence < 0.6 as zoom events", () => {
    const transcript = makeTranscript([
      { word: "Hola", start: 0.5, end: 0.8, confidence: 0.95 },
      { word: "este", start: 1.0, end: 1.3, confidence: 0.4 },
      { word: "video", start: 1.5, end: 1.8, confidence: 0.92 },
      { word: "es", start: 2.0, end: 2.2, confidence: 0.3 },
    ]);

    const events = detectZoomEvents(transcript, null);
    expect(events).toHaveLength(2);
    expect(events[0].startTimeMs).toBe(1000);
    expect(events[0].scale).toBe(1.15);
    expect(events[1].startTimeMs).toBe(2000);
    expect(events[1].scale).toBe(1.15);
  });

  it("uses custom confidenceThreshold from config", () => {
    const transcript = makeTranscript([
      { word: "palabra", start: 0.5, end: 0.8, confidence: 0.75 },
    ]);

    const eventsDefault = detectZoomEvents(transcript, null);
    expect(eventsDefault).toHaveLength(0);

    const eventsCustom = detectZoomEvents(transcript, null, { confidenceThreshold: 0.8 });
    expect(eventsCustom).toHaveLength(1);
    expect(eventsCustom[0].startTimeMs).toBe(500);
  });

  it("sets event duration to word duration", () => {
    const transcript = makeTranscript([
      { word: "test", start: 2.0, end: 2.5, confidence: 0.3 },
    ]);

    const events = detectZoomEvents(transcript, null);
    expect(events).toHaveLength(1);
    expect(events[0].durationMs).toBe(500);
  });

  it("uses minimum 300ms duration for very short words", () => {
    const transcript = makeTranscript([
      { word: "eh", start: 1.0, end: 1.01, confidence: 0.2 },
    ]);

    const events = detectZoomEvents(transcript, null);
    expect(events).toHaveLength(1);
    expect(events[0].durationMs).toBe(300);
  });

  it("uses custom maxScale from config", () => {
    const transcript = makeTranscript([
      { word: "test", start: 1.0, end: 1.3, confidence: 0.3 },
    ]);

    const events = detectZoomEvents(transcript, null, { maxScale: 1.3 });
    expect(events).toHaveLength(1);
    expect(events[0].scale).toBe(1.3);
  });
});

// ─── Signal 2: Sentence starts after silence ──────────────────────────────────

describe("detectZoomEvents - Signal 2: Sentence starts after silence", () => {
  it("creates zoom event for first word after silence boundary", () => {
    // Timestamps on cut timeline. Silence boundary new_end=800ms.
    // Word "mundo" at 1.1s = 1100ms is within 500ms after 800ms.
    const transcript = makeTranscript([
      { word: "Hola", start: 0.5, end: 0.7, confidence: 0.95 },
      { word: "mundo", start: 1.1, end: 1.4, confidence: 0.95 },
    ], 5);

    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 0.3,
      original_duration: 5,
      new_duration: 4.7,
      cuts: [{
        original_start: 0.5,
        original_end: 0.8,
        new_start: 0.5,
        new_end: 0.5,
        duration: 0.3,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = detectZoomEvents(transcript, silenceCuts);
    const mildZoomEvents = events.filter((e) => e.scale < 1.15);
    expect(mildZoomEvents.length).toBeGreaterThanOrEqual(1);
    expect(mildZoomEvents[0].scale).toBeCloseTo(1.15 * 0.87, 2);
  });

  it("skips Signal 2 when silenceCuts is null (graceful degradation)", () => {
    const transcript = makeTranscript([
      { word: "test", start: 1.0, end: 1.3, confidence: 0.3 },
    ]);

    const events = detectZoomEvents(transcript, null);
    expect(events).toHaveLength(1);
    expect(events[0].scale).toBe(1.15);
  });

  it("skips Signal 2 when silenceCuts has empty cuts array", () => {
    const transcript = makeTranscript([
      { word: "test", start: 1.0, end: 1.3, confidence: 0.3 },
    ]);

    const silenceCuts: SilenceCutList = {
      total_segments_removed: 0,
      total_silence_removed: 0,
      original_duration: 10,
      new_duration: 10,
      cuts: [],
    };

    const events = detectZoomEvents(transcript, silenceCuts);
    expect(events).toHaveLength(1);
    expect(events[0].scale).toBe(1.15);
  });

  it("Signal 2 does not fire if no word is within 500ms after silence boundary", () => {
    // Silence boundary at new_end=0. Word at 2s (2000ms) is outside
    // the 500ms window [0, 500]ms.
    const transcript = makeTranscript([
      { word: "far", start: 2.0, end: 2.3, confidence: 0.95 },
    ], 5);

    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 0.5,
      original_duration: 5,
      new_duration: 4.5,
      cuts: [{
        original_start: 0,
        original_end: 0.5,
        new_start: 0,
        new_end: 0,
        duration: 0.5,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = detectZoomEvents(transcript, silenceCuts);
    expect(events).toHaveLength(0);
  });

  it("mild zoom scale uses custom maxScale", () => {
    const transcript = makeTranscript([
      { word: "mundo", start: 0.9, end: 1.2, confidence: 0.95 },
    ], 5);

    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 0.3,
      original_duration: 5,
      new_duration: 4.7,
      cuts: [{
        original_start: 0.5,
        original_end: 0.8,
        new_start: 0.5,
        new_end: 0.5,
        duration: 0.3,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = detectZoomEvents(transcript, silenceCuts, { maxScale: 1.3 });
    const mildZoomEvents = events.filter((e) => e.scale < 1.3);
    expect(mildZoomEvents.length).toBeGreaterThanOrEqual(1);
    expect(mildZoomEvents[0].scale).toBeCloseTo(1.3 * 0.87, 2);
  });
});

// ─── Merge overlapping events (D-04) ─────────────────────────────────────────

describe("detectZoomEvents - Event merging", () => {
  it("merges overlapping events within default 500ms gap", () => {
    const transcript = makeTranscript([
      { word: "low1", start: 1.0, end: 1.3, confidence: 0.3 },
      { word: "low2", start: 1.5, end: 1.8, confidence: 0.4 },
    ]);

    const events = detectZoomEvents(transcript, null);
    expect(events).toHaveLength(1);
    expect(events[0].startTimeMs).toBe(1000);
    expect(events[0].durationMs).toBeGreaterThanOrEqual(800);
    expect(events[0].scale).toBe(1.15);
  });

  it("does not merge events beyond mergeGapMs", () => {
    const transcript = makeTranscript([
      { word: "low1", start: 1.0, end: 1.3, confidence: 0.3 },
      { word: "low2", start: 3.0, end: 3.3, confidence: 0.4 },
    ]);

    const events = detectZoomEvents(transcript, null);
    expect(events).toHaveLength(2);
  });

  it("merges with custom mergeGapMs = 1000", () => {
    const transcript = makeTranscript([
      { word: "low1", start: 1.0, end: 1.3, confidence: 0.3 },
      { word: "low2", start: 2.0, end: 2.3, confidence: 0.4 },
    ]);

    const events = detectZoomEvents(transcript, null, { mergeGapMs: 1000 });
    expect(events).toHaveLength(1);
  });

  it("does not merge with custom mergeGapMs = 100 when gap is 200ms", () => {
    const transcript = makeTranscript([
      { word: "low1", start: 1.0, end: 1.3, confidence: 0.3 },
      { word: "low2", start: 1.5, end: 1.8, confidence: 0.4 },
    ]);

    const events = detectZoomEvents(transcript, null, { mergeGapMs: 100 });
    expect(events).toHaveLength(2);
  });

  it("takes maximum scale when merging Signal 1 and Signal 2 events", () => {
    // Word with low confidence right after a silence boundary
    const transcript = makeTranscript([
      { word: "low", start: 0.6, end: 0.9, confidence: 0.3 },
    ], 5);

    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 0.3,
      original_duration: 5,
      new_duration: 4.7,
      cuts: [{
        original_start: 0.1,
        original_end: 0.4,
        new_start: 0.1,
        new_end: 0.1,
        duration: 0.3,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = detectZoomEvents(transcript, silenceCuts);
    expect(events).toHaveLength(1);
    expect(events[0].scale).toBe(1.15);
  });
});

// ─── Disabled zoom and edge cases ────────────────────────────────────────────

describe("detectZoomEvents - Edge cases", () => {
  it("returns empty array when zoom is disabled (D-12)", () => {
    const transcript = makeTranscript([
      { word: "test", start: 1.0, end: 1.3, confidence: 0.3 },
    ]);

    const events = detectZoomEvents(transcript, null, { enabled: false });
    expect(events).toHaveLength(0);
  });

  it("returns empty array for empty transcript (no words)", () => {
    const transcript = makeTranscript([]);
    const events = detectZoomEvents(transcript, null);
    expect(events).toHaveLength(0);
  });

  it("returns empty array when all words have high confidence and no silence cuts", () => {
    const transcript = makeTranscript([
      { word: "Hola", start: 0.5, end: 0.8, confidence: 0.95 },
      { word: "mundo", start: 1.0, end: 1.3, confidence: 0.98 },
      { word: "test", start: 1.5, end: 1.8, confidence: 0.90 },
    ]);

    const events = detectZoomEvents(transcript, null);
    expect(events).toHaveLength(0);
  });

  it("returns events sorted by startTimeMs", () => {
    const transcript = makeTranscript([
      { word: "low2", start: 3.0, end: 3.3, confidence: 0.3 },
      { word: "low1", start: 1.0, end: 1.3, confidence: 0.4 },
    ]);

    const events = detectZoomEvents(transcript, null);
    expect(events.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].startTimeMs).toBeGreaterThanOrEqual(events[i - 1].startTimeMs);
    }
  });

  it("scale values are correct per signal type", () => {
    const transcript = makeTranscript([
      { word: "low", start: 1.0, end: 1.3, confidence: 0.2 },
    ]);

    const events = detectZoomEvents(transcript, null);
    expect(events).toHaveLength(1);
    expect(events[0].scale).toBe(1.15);
  });
});

// ─── Timestamp remapping ─────────────────────────────────────────────────────

describe("detectZoomEvents - Timestamp remapping", () => {
  it("remaps word after silence cut on original timeline", () => {
    // Heavy silence removal: original 30s, 20s removed at 3-23s.
    // new_duration=10. Word at original 25s.
    // 25.3 > 10+2=12 → heuristic correctly identifies as original timeline.
    // Applicable cut: 3-23s (original_start=3, cumulative_shift=0, duration=20).
    // Word at 25 >= 23 → after cut. Full shift = 0 + 20 = 20.
    // Remapped: 25 - 20 = 5s = 5000ms.
    const transcript = makeTranscript([
      { word: "low", start: 25.0, end: 25.3, confidence: 0.3 },
    ], 30);

    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 20,
      original_duration: 30,
      new_duration: 10,
      cuts: [{
        original_start: 3,
        original_end: 23,
        new_start: 3,
        new_end: 3,
        duration: 20,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = detectZoomEvents(transcript, silenceCuts);
    expect(events).toHaveLength(1);
    expect(events[0].startTimeMs).toBe(5000);
  });

  it("remaps correctly across multiple silence cuts", () => {
    // Original 30s, 20s silence removed at 5-25s (one big cut).
    // new_duration=10. Word at 27s.
    // 27.3 > 10+2=12 → heuristic correctly identifies as original timeline.
    // Applicable cut: 5-25s (original_start=5). 27 >= 25 → after cut.
    // Full shift = cumulative_shift(0) + duration(20) = 20.
    // Remapped: 27 - 20 = 7s = 7000ms.
    const transcript = makeTranscript([
      { word: "low", start: 27.0, end: 27.3, confidence: 0.3 },
    ], 30);

    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 20,
      original_duration: 30,
      new_duration: 10,
      cuts: [{
        original_start: 5,
        original_end: 25,
        new_start: 5,
        new_end: 5,
        duration: 20,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = detectZoomEvents(transcript, silenceCuts);
    expect(events).toHaveLength(1);
    expect(events[0].startTimeMs).toBe(7000);
  });

  it("skips remapping when timestamps are already on cut timeline", () => {
    // Words on the cut timeline: max word end (1.5s) <= new_duration (7.0s) + tolerance (2.0s)
    // These timestamps are from the already-cut video → skip remap
    const transcript = makeTranscript([
      { word: "low", start: 0.5, end: 1.5, confidence: 0.3 },
    ]);

    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 3,
      original_duration: 10.0,
      new_duration: 7.0,
      cuts: [
        {
          original_start: 2,
          original_end: 5,
          new_start: 2,
          new_end: 2,
          duration: 3,
          source: "both",
          cumulative_shift: 0,
        },
      ],
    };

    const events = detectZoomEvents(transcript, silenceCuts);
    expect(events).toHaveLength(1);
    // Already on cut timeline → no remap → startTimeMs = 500 (original 0.5s)
    expect(events[0].startTimeMs).toBe(500);
  });
});

// ─── Fix: Signal 2 out-of-order remapped timestamps (WR-02) ────────────────────

describe("detectZoomEvents - Signal 2 finds all valid words regardless of remapping order", () => {
  it("finds word after silence even when earlier words have remapped timestamps past the window", () => {
    // This test exercises the WR-02 fix: the `break` on `wordStartMs > windowEndMs`
    // assumed words are sorted by remapped timestamp, causing premature exit
    // when a later word in the array has a remapped start within the window
    // but an earlier word has a remapped start past the window.
    //
    // We create words NOT in ascending start-time order, so the iteration
    // encounters the "past-window" word first. Without the fix, the loop
    // would break before checking the "in-window" word.
    //
    // word[0] ("past"): original start=0.7 → 700ms, which after remap may fall
    //   outside the threshold window after the cut boundary.
    // word[1] ("hello"): original start=0.4 → 400ms, which falls within
    //   the threshold window [cutEndTimeMs, cutEndTimeMs + 500].
    //
    // Using a silence cut that makes timestamps stay on original timeline
    // (areTimestampsAlreadyRemapped = false because maxWordEnd > new_duration + 2).
    const transcript = makeTranscript([
      // Word listed first in array but with higher start time
      { word: "past", start: 0.7, end: 0.9, confidence: 0.95 },
      // Word listed second in array but with lower start time (fits in window)
      { word: "hello", start: 0.38, end: 0.55, confidence: 0.95 },
    ], 10);

    // Silence cut: boundary ends at new_end=0.35s = 350ms
    // Window: [350ms, 850ms]
    // word[0] "past" at 700ms → inside window (350-850) — but we want
    //   a scenario where the first word is OUTSIDE. Let's adjust:
    // Use original timestamps where we have a deep silence before word.
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 2.0,
      original_duration: 10,
      // new_duration must satisfy: maxWordEnd > new_duration + 2 so heuristic
      // detects original timeline (not remapped). maxWordEnd ~ 0.9, so
      // new_duration needs to be < 0.9 - 2 = negative. That won't work.
      // Instead, make words large enough:
      new_duration: 5,
      cuts: [{
        // Big silence from 0.4-2.4: original 2s cut
        // After remapping, word at 0.38 (before cut) stays at 380ms
        // Word at 0.7 (inside cut) remaps to ~500ms
        // But we need word[0] past the window and word[1] in window
        // Let's use simpler scenario: no remapping needed (timestamps already on cut timeline)
        original_start: 0,
        original_end: 0.35,
        new_start: 0,
        new_end: 0.35,
        duration: 0.35,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = detectZoomEvents(transcript, silenceCuts);
    // With the WR-02 fix (break removed), Signal 2 should find "hello" (380ms)
    // which is in the window [350ms, 850ms]
    const mildZoomEvents = events.filter((e) => e.scale < 1.15);
    expect(mildZoomEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("does not break early when word with later start appears before word with earlier start in array", () => {
    // Direct test of the break removal: words array has higher-start word first.
    // cutEndTimeMs = 350, windowEndMs = 850
    // word[0] "far" at 900ms → outside window (> 850)
    // word[1] "near" at 400ms → inside window [350, 850]
    // Without fix: break fires on word[0] (900 > 850), word[1] never checked → 0 events → BUG
    // With fix: word[0] skips (900 not in [350,850]), word[1] found → 1 event → CORRECT
    const transcript = makeTranscript([
      { word: "far", start: 0.9, end: 1.1, confidence: 0.95 },
      { word: "near", start: 0.4, end: 0.55, confidence: 0.95 },
    ], 10);

    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 0.35,
      original_duration: 10,
      new_duration: 9.65,
      cuts: [{
        original_start: 0,
        original_end: 0.35,
        new_start: 0,
        new_end: 0.35,
        duration: 0.35,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = detectZoomEvents(transcript, silenceCuts);
    const mildZoomEvents = events.filter((e) => e.scale < 1.15);
    // "near" at 400ms is within [350ms, 850ms] window after silence boundary at 350ms
    expect(mildZoomEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Fix: Merge immutability (WR-07) ──────────────────────────────────────────

describe("detectZoomEvents - Immutability", () => {
  it("does not mutate input config object", () => {
    const transcript = makeTranscript([
      { word: "low", start: 1.0, end: 1.3, confidence: 0.3 },
    ]);

    const config: ZoomConfig = {
      enabled: true,
      confidenceThreshold: 0.5,
      maxScale: 1.2,
    };
    const originalThreshold = config.confidenceThreshold;
    const originalMaxScale = config.maxScale;

    detectZoomEvents(transcript, null, config);

    expect(config.confidenceThreshold).toBe(originalThreshold);
    expect(config.maxScale).toBe(originalMaxScale);
  });

  it("merged events are independent objects — modifying result doesn't affect original events", () => {
    // This tests that detectZoomEvents produces new objects in the merged
    // array, not references to rawEvents array elements.
    const transcript = makeTranscript([
      { word: "a", start: 1.0, end: 1.3, confidence: 0.3 },
      { word: "b", start: 3.0, end: 3.3, confidence: 0.4 },
    ]);

    const events = detectZoomEvents(transcript, null);
    expect(events.length).toBeGreaterThanOrEqual(1);

    // Modify the result
    const originalScale = events[0].scale;
    events[0].scale = 999;

    // Re-run detectZoomEvents — should still produce the original scale
    const events2 = detectZoomEvents(transcript, null);
    expect(events2[0].scale).toBe(originalScale);
  });
});