import { describe, it, expect } from "vitest";
import {
  validateManifest,
  validateRemotionInfo,
  validateCaptionPages,
  validateTimestampsRemapped,
  validateRemotionOutput,
  validateSafeZone,
} from "./validate";

// ─── validateManifest ─────────────────────────────────────────────────

describe("validateManifest", () => {
  it("Test 1: passes for valid manifest with status=success and step_name=remotion-renderer", () => {
    const manifest = {
      step_name: "remotion-renderer",
      status: "success",
      input_file: "/data/pipeline/test/input/video.mp4",
      output_files: [],
      duration_seconds: 5.0,
      timestamp: "2026-05-08T00:00:00Z",
      exit_code: 0,
    };
    const errors = validateManifest(manifest);
    expect(errors).toEqual([]);
  });

  it("Test 1: fails when step_name is not remotion-renderer", () => {
    const manifest = {
      step_name: "whisper",
      status: "success",
    };
    const errors = validateManifest(manifest);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes("SUBT-01"))).toBe(true);
  });

  it("Test 1: fails when status is not success", () => {
    const manifest = {
      step_name: "remotion-renderer",
      status: "error",
    };
    const errors = validateManifest(manifest);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes("SUBT-01"))).toBe(true);
  });
});

// ─── validateRemotionInfo ─────────────────────────────────────────────

describe("validateRemotionInfo", () => {
  it("Test 2: passes for valid remotion-info.json with all required fields", () => {
    const info = {
      input_width: 1080,
      input_height: 1920,
      total_words: 10,
      caption_pages: 3,
      silence_cuts_applied: 1,
      bottom_offset: 230,
      codec: "h264",
      fps: 30,
      remotion_info: { use_angle_egl: true },
    };
    const errors = validateRemotionInfo(info);
    expect(errors).toEqual([]);
  });

  it("Test 2: fails when input_width is missing", () => {
    const info = {
      input_height: 1920,
      total_words: 10,
      caption_pages: 3,
    };
    const errors = validateRemotionInfo(info);
    expect(errors.some(e => e.includes("D-09"))).toBe(true);
  });

  it("Test 2: fails when input_height is missing", () => {
    const info = {
      input_width: 1080,
      total_words: 10,
      caption_pages: 3,
    };
    const errors = validateRemotionInfo(info);
    expect(errors.some(e => e.includes("D-09"))).toBe(true);
  });

  it("Test 2: fails when caption_pages is missing", () => {
    const info = {
      input_width: 1080,
      input_height: 1920,
      total_words: 10,
    };
    const errors = validateRemotionInfo(info);
    expect(errors.some(e => e.includes("D-09"))).toBe(true);
  });

  it("D-12: fails when use_angle_egl is missing or false", () => {
    const info = {
      input_width: 1080,
      input_height: 1920,
      caption_pages: 3,
    };
    const errors = validateRemotionInfo(info);
    expect(errors.some(e => e.includes("D-12"))).toBe(true);
  });
});

// ─── validateCaptionPages ─────────────────────────────────────────────

describe("validateCaptionPages", () => {
  it("Test 3: passes for valid caption-pages.json with TikTokPage structure", () => {
    const pages = [
      {
        startMs: 0,
        durationMs: 3000,
        text: "Hola mundo",
        tokens: [
          { text: "Hola", fromMs: 0, toMs: 500 },
          { text: "mundo", fromMs: 600, toMs: 1200 },
        ],
      },
    ];
    const errors = validateCaptionPages(pages);
    expect(errors).toEqual([]);
  });

  it("Test 3: fails when input is not an array", () => {
    const errors = validateCaptionPages("not an array");
    expect(errors.some(e => e.includes("SUBT-01"))).toBe(true);
  });

  it("Test 3: fails when pages array is empty", () => {
    const errors = validateCaptionPages([]);
    expect(errors.some(e => e.includes("SUBT-01"))).toBe(true);
  });

  it("Test 3: fails when page is missing startMs", () => {
    const pages = [
      {
        durationMs: 3000,
        text: "Hola",
        tokens: [{ text: "Hola", fromMs: 0, toMs: 500 }],
      },
    ];
    const errors = validateCaptionPages(pages);
    expect(errors.some(e => e.includes("SUBT-03"))).toBe(true);
  });

  it("Test 3: fails when page has empty text", () => {
    const pages = [
      {
        startMs: 0,
        durationMs: 3000,
        text: "",
        tokens: [{ text: "", fromMs: 0, toMs: 500 }],
      },
    ];
    const errors = validateCaptionPages(pages);
    expect(errors.some(e => e.includes("SUBT-01"))).toBe(true);
  });

  it("Test 3: fails when page.tokens is not an array", () => {
    const pages = [
      {
        startMs: 0,
        durationMs: 3000,
        text: "Hola",
        tokens: "not an array",
      },
    ];
    const errors = validateCaptionPages(pages);
    expect(errors.some(e => e.includes("SUBT-02"))).toBe(true);
  });

  it("Test 3: fails when token is missing fromMs", () => {
    const pages = [
      {
        startMs: 0,
        durationMs: 3000,
        text: "Hola",
        tokens: [{ text: "Hola", toMs: 500 }],
      },
    ];
    const errors = validateCaptionPages(pages);
    expect(errors.some(e => e.includes("SUBT-03"))).toBe(true);
  });
});

// ─── validateTimestampsRemapped ────────────────────────────────────────

