import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
} from "remotion";
import type { TikTokPage, TikTokToken } from "@remotion/captions";
import type { SubtitleConfig, SubtitlePosition } from "../pipeline-config.js";
import { DEFAULT_SUBTITLE_CONFIG } from "../pipeline-config.js";

// ─── Timing constants (shared across layouts) ───────────────────────────────

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

// ─── KaraokeWord (progressive fill effect) ──────────────────────────────────

const KaraokeWord: React.FC<{
  token: TikTokToken;
  isActive: boolean;
  wasActive: boolean;
  frame: number;
  fps: number;
  pageFromFrame: number;
  fontSize: number;
  activeColor: string;
  inactiveColor: string;
  outlineColor: string;
  outlineWidth: number;
  letterSpacing?: number;
  lineHeight?: number;
}> = ({
  token,
  isActive,
  wasActive,
  frame,
  fps,
  pageFromFrame,
  fontSize,
  activeColor,
  inactiveColor,
  outlineColor,
  outlineWidth,
  letterSpacing,
  lineHeight,
}) => {
  // Calculate fill progress for the active word
  const tokenFromFrame = Math.round(token.fromMs * (fps / 1000)) - pageFromFrame;
  const tokenToFrame = Math.round(token.toMs * (fps / 1000)) - pageFromFrame;

  // Fill progress: 0% to 100% as the word is being spoken
  const fillProgress = interpolate(
    frame,
    [tokenFromFrame, tokenToFrame],
    [0, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // For active word: clip width animates from 0% to 100%
  // For wasActive word: fully filled (100%)
  // For upcoming word: 0% fill
  const clipPercent = isActive ? fillProgress : wasActive ? 100 : 0;

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        padding: "0 2px",
        whiteSpace: "pre-wrap",
        letterSpacing: letterSpacing ?? "-0.02em",
        lineHeight: lineHeight ?? 1.3,
      }}
    >
      {/* Baseline layer: inactive color */}
      <span
        style={{
          fontSize,
          color: inactiveColor,
          fontWeight: 600,
          WebkitTextStroke: outlineWidth,
          WebkitTextStrokeColor: outlineColor,
          paintOrder: "stroke fill",
        }}
      >
        {token.text}
      </span>
      {/* Active fill layer: clipped from left to right */}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "hidden",
          width: `${clipPercent}%`,
          fontSize,
          color: activeColor,
          fontWeight: 800,
          WebkitTextStroke: outlineWidth,
          WebkitTextStrokeColor: outlineColor,
          paintOrder: "stroke fill",
          whiteSpace: "pre-wrap",
          letterSpacing: letterSpacing ?? "-0.02em",
          lineHeight: lineHeight ?? 1.3,
        }}
      >
        {token.text}
      </span>
    </span>
  );
};

// ─── KaraokePage (renders one caption page with karaoke fill) ────────────────

const KaraokePage: React.FC<{
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

  // Fade logic
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
          <KaraokeWord
            key={`${token.text}-${i}`}
            token={token}
            isActive={isActive}
            wasActive={wasActive}
            frame={frame}
            fps={fps}
            pageFromFrame={pageFromFrame}
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
  );
};

// ─── KaraokeLayout (karaoke-style fill, D-04/D-06) ──────────────────────────

export interface KaraokeLayoutProps {
  captionPages: TikTokPage[];
  config: SubtitleConfig;
}

export const KaraokeLayout: React.FC<KaraokeLayoutProps> = ({
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
            <KaraokePage
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