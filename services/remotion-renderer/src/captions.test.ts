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
  // A word at original time 10s after a 2s silence cut (3-5s) gets remapped to 8s.
  // cumulative_shift=0 for the first cut (shift from PREVIOUS cuts only).
  // Full shift = cumulative_shift + duration = 0 + 2 = 2.
  it("remaps a timestamp using cumulative_shift + duration from silence cuts", () => {
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
          cumulative_shift: 0,
        },
      ],
    };
    // A word starting at 10s (original) should be remapped to 8s (10 - (0 + 2))
    const result = remapTimestamps(10000, silenceCuts); // 10s in ms
    expect(result).toBe(8000); // 8s in ms
  });

  // Test 2: Returns original timestamps unchanged when silenceCuts is null
  it("returns original timestamp when silenceCuts is null", () => {
    const result = remapTimestamps(5000, null as any);
    expect(result).toBe(5000);
  });

  // Test 3: Handles edge case where silence was removed from beginning of video
  // First word's timestamp shifts to near-zero.
  // cumulative_shift=0 for the first cut (shift from PREVIOUS cuts only).
  // Full shift = cumulative_shift + duration = 0 + 3 = 3.
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
          cumulative_shift: 0,
        },
      ],
    };
    // Word starting at 4s original, after 3s silence removed from beginning
    // Full shift = 0 + 3 = 3, so remapped time = 4 - 3 = 1s
    const result = remapTimestamps(4000, silenceCuts);
    expect(result).toBe(1000);
  });

  // Test 4: Uses binary search through silence cuts sorted by original_start
  // cumulative_shift values follow the Python schema convention:
  // cumulative_shift = shift from PREVIOUS cuts only (excludes current cut's duration)
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
          cumulative_shift: 0,
        },
        {
          original_start: 8,
          original_end: 10,
          new_start: 6,
          new_end: 6,
          duration: 2,
          source: "both",
          cumulative_shift: 2,
        },
        {
          original_start: 15,
          original_end: 17,
          new_start: 11,
          new_end: 11,
          duration: 2,
          source: "both",
          cumulative_shift: 4,
        },
      ],
    };
    // Word at 20s (original), after all 3 cuts. Applicable cut = cut 3.
    // Full shift = cumulative_shift(4) + duration(2) = 6. 20 - 6 = 14s
    const result = remapTimestamps(20000, silenceCuts);
    expect(result).toBe(14000);

    // Word at 12s (original), after first 2 cuts. Applicable cut = cut 2.
    // Full shift = cumulative_shift(2) + duration(2) = 4. 12 - 4 = 8s
    const result2 = remapTimestamps(12000, silenceCuts);
    expect(result2).toBe(8000);

    // Word at 5s (original), after only first cut. Applicable cut = cut 1.
    // Full shift = cumulative_shift(0) + duration(2) = 2. 5 - 2 = 3s
    const result3 = remapTimestamps(5000, silenceCuts);
    expect(result3).toBe(3000);

    // Word at 1s (original), before any cut — unchanged
    const result4 = remapTimestamps(1000, silenceCuts);
    expect(result4).toBe(1000);
  });

  // Edge case: timestamp exactly at original_start of a cut
  // Word at exactly 5s — it's at the start of a silence cut (5-7s).
  // Since 5 >= original_start but 5 < original_end (inside the cut),
  // partial shift: cumulative_shift(0) + (5 - 5) = 0. Time stays at 5s.
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
          cumulative_shift: 0,
        },
      ],
    };
    const result = remapTimestamps(5000, silenceCuts);
    // At original_start of cut — partial shift = 0 + (5 - 5) = 0
    expect(result).toBe(5000);
  });

  // Regression test: multi-cut progressive drift (bug where cumulative_shift was
  // used without adding the current cut's duration for timestamps after original_end).
  //
  // The cumulative_shift field represents the shift from all PREVIOUS cuts only.
  // When a timestamp falls AFTER a cut's original_end, the full shift must include
  // that cut's own duration: total_shift = cumulative_shift + cut.duration.
  //
  // Without this fix, timestamps between cuts drift progressively further off:
  // - Word at 7s (between cut 1 and cut 2) would be 7-0=7 instead of 7-2=5
  // - Word at 15s (after cut 2) would be 15-2=13 instead of 15-5=10
  it("remaps correctly across multiple cuts without progressive drift (regression)", () => {
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 2,
      total_silence_removed: 5,
      original_duration: 30,
      new_duration: 25,
      cuts: [
        // Cut 1: 3-5s removed (2s). cumulative_shift=0 (no previous cuts)
        {
          original_start: 3,
          original_end: 5,
          new_start: 3,
          new_end: 3,
          duration: 2,
          source: "both",
          cumulative_shift: 0,
        },
        // Cut 2: 10-13s removed (3s). cumulative_shift=2 (cut 1's duration)
        {
          original_start: 10,
          original_end: 13,
          new_start: 8,
          new_end: 8,
          duration: 3,
          source: "both",
          cumulative_shift: 2,
        },
      ],
    };

    // Word at 2s — before any cut: unchanged
    expect(remapTimestamps(2000, silenceCuts)).toBe(2000);

    // Word at 7s — after cut 1 (original_end=5), before cut 2
    // Applicable cut = cut 1. Full shift = cumulative_shift(0) + duration(2) = 2.
    // Remapped: 7 - 2 = 5s
    expect(remapTimestamps(7000, silenceCuts)).toBe(5000);

    // Word at 9s — after cut 1, before cut 2 starts (but before cut 2's original_start)
    // Applicable cut = cut 1. Full shift = 0 + 2 = 2. Remapped: 9 - 2 = 7s
    expect(remapTimestamps(9000, silenceCuts)).toBe(7000);

    // Word at 15s — after both cuts. Applicable cut = cut 2.
    // Full shift = cumulative_shift(2) + duration(3) = 5. Remapped: 15 - 5 = 10s
    expect(remapTimestamps(15000, silenceCuts)).toBe(10000);

    // Word at 20s — after both cuts. Same applicable cut = cut 2.
    // Full shift = 2 + 3 = 5. Remapped: 20 - 5 = 15s
    expect(remapTimestamps(20000, silenceCuts)).toBe(15000);

    // Also test via remapWordTimestamps for end-to-end correctness
    const words: WhisperWord[] = [
      { word: "before", start: 2, end: 2.5, confidence: 0.9, no_speech_prob: 0.01 },
      { word: "between", start: 7, end: 7.5, confidence: 0.9, no_speech_prob: 0.01 },
      { word: "after", start: 15, end: 15.5, confidence: 0.9, no_speech_prob: 0.01 },
    ];
    const remapped = remapWordTimestamps(words, silenceCuts);
    // "before" — no shift
    expect(remapped[0].start).toBeCloseTo(2, 2);
    expect(remapped[0].end).toBeCloseTo(2.5, 2);
    // "between" at 7s → 7-2=5s
    expect(remapped[1].start).toBeCloseTo(5, 2);
    expect(remapped[1].end).toBeCloseTo(5.5, 2);
    // "after" at 15s → 15-5=10s
    expect(remapped[2].start).toBeCloseTo(10, 2);
    expect(remapped[2].end).toBeCloseTo(10.5, 2);
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
          cumulative_shift: 0,
        },
      ],
    };
    const result = remapWordTimestamps(words, silenceCuts);
    // Word at 5s is at original_end of the cut — remapped: 5 - (0 + 2) = 3
    expect(result[0].start).toBeCloseTo(3, 2);
    // 5.5 is after the cut: 5.5 - (0 + 2) = 3.5
    expect(result[0].end).toBeCloseTo(3.5, 2);
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
          cumulative_shift: 0,
        },
        {
          original_start: 5.5,
          original_end: 8.5,
          new_start: 2.5,
          new_end: 2.5,
          duration: 3,
          source: "both",
          cumulative_shift: 3,
        },
      ],
    };
    const pages = transcriptToCaptionPages(transcript, { silenceCuts });
    // The word at original 5s is after first cut (0-3s).
    // Full shift = cumulative_shift(0) + duration(3) = 3. Remapped: 5 - 3 = 2s
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
          cumulative_shift: 0,
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
          cumulative_shift: 0,
        },
      ],
    };
    const pages = transcriptToCaptionPages(transcript, { silenceCuts });
    expect(pages.length).toBeGreaterThan(0);
    // The word at original 5s is after first cut (0-3s).
    // Full shift = cumulative_shift(0) + duration(3) = 3. Remapped: 5 - 3 = 2s
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
          cumulative_shift: 0,
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
          cumulative_shift: 0,
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
          cumulative_shift: 0,
        },
      ],
    };
    expect(areTimestampsAlreadyRemapped([], silenceCuts)).toBe(false);
  });
});

