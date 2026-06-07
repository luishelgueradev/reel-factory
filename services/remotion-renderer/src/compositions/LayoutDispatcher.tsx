import React from "react";
import type { TikTokPage } from "@remotion/captions";
import type { SubtitleConfig } from "../pipeline-config";
import { TikTokLayout } from "./TikTokLayout";
import { SentenceLayout } from "./SentenceLayout";
import { BarLayout } from "./BarLayout";

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
    default:
      // Per D-05: unknown layout falls back to TikTok (safe default, T-06-04).
      // Phase 28 SUB-04: this is also the render-time migration fallback for a
      // stale layout:"karaoke" value that survived in a persisted config.
      return <TikTokLayout captionPages={captionPages} config={config} totalDurationMs={totalDurationMs} />;
  }
};