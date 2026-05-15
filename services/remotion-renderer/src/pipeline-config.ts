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
}

// ─── Title Overlays (D-10, D-11, D-12) ────────────────────────────────────

/** Title entrance animation options (D-11) */
export type TitleEntranceAnimation = "slide-up" | "fade-in" | "none";

/** Title style props (D-11) */
export interface TitleStyleProps {
  entranceAnimation?: TitleEntranceAnimation;
  backgroundColor?: string;
  textColor?: string;
}

/** Title overlay configuration (D-12) */
export interface TitleConfig {
  text: string;
  subtitle?: string;
  startTimeMs: number;
  durationMs: number;
  style?: TitleStyleProps;
}

// ─── Visual Effects (D-11, D-12) ────────────────────────────────────────────

/** Transition animation type between silence cuts */
export type TransitionType = "zoom" | "crop-shift" | "none";

/** Zoom effect configuration (D-11, VISU-03) */
export interface ZoomConfig {
  enabled?: boolean;            // default: true
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
const VALID_ENTRANCE_ANIMATIONS: TitleEntranceAnimation[] = ["slide-up", "fade-in", "none"];
const VALID_TRANSITION_TYPES: TransitionType[] = ["zoom", "crop-shift", "none"];

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
          }
        }
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