// ─── LayoutSelector: Subtitle layout mode selection (D-04, D-16) ──────────────
// Per D-04: Four layout modes — TikTok, Sentence, Bar, Karaoke
// Per D-05: Layout mode stored in pipeline-config.json as SubtitleLayoutMode
// Per D-16: Config editor UI for layout selection

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {LAYOUT_OPTIONS.map((option) => {
        const isSelected = value === option.id;
        return (
          <label
            key={option.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 8,
              border: `1px solid ${isSelected ? "#4CAF50" : "#444"}`,
              background: isSelected ? "rgba(76, 175, 80, 0.12)" : "#1e1e2e",
              cursor: "pointer",
              transition: "border-color 0.2s, background 0.2s",
            }}
          >
            <input
              type="radio"
              name="subtitleLayout"
              value={option.id}
              checked={isSelected}
              onChange={() => onChange(option.id)}
              style={{ marginTop: 2 }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: isSelected ? "#a5d6a7" : "#e0e0e0" }}>
                {option.label}
              </div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                {option.description}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}