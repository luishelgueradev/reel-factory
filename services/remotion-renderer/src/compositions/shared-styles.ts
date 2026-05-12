import type { SubtitleConfig, SubtitlePosition } from "../pipeline-config";

// ─── Timing constants (shared across all layouts) ──────────────────────────

export const FADE_IN_MS = 100;
export const FADE_OUT_MS = 300;
export const PAGE_OVERLAP_GUARD_MS = 100;

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
  bottomOffset: number
): React.CSSProperties {
  switch (position) {
    case "bottom-center":
      return {
        position: "absolute" as const,
        bottom: bottomOffset,
        left: 40,
        right: 40,
        textAlign: "center" as const,
      };
    case "top-center":
      return {
        position: "absolute" as const,
        top: 100,
        left: 40,
        right: 40,
        textAlign: "center" as const,
      };
    case "center-screen":
      return {
        position: "absolute" as const,
        top: "50%",
        left: 40,
        right: 40,
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