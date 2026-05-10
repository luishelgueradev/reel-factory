import React from "react";
import { Composition, registerRoot } from "remotion";
import { SubtitledVideo } from "./compositions/Subtitles";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleLayoutMode, SubtitlePosition, SubtitleConfig, TitleConfig } from "./pipeline-config.js";

export interface RemotionProps {
  videoSrc: string;
  captionPages: TikTokPage[];
  videoWidth?: number;
  videoHeight?: number;
  totalDurationMs?: number;
  lineHeight?: number;
  fontSize?: number;
  activeColor?: string;
  inactiveColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  bottomOffset?: number;
  // PipelineConfig-driven props (D-01, D-02)
  subtitleLayout?: SubtitleLayoutMode;
  subtitleConfig?: SubtitleConfig;
  titles?: TitleConfig[];
}

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
        captionPages: [],
        videoWidth: 1080,
        videoHeight: 1920,
        totalDurationMs: 10000,
        lineHeight: 1.3,
        fontSize: 58,
        activeColor: "#FFFF00",
        inactiveColor: "#FFFFFF",
        outlineColor: "#000000",
        outlineWidth: 3,
        bottomOffset: 250,
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