// ─── Remotion Studio: Root composition registration ─────────────────────────
// SubtitledVideo and RemotionProps are in SubtitledVideo.tsx to avoid
// registerRoot() side effect when imported by @remotion/player.

import React from "react";
import { Composition, registerRoot } from "remotion";
import { SubtitledVideo } from "./SubtitledVideo";
import type { RemotionProps } from "./SubtitledVideo";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleLayoutMode, SubtitlePosition, TitleConfig } from "./pipeline-config";

export { SubtitledVideo } from "./SubtitledVideo";
export type { RemotionProps } from "./SubtitledVideo";

const RemotionRoot: React.FC = () => {
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
        subtitleLayout: "tiktok" as SubtitleLayoutMode,
        subtitleConfig: {
          layout: "tiktok" as SubtitleLayoutMode,
          position: "bottom-center" as SubtitlePosition,
        },
        titles: [] as TitleConfig[],
        zoomEvents: [],
        transitionEvents: [],
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