import { describe, it, expect } from "vitest";
import {
  remapTimestamps,
  remapWordTimestamps,
  areTimestampsAlreadyRemapped,
  DETECTION_TOLERANCE_SEC,
} from "../timestamp-remap";
import type { SilenceCutList, WhisperWord } from "../types";

// ─── Test fixtures ──────────────────────────────────────────────────────────

const makeSilenceCuts = (cuts: Array<{
  original_start: number;
  original_end: number;
  new_start: number;
  new_end: number;
  duration: number;
  source: "both" | "ffmpeg" | "whisper";
  cumulative_shift: number;
}>): SilenceCutList => ({
  total_segments_removed: cuts.length,
  total_silence_removed: cuts.reduce((sum, c) => sum + c.duration, 0),
  original_duration: 100,
  new_duration: 100 - cuts.reduce((sum, c) => sum + c.duration, 0),
  cuts,
});

const makeWord = (word: string, start: number, end: number): WhisperWord => ({
  word,
  start,
  end,
  confidence: 0.9,
  no_speech_prob: 0.01,
});

// ─── remapTimestamps ────────────────────────────────────────────────────────

describe("remapTimestamps", () => {
  it("should return original time when silenceCuts is null", () => {
    expect(remapTimestamps(5000, null)).toBe(5000);
  });

  it("should return original time when silenceCuts.cuts is empty", () => {
    const empty = makeSilenceCuts([]);
    expect(remapTimestamps(5000, empty)).toBe(5000);
  });

  it("should return original time for timestamps before the first cut", () => {
    const cuts = makeSilenceCuts([
      {
        original_start: 10,
        original_end: 15,
        new_start: 10,
        new_end: 10,
        duration: 5,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
    ]);
    expect(remapTimestamps(5000, cuts)).toBe(5000); // 5 seconds = 5000ms, before cut at 10s
  });

  it("should apply cumulative_shift + duration for timestamps after a cut", () => {
    const cuts = makeSilenceCuts([
      {
        original_start: 10,
        original_end: 15,
        new_start: 10,
        new_end: 10,
        duration: 5,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
    ]);
    // 20000ms = 20s, after the cut at 10-15s
    // Expected: 20000 - (0 + 5) * 1000 = 15000
    expect(remapTimestamps(20000, cuts)).toBe(15000);
  });

  it("should apply partial shift for timestamps inside a cut", () => {
    const cuts = makeSilenceCuts([
      {
        original_start: 10,
        original_end: 15,
        new_start: 10,
        new_end: 10,
        duration: 5,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
    ]);
    // 12500ms = 12.5s, inside the 10-15s cut
    // Expected: 12500 - (0 + (12.5 - 10)) * 1000 = 12500 - 2500 = 10000
    expect(remapTimestamps(12500, cuts)).toBe(10000);
  });

  it("should handle multiple cuts with cumulative shifts", () => {
    const cuts = makeSilenceCuts([
      {
        original_start: 5,
        original_end: 10,
        new_start: 5,
        new_end: 5,
        duration: 5,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
      {
        original_start: 20,
        original_end: 25,
        new_start: 15,
        new_end: 15,
        duration: 5,
        source: "ffmpeg",
        cumulative_shift: 5,
      },
    ]);
    // 30000ms = 30s, after both cuts
    // cumulative_shift = 5 (from first cut), duration = 5 (second cut) => total shift = 10s
    // Expected: 30000 - (5 + 5) * 1000 = 20000
    expect(remapTimestamps(30000, cuts)).toBe(20000);
  });
});

// ─── remapWordTimestamps ────────────────────────────────────────────────────

describe("remapWordTimestamps", () => {
  it("should return words unchanged when silenceCuts is null", () => {
    const words = [makeWord("hello", 0, 1), makeWord("world", 1, 2)];
    const result = remapWordTimestamps(words, null);
    expect(result).toEqual(words);
  });

  it("should return words unchanged when silenceCuts.cuts is empty", () => {
    const words = [makeWord("hello", 0, 1), makeWord("world", 1, 2)];
    const result = remapWordTimestamps(words, makeSilenceCuts([]));
    expect(result).toEqual(words);
  });

  it("should filter out words entirely inside a silence cut", () => {
    const cuts = makeSilenceCuts([
      {
        original_start: 5,
        original_end: 10,
        new_start: 5,
        new_end: 5,
        duration: 5,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
    ]);
    // Word entirely inside the 5-10s silence (start >= 5, end <= 10, less than 30% extends past)
    const words = [
      makeWord("hello", 6, 7), // entirely inside cut
      makeWord("world", 12, 13), // outside cut
    ];
    const result = remapWordTimestamps(words, cuts);
    expect(result).toHaveLength(1);
    expect(result[0].word).toBe("world");
    // "world" at 12s is after cut: remapped = 12s - (0 + 5s) = 7s
    expect(result[0].start).toBe(7);
    expect(result[0].end).toBe(8);
  });

  it("should remap start/end times for words outside cuts", () => {
    const cuts = makeSilenceCuts([
      {
        original_start: 5,
        original_end: 10,
        new_start: 5,
        new_end: 5,
        duration: 5,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
    ]);
    const words = [makeWord("test", 15, 16)];
    const result = remapWordTimestamps(words, cuts);
    expect(result).toHaveLength(1);
    // 15s is after the 5-10s cut: remapped = 15 - 5 = 10s
    expect(result[0].start).toBe(10);
    expect(result[0].end).toBe(11);
  });

  it("should clip words crossing cut boundary with >=30% retained", () => {
    const cuts = makeSilenceCuts([
      {
        original_start: 5,
        original_end: 10,
        new_start: 5,
        new_end: 5,
        duration: 5,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
    ]);
    // Word starts inside cut (8s) but extends past cut end (10s) by 2s out of 4s total = 50%
    const words = [makeWord("bridge", 8, 12)];
    const result = remapWordTimestamps(words, cuts);
    expect(result).toHaveLength(1);
    // start clipped to cut end (10s), remapped: 10 - 5 = 5s
    // end at 12s, remapped: 12 - 5 = 7s
    expect(result[0].start).toBe(5);
    expect(result[0].end).toBe(7);
    expect(result[0].word).toBe("bridge");
  });
});

// ─── areTimestampsAlreadyRemapped ───────────────────────────────────────────

describe("areTimestampsAlreadyRemapped", () => {
  it("should return true when max word end <= new_duration + tolerance", () => {
    const cuts = makeSilenceCuts([{
      original_start: 5,
      original_end: 10,
      new_start: 5,
      new_end: 5,
      duration: 5,
      source: "ffmpeg",
      cumulative_shift: 0,
    }]);
    // new_duration = 100 - 5 = 95 (from makeSilenceCuts)
    // Words ending at 94s (< 95 + 2.0 = 97) → already remapped
    const words = [makeWord("yes", 0, 94)];
    expect(areTimestampsAlreadyRemapped(words, cuts)).toBe(true);
  });

  it("should return false when max word end > new_duration + tolerance", () => {
    const cuts = makeSilenceCuts([{
      original_start: 5,
      original_end: 10,
      new_start: 5,
      new_end: 5,
      duration: 5,
      source: "ffmpeg",
      cumulative_shift: 0,
    }]);
    // new_duration = 95, tolerance = 2.0
    // Words ending at 100s (> 97) → not remapped
    const words = [makeWord("no", 0, 100)];
    expect(areTimestampsAlreadyRemapped(words, cuts)).toBe(false);
  });

  it("should return false when silenceCuts is null", () => {
    const words = [makeWord("test", 0, 10)];
    expect(areTimestampsAlreadyRemapped(words, null)).toBe(false);
  });

  it("should return false when silenceCuts.cuts is empty", () => {
    const words = [makeWord("test", 0, 10)];
    expect(areTimestampsAlreadyRemapped(words, makeSilenceCuts([]))).toBe(false);
  });

  it("should return false when words array is empty", () => {
    const cuts = makeSilenceCuts([{
      original_start: 5,
      original_end: 10,
      new_start: 5,
      new_end: 5,
      duration: 5,
      source: "ffmpeg",
      cumulative_shift: 0,
    }]);
    expect(areTimestampsAlreadyRemapped([], cuts)).toBe(false);
  });
});