import { describe, it, expect } from "vitest";
import {
  remapTimestamps,
  remapWordTimestamps,
  transcriptToCaptionPages,
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
        { word: "Hola", start: 5, end: 5.5, confidence: 0.9, no_speech_prob: 0.01 },
      ],
      duration: 20,
    };
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
    const pages = transcriptToCaptionPages(transcript, { silenceCuts });
    // The word at original 5s should be remapped to 3s (5 - 2)
    // So caption tokens should start around 3000ms
    expect(pages.length).toBeGreaterThan(0);
    // Check that the first page contains tokens that are remapped
    const firstPage = pages[0];
    expect(firstPage.startMs).toBeLessThanOrEqual(3000);
  });
});