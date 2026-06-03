// ─── PipelineConfig: Schema and validation for config-driven Remotion composition ───
// Per D-01 (single config-driven composition), D-02 (pipeline-config.json per job),
// D-03 (env var fallback), D-04/D-05 (layout modes), D-06 (style config),
// D-08 (background highlight), D-09 (position presets), D-11/D-12 (title overlays)

// ─── Subtitle Layout Modes (D-04, D-05) ──────────────────────────────────

/** Union type for the four subtitle layout modes */
export type SubtitleLayoutMode = "tiktok" | "sentence" | "bar" | "karaoke";

/** Union type for the three position presets (D-09) */
export type SubtitlePosition = "bottom-center" | "top-center" | "center-screen";

// ─── Subtitle Styling (D-06) ─────────────────────────────────────────────

/** Background highlight effect (D-08) */
export interface BackgroundHighlight {
  enabled: boolean;
  color: string;
  padding: number;
  borderRadius: number;
}

/** Text shadow parameters */
export interface TextShadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

/** Outer glow effect parameters (TYPO-04) */
export interface OuterGlow {
  enabled: boolean;
  color: string;    // hex color, e.g. "#ffffff"
  intensity: number; // alpha multiplier 0–1
  softness: number;  // blur radius in px
}

/** SubtitleConfig — all style fields from D-06 with defaults */
export interface SubtitleConfig {
  layout: SubtitleLayoutMode;
  fontFamily?: string;
  fontSize?: number;
  activeColor?: string;
  inactiveColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  backgroundHighlight?: BackgroundHighlight;
  textShadow?: TextShadow;
  letterSpacing?: number;
  position?: SubtitlePosition;
  lineHeight?: number;
  bottomOffset?: number;
  pastWordOpacity?: number; // opacity for was-active words (0-1, default 0.4)
  highlightColor?: string; // ephemeral flash color when word becomes active
  highlightDurationMs?: number; // how long the highlight flash lasts (0-500ms)
  highlightTransition?: "fade" | "instant"; // how highlight transitions to activeColor
  subtitleWidth?: number; // max width in pixels for the subtitle paragraph (0 = full width, default 0)
  fontWeight?: boolean;  // false = 400 (regular), true = 700 (bold). Default: true (preserves existing behavior)
  fontStyle?: boolean;   // false = normal, true = italic. Default: false
  outerGlow?: OuterGlow; // outer glow effect (TYPO-04)
}

// ─── Title Overlays (D-10, D-11, D-12) ────────────────────────────────────

/** Title entrance animation options (D-11) */
export type TitleEntranceAnimation = "slide-up" | "slide-down" | "fade-in" | "none";

/** Title style props (D-11) */
export interface TitleStyleProps {
  entranceAnimation?: TitleEntranceAnimation;
  backgroundColor?: string;
  textColor?: string;
  titleFontSize?: number;
  titleColor?: string;
  titleFontFamily?: string;
  x?: number;            // pixel x from top-left of 1080×1920 frame (D-05, D-06)
  y?: number;            // pixel y from top-left (D-05, D-06)
  borderRadius?: number; // container border-radius in px, default 12 (D-09)
  lineHeight?: number;
  padding?: number;
  fontWeight?: boolean;  // false = 400 (regular), true = 700 (bold). Default: true
  fontStyle?: boolean;   // false = normal, true = italic. Default: false
  outerGlow?: OuterGlow; // outer glow effect (TYPO-04)
}

/** Title overlay configuration (D-12) */
export interface TitleConfig {
  text: string;
  startTimeMs: number;
  durationMs: number;
  style?: TitleStyleProps;
}

/** Configuration for a single PNG overlay (Phase 21, OVERLAY-01) */
export interface PngOverlayConfig {
  imageData: string;       // base64 data URL: "data:image/png;base64,..."
  x: number;               // pixel x from left edge of 1080px frame
  y: number;               // pixel y from top edge of 1920px frame
  displayWidth: number;    // CSS display width in pixels (triggers downscale)
  opacity?: number;        // 0–1, default 1
  layer?: "back" | "front"; // D-03: default "back" — decorators behind text
  _resolvedFile?: string;  // runtime-only, set by render.ts, NOT persisted
}

