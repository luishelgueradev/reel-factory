import { describe, it, expect } from "vitest";
import { partitionGuideOverlays, splitOverlaysByLayer } from "./pipeline-config";
import type { PngOverlayConfig } from "./pipeline-config";

// ─── Phase 27 OVERLAY-02 / OVERLAY-03 — guide render-exclusion ───────────────
// Pure unit tests (no Chromium). They prove the two cut points the renderer relies on:
//   1. render.ts maps ONLY partitionGuideOverlays(...).renderable for PNG decode/write,
//      so a guide (isGuide:true) is never decoded and no public/overlay-*.png is written.
//   2. Root.tsx (SubtitledVideo) bands via splitOverlaysByLayer, which is guide-aware,
//      so a guide reaching inputProps is painted in neither band (defense in depth).
// These exercise the same exported helpers both files call, mirroring the render path.

const guide: PngOverlayConfig = {
  imageData: "data:image/png;base64,GUIDE",
  x: 0,
  y: 0,
  displayWidth: 540,
  isGuide: true,
  name: "safe-zone guide",
};
const backOverlay: PngOverlayConfig = {
  imageData: "data:image/png;base64,BACK",
  x: 10,
  y: 20,
  displayWidth: 300,
  layer: "back",
};
const frontOverlay: PngOverlayConfig = {
  imageData: "data:image/png;base64,FRONT",
  x: 30,
  y: 40,
  displayWidth: 200,
  layer: "front",
};

describe("render guide exclusion — OVERLAY-02 (authoritative cut in render.ts)", () => {
  it("partitionGuideOverlays drops isGuide overlays from `renderable` (never decoded/written)", () => {
    const { guides, renderable } = partitionGuideOverlays([backOverlay, guide, frontOverlay]);
    expect(guides).toHaveLength(1);
    expect(guides[0].isGuide).toBe(true);
    // renderable — the array render.ts maps over for fs.writeFileSync — has zero guides
    expect(renderable).toHaveLength(2);
    expect(renderable.some(o => o.isGuide === true)).toBe(false);
    expect(renderable).toEqual([backOverlay, frontOverlay]);
  });

  it("a config containing only a guide yields an empty `renderable` (no PNG written)", () => {
    const { guides, renderable } = partitionGuideOverlays([guide]);
    expect(guides).toHaveLength(1);
    expect(renderable).toHaveLength(0);
  });

  it("with no guides present, `renderable` equals the full input (byte-identical render path)", () => {
    const { guides, renderable } = partitionGuideOverlays([backOverlay, frontOverlay]);
    expect(guides).toHaveLength(0);
    expect(renderable).toEqual([backOverlay, frontOverlay]);
  });
});

describe("render guide exclusion — OVERLAY-03 (defense in depth in Root.tsx banding)", () => {
  it("splitOverlaysByLayer over [guide, back, front] produces bands with zero guides", () => {
    const { back, front } = splitOverlaysByLayer([guide, backOverlay, frontOverlay]);
    expect(back.some(o => o.isGuide === true)).toBe(false);
    expect(front.some(o => o.isGuide === true)).toBe(false);
    expect(back).toEqual([backOverlay]);
    expect(front).toEqual([frontOverlay]);
  });

  it("a guide with layer:'front' is still excluded from the front band (isGuide wins over layer)", () => {
    const frontGuide: PngOverlayConfig = { ...guide, layer: "front" };
    const { back, front } = splitOverlaysByLayer([frontGuide, frontOverlay]);
    expect(front.some(o => o.isGuide === true)).toBe(false);
    expect(back.some(o => o.isGuide === true)).toBe(false);
    expect(front).toEqual([frontOverlay]);
  });

  it("non-guide banding is unchanged vs the previous inline filters (layer default 'back')", () => {
    const noLayer: PngOverlayConfig = { imageData: "data:image/png;base64,X", x: 0, y: 0, displayWidth: 100 };
    const { back, front } = splitOverlaysByLayer([noLayer, frontOverlay]);
    // matches old inline: back = (o.layer ?? "back") === "back"; front = o.layer === "front"
    expect(back).toEqual([noLayer]);
    expect(front).toEqual([frontOverlay]);
  });
});
