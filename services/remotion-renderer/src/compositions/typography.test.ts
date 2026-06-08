import { describe, it, expect } from "vitest";
import { AVAILABLE_FONTS } from "../fonts";
import {
  DEFAULT_SUBTITLE_CONFIG,
  validatePipelineConfig,
} from "../pipeline-config";

// ─── Typography feature tests (Phase 19) ──────────────────────────────────────
// Covers: TYPO-01 (Plus Jakarta Sans), TYPO-02 (font size range),
//         TYPO-03 (bold/italic), TYPO-04 (outer glow validation)

// ─── TYPO-01: Plus Jakarta Sans ──────────────────────────────────────────────

describe("Plus Jakarta Sans (TYPO-01)", () => {
  it("AVAILABLE_FONTS[0] is PlusJakartaSans", () => {
    expect(AVAILABLE_FONTS[0]).toBe("PlusJakartaSans");
  });

  it("DEFAULT_SUBTITLE_CONFIG.fontFamily is PlusJakartaSans", () => {
    expect(DEFAULT_SUBTITLE_CONFIG.fontFamily).toBe("PlusJakartaSans");
  });
});

// ─── TYPO-03: fontWeight / fontStyle boolean mapping ─────────────────────────

describe("fontWeight/fontStyle mapping (TYPO-03)", () => {
  // These functions represent the mapping expression used in layout components
  const mapFontWeight = (fw?: boolean) => (fw !== false ? 700 : 400);
  const mapFontStyle = (fs?: boolean) => (fs === true ? "italic" : "normal");

  it("DEFAULT_SUBTITLE_CONFIG.fontWeight is true (bold default)", () => {
    expect(DEFAULT_SUBTITLE_CONFIG.fontWeight).toBe(true);
  });

  it("fontWeight false maps to 400 (regular)", () => {
    expect(mapFontWeight(false)).toBe(400);
  });

  it("fontWeight undefined maps to 700 (bold default — preserves existing behavior)", () => {
    expect(mapFontWeight(undefined)).toBe(700);
  });

  it("fontWeight true maps to 700 (bold)", () => {
    expect(mapFontWeight(true)).toBe(700);
  });

  it("fontStyle true maps to italic", () => {
    expect(mapFontStyle(true)).toBe("italic");
  });

  it("fontStyle undefined maps to normal (default)", () => {
    expect(mapFontStyle(undefined)).toBe("normal");
  });

  it("fontStyle false maps to normal", () => {
    expect(mapFontStyle(false)).toBe("normal");
  });

  it("validatePipelineConfig rejects subtitle.fontWeight = 'bold' (string not boolean)", () => {
    const result = validatePipelineConfig({
      subtitle: { layout: "tiktok", fontWeight: "bold" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("fontWeight"))).toBe(true);
  });

  it("validatePipelineConfig accepts subtitle.fontWeight = true and fontStyle = false", () => {
    const result = validatePipelineConfig({
      subtitle: { layout: "tiktok", fontWeight: true, fontStyle: false },
    });
    expect(result.valid).toBe(true);
  });
});

// ─── TYPO-04: outerGlow validation ───────────────────────────────────────────

describe("outerGlow validation (TYPO-04)", () => {
  it("accepts valid outerGlow object", () => {
    const result = validatePipelineConfig({
      subtitle: {
        layout: "tiktok",
        outerGlow: { enabled: true, color: "#ff0000", intensity: 0.8, softness: 20 },
      },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects outerGlow.color = 'red' (not valid hex)", () => {
    const result = validatePipelineConfig({
      subtitle: {
        layout: "tiktok",
        outerGlow: { enabled: true, color: "red", intensity: 0.8, softness: 20 },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("outerGlow.color"))).toBe(true);
  });

  it("rejects outerGlow.color = '#gggggg' (invalid hex characters)", () => {
    const result = validatePipelineConfig({
      subtitle: {
        layout: "tiktok",
        outerGlow: { enabled: true, color: "#gggggg", intensity: 0.8, softness: 20 },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("outerGlow.color"))).toBe(true);
  });

  it("accepts outerGlow.color = '#ffffff' (valid hex)", () => {
    const result = validatePipelineConfig({
      subtitle: {
        layout: "tiktok",
        outerGlow: { enabled: true, color: "#ffffff", intensity: 0.8, softness: 20 },
      },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects outerGlow.intensity = 1.5 (out of 0-1 range)", () => {
    const result = validatePipelineConfig({
      subtitle: {
        layout: "tiktok",
        outerGlow: { enabled: true, color: "#ffffff", intensity: 1.5, softness: 20 },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("outerGlow.intensity"))).toBe(true);
  });

  it("rejects outerGlow.softness = -1 (negative)", () => {
    const result = validatePipelineConfig({
      subtitle: {
        layout: "tiktok",
        outerGlow: { enabled: true, color: "#ffffff", intensity: 0.8, softness: -1 },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("outerGlow.softness"))).toBe(true);
  });
});

// ─── TYPO-04: getOuterGlowStyle CSS helper ───────────────────────────────────

import { getOuterGlowStyle } from "./shared-styles";

describe("getOuterGlowStyle (TYPO-04)", () => {
  it("returns {} when outerGlow is undefined", () => {
    expect(getOuterGlowStyle(undefined)).toEqual({});
  });

  it("returns {} when outerGlow.enabled is false", () => {
    expect(
      getOuterGlowStyle({ enabled: false, color: "#ff0000", intensity: 0.8, softness: 20 })
    ).toEqual({});
  });

  it("returns correct text-shadow for white glow", () => {
    expect(
      getOuterGlowStyle({ enabled: true, color: "#ffffff", intensity: 0.8, softness: 20 })
    ).toEqual({ textShadow: "0 0 20px rgba(255, 255, 255, 0.8)" });
  });

  it("returns correct text-shadow for red glow with different params", () => {
    expect(
      getOuterGlowStyle({ enabled: true, color: "#ff0000", intensity: 0.5, softness: 10 })
    ).toEqual({ textShadow: "0 0 10px rgba(255, 0, 0, 0.5)" });
  });

  it("comma-joins with existingTextShadow when glow is enabled", () => {
    expect(
      getOuterGlowStyle(
        { enabled: true, color: "#ffffff", intensity: 1, softness: 5 },
        "1px 1px 2px #000"
      )
    ).toEqual({ textShadow: "1px 1px 2px #000, 0 0 5px rgba(255, 255, 255, 1)" });
  });

  it("passes through existingTextShadow when glow is disabled", () => {
    expect(
      getOuterGlowStyle(undefined, "1px 1px 2px #000")
    ).toEqual({ textShadow: "1px 1px 2px #000" });
  });
});

// ─── Phase 28: getWordBackgroundStyle (SUB-01/02) ────────────────────────────
// Per-word "fondo por palabra" bar drawn behind the active/highlighted tiktok
// word only. Returns {} unless the feature is enabled AND the word is active.

import { getWordBackgroundStyle } from "./shared-styles";

describe("getWordBackgroundStyle (SUB-01/02)", () => {
  const WB = { enabled: true, color: "#000000", opacity: 0.5, borderRadius: 8, padding: 6 };

  it("returns {} when wordBackground is undefined", () => {
    expect(getWordBackgroundStyle(undefined, true)).toEqual({});
  });

  it("returns {} when wordBackground.enabled is false", () => {
    expect(getWordBackgroundStyle({ ...WB, enabled: false }, true)).toEqual({});
  });

  it("returns {} when the word is not active (only paints on the active word)", () => {
    expect(getWordBackgroundStyle(WB, false)).toEqual({});
  });

  it("returns rgba backgroundColor + borderRadius + padding for an enabled active word", () => {
    expect(getWordBackgroundStyle(WB, true)).toEqual({
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      borderRadius: "8px",
      padding: "6px",
      // negative horizontal margin cancels the padding's inline width → no lateral shift
      margin: "0 -6px",
    });
  });

  it("parses non-black hex colors into rgba", () => {
    expect(
      getWordBackgroundStyle({ enabled: true, color: "#ff0000", opacity: 0.8, borderRadius: 4, padding: 2 }, true)
    ).toEqual({
      backgroundColor: "rgba(255, 0, 0, 0.8)",
      borderRadius: "4px",
      padding: "2px",
      margin: "0 -2px",
    });
  });

  it("expands 3-char shorthand hex", () => {
    expect(
      getWordBackgroundStyle({ enabled: true, color: "#fff", opacity: 1, borderRadius: 0, padding: 0 }, true)
    ).toEqual({
      backgroundColor: "rgba(255, 255, 255, 1)",
      borderRadius: "0px",
      padding: "0px",
      margin: "0 -0px",
    });
  });
});

// ─── TYPO-02: font size range extended to 200 ────────────────────────────────

describe("font size range (TYPO-02)", () => {
  it("accepts title style titleFontSize = 200 (new max)", () => {
    const result = validatePipelineConfig({
      subtitle: { layout: "tiktok" },
      titles: [
        {
          text: "Test title",
          startTimeMs: 0,
          durationMs: 3000,
          style: { titleFontSize: 200 },
        },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects title style titleFontSize = 201 (exceeds max)", () => {
    const result = validatePipelineConfig({
      subtitle: { layout: "tiktok" },
      titles: [
        {
          text: "Test title",
          startTimeMs: 0,
          durationMs: 3000,
          style: { titleFontSize: 201 },
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("titleFontSize"))).toBe(true);
  });
});
