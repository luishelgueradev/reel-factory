import React from "react";
import { Composition, registerRoot, AbsoluteFill, OffthreadVideo, staticFile, Sequence, delayRender, continueRender } from "remotion";
import { SubtitleLayoutRenderer } from "./compositions/LayoutDispatcher";
import { TitleOverlay } from "./compositions/TitleOverlay";
import { ZoomContainer } from "./compositions/ZoomContainer";
import type { TransitionEvent } from "./compositions/JumpCutTransition";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleLayoutMode, SubtitlePosition, SubtitleConfig, TitleConfig } from "./pipeline-config";
import { DEFAULT_SUBTITLE_CONFIG } from "./pipeline-config";
import type { ZoomEvent } from "./zoom-detection";
import { loadFont } from "./fonts";

export interface RemotionProps {
  videoSrc: string;
  rawVideoSrc?: string;
  captionPages: TikTokPage[];
  videoWidth?: number;
  videoHeight?: number;
  totalDurationMs?: number;
  // PipelineConfig-driven props (D-01, D-02)
  subtitleLayout?: SubtitleLayoutMode;
  subtitleConfig?: SubtitleConfig;
  titles?: TitleConfig[];
  // Phase 7: Visual effects (D-08, D-10)
  zoomEvents?: ZoomEvent[];
  transitionEvents?: TransitionEvent[];
}

/**
 * SubtitledVideo composition: renders video background + subtitle overlay
 * using the config-driven LayoutDispatcher (D-01, D-05).
 *
 * - Reads subtitleLayout from subtitleConfig to select the correct layout mode
 * - Falls back to TikTok (backward compatible) when config is missing
 * - Preserves existing video rendering via OffthreadVideo
 */
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
  // Build the SubtitleConfig, merging defaults for any missing fields
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
  };

  // Load Google Font for subtitles — delay render until font is available (D-07, T-06-07)
  const fontFamily = config.fontFamily || "Inter";
  React.useEffect(() => {
    if (fontFamily === "monospace" || fontFamily === "") return;
    const handle = delayRender(`Loading subtitle font: ${fontFamily}`);
    loadFont(fontFamily)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [fontFamily]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* D-08/VISU-04: ZoomContainer wraps OffthreadVideo with combined zoom+transition scale */}
      <ZoomContainer
        zoomEvents={zoomEvents}
        transitionEvents={transitionEvents}
        totalDurationMs={totalDurationMs ?? 10000}
      >
        {videoSrc && <OffthreadVideo src={rawVideoSrc ?? staticFile(videoSrc)} />}
      </ZoomContainer>
      {/* Subtitles on top of video — not affected by zoom */}
      <SubtitleLayoutRenderer captionPages={captionPages} config={config} totalDurationMs={totalDurationMs} />
      {/* Title overlays on top of subtitles — not affected by zoom */}
      {(titles ?? []).map((title, i) => {
        const fps = 30; // matches composition fps
        const fromFrame = Math.round(title.startTimeMs * (fps / 1000));
        const durationInFrames = Math.max(1, Math.round(title.durationMs * (fps / 1000)));
        return (
          <Sequence key={`title-${i}`} from={fromFrame} durationInFrames={durationInFrames}>
            <TitleOverlay
              text={title.text}
              subtitle={title.subtitle}
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

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SubtitledVideo"
      component={SubtitledVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        videoSrc: "",
        captionPages: [] as TikTokPage[],
        videoWidth: 1080,
        videoHeight: 1920,
        totalDurationMs: 10000,
        // PipelineConfig defaults — TikTok layout is default (D-05)
        subtitleLayout: "tiktok" as SubtitleLayoutMode,
        subtitleConfig: {
          layout: "tiktok" as SubtitleLayoutMode,
          position: "bottom-center" as SubtitlePosition,
        } satisfies SubtitleConfig,
        titles: [] as TitleConfig[],
        // Phase 7: Visual effects defaults (D-08, D-10)
        zoomEvents: [] as ZoomEvent[],
        transitionEvents: [] as TransitionEvent[],
      }}
      calculateMetadata={async ({ props }) => {
        const durationMs = props.totalDurationMs || 10000;
        const cappedDurationMs = Math.min(durationMs, 7200000);

        return {
          durationInFrames: Math.ceil((cappedDurationMs / 1000) * 30),
          fps: 30,
          width: props.videoWidth || 1080,
          height: props.videoHeight || 1920,
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);