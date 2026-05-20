import React from "react";
import {
  AbsoluteFill,
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
} from "./shared-styles";

// ─── Sentence grouping ──────────────────────────────────────────────────────

interface SentenceGroup {
  text: string;
  tokens: TikTokToken[];
  startMs: number;
  endMs: number;
  sentenceIndex: number;
}

/**
 * Group tokens into sentences based on punctuation (.?!).
 * Each sentence contains all tokens up to and including the punctuation token.
 */
function groupBySentence(pages: TikTokPage[]): SentenceGroup[] {
  const sentences: SentenceGroup[] = [];
  let currentTokens: TikTokToken[] = [];
  let sentenceStartMs = 0;
  let sentenceIndex = 0;

  for (const page of pages) {
    for (const token of page.tokens) {
      if (currentTokens.length === 0) {
        sentenceStartMs = token.fromMs;
      }
      currentTokens.push(token);

      // Check if this token ends a sentence
      const text = token.text.trim();
      if (text.endsWith(".") || text.endsWith("?") || text.endsWith("!")) {
        sentences.push({
          text: currentTokens.map(t => t.text.trimStart()).join(""),
          tokens: [...currentTokens],
          startMs: sentenceStartMs,
          endMs: token.toMs,
          sentenceIndex,
        });
        sentenceIndex++;
        currentTokens = [];
      }
    }
  }

  // If remaining tokens don't end with punctuation, group them as the last sentence
  if (currentTokens.length > 0) {
    sentences.push({
      text: currentTokens.map(t => t.text.trimStart()).join(""),
      tokens: [...currentTokens],
      startMs: sentenceStartMs,
      endMs: currentTokens[currentTokens.length - 1].toMs,
      sentenceIndex,
    });
  }

  return sentences;
}

/**
 * Convert sentence groups into TikTokPage-like pages for Sequencing.
 * Each sentence becomes one Sequence entry.
 */
function sentencesToPages(sentences: SentenceGroup[]): TikTokPage[] {
  return sentences.map((s) => ({
    startMs: s.startMs,
    durationMs: s.endMs - s.startMs,
    text: s.text,
    tokens: s.tokens,
  }));
}

// ─── SentencePage (renders one sentence at a time) ──────────────────────────

const SentencePage: React.FC<{
  page: TikTokPage;
  currentTokenIdxInSentence: number;
  config: SubtitleConfig;
  pageFromFrame: number;
}> = ({ page, currentTokenIdxInSentence, config, pageFromFrame }) => {
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

  // Fade logic
  const fadeInEndFrame = Math.round(FADE_IN_MS * (fps / 1000));
  const lastTokenEndMs = page.tokens.length > 0 ? page.tokens[page.tokens.length - 1].toMs : page.startMs;
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
  const sentenceDefaultBg = !config.backgroundHighlight?.enabled
    ? { backgroundColor: "rgba(0, 0, 0, 0.6)", padding: "8px 16px", borderRadius: "8px" }
    : {};

  const pastWordOpacityVal = pastWordOpacity;

  return (
    <div
      style={{
        ...positionStyles,
        ...maxWidthStyle,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        opacity,
        fontFamily: fontFamily || undefined,
        textRendering: "geometricPrecision",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        ...sentenceDefaultBg,
        ...bgHighlightStyles,
      }}
    >
      {page.tokens.map((token, i) => {
        const isTokenActive = i === currentTokenIdxInSentence;
        const isTokenPast = i < currentTokenIdxInSentence;
        const tokenFromFrame = Math.round(token.fromMs * (fps / 1000)) - pageFromFrame;
        const tokenToFrame = Math.round(token.toMs * (fps / 1000)) - pageFromFrame;
        const framesSinceActive = isTokenPast ? Math.max(0, frame - tokenToFrame) : 0;
        const framesSinceActivated = isTokenActive ? Math.max(0, frame - tokenFromFrame) : 0;
        const fadeFrames = Math.max(1, Math.round(HIGHLIGHT_FADE_MS / 33));

        const wordOpacity = isTokenPast
          ? interpolate(
              Math.min(framesSinceActive, fadeFrames),
              [0, fadeFrames],
              [1, pastWordOpacityVal],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            )
          : 1;

        const showHighlight = isTokenActive && !!highlightColorVal && highlightDurationMsVal > 0;
        const hlFrames = showHighlight ? Math.round(highlightDurationMsVal * (fps / 1000)) : 0;
        const isHighlighting = showHighlight && framesSinceActivated < hlFrames;
        const wordColor = isTokenActive
          ? isHighlighting ? highlightColorVal : activeColor
          : isTokenPast
            ? inactiveColor
            : inactiveColor;

        return (
          <span
            key={`${token.text}-${i}`}
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
              padding: "0 4px",
              whiteSpace: "pre-wrap",
              willChange: "opacity",
            }}
          >
            {token.text}
          </span>
        );
      })}
    </div>
  );
};

// ─── SentenceLayout (sentence-at-a-time, D-04) ─────────────────────────────

export interface SentenceLayoutProps {
  captionPages: TikTokPage[];
  config: SubtitleConfig;
  totalDurationMs?: number;
}

export const SentenceLayout: React.FC<SentenceLayoutProps> = ({
  captionPages,
  config,
  totalDurationMs,
}) => {
  const { fps } = useVideoConfig();

  // Group all caption pages into sentences
  const sentences = groupBySentence(captionPages);
  // Convert to pages for Sequencing
  const sentencePages = sentencesToPages(sentences);

  return (
    <>
      {sentencePages.map((page, i) => {
        const fromFrame = Math.round(page.startMs * (fps / 1000));
        const lastTokenEndMs = page.tokens.length > 0 ? page.tokens[page.tokens.length - 1].toMs : page.startMs;

        const nextPageStartMs = i + 1 < sentencePages.length ? sentencePages[i + 1].startMs : Infinity;
        const displayEndMs = lastTokenEndMs + FADE_OUT_MS;
        const safeEndMs = Math.min(displayEndMs, nextPageStartMs - PAGE_OVERLAP_GUARD_MS);
        const clampedEndMs = (i === sentencePages.length - 1 && totalDurationMs)
          ? Math.min(safeEndMs, totalDurationMs)
          : safeEndMs;
        const durationInFrames = Math.max(1, Math.ceil((clampedEndMs - page.startMs) * (fps / 1000)));

        return (
          <Sequence key={`sentence-${i}`} from={fromFrame} durationInFrames={durationInFrames}>
            <SentencePageForLayout
              page={page}
              sentenceIndex={i}
              config={config}
              pageFromFrame={fromFrame}
            />
          </Sequence>
        );
      })}
    </>
  );
};

/**
 * Wrapper that determines the current token index within a sentence Sequence.
 */
const SentencePageForLayout: React.FC<{
  page: TikTokPage;
  sentenceIndex: number;
  config: SubtitleConfig;
  pageFromFrame: number;
}> = ({ page, sentenceIndex, config, pageFromFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find which token in this sentence is currently active
  // pageFromFrame shifts absolute timestamps to sequence-relative frames,
  // matching Remotion's useCurrentFrame() inside <Sequence>
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

  return (
    <SentencePage
      page={page}
      currentTokenIdxInSentence={currentTokenIdx}
      config={config}
      pageFromFrame={pageFromFrame}
    />
  );
};