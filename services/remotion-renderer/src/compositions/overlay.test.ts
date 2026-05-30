import { describe, it, expect } from "vitest";
import { computeOverlaySrc, computeOverlayOpacity } from "./PngOverlay";

// ─── PngOverlay behavior tests (Phase 21, OVERLAY-01/02/03) ──────────────────
// Tests are written as pure unit tests against the exported helper functions.
// This avoids needing a React renderer in vitest (PngOverlay uses Remotion JSX
// which requires Chromium context for full rendering). Tests run via the
// renderer's vitest suite after the compositions/ sync step (Task 3).

describe("PngOverlay — export existence", () => {
  it("computeOverlaySrc is exported as a named function", () => {
    expect(typeof computeOverlaySrc).toBe("function");
  });

  it("computeOverlayOpacity is exported as a named function", () => {
    expect(typeof computeOverlayOpacity).toBe("function");
  });
});

describe("PngOverlay — src selection (D-11)", () => {
  // Test 3: When _resolvedFile is set and no rawImageSrc, use staticFile(_resolvedFile)
  it("uses staticFile(overlay._resolvedFile) when rawImageSrc is undefined", () => {
    const result = computeOverlaySrc(undefined, "overlay-0.png");
    // staticFile("overlay-0.png") returns a URL that includes the filename
    expect(result).toContain("overlay-0.png");
  });

  // Test 4: When rawImageSrc is provided (data URL), it wins over staticFile fallback
  it("uses rawImageSrc directly when provided (Player/browser context)", () => {
    const dataUrl = "data:image/png;base64,abc123";
    const result = computeOverlaySrc(dataUrl, "overlay-0.png");
    expect(result).toBe(dataUrl);
  });

  it("uses staticFile fallback to overlay-0.png when both rawImageSrc and _resolvedFile are undefined", () => {
    const result = computeOverlaySrc(undefined, undefined);
    expect(result).toContain("overlay-0.png");
  });
});

describe("PngOverlay — opacity (D-06)", () => {
  // Test 5: opacity defaults to 1 when undefined
  it("defaults to 1 when opacity is undefined", () => {
    expect(computeOverlayOpacity(undefined)).toBe(1);
  });

  it("returns the configured opacity value when provided", () => {
    expect(computeOverlayOpacity(0.5)).toBe(0.5);
  });

  it("returns 0 when opacity is 0", () => {
    expect(computeOverlayOpacity(0)).toBe(0);
  });
});
