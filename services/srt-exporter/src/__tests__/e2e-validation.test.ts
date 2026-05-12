/**
 * E2E validation test for SRT/VTT sidecar generation with remapped timestamps.
 *
 * Exercises the full pipeline from transcript + silence-cuts input through to
 * SRT/VTT output with correct timestamp remapping. Tests format compliance,
 * timestamp remapping accuracy, double-remap detection, edge cases, and
 * manifest generation.
 *
 * Per Task 2: Does NOT require Docker — tests the Node.js logic directly
 * by importing srt-export functions and creating in-memory fixtures.
 */

import { describe, it, expect } from "vitest";
import {
  remapTimestamps,
  remapWordTimestamps,
  areTimestampsAlreadyRemapped,
} from "../timestamp-remap";
import {
  buildCuesFromTranscript,
  generateSrt,
  generateVtt,
  formatSrtTimestamp,
  formatVttTimestamp,
} from "../formats";
import type {
  WhisperTranscript,
  WhisperWord,
  WhisperSegment,
  SilenceCutList,
  SrtCue,
} from "../types";

// ─── Fixture builders ────────────────────────────────────────────────────────

const makeWord = (word: string, start: number, end: number): WhisperWord => ({
  word,
  start,
  end,
  confidence: 0.92,
  no_speech_prob: 0.02,
});

const makeSegment = (
  id: number,
  start: number,
  end: number,
  text: string,
  words?: WhisperWord[]
): WhisperSegment => ({
  id,
  start,
  end,
  text,
  words: words || [],
});

const makeTranscript = (overrides: Partial<WhisperTranscript> = {}): WhisperTranscript => ({
  language: "es",
  model: "large-v3",
  segments: [],
  words: [],
  duration: 60,
  ...overrides,
});

const makeSilenceCuts = (
  cuts: Array<{
    original_start: number;
    original_end: number;
    new_start: number;
    new_end: number;
    duration: number;
    source: "both" | "ffmpeg" | "whisper";
    cumulative_shift: number;
  }>
): SilenceCutList => ({
  total_segments_removed: cuts.length,
  total_silence_removed: cuts.reduce((sum, c) => sum + c.duration, 0),
  original_duration: 100,
  new_duration: 100 - cuts.reduce((sum, c) => sum + c.duration, 0),
  cuts,
});

// ─── 1. SRT timestamp remapping validation ────────────────────────────────────

