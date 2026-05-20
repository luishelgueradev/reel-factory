import { describe, it, expect } from "vitest";
import { computeZoomScale } from "./ZoomContainer";
import type { ZoomEvent } from "../zoom-detection";
import { ZOOM_RAMP_MS, DEFAULT_ZOOM_SCALE } from "./shared-styles";

// ─── computeZoomScale tests ────────────────────────────────────────────────

describe("computeZoomScale", () => {
  // ─── No events ────────────────────────────────────────────────────────

  describe("empty events", () => {
    it("returns 1.0 when events array is empty", () => {
      expect(computeZoomScale(500, [])).toBe(1.0);
    });

    it("returns 1.0 at time 0 with empty events", () => {
      expect(computeZoomScale(0, [])).toBe(1.0);
    });
  });

  // ─── Ramp-in phase ────────────────────────────────────────────────────

  describe("ramp-in (ease-in from 1.0 to peak)", () => {
    const event: ZoomEvent = {
      startTimeMs: 1000,
      durationMs: 1000,
      scale: 1.15,
    };

    it("starts at scale 1.0 at the beginning of the event (startTimeMs)", () => {
      const scale = computeZoomScale(1000, [event]);
      expect(scale).toBeCloseTo(1.0, 6);
    });

    it("scales at midpoint of ramp-in is approximately midway", () => {
      // At midpoint of ramp (1250ms), ease-in-out should be ~0.5 progress
      const scale = computeZoomScale(1250, [event]);
      // With ease-in-out bezier, at 50% input, output should be closer to 1.0
      // than to 1.15 due to the easing curve's symmetry
      expect(scale).toBeGreaterThan(1.0);
      expect(scale).toBeLessThan(1.15);
    });

    it("reaches peak scale at end of ramp-in", () => {
      // rampInEnd = 1000 + 300 = 1300ms
      const scale = computeZoomScale(1300, [event]);
      expect(scale).toBeCloseTo(1.15, 6);
    });
  });

  // ─── Hold phase ────────────────────────────────────────────────────────

  describe("hold phase", () => {
    const event: ZoomEvent = {
      startTimeMs: 1000,
      durationMs: 1000,
      scale: 1.15,
    };

    it("holds peak scale during the hold phase (after ramp-in, before ramp-out)", () => {
      // Hold: [1300..1700], mid = 1500ms
      const scale = computeZoomScale(1500, [event]);
      expect(scale).toBeCloseTo(1.15, 6);
    });

    it("holds peak scale at the start of the hold phase", () => {
      const scale = computeZoomScale(1300, [event]);
      expect(scale).toBeCloseTo(1.15, 6);
    });

    it("holds peak scale at the end of the hold phase", () => {
      const scale = computeZoomScale(1700, [event]);
      expect(scale).toBeCloseTo(1.15, 6);
    });
  });

  // ─── Ramp-out phase ───────────────────────────────────────────────────

  describe("ramp-out (ease-out from peak to 1.0)", () => {
    const event: ZoomEvent = {
      startTimeMs: 1000,
      durationMs: 1000,
      scale: 1.15,
    };

    it("ramps from peak to 1.0 during ramp-out", () => {
      // rampOut: [1700..2000], midpoint at 1850ms
      const scale = computeZoomScale(1850, [event]);
      expect(scale).toBeGreaterThan(1.0);
      expect(scale).toBeLessThan(1.15);
    });

    it("returns to 1.0 at the end of the event (startTimeMs + durationMs)", () => {
      const scale = computeZoomScale(2000, [event]);
      expect(scale).toBeCloseTo(1.0, 6);
    });

    it("returns past the event to 1.0", () => {
      const scale = computeZoomScale(2100, [event]);
      expect(scale).toBeCloseTo(1.0, 6);
    });
  });

  // ─── Short events (< 2*rampMs) ────────────────────────────────────────

  describe("very short events (smooth bump)", () => {
    // Event shorter than 2*rampMs (300*2=600ms)
    const shortEvent: ZoomEvent = {
      startTimeMs: 5000,
      durationMs: 200, // much less than 2*300
      scale: 1.2,
    };

    it("still reaches peak scale at midpoint for very short event", () => {
      // midpoint = 5000 + 100 = 5100ms
      // effectiveRampMs = min(300, 200/2) = 100
      // rampInEnd = 5000 + 100 = 5100
      // holdEnd = 5100 + 0 = 5100 (hold clamped to 0)
      // At 5100: we're at both end of ramp-in AND start of ramp-out
      // Since hold is 0, the peak is reached at the boundary
      const scale = computeZoomScale(5100, [shortEvent]);
      expect(scale).toBeCloseTo(1.2, 4);
    });

    it("starts at 1.0 for short event", () => {
      const scale = computeZoomScale(5000, [shortEvent]);
      expect(scale).toBeCloseTo(1.0, 6);
    });

    it("ends at 1.0 for short event", () => {
      const scale = computeZoomScale(5200, [shortEvent]);
      expect(scale).toBeCloseTo(1.0, 6);
    });

    it("produces a smooth bump - never exceeds peak", () => {
      // Check many points within the short event
      for (let t = 5000; t <= 5200; t += 10) {
        const scale = computeZoomScale(t, [shortEvent]);
        expect(scale).toBeGreaterThanOrEqual(1.0);
        expect(scale).toBeLessThanOrEqual(1.2);
      }
    });
  });

  // ─── Overlapping events ────────────────────────────────────────────────

  describe("overlapping events", () => {
    it("takes the higher scale when events overlap", () => {
      const event1: ZoomEvent = {
        startTimeMs: 1000,
        durationMs: 800,
        scale: 1.1,
      };
      const event2: ZoomEvent = {
        startTimeMs: 1200,
        durationMs: 600,
        scale: 1.2,
      };

      // At 1400ms:
      // event1: start=1000, duration=800, end=1800. rampIn=1000+300=1300.
      //   At 1400ms: in hold phase → scale = 1.1
      // event2: start=1200, duration=600, end=1800. rampIn=1200+300=1500.
      //   At 1400ms: in ramp-in, 66.7% through easing → scale ~ 1.15 (ease-in-out)
      // Both events active, event2 wins with higher scale
      const scale = computeZoomScale(1400, [event1, event2]);
      expect(scale).toBeGreaterThan(1.1);
      expect(scale).toBeLessThan(1.2);
    });

    it("takes the higher scale at overlap peak", () => {
      const event1: ZoomEvent = {
        startTimeMs: 1000,
        durationMs: 1000,
        scale: 1.1,
      };
      const event2: ZoomEvent = {
        startTimeMs: 1200,
        durationMs: 800,
        scale: 1.2,
      };

      // At 1600ms: both events in hold phase
      // event1 hold: 1300-1700 → 1.1
      // event2 hold: 1500-1700 → 1.2
      const scale = computeZoomScale(1600, [event1, event2]);
      expect(scale).toBeCloseTo(1.2, 4);
    });

    it("returns 1.0 before any event starts", () => {
      const event: ZoomEvent = {
        startTimeMs: 5000,
        durationMs: 500,
        scale: 1.15,
      };
      const scale = computeZoomScale(4000, [event]);
      expect(scale).toBeCloseTo(1.0, 6);
    });
  });

  // ─── Custom rampMs ────────────────────────────────────────────────────

  describe("custom rampMs", () => {
    const event: ZoomEvent = {
      startTimeMs: 2000,
      durationMs: 3000,
      scale: 1.3,
    };

    it("uses provided rampMs for timing", () => {
      // With rampMs=500:
      // rampInEnd = 2000 + 500 = 2500
      // holdEnd = 2500 + (3000 - 1000) = 4500
      // eventEnd = 5000
      // At 2500ms: should be at peak (1.3)
      const scale = computeZoomScale(2500, [event], 500);
      expect(scale).toBeCloseTo(1.3, 6);
    });

    it("uses default ZOOM_RAMP_MS when not provided", () => {
      // With default rampMs=300:
      // rampInEnd = 2000 + 300 = 2300
      // At 2300ms: should be at peak (1.3)
      const scale = computeZoomScale(2300, [event]);
      expect(scale).toBeCloseTo(1.3, 6);
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns 1.0 at time 0 with no active events", () => {
      const event: ZoomEvent = {
        startTimeMs: 1000,
        durationMs: 500,
        scale: 1.15,
      };
      expect(computeZoomScale(0, [event])).toBeCloseTo(1.0, 6);
    });

    it("handles event starting at time 0", () => {
      const event: ZoomEvent = {
        startTimeMs: 0,
        durationMs: 600,
        scale: 1.15,
      };
      // At t=0: ramp-in start, should be 1.0
      expect(computeZoomScale(0, [event])).toBeCloseTo(1.0, 6);
      // At midpoint of ramp-in (300ms): should be approaching peak
      const scale = computeZoomScale(300, [event]);
      expect(scale).toBeGreaterThan(1.0);
      expect(scale).toBeLessThanOrEqual(1.15);
    });

    it("handles scale of exactly 1.0 (no visual effect)", () => {
      const event: ZoomEvent = {
        startTimeMs: 1000,
        durationMs: 1000,
        scale: 1.0,
      };
      // Peak scale is 1.0, so scale should be 1.0 everywhere
      const scaleAtPeak = computeZoomScale(1500, [event]);
      expect(scaleAtPeak).toBeCloseTo(1.0, 6);
    });

    it("handles large scale values", () => {
      const event: ZoomEvent = {
        startTimeMs: 1000,
        durationMs: 1000,
        scale: 3.0,
      };
      const scale = computeZoomScale(1500, [event]);
      expect(scale).toBeCloseTo(3.0, 4);
    });

    it("correctly transitions through all phases for a standard event", () => {
      const event: ZoomEvent = {
        startTimeMs: 5000,
        durationMs: 1000,
        scale: 1.15,
      };
      // Before event: scale = 1.0
      expect(computeZoomScale(4999, [event])).toBeCloseTo(1.0, 6);

      // Start of ramp-in: scale = 1.0
      expect(computeZoomScale(5000, [event])).toBeCloseTo(1.0, 6);

      // End of ramp-in (5300ms): scale = 1.15
      expect(computeZoomScale(5300, [event])).toBeCloseTo(1.15, 6);

      // Middle of hold (5500ms): scale = 1.15
      expect(computeZoomScale(5500, [event])).toBeCloseTo(1.15, 6);

      // Start of ramp-out (5700ms): scale = 1.15
      expect(computeZoomScale(5700, [event])).toBeCloseTo(1.15, 6);

      // End of event (6000ms): scale = 1.0
      expect(computeZoomScale(6000, [event])).toBeCloseTo(1.0, 6);

      // After event: scale = 1.0
      expect(computeZoomScale(6001, [event])).toBeCloseTo(1.0, 6);
    });
  });

  // ─── Interpolation smoothness ─────────────────────────────────────────

  describe("smoothness", () => {
    it("scale never jumps discontinuously within an event", () => {
      const event: ZoomEvent = {
        startTimeMs: 2000,
        durationMs: 2000,
        scale: 1.2,
      };

      // Check that adjacent 1ms steps never jump by more than a reasonable threshold
      let prevScale = computeZoomScale(2000, [event]);
      for (let t = 2001; t <= 4000; t += 1) {
        const scale = computeZoomScale(t, [event]);
        const delta = Math.abs(scale - prevScale);
        // Smooth ease-in-out should never produce a delta > 0.01 per ms
        // (this is a generous threshold; actual should be much smaller)
        expect(delta).toBeLessThan(0.01);
        prevScale = scale;
      }
    });

    it("scale monotonically increases during ramp-in from 1.0", () => {
      const event: ZoomEvent = {
        startTimeMs: 3000,
        durationMs: 1000,
        scale: 1.2,
      };

      // Ramp-in: 3000-3300ms
      let prevScale = computeZoomScale(3000, [event]);
      for (let t = 3001; t <= 3300; t += 10) {
        const scale = computeZoomScale(t, [event]);
        expect(scale).toBeGreaterThanOrEqual(prevScale);
        prevScale = scale;
      }
    });

    it("scale monotonically decreases during ramp-out to 1.0", () => {
      const event: ZoomEvent = {
        startTimeMs: 3000,
        durationMs: 1000,
        scale: 1.2,
      };

      // Ramp-out: 3700-4000ms (with ramp of 300ms)
      let prevScale = computeZoomScale(3700, [event]);
      for (let t = 3701; t <= 4000; t += 10) {
        const scale = computeZoomScale(t, [event]);
        expect(scale).toBeLessThanOrEqual(prevScale);
        prevScale = scale;
      }
    });
  });
});