// ─── remapWordTimestamps: silence cut filtering ────────────────────────────

describe("remapWordTimestamps: words inside silence cuts", () => {
  it("drops words entirely inside a silence cut", () => {
    const words: WhisperWord[] = [
      { word: "before", start: 1, end: 2, confidence: 0.9, no_speech_prob: 0.01 },
      { word: "hallucinated", start: 4, end: 4.5, confidence: 0.3, no_speech_prob: 0.6 },
      { word: "after", start: 7, end: 8, confidence: 0.9, no_speech_prob: 0.01 },
    ];
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 3,
      original_duration: 10,
      new_duration: 7,
      cuts: [
        {
          original_start: 3,
          original_end: 6,
          new_start: 3,
          new_end: 3,
          duration: 3,
          source: "both",
          cumulative_shift: 0,
        },
      ],
    };
    const result = remapWordTimestamps(words, silenceCuts);
    // "hallucinated" (4-4.5s) is entirely inside cut (3-6s) → dropped
    expect(result.length).toBe(2);
    expect(result[0].word).toBe("before");
    expect(result[1].word).toBe("after");
    // "after" at 7s → 7 - (0+3) = 4s
    expect(result[1].start).toBeCloseTo(4, 2);
  });

  it("clips boundary words that start inside cut but extend past it (≥30% after)", () => {
    const words: WhisperWord[] = [
      { word: "real", start: 3.5, end: 5.0, confidence: 0.9, no_speech_prob: 0.01 },
    ];
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 3,
      original_duration: 10,
      new_duration: 7,
      cuts: [
        {
          original_start: 3,
          original_end: 4,
          new_start: 3,
          new_end: 3,
          duration: 1,
          source: "both",
          cumulative_shift: 0,
        },
      ],
    };
    const result = remapWordTimestamps(words, silenceCuts);
    // "real" starts at 3.5 (inside cut 3-4) but ends at 5.0 (after cut).
    // After-cut portion = 5.0 - 4.0 = 1.0s out of 1.5s total = 67% → KEEP, clip start
    expect(result.length).toBe(1);
    expect(result[0].word).toBe("real");
    // Start clipped to cut's original_end (4.0), then remapped: 4.0 - (0+1) = 3.0
    expect(result[0].start).toBeCloseTo(3, 2);
    // End remapped normally: 5.0 - (0+1) = 4.0
    expect(result[0].end).toBeCloseTo(4, 2);
  });

  it("drops boundary words with <30% extending past cut", () => {
    const words: WhisperWord[] = [
      { word: "barely", start: 3.1, end: 3.5, confidence: 0.9, no_speech_prob: 0.01 },
    ];
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 2,
      original_duration: 10,
      new_duration: 8,
      cuts: [
        {
          original_start: 3,
          original_end: 5,
          new_start: 3,
          new_end: 3,
          duration: 2,
          source: "both",
          cumulative_shift: 0,
        },
      ],
    };
    const result = remapWordTimestamps(words, silenceCuts);
    // "barely" starts at 3.1 (inside cut 3-5), ends at 3.5 (still inside, before 5.0)
    // After-cut portion = 0 → dropped
    expect(result.length).toBe(0);
  });
});
// ─── Explicit timeline marker (deterministic remap decision) ──────────────
// Spike 001 / whisper-service-integration: the maxWordEnd<=new_duration heuristic
// silently skips the remap on mid-speech cuts where the last word ends before
// new_duration, causing progressive highlight drift. An explicit transcript.timeline
// field makes the decision deterministic.

