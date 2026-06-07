import { describe, it, expect } from "vitest";
import {
  validatePipelineConfig,
  splitOverlaysByLayer,
  partitionGuideOverlays,
} from "./pipeline-config";

// ─── Phase 27 mirror-parity gate ─────────────────────────────────────────────
// pipeline-config.ts is a HAND-MAINTAINED mirror between studio and renderer
// (AGENTS.md). These tests guard the studio side of the name/isGuide field +
// partitionGuideOverlays / guide-aware splitOverlaysByLayer contract so the two
// files cannot silently drift. They intentionally mirror the renderer cases.

const VALID_OVERLAY = { imageData: "data:image/png;base64,abc", x: 0, y: 0, displayWidth: 200 };

describe("validatePipelineConfig — overlay name (OVERLAY-04)", () => {
  it("accepts overlay with name as a string", () => {
    const config = {
      subtitle: { layout: "tiktok" },
      overlays: [{ ...VALID_OVERLAY, name: "Mi logo" }],
    };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.includes("name"))).toHaveLength(0);
  });

  it("rejects overlay with name as a number", () => {
    const config = {
      subtitle: { layout: "tiktok" },
      overlays: [{ ...VALID_OVERLAY, name: 123 }],
    };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e === "overlays[0].name must be a string")).toBe(true);
  });
});

describe("validatePipelineConfig — overlay isGuide (OVERLAY-01/02/03)", () => {
  it("accepts overlay with isGuide: true", () => {
    const config = {
      subtitle: { layout: "tiktok" },
      overlays: [{ ...VALID_OVERLAY, isGuide: true }],
    };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.includes("isGuide"))).toHaveLength(0);
  });

  it("rejects overlay with isGuide as a string", () => {
    const config = {
      subtitle: { layout: "tiktok" },
      overlays: [{ ...VALID_OVERLAY, isGuide: "yes" }],
    };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e === "overlays[0].isGuide must be a boolean")).toBe(true);
  });

  it("existing overlay (no name, no isGuide) still validates — additive", () => {
    const config = { subtitle: { layout: "tiktok" }, overlays: [VALID_OVERLAY] };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("partitionGuideOverlays (OVERLAY-02)", () => {
  const BASE = { imageData: "data:image/png;base64,abc", x: 0, y: 0, displayWidth: 200 };

  it("separates guide overlays from renderable overlays", () => {
    const guide = { ...BASE, isGuide: true, x: 1 };
    const renderable = { ...BASE, x: 2 };
    const result = partitionGuideOverlays([guide, renderable]);
    expect(result.guides).toHaveLength(1);
    expect(result.guides[0].x).toBe(1);
    expect(result.renderable).toHaveLength(1);
    expect(result.renderable[0].x).toBe(2);
  });

  it("treats undefined isGuide as renderable", () => {
    const result = partitionGuideOverlays([{ ...BASE }]);
    expect(result.guides).toHaveLength(0);
    expect(result.renderable).toHaveLength(1);
  });

  it("treats isGuide: false as renderable", () => {
    const result = partitionGuideOverlays([{ ...BASE, isGuide: false }]);
    expect(result.guides).toHaveLength(0);
    expect(result.renderable).toHaveLength(1);
  });

  it("empty input yields two empty arrays", () => {
    const result = partitionGuideOverlays([]);
    expect(result.guides).toHaveLength(0);
    expect(result.renderable).toHaveLength(0);
  });
});

describe("splitOverlaysByLayer — guide exclusion (OVERLAY-03)", () => {
  const BASE = { imageData: "data:image/png;base64,abc", x: 0, y: 0, displayWidth: 200 };

  it("excludes isGuide overlays from both bands", () => {
    const guide = { ...BASE, isGuide: true, x: 99 };
    const back = { ...BASE, layer: "back" as const, x: 1 };
    const front = { ...BASE, layer: "front" as const, x: 2 };
    const result = splitOverlaysByLayer([guide, back, front]);
    expect(result.back.some((o) => o.isGuide === true)).toBe(false);
    expect(result.front.some((o) => o.isGuide === true)).toBe(false);
    expect(result.back).toHaveLength(1);
    expect(result.front).toHaveLength(1);
  });

  it("excludes a guide even when it has layer: front (isGuide wins over layer)", () => {
    const guideFront = { ...BASE, isGuide: true, layer: "front" as const };
    const result = splitOverlaysByLayer([guideFront]);
    expect(result.back).toHaveLength(0);
    expect(result.front).toHaveLength(0);
  });

  it("non-guide back/front banding is unchanged", () => {
    const back = { ...BASE, layer: "back" as const };
    const implicitBack = { ...BASE };
    const front = { ...BASE, layer: "front" as const };
    const result = splitOverlaysByLayer([back, implicitBack, front]);
    expect(result.back).toHaveLength(2);
    expect(result.front).toHaveLength(1);
  });
});
