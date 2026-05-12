import { describe, it, expect } from "vitest";
import {
  validateManifest,
  validateRemotionInfo,
  validateCaptionPages,
  validateTimestampsRemapped,
  validateRemotionOutput,
  validateSafeZone,
  validateVisualEffectsConfig,
  validateZoomEvents,
  validateTransitionEvents,
  validateVisualLayerOrder,
  validateZoomDetection,
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

// ─── validateVisualEffectsConfig (VISU-03, VISU-04, D-12) ──────────────

describe("validateVisualEffectsConfig", () => {
  it("passes for null config (D-12: absent means defaults apply)", () => {
    const errors = validateVisualEffectsConfig(null);
    expect(errors).toEqual([]);
  });

  it("passes for undefined config (D-12: absent means defaults apply)", () => {
    const errors = validateVisualEffectsConfig(undefined);
    expect(errors).toEqual([]);
  });

  it("passes for valid full visualEffects config", () => {
    const config = {
      zooms: {
        enabled: true,
        confidenceThreshold: 0.6,
        maxScale: 1.15,
        rampMs: 300,
        mergeGapMs: 500,
      },
      transitions: {
        enabled: true,
        type: "zoom",
        durationMs: 250,
        maxScale: 1.08,
        shiftPx: 20,
      },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors).toEqual([]);
  });

  it("passes for valid minimal config (only zooms.enabled=false, D-12)", () => {
    const config = {
      zooms: { enabled: false },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors).toEqual([]);
  });

  it("passes for valid minimal config (only transitions.enabled=false)", () => {
    const config = {
      transitions: { enabled: false },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors).toEqual([]);
  });

  it("passes for empty object (no zooms or transitions overrides)", () => {
    const errors = validateVisualEffectsConfig({});
    expect(errors).toEqual([]);
  });

  it("fails when config is an array (not an object)", () => {
    const errors = validateVisualEffectsConfig([1, 2, 3]);
    expect(errors.some(e => e.includes("VISU-03"))).toBe(true);
  });

  it("fails when zooms.confidenceThreshold is out of range (above 1)", () => {
    const config = {
      zooms: { confidenceThreshold: 1.5 },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-03") && e.includes("confidenceThreshold"))).toBe(true);
  });

  it("fails when zooms.confidenceThreshold is negative", () => {
    const config = {
      zooms: { confidenceThreshold: -0.1 },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-03") && e.includes("confidenceThreshold"))).toBe(true);
  });

  it("fails when zooms.maxScale is <= 1.0", () => {
    const config = {
      zooms: { maxScale: 0.9 },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-03") && e.includes("maxScale"))).toBe(true);
  });

  it("fails when zooms.rampMs is not positive", () => {
    const config = {
      zooms: { rampMs: 0 },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-03") && e.includes("rampMs"))).toBe(true);
  });

  it("fails when zooms.mergeGapMs is negative", () => {
    const config = {
      zooms: { mergeGapMs: -10 },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-03") && e.includes("mergeGapMs"))).toBe(true);
  });

  it("fails when zooms.enabled is not a boolean", () => {
    const config = {
      zooms: { enabled: "yes" },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-03") && e.includes("enabled") && e.includes("boolean"))).toBe(true);
  });

  it("fails when zooms is not an object", () => {
    const config = {
      zooms: "invalid",
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-03") && e.includes("zooms must be an object"))).toBe(true);
  });

  it("fails when transitions.type is invalid (VISU-04)", () => {
    const config = {
      transitions: { type: "dissolve" },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-04") && e.includes("type"))).toBe(true);
  });

  it("fails when transitions.durationMs is not positive (VISU-04)", () => {
    const config = {
      transitions: { durationMs: 0 },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-04") && e.includes("durationMs"))).toBe(true);
  });

  it("fails when transitions.maxScale is <= 1.0 (VISU-04)", () => {
    const config = {
      transitions: { maxScale: 1.0 },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-04") && e.includes("maxScale"))).toBe(true);
  });

  it("fails when transitions.shiftPx is not positive (VISU-04)", () => {
    const config = {
      transitions: { shiftPx: 0 },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-04") && e.includes("shiftPx"))).toBe(true);
  });

  it("fails when transitions is not an object (VISU-04)", () => {
    const config = {
      transitions: 42,
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-04") && e.includes("transitions must be an object"))).toBe(true);
  });

  it("fails when transitions.enabled is not a boolean (VISU-04)", () => {
    const config = {
      transitions: { enabled: 1 },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors.some(e => e.includes("VISU-04") && e.includes("enabled") && e.includes("boolean"))).toBe(true);
  });

  // D-12: Test that disabling zooms produces no zoom-related validation errors
  it("D-12: passes with zooms.enabled=false (zooms disabled)", () => {
    const config = {
      zooms: { enabled: false },
      transitions: { enabled: false, type: "none" },
    };
    const errors = validateVisualEffectsConfig(config);
    expect(errors).toEqual([]);
  });
});

// ─── validateZoomEvents (VISU-03) ──────────────────────────────────────

describe("validateZoomEvents", () => {
  it("returns no errors when remotion-info.json doesn't exist", () => {
    const errors = validateZoomEvents("/nonexistent/path");
    expect(errors).toEqual([]);
  });

  it("returns no errors when visual_effects section is missing", () => {
    // This tests the "version before Phase 7" case
    const tmpDir = `/tmp/validate-test-zoom-${Date.now()}`;
    const fs = require("fs");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(`${tmpDir}/remotion-info.json`, JSON.stringify({
      input_width: 1080,
      input_height: 1920,
      caption_pages: 3,
    }));
    const errors = validateZoomEvents(tmpDir);
    expect(errors).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("passes when visual_effects has valid zoom_count", () => {
    const tmpDir = `/tmp/validate-test-zoom-${Date.now()}`;
    const fs = require("fs");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(`${tmpDir}/remotion-info.json`, JSON.stringify({
      input_width: 1080,
      input_height: 1920,
      caption_pages: 3,
      visual_effects: {
        zoom_count: 5,
        transition_count: 2,
        zoom_enabled: true,
        transition_type: "zoom",
        confidence_threshold: 0.6,
      },
    }));
    const errors = validateZoomEvents(tmpDir);
    expect(errors.filter(e => e.includes("VISU-03"))).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("fails when zoom_count is negative (VISU-03)", () => {
    const tmpDir = `/tmp/validate-test-zoom-${Date.now()}`;
    const fs = require("fs");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(`${tmpDir}/remotion-info.json`, JSON.stringify({
      input_width: 1080,
      input_height: 1920,
      caption_pages: 3,
      visual_effects: {
        zoom_count: -1,
        transition_count: 0,
        zoom_enabled: true,
        transition_type: "zoom",
      },
    }));
    const errors = validateZoomEvents(tmpDir);
    expect(errors.some(e => e.includes("VISU-03") && e.includes("zoom_count"))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("fails when zoom_count is not a number (VISU-03)", () => {
    const tmpDir = `/tmp/validate-test-zoom-${Date.now()}`;
    const fs = require("fs");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(`${tmpDir}/remotion-info.json`, JSON.stringify({
      input_width: 1080,
      input_height: 1920,
      caption_pages: 3,
      visual_effects: {
        zoom_count: "five",
        transition_count: 0,
      },
    }));
    const errors = validateZoomEvents(tmpDir);
    expect(errors.some(e => e.includes("VISU-03") && e.includes("zoom_count"))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("fails when confidence_threshold is out of range (VISU-03)", () => {
    const tmpDir = `/tmp/validate-test-zoom-${Date.now()}`;
    const fs = require("fs");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(`${tmpDir}/remotion-info.json`, JSON.stringify({
      input_width: 1080,
      input_height: 1920,
      caption_pages: 3,
      visual_effects: {
        zoom_count: 3,
        transition_count: 0,
        confidence_threshold: 1.5,
      },
    }));
    const errors = validateZoomEvents(tmpDir);
    expect(errors.some(e => e.includes("VISU-03") && e.includes("confidence_threshold"))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── validateTransitionEvents (VISU-04) ──────────────────────────────────

describe("validateTransitionEvents", () => {
  it("returns no errors when remotion-info.json doesn't exist", () => {
    const errors = validateTransitionEvents("/nonexistent/path");
    expect(errors).toEqual([]);
  });

  it("returns no errors when visual_effects section is missing", () => {
    const tmpDir = `/tmp/validate-test-trans-${Date.now()}`;
    const fs = require("fs");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(`${tmpDir}/remotion-info.json`, JSON.stringify({
      input_width: 1080,
      input_height: 1920,
      caption_pages: 3,
    }));
    const errors = validateTransitionEvents(tmpDir);
    expect(errors).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("passes when visual_effects has valid transition_count and type", () => {
    const tmpDir = `/tmp/validate-test-trans-${Date.now()}`;
    const fs = require("fs");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(`${tmpDir}/remotion-info.json`, JSON.stringify({
      input_width: 1080,
      input_height: 1920,
      caption_pages: 3,
      visual_effects: {
        zoom_count: 5,
        transition_count: 3,
        zoom_enabled: true,
        transition_type: "zoom",
        confidence_threshold: 0.6,
      },
    }));
    const errors = validateTransitionEvents(tmpDir);
    expect(errors.filter(e => e.includes("VISU-04"))).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("fails when transition_count is negative (VISU-04)", () => {
    const tmpDir = `/tmp/validate-test-trans-${Date.now()}`;
    const fs = require("fs");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(`${tmpDir}/remotion-info.json`, JSON.stringify({
      input_width: 1080,
      input_height: 1920,
      caption_pages: 3,
      visual_effects: {
        zoom_count: 0,
        transition_count: -2,
      },
    }));
    const errors = validateTransitionEvents(tmpDir);
    expect(errors.some(e => e.includes("VISU-04") && e.includes("transition_count"))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("fails when transition_type is invalid (VISU-04)", () => {
    const tmpDir = `/tmp/validate-test-trans-${Date.now()}`;
    const fs = require("fs");
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(`${tmpDir}/remotion-info.json`, JSON.stringify({
      input_width: 1080,
      input_height: 1920,
      caption_pages: 3,
      visual_effects: {
        zoom_count: 0,
        transition_count: 0,
        transition_type: "dissolve",
      },
    }));
    const errors = validateTransitionEvents(tmpDir);
    expect(errors.some(e => e.includes("VISU-04") && e.includes("transition_type"))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── validateVisualLayerOrder (D-10) ─────────────────────────────────────

describe("validateVisualLayerOrder", () => {
  it("returns no errors when VALIDATE_SOURCE_FILES is not set (WR-05)", () => {
    delete process.env.VALIDATE_SOURCE_FILES;
    const errors = validateVisualLayerOrder("/any/path");
    expect(errors).toEqual([]);
  });

  it("reports error when Root.tsx is missing and VALIDATE_SOURCE_FILES=true", () => {
    const original = process.env.VALIDATE_SOURCE_FILES;
    process.env.VALIDATE_SOURCE_FILES = "true";
    const errors = validateVisualLayerOrder("/nonexistent/path");
    process.env.VALIDATE_SOURCE_FILES = original;
    expect(errors.some(e => e.includes("D-10") || e.includes("Root.tsx"))).toBe(true);
  });
});

// ─── validateZoomDetection (VISU-03) ─────────────────────────────────────

describe("validateZoomDetection", () => {
  it("returns no errors when VALIDATE_SOURCE_FILES is not set (WR-05)", () => {
    delete process.env.VALIDATE_SOURCE_FILES;
    const errors = validateZoomDetection("/any/path");
    expect(errors).toEqual([]);
  });

  it("reports error when zoom-detection.ts is missing and VALIDATE_SOURCE_FILES=true", () => {
    const original = process.env.VALIDATE_SOURCE_FILES;
    process.env.VALIDATE_SOURCE_FILES = "true";
    const errors = validateZoomDetection("/nonexistent/path");
    process.env.VALIDATE_SOURCE_FILES = original;
    expect(errors.some(e => e.includes("VISU-03"))).toBe(true);
  });
});