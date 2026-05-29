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
import { getOuterGlowStyle } from "./shared-styles";

// ─── TitleOverlay: Animated title card with entrance/exit animations ───────
// Per D-10 (intro/outro title types), D-11 (visual style)
// Phase 20: pixel-coordinate positioning (D-03, D-04), config-driven borderRadius (D-09),
//           subtitle removal (D-07)

interface TitleOverlayProps {
  text: string;
  style?: TitleStyleProps;
  durationMs: number;
  fontFamily?: string;
}

// ─── Animation timing constants ────────────────────────────────────────────

const SLIDE_UP_DURATION_MS = 300;
const FADE_IN_DURATION_MS = 200;
const FADE_IN_ONLY_DURATION_MS = 500;
const EXIT_FADE_DURATION_MS = 300;

// ─── Default style values (D-11, Phase 20: D-06, D-09) ───────────────────

const DEFAULT_TITLE_STYLE: Required<TitleStyleProps> = {
  entranceAnimation: "slide-up",
  backgroundColor: "rgba(0,0,0,0.7)",
  textColor: "#FFFFFF",
  titleFontSize: 72,
  titleColor: "#FFFFFF",
  titleFontFamily: "PlusJakartaSans",
  x: 200,
  y: 960,
  borderRadius: 12,
  lineHeight: 1.2,
  padding: 40,
  fontWeight: true,
  fontStyle: false,
  outerGlow: { enabled: false, color: "#ffffff", intensity: 0.8, softness: 20 },
};

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  text,
  style,
  durationMs,
  fontFamily = "PlusJakartaSans",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Merge style with defaults (must be before useEffect that uses them)
  const entranceAnimation = style?.entranceAnimation ?? DEFAULT_TITLE_STYLE.entranceAnimation;
  const backgroundColor = style?.backgroundColor ?? DEFAULT_TITLE_STYLE.backgroundColor;
  const titleFontSize = style?.titleFontSize ?? DEFAULT_TITLE_STYLE.titleFontSize;
  const titleColor = style?.titleColor ?? style?.textColor ?? DEFAULT_TITLE_STYLE.titleColor;
  const titleFontFamily = style?.titleFontFamily ?? fontFamily ?? DEFAULT_TITLE_STYLE.titleFontFamily;
  const lineHeight = style?.lineHeight ?? DEFAULT_TITLE_STYLE.lineHeight;
  const padding = style?.padding ?? DEFAULT_TITLE_STYLE.padding;

  // Resolve module names to actual CSS fontFamily names
  // E.g., "DancingScript" → "Dancing Script"
  const titleFontCSS = getFontFamilyCSS(titleFontFamily);

  // Phase 20 pixel-coordinate positioning (D-03, D-04) and config-driven borderRadius (D-09)
  const x = style?.x ?? DEFAULT_TITLE_STYLE.x;
  const y = style?.y ?? DEFAULT_TITLE_STYLE.y;
  const borderRadius = style?.borderRadius ?? DEFAULT_TITLE_STYLE.borderRadius;

  // Load Google Fonts — delay render until fonts are available
  const [fontLoaded, setFontLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const fontsToLoad = [titleFontFamily].filter(
      (f, i, arr) => f && f !== "monospace" && arr.indexOf(f) === i
    );
    if (fontsToLoad.length === 0) {
      setFontLoaded(true);
      return;
    }
    let pending = fontsToLoad.length;
    let handle: number | null = delayRender(`Loading title fonts: ${fontsToLoad.join(", ")}`);

    const finish = () => {
      if (handle !== null) {
        continueRender(handle);
        handle = null;
      }
    };

    for (const f of fontsToLoad) {
      loadFont(f)
        .then(() => {
          pending--;
          if (pending === 0) {
            if (!cancelled) setFontLoaded(true);
            finish();
          }
        })
        .catch(() => {
          pending--;
          if (pending === 0) {
            if (!cancelled) setFontLoaded(true);
            finish();
          }
        });
    }
    return () => {
      cancelled = true;
      finish(); // release the handle even if promises have not settled yet
    };
  }, [titleFontFamily]);

  // Do not render until fonts are loaded — prevents Remotion from capturing
  // frames before font loading resolves (delayRender contract).
  if (!fontLoaded) return null;

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
      {/* Phase 20 D-03/D-04: pixel-coordinate positioning; D-09: config-driven borderRadius */}
      <div
        style={{
          position: "absolute",
          left: `${(x / 1080) * 100}%`,
          top: `${(y / 1920) * 100}%`,
          transform: `translateY(${translateY}px)`,
          backgroundColor,
          width: "80%",
          padding: `${padding}px 24px`,
          borderRadius: `${borderRadius}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0",
          opacity,
        }}
      >
        {/* Main title text */}
        <span
          style={{
            fontSize: titleFontSize,
            fontWeight: style?.fontWeight !== false ? 700 : 400,
            fontStyle: style?.fontStyle === true ? "italic" : "normal",
            color: titleColor,
            fontFamily: titleFontCSS,
            textAlign: "center",
            lineHeight: lineHeight,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            ...getOuterGlowStyle(style?.outerGlow),
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
