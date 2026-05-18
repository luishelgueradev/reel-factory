// ─── Text to TikTokPage conversion (D-11, RESEARCH Pattern 3) ─────────────────
// Converts arbitrary text from textarea into TikTokPage[] format for the Remotion Player.
// Uses createTikTokStyleCaptions() — the same function as production captions.ts —
// ensuring page-breaking behavior matches production exactly.

import { createTikTokStyleCaptions } from "@remotion/captions";
import type { TikTokPage, Caption } from "@remotion/captions";

/** Default Spanish sample text for the preview textarea (D-11) */
export const DEFAULT_SAMPLE_TEXT = "Hoy quiero compartir contigo una reflexión sobre el poder de las palabras y cómo influyen en nuestra vida diaria. Cada frase que pronunciamos tiene el potencial de inspirar, de sanar o de transformar la realidad de quienes nos rodean.";

/**
 * Convert arbitrary text into TikTokPage[] for the Remotion Player.
 * Per RESEARCH Pattern 3: use createTikTokStyleCaptions() with synthetic timestamps.
 *
 * @param text - The text to convert into caption pages
 * @param options.wordsPerSecond - Words per second for synthetic timestamp generation (default: 3)
 * @returns TikTokPage[] ready for the Remotion Player
 */
export function textToCaptionPages(
  text: string,
  options?: { wordsPerSecond?: number }
): TikTokPage[] {
  const wordsPerSecond = options?.wordsPerSecond ?? 3;
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return [];
  }

  const wordDurationMs = Math.round(1000 / wordsPerSecond);

  // Build synthetic Caption[] with evenly-distributed timestamps
  // Per RESEARCH: first word has no leading space, subsequent words have leading space
  const captions: Caption[] = words.map((word, i) => ({
    text: i === 0 ? word : ` ${word}`,
    startMs: i * wordDurationMs,
    endMs: (i + 1) * wordDurationMs,
    timestampMs: Math.round((i + 0.5) * wordDurationMs),
    confidence: 0.95,
  }));

  // Use the same pagination algorithm as production
  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: 1500,
  });

  return pages;
}

/**
 * Derive the total duration in milliseconds from the last caption page's end time.
 * TikTokPage tokens have `fromMs` and `toMs` (not startMs/endMs).
 * Returns a fallback value if captionPages is empty.
 */
export function deriveTotalDurationMs(captionPages: TikTokPage[], fallbackMs: number = 10000): number {
  if (captionPages.length === 0) return fallbackMs;

  let maxToMs = 0;
  for (const page of captionPages) {
    for (const token of page.tokens) {
      // TikTokToken uses fromMs/toMs
      const toMs = (token as { fromMs: number; toMs: number }).toMs;
      if (toMs > maxToMs) {
        maxToMs = toMs;
      }
    }
  }

  return maxToMs > 0 ? maxToMs : fallbackMs;
}