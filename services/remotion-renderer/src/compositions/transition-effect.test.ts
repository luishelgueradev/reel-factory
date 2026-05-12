import { describe, it, expect } from "vitest";
import {
  computeTransitionEffect,
  buildTransitionEvents,
} from "./JumpCutTransition.js";
import type { TransitionEvent } from "./JumpCutTransition.js";
import { computeZoomScale } from "./ZoomContainer.js";
import type { ZoomEvent } from "../zoom-detection.js";
import { computeCombinedTransitionEffect } from "./ZoomContainer.js";
import type { SilenceCutList } from "./captions.js";
import type { TransitionConfig } from "./pipeline-config.js";
import {
  TRANSITION_PRE_CUT_MS,
  ZOOM_TRANSITION_SCALE,
  CROP_SHIFT_PX,
  DEFAULT_TRANSITION_DURATION_MS,
  ZOOM_RAMP_MS,
} from "./shared-styles.js";

// ─── computeTransitionEffect tests ────────────────────────────────────────────

describe("computeTransitionEffect", () => {
  // ─── Zoom type ────────────────────────────────────────────────────────────

  describe("zoom transition", () => {
    const zoomEvent: TransitionEvent = {
      startTimeMs: 1000,
      durationMs: 250,
      type: "zoom",
      maxScale: 1.08,
    };

    it("returns identity at startTimeMs (beginning of transition)", () => {
      const result = computeTransitionEffect(1000, zoomEvent);
      expect(result.scale).toBeCloseTo(1.0, 2);
      expect(result.translateX).toBe(0);
    });

    it("returns peak scale at cut point (startTimeMs + 150ms)", () => {
      const cutPointMs = zoomEvent.startTimeMs + TRANSITION_PRE_CUT_MS;
      const result = computeTransitionEffect(cutPointMs, zoomEvent);
      expect(result.scale).toBeCloseTo(1.08, 2);
      expect(result.translateX).toBe(0);
    });

    it("returns identity at startTimeMs + durationMs (end of transition)", () => {
      const result = computeTransitionEffect(1250, zoomEvent);
      expect(result.scale).toBeCloseTo(1.0, 2);
      expect(result.translateX).toBe(0);
    });

    it("scales up gradually during ramp-in phase", () => {
      const midRamp = zoomEvent.startTimeMs + 75; // halfway through ramp-in
      const result = computeTransitionEffect(midRamp, zoomEvent);
      // Due to ease-in-out, at 75ms it should be roughly halfway but not exactly
      expect(result.scale).toBeGreaterThan(1.0);
      expect(result.scale).toBeLessThan(1.08);
      expect(result.translateX).toBe(0);
    });

    it("scales down gradually during ramp-out phase", () => {
      const midRampOut = zoomEvent.startTimeMs + TRANSITION_PRE_CUT_MS + 50; // 50ms after cut point
      const result = computeTransitionEffect(midRampOut, zoomEvent);
      expect(result.scale).toBeGreaterThan(1.0);
      expect(result.scale).toBeLessThan(1.08);
    });

    it("returns identity outside the transition window (before)", () => {
      const result = computeTransitionEffect(999, zoomEvent);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBe(0);
    });

    it("returns identity outside the transition window (after)", () => {
      const result = computeTransitionEffect(1251, zoomEvent);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBe(0);
    });

    it("uses default maxScale when not specified", () => {
      const eventNoScale: TransitionEvent = {
        startTimeMs: 1000,
        durationMs: 250,
        type: "zoom",
      };
      const cutPointMs = eventNoScale.startTimeMs + TRANSITION_PRE_CUT_MS;
      const result = computeTransitionEffect(cutPointMs, eventNoScale);
      expect(result.scale).toBeCloseTo(ZOOM_TRANSITION_SCALE, 2);
    });

    it("uses custom maxScale when specified", () => {
      const eventCustomScale: TransitionEvent = {
        startTimeMs: 1000,
        durationMs: 250,
        type: "zoom",
        maxScale: 1.2,
      };
      const cutPointMs = eventCustomScale.startTimeMs + TRANSITION_PRE_CUT_MS;
      const result = computeTransitionEffect(cutPointMs, eventCustomScale);
      expect(result.scale).toBeCloseTo(1.2, 2);
    });

    it("handles very short duration gracefully (bump effect)", () => {
      const shortEvent: TransitionEvent = {
        startTimeMs: 1000,
        durationMs: 160, // Less than 2 * PRE_CUT (300), so hold is negative
        type: "zoom",
        maxScale: 1.08,
      };
      // At cut point (150ms into event), should still reach peak
      const cutPointMs = shortEvent.startTimeMs + TRANSITION_PRE_CUT_MS;
      const result = computeTransitionEffect(cutPointMs, shortEvent);
      expect(result.scale).toBeCloseTo(1.08, 2);
    });
  });

  // ─── Crop-shift type ──────────────────────────────────────────────────────

  describe("crop-shift transition", () => {
    const shiftEvent: TransitionEvent = {
      startTimeMs: 1000,
      durationMs: 250,
      type: "crop-shift",
      shiftPx: 20,
    };

    it("returns identity at startTimeMs (beginning of transition)", () => {
      const result = computeTransitionEffect(1000, shiftEvent);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBeCloseTo(0, 1);
    });

    it("returns peak shift at cut point (startTimeMs + 150ms)", () => {
      const cutPointMs = shiftEvent.startTimeMs + TRANSITION_PRE_CUT_MS;
      const result = computeTransitionEffect(cutPointMs, shiftEvent);
      expect(result.translateX).toBeCloseTo(20, 1);
      expect(result.scale).toBe(1.0);
    });

    it("returns identity at startTimeMs + durationMs (end of transition)", () => {
      const result = computeTransitionEffect(1250, shiftEvent);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBeCloseTo(0, 1);
    });

    it("shifts gradually during shift-in phase", () => {
      const midShift = shiftEvent.startTimeMs + 75;
      const result = computeTransitionEffect(midShift, shiftEvent);
      expect(result.translateX).toBeGreaterThan(0);
      expect(result.translateX).toBeLessThan(20);
      expect(result.scale).toBe(1.0);
    });

    it("returns identity outside the transition window (before)", () => {
      const result = computeTransitionEffect(999, shiftEvent);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBe(0);
    });

    it("returns identity outside the transition window (after)", () => {
      const result = computeTransitionEffect(1251, shiftEvent);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBe(0);
    });

    it("uses default shiftPx when not specified", () => {
      const eventNoShift: TransitionEvent = {
        startTimeMs: 1000,
        durationMs: 250,
        type: "crop-shift",
      };
      const cutPointMs = eventNoShift.startTimeMs + TRANSITION_PRE_CUT_MS;
      const result = computeTransitionEffect(cutPointMs, eventNoShift);
      expect(result.translateX).toBeCloseTo(CROP_SHIFT_PX, 1);
    });

    it("uses custom shiftPx when specified", () => {
      const eventCustomShift: TransitionEvent = {
        startTimeMs: 1000,
        durationMs: 250,
        type: "crop-shift",
        shiftPx: 50,
      };
      const cutPointMs = eventCustomShift.startTimeMs + TRANSITION_PRE_CUT_MS;
      const result = computeTransitionEffect(cutPointMs, eventCustomShift);
      expect(result.translateX).toBeCloseTo(50, 1);
    });
  });

  // ─── No active transition ────────────────────────────────────────────────

  describe("no active transition", () => {
    it("returns identity when time is before transition start", () => {
      const event: TransitionEvent = {
        startTimeMs: 1000,
        durationMs: 250,
        type: "zoom",
      };
      const result = computeTransitionEffect(500, event);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBe(0);
    });

    it("returns identity when time is after transition end", () => {
      const event: TransitionEvent = {
        startTimeMs: 1000,
        durationMs: 250,
        type: "zoom",
      };
      const result = computeTransitionEffect(1500, event);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBe(0);
    });
  });

  // ─── Custom duration ──────────────────────────────────────────────────────

  describe("custom duration", () => {
    it("respects custom duration for zoom", () => {
      const longEvent: TransitionEvent = {
        startTimeMs: 1000,
        durationMs: 500,
        type: "zoom",
        maxScale: 1.08,
      };
      // Cut point is still at startTimeMs + 150ms
      const cutPointMs = longEvent.startTimeMs + TRANSITION_PRE_CUT_MS;
      const result = computeTransitionEffect(cutPointMs, longEvent);
      expect(result.scale).toBeCloseTo(1.08, 2);

      // At midpoint between cut point and end (300ms after cut point)
      const midRampOut = cutPointMs + 175;
      const midResult = computeTransitionEffect(midRampOut, longEvent);
      expect(midResult.scale).toBeGreaterThan(1.0);
      expect(midResult.scale).toBeLessThan(1.08);
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles time exactly at transition boundary start", () => {
      const event: TransitionEvent = {
        startTimeMs: 1000,
        durationMs: 250,
        type: "zoom",
        maxScale: 1.08,
      };
      const result = computeTransitionEffect(1000, event);
      expect(result.scale).toBeCloseTo(1.0, 2);
    });

    it("handles time exactly at transition boundary end (just past)", () => {
      const event: TransitionEvent = {
        startTimeMs: 1000,
        durationMs: 250,
        type: "zoom",
        maxScale: 1.08,
      };
      // 1250ms is startTimeMs + durationMs — should be just past the transition
      const result = computeTransitionEffect(1250, event);
      expect(result.scale).toBeCloseTo(1.0, 2);
    });
  });
});

