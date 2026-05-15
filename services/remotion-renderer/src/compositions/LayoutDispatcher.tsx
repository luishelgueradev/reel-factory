import React from "react";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleConfig } from "../pipeline-config";
import { TikTokLayout } from "./TikTokLayout";
import { SentenceLayout } from "./SentenceLayout";
import { BarLayout } from "./BarLayout";
import { KaraokeLayout } from "./KaraokeLayout";

// ─── Shared props for all layout components ──────────────────────────────────

export interface SubtitleLayoutProps {
  captionPages: TikTokPage[];
  config: SubtitleConfig;
  totalDurationMs?: number;
}

// ─── SubtitleLayoutRenderer (D-05: layout dispatcher) ───────────────────────

/**
 * Selects the correct subtitle layout component based on the
 * `config.layout` field. Falls back to TikTok layout when layout
 * is undefined or unrecognized (per D-05 backward compatibility).
 *
 * Per T-06-04: Unknown layout modes fall back to TikTok (safe default).
 */
export const SubtitleLayoutRenderer: React.FC<SubtitleLayoutProps> = ({
  captionPages,
  config,
  totalDurationMs,
}) => {
  const layout = config.layout ?? "tiktok";

  switch (layout) {
    case "tiktok":
      return <TikTokLayout captionPages={captionPages} config={config} totalDurationMs={totalDurationMs} />;
    case "sentence":
      return <SentenceLayout captionPages={captionPages} config={config} totalDurationMs={totalDurationMs} />;
    case "bar":
      return <BarLayout captionPages={captionPages} config={config} totalDurationMs={totalDurationMs} />;
    case "karaoke":
      return <KaraokeLayout captionPages={captionPages} config={config} totalDurationMs={totalDurationMs} />;
    default:
      // Per D-05: unknown layout falls back to TikTok (safe default, T-06-04)
      return <TikTokLayout captionPages={captionPages} config={config} totalDurationMs={totalDurationMs} />;
  }
};