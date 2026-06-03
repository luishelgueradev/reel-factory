// ─── PositionPresets — TDD tests ─────────────────────────────────────────────
// Tests for the shared 9-point position preset component (D-07, D-08, D-09).
// Pure math helper and enum-mode click mapping.

import { describe, it, expect, vi } from "vitest";
import { computePresetXY } from "./PositionPresets.js";

// ─── computePresetXY — pure math ─────────────────────────────────────────────

describe("computePresetXY", () => {
  it("top-left anchor → {x: 0, y: 0}", () => {
    expect(computePresetXY("left", "top", 200, 100)).toEqual({ x: 0, y: 0 });
  });

  it("center-center anchor → size-aware centered coords", () => {
    // round((1080-200)/2)=440, round((1920-100)/2)=910
    expect(computePresetXY("center", "center", 200, 100)).toEqual({ x: 440, y: 910 });
  });

  it("right-bottom anchor → frame minus element size", () => {
    // 1080-200=880, 1920-100=1820
    expect(computePresetXY("right", "bottom", 200, 100)).toEqual({ x: 880, y: 1820 });
  });

  it("center-bottom with zero element size → {x: 540, y: 1920}", () => {
    expect(computePresetXY("center", "bottom", 0, 0)).toEqual({ x: 540, y: 1920 });
  });

  it("respects custom frameWidth/frameHeight overrides", () => {
    // With a 100×200 frame, a 10×20 element at center-center
    // x = round((100-10)/2)=45, y = round((200-20)/2)=90
    expect(computePresetXY("center", "center", 10, 20, 100, 200)).toEqual({ x: 45, y: 90 });
  });

  it("outputs integer values (Math.round applied)", () => {
    // 1080-201=879/2=439.5 → round to 440; 1920-101=1819/2=909.5 → round to 910
    const result = computePresetXY("center", "center", 201, 101);
    expect(Number.isInteger(result.x)).toBe(true);
    expect(Number.isInteger(result.y)).toBe(true);
  });
});
