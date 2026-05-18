// ─── PreviewPlayer: @remotion/player wrapper (D-04, D-05, RESEARCH Pattern 1+2) ───
// Renders SubtitledVideo via @remotion/player at native 1080x1920 composition size.
// Per D-04: Uses the exact same SubtitledVideo composition as production renders.
// Per D-05: CSS aspect-ratio scales the 1080x1920 output to fit the preview panel.
// Per D-06: Uses rawVideoSrc for browser context, bypassing staticFile().

import React, { useMemo, useEffect, useState } from "react";
import { Player } from "@remotion/player";
import { SubtitledVideo } from "../../Root";
import { loadFont } from "../../fonts";
import type { SubtitleConfig } from "../../pipeline-config";
import type { TikTokPage } from "@remotion/captions";
import { RemotionProps } from "../../Root";

interface PreviewPlayerProps {
  subtitleConfig: SubtitleConfig;
  captionPages: TikTokPage[];
  totalDurationMs: number;
}

export function PreviewPlayer({
  subtitleConfig,
  captionPages,
  totalDurationMs,
}: PreviewPlayerProps) {
  const [fontLoaded, setFontLoaded] = useState(false);

  // Per RESEARCH Pitfall 3: Pre-load the current font before rendering
  useEffect(() => {
    const fontFamily = subtitleConfig.fontFamily || "Inter";
    setFontLoaded(false);
    loadFont(fontFamily)
      .then(() => setFontLoaded(true))
      .catch(() => setFontLoaded(true)); // Continue even if font fails to load
  }, [subtitleConfig.fontFamily]);

  // Calculate durationInFrames from totalDurationMs at 30fps
  const durationInFrames = useMemo(() => {
    const ms = totalDurationMs || 10000;
    return Math.max(1, Math.ceil((ms / 1000) * 30));
  }, [totalDurationMs]);

  // Build inputProps for SubtitledVideo
  // Per D-06: rawVideoSrc bypasses staticFile() for browser Player context
  const inputProps: RemotionProps = useMemo(
    () => ({
      videoSrc: "sample-video.mp4",
      rawVideoSrc: "/sample-video.mp4",
      captionPages,
      subtitleLayout: subtitleConfig.layout,
      subtitleConfig,
      titles: [],
      zoomEvents: [],
      transitionEvents: [],
      totalDurationMs: totalDurationMs || 10000,
    }),
    [captionPages, subtitleConfig, totalDurationMs]
  );

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          aspectRatio: "1080 / 1920",
          maxHeight: "100%",
          maxWidth: "100%",
          background: "#000",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <Player
          component={SubtitledVideo}
          durationInFrames={durationInFrames}
          compositionWidth={1080}
          compositionHeight={1920}
          fps={30}
          controls={true}
          loop={true}
          initiallyMuted={true}
          inputProps={inputProps}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}