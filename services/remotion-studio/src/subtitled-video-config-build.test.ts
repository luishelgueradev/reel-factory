/**
 * subtitled-video-config-build.test.ts — quick 260607-uzv item 4
 *
 * Regression guard: SubtitledVideo rebuilds a fresh SubtitleConfig from the
 * incoming `subtitleConfig` prop (a whitelist), and `wordBackground` was MISSING
 * from that whitelist — so the per-word tiktok background was stripped before it
 * could reach TikTokLayout (both preview and real render). This asserts the
 * field survives the config build so the regression cannot silently return.
 *
 * The config build is inline JSX-adjacent code (no Remotion hooks can run in
 * jsdom for the full composition), so — matching the existing item-4 source
 * assertions in tiktok-word-background.test.tsx — we assert on the source.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

describe("SubtitledVideo config build — wordBackground survives the whitelist (item 4)", () => {
  const src = readFileSync(join(__dirname, "SubtitledVideo.tsx"), "utf8");

  it("forwards wordBackground from subtitleConfig into the rebuilt SubtitleConfig", () => {
    expect(src).toMatch(/wordBackground:\s*subtitleConfig\?\.wordBackground/);
  });

  it("places wordBackground near backgroundHighlight in the config object", () => {
    // both fields must be present in the same config build
    expect(src).toMatch(/backgroundHighlight:\s*subtitleConfig\?\.backgroundHighlight/);
    expect(src).toMatch(/wordBackground:\s*subtitleConfig\?\.wordBackground/);
  });
});
