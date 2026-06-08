// ─── computeCenteredXForWidth (quick 260607-uzv item 2) ─────────────────────────
// Verifies that changing the title box width re-centers x so the box grows /
// shrinks symmetrically around its horizontal center, clamped on-frame.

import { describe, it, expect } from "vitest";
import { computeCenteredXForWidth } from "./TitleEditor";

const FRAME = 1080;

// Helper: the box center in px, given x (left edge) and width%.
const centerOf = (x: number, widthPct: number) =>
  x + ((widthPct / 100) * FRAME) / 2;

describe("computeCenteredXForWidth", () => {
  it("keeps the box center fixed when widening (no clamp needed)", () => {
    // Default-ish box: 80% wide (864px) sitting at x=108 → center = 108 + 432 = 540.
    const oldX = 108;
    const oldWidth = 80;
    const newWidth = 60; // shrink
    const newX = computeCenteredXForWidth(oldX, oldWidth, newWidth);
    // Center must be unchanged.
    expect(centerOf(newX, newWidth)).toBeCloseTo(centerOf(oldX, oldWidth), 5);
  });

  it("keeps the box center fixed when growing (no clamp needed)", () => {
    const oldX = 270; // 50% box (540px) centered at 270 + 270 = 540
    const oldWidth = 50;
    const newWidth = 70;
    const newX = computeCenteredXForWidth(oldX, oldWidth, newWidth);
    expect(centerOf(newX, newWidth)).toBeCloseTo(centerOf(oldX, oldWidth), 5);
  });

  it("applies the half-delta formula directly", () => {
    // Δpct = +20 → Δpx = 0.2*1080 = 216 → x moves left by 108.
    const newX = computeCenteredXForWidth(200, 60, 80);
    expect(newX).toBeCloseTo(200 - 108, 5); // 92
  });

  it("never returns a negative left edge (clamps at 0)", () => {
    // A wide box near the left edge would push x negative without the clamp.
    const newX = computeCenteredXForWidth(20, 40, 100);
    expect(newX).toBeGreaterThanOrEqual(0);
    // width 100% fills the frame → only x=0 fits.
    expect(newX).toBe(0);
  });

  it("never overflows the right edge (clamps at frame - widthPx)", () => {
    // Shrinking a box that started far right should not let x exceed maxX.
    const widthPct = 30; // 324px → maxX = 1080 - 324 = 756
    const newX = computeCenteredXForWidth(900, 90, widthPct);
    expect(newX).toBeLessThanOrEqual(1080 - (widthPct / 100) * FRAME);
  });

  it("is a no-op when width does not change", () => {
    expect(computeCenteredXForWidth(300, 70, 70)).toBeCloseTo(300, 5);
  });
});
