import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
} from "remotion";
import type { TikTokPage, TikTokToken } from "@remotion/captions";
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
  getOuterGlowStyle,
} from "./shared-styles";

// ─── KaraokeWord (progressive fill effect) ──────────────────────────────────

const KaraokeWord: React.FC<{
  token: TikTokToken;
  isActive: boolean;
  wasActive: boolean;
  framesSinceActive: number;
  framesSinceActivated: number;
  frame: number;
  fps: number;
  pageFromFrame: number;
  fontSize: number;
  activeColor: string;
  inactiveColor: string;
  outlineColor: string;
  outlineWidth: number;
  fontFamily?: string;
  letterSpacing?: number;
  lineHeight?: number;
  pastWordOpacity: number;
  highlightColor?: string;
  highlightDurationMs?: number;
  highlightTransition?: "fade" | "instant";
  fontWeight?: boolean;
  fontStyle?: boolean;
  outerGlowStyle?: React.CSSProperties;
}> = ({
  token,
  isActive,
  wasActive,
  framesSinceActive,
  framesSinceActivated,
  frame,
  fps,
  pageFromFrame,
  fontSize,
  activeColor,
  inactiveColor,
  outlineColor,
  outlineWidth,
  fontFamily,
  letterSpacing,
  lineHeight,
  pastWordOpacity,
  highlightColor,
  highlightDurationMs,
  highlightTransition,
  fontWeight,
  fontStyle,
  outerGlowStyle,
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

  const fadeFrames = Math.max(1, Math.round(HIGHLIGHT_FADE_MS * (fps / 1000)));
  const pastOpacity = wasActive
    ? interpolate(
        Math.min(framesSinceActive, fadeFrames),
        [0, fadeFrames],
        [1, pastWordOpacity],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 1;

  const showHighlight = isActive && !!highlightColor && (highlightDurationMs ?? 0) > 0;
  const hlFrames = showHighlight ? Math.round((highlightDurationMs ?? 0) * (fps / 1000)) : 0;
  const isHighlighting = showHighlight && framesSinceActivated < hlFrames;
  const fillColor = isHighlighting ? highlightColor! : activeColor;

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        padding: "0 2px",
        whiteSpace: "pre-wrap",
        fontFamily: fontFamily || undefined,
        letterSpacing: letterSpacing ?? "-0.02em",
        lineHeight: lineHeight ?? 1.3,
        ...outerGlowStyle,
      }}
    >
      {/* Baseline layer: inactive color */}
      <span
        style={{
          fontSize,
          color: inactiveColor,
          fontWeight: fontWeight !== false ? 700 : 400,
          fontStyle: fontStyle === true ? "italic" : "normal",
          opacity: wasActive ? pastOpacity : 1,
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
          color: fillColor,
          fontWeight: fontWeight !== false ? 700 : 400,
          fontStyle: fontStyle === true ? "italic" : "normal",
          WebkitTextStroke: outlineWidth,
          WebkitTextStrokeColor: outlineColor,
          paintOrder: "stroke fill",
          whiteSpace: "pre-wrap",
          fontFamily: fontFamily || undefined,
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
  const fontFamily = config.fontFamily;
  const position = config.position ?? DEFAULT_SUBTITLE_CONFIG.position;
  const bottomOffset = config.bottomOffset ?? DEFAULT_SUBTITLE_CONFIG.bottomOffset;
  const letterSpacing = config.letterSpacing;
  const lineHeight = config.lineHeight ?? DEFAULT_SUBTITLE_CONFIG.lineHeight;
  const pastWordOpacity = getPastWordOpacity(config);
  const highlightColorVal = config.highlightColor ?? DEFAULT_SUBTITLE_CONFIG.highlightColor;
  const highlightDurationMsVal = config.highlightDurationMs ?? DEFAULT_SUBTITLE_CONFIG.highlightDurationMs;
  const highlightTransitionVal = config.highlightTransition ?? DEFAULT_SUBTITLE_CONFIG.highlightTransition;

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

  // Accumulate past-word threshold when between tokens (currentTokenIdx === -1)
  // so wasActive stays true for past words instead of flashing to inactiveColor.
  let wasActiveThreshold = currentTokenIdx;
  if (currentTokenIdx === -1) {
    for (let i = 0; i < tokens.length; i++) {
      const toFrame = Math.round(tokens[i].toMs * (fps / 1000)) - pageFromFrame;
      if (frame >= toFrame) wasActiveThreshold = i + 1;
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

  const subtitleWidth = config.subtitleWidth ?? DEFAULT_SUBTITLE_CONFIG.subtitleWidth;
  const positionStyles = getPositionStyles(position, bottomOffset, subtitleWidth);
  const maxWidthStyle = subtitleWidth > 0 ? { maxWidth: subtitleWidth, margin: "0 auto" as const } : {};
  const bgHighlightStyles = getBackgroundHighlightStyle(config.backgroundHighlight);
  const outerGlowStyle = getOuterGlowStyle(config.outerGlow);

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
        const wasActive = i < (currentTokenIdx !== -1 ? currentTokenIdx : wasActiveThreshold);
        const toFrame = Math.round(token.toMs * (fps / 1000)) - pageFromFrame;
        const tokenFromFrame = Math.round(token.fromMs * (fps / 1000)) - pageFromFrame;
        const framesSinceActive = wasActive ? Math.max(0, frame - toFrame) : 0;
        const framesSinceActivated = isActive ? Math.max(0, frame - tokenFromFrame) : 0;

        return (
          <KaraokeWord
            key={`${token.text}-${i}`}
            token={token}
            isActive={isActive}
            wasActive={wasActive}
            framesSinceActive={framesSinceActive}
            framesSinceActivated={framesSinceActivated}
            frame={frame}
            fps={fps}
            pageFromFrame={pageFromFrame}
            fontSize={fontSize}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
            outlineColor={outlineColor}
            outlineWidth={outlineWidth}
            fontFamily={fontFamily}
            letterSpacing={letterSpacing}
            lineHeight={lineHeight}
            pastWordOpacity={pastWordOpacity}
            highlightColor={isActive ? highlightColorVal : undefined}
            highlightDurationMs={isActive ? highlightDurationMsVal : undefined}
            highlightTransition={isActive ? highlightTransitionVal : undefined}
            fontWeight={config.fontWeight}
            fontStyle={config.fontStyle}
            outerGlowStyle={outerGlowStyle}
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
  totalDurationMs?: number;
}

export const KaraokeLayout: React.FC<KaraokeLayoutProps> = ({
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