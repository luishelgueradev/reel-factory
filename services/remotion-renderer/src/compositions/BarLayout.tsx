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
  getPastWordOpacity,
} from "./shared-styles";

// Interpolate between two hex colors (#RRGGBB). Falls back to `to` for non-hex inputs.
function lerpColor(from: string, to: string, t: number): string {
  const parse = (h: string) => {
    const c = h.replace("#", "");
    const s = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] as const;
  };
  try {
    const [r1, g1, b1] = parse(from);
    const [r2, g2, b2] = parse(to);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
  } catch {
    return to;
  }
}

// ─── BarWord (single word rendered inside the bar) ───────────────────────────

const BarWord: React.FC<{
  text: string;
  isActive: boolean;
  wasActive: boolean;
  framesSinceActive: number;
  framesSinceActivated: number;
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
  fps: number;
}> = ({
  text,
  isActive,
  wasActive,
  framesSinceActive,
  framesSinceActivated,
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
  fps,
}) => {
  const color = isActive || wasActive ? activeColor : inactiveColor;
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
  const hlFrames = showHighlight ? Math.max(1, Math.round((highlightDurationMs ?? 0) * (fps / 1000))) : 0;
  const isHighlighting = showHighlight && framesSinceActivated < hlFrames;
  let wordColor = color;
  if (isHighlighting) {
    if (highlightTransition === "fade") {
      const t = interpolate(framesSinceActivated, [0, hlFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      wordColor = lerpColor(highlightColor!, color, t);
    } else {
      wordColor = highlightColor!;
    }
  }

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
  const fontFamily = config.fontFamily;
  const position = config.position ?? DEFAULT_SUBTITLE_CONFIG.position;
  const bottomOffset = config.bottomOffset ?? DEFAULT_SUBTITLE_CONFIG.bottomOffset;
  const letterSpacing = config.letterSpacing;
  const lineHeight = config.lineHeight ?? DEFAULT_SUBTITLE_CONFIG.lineHeight;
  const pastWordOpacity = getPastWordOpacity(config);
  const highlightColorVal = config.highlightColor ?? DEFAULT_SUBTITLE_CONFIG.highlightColor;
  const highlightDurationMsVal = config.highlightDurationMs ?? DEFAULT_SUBTITLE_CONFIG.highlightDurationMs;
  const highlightTransitionVal = config.highlightTransition ?? DEFAULT_SUBTITLE_CONFIG.highlightTransition;

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
  const subtitleWidth = config.subtitleWidth ?? DEFAULT_SUBTITLE_CONFIG.subtitleWidth;

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

  // When between tokens (currentTokenIdx = -1), find how many tokens have ended
  // so wasActive stays true for past words instead of flashing to inactiveColor.
  let wasActiveThreshold = currentTokenIdx;
  if (currentTokenIdx === -1) {
    for (let i = 0; i < tokens.length; i++) {
      const toFrame = Math.round(tokens[i].toMs * (fps / 1000)) - pageFromFrame;
      if (frame >= toFrame) wasActiveThreshold = i + 1;
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
  const positionStyles = getPositionStyles(position, bottomOffset, subtitleWidth);
  const maxWidthStyle = subtitleWidth > 0 ? { maxWidth: subtitleWidth, margin: "0 auto" } : {};

  return (
    <div
      style={{
        ...positionStyles,
        ...maxWidthStyle,
        textAlign: "center",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        opacity,
        fontFamily: fontFamily || undefined,
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
          const wasActive = i < (currentTokenIdx !== -1 ? currentTokenIdx : wasActiveThreshold);
          const tokenFromFrame = Math.round(token.fromMs * (fps / 1000)) - pageFromFrame;
          const toFrame = Math.round(token.toMs * (fps / 1000)) - pageFromFrame;
          const framesSinceActive = wasActive ? Math.max(0, frame - toFrame) : 0;
          const framesSinceActivated = isActive ? Math.max(0, frame - tokenFromFrame) : 0;

          return (
            <BarWord
              key={`${token.text}-${i}`}
              text={token.text}
              isActive={isActive}
              wasActive={wasActive}
              framesSinceActive={framesSinceActive}
              framesSinceActivated={framesSinceActivated}
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
              fps={fps}
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
  totalDurationMs?: number;
}

export const BarLayout: React.FC<BarLayoutProps> = ({
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

        const isLastPage = i === captionPages.length - 1;
        const nextPageStartMs = !isLastPage ? captionPages[i + 1].startMs : Infinity;

        // Non-last pages: Sequence runs until next page starts — eliminates inter-page blank gap.
        // PAGE_OVERLAP_GUARD_MS is intentionally NOT subtracted (it was the source of the gap).
        // Last page: fade out naturally after last token (FADE_OUT_MS=300ms).
        const displayEndMs = !isLastPage ? nextPageStartMs : lastTokenEndMs + FADE_OUT_MS;

        const clampedEndMs = (isLastPage && totalDurationMs)
          ? Math.min(displayEndMs, totalDurationMs)
          : displayEndMs;
        const durationInFrames = Math.max(1, Math.ceil((clampedEndMs - page.startMs) * (fps / 1000)));

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