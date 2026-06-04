/**
 * z-layers.test.ts — Guards the modal-stack-choreography z-index ladder.
 *
 * These tests enforce the ordering invariants so the ladder cannot be silently
 * reordered: toast must always be on top, palette above takeover, takeover
 * above sheet, sheet above base.
 *
 * Sketch reference: 041 modal-stack-choreography
 */
import { describe, it, expect } from "vitest";
import { Z } from "./z-layers.js";

describe("Z ladder — ordering invariants (041 modal-stack-choreography)", () => {
  it("base is 0 (in-flow content has no stacking context)", () => {
    expect(Z.base).toBe(0);
  });

  it("sheet > base (popovers sit above in-flow content)", () => {
    expect(Z.sheet).toBeGreaterThan(Z.base);
  });

  it("takeover > sheet (full-stage overlays sit above popovers)", () => {
    expect(Z.takeover).toBeGreaterThan(Z.sheet);
  });

  it("palette > takeover (command palette sits above full-stage overlays)", () => {
    expect(Z.palette).toBeGreaterThan(Z.takeover);
  });

  it("toast > palette (notification toasts are always on top)", () => {
    expect(Z.toast).toBeGreaterThan(Z.palette);
  });

  it("strict ordering: base < sheet < takeover < palette < toast", () => {
    const ladder = [Z.base, Z.sheet, Z.takeover, Z.palette, Z.toast];
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
    }
  });

  it("exported values match the documented ladder (41 ms-choreography spec)", () => {
    expect(Z.base).toBe(0);
    expect(Z.sheet).toBe(20);
    expect(Z.takeover).toBe(30);
    expect(Z.palette).toBe(40);
    expect(Z.toast).toBe(60);
  });
});
