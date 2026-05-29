// ─── SubtitledVideo: Composable subtitle overlay (D-01, D-04, D-06) ──────────
// Separated from Root.tsx to avoid registerRoot() side effect when imported
// by @remotion/player. Root.tsx still calls registerRoot() for Remotion Studio.

import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, Sequence, delayRender, continueRender, useVideoConfig } from "remotion";
import { SubtitleLayoutRenderer } from "./compositions/LayoutDispatcher";
import { TitleOverlay } from "./compositions/TitleOverlay";
import { ZoomContainer } from "./compositions/ZoomContainer";
import type { TransitionEvent } from "./compositions/JumpCutTransition";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleConfig, TitleConfig, SubtitleLayoutMode, SubtitlePosition } from "./pipeline-config";
import { DEFAULT_SUBTITLE_CONFIG } from "./pipeline-config";
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

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ZoomContainer
        zoomEvents={zoomEvents}
        transitionEvents={transitionEvents}
        totalDurationMs={totalDurationMs ?? 10000}
      >
        {videoSrc && <OffthreadVideo src={rawVideoSrc ?? staticFile(videoSrc)} />}
      </ZoomContainer>
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
    </AbsoluteFill>
  );
};