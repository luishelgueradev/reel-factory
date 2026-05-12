// ─── ZoomContainer: Per-frame visual effects on the video layer (VISU-03, VISU-04) ───
//
// Wraps children (typically OffthreadVideo) with a dynamic scale+translateX
// transform that combines:
//   1. Zoom emphasis moments from detectZoomEvents() (VISU-03, D-08)
//   2. Jump-cut transitions at silence boundaries (VISU-04, D-09)
//
// Both effects compose multiplicatively: combinedScale = zoomScale * transitionScale.
// Crop-shift transitions add a translateX alongside the combined scale.
// This ensures transitions are visible — they act on the video-wrapping element
// directly, not on an empty overlay sibling (the previous architecture bug).
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
import type { TransitionEvent } from "./JumpCutTransition.js";
import { computeTransitionEffect } from "./JumpCutTransition.js";
import { ZOOM_RAMP_MS } from "./shared-styles.js";

// ─── ZoomContainer props ──────────────────────────────────────────────────

interface ZoomContainerProps {
  /** Content to wrap (typically OffthreadVideo) */
  children: React.ReactNode;
  /** Zoom events from detectZoomEvents() */
  zoomEvents: ZoomEvent[];
  /** Transition events from buildTransitionEvents() (VISU-04) */
  transitionEvents?: TransitionEvent[];
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

// ─── Combined transition effect helper ────────────────────────────────────

/**
 * Find the active transition at the current time and return its effect.
 * If multiple transitions overlap, the most recent active one wins (defensive).
 * If no transition is active, returns identity (scale=1.0, translateX=0).
 *
 * Exported for use in tests alongside computeZoomScale.
 */
export function computeCombinedTransitionEffect(
  currentTimeMs: number,
  transitionEvents: TransitionEvent[]
): { scale: number; translateX: number } {
  // No events: identity transform
  if (transitionEvents.length === 0) {
    return { scale: 1.0, translateX: 0 };
  }

  // Find the most recent active transition (defensive for overlaps)
  for (let i = transitionEvents.length - 1; i >= 0; i--) {
    const event = transitionEvents[i];
    if (
      currentTimeMs >= event.startTimeMs &&
      currentTimeMs < event.startTimeMs + event.durationMs
    ) {
      return computeTransitionEffect(currentTimeMs, event);
    }
  }

  return { scale: 1.0, translateX: 0 };
}

// ─── ZoomContainer React component ────────────────────────────────────────

/**
 * ZoomContainer wraps children (typically OffthreadVideo) and applies a
 * per-frame combined scale+translateX transform based on ZoomEvent[] and
 * TransitionEvent[] data.
 *
 * The zoom uses Remotion's interpolate() with ease-in-out bezier curves
 * for smooth ramp-in and ramp-out (D-03).
 * The transition effects (zoom burst or crop-shift at cut boundaries) compose
 * multiplicatively with zoom: combinedScale = zoomScale * transitionScale.
 *
 * When both zoomEvents and transitionEvents are empty (no emphasis, zooms
 * disabled, transitions disabled), children render with scale(1.0) and
 * translateX(0) — no visual change.
 */
export const ZoomContainer: React.FC<ZoomContainerProps> = ({
  children,
  zoomEvents,
  transitionEvents = [],
  totalDurationMs,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = frame * (1000 / fps);

  const zoomScale = computeZoomScale(currentTimeMs, zoomEvents, ZOOM_RAMP_MS);
  const transitionEffect = computeCombinedTransitionEffect(currentTimeMs, transitionEvents);

  // Combined scale: zoom * transition (multiplicative composition)
  const combinedScale = zoomScale * transitionEffect.scale;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        transform: `scale(${combinedScale})${transitionEffect.translateX !== 0 ? ` translateX(${transitionEffect.translateX}px)` : ""}`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};