describe("validateTimestampsRemapped", () => {
  const silenceCuts = {
    total_segments_removed: 1,
    total_silence_removed: 3,
    original_duration: 10,
    new_duration: 7,
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

  it("Test 4: passes when remapped timestamps differ from original (silence cuts present)", () => {
    const captionPages = [
      {
        startMs: 500,
        durationMs: 3000,
        text: "Hola mundo",
        tokens: [
          { text: "Hola", fromMs: 500, toMs: 800 },
          { text: "mundo", fromMs: 900, toMs: 1200 },
        ],
      },
    ];
    const originalWords = [
      { word: "Hola", start: 3.5, end: 3.8, confidence: 0.95, no_speech_prob: 0.01 },
      { word: "mundo", start: 3.9, end: 4.2, confidence: 0.90, no_speech_prob: 0.02 },
    ];
    const errors = validateTimestampsRemapped(captionPages, originalWords, silenceCuts);
    // Should not error — remapped times are present from ~500ms onward
    // (3.5s - 3s cumulative_shift = 0.5s = 500ms)
    expect(errors.filter(e => e.includes("D-01"))).toEqual([]);
  });

  it("returns no errors when silenceCuts has no cuts", () => {
    const emptyCuts = {
      total_segments_removed: 0,
      total_silence_removed: 0,
      original_duration: 10,
      new_duration: 10,
      cuts: [],
    };
    const errors = validateTimestampsRemapped([], [], emptyCuts);
    expect(errors).toEqual([]);
  });

  it("returns no errors when silenceCuts is null", () => {
    const errors = validateTimestampsRemapped([], [], null);
    expect(errors).toEqual([]);
  });
});

// ─── validateCaptionPagesWithoutSilenceCuts ────────────────────────────

describe("validateCaptionPages without silence cuts (Test 5)", () => {
  it("passes when captions have original timestamps (no remapping needed)", () => {
    // When no silence cuts exist, timestamps should match original word times
    const pages = [
      {
        startMs: 3500,
        durationMs: 2000,
        text: "Hola mundo",
        tokens: [
          { text: "Hola", fromMs: 3500, toMs: 3800 },
          { text: "mundo", fromMs: 3900, toMs: 4200 },
        ],
      },
    ];
    // No validation errors expected — structure is correct
    const errors = validateCaptionPages(pages);
    expect(errors).toEqual([]);
  });
});

// ─── validateSafeZone ─────────────────────────────────────────────────

describe("validateSafeZone (Test 6)", () => {
  it("passes when bottom_offset matches finalizer-info safe_zone.bottom", () => {
    const finalizerInfo = {
      input_width: 1920,
      input_height: 1080,
      output_width: 1080,
      output_height: 1920,
      crop_strategy: "center",
      safe_zone: { top: 100, bottom: 230, left: 54, right: 54 },
    };
    const bottomOffset = 230;
    const errors = validateSafeZone(finalizerInfo, bottomOffset);
    expect(errors).toEqual([]);
  });

  it("fails when bottom_offset does not match finalizer-info safe_zone.bottom", () => {
    const finalizerInfo = {
      input_width: 1920,
      input_height: 1080,
      output_width: 1080,
      output_height: 1920,
      crop_strategy: "center",
      safe_zone: { top: 100, bottom: 230, left: 54, right: 54 },
    };
    const bottomOffset = 250; // mismatch!
    const errors = validateSafeZone(finalizerInfo, bottomOffset);
    expect(errors.some(e => e.includes("D-11"))).toBe(true);
  });

  it("returns no errors when finalizerInfo is null (safe zone wasn't provided)", () => {
    const errors = validateSafeZone(null, 250);
    expect(errors).toEqual([]);
  });
});

// ─── validateCaptionPages: impossible timestamps (fromMs > toMs) ───────

describe("validateCaptionPages: impossible timestamps (fromMs > toMs)", () => {
  it("Test 7: returns error when a token has fromMs > toMs (SUBT-03)", () => {
    const pages = [
      {
        startMs: 0,
        durationMs: 3000,
        text: "Hola mundo",
        tokens: [
          { text: "Hola", fromMs: 5000, toMs: 2000 },
          { text: "mundo", fromMs: 600, toMs: 1200 },
        ],
      },
    ];
    const errors = validateCaptionPages(pages);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes("SUBT-03"))).toBe(true);
    expect(errors.some(e => e.includes("fromMs"))).toBe(true);
    expect(errors.some(e => e.includes("toMs"))).toBe(true);
  });

  it("Test 7: passes when all tokens have fromMs <= toMs", () => {
    const pages = [
      {
        startMs: 0,
        durationMs: 3000,
        text: "Hola mundo",
        tokens: [
          { text: "Hola", fromMs: 0, toMs: 500 },
          { text: "mundo", fromMs: 600, toMs: 1200 },
        ],
      },
    ];
    const errors = validateCaptionPages(pages);
    expect(errors).toEqual([]);
  });

  it("Test 7: identifies multiple tokens with fromMs > toMs across pages", () => {
    const pages = [
      {
        startMs: 0,
        durationMs: 3000,
        text: "Hola mundo",
        tokens: [
          { text: "Hola", fromMs: 0, toMs: 500 },
        ],
      },
      {
        startMs: 3000,
        durationMs: 2000,
        text: "esto es",
        tokens: [
          { text: "esto", fromMs: 8000, toMs: 7000 },
        ],
      },
    ] as Array<Record<string, unknown>>;
    const errors = validateCaptionPages(pages);
    expect(errors.length).toBeGreaterThan(0);
    // Should identify page[1].token[0] specifically
    expect(errors.some(e => e.includes("page[1].tokens[0]"))).toBe(true);
    expect(errors.some(e => e.includes("8000"))).toBe(true);
    expect(errors.some(e => e.includes("7000"))).toBe(true);
  });
});