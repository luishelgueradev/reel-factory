import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  delayRender,
  continueRender,
} from "remotion";
import type { TitleStyleProps } from "../pipeline-config";
import { loadFont, getFontFamilyCSS } from "../fonts";

// ─── TitleOverlay: Animated title card with entrance/exit animations ───────
// Per D-10 (intro/outro title types), D-11 (visual style), D-13 (title/subtitle coexistence)

interface TitleOverlayProps {
  text: string;
  subtitle?: string;
  style?: TitleStyleProps;
  durationMs: number;
  fontFamily?: string;
}

// ─── Animation timing constants ────────────────────────────────────────────

const SLIDE_UP_DURATION_MS = 300;
const FADE_IN_DURATION_MS = 200;
const FADE_IN_ONLY_DURATION_MS = 500;
const EXIT_FADE_DURATION_MS = 300;

// ─── Default style values (D-11) ──────────────────────────────────────────

const DEFAULT_TITLE_STYLE: Required<TitleStyleProps> = {
  entranceAnimation: "slide-up",
  backgroundColor: "rgba(0,0,0,0.7)",
  textColor: "#FFFFFF",
  titleFontSize: 72,
  subtitleFontSize: 42,
  titleColor: "#FFFFFF",
  subtitleColor: "#FFFFFF",
  titleFontFamily: "Inter",
  subtitleFontFamily: "Inter",
  topOffset: 50,
  lineHeight: 1.2,
  padding: 40,
  fontWeight: true,
  fontStyle: false,
  outerGlow: { enabled: false, color: "#ffffff", intensity: 0.8, softness: 20 },
};

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  text,
  subtitle,
  style,
  durationMs,
  fontFamily = "Inter",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Merge style with defaults (must be before useEffect that uses them)
  const entranceAnimation = style?.entranceAnimation ?? DEFAULT_TITLE_STYLE.entranceAnimation;
  const backgroundColor = style?.backgroundColor ?? DEFAULT_TITLE_STYLE.backgroundColor;
  const titleFontSize = style?.titleFontSize ?? DEFAULT_TITLE_STYLE.titleFontSize;
  const subtitleFontSize = style?.subtitleFontSize ?? DEFAULT_TITLE_STYLE.subtitleFontSize;
  const titleColor = style?.titleColor ?? style?.textColor ?? DEFAULT_TITLE_STYLE.titleColor;
  const subtitleColor = style?.subtitleColor ?? style?.textColor ?? DEFAULT_TITLE_STYLE.subtitleColor;
  const titleFontFamily = style?.titleFontFamily ?? fontFamily ?? DEFAULT_TITLE_STYLE.titleFontFamily;
  const subtitleFontFamily = style?.subtitleFontFamily ?? fontFamily ?? DEFAULT_TITLE_STYLE.subtitleFontFamily;
  const topOffset = style?.topOffset ?? DEFAULT_TITLE_STYLE.topOffset;
  const lineHeight = style?.lineHeight ?? DEFAULT_TITLE_STYLE.lineHeight;
  const padding = style?.padding ?? DEFAULT_TITLE_STYLE.padding;

  // Resolve module names to actual CSS fontFamily names
  // E.g., "DancingScript" → "Dancing Script"
  const titleFontCSS = getFontFamilyCSS(titleFontFamily);
  const subtitleFontCSS = getFontFamilyCSS(subtitleFontFamily);

  // Load Google Fonts — delay render until fonts are available
  const [fontLoaded, setFontLoaded] = React.useState(false);

  React.useEffect(() => {
    const fontsToLoad = [titleFontFamily, subtitleFontFamily].filter(
      (f, i, arr) => f && f !== "monospace" && arr.indexOf(f) === i
    );
    if (fontsToLoad.length === 0) {
      setFontLoaded(true);
      return;
    }
    let pending = fontsToLoad.length;
    const handle = delayRender(`Loading title fonts: ${fontsToLoad.join(", ")}`);
    for (const f of fontsToLoad) {
      loadFont(f)
        .then(() => {
          pending--;
          if (pending === 0) {
            setFontLoaded(true);
            continueRender(handle);
          }
        })
        .catch(() => {
          pending--;
          if (pending === 0) {
            setFontLoaded(true);
            continueRender(handle);
          }
        });
    }
  }, [titleFontFamily, subtitleFontFamily]);

  // Merge style with defaults
  // Calculate frame timing
  const durationInFrames = Math.max(1, Math.round(durationMs * (fps / 1000)));
  const exitFadeStartFrame = Math.max(0, durationInFrames - Math.round(EXIT_FADE_DURATION_MS * (fps / 1000)));

  // ─── Entrance animations (D-11) ───────────────────────────────────────────

  let translateY = 0;
  let opacity = 1;

  switch (entranceAnimation) {
    case "slide-up": {
      // Y offset: starts at 200px below, slides up to center over 300ms
      // Opacity: fades in from 0 to 1 over first 200ms
      const slideUpEndFrame = Math.round(SLIDE_UP_DURATION_MS * (fps / 1000));
      const fadeInEndFrame = Math.round(FADE_IN_DURATION_MS * (fps / 1000));

      translateY = interpolate(frame, [0, slideUpEndFrame], [200, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      const entranceOpacity = interpolate(frame, [0, fadeInEndFrame], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      opacity = entranceOpacity;
      break;
    }
    case "slide-down": {
      // Y offset: starts at 200px above, slides down to center over 300ms
      // Opacity: fades in from 0 to 1 over first 200ms
      const slideDownEndFrame = Math.round(SLIDE_UP_DURATION_MS * (fps / 1000));
      const fadeInEndFrame2 = Math.round(FADE_IN_DURATION_MS * (fps / 1000));

      translateY = interpolate(frame, [0, slideDownEndFrame], [-200, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      const entranceOpacity2 = interpolate(frame, [0, fadeInEndFrame2], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      opacity = entranceOpacity2;
      break;
    }
    case "fade-in": {
      // Opacity fades from 0 to 1 over first 500ms
      const fadeInOnlyEndFrame = Math.round(FADE_IN_ONLY_DURATION_MS * (fps / 1000));

      const entranceOpacity = interpolate(frame, [0, fadeInOnlyEndFrame], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      opacity = entranceOpacity;
      break;
    }
    case "none":
    default:
      // No animation — title appears immediately at full opacity and position
      break;
  }

  // ─── Exit animation: fade out over last 300ms (WR-04: always fade out, including "none" mode)
  if (frame >= exitFadeStartFrame) {
    const exitFadeEndFrame = durationInFrames;
    const exitOpacity = interpolate(frame, [exitFadeStartFrame, exitFadeEndFrame], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    // Take the minimum of entrance opacity and exit opacity
    // so we don't override the entrance fade during exit overlaps
    opacity = Math.min(opacity, exitOpacity);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <AbsoluteFill>
      {/* Semi-transparent background bar (D-11) */}
      <div
        style={{
          position: "absolute",
          top: `${topOffset}%`,
          left: "50%",
          transform: `translate(-50%, -50%) translateY(${translateY}px)`,
          backgroundColor,
          width: "80%",
          padding: `${padding}px 24px`,
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: subtitle ? "12px" : "0",
          opacity,
        }}
      >
        {/* Main title text */}
        <span
          style={{
            fontSize: titleFontSize,
            fontWeight: 800,
            color: titleColor,
            fontFamily: titleFontCSS,
            textAlign: "center",
            lineHeight: lineHeight,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {text}
        </span>

        {/* Optional subtitle text */}
        {subtitle && (
          <span
            style={{
              fontSize: subtitleFontSize,
              fontWeight: 500,
              color: subtitleColor,
              fontFamily: subtitleFontCSS,
              textAlign: "center",
              lineHeight: lineHeight + 0.1,
              opacity: 0.85,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};