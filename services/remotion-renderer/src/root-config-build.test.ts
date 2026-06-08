/**
 * root-config-build.test.ts — quick 260607-uzv item 4
 *
 * Regression guard for the RENDER path: Root.tsx (renderer-only) rebuilds a
 * fresh SubtitleConfig from the incoming `subtitleConfig` prop, and
 * `wordBackground` was MISSING from that whitelist — so the per-word tiktok
 * background was stripped before reaching TikTokLayout in the real render.
 * This asserts the field survives so the regression cannot silently return.
 *
 * Root.tsx registers a <Composition> and uses Remotion hooks (cannot run the
 * full composition in jsdom), so — matching the existing item-4 source
 * assertions in tiktok-word-background.test.tsx — we assert on the source.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

describe("Root config build — wordBackground survives the whitelist (item 4)", () => {
  const src = readFileSync(join(__dirname, "Root.tsx"), "utf8");

  it("forwards wordBackground from subtitleConfig into the rebuilt SubtitleConfig", () => {
    expect(src).toMatch(/wordBackground:\s*subtitleConfig\?\.wordBackground/);
  });

  it("places wordBackground near backgroundHighlight in the config object", () => {
    expect(src).toMatch(/backgroundHighlight:\s*subtitleConfig\?\.backgroundHighlight/);
    expect(src).toMatch(/wordBackground:\s*subtitleConfig\?\.wordBackground/);
  });
});

/**
 * render.ts is the TRUE render-path whitelist: it builds inputProps.subtitleConfig
 * from the job's pipeline-config.json and hands it to renderMedia(). Root.tsx's
 * rebuild runs AFTER this — so a field dropped in render.ts never reaches Root.tsx
 * at all. The item-4 guard above only checked Root.tsx, which is why wordBackground
 * still failed to render in the output video (260608-ka1 follow-up). These guard the
 * fields that were silently dropped here: wordBackground, fontWeight, fontStyle,
 * outerGlow.
 */
describe("render.ts inputProps — subtitle style fields survive the render whitelist", () => {
  const src = readFileSync(join(__dirname, "render.ts"), "utf8");

  for (const field of ["wordBackground", "fontWeight", "fontStyle", "outerGlow"]) {
    it(`forwards ${field} from pipelineConfig into inputProps.subtitleConfig`, () => {
      expect(src).toMatch(new RegExp(`${field}:\\s*pipelineConfig\\?\\.subtitle\\?\\.${field}`));
    });
  }
});
