import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
  spring,
  OffthreadVideo,
  staticFile,
} from "remotion";
import type { TikTokPage } from "@remotion/captions";

export interface SubtitledVideoProps {
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
}

const CaptionWord: React.FC<{
  text: string;
  isActive: boolean;
  wasActive: boolean;
  fontSize: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  progress: number;
}> = ({ text, isActive, wasActive, fontSize, color, outlineColor, outlineWidth, progress }) => {
  const scale = isActive ? interpolate(progress, [0, 1], [0.95, 1.05]) : 1;

  return (
    <span
      style={{
        display: "inline-block",
        fontSize,
        color,
        fontWeight: isActive ? 800 : wasActive ? 700 : 600,
        letterSpacing: "-0.02em",
        transform: `scale(${scale})`,
        WebkitTextStroke: isActive ? outlineWidth * 1.2 : outlineWidth,
        WebkitTextStrokeColor: outlineColor,
        paintOrder: "stroke fill",
        padding: "0 2px",
        whiteSpace: "pre",
      }}
    >
      {text}
    </span>
  );
};

const CaptionPage: React.FC<{
  page: TikTokPage;
  fontSize: number;
  activeColor: string;
  inactiveColor: string;
  outlineColor: string;
  outlineWidth: number;
  bottomOffset: number;
}> = ({ page, fontSize, activeColor, inactiveColor, outlineColor, outlineWidth, bottomOffset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tokens = page.tokens;
  let currentTokenIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const fromFrame = t.fromMs * (fps / 1000);
    const toFrame = t.toMs * (fps / 1000);
    if (frame >= fromFrame && frame <= toFrame) {
      currentTokenIdx = i;
      break;
    }
  }

  const pageStartFrame = page.startMs * (fps / 1000);
  const fadeIn = spring({
    frame: frame - pageStartFrame,
    fps,
    config: { damping: 100, stiffness: 200 },
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: 40,
        right: 40,
        textAlign: "center",
        whiteSpace: "pre",
        opacity: interpolate(fadeIn, [0, 1], [0.6, 1]),
      }}
    >
      {tokens.map((token, i) => {
        const isActive = i === currentTokenIdx;
        const wasActive = i < currentTokenIdx;
        const progress = isActive
          ? interpolate(
              frame,
              [token.fromMs * (fps / 1000), token.toMs * (fps / 1000)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            )
          : 0;

        return (
          <CaptionWord
            key={`${token.text}-${i}`}
            text={token.text}
            isActive={isActive}
            wasActive={wasActive}
            fontSize={fontSize}
            color={isActive ? activeColor : inactiveColor}
            outlineColor={outlineColor}
            outlineWidth={outlineWidth}
            progress={progress}
          />
        );
      })}
    </div>
  );
};

export const SubtitledVideo: React.FC<SubtitledVideoProps> = ({
  videoSrc,
  captionPages,
  lineHeight = 1.3,
  fontSize = 58,
  activeColor = "#FFFF00",
  inactiveColor = "#FFFFFF",
  outlineColor = "#000000",
  outlineWidth = 3,
  bottomOffset = 250,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {videoSrc && <OffthreadVideo src={staticFile(videoSrc)} />}
      {captionPages.map((page, i) => {
        const fromFrame = Math.round(page.startMs * (fps / 1000));
        const durationInFrames =
          Math.round((page.startMs + page.durationMs) * (fps / 1000)) - fromFrame + 1;

        return (
          <Sequence key={i} from={fromFrame} durationInFrames={durationInFrames}>
            <CaptionPage
              page={page}
              fontSize={fontSize}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              outlineColor={outlineColor}
              outlineWidth={outlineWidth}
              bottomOffset={bottomOffset}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};