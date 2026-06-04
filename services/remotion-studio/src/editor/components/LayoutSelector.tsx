// ─── LayoutSelector: Subtitle layout mode preset cards (26-02, sketch 011-C) ──
// Per D-04: Four layout modes — TikTok, Sentence, Bar, Karaoke
// Per D-05: Layout mode stored in pipeline-config.json as SubtitleLayoutMode
// Per sketch 011-C: Each mode is a preset card with a small static glyph/specimen
//   + mode label. Blue selected ring (--accent). Cards lead the form (TabLead).
//
// Phase 26-01 convergence pass (color-law + token sweep):
//   Active state: --accent (blue) border + --accent-tint bg (was #4CAF50 green — D-04 violation)
// Phase 26-02: Refactored from radio rows → 4-card grid per sketch 011-C.
//   Static cards only (no live animation — D-03 deferred).
//   A11y: role="radiogroup" container, each card is role="radio" with aria-checked.
//   Color law (LOCKED): active = --accent (blue). NO green on active states.

import React from "react";
import type { SubtitleLayoutMode } from "../../pipeline-config.js";

interface LayoutSelectorProps {
  value: SubtitleLayoutMode;
  onChange: (layout: SubtitleLayoutMode) => void;
}

// ── Static glyph/specimen per mode (sketch 011-C .mc-vis content) ─────────────
// Each specimen is a ~30px-tall tile showing a hint of what the mode looks like.
// Static only — no live animation (D-03 deferred).

function TikTokVis(): React.ReactElement {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "baseline", justifyContent: "center" }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: "#ffea00" }}>pa</span>
      <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>labra</span>
    </div>
  );
}

function SentenceVis(): React.ReactElement {
  return (
    <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: "-0.01em" }}>
      frase entera
    </span>
  );
}

function BarVis(): React.ReactElement {
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 800,
      background: "var(--accent, #90caf9)",
      color: "var(--stage, #0f0f17)",
      padding: "1px 5px",
      borderRadius: 2,
    }}>
      barra
    </span>
  );
}

function KaraokeVis(): React.ReactElement {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "baseline", justifyContent: "center" }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: "#ffea00" }}>kara</span>
      <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>oke</span>
    </div>
  );
}

interface ModeCardOption {
  id: SubtitleLayoutMode;
  label: string;
  Vis: () => React.ReactElement;
}

const LAYOUT_OPTIONS: ModeCardOption[] = [
  { id: "tiktok",   label: "TikTok",   Vis: TikTokVis },
  { id: "sentence", label: "Sentence", Vis: SentenceVis },
  { id: "bar",      label: "Bar",      Vis: BarVis },
  { id: "karaoke",  label: "Karaoke",  Vis: KaraokeVis },
];

// Section header — matches the always-open titled section pattern used across
// StyleControls and TitleEditor for visual consistency.
function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--s-4, 8px)",
      marginBottom: "var(--s-6, 12px)",
    }}>
      <span style={{
        fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
        fontWeight: 700,
        color: "var(--text-muted, #777)",
        letterSpacing: "0.1em",
        textTransform: "uppercase" as React.CSSProperties["textTransform"],
        flexShrink: 0,
      }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border-faint, #2a2a38)" }} />
    </div>
  );
}

export function LayoutSelector({ value, onChange }: LayoutSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Modo de subtítulo"
      style={{ marginBottom: "var(--s-8, 16px)" }}
    >
      <SectionHeader title="Modo de subtítulo" />

      {/* 4-card grid — sketch 011-C .modecards pattern */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--s-4, 8px)",
        }}
      >
        {LAYOUT_OPTIONS.map((option) => {
          const isSelected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-mode={option.id}
              data-selected={isSelected}
              onClick={() => onChange(option.id)}
              style={{
                // Card base — sketch 011-C .modecard
                padding: "var(--s-5, 10px) var(--s-3, 6px) var(--s-4, 8px)",
                // Color law (26-01/26-02, D-04): active = --accent (blue); NO green
                background: isSelected
                  ? "var(--accent-tint-2, rgba(144,202,249,0.08))"
                  : "var(--surface, #1e1e2e)",
                border: `1px solid ${isSelected
                  ? "var(--accent-strong, #6ba8e0)"
                  : "var(--border, #333)"}`,
                borderRadius: "var(--r-sm, 6px)",
                cursor: "pointer",
                textAlign: "center" as React.CSSProperties["textAlign"],
                transition: [
                  "border-color var(--dur,170ms) var(--ease)",
                  "background var(--dur,170ms) var(--ease)",
                ].join(", "),
                // Reset button defaults
                font: "inherit",
                display: "flex",
                flexDirection: "column" as React.CSSProperties["flexDirection"],
                alignItems: "center",
                gap: "var(--s-3, 6px)",
              }}
            >
              {/* .mc-vis — 30px specimen hint tile (sketch 011-C) */}
              <div
                style={{
                  width: "100%",
                  height: 30,
                  borderRadius: "var(--r-xs, 4px)",
                  background: "var(--stage, #0f0f17)",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                <option.Vis />
              </div>

              {/* .mc-nm — mode name label (sketch 011-C) */}
              <span
                style={{
                  fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
                  fontWeight: 600,
                  // Color law: active → --accent (blue); inactive → --text-2
                  color: isSelected
                    ? "var(--accent, #90caf9)"
                    : "var(--text-2, #a8a8b3)",
                }}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