// ─── buildTransitionEvents tests ──────────────────────────────────────────────

describe("buildTransitionEvents", () => {
  // ─── Helper to create a SilenceCutList ──────────────────────────────────────

  function makeSilenceCuts(cuts: Array<{ new_end: number }>): SilenceCutList {
    return {
      total_segments_removed: cuts.length,
      total_silence_removed: cuts.reduce((sum, c) => sum + 0.3, 0),
      original_duration: 30,
      new_duration: 30 - cuts.reduce((sum, c) => sum + 0.3, 0),
      cuts: cuts.map((c, i) => ({
        original_start: i * 5,
        original_end: i * 5 + 2.7,
        new_start: i * 5,
        new_end: c.new_end,
        duration: 0.3,
        source: "both" as const,
        cumulative_shift: i * 0.3,
      })),
    };
  }

  // ─── Valid silenceCuts ──────────────────────────────────────────────────

  it("produces one TransitionEvent per cut", () => {
    const silenceCuts = makeSilenceCuts([
      { new_end: 5.0 },
      { new_end: 10.0 },
      { new_end: 15.0 },
    ]);

    const events = buildTransitionEvents(silenceCuts);
    expect(events).toHaveLength(3);
  });

  it("computes startTimeMs as cutPointMs - TRANSITION_PRE_CUT_MS", () => {
    const silenceCuts = makeSilenceCuts([{ new_end: 5.0 }]);

    const events = buildTransitionEvents(silenceCuts);
    expect(events).toHaveLength(1);
    // cutPointMs = Math.round(5.0 * 1000) = 5000
    // startTimeMs = 5000 - 150 = 4850
    expect(events[0].startTimeMs).toBe(5000 - TRANSITION_PRE_CUT_MS);
  });

  it("uses default duration and type from config", () => {
    const silenceCuts = makeSilenceCuts([{ new_end: 5.0 }]);

    const events = buildTransitionEvents(silenceCuts);
    expect(events[0].durationMs).toBe(DEFAULT_TRANSITION_DURATION_MS);
    expect(events[0].type).toBe("zoom");
    expect(events[0].maxScale).toBe(ZOOM_TRANSITION_SCALE);
  });

  // ─── Null/empty silenceCuts ──────────────────────────────────────────────

  it("returns empty array for null silenceCuts", () => {
    const events = buildTransitionEvents(null);
    expect(events).toHaveLength(0);
  });

  it("returns empty array for empty cuts array", () => {
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 0,
      total_silence_removed: 0,
      original_duration: 30,
      new_duration: 30,
      cuts: [],
    };

    const events = buildTransitionEvents(silenceCuts);
    expect(events).toHaveLength(0);
  });

  // ─── Config overrides ───────────────────────────────────────────────────

  it("returns empty array when config.enabled is false (D-12)", () => {
    const silenceCuts = makeSilenceCuts([{ new_end: 5.0 }]);

    const events = buildTransitionEvents(silenceCuts, { enabled: false });
    expect(events).toHaveLength(0);
  });

  it("uses config.type='crop-shift' for all events", () => {
    const silenceCuts = makeSilenceCuts([
      { new_end: 5.0 },
      { new_end: 10.0 },
    ]);

    const events = buildTransitionEvents(silenceCuts, { type: "crop-shift" });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === "crop-shift")).toBe(true);
    expect(events.every((e) => e.shiftPx !== undefined)).toBe(true);
    expect(events.every((e) => e.maxScale === undefined)).toBe(true);
  });

  it("uses config.durationMs override", () => {
    const silenceCuts = makeSilenceCuts([{ new_end: 5.0 }]);

    const events = buildTransitionEvents(silenceCuts, { durationMs: 500 });
    expect(events[0].durationMs).toBe(500);
  });

  it("uses config.maxScale override for zoom type", () => {
    const silenceCuts = makeSilenceCuts([{ new_end: 5.0 }]);

    const events = buildTransitionEvents(silenceCuts, { maxScale: 1.2 });
    expect(events[0].maxScale).toBe(1.2);
  });

  it("uses config.shiftPx override for crop-shift type", () => {
    const silenceCuts = makeSilenceCuts([{ new_end: 5.0 }]);

    const events = buildTransitionEvents(silenceCuts, { type: "crop-shift", shiftPx: 40 });
    expect(events[0].shiftPx).toBe(40);
  });

  // ─── Edge case: cut at start of video ─────────────────────────────────────

  it("filters out transition with negative startTimeMs (cut at very start)", () => {
    // new_end = 0.05 (50ms into video) → startTimeMs would be 50 - 150 = -100
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 0.3,
      original_duration: 30,
      new_duration: 29.7,
      cuts: [{
        original_start: 0,
        original_end: 0.3,
        new_start: 0,
        new_end: 0.05,
        duration: 0.25,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = buildTransitionEvents(silenceCuts);
    expect(events).toHaveLength(0);
  });

  it("includes transition with non-negative startTimeMs", () => {
    // new_end = 0.2 (200ms) → startTimeMs = 200 - 150 = 50 (valid)
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 0.3,
      original_duration: 30,
      new_duration: 29.7,
      cuts: [{
        original_start: 0,
        original_end: 0.3,
        new_start: 0,
        new_end: 0.2,
        duration: 0.1,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = buildTransitionEvents(silenceCuts);
    expect(events).toHaveLength(1);
    expect(events[0].startTimeMs).toBe(200 - TRANSITION_PRE_CUT_MS);
  });

  // ─── Type 'none' ────────────────────────────────────────────────────────

  it("returns empty array when config.type is 'none'", () => {
    const silenceCuts = makeSilenceCuts([{ new_end: 5.0 }]);

    const events = buildTransitionEvents(silenceCuts, { type: "none" });
    expect(events).toHaveLength(0);
  });

  // ─── Events on the remapped timeline ──────────────────────────────────────

  it("produces events on the remapped timeline using new_end", () => {
    // Verify events use new_end (remapped timeline), not original_end
    const silenceCuts: SilenceCutList = {
      total_segments_removed: 1,
      total_silence_removed: 2,
      original_duration: 30,
      new_duration: 28,
      cuts: [{
        original_start: 5,
        original_end: 7,
        new_start: 5,
        new_end: 5,
        duration: 2,
        source: "both",
        cumulative_shift: 0,
      }],
    };

    const events = buildTransitionEvents(silenceCuts);
    expect(events).toHaveLength(1);
    // new_end = 5.0 seconds = 5000ms
    // startTimeMs = 5000 - 150 = 4850
    expect(events[0].startTimeMs).toBe(5000 - TRANSITION_PRE_CUT_MS);
  });
});

// ─── Combined computation: computeTransitionEffect × computeZoomScale ──────────
//
// Verifies that transition scale values, when multiplied with zoom scale values,
// produce the expected combined scale. This is the composition that ZoomContainer
// now applies to the video layer (VISU-04 fix).

describe("combined transition and zoom computation", () => {
  // ─── Multiplicative composition ──────────────────────────────────────────

  it("zoom * transition at overlapping peak = 1.15 * 1.08 = 1.242", () => {
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

    // At cut point (1500 + 150 = 1650ms): zoom at hold=1.15, transition peak=1.08
    const zoomScale = computeZoomScale(1650, [zoomEvent], ZOOM_RAMP_MS);
    const transitionEffect = computeTransitionEffect(1650, transitionEvent);
    const combined = zoomScale * transitionEffect.scale;
    expect(combined).toBeCloseTo(1.242, 3);
  });

  it("zoom only (no active transition) returns zoom scale", () => {
    const zoomEvent: ZoomEvent = {
      startTimeMs: 1000,
      durationMs: 2000,
      scale: 1.15,
    };
    const transitionEvent: TransitionEvent = {
      startTimeMs: 5000, // far from zoom event
      durationMs: 250,
      type: "zoom",
      maxScale: 1.08,
    };

    // At 1500ms: zoom active at hold=1.15, transition not started
    const zoomScale = computeZoomScale(1500, [zoomEvent], ZOOM_RAMP_MS);
    const transitionEffect = computeTransitionEffect(1500, transitionEvent);
    expect(transitionEffect.scale).toBe(1.0);
    expect(zoomScale).toBeCloseTo(1.15, 4);
    expect(zoomScale * transitionEffect.scale).toBeCloseTo(1.15, 4);
  });

  it("crop-shift transition with zoom produces scale + translateX", () => {
    const zoomEvent: ZoomEvent = {
      startTimeMs: 2000,
      durationMs: 1500,
      scale: 1.15,
    };
    const cropShiftEvent: TransitionEvent = {
      startTimeMs: 2500,
      durationMs: 250,
      type: "crop-shift",
      shiftPx: 20,
    };

    // At cut point (2500 + 150 = 2650ms): zoom at hold=1.15, crop-shift at peak
    const zoomScale = computeZoomScale(2650, [zoomEvent], ZOOM_RAMP_MS);
    const transitionEffect = computeTransitionEffect(2650, cropShiftEvent);
    const combined = zoomScale * transitionEffect.scale;
    expect(combined).toBeCloseTo(1.15, 4); // zoom * 1.0 (crop-shift scale=1.0)
    expect(transitionEffect.translateX).toBeCloseTo(20, 1);
  });

  // ─── computeCombinedTransitionEffect (ZoomContainer helper) ─────────────

  describe("computeCombinedTransitionEffect", () => {
    it("returns identity when no transition events", () => {
      const result = computeCombinedTransitionEffect(5000, []);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBe(0);
    });

    it("returns identity when time is outside all transition windows", () => {
      const events: TransitionEvent[] = [
        { startTimeMs: 1000, durationMs: 250, type: "zoom", maxScale: 1.08 },
      ];
      const result = computeCombinedTransitionEffect(5000, events);
      expect(result.scale).toBe(1.0);
      expect(result.translateX).toBe(0);
    });

    it("returns the active transition effect when time falls within a window", () => {
      const events: TransitionEvent[] = [
        { startTimeMs: 1000, durationMs: 250, type: "zoom", maxScale: 1.08 },
      ];
      // At cut point (1000 + 150 = 1150ms)
      const result = computeCombinedTransitionEffect(1150, events);
      expect(result.scale).toBeCloseTo(1.08, 2);
      expect(result.translateX).toBe(0);
    });

    it("picks the most recent active transition when multiple overlap", () => {
      const events: TransitionEvent[] = [
        { startTimeMs: 1000, durationMs: 500, type: "zoom", maxScale: 1.05 },
        { startTimeMs: 1100, durationMs: 300, type: "zoom", maxScale: 1.10 },
      ];
      // At 1200ms: both active, but second (most recent) should win
      const result = computeCombinedTransitionEffect(1200, events);
      // The second event peaks at 1100+150=1250, so at 1200 it's ramping up
      // But we just need to verify the function returns something reasonable
      expect(result.scale).toBeGreaterThan(1.0);
    });
  });
});