// ─── Visual Effects (D-11, D-12) ────────────────────────────────────────────

/** Transition animation type between silence cuts */
export type TransitionType = "zoom" | "crop-shift" | "none";

/** Zoom effect configuration (D-11, VISU-03) */
export interface ZoomConfig {
  enabled?: boolean;            // default: false (see DEFAULT_ZOOM_CONFIG)
  confidenceThreshold?: number;  // default: 0.6 (lower = more zooms)
  maxScale?: number;             // default: 1.15
  rampMs?: number;               // default: 300 (zoom ramp duration in ms)
  mergeGapMs?: number;           // default: 500 (merge events within this gap)
}

/** Transition effect configuration (D-06, D-07, D-11) */
export interface TransitionConfig {
  enabled?: boolean;            // default: true
  type?: TransitionType;        // default: "zoom"
  durationMs?: number;          // default: 250
  maxScale?: number;            // default: 1.08 (for zoom type)
  shiftPx?: number;              // default: 20 (for crop-shift type)
}

/** Visual effects configuration (D-11, D-12) */
export interface VisualEffectsConfig {
  zooms?: ZoomConfig;
  transitions?: TransitionConfig;
}

// ─── Top-level PipelineConfig (D-01, D-02) ─────────────────────────────────

/** PipelineConfig — the single config that drives Remotion rendering */
export interface PipelineConfig {
  subtitle: SubtitleConfig;
  titles?: TitleConfig[];
  overlays?: PngOverlayConfig[]; // Phase 21 OVERLAY-01
  visualEffects?: VisualEffectsConfig; // D-11
}

// ─── Default values (D-03, D-06) ──────────────────────────────────────────

/** Default SubtitleConfig values — match current rendering behavior */
export const DEFAULT_SUBTITLE_CONFIG: Required<
  Pick<
    SubtitleConfig,
    | "fontSize"
    | "activeColor"
    | "inactiveColor"
    | "outlineColor"
    | "outlineWidth"
    | "position"
    | "lineHeight"
    | "bottomOffset"
    | "pastWordOpacity"
    | "highlightColor"
    | "highlightDurationMs"
    | "highlightTransition"
    | "subtitleWidth"
    | "fontFamily"
    | "fontWeight"
  >
> = {
  fontSize: 58,
  activeColor: "#FFFF00",
  inactiveColor: "#FFFFFF",
  outlineColor: "#000000",
  outlineWidth: 3,
  position: "bottom-center" as SubtitlePosition,
  lineHeight: 1.3,
  bottomOffset: 250,
  pastWordOpacity: 0.4,
  highlightColor: "#FFFFFF",
  highlightDurationMs: 200,
  highlightTransition: "fade",
  subtitleWidth: 0,
  fontFamily: "PlusJakartaSans",
  fontWeight: true,
};

// ─── Visual Effects Defaults (D-03, D-06, D-07, D-12) ──────────────────────

/** Default ZoomConfig values */
export const DEFAULT_ZOOM_CONFIG: Required<ZoomConfig> = {

  enabled: false,

  confidenceThreshold: 0.6,

  maxScale: 1.15,

  rampMs: 300,

  mergeGapMs: 500,
};

/** Default TransitionConfig values */
export const DEFAULT_TRANSITION_CONFIG: Required<TransitionConfig> = {
  enabled: true,
  type: "zoom",
  durationMs: 250,
  maxScale: 1.08,
  shiftPx: 20,
};

/** Default VisualEffectsConfig values — absent visualEffects means effects enabled with defaults (D-12) */
export const DEFAULT_VISUAL_EFFECTS: Required<VisualEffectsConfig> = {
  zooms: DEFAULT_ZOOM_CONFIG,
  transitions: DEFAULT_TRANSITION_CONFIG,
};

// ─── Validation ────────────────────────────────────────────────────────────

const VALID_LAYOUT_MODES: SubtitleLayoutMode[] = ["tiktok", "sentence", "bar", "karaoke"];
const VALID_POSITIONS: SubtitlePosition[] = ["bottom-center", "top-center", "center-screen"];
const VALID_ENTRANCE_ANIMATIONS: TitleEntranceAnimation[] = ["slide-up", "slide-down", "fade-in", "none"];
const VALID_TRANSITION_TYPES: TransitionType[] = ["zoom", "crop-shift", "none"];
const VALID_HIGHLIGHT_TRANSITIONS: string[] = ["fade", "instant"];

