// ─── JumpCutTransition: Visual effects at silence cut boundaries (VISU-04) ───
//
// Renders brief zoom or crop-shift effects at each transition boundary, making
// jump cuts feel intentional rather than raw splices. Two types supported:
//
//   1. zoom (D-06): brief scale-up burst at the cut point, ease-in/ease-out
//   2. crop-shift (D-06): horizontal shift that creates a framing change
//
// Per D-05: transitions start `TRANSITION_PRE_CUT_MS` (150ms) before the cut
// point and end `TRANSITION_POST_CUT_MS` (100ms) after, totaling 250ms by
// default (D-07).
//
// The `computeTransitionEffect` function is exported as a pure function for
// unit testing independently from the React component.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import type { SilenceCutList } from "../captions.js";
import type { TransitionConfig } from "../pipeline-config.js";
import {
  DEFAULT_TRANSITION_CONFIG,
} from "../pipeline-config.js";
import {
  TRANSITION_PRE_CUT_MS,
  ZOOM_TRANSITION_SCALE,
  CROP_SHIFT_PX,
} from "./shared-styles.js";

// ─── TransitionEvent interface ──────────────────────────────────────────────

/** Describes a single transition effect at a silence cut boundary */
export interface TransitionEvent {
  /** When the transition starts (ms, on the remapped timeline) */
  startTimeMs: number;
  /** Total transition duration in ms (default 250 per D-07) */
  durationMs: number;
  /** Transition type: zoom or crop-shift (D-06) */
  type: "zoom" | "crop-shift";
  /** For zoom type: peak scale at cut point (default 1.08 per D-06) */
  maxScale?: number;
  /** For crop-shift type: shift amount in px (default 20 per D-06) */
  shiftPx?: number;
}

// ─── JumpCutTransition props ────────────────────────────────────────────────

interface JumpCutTransitionProps {
  /** Array of transition events computed from silence cuts */
  transitionEvents: TransitionEvent[];
  /** Total video duration in milliseconds */
  totalDurationMs: number;
}

// ─── Pure transition effect computation (exported for testing) ──────────────

/**
 * Compute the transition effect (scale and translateX) at a given time.
 *
 * The transition follows this timeline:
 *   t=startTimeMs                        → identity (scale=1.0, shift=0)
 *   t=startTimeMs + preCutMs (cut point)  → peak effect
 *   t=startTimeMs + durationMs             → identity (scale=1.0, shift=0)
 *
 * The effect ramps up before the cut point and ramps down after it,
 * creating a smooth visual "breathing" that masks the hard splice.
 *
 * @param currentTimeMs Current time in milliseconds
 * @param event The transition event to compute effect for
 * @returns An object with `scale` and `translateX` values
 */
export function computeTransitionEffect(
  currentTimeMs: number,
  event: TransitionEvent
): { scale: number; translateX: number } {
  const { startTimeMs, durationMs, type } = event;
  const preCutMs = TRANSITION_PRE_CUT_MS;
  const peakTimeMs = startTimeMs + preCutMs;

  const maxScale = event.maxScale ?? ZOOM_TRANSITION_SCALE;
  const shiftPx = event.shiftPx ?? CROP_SHIFT_PX;

  // If current time is outside the transition window, no effect
  if (currentTimeMs < startTimeMs || currentTimeMs >= startTimeMs + durationMs) {
    return { scale: 1.0, translateX: 0 };
  }

  if (type === "zoom") {
    // Zoom transition: ramp up before cut point, ramp down after
    // Phase 1: ramp-in from startTimeMs to peakTimeMs (scale 1.0 → maxScale)
    // Phase 2: ramp-out from peakTimeMs to startTimeMs + durationMs (maxScale → 1.0)
    let scale: number;

    if (currentTimeMs <= peakTimeMs) {
      // Ramp-in phase
      scale = interpolate(currentTimeMs, [startTimeMs, peakTimeMs], [1.0, maxScale], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.42, 0, 0.58, 1), // ease-in-out
      });
    } else {
      // Ramp-out phase
      scale = interpolate(currentTimeMs, [peakTimeMs, startTimeMs + durationMs], [maxScale, 1.0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.42, 0, 0.58, 1), // ease-in-out
      });
    }

    return { scale, translateX: 0 };
  }

  if (type === "crop-shift") {
    // Crop-shift transition: horizontal shift following same timeline
    // Shift goes from 0 to shiftPx at cut point, then back to 0
    let translateX: number;

    if (currentTimeMs <= peakTimeMs) {
      // Shift-in phase
      translateX = interpolate(currentTimeMs, [startTimeMs, peakTimeMs], [0, shiftPx], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.42, 0, 0.58, 1),
      });
    } else {
      // Shift-out phase
      translateX = interpolate(currentTimeMs, [peakTimeMs, startTimeMs + durationMs], [shiftPx, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.42, 0, 0.58, 1),
      });
    }

    return { scale: 1.0, translateX };
  }

  // Unknown type: no effect
  return { scale: 1.0, translateX: 0 };
}