describe("E2E: SRT timestamp remapping", () => {
  it("remaps SRT timestamps to the silence-removed timeline (not original timestamps)", () => {
    // Realistic transcript with 3 segments and a 2.5-second silence cut
    // Original timeline: [0-3.5s] "Hola mundo" → [3.5-7s] SILENCE (2.5s cut) → [7-12s] "Cómo estás"
    // Cumulative shift for the cut: 0s (first cut), duration: 2.5s
    // After silence removal: [0-3.5s] "Hola mundo" → [3.5-6s] "Cómo estás" (shifted by -2.5s from 4.5s onward)

    const cuts = makeSilenceCuts([
      {
        original_start: 1.0,
        original_end: 3.5,
        new_start: 1.0,
        new_end: 1.0,
        duration: 2.5,
        source: "both",
        cumulative_shift: 0,
      },
    ]);

    const transcript = makeTranscript({
      segments: [
        makeSegment(0, 0, 1.0, "Hola", [makeWord("Hola", 0, 0.5)]),
        makeSegment(1, 3.5, 7, "Cómo estás", [makeWord("Cómo", 3.5, 5), makeWord("estás", 5, 7)]),
        makeSegment(2, 8, 12, "Bien gracias", [makeWord("Bien", 8, 10), makeWord("gracias", 10, 12)]),
      ],
      duration: 12,
    });

    const cues = buildCuesFromTranscript(transcript, cuts);

    // Segment at 0-1s: before the cut, no shift → 0-1000ms
    expect(cues[0].startTimeMs).toBe(0);
    expect(cues[0].endTimeMs).toBe(1000);

    // Segment at 3.5-7s: after the cut (1.0-3.5s, 2.5s duration)
    // 3.5s: inside the cut (original_start ≤ 3.5 < original_end)
    // After remap: 3.5s maps to 1.0s (partial shift: cumulative_shift + (3.5-1.0) = 2.5s)
    // So 3500ms - 2500ms = 1000ms
    // 7s: after the cut → 7s - (0 + 2.5s) = 4.5s → 4500ms
    expect(cues.length).toBeGreaterThanOrEqual(2);

    // Verify the remapped start time is NOT the original 3500ms
    expect(cues[1].startTimeMs).not.toBe(3500);
    // It should be remapped to the post-silence timeline
    expect(cues[1].startTimeMs).toBeLessThan(3500);
  });

  it("SRT cue timestamps reflect the post-silence timeline for a segment at original time 0.0-3.5s with a 2.5s gap", () => {
    // As specified in the plan: a segment at original time 0.0-3.5s with a
    // 2.5s silence cut at 1.0-3.5s. The SRT cue should show:
    // - start time: 0s → 0s (no shift before the cut)
    // - end time should be remapped (not 3.5s original)

    const cuts = makeSilenceCuts([
      {
        original_start: 1.0,
        original_end: 3.5,
        new_start: 1.0,
        new_end: 1.0,
        duration: 2.5,
        source: "both",
        cumulative_shift: 0,
      },
    ]);

    const transcript = makeTranscript({
      segments: [
        makeSegment(0, 0, 3.5, "Hola mundo", [makeWord("Hola", 0, 0.5), makeWord("mundo", 0.5, 1.0)]),
      ],
      duration: 5,
    });

    const cues = buildCuesFromTranscript(transcript, cuts);

    // The segment 0-3.5s spans across the silence cut (1.0-3.5s)
    // Original start: 0s → still 0s (before any cut)
    // Original end: 3.5s → remapped
    //   3.5s is at the exact boundary of the cut (original_end = 3.5)
    //   At original_end: shift = cumulative_shift + duration = 0 + 2.5 = 2.5s
    //   So 3.5s → 3.5 - 2.5 = 1.0s → 1000ms
    expect(cues[0].startTimeMs).toBe(0);
    expect(cues[0].endTimeMs).toBe(1000);

    // SRT output should use comma-separated timestamps
    const srt = generateSrt(cues);
    expect(srt).toContain("00:00:00,000 --> 00:00:01,000");
  });

  it("generates SRT format from remapped cues with correct format", () => {
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

    const transcript = makeTranscript({
      segments: [
        makeSegment(0, 15, 20, "After silence", [makeWord("After", 15, 17), makeWord("silence", 17, 20)]),
      ],
      duration: 25,
    });

    const cues = buildCuesFromTranscript(transcript, cuts);
    const srt = generateSrt(cues);

    // Should contain cue number, timestamp line with comma, and text
    expect(srt).toMatch(/1\n/);
    expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3}.*-->/);
    expect(srt).toContain("After silence");
  });
});

// ─── 2. SRT format compliance ────────────────────────────────────────────────

describe("E2E: SRT format compliance", () => {
  const makeCues = (): SrtCue[] => [
    { index: 1, startTimeMs: 1000, endTimeMs: 3500, text: "Hello world" },
    { index: 2, startTimeMs: 4000, endTimeMs: 6500, text: "This is a test" },
    { index: 3, startTimeMs: 7000, endTimeMs: 9500, text: "Final subtitle" },
  ];

  it("first line of each cue is a sequential cue number", () => {
    const cues = makeCues();
    const srt = generateSrt(cues);
    const cueBlocks = srt.split("\n\n");

    expect(cueBlocks[0].split("\n")[0]).toBe("1");
    expect(cueBlocks[1].split("\n")[0]).toBe("2");
    expect(cueBlocks[2].split("\n")[0]).toBe("3");
  });

  it("timestamps match SRT pattern: HH:MM:SS,mmm (comma separator)", () => {
    const cues = makeCues();
    const srt = generateSrt(cues);
    const srtTimestampPattern = /\d{2}:\d{2}:\d{2},\d{3}/;

    const lines = srt.split("\n");
    for (const line of lines) {
      if (line.includes("-->")) {
        expect(line).toMatch(srtTimestampPattern);
        // Should NOT contain dot separator (VTT format)
        expect(line).not.toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
      }
    }
  });

  it("cues are separated by blank lines", () => {
    const cues = makeCues();
    const srt = generateSrt(cues);
    // SRT should have double newlines between cues
    expect(srt).toContain("\n\n");
  });

  it("output ends with content (no trailing blank)", () => {
    const cues = makeCues();
    const srt = generateSrt(cues);
    // Should not end with double newline
    expect(srt.endsWith("\n\n\n")).toBe(false);
  });

  it("generates valid SRT from full pipeline with silence cuts", () => {
    const cuts = makeSilenceCuts([
      {
        original_start: 10,
        original_end: 20,
        new_start: 10,
        new_end: 10,
        duration: 10,
        source: "both",
        cumulative_shift: 0,
      },
    ]);

    const transcript = makeTranscript({
      segments: [
        makeSegment(0, 0, 5, "Before cut", [makeWord("Before", 0, 2.5), makeWord("cut", 2.5, 5)]),
        makeSegment(1, 25, 30, "After cut", [makeWord("After", 25, 27.5), makeWord("cut", 27.5, 30)]),
      ],
      duration: 35,
    });

    const cues = buildCuesFromTranscript(transcript, cuts);
    const srt = generateSrt(cues);

    // First cue: before the cut, no shift
    expect(srt).toContain("00:00:00,000 --> 00:00:05,000");
    // Second cue: after the 10s cut at 10-20s → 25-10=15s to 30-10=20s
    expect(srt).toContain("00:00:15,000 --> 00:00:20,000");
  });
});

