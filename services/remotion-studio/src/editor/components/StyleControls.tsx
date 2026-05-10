// ─── StyleControls: Subtitle style parameter editing (D-06, D-08, D-09, D-16) ──
// Per D-06: Global style props - fontFamily, fontSize, activeColor, inactiveColor, outlineColor, outlineWidth
// Per D-08: Background highlight - enabled/on/off + color, padding, borderRadius
// Per D-09: Position presets - bottom-center, top-center, center-screen
// Per D-16: Config editor UI for style controls

import React from "react";
import type { SubtitleConfig, SubtitlePosition, BackgroundHighlight } from "../../../pipeline-config.js";
import { AVAILABLE_FONTS } from "../../../fonts.js";

interface StyleControlsProps {
  config: SubtitleConfig;
  onChange: (partial: Partial<SubtitleConfig>) => void;
}

const POSITION_OPTIONS: { id: SubtitlePosition; label: string }[] = [
  { id: "bottom-center", label: "Bottom Center" },
  { id: "top-center", label: "Top Center" },
  { id: "center-screen", label: "Center Screen" },
];

export function StyleControls({ config, onChange }: StyleControlsProps) {
  const bh: BackgroundHighlight = config.backgroundHighlight ?? {
    enabled: false,
    color: "#000000",
    padding: 8,
    borderRadius: 4,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Color controls ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <ColorControl
          label="Active Color"
          value={config.activeColor ?? "#FFFF00"}
          onChange={(v) => onChange({ activeColor: v })}
        />
        <ColorControl
          label="Inactive Color"
          value={config.inactiveColor ?? "#FFFFFF"}
          onChange={(v) => onChange({ inactiveColor: v })}
        />
        <ColorControl
          label="Outline Color"
          value={config.outlineColor ?? "#000000"}
          onChange={(v) => onChange({ outlineColor: v })}
        />
      </div>

      {/* ── Font family selector ─────────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Font Family
        </label>
        <select
          value={config.fontFamily ?? "Inter"}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "#2a2a3e",
            border: "1px solid #444",
            borderRadius: 6,
            color: "#e0e0e0",
            fontSize: 14,
          }}
        >
          {AVAILABLE_FONTS.map((font) => (
            <option key={font} value={font}>{font}</option>
          ))}
        </select>
      </div>

      {/* ── Font size slider ──────────────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Font Size: <strong style={{ color: "#fff" }}>{config.fontSize ?? 58}</strong>
        </label>
        <input
          type="range"
          min={24}
          max={120}
          value={config.fontSize ?? 58}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#4CAF50" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
          <span>24</span>
          <span>120</span>
        </div>
      </div>

      {/* ── Position selector (D-09) ─────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Subtitle Position
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {POSITION_OPTIONS.map((opt) => {
            const isSelected = (config.position ?? "bottom-center") === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onChange({ position: opt.id })}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: `1px solid ${isSelected ? "#4CAF50" : "#444"}`,
                  borderRadius: 6,
                  background: isSelected ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
                  color: isSelected ? "#a5d6a7" : "#ccc",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Outline width ────────────────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Outline Width: <strong style={{ color: "#fff" }}>{config.outlineWidth ?? 3}</strong>
        </label>
        <input
          type="range"
          min={0}
          max={10}
          value={config.outlineWidth ?? 3}
          onChange={(e) => onChange({ outlineWidth: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#4CAF50" }}
        />
      </div>

        {/* ── Letter spacing ───────────────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Letter Spacing: <strong style={{ color: "#fff" }}>{config.letterSpacing ?? 0}</strong>
        </label>
        <input
          type="range"
          min={-1}
          max={20}
          value={config.letterSpacing ?? 0}
          onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#4CAF50" }}
        />
      </div>

      {/* ── Background highlight (D-08) ──────────────────────────────── */}
      <div style={{
        padding: "12px 16px",
        background: "#1e1e2e",
        borderRadius: 8,
        border: "1px solid #333",
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={bh.enabled}
            onChange={(e) => onChange({
              backgroundHighlight: { ...bh, enabled: e.target.checked },
            })}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>
            Background Highlight
          </span>
        </label>

        {bh.enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: 24 }}>
            <ColorControl
              label="Highlight Color"
              value={bh.color}
              onChange={(v) => onChange({ backgroundHighlight: { ...bh, color: v } })}
            />
            <div>
              <label style={{ fontSize: 12, color: "#999" }}>
                Padding: {bh.padding}px
              </label>
              <input
                type="range"
                min={0}
                max={32}
                value={bh.padding}
                onChange={(e) => onChange({ backgroundHighlight: { ...bh, padding: Number(e.target.value) } })}
                style={{ width: "100%", accentColor: "#4CAF50" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#999" }}>
                Border Radius: {bh.borderRadius}px
              </label>
              <input
                type="range"
                min={0}
                max={24}
                value={bh.borderRadius}
                onChange={(e) => onChange({ backgroundHighlight: { ...bh, borderRadius: Number(e.target.value) } })}
                style={{ width: "100%", accentColor: "#4CAF50" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Color picker sub-component ────────────────────────────────────────

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <label style={{ fontSize: 12, color: "#999" }}>{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 48,
          height: 36,
          border: "1px solid #444",
          borderRadius: 4,
          padding: 2,
          background: "#2a2a3e",
          cursor: "pointer",
        }}
      />
      <span style={{ fontSize: 11, color: "#666" }}>{value}</span>
    </div>
  );
}