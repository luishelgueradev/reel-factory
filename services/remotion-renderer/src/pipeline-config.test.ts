import { describe, it, expect } from "vitest";
import {
  validatePipelineConfig,
  DEFAULT_ZOOM_CONFIG,
  DEFAULT_TRANSITION_CONFIG,
  DEFAULT_VISUAL_EFFECTS,
  type PipelineConfig,
  type SubtitleConfig,
  type SubtitleLayoutMode,
  type SubtitlePosition,
  type BackgroundHighlight,
  type TitleConfig,
  type TitleStyleProps,
  type VisualEffectsConfig,
  type ZoomConfig,
  type TransitionConfig,
} from "./pipeline-config";

describe("validatePipelineConfig", () => {
  describe("valid configs", () => {
    it("accepts minimal valid config with only subtitleLayout", () => {
      const config = { subtitle: { layout: "tiktok" } };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts full config with all fields", () => {
      const config: PipelineConfig = {
        subtitle: {
          layout: "sentence",
          fontFamily: "Inter",
          fontSize: 48,
          activeColor: "#FF0000",
          inactiveColor: "#CCCCCC",
          outlineColor: "#333333",
          outlineWidth: 2,
          backgroundHighlight: {
            enabled: true,
            color: "#00000080",
            padding: 8,
            borderRadius: 4,
          },
          textShadow: {
            enabled: true,
            color: "#000000",
            blur: 4,
            offsetX: 2,
            offsetY: 2,
          },
          letterSpacing: 0.5,
          position: "top-center",
        },
        titles: [
          {
            text: "Welcome",
            startTimeMs: 0,
            durationMs: 3000,
            style: {
              entranceAnimation: "slide-up",
              backgroundColor: "#00000080",
              textColor: "#FFFFFF",
            },
          },
        ],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts x and y fields in title style", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { x: 200, y: 960 } }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });

    it("accepts borderRadius field in title style", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { borderRadius: 24 } }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });

    it("accepts borderRadius = 0 (sharp corners)", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { borderRadius: 0 } }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });

    it("accepts all 4 layout modes: tiktok, sentence, bar, karaoke", () => {
      const layouts: SubtitleLayoutMode[] = ["tiktok", "sentence", "bar", "karaoke"];
      for (const layout of layouts) {
        const config = { subtitle: { layout } };
        const result = validatePipelineConfig(config);
        expect(result.valid, `layout "${layout}" should be valid`).toBe(true);
      }
    });

    it("accepts all 3 position presets: bottom-center, top-center, center-screen", () => {
      const positions: SubtitlePosition[] = ["bottom-center", "top-center", "center-screen"];
      for (const position of positions) {
        const config = { subtitle: { layout: "tiktok", position } };
        const result = validatePipelineConfig(config);
        expect(result.valid, `position "${position}" should be valid`).toBe(true);
      }
    });

    it("accepts SubtitleConfig with only layout and optional fields", () => {
      const config = { subtitle: { layout: "bar", fontSize: 40 } };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });

    it("accepts TitleConfig with entrance animation values slide-up, fade-in, none", () => {
      const animations: TitleStyleProps["entranceAnimation"][] = ["slide-up", "fade-in", "none"];
      for (const entranceAnimation of animations) {
        const config = {
          subtitle: { layout: "tiktok" },
          titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { entranceAnimation } }],
        };
        const result = validatePipelineConfig(config);
        expect(result.valid, `entranceAnimation "${entranceAnimation}" should be valid`).toBe(true);
      }
    });

    it("accepts TitleConfig without optional style", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe("invalid configs", () => {
    it("rejects invalid subtitleLayout value", () => {
      const config = { subtitle: { layout: "invalid-layout" } };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("subtitleLayout") || e.includes("layout"))).toBe(true);
    });

    it("rejects negative startTimeMs in titles", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Bad", startTimeMs: -100, durationMs: 1000 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("startTimeMs"))).toBe(true);
    });

    it("rejects zero durationMs in titles", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Bad", startTimeMs: 0, durationMs: 0 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("durationMs"))).toBe(true);
    });

    it("rejects negative durationMs in titles", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Bad", startTimeMs: 0, durationMs: -500 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("durationMs"))).toBe(true);
    });

    it("rejects non-object input", () => {
      const result = validatePipelineConfig("not an object");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects null input", () => {
      const result = validatePipelineConfig(null);
      expect(result.valid).toBe(false);
    });

    it("rejects config without subtitle field", () => {
      const config = { titles: [] };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("subtitle"))).toBe(true);
    });

    it("rejects invalid position value", () => {
      const config = { subtitle: { layout: "tiktok", position: "middle-left" } };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("position"))).toBe(true);
    });

    it("rejects title with empty text", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "", startTimeMs: 0, durationMs: 1000 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("text"))).toBe(true);
    });

    it("rejects title with invalid entranceAnimation", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { entranceAnimation: "bounce" } }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("entranceAnimation"))).toBe(true);
    });

    it("rejects negative x in title style", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { x: -10 } }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(".style.x"))).toBe(true);
    });

    it("rejects negative y in title style", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { y: -1 } }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(".style.y"))).toBe(true);
    });

    it("rejects negative borderRadius in title style", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { borderRadius: -5 } }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(".style.borderRadius"))).toBe(true);
    });
  });

  describe("default merging", () => {
    it("SubtitleConfig defaults merge correctly with minimal input", () => {
      // When only layout is provided, defaults should fill in
      const config: SubtitleConfig = { layout: "tiktok" };
      // Defaults: fontSize=58, activeColor="#FFFF00", inactiveColor="#FFFFFF",
      // outlineColor="#000000", outlineWidth=3, position="bottom-center"
      expect(config.layout).toBe("tiktok");
      expect(config.fontSize).toBeUndefined(); // defaults applied at render time, not in validation
    });

    it("accepts config with subtitle having only layout field", () => {
      const config = { subtitle: { layout: "karaoke" } };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe("visualEffects validation", () => {
    it("accepts config without visualEffects section (defaults apply)", () => {
      const config = { subtitle: { layout: "tiktok" } };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts valid full visualEffects config", () => {
      const config: PipelineConfig = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          zooms: {
            enabled: true,
            confidenceThreshold: 0.7,
            maxScale: 1.2,
            rampMs: 400,
            mergeGapMs: 600,
          },
          transitions: {
            enabled: true,
            type: "zoom",
            durationMs: 300,
            maxScale: 1.1,
            shiftPx: 25,
          },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts visualEffects with only zooms (transitions omitted)", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          zooms: { enabled: true },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });

    it("accepts visualEffects with only transitions (zooms omitted)", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          transitions: { type: "crop-shift" },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });

    it("accepts zooms.enabled = false (D-12: disabled zoom passes validation)", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          zooms: { enabled: false },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });

    it("accepts empty visualEffects object (all effects use defaults)", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {},
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });

    // Invalid configs
    it("rejects invalid confidenceThreshold (negative)", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          zooms: { confidenceThreshold: -0.5 },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("confidenceThreshold"))).toBe(true);
    });

    it("rejects invalid confidenceThreshold (> 1)", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          zooms: { confidenceThreshold: 1.5 },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("confidenceThreshold"))).toBe(true);
    });

    it("rejects maxScale <= 1.0 for zooms", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          zooms: { maxScale: 1.0 },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("zooms.maxScale"))).toBe(true);
    });

    it("rejects maxScale <= 1.0 for transitions", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          transitions: { maxScale: 0.9 },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("transitions.maxScale"))).toBe(true);
    });

    it("rejects invalid transition type", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          transitions: { type: "dissolve" },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("transitions.type"))).toBe(true);
    });

    it("rejects durationMs <= 0", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          transitions: { durationMs: 0 },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("durationMs"))).toBe(true);
    });

    it("rejects rampMs <= 0", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          zooms: { rampMs: 0 },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("rampMs"))).toBe(true);
    });

    it("rejects mergeGapMs < 0", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          zooms: { mergeGapMs: -100 },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("mergeGapMs"))).toBe(true);
    });

    it("rejects shiftPx <= 0", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          transitions: { shiftPx: 0 },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("shiftPx"))).toBe(true);
    });

    it("accepts mergeGapMs = 0 (no merging)", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: {
          zooms: { mergeGapMs: 0 },
        },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });

    it("rejects visualEffects as non-object", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: "invalid",
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("visualEffects"))).toBe(true);
    });

    it("rejects zooms as non-object", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: { zooms: "invalid" },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("zooms"))).toBe(true);
    });

    it("rejects transitions as non-object", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        visualEffects: { transitions: 42 },
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("transitions"))).toBe(true);
    });
  });

  describe("visual effects defaults", () => {
    it("DEFAULT_ZOOM_CONFIG has expected values", () => {
      expect(DEFAULT_ZOOM_CONFIG.enabled).toBe(false);
      expect(DEFAULT_ZOOM_CONFIG.confidenceThreshold).toBe(0.6);
      expect(DEFAULT_ZOOM_CONFIG.maxScale).toBe(1.15);
      expect(DEFAULT_ZOOM_CONFIG.rampMs).toBe(300);
      expect(DEFAULT_ZOOM_CONFIG.mergeGapMs).toBe(500);
    });

    it("DEFAULT_TRANSITION_CONFIG has expected values", () => {
      expect(DEFAULT_TRANSITION_CONFIG.enabled).toBe(true);
      expect(DEFAULT_TRANSITION_CONFIG.type).toBe("zoom");
      expect(DEFAULT_TRANSITION_CONFIG.durationMs).toBe(250);
      expect(DEFAULT_TRANSITION_CONFIG.maxScale).toBe(1.08);
      expect(DEFAULT_TRANSITION_CONFIG.shiftPx).toBe(20);
    });

    it("DEFAULT_VISUAL_EFFECTS contains zoom and transition defaults", () => {
      expect(DEFAULT_VISUAL_EFFECTS.zooms).toEqual(DEFAULT_ZOOM_CONFIG);
      expect(DEFAULT_VISUAL_EFFECTS.transitions).toEqual(DEFAULT_TRANSITION_CONFIG);
    });
  });

  // ─── PNG overlays (OVERLAY-01/02/03) ─────────────────────────────────────
  describe("PNG overlays (OVERLAY-01/02/03)", () => {
    // Test 1: empty overlays array is valid
    it("OVERLAY-01: accepts config with empty overlays array", () => {
      const config = { subtitle: { layout: "tiktok" }, overlays: [] };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // Test 2: well-formed single overlay is valid
    it("OVERLAY-01: accepts config with a valid overlay entry", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: [{ imageData: "data:image/png;base64,abc", x: 40, y: 40, displayWidth: 200 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // Test 3: missing imageData -> error mentions "imageData"
    it("OVERLAY-01: rejects overlay with missing imageData", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: [{ x: 40, y: 40, displayWidth: 200 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("imageData"))).toBe(true);
    });

    // Test 4: negative x -> error mentions "x"
    it("OVERLAY-03: rejects overlay with negative x", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: [{ imageData: "data:image/png;base64,abc", x: -1, y: 40, displayWidth: 200 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("x"))).toBe(true);
    });

    // Test 5: displayWidth of 0 -> error mentions "displayWidth"
    it("OVERLAY-03: rejects overlay with displayWidth = 0", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: [{ imageData: "data:image/png;base64,abc", x: 40, y: 40, displayWidth: 0 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("displayWidth"))).toBe(true);
    });

    // Test 6: opacity > 1 -> error mentions "opacity"
    it("OVERLAY-03: rejects overlay with opacity > 1", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: [{ imageData: "data:image/png;base64,abc", x: 40, y: 40, displayWidth: 200, opacity: 1.5 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("opacity"))).toBe(true);
    });

    // Test 7: overlays is not an array -> error mentions "overlays"
    it("OVERLAY-01: rejects overlays that is not an array", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: {},
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("overlays"))).toBe(true);
    });

    // Test 8: _resolvedFile present -> valid (runtime-only field, ignored by validation)
    it("OVERLAY-01: accepts overlay with _resolvedFile (runtime-only field)", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: [{
          imageData: "data:image/png;base64,abc",
          x: 40,
          y: 40,
          displayWidth: 200,
          _resolvedFile: "overlay-0.png",
        }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // D-03: layer field — 5 cases
    const validOverlay = { imageData: "data:image/png;base64,abc", x: 0, y: 0, displayWidth: 200 };

    // Test 9: no layer field -> valid (back is the implied default, not validated)
    it("D-03: accepts overlay with no layer field (back implied)", () => {
      const config = { subtitle: { layout: "tiktok" }, overlays: [validOverlay] };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors.filter((e) => e.includes("layer"))).toHaveLength(0);
    });

    // Test 10: layer: "back" -> valid
    it('D-03: accepts overlay with layer: "back"', () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: [{ ...validOverlay, layer: "back" }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors.filter((e) => e.includes("layer"))).toHaveLength(0);
    });

    // Test 11: layer: "front" -> valid
    it('D-03: accepts overlay with layer: "front"', () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: [{ ...validOverlay, layer: "front" }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors.filter((e) => e.includes("layer"))).toHaveLength(0);
    });

    // Test 12: layer: "middle" -> error 'overlays[0].layer must be "back" or "front"'
    it('D-03: rejects overlay with layer: "middle" (out-of-enum string)', () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: [{ ...validOverlay, layer: "middle" }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('overlays[0].layer must be "back" or "front"'))).toBe(true);
    });

    // Test 13: layer: 3 (wrong type) -> same error
    it("D-03: rejects overlay with layer as a number (wrong type)", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        overlays: [{ ...validOverlay, layer: 3 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('overlays[0].layer must be "back" or "front"'))).toBe(true);
    });
  });
});