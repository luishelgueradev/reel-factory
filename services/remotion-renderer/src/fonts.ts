// ─── Font infrastructure (D-07) ──────────────────────────────────────────────
// Curated font set: 26 Google Fonts + system monospace fallback.
// Fonts are loaded via @remotion/google-fonts at render time (T-06-07 mitigation:
// try/catch with monospace fallback if Google Fonts CDN is unavailable).

import { loadFont as loadInter, fontFamily as interFamily } from "@remotion/google-fonts/Inter";
import { loadFont as loadRoboto, fontFamily as robotoFamily } from "@remotion/google-fonts/Roboto";
import { loadFont as loadMontserrat, fontFamily as montserratFamily } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadOswald, fontFamily as oswaldFamily } from "@remotion/google-fonts/Oswald";
import { loadFont as loadPoppins, fontFamily as poppinsFamily } from "@remotion/google-fonts/Poppins";
import { loadFont as loadBebasNeue, fontFamily as bebasNeueFamily } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadAntonio, fontFamily as antonioFamily } from "@remotion/google-fonts/Antonio";
import { loadFont as loadRaleway, fontFamily as ralewayFamily } from "@remotion/google-fonts/Raleway";
import { loadFont as loadUbuntu, fontFamily as ubuntuFamily } from "@remotion/google-fonts/Ubuntu";
import { loadFont as loadNunito, fontFamily as nunitoFamily } from "@remotion/google-fonts/Nunito";
import { loadFont as loadSpaceGrotesk, fontFamily as spaceGroteskFamily } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadRubik, fontFamily as rubikFamily } from "@remotion/google-fonts/Rubik";
import { loadFont as loadSourceSans3, fontFamily as sourceSans3Family } from "@remotion/google-fonts/SourceSans3";
import { loadFont as loadOutfit, fontFamily as outfitFamily } from "@remotion/google-fonts/Outfit";
import { loadFont as loadPlayfairDisplay, fontFamily as playfairDisplayFamily } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadLexendDeca, fontFamily as lexendDecaFamily } from "@remotion/google-fonts/LexendDeca";
import { loadFont as loadSignika, fontFamily as signikaFamily } from "@remotion/google-fonts/Signika";
import { loadFont as loadLato, fontFamily as latoFamily } from "@remotion/google-fonts/Lato";
import { loadFont as loadSora, fontFamily as soraFamily } from "@remotion/google-fonts/Sora";
import { loadFont as loadDancingScript, fontFamily as dancingScriptFamily } from "@remotion/google-fonts/DancingScript";
import { loadFont as loadCormorantGaramond, fontFamily as cormorantGaramondFamily } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadDMSans, fontFamily as dmSansFamily } from "@remotion/google-fonts/DMSans";
import { loadFont as loadJosefinSans, fontFamily as josefinSansFamily } from "@remotion/google-fonts/JosefinSans";
import { loadFont as loadRighteous, fontFamily as righteousFamily } from "@remotion/google-fonts/Righteous";
import { loadFont as loadTitanOne, fontFamily as titanOneFamily } from "@remotion/google-fonts/TitanOne";

// ─── Available fonts (D-07) ─────────────────────────────────────────────────

/** Curated font set available for title and subtitle text */
export const AVAILABLE_FONTS = [
  "Inter", "Roboto", "Montserrat", "Oswald", "Poppins", "BebasNeue", "Antonio",
  "Raleway", "Ubuntu", "Nunito", "SpaceGrotesk", "Rubik", "SourceSans3",
  "Outfit", "PlayfairDisplay", "LexendDeca", "Signika", "Lato",
  "Sora", "DancingScript", "CormorantGaramond", "DMSans", "JosefinSans",
  "Righteous", "TitanOne", "monospace",
] as const;

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
  Poppins: { fontFamily: poppinsFamily, loadFont: loadPoppins },
  BebasNeue: { fontFamily: bebasNeueFamily, loadFont: loadBebasNeue },
  Antonio: { fontFamily: antonioFamily, loadFont: loadAntonio },
  Raleway: { fontFamily: ralewayFamily, loadFont: loadRaleway },
  Ubuntu: { fontFamily: ubuntuFamily, loadFont: loadUbuntu },
  Nunito: { fontFamily: nunitoFamily, loadFont: loadNunito },
  SpaceGrotesk: { fontFamily: spaceGroteskFamily, loadFont: loadSpaceGrotesk },
  Rubik: { fontFamily: rubikFamily, loadFont: loadRubik },
  SourceSans3: { fontFamily: sourceSans3Family, loadFont: loadSourceSans3 },
  Outfit: { fontFamily: outfitFamily, loadFont: loadOutfit },
  PlayfairDisplay: { fontFamily: playfairDisplayFamily, loadFont: loadPlayfairDisplay },
  LexendDeca: { fontFamily: lexendDecaFamily, loadFont: loadLexendDeca },
  Signika: { fontFamily: signikaFamily, loadFont: loadSignika },
  Lato: { fontFamily: latoFamily, loadFont: loadLato },
  Sora: { fontFamily: soraFamily, loadFont: loadSora },
  DancingScript: { fontFamily: dancingScriptFamily, loadFont: loadDancingScript },
  CormorantGaramond: { fontFamily: cormorantGaramondFamily, loadFont: loadCormorantGaramond },
  DMSans: { fontFamily: dmSansFamily, loadFont: loadDMSans },
  JosefinSans: { fontFamily: josefinSansFamily, loadFont: loadJosefinSans },
  Righteous: { fontFamily: righteousFamily, loadFont: loadRighteous },
  TitanOne: { fontFamily: titanOneFamily, loadFont: loadTitanOne },
};

// ─── loadFont: Async font loading with fallback ──────────────────────────────

/**
 * Load a Google Font by family name for use in Remotion compositions.
 *
 * Per T-06-07: If the font family is not recognized or loading fails (e.g.,
 * Google Fonts CDN unavailable in Docker), the function falls back to system
 * monospace and logs a warning — rendering continues without blocking.
 *
 * @param fontFamily - Font family name (e.g., "Inter", "Roboto", "Montserrat", etc.)
 * @returns The fontFamily string to use in CSS/Remotion styles
 */
/**
 * Get the actual CSS fontFamily name for a font module name.
 * E.g., "DancingScript" → "Dancing Script", "SourceSans3" → "Source Sans Three"
 * Falls back to the input name if the font is not found (browser will use fallback).
 */
export function getFontFamilyCSS(modulName: string): string {
  if (modulName === "monospace" || modulName === "") return "monospace";
  const loader = FONT_LOADERS[modulName];
  if (!loader) return modulName;
  return loader.fontFamily;
}

export async function loadFont(fontFamily: string): Promise<string> {
  // System monospace: no loading needed, use browser default
  if (fontFamily === "monospace" || fontFamily === "") {
    return "monospace";
  }

  const loader = FONT_LOADERS[fontFamily];
  if (!loader) {
    console.warn(`[fonts] Unknown font family "${fontFamily}", falling back to monospace`);
    return "monospace";
  }

  try {
    // Restrict to latin subsets only — loading all unicode ranges (the default) generates
    // 40-50 requests per font per Chrome tab, exhausting the socket pool when Remotion
    // renders frames in parallel. Spanish/English content only needs latin + latin-ext.
    const result = await loader.loadFont("normal", { subsets: ["latin", "latin-ext"] });
    return result.fontFamily;
  } catch (err) {
    console.warn(`[fonts] Failed to load font "${fontFamily}", falling back to monospace:`, err);
    return "monospace";
  }
}