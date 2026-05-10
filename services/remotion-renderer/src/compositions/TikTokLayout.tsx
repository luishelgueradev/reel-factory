import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
} from "remotion";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleConfig, SubtitlePosition } from "../pipeline-config.js";
import { DEFAULT_SUBTITLE_CONFIG } from "../pipeline-config.js";

// ─── Timing constants (preserved from original Subtitles.tsx) ─────────────

const FADE_IN_MS = 100;
const FADE_OUT_MS = 300;
const PAGE_OVERLAP_GUARD_MS = 100;

// ─── Position helpers (D-09) ────────────────────────────────────────────────

function getPositionStyles(
  position: SubtitlePosition,
  bottomOffset: number
): React.CSSProperties {
  switch (position) {
    case "bottom-center":
      return {
        position: "absolute" as const,
        bottom: bottomOffset,
        left: 40,
        right: 40,
        textAlign: "center" as const,
      };
    case "top-center":
      return {
        position: "absolute" as const,
        top: 100,
        left: 40,
        right: 40,
        textAlign: "center" as const,
      };
    case "center-screen":
      return {
        position: "absolute" as const,
        top: "50%",
        left: 40,
        right: 40,
        transform: "translateY(-50%)",
        textAlign: "center" as const,
      };
  }
}

// ─── Background highlight (D-08) ────────────────────────────────────────────

function getBackgroundHighlightStyle(
  backgroundHighlight: SubtitleConfig["backgroundHighlight"]
): React.CSSProperties {
  if (!backgroundHighlight || !backgroundHighlight.enabled) {
    return {};
  }
  return {
    backgroundColor: backgroundHighlight.color,
    padding: `${backgroundHighlight.padding}px`,
    borderRadius: `${backgroundHighlight.borderRadius}px`,
  };
}

// ─── CaptionWord ────────────────────────────────────────────────────────────

const CaptionWord: React.FC<{
  text: string;
  isActive: boolean;
  wasActive: boolean;
  fontSize: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  letterSpacing?: number;
  lineHeight?: number;
}> = ({
  text,
  isActive,
  wasActive,
  fontSize,
  color,
  outlineColor,
  outlineWidth,
  letterSpacing,
  lineHeight,
}) => {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize,
        color,
        fontWeight: isActive ? 800 : wasActive ? 700 : 600,
        letterSpacing: letterSpacing ?? "-0.02em",
        lineHeight: lineHeight ?? 1.3,
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

// ─── CaptionPage (single page of word-by-word TikTok captions) ──────────────

const CaptionPage: React.FC<{
  page: TikTokPage;
  config: SubtitleConfig;
  pageFromFrame: number;
}> = ({ page, config, pageFromFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fontSize = config.fontSize ?? DEFAULT_SUBTITLE_CONFIG.fontSize;
  const activeColor = config.activeColor ?? DEFAULT_SUBTITLE_CONFIG.activeColor;
  const inactiveColor = config.inactiveColor ?? DEFAULT_SUBTITLE_CONFIG.inactiveColor;
  const outlineColor = config.outlineColor ?? DEFAULT_SUBTITLE_CONFIG.outlineColor;
  const outlineWidth = config.outlineWidth ?? DEFAULT_SUBTITLE_CONFIG.outlineWidth;
  const position = config.position ?? DEFAULT_SUBTITLE_CONFIG.position;
  const bottomOffset = config.bottomOffset ?? DEFAULT_SUBTITLE_CONFIG.bottomOffset;
  const letterSpacing = config.letterSpacing;
  const lineHeight = config.lineHeight ?? DEFAULT_SUBTITLE_CONFIG.lineHeight;

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

  const positionStyles = getPositionStyles(position, bottomOffset);
  const bgHighlightStyles = getBackgroundHighlightStyle(config.backgroundHighlight);

  return (
    <div
      style={{
        ...positionStyles,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        opacity,
        ...bgHighlightStyles,
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
            letterSpacing={letterSpacing}
            lineHeight={lineHeight}
          />
        );
      })}
    </div>
  );
};

// ─── TikTokLayout (extracted from Subtitles.tsx — pixel-identical behavior) ─

export interface TikTokLayoutProps {
  captionPages: TikTokPage[];
  config: SubtitleConfig;
}

export const TikTokLayout: React.FC<TikTokLayoutProps> = ({
  captionPages,
  config,
}) => {
  const { fps } = useVideoConfig();

  return (
    <>
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
              config={config}
              pageFromFrame={fromFrame}
            />
          </Sequence>
        );
      })}
    </>
  );
};