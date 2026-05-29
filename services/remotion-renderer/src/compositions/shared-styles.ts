import type { SubtitleConfig, SubtitlePosition, OuterGlow } from "../pipeline-config";
import { DEFAULT_SUBTITLE_CONFIG } from "../pipeline-config";

// ─── Timing constants (shared across all layouts) ──────────────────────────

export const FADE_IN_MS = 100;
export const FADE_OUT_MS = 300;
export const PAGE_OVERLAP_GUARD_MS = 100;
export const HIGHLIGHT_FADE_MS = 80;

// ─── Transition animation constants (D-05, D-06, D-07) ─────────────────────

export const TRANSITION_PRE_CUT_MS = 150;  // Effect starts 150ms before cut (D-05)
export const TRANSITION_POST_CUT_MS = 100; // Effect ends 100ms after cut (D-05)
export const DEFAULT_TRANSITION_DURATION_MS = 250; // D-07
export const ZOOM_TRANSITION_SCALE = 1.08;  // D-06
export const CROP_SHIFT_PX = 20;            // D-06

// ─── Zoom animation constants (D-03) ─────────────────────────────────────

export const ZOOM_RAMP_MS = 300;           // Ease-in and ease-out ramp duration
export const DEFAULT_ZOOM_SCALE = 1.15;    // 15% zoom (D-03)
export const ZOOM_MERGE_GAP_MS = 500;       // Merge events within this gap (D-04)

// ─── Position helpers (D-09) ─────────────────────────────────────────────────

export function getPositionStyles(
  position: SubtitlePosition,
  bottomOffset: number,
  subtitleWidth?: number
): React.CSSProperties {
  const useMaxWidth = subtitleWidth && subtitleWidth > 0;
  const constrainedHorizontal = useMaxWidth
    ? { left: 0, right: 0 }
    : { left: 40, right: 40 };

  switch (position) {
    case "bottom-center":
      return {
        position: "absolute" as const,
        bottom: bottomOffset,
        ...constrainedHorizontal,
        textAlign: "center" as const,
      };
    case "top-center":
      return {
        position: "absolute" as const,
        top: 100,
        ...constrainedHorizontal,
        textAlign: "center" as const,
      };
    case "center-screen":
      return {
        position: "absolute" as const,
        top: "50%",
        ...constrainedHorizontal,
        transform: "translateY(-50%)",
        textAlign: "center" as const,
      };
  }
}

// ─── Background highlight (D-08) ────────────────────────────────────────────

export function getBackgroundHighlightStyle(
  backgroundHighlight: SubtitleConfig["backgroundHighlight"]
): React.CSSProperties {
  if (!backgroundHighlight || !backgroundHighlight.enabled) {
    return {};
  }
  return {
    backgroundColor: backgroundHighlight.color,
    padding: `${backgroundHighlight.padding}px`,
    borderRadius: `${backgroundHighlight.borderRadius}px`,
  };
}

// ─── Outer glow (TYPO-04) ────────────────────────────────────────────────────

export function getOuterGlowStyle(
  outerGlow: OuterGlow | undefined,
  existingTextShadow?: string
): React.CSSProperties {
  if (!outerGlow || !outerGlow.enabled) {
    return existingTextShadow ? { textShadow: existingTextShadow } : {};
  }
  let hex = outerGlow.color.replace("#", "");
  // Expand 3-char shorthand (#fff → #ffffff) to prevent NaN channel values
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const colorWithAlpha = `rgba(${r}, ${g}, ${b}, ${outerGlow.intensity})`;
  const glowShadow = `0 0 ${outerGlow.softness}px ${colorWithAlpha}`;
  const combined = existingTextShadow ? `${existingTextShadow}, ${glowShadow}` : glowShadow;
  return { textShadow: combined };
}

// ─── Past word opacity helper (D-07) ──────────────────────────────────────

export function getPastWordOpacity(config: SubtitleConfig): number {
  return config.pastWordOpacity ?? DEFAULT_SUBTITLE_CONFIG.pastWordOpacity;
}

// ─── Highlight color helper ──────────────────────────────────────────────

/**
 * Compute the display color for a word considering the ephemeral highlight flash.
 *
 * States:
 * - "active": word is currently being spoken
 * - "just-activated": word just became active (framesSinceActive near 0) — show highlightColor
 * - "was-active": word was spoken previously — show inactiveColor with pastWordOpacity
 * - "upcoming": word hasn't been spoken yet — show inactiveColor
 *
 * When highlightDurationMs > 0 and the word just became active, the word briefly
 * shows highlightColor before transitioning to activeColor over highlightDurationMs.
 */
export function getHighlightWordColor(params: {
  isActive: boolean;
  wasActive: boolean;
  framesSinceActive: number;
  fps: number;
  activeColor: string;
  highlightColor: string;
  highlightDurationMs: number;
  highlightTransition: "fade" | "instant";
}): string {
  const {
    isActive,
    wasActive,
    framesSinceActive,
    fps,
    activeColor,
    highlightColor,
    highlightDurationMs,
    highlightTransition,
  } = params;

  if (!isActive) return activeColor; // color assigned by caller (inactive for non-active words)

  if (highlightDurationMs <= 0 || highlightColor === activeColor) {
    return activeColor; // highlight disabled or same color
  }

  const highlightFrames = Math.round(highlightDurationMs * (fps / 1000));

  if (framesSinceActive >= highlightFrames) {
    return activeColor; // highlight period over
  }

  if (highlightTransition === "instant") {
    return highlightColor; // stays highlightColor for entire duration, then snaps
  }

  // "fade" transition: interpolate from highlightColor to activeColor
  // But since these are CSS color strings, we can't interpolate directly.
  // Instead, we use opacity blending: show highlightColor with decreasing opacity
  // layered over activeColor. We achieve this by returning highlightColor
  // and letting the caller handle opacity, or we just return highlightColor
  // for the early frames and activeColor for later frames within the highlight period.
  // Simplest correct approach: return highlightColor for first half, then activeColor.
  // Better approach: since we can't blend hex colors in CSS easily,
  // we return highlightColor with an opacity that fades to 0, revealing activeColor behind.
  // We handle this by returning both color and opacity separately.
  return highlightColor; // caller must also apply getHighlightOpacity()
}

/**
 * Returns the opacity to apply on top of the highlight color during fade transition.
 * Returns 1 for "instant" transition (no fading needed).
 * Returns an interpolated value 1→0 during the fade period.
 * When opacity reaches 0, the word shows activeColor fully.
 */
export function getHighlightOpacity(params: {
  framesSinceActive: number;
  fps: number;
  highlightDurationMs: number;
  highlightTransition: "fade" | "instant";
  interpolate: typeof import("remotion").interpolate;
}): number {
  const { framesSinceActive, fps, highlightDurationMs, highlightTransition, interpolate: interp } = params;

  if (highlightTransition === "instant" || highlightDurationMs <= 0) {
    return 1; // no fade needed
  }

  const highlightFrames = Math.round(highlightDurationMs * (fps / 1000));
  if (framesSinceActive >= highlightFrames) {
    return 0; // highlight over
  }

  return interp(
    framesSinceActive,
    [0, highlightFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
}