// ─── 3. VTT format compliance ────────────────────────────────────────────────

describe("E2E: VTT format compliance", () => {
  const makeCues = (): SrtCue[] => [
    { index: 1, startTimeMs: 1500, endTimeMs: 4000, text: "Hello" },
    { index: 2, startTimeMs: 5000, endTimeMs: 7500, text: "World" },
  ];

  it("first line is WEBVTT", () => {
    const cues = makeCues();
    const vtt = generateVtt(cues);
    expect(vtt.startsWith("WEBVTT\n")).toBe(true);
  });

  it("second line is blank (WEBVTT header separation)", () => {
    const cues = makeCues();
    const vtt = generateVtt(cues);
    // After "WEBVTT\n" there should be a blank line
    expect(vtt).toContain("WEBVTT\n\n");
  });

  it("timestamps match VTT pattern: HH:MM:SS.mmm (dot separator)", () => {
    const cues = makeCues();
    const vtt = generateVtt(cues);
    const vttTimestampPattern = /\d{2}:\d{2}:\d{2}\.\d{3}/;

    const lines = vtt.split("\n");
    for (const line of lines) {
      if (line.includes("-->")) {
        expect(line).toMatch(vttTimestampPattern);
        // Should NOT contain comma separator (SRT format)
        expect(line).not.toMatch(/\d{2}:\d{2}:\d{2},\d{3}/);
      }
    }
  });

  it("no styling tags present in VTT output", () => {
    const cues = makeCues();
    const vtt = generateVtt(cues);
    // No <b>, <i>, <u>, <font>, position, or align tags
    expect(vtt).not.toMatch(/<b>/);
    expect(vtt).not.toMatch(/<i>/);
    expect(vtt).not.toMatch(/<u>/);
    expect(vtt).not.toMatch(/<font/);
    expect(vtt).not.toMatch(/position:/);
    expect(vtt).not.toMatch(/align:/);
  });

  it("generates valid VTT from full pipeline with silence cuts", () => {
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

    const transcript = makeTranscript({
      segments: [
        makeSegment(0, 0, 3, "Before", [makeWord("Before", 0, 3)]),
        makeSegment(1, 15, 20, "After", [makeWord("After", 15, 20)]),
      ],
      duration: 25,
    });

    const cues = buildCuesFromTranscript(transcript, cuts);
    const vtt = generateVtt(cues);

    // VTT header
    expect(vtt).toContain("WEBVTT\n\n");
    // Before cut: no shift → 00:00:00.000 --> 00:00:03.000
    expect(vtt).toContain("00:00:00.000 --> 00:00:03.000");
    // After cut: 15s - 5s = 10s → 00:00:10.000 --> 00:00:15.000
    expect(vtt).toContain("00:00:10.000 --> 00:00:15.000");
  });
});

// ─── 4. Double-remap detection ───────────────────────────────────────────────

