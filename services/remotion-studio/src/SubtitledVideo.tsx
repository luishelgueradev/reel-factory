// ─── SubtitledVideo: Composable subtitle overlay (D-01, D-04, D-06) ──────────
// Separated from Root.tsx to avoid registerRoot() side effect when imported
// by @remotion/player. Root.tsx still calls registerRoot() for Remotion Studio.

import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, Sequence, delayRender, continueRender, useVideoConfig } from "remotion";
import { SubtitleLayoutRenderer } from "./compositions/LayoutDispatcher";
import { TitleOverlay } from "./compositions/TitleOverlay";
import { PngOverlay } from "./compositions/PngOverlay";
import { ZoomContainer } from "./compositions/ZoomContainer";
import type { TransitionEvent } from "./compositions/JumpCutTransition";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleConfig, TitleConfig, SubtitleLayoutMode, SubtitlePosition, PngOverlayConfig } from "./pipeline-config";
import { DEFAULT_SUBTITLE_CONFIG, partitionGuideOverlays } from "./pipeline-config";
import type { ZoomEvent } from "./zoom-detection";
import { loadFont, getFontFamilyCSS } from "./fonts";

export interface RemotionProps {
  videoSrc: string;
  rawVideoSrc?: string;
  captionPages: TikTokPage[];
  videoWidth?: number;
  videoHeight?: number;
  totalDurationMs?: number;
  subtitleLayout?: SubtitleLayoutMode;
  subtitleConfig?: SubtitleConfig;
  titles?: TitleConfig[];
  zoomEvents?: ZoomEvent[];
  transitionEvents?: TransitionEvent[];
  // Phase 21: PNG overlays (OVERLAY-01)
  overlays?: PngOverlayConfig[];
}

