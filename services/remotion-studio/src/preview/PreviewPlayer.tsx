// ─── PreviewPlayer: @remotion/player wrapper (D-04, D-05, RESEARCH Pattern 1+2) ───
// Renders SubtitledVideo via @remotion/player at native 1080x1920 composition size.
// Per D-04: Uses the exact same SubtitledVideo composition as production renders.
// Per D-05: CSS aspect-ratio scales the 1080x1920 output to fit the preview panel.
// Per D-06: Uses rawVideoSrc for browser context, bypassing staticFile().

import React, { useMemo, useEffect, useState } from "react";
import { Player } from "@remotion/player";
import { SubtitledVideo } from "../SubtitledVideo";
import { loadFont } from "../fonts";
import type { SubtitleConfig, TitleConfig, PngOverlayConfig } from "../pipeline-config";
import type { TikTokPage } from "@remotion/captions";
import type { RemotionProps } from "../SubtitledVideo";

interface PreviewPlayerProps {
  subtitleConfig: SubtitleConfig;
  captionPages: TikTokPage[];
  totalDurationMs: number;
  titles?: TitleConfig[];
  overlays?: PngOverlayConfig[];
}

export function PreviewPlayer({
  subtitleConfig,
  captionPages,
  totalDurationMs,
  titles,
  overlays,
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
      titles: titles ?? [],
      overlays: overlays ?? [],
      zoomEvents: [],
      transitionEvents: [],
      totalDurationMs: totalDurationMs || 10000,
    }),
    [captionPages, subtitleConfig, totalDurationMs, titles, overlays]
  );

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const videoFit = useMemo(() => {
    const containerAR = dimensions.width / dimensions.height;
    const videoAR = 1080 / 1920;
    if (containerAR > videoAR) {
      const h = dimensions.height;
      const w = h * videoAR;
      return { width: w, height: h };
    } else {
      const w = dimensions.width;
      const h = w / videoAR;
      return { width: w, height: h };
    }
  }, [dimensions.width, dimensions.height]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
      }}
    >
      {dimensions.width > 0 && (
        <div
          style={{
            width: videoFit.width,
            height: videoFit.height,
            background: "#000",
            borderRadius: 8,
            overflow: "hidden",
            position: "relative",
          }}
          className="preview-player-override"
        >
          <style>{`
            .preview-player-override button,
            .preview-player-override svg,
            .preview-player-override path {
              color: white !important;
              fill: currentColor !important;
            }
          `}</style>
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
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}