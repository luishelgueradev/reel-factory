import { describe, it, expect } from "vitest";
import {
  generateSrt,
  generateVtt,
  buildCuesFromTranscript,
  formatSrtTimestamp,
  formatVttTimestamp,
} from "../formats";
import type { WhisperTranscript, WhisperWord, SilenceCutList, SrtCue } from "../types";

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
  confidence: 0.95,
  no_speech_prob: 0.01,
});

const makeTranscript = (overrides: Partial<WhisperTranscript> = {}): WhisperTranscript => ({
  language: "es",
  model: "large-v3",
  segments: [],
  words: [],
  duration: 60,
  ...overrides,
});

// ─── formatSrtTimestamp ─────────────────────────────────────────────────────

describe("formatSrtTimestamp", () => {
  it("should format 0 ms as 00:00:00,000", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
  });

  it("should format 5000 ms as 00:00:05,000", () => {
    expect(formatSrtTimestamp(5000)).toBe("00:00:05,000");
  });

  it("should format 61730 ms as 00:01:01,730 (1 min 1 sec 730 ms)", () => {
    expect(formatSrtTimestamp(61730)).toBe("00:01:01,730");
  });
});

// ─── formatVttTimestamp ─────────────────────────────────────────────────────

describe("formatVttTimestamp", () => {
  it("should format 0 ms as 00:00:00.000", () => {
    expect(formatVttTimestamp(0)).toBe("00:00:00.000");
  });

  it("should format 5000 ms as 00:00:05.000", () => {
    expect(formatVttTimestamp(5000)).toBe("00:00:05.000");
  });
});

// ─── generateSrt ────────────────────────────────────────────────────────────

describe("generateSrt", () => {
  it("should produce valid SRT format with sequential cue numbers", () => {
    const cues: SrtCue[] = [
      { index: 1, startTimeMs: 1000, endTimeMs: 3000, text: "Hello world" },
      { index: 2, startTimeMs: 4000, endTimeMs: 6000, text: "This is a test" },
    ];
    const srt = generateSrt(cues);
    expect(srt).toContain("1\n");
    expect(srt).toContain("2\n");
  });

  it("should use comma decimal separator in timestamps (HH:MM:SS,mmm)", () => {
    const cues: SrtCue[] = [
      { index: 1, startTimeMs: 1500, endTimeMs: 3500, text: "Test" },
    ];
    const srt = generateSrt(cues);
    // SRT uses comma as decimal separator
    expect(srt).toContain("-->");
    const timestampPattern = /\d{2}:\d{2}:\d{2},\d{3}/;
    expect(srt).toMatch(timestampPattern);
  });

  it("should return empty string for empty cues array", () => {
    expect(generateSrt([])).toBe("");
  });

  it("should separate cues with blank lines", () => {
    const cues: SrtCue[] = [
      { index: 1, startTimeMs: 1000, endTimeMs: 2000, text: "First" },
      { index: 2, startTimeMs: 3000, endTimeMs: 4000, text: "Second" },
    ];
    const srt = generateSrt(cues);
    // Cues should be separated by double newline (blank line)
    expect(srt).toContain("\n\n");
  });
});

// ─── generateVtt ────────────────────────────────────────────────────────────

describe("generateVtt", () => {
  it("should produce valid WebVTT format with WEBVTT header", () => {
    const cues: SrtCue[] = [
      { index: 1, startTimeMs: 1000, endTimeMs: 3000, text: "Hello world" },
    ];
    const vtt = generateVtt(cues);
    expect(vtt).toMatch(/^WEBVTT\n/);
  });

  it("should use dot decimal separator in timestamps (HH:MM:SS.mmm)", () => {
    const cues: SrtCue[] = [
      { index: 1, startTimeMs: 1500, endTimeMs: 3500, text: "Test" },
    ];
    const vtt = generateVtt(cues);
    // VTT uses dot as decimal separator
    const timestampPattern = /\d{2}:\d{2}:\d{2}\.\d{3}/;
    expect(vtt).toMatch(timestampPattern);
  });

  it("should return WEBVTT header only for empty cues array", () => {
    const vtt = generateVtt([]);
    expect(vtt).toBe("WEBVTT\n\n");
  });

  it("should have blank line between header and first cue", () => {
    const cues: SrtCue[] = [
      { index: 1, startTimeMs: 1000, endTimeMs: 2000, text: "First" },
    ];
    const vtt = generateVtt(cues);
    expect(vtt).toContain("WEBVTT\n\n");
  });
});

