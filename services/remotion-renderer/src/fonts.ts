// ─── Font infrastructure (D-07) ──────────────────────────────────────────────
// Curated font set: Inter, Roboto, Montserrat, Oswald, and system monospace fallback.
// Fonts are loaded via @remotion/google-fonts at render time (T-06-07 mitigation:
// try/catch with monospace fallback if Google Fonts CDN is unavailable).

import { loadFont as loadInter, fontFamily as interFamily } from "@remotion/google-fonts/Inter";
import { loadFont as loadRoboto, fontFamily as robotoFamily } from "@remotion/google-fonts/Roboto";
import { loadFont as loadMontserrat, fontFamily as montserratFamily } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadOswald, fontFamily as oswaldFamily } from "@remotion/google-fonts/Oswald";

// ─── Available fonts (D-07) ─────────────────────────────────────────────────

/** Curated font set available for title and subtitle text */
export const AVAILABLE_FONTS = ["Inter", "Roboto", "Montserrat", "Oswald", "monospace"] as const;

export type AvailableFont = (typeof AVAILABLE_FONTS)[number];

// ─── Font loaders map ────────────────────────────────────────────────────────

/**
 * Maps Google Font family names to their Remotion Google Font loaders.
 * Each loader provides a `loadFont()` function and a `fontFamily` string.
 */
// Each font module exports loadFont (with complex generic type) and fontFamily (string).
// We store them in a map for dynamic lookup by name.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FONT_LOADERS: Record<string, { fontFamily: string; loadFont: (...args: any[]) => any }> = {
  Inter: { fontFamily: interFamily, loadFont: loadInter },
  Roboto: { fontFamily: robotoFamily, loadFont: loadRoboto },
  Montserrat: { fontFamily: montserratFamily, loadFont: loadMontserrat },
  Oswald: { fontFamily: oswaldFamily, loadFont: loadOswald },
};

// ─── loadFont: Async font loading with fallback ──────────────────────────────

/**
 * Load a Google Font by family name for use in Remotion compositions.
 *
 * Per T-06-07: If the font family is not recognized or loading fails (e.g.,
 * Google Fonts CDN unavailable in Docker), the function falls back to system
 * monospace and logs a warning — rendering continues without blocking.
 *
 * @param fontFamily - Font family name (e.g., "Inter", "Roboto", "Montserrat", "Oswald")
 * @returns The fontFamily string to use in CSS/Remotion styles
 */
export async function loadFont(fontFamily: string): Promise<string> {
  // System monospace: no loading needed, use browser default
  if (fontFamily === "monospace" || fontFamily === "") {
    return "monospace";
  }

  const loader = FONT_LOADERS[fontFamily];
  if (!loader) {
    console.warn(`[fonts] Unknown font family "${fontFamily}", falling back to system default`);
    return "sans-serif";
  }

  try {
    const result = await loader.loadFont();
    return result.fontFamily;
  } catch (err) {
    console.warn(`[fonts] Failed to load font "${fontFamily}", falling back to system default:`, err);
    return "sans-serif";
  }
}