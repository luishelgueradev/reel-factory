// ─── ZoomContainer: Per-frame zoom scale animation from ZoomEvent[] data (VISU-03, D-08) ───
//
// Wraps children (typically OffthreadVideo) with a dynamic scale transform
// that emphasizes moments detected by detectZoomEvents(). The zoom follows
// an ease-in-out ramp: scale rises from 1.0 over ZOOM_RAMP_MS, holds, then
// eases back to 1.0.
//
// Pure function `computeZoomScale` is exported for unit testing independently
// from the React component.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import type { ZoomEvent } from "../zoom-detection.js";
import { ZOOM_RAMP_MS } from "./shared-styles.js";

// ─── ZoomContainer props ──────────────────────────────────────────────────

interface ZoomContainerProps {
  /** Content to wrap (typically OffthreadVideo) */
  children: React.ReactNode;
  /** Zoom events from detectZoomEvents() */
  zoomEvents: ZoomEvent[];
  /** Total video duration in ms */
  totalDurationMs: number;
}

// ─── Pure zoom scale computation (exported for testing) ──────────────────

/**
 * Compute the zoom scale factor at a given time.
 *
 * Per D-03, each ZoomEvent follows a three-phase timeline:
 *
 *   1. Ramp-in:  [startTimeMs .. startTimeMs + rampMs]
 *      Scale transitions from 1.0 to event.scale using ease-in-out.
 *
 *   2. Hold:     [startTimeMs + rampMs .. startTimeMs + durationMs - rampMs]
 *      Scale stays at event.scale.
 *
 *   3. Ramp-out: [startTimeMs + durationMs - rampMs .. startTimeMs + durationMs]
 *      Scale transitions from event.scale back to 1.0 using ease-in-out.
 *
 * If the hold phase would be negative (very short events < 2*rampMs),
 * the scale still reaches its peak and returns smoothly — the hold is
 * clamped to 0ms, making the entire event a smooth bump.
 *
 * Overlapping events: the maximum scale at each frame wins (defensive;
 * merging in 07-01 should prevent overlaps, but we handle it).
 *
 * @param currentTimeMs Current time in milliseconds
 * @param events Sorted array of ZoomEvent (by startTimeMs ascending)
 * @param rampMs Duration of each ramp (ease-in / ease-out) in ms
 * @returns Scale factor at currentTimeMs (1.0 = no zoom)
 */
export function computeZoomScale(
  currentTimeMs: number,
  events: ZoomEvent[],
  rampMs: number = ZOOM_RAMP_MS
): number {
  // Empty events: no zoom
  if (events.length === 0) {
    return 1.0;
  }

  let maxScale = 1.0;

  for (const event of events) {
    const { startTimeMs, durationMs, scale: peakScale } = event;

    // Time bounds of this event
    const eventStart = startTimeMs;
    const eventEnd = startTimeMs + durationMs;

    // Skip events that haven't started or have already ended
    if (currentTimeMs < eventStart || currentTimeMs >= eventEnd) {
      continue;
    }

    // Determine ramp and hold durations
    // If duration < 2*rampMs, the whole event becomes a smooth bump
    // with clamp(hold, 0) — peak still reached at midpoint
    const effectiveRampMs = Math.min(rampMs, durationMs / 2);
    const holdMs = Math.max(0, durationMs - 2 * effectiveRampMs);

    // Phase boundaries
    const rampInEnd = eventStart + effectiveRampMs;
    const holdEnd = rampInEnd + holdMs;
    // rampOutEnd = holdEnd + effectiveRampMs === eventEnd

    let scaleAtTime: number;

    if (currentTimeMs <= rampInEnd) {
      // Phase 1: Ramp-in (ease-in-out from 1.0 to peakScale)
      scaleAtTime = interpolate(currentTimeMs, [eventStart, rampInEnd], [1.0, peakScale], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.42, 0, 0.58, 1),
      });
    } else if (currentTimeMs <= holdEnd) {
      // Phase 2: Hold at peakScale
      scaleAtTime = peakScale;
    } else {
      // Phase 3: Ramp-out (ease-in-out from peakScale to 1.0)
      scaleAtTime = interpolate(currentTimeMs, [holdEnd, eventEnd], [peakScale, 1.0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.42, 0, 0.58, 1),
      });
    }

    // Take the maximum scale across all active events
    if (scaleAtTime > maxScale) {
      maxScale = scaleAtTime;
    }
  }

  return maxScale;
}

// ─── ZoomContainer React component ────────────────────────────────────────

/**
 * ZoomContainer wraps children (typically OffthreadVideo) and applies a
 * per-frame scale transform based on ZoomEvent[] data.
 *
 * The zoom uses Remotion's interpolate() with ease-in-out bezier curves
 * for smooth ramp-in and ramp-out (D-03).
 *
 * When zoomEvents is empty (no emphasis or zooms disabled), children
 * are rendered with scale(1.0) — no visual change.
 */
export const ZoomContainer: React.FC<ZoomContainerProps> = ({
  children,
  zoomEvents,
  totalDurationMs,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = frame * (1000 / fps);

  const scale = computeZoomScale(currentTimeMs, zoomEvents, ZOOM_RAMP_MS);

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};