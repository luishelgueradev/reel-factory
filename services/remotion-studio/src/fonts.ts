// ─── Font infrastructure (D-07) ──────────────────────────────────────────────
// Curated font set: 26 Google Fonts + system monospace fallback.
//
// RENDER-05: Offline-first font loading chain (D-10, D-11, D-12)
// 1. Local vendored woff2 via @remotion/fonts + staticFile() — offline, deterministic
// 2. gstatic via @remotion/google-fonts (existing loader) — network fallback
// 3. Bundled Plus Jakarta Sans — FINAL fallback, NEVER monospace (D-12)
//
// Each tier is wrapped in a ~10s withTimeout race (D-11) so a never-resolving
// network call cannot hang the renderer for the full 3h process timeout.
//
// Note (studio): vendored woff2 files live in services/remotion-renderer/public/fonts/.
// The studio's local-tier attempt for non-vendored fonts will simply fail over to
// gstatic — acceptable for preview (the renderer is the one that must be deterministic).

import { loadFont as loadLocal } from "@remotion/fonts";
import { staticFile } from "remotion";

import { loadFont as loadPlusJakartaSans, fontFamily as plusJakartaSansFamily } from "@remotion/google-fonts/PlusJakartaSans";
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

// ─── Resilience constants (RENDER-05) ────────────────────────────────────────

/** Timeout per font-load attempt. D-11: bounds the hang path. */
const PER_FONT_TIMEOUT_MS = 10_000;

/**
 * Bundled-sans fallback family. D-12: the FINAL fallback is ALWAYS a real
 * sans-serif font — NEVER "monospace". Plus Jakarta Sans woff2 is vendored
 * in the renderer's public/fonts/ so this fallback works offline at render time.
 */
const BUNDLED_SANS = "Plus Jakarta Sans";

/**
 * Set of font module names that have a vendored woff2 in public/fonts/.
 * These are the fonts that can be loaded locally without any network call.
 * The remaining fonts fall through to the gstatic-retry tier.
 */
// Gap-closure (RENDER-05): the ENTIRE AVAILABLE_FONTS catalog is now vendored as
// local woff2 (latin subset, public/fonts/<Font>-{Regular,Bold}.woff2). Previously
// only 7 were vendored; a config selecting any of the other 19 (e.g. Outfit, Raleway)
// still hit gstatic and a blocked fetch ABORTED the render — the original RENDER-05
// bug. The gstatic tier (Tier 2) registers @font-face lazily, so its failure surfaces
// only inside Chrome at frame time, where the loadFont try/catch cannot see it. The
// only reliable offline guarantee is Tier 1 covering every selectable font.
const VENDORED_FONTS = new Set([
  "PlusJakartaSans",
  "Inter",
  "Roboto",
  "Montserrat",
  "Oswald",
  "Poppins",
  "BebasNeue",
  "Antonio",
  "Raleway",
  "Ubuntu",
  "Nunito",
  "SpaceGrotesk",
  "Rubik",
  "SourceSans3",
  "Outfit",
  "PlayfairDisplay",
  "LexendDeca",
  "Signika",
  "Lato",
  "Sora",
  "DancingScript",
  "CormorantGaramond",
  "DMSans",
  "JosefinSans",
  "Righteous",
  "TitanOne",
]);

/**
 * Wraps a promise in a ~ms timeout race. Rejects with an Error("font timeout")
 * if the promise does not settle within ms. Closes the hang path (D-11).
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("font timeout")), ms)
    ),
  ]);
}

// ─── Available fonts (D-07) ─────────────────────────────────────────────────

/** Curated font set available for title and subtitle text */
export const AVAILABLE_FONTS = [
  "PlusJakartaSans",
  "Inter", "Roboto", "Montserrat", "Oswald", "Poppins", "BebasNeue", "Antonio",
  "Raleway", "Ubuntu", "Nunito", "SpaceGrotesk", "Rubik", "SourceSans3",
  "Outfit", "PlayfairDisplay", "LexendDeca", "Signika", "Lato",
  "Sora", "DancingScript", "CormorantGaramond", "DMSans", "JosefinSans",
  "Righteous", "TitanOne", "monospace",
] as const;

export type AvailableFont = (typeof AVAILABLE_FONTS)[number];

// ─── Font loaders map ────────────────────────────────────────────────────────