describe("explicit timeline marker", () => {
  // A 60s video with a 5s MID-SPEECH cut (5s→10s). A word spoken at original 50s
  // must remap to 45s. But maxWordEnd (50.5) <= new_duration (55) + tolerance (2),
  // so the legacy heuristic WRONGLY classifies it as already-cut and skips the remap.
  const midCutSilence: SilenceCutList = {
    total_segments_removed: 1,
    total_silence_removed: 5,
    original_duration: 60,
    new_duration: 55,
    cuts: [
      {
        original_start: 5,
        original_end: 10,
        new_start: 5,
        new_end: 5,
        duration: 5,
        source: "both",
        cumulative_shift: 0,
      },
    ],
  };
  const wordAt50: WhisperWord = { word: "tarde", start: 50, end: 50.5, confidence: 0.9, no_speech_prob: 0.01 };

  it("DOCUMENTS THE BUG: legacy heuristic wrongly skips remap on a mid-speech cut", () => {
    // No timeline marker → falls back to heuristic → maxWordEnd(50.5) <= 55+2 → skip remap (WRONG)
    expect(areTimestampsAlreadyRemapped([wordAt50], midCutSilence)).toBe(true);
  });

  it("timeline:'original' forces remap regardless of maxWordEnd (the fix)", () => {
    const transcript = {
      language: "es",
      model: "whisperx-large-v3",
      timeline: "original" as const,
      segments: [],
      words: [wordAt50],
      duration: 60,
    };
    const pages = transcriptToCaptionPages(transcript, { silenceCuts: midCutSilence });
    // word at original 50s, after the 5s cut → remapped to 45s (45000ms), NOT left at 50s
    const firstToken = pages[0].tokens[0];
    expect(firstToken.fromMs).toBeGreaterThanOrEqual(44000);
    expect(firstToken.fromMs).toBeLessThanOrEqual(46000);
  });

  it("timeline:'silence-removed' skips remap even when maxWordEnd > new_duration", () => {
    // Word on the cut timeline at 50s; without the marker the heuristic would remap it.
    const transcript = {
      language: "es",
      model: "whisperx-large-v3",
      timeline: "silence-removed" as const,
      segments: [],
      words: [wordAt50],
      duration: 55,
    };
    const bigCut: SilenceCutList = { ...midCutSilence, new_duration: 20 }; // maxWordEnd 50.5 > 20+2
    const pages = transcriptToCaptionPages(transcript, { silenceCuts: bigCut });
    // marker says already-cut → no remap → token stays ~50000ms
    const firstToken = pages[0].tokens[0];
    expect(firstToken.fromMs).toBeGreaterThanOrEqual(49000);
    expect(firstToken.fromMs).toBeLessThanOrEqual(51000);
  });

  it("absent timeline falls back to the heuristic (backward compatible)", () => {
    const transcript = {
      language: "es",
      model: "large-v3",
      segments: [],
      words: [{ word: "Hola", start: 5, end: 5.5, confidence: 0.9, no_speech_prob: 0.01 }],
      duration: 10,
    };
    const sc: SilenceCutList = {
      total_segments_removed: 1, total_silence_removed: 3, original_duration: 10, new_duration: 2,
      cuts: [{ original_start: 0, original_end: 3, new_start: 0, new_end: 0, duration: 3, source: "both", cumulative_shift: 0 }],
    };
    // maxWordEnd 5.5 > 2+2 → heuristic applies remap (unchanged legacy behavior)
    const pages = transcriptToCaptionPages(transcript, { silenceCuts: sc });
    expect(pages.length).toBeGreaterThan(0);
  });
});