/**
 * Validate a PipelineConfig object.
 *
 * Per T-06-01: Returns { valid: boolean; errors: string[] } with specific
 * error messages including field names. Validates:
 * - subtitle.layout is one of the 4 valid modes
 * - subtitle.position (if present) is one of 3 valid presets
 * - title entries: text non-empty, startTimeMs >= 0, durationMs > 0
 * - title style entranceAnimation (if present) is valid
 * - backgroundHighlight structure (if present)
 *
 * Per D-03: All SubtitleConfig fields except layout are optional —
 * defaults are applied at render time, not in validation.
 */
export function validatePipelineConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Must be a non-null object
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    return { valid: false, errors: ["PipelineConfig must be a non-null object"] };
  }

  const cfg = config as Record<string, unknown>;

  // Validate subtitle field exists
  if (!cfg.subtitle || typeof cfg.subtitle !== "object" || Array.isArray(cfg.subtitle)) {
    errors.push("PipelineConfig must have a 'subtitle' object");
    return { valid: false, errors };
  }

  const sub = cfg.subtitle as Record<string, unknown>;

  // Validate subtitle.layout (required)
  if (typeof sub.layout !== "string" || !VALID_LAYOUT_MODES.includes(sub.layout as SubtitleLayoutMode)) {
    errors.push(
      `subtitleLayout must be one of: ${VALID_LAYOUT_MODES.join(", ")}, got: ${JSON.stringify(sub.layout)}`
    );
  }

  // Validate subtitle.position (optional)
  if (sub.position !== undefined) {
    if (typeof sub.position !== "string" || !VALID_POSITIONS.includes(sub.position as SubtitlePosition)) {
      errors.push(
        `subtitle.position must be one of: ${VALID_POSITIONS.join(", ")}, got: ${JSON.stringify(sub.position)}`
      );
    }
  }

  // Validate subtitle.fontSize (optional, must be positive number if provided)
  if (sub.fontSize !== undefined && (typeof sub.fontSize !== "number" || sub.fontSize <= 0)) {
    errors.push("subtitle.fontSize must be a positive number");
  }

  // Validate subtitle.outlineWidth (optional, must be non-negative number)
  if (sub.outlineWidth !== undefined && (typeof sub.outlineWidth !== "number" || sub.outlineWidth < 0)) {
    errors.push("subtitle.outlineWidth must be a non-negative number");
  }

  // Validate subtitle.backgroundHighlight (optional)
  if (sub.backgroundHighlight !== undefined) {
    const bh = sub.backgroundHighlight as Record<string, unknown>;
    if (typeof bh !== "object" || bh === null || Array.isArray(bh)) {
      errors.push("subtitle.backgroundHighlight must be an object");
    } else {
      if (typeof bh.enabled !== "boolean") {
        errors.push("subtitle.backgroundHighlight.enabled must be a boolean");
      }
      if (typeof bh.color !== "string") {
        errors.push("subtitle.backgroundHighlight.color must be a string");
      }
      if (typeof bh.padding !== "number" || bh.padding < 0) {
        errors.push("subtitle.backgroundHighlight.padding must be a non-negative number");
      }
      if (typeof bh.borderRadius !== "number" || bh.borderRadius < 0) {
        errors.push("subtitle.backgroundHighlight.borderRadius must be a non-negative number");
      }
    }
  }

  // Validate subtitle.textShadow (optional)
  if (sub.textShadow !== undefined) {
    const ts = sub.textShadow as Record<string, unknown>;
    if (typeof ts !== "object" || ts === null || Array.isArray(ts)) {
      errors.push("subtitle.textShadow must be an object");
    } else {
      if (typeof ts.enabled !== "boolean") {
        errors.push("subtitle.textShadow.enabled must be a boolean");
      }
    }
  }

  // Validate subtitle.outerGlow (optional, TYPO-04 — T-19-01/02/03 mitigations)
  if (sub.outerGlow !== undefined) {
    const og = sub.outerGlow as Record<string, unknown>;
    if (typeof og !== "object" || og === null || Array.isArray(og)) {
      errors.push("subtitle.outerGlow must be an object");
    } else {
      if (typeof og.enabled !== "boolean") {
        errors.push("subtitle.outerGlow.enabled must be a boolean");
      }
      if (typeof og.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(og.color as string)) {
        errors.push("subtitle.outerGlow.color must be a 6-digit hex color (e.g. #ffffff)");
      }
      if (typeof og.intensity !== "number" || og.intensity < 0 || og.intensity > 1) {
        errors.push("subtitle.outerGlow.intensity must be a number between 0 and 1");
      }
      if (typeof og.softness !== "number" || og.softness < 0) {
        errors.push("subtitle.outerGlow.softness must be a non-negative number");
      }
    }
  }

  // Validate subtitle.fontWeight (optional, must be boolean if present — T-19-04)
  if (sub.fontWeight !== undefined && typeof sub.fontWeight !== "boolean") {
    errors.push("subtitle.fontWeight must be a boolean");
  }

  // Validate subtitle.fontStyle (optional, must be boolean if present — T-19-04)
  if (sub.fontStyle !== undefined && typeof sub.fontStyle !== "boolean") {
    errors.push("subtitle.fontStyle must be a boolean");
  }

  // Validate subtitle.pastWordOpacity (optional, must be 0-1 if provided)
  if (sub.pastWordOpacity !== undefined && (typeof sub.pastWordOpacity !== "number" || sub.pastWordOpacity < 0 || sub.pastWordOpacity > 1)) {
    errors.push("subtitle.pastWordOpacity must be a number between 0 and 1");
  }

  // Validate subtitle.lineHeight (optional, must be positive if provided)
  if (sub.lineHeight !== undefined && (typeof sub.lineHeight !== "number" || sub.lineHeight <= 0)) {
    errors.push("subtitle.lineHeight must be a positive number");
  }

  // Validate subtitle.highlightDurationMs (optional, 0-500)
  if (sub.highlightDurationMs !== undefined && (typeof sub.highlightDurationMs !== "number" || sub.highlightDurationMs < 0 || sub.highlightDurationMs > 500)) {
    errors.push("subtitle.highlightDurationMs must be a number between 0 and 500");
  }

  // Validate subtitle.highlightTransition (optional)
  if (sub.highlightTransition !== undefined && !VALID_HIGHLIGHT_TRANSITIONS.includes(sub.highlightTransition as string)) {
    errors.push(`subtitle.highlightTransition must be one of: ${VALID_HIGHLIGHT_TRANSITIONS.join(", ")}`);
  }

  // Validate subtitle.subtitleWidth (optional, must be non-negative if provided)
  if (sub.subtitleWidth !== undefined && (typeof sub.subtitleWidth !== "number" || sub.subtitleWidth < 0)) {
    errors.push("subtitle.subtitleWidth must be a non-negative number");
  }

  // Validate titles (optional array)
  if (cfg.titles !== undefined) {
    if (!Array.isArray(cfg.titles)) {
      errors.push("PipelineConfig.titles must be an array");
    } else {
      cfg.titles.forEach((title: unknown, index: number) => {
        if (typeof title !== "object" || title === null) {
          errors.push(`titles[${index}] must be a non-null object`);
          return;
        }
        const t = title as Record<string, unknown>;

        // text: required, non-empty string
        if (typeof t.text !== "string" || t.text.trim() === "") {
          errors.push(`titles[${index}].text must be a non-empty string`);
        }

        // startTimeMs: required, >= 0
        if (typeof t.startTimeMs !== "number" || t.startTimeMs < 0) {
          errors.push(`titles[${index}].startTimeMs must be >= 0`);
        }

        // durationMs: required, > 0
        if (typeof t.durationMs !== "number" || t.durationMs <= 0) {
          errors.push(`titles[${index}].durationMs must be > 0`);
        }

        // style: optional, validate entranceAnimation if present
        if (t.style !== undefined) {
          if (typeof t.style !== "object" || t.style === null) {
            errors.push(`titles[${index}].style must be an object`);
          } else {
            const s = t.style as Record<string, unknown>;
            if (
              s.entranceAnimation !== undefined &&
              (typeof s.entranceAnimation !== "string" ||
                !VALID_ENTRANCE_ANIMATIONS.includes(s.entranceAnimation as TitleEntranceAnimation))
            ) {
              errors.push(
                `titles[${index}].style.entranceAnimation must be one of: ${VALID_ENTRANCE_ANIMATIONS.join(", ")}, got: ${JSON.stringify(s.entranceAnimation)}`
              );
            }
            if (s.titleFontSize !== undefined && (typeof s.titleFontSize !== "number" || !Number.isFinite(s.titleFontSize) || s.titleFontSize < 8 || s.titleFontSize > 200)) {
              errors.push(`titles[${index}].style.titleFontSize must be a number between 8 and 200`);
            }
            if (s.x !== undefined && (typeof s.x !== "number" || !Number.isFinite(s.x) || s.x < 0)) {
              errors.push(`titles[${index}].style.x must be a non-negative number`);
            }
            if (s.y !== undefined && (typeof s.y !== "number" || !Number.isFinite(s.y) || s.y < 0)) {
              errors.push(`titles[${index}].style.y must be a non-negative number`);
            }
            if (s.borderRadius !== undefined && (typeof s.borderRadius !== "number" || !Number.isFinite(s.borderRadius) || s.borderRadius < 0)) {
              errors.push(`titles[${index}].style.borderRadius must be a non-negative number`);
            }
            if (s.lineHeight !== undefined && (typeof s.lineHeight !== "number" || !Number.isFinite(s.lineHeight) || s.lineHeight < 0.1 || s.lineHeight > 3)) {
              errors.push(`titles[${index}].style.lineHeight must be a number between 0.1 and 3`);
            }
            if (s.padding !== undefined && (typeof s.padding !== "number" || !Number.isFinite(s.padding) || s.padding < 0 || s.padding > 100)) {
              errors.push(`titles[${index}].style.padding must be a number between 0 and 100`);
            }
            // Validate title style fontWeight (optional, must be boolean if present — T-19-04)
            if (s.fontWeight !== undefined && typeof s.fontWeight !== "boolean") {
              errors.push(`titles[${index}].style.fontWeight must be a boolean`);
            }
            // Validate title style fontStyle (optional, must be boolean if present — T-19-04)
            if (s.fontStyle !== undefined && typeof s.fontStyle !== "boolean") {
              errors.push(`titles[${index}].style.fontStyle must be a boolean`);
            }
            // Validate title style outerGlow (optional — T-19-04 parity with subtitle.outerGlow)
            if (s.outerGlow !== undefined) {
              const og = s.outerGlow as Record<string, unknown>;
              if (typeof og !== "object" || og === null || Array.isArray(og)) {
                errors.push(`titles[${index}].style.outerGlow must be an object`);
              } else {
                if (typeof og.enabled !== "boolean")
                  errors.push(`titles[${index}].style.outerGlow.enabled must be a boolean`);
                if (typeof og.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(og.color as string))
                  errors.push(`titles[${index}].style.outerGlow.color must be a 6-digit hex color`);
                if (typeof og.intensity !== "number" || og.intensity < 0 || og.intensity > 1)
                  errors.push(`titles[${index}].style.outerGlow.intensity must be between 0 and 1`);
                if (typeof og.softness !== "number" || og.softness < 0)
                  errors.push(`titles[${index}].style.outerGlow.softness must be >= 0`);
              }
            }
          }
        }
      });
    }
  }

  // Validate overlays (optional array, Phase 21 OVERLAY-01/02/03)
  if (cfg.overlays !== undefined) {
    if (!Array.isArray(cfg.overlays)) {
      errors.push("PipelineConfig.overlays must be an array");
    } else {
      cfg.overlays.forEach((overlay: unknown, index: number) => {
        if (typeof overlay !== "object" || overlay === null) {
          errors.push(`overlays[${index}] must be a non-null object`);
          return;
        }
        const ov = overlay as Record<string, unknown>;

        // imageData: required, non-empty string
        if (typeof ov.imageData !== "string" || ov.imageData.trim() === "") {
          errors.push(`overlays[${index}].imageData must be a non-empty string`);
        }

        // x: required, finite number >= 0
        if (typeof ov.x !== "number" || !Number.isFinite(ov.x) || ov.x < 0) {
          errors.push(`overlays[${index}].x must be a non-negative finite number`);
        }

        // y: required, finite number >= 0
        if (typeof ov.y !== "number" || !Number.isFinite(ov.y) || ov.y < 0) {
          errors.push(`overlays[${index}].y must be a non-negative finite number`);
        }

        // displayWidth: required, finite number > 0
        if (typeof ov.displayWidth !== "number" || !Number.isFinite(ov.displayWidth) || ov.displayWidth <= 0) {
          errors.push(`overlays[${index}].displayWidth must be a positive finite number`);
        }

        // opacity: optional, number between 0 and 1 inclusive
        if (ov.opacity !== undefined) {
          if (typeof ov.opacity !== "number" || ov.opacity < 0 || ov.opacity > 1) {
            errors.push(`overlays[${index}].opacity must be a number between 0 and 1`);
          }
        }

        // layer: optional, must be "back" or "front" if present (D-03)
        if (ov.layer !== undefined) {
          if (ov.layer !== "back" && ov.layer !== "front") {
            errors.push(`overlays[${index}].layer must be "back" or "front"`);
          }
        }

        // _resolvedFile: runtime-only, NOT validated (mirrors _meta pattern)
      });
    }
  }

  // Validate visualEffects (optional, D-11, D-12)
  if (cfg.visualEffects !== undefined) {
    const ve = cfg.visualEffects as Record<string, unknown>;
    if (typeof ve !== "object" || ve === null || Array.isArray(ve)) {
      errors.push("PipelineConfig.visualEffects must be an object");
    } else {
      // Validate zooms sub-object (optional)
      if (ve.zooms !== undefined) {
        const z = ve.zooms as Record<string, unknown>;
        if (typeof z !== "object" || z === null || Array.isArray(z)) {
          errors.push("visualEffects.zooms must be an object");
        } else {
          if (z.confidenceThreshold !== undefined) {
            if (typeof z.confidenceThreshold !== "number" || z.confidenceThreshold < 0 || z.confidenceThreshold > 1) {
              errors.push("visualEffects.zooms.confidenceThreshold must be between 0 and 1");
            }
          }
          if (z.maxScale !== undefined) {
            if (typeof z.maxScale !== "number" || z.maxScale <= 1.0) {
              errors.push("visualEffects.zooms.maxScale must be > 1.0");
            }
          }
          if (z.rampMs !== undefined) {
            if (typeof z.rampMs !== "number" || z.rampMs <= 0) {
              errors.push("visualEffects.zooms.rampMs must be > 0");
            }
          }
          if (z.mergeGapMs !== undefined) {
            if (typeof z.mergeGapMs !== "number" || z.mergeGapMs < 0) {
              errors.push("visualEffects.zooms.mergeGapMs must be >= 0");
            }
          }
        }
      }

      // Validate transitions sub-object (optional)
      if (ve.transitions !== undefined) {
        const tr = ve.transitions as Record<string, unknown>;
        if (typeof tr !== "object" || tr === null || Array.isArray(tr)) {
          errors.push("visualEffects.transitions must be an object");
        } else {
          if (tr.type !== undefined) {
            if (typeof tr.type !== "string" || !VALID_TRANSITION_TYPES.includes(tr.type as TransitionType)) {
              errors.push(
                `visualEffects.transitions.type must be one of: ${VALID_TRANSITION_TYPES.join(", ")}, got: ${JSON.stringify(tr.type)}`
              );
            }
          }
          if (tr.durationMs !== undefined) {
            if (typeof tr.durationMs !== "number" || tr.durationMs <= 0) {
              errors.push("visualEffects.transitions.durationMs must be > 0");
            }
          }
          if (tr.maxScale !== undefined) {
            if (typeof tr.maxScale !== "number" || tr.maxScale <= 1.0) {
              errors.push("visualEffects.transitions.maxScale must be > 1.0");
            }
          }
          if (tr.shiftPx !== undefined) {
            if (typeof tr.shiftPx !== "number" || tr.shiftPx <= 0) {
              errors.push("visualEffects.transitions.shiftPx must be > 0");
            }
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}