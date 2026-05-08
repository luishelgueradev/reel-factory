import { describe, it, expect } from "vitest";
import {
  remapTimestamps,
  remapWordTimestamps,
  transcriptToCaptionPages,
  areTimestampsAlreadyRemapped,
  DETECTION_TOLERANCE_SEC,
} from "./captions";
import type { SilenceCutList, WhisperWord } from "./captions";

// ─── remapTimestamps ─────────────────────────────────────────────────────

describe("remapTimestamps", () => {
  // Test 1: Correctly shifts timestamps when silence cuts exist
  // A word at original time 10s after a 2s silence cut starting at 3s
  // gets remapped to ~8s (original 10s - cumulative_shift of the applicable cut)
  it("remaps a timestamp using cumulative_shift from silence cuts", () => {
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 2,
      original_duration: 20,
      new_duration: 18,
      cuts: [
        {
          original_start: 3,
          original_end: 5,
          new_start: 3,
          new_end: 3,
          duration: 2,
          source: "both",
          cumulative_shift: 2,
        },
      ],
    };
    // A word starting at 10s (original) should be remapped to 8s (10 - 2)
    const result = remapTimestamps(10000, silenceCuts); // 10s in ms
    expect(result).toBe(8000); // 8s in ms
  });

  // Test 2: Returns original timestamps unchanged when silenceCuts is null
  it("returns original timestamp when silenceCuts is null", () => {
    const result = remapTimestamps(5000, null as any);
    expect(result).toBe(5000);
  });

  // Test 3: Handles edge case where silence was removed from beginning of video
  // First word's timestamp shifts to near-zero
  it("remaps timestamp when silence cut is at the beginning of the video", () => {
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 3,
      original_duration: 20,
      new_duration: 17,
      cuts: [
        {
          original_start: 0,
          original_end: 3,
          new_start: 0,
          new_end: 0,
          duration: 3,
          source: "both",
          cumulative_shift: 3,
        },
      ],
    };
    // Word starting at 4s original, after 3s silence removed from beginning
    // cumulative_shift = 3, so remapped time = 4 - 3 = 1s
    const result = remapTimestamps(4000, silenceCuts);
    expect(result).toBe(1000);
  });

  // Test 4: Uses binary search through silence cuts sorted by original_start
  it("uses binary search for efficient lookup across multiple cuts", () => {
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 3,
      total_silence_removed: 6,
      original_duration: 30,
      new_duration: 24,
      cuts: [
        {
          original_start: 2,
          original_end: 4,
          new_start: 2,
          new_end: 2,
          duration: 2,
          source: "both",
          cumulative_shift: 2,
        },
        {
          original_start: 8,
          original_end: 10,
          new_start: 6,
          new_end: 6,
          duration: 2,
          source: "both",
          cumulative_shift: 4,
        },
        {
          original_start: 15,
          original_end: 17,
          new_start: 11,
          new_end: 11,
          duration: 2,
          source: "both",
          cumulative_shift: 6,
        },
      ],
    };
    // Word at 20s (original), after all 3 cuts with total shift 6s
    const result = remapTimestamps(20000, silenceCuts);
    expect(result).toBe(14000); // 20 - 6 = 14s

    // Word at 12s (original), after first 2 cuts with total shift 4s
    const result2 = remapTimestamps(12000, silenceCuts);
    expect(result2).toBe(8000); // 12 - 4 = 8s

    // Word at 5s (original), after only first cut with shift 2s
    const result3 = remapTimestamps(5000, silenceCuts);
    expect(result3).toBe(3000); // 5 - 2 = 3s

    // Word at 1s (original), before any cut — unchanged
    const result4 = remapTimestamps(1000, silenceCuts);
    expect(result4).toBe(1000);
  });

  // Edge case: timestamp exactly at original_start of a cut
  it("remaps correctly when timestamp equals original_start of a cut", () => {
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 2,
      original_duration: 20,
      new_duration: 18,
      cuts: [
        {
          original_start: 5,
          original_end: 7,
          new_start: 5,
          new_end: 5,
          duration: 2,
          source: "both",
          cumulative_shift: 2,
        },
      ],
    };
    // Word at exactly 5s — it's at the start of a silence cut
    // Should apply the shift since original_start <= time
    const result = remapTimestamps(5000, silenceCuts);
    expect(result).toBe(3000); // 5 - 2 = 3s
  });
});