// ─── layout durationInFrames formula (Issue B fix) ──────────────────────────

/**
 * Pure arithmetic helper replicating the isLastPage formula from BarLayout.tsx
 * and TikTokLayout.tsx (Plan 16-03 fix). Tests the no-gap duration calculation
 * without importing React or Remotion hooks.
 *
 * Formula (must match exactly what is in the layout files):
 *   isLastPage = i === pages.length - 1
 *   nextPageStartMs = !isLastPage ? pages[i+1].startMs : Infinity
 *   displayEndMs = !isLastPage ? nextPageStartMs : lastTokenEndMs + FADE_OUT_MS
 *   clampedEndMs = (isLastPage && totalDurationMs) ? min(displayEndMs, totalDurationMs) : displayEndMs
 *   durationInFrames = max(1, ceil((clampedEndMs - pages[i].startMs) * fps / 1000))
 */
function computeDuration(
  pages: { startMs: number; tokens: { toMs: number }[] }[],
  i: number,
  fps: number,
  totalDurationMs?: number
): number {
  const FADE_OUT_MS = 300; // matches shared-styles.ts:7
  const isLastPage = i === pages.length - 1;
  const lastTokenEndMs = pages[i].tokens[pages[i].tokens.length - 1].toMs;
  const nextPageStartMs = !isLastPage ? pages[i + 1].startMs : Infinity;
  const displayEndMs = !isLastPage ? nextPageStartMs : lastTokenEndMs + FADE_OUT_MS;
  const clampedEndMs =
    isLastPage && totalDurationMs
      ? Math.min(displayEndMs, totalDurationMs)
      : displayEndMs;
  return Math.max(1, Math.ceil((clampedEndMs - pages[i].startMs) * (fps / 1000)));
}

