import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { PngOverlayConfig } from "../pipeline-config";

// ─── PngOverlay: Transparent PNG overlay composition ─────────────────────────
// Phase 21 OVERLAY-01 / OVERLAY-02 / OVERLAY-03
//
// Dual src logic (D-11):
//   - Browser/Player context:  rawImageSrc (data URL) is provided → use directly
//   - Render context:          rawImageSrc is undefined → use staticFile(_resolvedFile)
//
// imageRendering: "auto" (D-04) — Chromium bilinear downscale for crisp logos.
// Static opacity only (D-06) — no frame-based animation in v1.
// AbsoluteFill wrapper has no backgroundColor — transparent pass-through (T-21-06).

interface PngOverlayProps {
  overlay: PngOverlayConfig;
  /**
   * rawImageSrc: pass the data URL from overlay.imageData when in browser/Player context.
   * Omit (or pass undefined) in the renderer context — PngOverlay will use
   * staticFile(overlay._resolvedFile) instead.
   */
  rawImageSrc?: string;
}

/**
 * Compute the src to use for the <Img> element.
 *
 * Exported as a pure helper so overlay.test.ts can validate the logic without
 * JSX rendering (avoids needing a full React test renderer in the renderer's
 * vitest suite).
 */
export function computeOverlaySrc(
  rawImageSrc: string | undefined,
  resolvedFile: string | undefined
): string {
  if (rawImageSrc) {
    return rawImageSrc;
  }
  return staticFile(resolvedFile ?? "overlay-0.png");
}

/**
 * Compute the effective opacity, defaulting to 1 when undefined.
 *
 * Exported as a pure helper for testing.
 */
export function computeOverlayOpacity(opacity: number | undefined): number {
  return opacity ?? 1;
}

export const PngOverlay: React.FC<PngOverlayProps> = ({ overlay, rawImageSrc }) => {
  const src = computeOverlaySrc(rawImageSrc, overlay._resolvedFile);
  const opacity = computeOverlayOpacity(overlay.opacity);

  return (
    // AbsoluteFill: no backgroundColor so video shows through (T-21-06)
    <AbsoluteFill>
      <Img
        src={src}
        style={{
          position: "absolute",
          left: `${(overlay.x / 1080) * 100}%`,
          top: `${(overlay.y / 1920) * 100}%`,
          width: overlay.displayWidth,
          height: "auto",
          opacity,
          imageRendering: "auto",
        }}
      />
    </AbsoluteFill>
  );
};