// ─── remapWordTimestamps ─────────────────────────────────────────────────

describe("remapWordTimestamps", () => {
  it("returns words unchanged when silenceCuts is null", () => {
    const words: WhisperWord[] = [
      { word: "hello", start: 1, end: 1.5, confidence: 0.9, no_speech_prob: 0.01 },
      { word: "world", start: 2, end: 2.5, confidence: 0.85, no_speech_prob: 0.02 },
    ];
    const result = remapWordTimestamps(words, null);
    expect(result).toEqual(words);
  });

  it("returns words unchanged when silenceCuts has empty cuts array", () => {
    const words: WhisperWord[] = [
      { word: "hello", start: 1, end: 1.5, confidence: 0.9, no_speech_prob: 0.01 },
    ];
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 0,
      total_silence_removed: 0,
      original_duration: 10,
      new_duration: 10,
      cuts: [],
    };
    const result = remapWordTimestamps(words, silenceCuts);
    expect(result).toEqual(words);
  });

  it("remaps start and end timestamps of each word", () => {
    const words: WhisperWord[] = [
      { word: "hello", start: 5, end: 5.5, confidence: 0.9, no_speech_prob: 0.01 },
    ];
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 2,
      original_duration: 20,
      new_duration: 18,
      cuts: [
        {
          original_start: 3,
          original_end: 5,
          new_start: 3,
          new_end: 3,
          duration: 2,
          source: "both",
          cumulative_shift: 2,
        },
      ],
    };
    const result = remapWordTimestamps(words, silenceCuts);
    expect(result[0].start).toBeCloseTo(3, 2); // 5 - 2 = 3
    expect(result[0].end).toBeCloseTo(3.5, 2); // 5.5 - 2 = 3.5
    expect(result[0].word).toBe("hello");
    expect(result[0].confidence).toBe(0.9);
  });
});

// ─── transcriptToCaptionPages with silenceCuts ───────────────────────────

describe("transcriptToCaptionPages", () => {
  it("produces same results without silenceCuts (backward compatible)", () => {
    const transcript = {
      language: "es",
      model: "large-v3",
      segments: [],
      words: [
        { word: "Hola", start: 0, end: 0.5, confidence: 0.9, no_speech_prob: 0.01 },
        { word: "mundo", start: 0.6, end: 1.2, confidence: 0.85, no_speech_prob: 0.02 },
      ],
      duration: 10,
    };
    const pagesWithout = transcriptToCaptionPages(transcript);
    const pagesWith = transcriptToCaptionPages(transcript, { silenceCuts: null });
    expect(pagesWith).toEqual(pagesWithout);
  });

  it("produces remapped TikTokPages when silenceCuts is provided", () => {
    const transcript = {
      language: "es",
      model: "large-v3",
      segments: [],
      words: [
        // Word at 5s original, with large silence removed so new_duration is small
        // This ensures max word end (5.5s) > new_duration (2s) + tolerance (2s) = 4s
        // so detection correctly identifies timestamps as original timeline
        { word: "Hola", start: 5, end: 5.5, confidence: 0.9, no_speech_prob: 0.01 },
      ],
      duration: 10,
    };
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 2,
      total_silence_removed: 8,
      original_duration: 10,
      new_duration: 2,
      cuts: [
        {
          original_start: 0,
          original_end: 3,
          new_start: 0,
          new_end: 0,
          duration: 3,
          source: "both",
          cumulative_shift: 3,
        },
        {
          original_start: 5.5,
          original_end: 8.5,
          new_start: 2.5,
          new_end: 2.5,
          duration: 3,
          source: "both",
          cumulative_shift: 6,
        },
      ],
    };
    const pages = transcriptToCaptionPages(transcript, { silenceCuts });
    // The word at original 5s should be remapped to 2s (5 - 3, first cut's cumulative_shift)
    // So caption tokens should start around 2000ms
    expect(pages.length).toBeGreaterThan(0);
    const firstPage = pages[0];
    expect(firstPage.startMs).toBeLessThanOrEqual(3000);
  });

  it("skips remapping when timestamps are already on cut timeline", () => {
    // Words on the cut timeline: max word end (1.0s) <= new_duration (7.0s) + tolerance
    // These timestamps should NOT be remapped again
    const transcript = {
      language: "es",
      model: "large-v3",
      segments: [],
      words: [
        { word: "Hola", start: 0.5, end: 1.0, confidence: 0.9, no_speech_prob: 0.01 },
      ],
      duration: 10,
    };
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
          cumulative_shift: 3,
        },
      ],
    };
    const pages = transcriptToCaptionPages(transcript, { silenceCuts });
    expect(pages.length).toBeGreaterThan(0);
    // The first token should have fromMs ≈ 500 (the original start time)
    // NOT remapped to 500 - 3000 = -2500 (which would be broken)
    const firstToken = pages[0].tokens[0];
    expect(firstToken.fromMs).toBeGreaterThanOrEqual(0);
    expect(firstToken.fromMs).toBeCloseTo(500, -1);
  });

  it("still remaps when timestamps are on original timeline", () => {
    // Words on the original timeline: max word end (5.5s) > new_duration (2.0s) + tolerance (2.0s) = 4.0s
    // Detection correctly identifies these as original-timeline → remap is applied
    const transcript = {
      language: "es",
      model: "large-v3",
      segments: [],
      words: [
        { word: "test", start: 5.0, end: 5.5, confidence: 0.9, no_speech_prob: 0.01 },
      ],
      duration: 20,
    };
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 2,
      total_silence_removed: 8,
      original_duration: 10.0,
      new_duration: 2.0,
      cuts: [
        {
          original_start: 0,
          original_end: 3,
          new_start: 0,
          new_end: 0,
          duration: 3,
          source: "both",
          cumulative_shift: 3,
        },
      ],
    };
    const pages = transcriptToCaptionPages(transcript, { silenceCuts });
    expect(pages.length).toBeGreaterThan(0);
    // The word at original 5s should be remapped to 2s (5 - 3)
    // First token fromMs ≈ 2000
    const firstToken = pages[0].tokens[0];
    expect(firstToken.fromMs).toBeCloseTo(2000, -1);
  });
});

