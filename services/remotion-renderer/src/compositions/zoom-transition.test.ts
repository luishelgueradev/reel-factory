import { describe, it, expect } from "vitest";
import { computeZoomScale } from "./ZoomContainer.js";
import { computeTransitionEffect } from "./JumpCutTransition.js";
import type { ZoomEvent } from "../zoom-detection.js";
import type { TransitionEvent } from "./JumpCutTransition.js";
import { ZOOM_RAMP_MS, ZOOM_TRANSITION_SCALE, CROP_SHIFT_PX } from "./shared-styles.js";

// ─── Combined zoom + transition scale computation tests ──────────────────────
//
// These tests verify the multiplicative composition of zoom and transition
// effects. When both are active at the same time, the combined scale is
// zoom * transition (not max, not additive). This is the core logic that
// ZoomContainer now applies to the video layer.

describe("combined zoom + transition scale", () => {
  // ─── Helper to compute combined effect ──────────────────────────────────

  /**
   * Compute the combined visual scale and translateX at a given time.
   * This mirrors the logic ZoomContainer will apply:
   *   combinedScale = zoomScale * transitionEffect.scale
   *   combinedTranslateX = transitionEffect.translateX
   */
  function computeCombinedEffect(
    currentTimeMs: number,
    zoomEvents: ZoomEvent[],
    transitionEvents: TransitionEvent[],
    rampMs: number = ZOOM_RAMP_MS
  ): { scale: number; translateX: number } {
    // Compute zoom scale
    const zoomScale = computeZoomScale(currentTimeMs, zoomEvents, rampMs);

    // Find the active transition effect (most recent active transition wins)
    let transitionEffect = { scale: 1.0, translateX: 0 };
    for (let i = transitionEvents.length - 1; i >= 0; i--) {
      const event = transitionEvents[i];
      if (
        currentTimeMs >= event.startTimeMs &&
        currentTimeMs < event.startTimeMs + event.durationMs
      ) {
        transitionEffect = computeTransitionEffect(currentTimeMs, event);
        break;
      }
    }

    return {
      scale: zoomScale * transitionEffect.scale,
      translateX: transitionEffect.translateX,
    };
  }

  // ─── Baseline: zoom only ────────────────────────────────────────────────

  describe("zoom only (no transition events)", () => {
    const zoomEvent: ZoomEvent = {
      startTimeMs: 2000,
      durationMs: 1000,
      scale: 1.15,
    };

    it("returns zoom scale when only zoom is active", () => {
      const result = computeCombinedEffect(2500, [zoomEvent], []);
      // At 2500ms: zoom is in hold phase, scale = 1.15
      expect(result.scale).toBeCloseTo(1.15, 4);
      expect(result.translateX).toBe(0);
    });

    it("returns 1.0 when neither zoom nor transition is active", () => {
      const result = computeCombinedEffect(500, [zoomEvent], []);
      expect(result.scale).toBeCloseTo(1.0, 6);
      expect(result.translateX).toBe(0);
    });
  });

  // ─── Baseline: transition only ───────────────────────────────────────────

  describe("transition only (no zoom events)", () => {
    const transitionEvent: TransitionEvent = {
      startTimeMs: 1000,
      durationMs: 250,
      type: "zoom",
      maxScale: ZOOM_TRANSITION_SCALE, // 1.08
    };

    it("returns transition scale when only transition is active", () => {
      // At the cut point (1000 + 150 = 1150ms), transition is at peak
      const result = computeCombinedEffect(1150, [], [transitionEvent]);
      expect(result.scale).toBeCloseTo(ZOOM_TRANSITION_SCALE, 2);
      expect(result.translateX).toBe(0);
    });

    it("returns 1.0 outside the transition window", () => {
      const result = computeCombinedEffect(800, [], [transitionEvent]);
      expect(result.scale).toBeCloseTo(1.0, 6);
    });
  });

  // ─── Combined: zoom × transition (multiplicative) ───────────────────────

  describe("zoom and transition both active (multiplicative composition)", () => {
    const zoomEvent: ZoomEvent = {
      startTimeMs: 1000,
      durationMs: 2000, // 1000-3000ms, hold at 1.15
      scale: 1.15,
    };

    const transitionEvent: TransitionEvent = {
      startTimeMs: 1500, // starts at 1500, cut at 1650, ends at 1750
      durationMs: 250,
      type: "zoom",
      maxScale: 1.08,
    };

    it("combined scale = zoom * transition when both active at peak overlap", () => {
      // At 1650ms (cut point): zoom is at 1.15 (hold), transition is at 1.08
      // Combined = 1.15 * 1.08 = 1.242
      const result = computeCombinedEffect(1650, [zoomEvent], [transitionEvent]);
      expect(result.scale).toBeCloseTo(1.15 * 1.08, 3);
      expect(result.translateX).toBe(0);
    });

    it("combined scale = zoom * 1.0 when transition is not active (before transition)", () => {
      // At 1400ms: zoom is active (hold phase, 1.15), transition not started yet
      const result = computeCombinedEffect(1400, [zoomEvent], [transitionEvent]);
      expect(result.scale).toBeCloseTo(1.15, 4);
    });

    it("combined scale = zoom * 1.0 when transition is not active (after transition)", () => {
      // At 2000ms: zoom is active (hold, 1.15), transition ended
      const result = computeCombinedEffect(2000, [zoomEvent], [transitionEvent]);
      expect(result.scale).toBeCloseTo(1.15, 4);
    });

    it("combined scale returns to zoom-only after transition ends", () => {
      // At 1800ms: transition ended at 1750ms, zoom still active at 1.15
      const result = computeCombinedEffect(1800, [zoomEvent], [transitionEvent]);
      expect(result.scale).toBeCloseTo(1.15, 4);
    });

    it("combined scale gradually changes during transition ramp-in", () => {
      // At 1575ms: transition is ramping in, zoom at 1.15
      const result = computeCombinedEffect(1575, [zoomEvent], [transitionEvent]);
      // transition scale between 1.0 and 1.08 (mid-ramp)
      expect(result.scale).toBeGreaterThan(1.15);
      expect(result.scale).toBeLessThan(1.15 * 1.08);
    });
  });

  // ─── Neither active ─────────────────────────────────────────────────────

  describe("neither zoom nor transition active", () => {
    it("returns scale=1.0 and translateX=0 when no events", () => {
      const result = computeCombinedEffect(5000, [], []);
      expect(result.scale).toBeCloseTo(1.0, 6);
      expect(result.translateX).toBe(0);
    });

    it("returns scale=1.0 when empty event arrays", () => {
      const result = computeCombinedEffect(5000, [], []);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBe(0);
    });
  });

  // ─── Crop-shift transition with zoom ─────────────────────────────────────

  describe("crop-shift transition with zoom (scale + translateX)", () => {
    const zoomEvent: ZoomEvent = {
      startTimeMs: 2000,
      durationMs: 1500,
      scale: 1.15,
    };

    const cropShiftEvent: TransitionEvent = {
      startTimeMs: 2500, // starts 2500, cut at 2650, ends 2750
      durationMs: 250,
      type: "crop-shift",
      shiftPx: 20,
    };

    it("crop-shift produces scale * translateX on the video layer", () => {
      // At cut point (2650ms): zoom at 1.15 (hold), crop-shift at peak shift
      const result = computeCombinedEffect(2650, [zoomEvent], [cropShiftEvent]);
      // Crop-shift type has scale=1.0, translateX=20 at peak
      expect(result.scale).toBeCloseTo(1.15, 4); // zoom * 1.0
      expect(result.translateX).toBeCloseTo(20, 1);
    });

    it("crop-shift at midpoint with zoom gives non-zero translateX", () => {
      // At 2575ms: crop-shift is shifting in
      const result = computeCombinedEffect(2575, [zoomEvent], [cropShiftEvent]);
      expect(result.translateX).toBeGreaterThan(0);
      expect(result.translateX).toBeLessThan(20);
      expect(result.scale).toBeCloseTo(1.15, 4); // zoom still at hold
    });
  });

  // ─── Empty transitionEvents (disabled transitions) ─────────────────────

  describe("empty transitionEvents (transitions disabled)", () => {
    const zoomEvent: ZoomEvent = {
      startTimeMs: 1000,
      durationMs: 1000,
      scale: 1.15,
    };

    it("returns pure zoom scale with no translateX when transitionEvents is empty", () => {
      const result = computeCombinedEffect(1500, [zoomEvent], []);
      expect(result.scale).toBeCloseTo(1.15, 4);
      expect(result.translateX).toBe(0);
    });

    it("returns scale=1.0 with no events at all", () => {
      const result = computeCombinedEffect(5000, [], []);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBe(0);
    });
  });

  // ─── Zoom transition type with zoom event ──────────────────────────────

  describe("zoom-type transition event combined with zoom event", () => {
    it("1.15 * 1.08 = 1.242 at peak overlap", () => {
      const zoomEvent: ZoomEvent = {
        startTimeMs: 1000,
        durationMs: 2000,
        scale: 1.15,
      };

      const transitionEvent: TransitionEvent = {
        startTimeMs: 1500,
        durationMs: 250,
        type: "zoom",
        maxScale: 1.08,
      };

      // At cut point (1500 + 150 = 1650ms):
      // zoom at hold = 1.15, transition at peak = 1.08
      const result = computeCombinedEffect(1650, [zoomEvent], [transitionEvent]);
      expect(result.scale).toBeCloseTo(1.242, 3);
      expect(result.translateX).toBe(0);
    });
  });
});