describe("layout durationInFrames formula (Issue B fix)", () => {
  // Case 1: non-last page with a short gap (40ms) between pages.
  // Old formula: safeEndMs = min(800+300, 840-100) = min(1100, 740) = 740 → duration = ceil((740-0)*30/1000) = ceil(22.2) = 23
  // New formula: displayEndMs = nextPageStartMs = 840 → duration = ceil((840-0)*30/1000) = ceil(25.2) = 26
  it("Case 1 — contiguous pages, short gap (40ms): non-last page extends to next page start", () => {
    const pages = [
      { startMs: 0, tokens: [{ toMs: 800 }] },
      { startMs: 840, tokens: [{ toMs: 1600 }] },
    ];
    const result = computeDuration(pages, 0, 30, undefined);
    expect(result).toBe(26); // ceil((840-0)*30/1000) = ceil(25.2) = 26 — no gap
  });

  // Case 2: last page fades out naturally after final token.
  // displayEndMs = 1600 + 300 = 1900
  // durationInFrames = ceil((1900 - 840) * 30/1000) = ceil(31.8) = 32
  it("Case 2 — last page fades out after final token (FADE_OUT_MS=300ms)", () => {
    const pages = [
      { startMs: 0, tokens: [{ toMs: 800 }] },
      { startMs: 840, tokens: [{ toMs: 1600 }] },
    ];
    const result = computeDuration(pages, 1, 30, undefined);
    expect(result).toBe(32); // ceil((1900-840)*30/1000) = ceil(31.8) = 32
  });

  // Case 3: single page (always the last page), clamped by totalDurationMs.
  // displayEndMs = 2000 + 300 = 2300; totalDurationMs=5000 → clampedEndMs = min(2300,5000) = 2300
  // durationInFrames = ceil((2300 - 100) * 30/1000) = ceil(66) = 66
  it("Case 3 — single page (last) with totalDurationMs larger than fade-out end", () => {
    const pages = [{ startMs: 100, tokens: [{ toMs: 2000 }] }];
    const result = computeDuration(pages, 0, 30, 5000);
    expect(result).toBe(66); // ceil((2300-100)*30/1000) = ceil(66) = 66
  });

  // Case 4: last page where totalDurationMs clamps the fade-out.
  // displayEndMs = 4900 + 300 = 5200; totalDurationMs=5000 → clampedEndMs = min(5200,5000) = 5000
  // durationInFrames = ceil((5000 - 0) * 30/1000) = ceil(150) = 150
  it("Case 4 — last page clamped by totalDurationMs (fade-out extends past video end)", () => {
    const pages = [{ startMs: 0, tokens: [{ toMs: 4900 }] }];
    const result = computeDuration(pages, 0, 30, 5000);
    expect(result).toBe(150); // ceil((5000-0)*30/1000) = ceil(150) = 150
  });
});
