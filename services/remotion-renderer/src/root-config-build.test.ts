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
