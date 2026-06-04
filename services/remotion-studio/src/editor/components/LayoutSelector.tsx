// ─── LayoutSelector: Subtitle layout mode selection (D-04, D-16) ──────────────
// Per D-04: Four layout modes — TikTok, Sentence, Bar, Karaoke
// Per D-05: Layout mode stored in pipeline-config.json as SubtitleLayoutMode
// Per D-16: Config editor UI for layout selection
//
// Phase 26-01 convergence pass (color-law + token sweep):
//   - Active state: --accent (blue) border + --accent-tint bg (was #4CAF50 green — D-04 violation)
//   - Token sweep: borderRadius → var(--r-md); border → var(--border); bg → var(--surface);
//     label color → var(--text/--accent); description → var(--text-muted);
//     gap/padding → var(--s-*); transition → var(--dur)/var(--ease)

import React from "react";
import type { SubtitleLayoutMode } from "../../pipeline-config.js";

interface LayoutSelectorProps {
  value: SubtitleLayoutMode;
  onChange: (layout: SubtitleLayoutMode) => void;
}

const LAYOUT_OPTIONS: { id: SubtitleLayoutMode; label: string; description: string }[] = [
  {
    id: "tiktok",
    label: "TikTok",
    description: "Word-by-word highlight with active word in color. Classic short-form style.",
  },
  {
    id: "sentence",
    label: "Sentence",
    description: "Full sentence appears at once. Current sentence highlighted against previous ones.",
  },
  {
    id: "bar",
    label: "Bar",
    description: "Color background bar behind text. Word-by-word fill within the bar. Instagram Reels style.",
  },
  {
    id: "karaoke",
    label: "Karaoke",
    description: "Text fills with progress color as each word is spoken. Classic karaoke highlight.",
  },
];

export function LayoutSelector({ value, onChange }: LayoutSelectorProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4, 8px)" }}>
      {LAYOUT_OPTIONS.map((option) => {
        const isSelected = value === option.id;
        return (
          <label
            key={option.id}
            data-selected={isSelected}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--s-5, 10px)",
              padding: "var(--s-5, 10px) var(--s-6, 12px)",
              borderRadius: "var(--r-md, 8px)",
              // Color law (26-01, D-04): active = --accent (blue); NO green on active states
              border: `1px solid ${isSelected ? "var(--accent, #90caf9)" : "var(--border-strong, #444)"}`,
              background: isSelected ? "var(--accent-tint, rgba(144,202,249,0.12))" : "var(--surface, #1e1e2e)",
              cursor: "pointer",
              transition: "border-color var(--dur, 170ms) var(--ease), background var(--dur, 170ms) var(--ease)",
            }}
          >
            <input
              type="radio"
              name="subtitleLayout"
              value={option.id}
              checked={isSelected}
              onChange={() => onChange(option.id)}
              style={{ marginTop: 2, accentColor: "var(--accent, #90caf9)" }}
            />
            <div>
              <div style={{
                fontWeight: 600,
                fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"],
                color: isSelected ? "var(--accent, #90caf9)" : "var(--text, #e6e6ea)",
              }}>
                {option.label}
              </div>
              <div style={{
                fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"],
                color: "var(--text-muted, #777)",
                marginTop: "var(--s-1, 2px)",
              }}>
                {option.description}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