export const SubtitledVideo: React.FC<RemotionProps> = ({
  videoSrc,
  rawVideoSrc,
  captionPages,
  subtitleConfig,
  titles,
  zoomEvents = [],
  transitionEvents = [],
  totalDurationMs,
  overlays = [],
}) => {
  const config: SubtitleConfig = {
    layout: subtitleConfig?.layout ?? "tiktok",
    fontFamily: subtitleConfig?.fontFamily,
    fontSize: subtitleConfig?.fontSize ?? DEFAULT_SUBTITLE_CONFIG.fontSize,
    activeColor: subtitleConfig?.activeColor ?? DEFAULT_SUBTITLE_CONFIG.activeColor,
    inactiveColor: subtitleConfig?.inactiveColor ?? DEFAULT_SUBTITLE_CONFIG.inactiveColor,
    outlineColor: subtitleConfig?.outlineColor ?? DEFAULT_SUBTITLE_CONFIG.outlineColor,
    outlineWidth: subtitleConfig?.outlineWidth ?? DEFAULT_SUBTITLE_CONFIG.outlineWidth,
    backgroundHighlight: subtitleConfig?.backgroundHighlight,
    textShadow: subtitleConfig?.textShadow,
    letterSpacing: subtitleConfig?.letterSpacing,
    position: subtitleConfig?.position ?? DEFAULT_SUBTITLE_CONFIG.position,
    lineHeight: subtitleConfig?.lineHeight ?? DEFAULT_SUBTITLE_CONFIG.lineHeight,
    bottomOffset: subtitleConfig?.bottomOffset ?? DEFAULT_SUBTITLE_CONFIG.bottomOffset,
    pastWordOpacity: subtitleConfig?.pastWordOpacity ?? DEFAULT_SUBTITLE_CONFIG.pastWordOpacity,
    highlightColor: subtitleConfig?.highlightColor ?? DEFAULT_SUBTITLE_CONFIG.highlightColor,
    highlightDurationMs: subtitleConfig?.highlightDurationMs ?? DEFAULT_SUBTITLE_CONFIG.highlightDurationMs,
    highlightTransition: subtitleConfig?.highlightTransition ?? DEFAULT_SUBTITLE_CONFIG.highlightTransition,
    subtitleWidth: subtitleConfig?.subtitleWidth ?? DEFAULT_SUBTITLE_CONFIG.subtitleWidth,
    fontWeight: subtitleConfig?.fontWeight,
    fontStyle: subtitleConfig?.fontStyle,
    outerGlow: subtitleConfig?.outerGlow,
  };

  const { fps } = useVideoConfig();
  const fontFamily = config.fontFamily || "Inter";
  // Resolve module name to CSS fontFamily (e.g., "DancingScript" → "Dancing Script")
  const fontFamilyCSS = getFontFamilyCSS(fontFamily);

  React.useEffect(() => {
    if (fontFamily === "monospace" || fontFamily === "") return;
    const handle = delayRender(`Loading subtitle font: ${fontFamily}`);
    loadFont(fontFamily)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [fontFamily]);

  // Build config with resolved CSS fontFamily for layout components
  const resolvedConfig: SubtitleConfig = { ...config, fontFamily: fontFamilyCSS };

  // Phase 27 OVERLAY-01/03: split preview-only guides from renderable overlays FIRST.
  // Guides (isGuide === true) are NEVER banded — they paint as a fixed top layer below
  // (OVERLAY-03: not reordered by the Capa control). `renderable` is guide-free, so the
  // existing back/front banding only sees non-guide overlays.
  const { guides, renderable } = partitionGuideOverlays(overlays);

  // D-03/D-04: Split renderable overlays into back band (default, under subtitles) and
  // front band (over titles). Overlays with no layer field default to "back".
  const backOverlays = renderable.filter(o => (o.layer ?? "back") === "back");
  const frontOverlays = renderable.filter(o => o.layer === "front");

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ZoomContainer
        zoomEvents={zoomEvents}
        transitionEvents={transitionEvents}
        totalDurationMs={totalDurationMs ?? 10000}
      >
        {videoSrc && <OffthreadVideo src={rawVideoSrc ?? staticFile(videoSrc)} />}
      </ZoomContainer>
      {/* D-03 back-band: paint BEFORE subtitles (layer 2 — under text) */}
      {/* Preview-only legibility dim: opacity 0.85 + saturate(0.8) — studio Player path ONLY, never exported */}
      {backOverlays.map((ov, i) => (
        <div
          key={`overlay-back-${i}`}
          style={{ position: "absolute", inset: 0, opacity: 0.85, filter: "saturate(0.8)" }}
        >
          <PngOverlay overlay={ov} rawImageSrc={ov.imageData} />
        </div>
      ))}
      <SubtitleLayoutRenderer captionPages={captionPages} config={resolvedConfig} totalDurationMs={totalDurationMs} />
      {(titles ?? []).map((title, i) => {
        const fromFrame = Math.round(title.startTimeMs * (fps / 1000));
        const durationInFrames = Math.max(1, Math.round(title.durationMs * (fps / 1000)));
        return (
          <Sequence key={`title-${i}`} from={fromFrame} durationInFrames={durationInFrames}>
            <TitleOverlay
              text={title.text}
              style={title.style}
              durationMs={title.durationMs}
              fontFamily={config.fontFamily}
            />
          </Sequence>
        );
      })}
      {/* D-03 front-band: paint AFTER titles (layer 5 — promoted, over text) */}
      {/* rawImageSrc = ov.imageData (data URL) for Player/browser preview context (D-11) */}
      {frontOverlays.map((ov, i) => (
        <PngOverlay key={`overlay-front-${i}`} overlay={ov} rawImageSrc={ov.imageData} />
      ))}
      {/* Phase 27 OVERLAY-01: safe-zone guides show in the Studio preview. */}
      {/* OVERLAY-03: painted LAST so they sit as a fixed top guide layer above every */}
      {/* band and title — never reordered, never dimmed (a guide must read clearly). */}
      {/* Preview-only by construction: this component drives the studio @remotion/player; */}
      {/* the renderer's SubtitledVideo (Root.tsx) excludes guides per Plan 02. */}
      {guides.map((ov, i) => (
        <PngOverlay key={`overlay-guide-${i}`} overlay={ov} rawImageSrc={ov.imageData} />
      ))}
    </AbsoluteFill>
  );
};