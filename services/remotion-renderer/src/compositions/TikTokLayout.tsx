import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
} from "remotion";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleConfig } from "../pipeline-config";
import { DEFAULT_SUBTITLE_CONFIG } from "../pipeline-config";
import {
  FADE_IN_MS,
  FADE_OUT_MS,
  PAGE_OVERLAP_GUARD_MS,
  HIGHLIGHT_FADE_MS,
  getPositionStyles,
  getBackgroundHighlightStyle,
  getPastWordOpacity,
} from "./shared-styles";

// ─── CaptionWord ────────────────────────────────────────────────────────────

const CaptionWord: React.FC<{
  text: string;
  isActive: boolean;
  wasActive: boolean;
  framesSinceActive: number;
  framesSinceActivated: number;
  fontSize: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  fontFamily?: string;
  letterSpacing?: number;
  lineHeight?: number;
  pastWordOpacity: number;
  highlightColor?: string;
  highlightDurationMs?: number;
  highlightTransition?: "fade" | "instant";
  fps: number;
}> = ({
  text,
  isActive,
  wasActive,
  framesSinceActive,
  framesSinceActivated,
  fontSize,
  color,
  outlineColor,
  outlineWidth,
  fontFamily,
  letterSpacing,
  lineHeight,
  pastWordOpacity,
  highlightColor,
  highlightDurationMs,
  highlightTransition,
  fps,
}) => {
  const fadeFrames = Math.max(1, Math.round(HIGHLIGHT_FADE_MS / 33));
  const wordOpacity = isActive
    ? 1
    : wasActive
      ? interpolate(
          Math.min(framesSinceActive, fadeFrames),
          [0, fadeFrames],
          [1, pastWordOpacity],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      : 1;

  const showHighlight = isActive && !!highlightColor && (highlightDurationMs ?? 0) > 0;
  const highlightFrames = showHighlight ? Math.round((highlightDurationMs ?? 0) * (fps / 1000)) : 0;
  const isHighlighting = showHighlight && framesSinceActivated < highlightFrames;
  const wordColor = isHighlighting ? highlightColor! : color;

  return (
    <span
      style={{
        display: "inline-block",
        fontSize,
        color: wordColor,
        opacity: wordOpacity,
        fontWeight: 700,
        fontFamily: fontFamily || undefined,
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
  const fontFamily = config.fontFamily;
  const position = config.position ?? DEFAULT_SUBTITLE_CONFIG.position;
  const bottomOffset = config.bottomOffset ?? DEFAULT_SUBTITLE_CONFIG.bottomOffset;
  const letterSpacing = config.letterSpacing;
  const lineHeight = config.lineHeight ?? DEFAULT_SUBTITLE_CONFIG.lineHeight;
  const pastWordOpacity = getPastWordOpacity(config);
  const highlightColor = config.highlightColor ?? DEFAULT_SUBTITLE_CONFIG.highlightColor;
  const highlightDurationMs = config.highlightDurationMs ?? DEFAULT_SUBTITLE_CONFIG.highlightDurationMs;
  const highlightTransition = config.highlightTransition ?? DEFAULT_SUBTITLE_CONFIG.highlightTransition;

  const tokens = page.tokens;
  let currentTokenIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const fromFrame = Math.round(t.fromMs * (fps / 1000)) - pageFromFrame;
    const toFrame = Math.round(t.toMs * (fps / 1000)) - pageFromFrame;
    if (frame >= fromFrame && frame < toFrame) {
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

  const positionStyles = getPositionStyles(position, bottomOffset, subtitleWidth);
  const subtitleWidth = config.subtitleWidth ?? DEFAULT_SUBTITLE_CONFIG.subtitleWidth;
  const maxWidthStyle = subtitleWidth > 0 ? { maxWidth: subtitleWidth, margin: "0 auto" as const } : {};
  const bgHighlightStyles = getBackgroundHighlightStyle(config.backgroundHighlight);

  return (
    <div
      style={{
        ...positionStyles,
        ...maxWidthStyle,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        opacity,
        fontFamily: fontFamily || undefined,
        ...bgHighlightStyles,
      }}
    >
      {tokens.map((token, i) => {
        const isActive = i === currentTokenIdx;
        const wasActive = i < currentTokenIdx;
        const tokenFromFrame = Math.round(token.fromMs * (fps / 1000)) - pageFromFrame;
        const toFrame = Math.round(token.toMs * (fps / 1000)) - pageFromFrame;
        const framesSinceActive = wasActive ? Math.max(0, frame - toFrame) : 0;
        const framesSinceActivated = isActive ? Math.max(0, frame - tokenFromFrame) : 0;

          return (
            <CaptionWord
              key={`${token.text}-${i}`}
              text={token.text}
              isActive={isActive}
              wasActive={wasActive}
              framesSinceActive={framesSinceActive}
              framesSinceActivated={framesSinceActivated}
              fontSize={fontSize}
              color={isActive ? activeColor : inactiveColor}
              outlineColor={outlineColor}
              outlineWidth={outlineWidth}
              fontFamily={fontFamily}
              letterSpacing={letterSpacing}
              lineHeight={lineHeight}
              pastWordOpacity={pastWordOpacity}
              highlightColor={isActive ? highlightColor : undefined}
              highlightDurationMs={isActive ? highlightDurationMs : undefined}
              highlightTransition={isActive ? highlightTransition : undefined}
              fps={fps}
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
  totalDurationMs?: number;
}

export const TikTokLayout: React.FC<TikTokLayoutProps> = ({
  captionPages,
  config,
  totalDurationMs,
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
        const clampedEndMs = (i === captionPages.length - 1 && totalDurationMs)
          ? Math.min(safeEndMs, totalDurationMs)
          : safeEndMs;
        const durationInFrames = Math.max(1, Math.ceil((clampedEndMs - page.startMs) * (fps / 1000)));

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