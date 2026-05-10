import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
} from "remotion";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleConfig } from "../pipeline-config.js";
import { DEFAULT_SUBTITLE_CONFIG } from "../pipeline-config.js";
import {
  FADE_IN_MS,
  FADE_OUT_MS,
  PAGE_OVERLAP_GUARD_MS,
  getPositionStyles,
} from "./shared-styles.js";

// ─── BarWord (single word rendered inside the bar) ───────────────────────────

const BarWord: React.FC<{
  text: string;
  isActive: boolean;
  wasActive: boolean;
  fontSize: number;
  activeColor: string;
  inactiveColor: string;
  outlineColor: string;
  outlineWidth: number;
  letterSpacing?: number;
  lineHeight?: number;
}> = ({
  text,
  isActive,
  wasActive,
  fontSize,
  activeColor,
  inactiveColor,
  outlineColor,
  outlineWidth,
  letterSpacing,
  lineHeight,
}) => {
  const color = isActive || wasActive ? activeColor : inactiveColor;

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

// ─── BarPage (renders word-by-word on a colored background bar) ──────────────

const BarPage: React.FC<{
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

  // Bar-specific: background color from backgroundHighlight or default semi-transparent black
  const barColor = config.backgroundHighlight?.enabled
    ? config.backgroundHighlight.color
    : "rgba(0, 0, 0, 0.7)";
  const barPadding = config.backgroundHighlight?.enabled
    ? config.backgroundHighlight.padding
    : 12;
  const barBorderRadius = config.backgroundHighlight?.enabled
    ? config.backgroundHighlight.borderRadius
    : 8;

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

  // Fade logic (shared with TikTok)
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

  // Bar layout: position at bottom-center with safe margins by default
  // For bar mode, we always use bottom positioning style but respect the position preset
  const positionStyles = getPositionStyles(position, bottomOffset);

  return (
    <div
      style={{
        ...positionStyles,
        textAlign: "center",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        opacity,
      }}
    >
      <div
        style={{
          display: "inline-block",
          backgroundColor: barColor,
          padding: `${barPadding}px ${barPadding * 2}px`,
          borderRadius: `${barBorderRadius}px`,
        }}
      >
        {tokens.map((token, i) => {
          const isActive = i === currentTokenIdx;
          const wasActive = i < currentTokenIdx;

          return (
            <BarWord
              key={`${token.text}-${i}`}
              text={token.text}
              isActive={isActive}
              wasActive={wasActive}
              fontSize={fontSize}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              outlineColor={outlineColor}
              outlineWidth={outlineWidth}
              letterSpacing={letterSpacing}
              lineHeight={lineHeight}
            />
          );
        })}
      </div>
    </div>
  );
};

// ─── BarLayout (full-width bar with word-by-word fill, D-04) ────────────────

export interface BarLayoutProps {
  captionPages: TikTokPage[];
  config: SubtitleConfig;
}

export const BarLayout: React.FC<BarLayoutProps> = ({
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
            <BarPage
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