/**
 * Maps Google Font module names to their Remotion Google Font loaders (gstatic tier).
 * Each loader provides a `loadFont()` function and a `fontFamily` string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FONT_LOADERS: Record<string, { fontFamily: string; loadFont: (...args: any[]) => any }> = {
  PlusJakartaSans: { fontFamily: plusJakartaSansFamily, loadFont: loadPlusJakartaSans },
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

// ─── getFontFamilyCSS ────────────────────────────────────────────────────────

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

// ─── loadFont: RENDER-05 offline-first font loading ──────────────────────────

/**
 * Load a font by module name with a three-tier offline-first resilience chain.
 *
 * Tier 1 — Local vendored woff2 via @remotion/fonts + staticFile() (offline, D-10):
 *   Loads Regular (400) + Bold (700) from public/fonts/<ModuleName>-{Regular,Bold}.woff2.
 *   Only attempted for fonts in VENDORED_FONTS set.
 *
 * Tier 2 — gstatic via @remotion/google-fonts (network fallback, 2 attempts):
 *   Uses the existing loader map with subsets: ["latin","latin-ext"] (socket-pool guard).
 *   Restricted to latin subsets — loading all unicode ranges generates 40-50 requests per
 *   font per Chrome tab, exhausting the socket pool during parallel frame rendering.
 *
 * Tier 3 — Bundled Plus Jakarta Sans (FINAL fallback, D-12):
 *   ALWAYS a real sans-serif. NEVER "monospace".
 *
 * Every attempt is wrapped in a ~10s withTimeout race (D-11) so a stuck network
 * call cannot hang the renderer for the full 3h process timeout.
 *
 * @param fontFamily - Font module name (e.g., "Inter", "Roboto", "PlusJakartaSans")
 * @returns The CSS fontFamily string to use in styles
 */
export async function loadFont(fontFamily: string): Promise<string> {
  // Explicit monospace/empty: caller intent — not a degraded fallback (keep as-is)
  if (fontFamily === "monospace" || fontFamily === "") {
    return "monospace";
  }

  const loader = FONT_LOADERS[fontFamily];

  // Unknown font: skip both tiers and go directly to the bundled-sans fallback.
  // Never return "monospace" for an unknown font (D-12 guard).
  if (!loader) {
    console.warn(`[fonts] Unknown font family "${fontFamily}", falling back to ${BUNDLED_SANS}`);
    return await loadBundledSans();
  }

  const cssFamily = loader.fontFamily;

  // ── Tier 1: Local vendored woff2 (offline, deterministic) ───────────────
  if (VENDORED_FONTS.has(fontFamily)) {
    try {
      await withTimeout(
        loadLocal({
          family: cssFamily,
          url: staticFile(`fonts/${fontFamily}-Regular.woff2`),
          weight: "400",
        }),
        PER_FONT_TIMEOUT_MS
      );
      await withTimeout(
        loadLocal({
          family: cssFamily,
          url: staticFile(`fonts/${fontFamily}-Bold.woff2`),
          weight: "700",
        }),
        PER_FONT_TIMEOUT_MS
      );
      return cssFamily;
    } catch (err) {
      console.warn(`[fonts] Local woff2 load failed for "${fontFamily}", trying gstatic:`, err);
      // Fall through to tier 2
    }
  }

  // ── Tier 2: gstatic via @remotion/google-fonts (2 attempts) ─────────────
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Restrict to latin subsets only — loading all unicode ranges generates
      // 40-50 requests per font per Chrome tab, exhausting the socket pool when
      // Remotion renders frames in parallel. Spanish/English only needs latin + latin-ext.
      const result = await withTimeout(
        loader.loadFont("normal", { subsets: ["latin", "latin-ext"] }),
        PER_FONT_TIMEOUT_MS
      );
      return result.fontFamily;
    } catch (err) {
      console.warn(`[fonts] gstatic attempt ${attempt + 1} failed for "${fontFamily}":`, err);
    }
  }

  // ── Tier 3: Bundled Plus Jakarta Sans — FINAL fallback, NEVER monospace ──
  console.warn(`[fonts] All tiers failed for "${fontFamily}", using bundled fallback ${BUNDLED_SANS}`);
  return await loadBundledSans();
}

/**
 * Load the bundled Plus Jakarta Sans woff2 and return its family name.
 * This is the FINAL fallback — always a real sans-serif, NEVER monospace (D-12).
 * If even the bundled load fails (extreme edge case), return BUNDLED_SANS anyway —
 * the @font-face may still be registered from a previous successful call, and if
 * not, the browser will use the system sans-serif, which is still a real sans.
 */
async function loadBundledSans(): Promise<string> {
  try {
    await withTimeout(
      loadLocal({
        family: BUNDLED_SANS,
        url: staticFile("fonts/PlusJakartaSans-Regular.woff2"),
        weight: "400",
      }),
      PER_FONT_TIMEOUT_MS
    );
    await withTimeout(
      loadLocal({
        family: BUNDLED_SANS,
        url: staticFile("fonts/PlusJakartaSans-Bold.woff2"),
        weight: "700",
      }),
      PER_FONT_TIMEOUT_MS
    );
  } catch (err) {
    console.warn(`[fonts] Bundled-sans load failed (returning family name anyway):`, err);
  }
  // Always return BUNDLED_SANS — worst case the CSS family resolves to system sans
  return BUNDLED_SANS;
}
