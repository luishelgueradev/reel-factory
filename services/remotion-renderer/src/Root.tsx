import React from "react";
import { Composition, registerRoot, AbsoluteFill, OffthreadVideo, staticFile, Sequence } from "remotion";
import { SubtitleLayoutRenderer } from "./compositions/LayoutDispatcher.js";
import { TitleOverlay } from "./compositions/TitleOverlay.js";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleLayoutMode, SubtitlePosition, SubtitleConfig, TitleConfig } from "./pipeline-config.js";
import { DEFAULT_SUBTITLE_CONFIG } from "./pipeline-config.js";

export interface RemotionProps {
  videoSrc: string;
  captionPages: TikTokPage[];
  videoWidth?: number;
  videoHeight?: number;
  totalDurationMs?: number;
  // PipelineConfig-driven props (D-01, D-02)
  subtitleLayout?: SubtitleLayoutMode;
  subtitleConfig?: SubtitleConfig;
  titles?: TitleConfig[];
}

/**
 * SubtitledVideo composition: renders video background + subtitle overlay
 * using the config-driven LayoutDispatcher (D-01, D-05).
 *
 * - Reads subtitleLayout from subtitleConfig to select the correct layout mode
 * - Falls back to TikTok (backward compatible) when config is missing
 * - Preserves existing video rendering via OffthreadVideo
 */
const SubtitledVideo: React.FC<RemotionProps> = ({
  videoSrc,
  captionPages,
  subtitleConfig,
  titles,
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
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {videoSrc && <OffthreadVideo src={staticFile(videoSrc)} />}
      <SubtitleLayoutRenderer captionPages={captionPages} config={config} />
      {/* Title overlays (D-10, D-13): titles coexist with subtitles at overlapping timestamps */}
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
      }}
      calculateMetadata={async ({ props }) => {
        const durationMs = props.totalDurationMs || 10000;
        const cappedDurationMs = Math.min(durationMs + 500, 300000);

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