// ─── areTimestampsAlreadyRemapped ──────────────────────────────────────────

describe("areTimestampsAlreadyRemapped", () => {
  it("returns true when max word end <= new_duration + tolerance (timestamps from cut video)", () => {
    // Words at timestamps ≤ new_duration + tolerance → timestamps are from the cut video
    const words: WhisperWord[] = [
      { word: "hello", start: 1, end: 5.0, confidence: 0.9, no_speech_prob: 0.01 },
    ];
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
          cumulative_shift: 3,
        },
      ],
    };
    // max end = 5.0, new_duration + tolerance = 7.0 + 2.0 = 9.0 → 5.0 <= 9.0 → true
    expect(areTimestampsAlreadyRemapped(words, silenceCuts)).toBe(true);
  });

  it("returns false when max word end > new_duration + tolerance (timestamps from original video)", () => {
    // Words at timestamps > new_duration + tolerance → timestamps are on original timeline
    const words: WhisperWord[] = [
      { word: "hello", start: 1, end: 9.5, confidence: 0.9, no_speech_prob: 0.01 },
    ];
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
          cumulative_shift: 3,
        },
      ],
    };
    // max end = 9.5, new_duration + tolerance = 7.0 + 2.0 = 9.0 → 9.5 > 9.0 → false
    expect(areTimestampsAlreadyRemapped(words, silenceCuts)).toBe(false);
  });

  it("returns false when silenceCuts is null", () => {
    const words: WhisperWord[] = [
      { word: "hello", start: 1, end: 5, confidence: 0.9, no_speech_prob: 0.01 },
    ];
    expect(areTimestampsAlreadyRemapped(words, null)).toBe(false);
  });

  it("returns false when silenceCuts has empty cuts array", () => {
    const words: WhisperWord[] = [
      { word: "hello", start: 1, end: 5, confidence: 0.9, no_speech_prob: 0.01 },
    ];
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 0,
      total_silence_removed: 0,
      original_duration: 10,
      new_duration: 10,
      cuts: [],
    };
    expect(areTimestampsAlreadyRemapped(words, silenceCuts)).toBe(false);
  });

  it("returns false when words array is empty", () => {
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 3,
      original_duration: 10,
      new_duration: 7,
      cuts: [
        {
          original_start: 2,
          original_end: 5,
          new_start: 2,
          new_end: 2,
          duration: 3,
          source: "both",
          cumulative_shift: 3,
        },
      ],
    };
    expect(areTimestampsAlreadyRemapped([], silenceCuts)).toBe(false);
  });
});