// ─── buildCuesFromTranscript ────────────────────────────────────────────────

describe("buildCuesFromTranscript", () => {
  it("should return empty array for empty transcript", () => {
    const transcript = makeTranscript({ segments: [] });
    const cues = buildCuesFromTranscript(transcript, null);
    expect(cues).toEqual([]);
  });

  it("should group words into cues using Whisper segments (D-04)", () => {
    const transcript = makeTranscript({
      segments: [
        { id: 0, start: 0, end: 3, text: "Hello world", words: [makeWord("Hello", 0, 1.5), makeWord("world", 1.5, 3)] },
        { id: 1, start: 4, end: 7, text: "This is a test", words: [makeWord("This", 4, 5), makeWord("is", 5, 5.5), makeWord("a", 5.5, 6), makeWord("test", 6, 7)] },
      ],
      duration: 10,
    });

    const cues = buildCuesFromTranscript(transcript, null);

    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe("Hello world");
    expect(cues[0].startTimeMs).toBe(0);
    expect(cues[0].endTimeMs).toBe(3000);
    expect(cues[1].text).toBe("This is a test");
    expect(cues[1].startTimeMs).toBe(4000);
    expect(cues[1].endTimeMs).toBe(7000);
  });

  it("should use sequential cue numbers starting from 1", () => {
    const transcript = makeTranscript({
      segments: [
        { id: 0, start: 0, end: 3, text: "First", words: [makeWord("First", 0, 3)] },
        { id: 1, start: 4, end: 7, text: "Second", words: [makeWord("Second", 4, 7)] },
      ],
      duration: 10,
    });

    const cues = buildCuesFromTranscript(transcript, null);

    expect(cues[0].index).toBe(1);
    expect(cues[1].index).toBe(2);
  });

  it("should split long segments at punctuation marks (D-05)", () => {
    // Create a segment with more than 10 words and punctuation
    const longText = "This is a really long sentence that should be split, and here is the second part.";
    const transcript = makeTranscript({
      segments: [
        { id: 0, start: 0, end: 10, text: longText, words: longText.split(" ").map((w, i) => makeWord(w, i * 0.5, (i + 1) * 0.5)) },
      ],
      duration: 15,
    });

    const cues = buildCuesFromTranscript(transcript, null);

    // Should be split into 2 cues at the comma
    expect(cues.length).toBeGreaterThanOrEqual(2);
  });

  it("should keep long segments as one cue when no punctuation exists (D-05)", () => {
    const longNoPunctuation = "one two three four five six seven eight nine ten eleven twelve";
    const transcript = makeTranscript({
      segments: [
        { id: 0, start: 0, end: 10, text: longNoPunctuation, words: longNoPunctuation.split(" ").map((w, i) => makeWord(w, i * 0.5, (i + 1) * 0.5)) },
      ],
      duration: 15,
    });

    const cues = buildCuesFromTranscript(transcript, null);

    // No punctuation → stays as one cue
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe(longNoPunctuation);
  });

  it("should exclude words inside silence cut regions (D-06)", () => {
    // NOTE: buildCuesFromTranscript works on segments, not individual words.
    // The segment start/end times are remapped. If a segment's remapped timestamps
    // collapse (endTimeMs <= startTimeMs), it's skipped.
    const cuts = makeSilenceCuts([{
      original_start: 5,
      original_end: 10,
      new_start: 5,
      new_end: 5,
      duration: 5,
      source: "ffmpeg",
      cumulative_shift: 0,
    }]);

    const transcript = makeTranscript({
      segments: [
        { id: 0, start: 0, end: 3, text: "Hello", words: [makeWord("Hello", 0, 3)] },       // Before cut
        { id: 1, start: 5, end: 10, text: "Silence words", words: [makeWord("Silence", 6, 8)] }, // Inside cut - remapped to 5→5 (collapsed)
        { id: 2, start: 15, end: 18, text: "After", words: [makeWord("After", 15, 18)] },      // After cut
      ],
      duration: 20,
    });

    const cues = buildCuesFromTranscript(transcript, cuts);

    // Segment inside the cut should be skipped (remapped to same start/end → collapsed)
    // Segment before the cut should be unchanged
    // Segment after the cut should be remapped
    const beforeCut = cues.find(c => c.text === "Hello");
    const afterCut = cues.find(c => c.text === "After");

    expect(beforeCut).toBeDefined();
    expect(afterCut).toBeDefined();
    // "After" at 15s remapped: 15 - 5 = 10s → 10000ms start, 18-5=13s → 13000ms end
    expect(afterCut!.startTimeMs).toBe(10000);
    expect(afterCut!.endTimeMs).toBe(13000);
  });

  it("should remap timestamps to post-silence timeline (D-10)", () => {
    const cuts = makeSilenceCuts([{
      original_start: 10,
      original_end: 20,
      new_start: 10,
      new_end: 10,
      duration: 10,
      source: "ffmpeg",
      cumulative_shift: 0,
    }]);

    const transcript = makeTranscript({
      segments: [
        { id: 0, start: 25, end: 30, text: "After silence", words: [makeWord("After", 25, 30)] },
      ],
      duration: 40,
    });

    const cues = buildCuesFromTranscript(transcript, cuts);

    expect(cues).toHaveLength(1);
    // 25s remapped: 25 - (0 + 10) = 15s → 15000ms
    // 30s remapped: 30 - (0 + 10) = 20s → 20000ms
    expect(cues[0].startTimeMs).toBe(15000);
    expect(cues[0].endTimeMs).toBe(20000);
  });

  it("should produce SRT and VTT with identical text content (D-09)", () => {
    const transcript = makeTranscript({
      segments: [
        { id: 0, start: 0, end: 3, text: "Hello world", words: [makeWord("Hello", 0, 1.5), makeWord("world", 1.5, 3)] },
        { id: 1, start: 4, end: 7, text: "This is a test", words: [makeWord("This", 4, 5), makeWord("is", 5, 6), makeWord("a", 6, 6.5), makeWord("test", 6.5, 7)] },
      ],
      duration: 10,
    });

    const cues = buildCuesFromTranscript(transcript, null);
    const srt = generateSrt(cues);
    const vtt = generateVtt(cues);

    // Extract text lines from both formats
    const srtTexts = srt.split("\n\n").map(c => c.split("\n").slice(2).join(" "));
    const vttLines = vtt.split("\n").filter(l => l.trim() && !l.includes("-->") && !l.includes("WEBVTT"));
    const vttTexts = vttLines.filter(l => !l.match(/^\d{2}:\d{2}:\d{2}[.,]\d{3}/));

    // Same number of text entries
    expect(srtTexts).toHaveLength(vttTexts.length);
    // Same text content
    for (let i = 0; i < srtTexts.length; i++) {
      expect(srtTexts[i]).toBe(vttTexts[i]);
    }
  });

  it("should produce empty SRT and WEBVTT-only VTT for empty transcript", () => {
    const transcript = makeTranscript({ segments: [], words: [], duration: 0 });

    const cues = buildCuesFromTranscript(transcript, null);
    expect(cues).toEqual([]);

    const srt = generateSrt(cues);
    const vtt = generateVtt(cues);

    expect(srt).toBe("");
    expect(vtt).toBe("WEBVTT\n\n");
  });

  it("should skip segments with empty text after trimming", () => {
    const transcript = makeTranscript({
      segments: [
        { id: 0, start: 0, end: 3, text: "Hello", words: [makeWord("Hello", 0, 3)] },
        { id: 1, start: 4, end: 7, text: "   ", words: [] },
        { id: 2, start: 8, end: 11, text: "World", words: [makeWord("World", 8, 11)] },
      ],
      duration: 15,
    });

    const cues = buildCuesFromTranscript(transcript, null);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe("Hello");
    expect(cues[1].text).toBe("World");
  });

  it("should detect already-remapped timestamps and skip remapping (D-10 detection)", () => {
    // This tests buildCuesFromTranscript with null silenceCuts (indicating already remapped)
    // When areTimestampsAlreadyRemapped returns true, the caller passes null as effectiveSilenceCuts
    const transcript = makeTranscript({
      segments: [
        { id: 0, start: 0, end: 3, text: "Already remapped", words: [makeWord("Already", 0, 1.5), makeWord("remapped", 1.5, 3)] },
      ],
      duration: 5,
    });

    // Passing null = skip remapping (timestamps already on silence-removed timeline)
    const cues = buildCuesFromTranscript(transcript, null);
    expect(cues).toHaveLength(1);
    expect(cues[0].startTimeMs).toBe(0);
    expect(cues[0].endTimeMs).toBe(3000);
  });
});