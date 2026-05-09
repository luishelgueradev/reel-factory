import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
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

const FADE_IN_MS = 100;
const FADE_OUT_MS = 300;
const PAGE_OVERLAP_GUARD_MS = 100;

const CaptionWord: React.FC<{
  text: string;
  isActive: boolean;
  wasActive: boolean;
  fontSize: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
}> = ({ text, isActive, wasActive, fontSize, color, outlineColor, outlineWidth }) => {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize,
        color,
        fontWeight: isActive ? 800 : wasActive ? 700 : 600,
        letterSpacing: "-0.02em",
        WebkitTextStroke: outlineWidth,
        WebkitTextStrokeColor: outlineColor,
        paintOrder: "stroke fill",
        padding: "0 2px",
        whiteSpace: "pre-wrap",
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
  pageFromFrame: number;
}> = ({ page, fontSize, activeColor, inactiveColor, outlineColor, outlineWidth, bottomOffset, pageFromFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tokens = page.tokens;
  let currentTokenIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const fromFrame = Math.round(t.fromMs * (fps / 1000)) - pageFromFrame;
    const toFrame = Math.round(t.toMs * (fps / 1000)) - pageFromFrame;
    if (frame >= fromFrame && frame <= toFrame) {
      currentTokenIdx = i;
      break;
    }
  }

  const pageStartFrame = 0;
  const fadeInEndFrame = Math.round(FADE_IN_MS * (fps / 1000));

  const lastTokenEndMs = tokens.length > 0 ? tokens[tokens.length - 1].toMs : page.startMs;
  const lastTokenEndFrame = Math.round((lastTokenEndMs - page.startMs) * (fps / 1000));
  const fadeOutStartFrame = lastTokenEndFrame;
  const fadeOutEndFrame = fadeOutStartFrame + Math.round(FADE_OUT_MS * (fps / 1000));

  const opacity =
    frame <= fadeInEndFrame
      ? interpolate(frame, [0, fadeInEndFrame], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : frame >= fadeOutStartFrame
        ? interpolate(frame, [fadeOutStartFrame, fadeOutEndFrame], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        : 1;

  return (
    <div
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: 40,
        right: 40,
        textAlign: "center",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        opacity,
      }}
    >
      {tokens.map((token, i) => {
        const isActive = i === currentTokenIdx;
        const wasActive = i < currentTokenIdx;

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
        const lastTokenEndMs = page.tokens.length > 0 ? page.tokens[page.tokens.length - 1].toMs : page.startMs;

        const nextPageStartMs = i + 1 < captionPages.length ? captionPages[i + 1].startMs : Infinity;
        const displayEndMs = lastTokenEndMs + FADE_OUT_MS;
        const safeEndMs = Math.min(displayEndMs, nextPageStartMs - PAGE_OVERLAP_GUARD_MS);
        const durationInFrames = Math.max(1, Math.round((safeEndMs - page.startMs) * (fps / 1000)) + 1);

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
              pageFromFrame={fromFrame}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};