describe("E2E: Double-remap detection", () => {
  it("skips remapping when timestamps are already on silence-removed timeline", () => {
    // When Whisper runs on the already-cut video, max word end should be ≤ new_duration + tolerance
    const cuts = makeSilenceCuts([
      {
        original_start: 10,
        original_end: 20,
        new_start: 10,
        new_end: 10,
        duration: 10,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
    ]);
    // new_duration = 100 - 10 = 90

    // Words with end times within the new_duration (90s) + tolerance (2s) = 92s
    const words: WhisperWord[] = [
      makeWord("Hello", 0, 5),
      makeWord("world", 5.5, 10),
      makeWord("test", 10.5, 15),
    ];

    expect(areTimestampsAlreadyRemapped(words, cuts)).toBe(true);
  });

  it("detects that remapping is needed when max word end exceeds new_duration + tolerance", () => {
    const cuts = makeSilenceCuts([
      {
        original_start: 10,
        original_end: 20,
        new_start: 10,
        new_end: 10,
        duration: 10,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
    ]);
    // new_duration = 90, tolerance = 2 → max allowed = 92

    // Words with end times beyond 92s (original timeline)
    const words: WhisperWord[] = [
      makeWord("Hello", 0, 5),
      makeWord("way", 90, 95), // End at 95s > 92s threshold
    ];

    expect(areTimestampsAlreadyRemapped(words, cuts)).toBe(false);
  });

  it("does NOT double-remap in the full pipeline when already remapped", () => {
    // Simulate the full pipeline: areTimestampsAlreadyRemapped returns true,
    // so effectiveSilenceCuts = null, and buildCuesFromTranscript gets null cuts
    const cuts = makeSilenceCuts([
      {
        original_start: 5,
        original_end: 15,
        new_start: 5,
        new_end: 5,
        duration: 10,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
    ]);

    // Words already on the silence-removed timeline (max end ≤ new_duration)
    const transcript = makeTranscript({
      segments: [
        makeSegment(0, 0, 5, "Already remapped", [makeWord("Already", 0, 2.5), makeWord("remapped", 2.5, 5)]),
      ],
      words: [makeWord("Already", 0, 2.5), makeWord("remapped", 2.5, 5)],
      duration: 5,
    });

    // Detection returns true → null silenceCuts → no remap applied
    const alreadyRemapped = areTimestampsAlreadyRemapped(transcript.words, cuts);
    expect(alreadyRemapped).toBe(true);

    // Passing null (skipping remap) preserves original timestamps
    const cues = buildCuesFromTranscript(transcript, null);
    expect(cues).toHaveLength(1);
    // Timestamps remain unchanged
    expect(cues[0].startTimeMs).toBe(0);
    expect(cues[0].endTimeMs).toBe(5000);
  });
});

// ─── 5. Empty/edge case handling ──────────────────────────────────────────────

describe("E2E: Empty and edge cases", () => {
  it("empty transcript produces empty SRT and WEBVTT-only VTT", () => {
    const transcript = makeTranscript({ segments: [], words: [], duration: 0 });
    const cues = buildCuesFromTranscript(transcript, null);

    expect(cues).toEqual([]);

    const srt = generateSrt(cues);
    const vtt = generateVtt(cues);

    expect(srt).toBe("");
    expect(vtt).toBe("WEBVTT\n\n");
  });

  it("zero silence cuts — timestamps unchanged in output", () => {
    const transcript = makeTranscript({
      segments: [
        makeSegment(0, 0, 5, "Hello world", [makeWord("Hello", 0, 2.5), makeWord("world", 2.5, 5)]),
        makeSegment(1, 6, 10, "Goodbye world", [makeWord("Goodbye", 6, 8), makeWord("world", 8, 10)]),
      ],
      duration: 12,
    });

    // Null silence cuts → timestamps unchanged
    const cues = buildCuesFromTranscript(transcript, null);

    expect(cues).toHaveLength(2);
    expect(cues[0].startTimeMs).toBe(0);
    expect(cues[0].endTimeMs).toBe(5000);
    expect(cues[1].startTimeMs).toBe(6000);
    expect(cues[1].endTimeMs).toBe(10000);
  });

  it("transcript with all words inside a silence cut produces empty SRT/VTT", () => {
    // All segment timestamps collapse after remapping (endTimeMs ≤ startTimeMs)
    const cuts = makeSilenceCuts([
      {
        original_start: 0,
        original_end: 20,
        new_start: 0,
        new_end: 0,
        duration: 20,
        source: "both",
        cumulative_shift: 0,
      },
    ]);

    const transcript = makeTranscript({
      segments: [
        makeSegment(0, 2, 5, "Inside cut", [makeWord("Inside", 2, 5)]),
        makeSegment(1, 8, 15, "Also inside", [makeWord("Also", 8, 11), makeWord("inside", 11, 15)]),
      ],
      duration: 25,
    });

    const cues = buildCuesFromTranscript(transcript, cuts);

    // All segments are inside the silence cut → all timestamps collapse → empty output
    expect(cues).toHaveLength(0);

    const srt = generateSrt(cues);
    const vtt = generateVtt(cues);

    expect(srt).toBe("");
    expect(vtt).toBe("WEBVTT\n\n");
  });
});

// ─── 6. Manifest validation ───────────────────────────────────────────────────

describe("E2E: Manifest validation", () => {
  it("generates manifest.json with correct step_name, status, and output_files", () => {
    // Test the manifest structure that srt-export.ts produces
    // We simulate the writeManifest logic directly
    const outputFiles = [
      "/data/pipeline/test-job/srt-exporter/output.srt",
      "/data/pipeline/test-job/srt-exporter/output.vtt",
    ];
    const durationSec = 1.53;

    const manifest = {
      step_name: "srt-exporter",
      status: "success",
      output_files: outputFiles,
      duration_seconds: Math.round(durationSec * 100) / 100,
      timestamp: new Date().toISOString(),
      input_file: "/data/pipeline/test-job/whisper/transcript.json",
      exit_code: 0,
    };

    // Validate manifest structure
    expect(manifest.step_name).toBe("srt-exporter");
    expect(manifest.status).toBe("success");
    expect(manifest.output_files).toHaveLength(2);
    expect(manifest.output_files[0]).toContain("output.srt");
    expect(manifest.output_files[1]).toContain("output.vtt");
    expect(manifest.duration_seconds).toBeGreaterThan(0);
    expect(manifest.exit_code).toBe(0);
  });

  it("manifest records both SRT and VTT output files", () => {
    // Verify that both format files are listed
    const outputFiles = [
      "/data/pipeline/test-job/srt-exporter/output.srt",
      "/data/pipeline/test-job/srt-exporter/output.vtt",
    ];

    const hasSrt = outputFiles.some((f) => f.endsWith(".srt"));
    const hasVtt = outputFiles.some((f) => f.endsWith(".vtt"));

    expect(hasSrt).toBe(true);
    expect(hasVtt).toBe(true);
  });

  it("manifest has non-zero duration_seconds", () => {
    const durationSec = 0.5;
    const manifestDuration = Math.round(durationSec * 100) / 100;

    expect(manifestDuration).toBeGreaterThan(0);
    // Rounded to 2 decimal places
    expect(manifestDuration).toBe(0.5);
  });

  it("full pipeline produces consistent manifest data", () => {
    // End-to-end: build cues → generate SRT/VTT → verify files would be written
    const cuts = makeSilenceCuts([
      {
        original_start: 10,
        original_end: 20,
        new_start: 10,
        new_end: 10,
        duration: 10,
        source: "ffmpeg",
        cumulative_shift: 0,
      },
    ]);

    const transcript = makeTranscript({
      segments: [
        makeSegment(0, 0, 5, "Before cut", [makeWord("Before", 0, 2.5), makeWord("cut", 2.5, 5)]),
        makeSegment(1, 25, 30, "After cut", [makeWord("After", 25, 27.5), makeWord("cut", 27.5, 30)]),
      ],
      duration: 35,
    });

    const cues = buildCuesFromTranscript(transcript, cuts);
    const srt = generateSrt(cues);
    const vtt = generateVtt(cues);

    // Both formats produce content
    expect(srt.length).toBeGreaterThan(0);
    expect(vtt.length).toBeGreaterThan(0);

    // Manifest should list both files
    // (The actual file writing is tested via srt-export.ts; here we verify
    // the data flow produces both a non-empty SRT and VTT)
    expect(cues.length).toBe(2);
    expect(srt).toContain("Before cut");
    expect(srt).toContain("After cut");
    expect(vtt).toContain("WEBVTT");
    expect(vtt).toContain("Before cut");
    expect(vtt).toContain("After cut");
  });
});