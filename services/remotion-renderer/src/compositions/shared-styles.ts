import type { SubtitleConfig, SubtitlePosition } from "../pipeline-config.js";

// ─── Timing constants (shared across all layouts) ──────────────────────────

export const FADE_IN_MS = 100;
export const FADE_OUT_MS = 300;
export const PAGE_OVERLAP_GUARD_MS = 100;

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