// ─── JumpCutTransition React component ──────────────────────────────────────

/**
 * JumpCutTransition component renders a transparent overlay that applies
 * brief visual effects at silence cut boundaries.
 *
 * For each transition event, it computes scale (zoom) or translateX (crop-shift)
 * at the current frame and applies the transform via CSS.
 *
 * Multiple overlapping transitions: the most recent active transition wins.
 */
export const JumpCutTransition: React.FC<JumpCutTransitionProps> = ({
  transitionEvents,
  totalDurationMs,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = frame * (1000 / fps);

  // Find the active transition at the current time (most recent if overlapping)
  let activeEffect: { scale: number; translateX: number } = { scale: 1.0, translateX: 0 };

  for (let i = transitionEvents.length - 1; i >= 0; i--) {
    const event = transitionEvents[i];
    if (currentTimeMs >= event.startTimeMs && currentTimeMs < event.startTimeMs + event.durationMs) {
      activeEffect = computeTransitionEffect(currentTimeMs, event);
      break; // Use the most recent active transition (defensive for overlaps)
    }
  }

  // Only apply transform if there's an active effect
  const hasActiveTransition = activeEffect.scale !== 1.0 || activeEffect.translateX !== 0;

  if (!hasActiveTransition) {
    return <AbsoluteFill style={{ pointerEvents: "none" }} />;
  }

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        transform: `${activeEffect.scale !== 1.0 ? `scale(${activeEffect.scale})` : ""} ${activeEffect.translateX !== 0 ? `translateX(${activeEffect.translateX}px)` : ""}`.trim(),
        transformOrigin: "center center",
      }}
    />
  );
};

// ─── buildTransitionEvents factory ──────────────────────────────────────────

/**
 * Convert a SilenceCutList and TransitionConfig into TransitionEvent[] for
 * the JumpCutTransition component.
 *
 * Per D-05: Each transition starts `TRANSITION_PRE_CUT_MS` before the cut
 * boundary and covers `durationMs` total.
 * Per D-07: Default duration is 250ms.
 * Per D-12: Returns empty array when transitions are disabled or no cuts exist.
 *
 * @param silenceCuts Silence cut list from silence-cutter (null = no data)
 * @param config Optional transition configuration with overrides
 * @returns Array of TransitionEvent sorted by startTimeMs
 */
export function buildTransitionEvents(
  silenceCuts: SilenceCutList | null,
  config?: TransitionConfig
): TransitionEvent[] {
  const cfg: Required<TransitionConfig> = {
    enabled: config?.enabled ?? DEFAULT_TRANSITION_CONFIG.enabled,
    type: config?.type ?? DEFAULT_TRANSITION_CONFIG.type,
    durationMs: config?.durationMs ?? DEFAULT_TRANSITION_CONFIG.durationMs,
    maxScale: config?.maxScale ?? DEFAULT_TRANSITION_CONFIG.maxScale,
    shiftPx: config?.shiftPx ?? DEFAULT_TRANSITION_CONFIG.shiftPx,
  };

  // D-12: When transitions disabled, return empty
  if (!cfg.enabled) {
    return [];
  }

  // If type is "none", no transitions
  if (cfg.type === "none") {
    return [];
  }

  // No silence cuts data available
  if (!silenceCuts || !silenceCuts.cuts || silenceCuts.cuts.length === 0) {
    return [];
  }

  const events: TransitionEvent[] = [];

  for (const cut of silenceCuts.cuts) {
    // The cut boundary in the remapped timeline is cut.new_end
    const cutPointMs = Math.round(cut.new_end * 1000);
    // Transition starts TRANSITION_PRE_CUT_MS before the cut point
    const startTimeMs = cutPointMs - TRANSITION_PRE_CUT_MS;

    // Filter out transitions that would start before the video (cut at very start)
    if (startTimeMs < 0) {
      continue;
    }

    events.push({
      startTimeMs,
      durationMs: cfg.durationMs,
      type: cfg.type as "zoom" | "crop-shift",
      maxScale: cfg.type === "zoom" ? cfg.maxScale : undefined,
      shiftPx: cfg.type === "crop-shift" ? cfg.shiftPx : undefined,
    });
  }

  return events;
}