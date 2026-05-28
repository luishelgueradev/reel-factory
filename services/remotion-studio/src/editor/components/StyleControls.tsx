// ─── StyleControls: Subtitle style parameter editing (D-06, D-08, D-09, D-16) ──
// Per D-06: Global style props - fontFamily, fontSize, activeColor, inactiveColor, outlineColor, outlineWidth
// Per D-08: Background highlight - enabled/on/off + color, padding, borderRadius
// Per D-09: Position presets - bottom-center, top-center, center-screen
// Per D-16: Config editor UI for style controls
// Phase 19: Extended font size (200), fontWeight/fontStyle toggles, Outer Glow card

import React from "react";
import type { SubtitleConfig, SubtitlePosition, BackgroundHighlight, OuterGlow } from "../../pipeline-config.js";
import { AVAILABLE_FONTS } from "../../fonts.js";

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

  const glow: OuterGlow = config.outerGlow ?? {
    enabled: false,
    color: "#ffffff",
    intensity: 0.8,
    softness: 20,
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
          label="Highlight Color"
          value={config.highlightColor ?? "#FFFFFF"}
          onChange={(v) => onChange({ highlightColor: v })}
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
          value={config.fontFamily ?? "PlusJakartaSans"}
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
          max={200}
          value={config.fontSize ?? 58}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#4CAF50" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
          <span>24</span>
          <span>200</span>
        </div>
      </div>

      {/* ── Font Weight toggle ─────────────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Font Weight
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={() => onChange({ fontWeight: false })}
            style={{
              flex: 1,
              padding: "6px 12px",
              border: `1px solid ${config.fontWeight === false ? "#4CAF50" : "#444"}`,
              borderRadius: 4,
              background: config.fontWeight === false ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
              color: config.fontWeight === false ? "#a5d6a7" : "#ccc",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Regular
          </button>
          <button
            onClick={() => onChange({ fontWeight: true })}
            style={{
              flex: 1,
              padding: "6px 12px",
              border: `1px solid ${config.fontWeight !== false ? "#4CAF50" : "#444"}`,
              borderRadius: 4,
              background: config.fontWeight !== false ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
              color: config.fontWeight !== false ? "#a5d6a7" : "#ccc",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Bold
          </button>
        </div>
      </div>

      {/* ── Font Style toggle ──────────────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Font Style
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={() => onChange({ fontStyle: false })}
            style={{
              flex: 1,
              padding: "6px 12px",
              border: `1px solid ${config.fontStyle !== true ? "#4CAF50" : "#444"}`,
              borderRadius: 4,
              background: config.fontStyle !== true ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
              color: config.fontStyle !== true ? "#a5d6a7" : "#ccc",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Normal
          </button>
          <button
            onClick={() => onChange({ fontStyle: true })}
            style={{
              flex: 1,
              padding: "6px 12px",
              border: `1px solid ${config.fontStyle === true ? "#4CAF50" : "#444"}`,
              borderRadius: 4,
              background: config.fontStyle === true ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
              color: config.fontStyle === true ? "#a5d6a7" : "#ccc",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Italic
          </button>
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

      {/* ── Line Height (D-09, PREV-03) ──────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Line Height: <strong style={{ color: "#fff" }}>{config.lineHeight ?? 1.3}</strong>
        </label>
        <input
          type="range"
          min={0.8}
          max={3}
          step={0.1}
          value={config.lineHeight ?? 1.3}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#4CAF50" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
          <span>0.8</span>
          <span>3.0</span>
        </div>
      </div>

      {/* ── Past Word Opacity (D-07, PREV-03) ──────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Past Word Opacity: <strong style={{ color: "#fff" }}>{config.pastWordOpacity ?? 0.4}</strong>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.pastWordOpacity ?? 0.4}
          onChange={(e) => onChange({ pastWordOpacity: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#4CAF50" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
          <span>0</span>
          <span>1</span>
        </div>
      </div>

      {/* ── Highlight Duration ─────────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Highlight Duration: <strong style={{ color: "#fff" }}>{config.highlightDurationMs ?? 200}ms</strong>
        </label>
        <input
          type="range"
          min={0}
          max={500}
          step={10}
          value={config.highlightDurationMs ?? 200}
          onChange={(e) => onChange({ highlightDurationMs: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#4CAF50" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
          <span>0ms (off)</span>
          <span>500ms</span>
        </div>
      </div>

      {/* ── Highlight Transition ───────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Highlight Transition
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onChange({ highlightTransition: "fade" })}
            style={{
              flex: 1,
              padding: "6px 12px",
              border: `1px solid ${(config.highlightTransition ?? "fade") === "fade" ? "#4CAF50" : "#444"}`,
              borderRadius: 4,
              background: (config.highlightTransition ?? "fade") === "fade" ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
              color: (config.highlightTransition ?? "fade") === "fade" ? "#a5d6a7" : "#ccc",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Fade
          </button>
          <button
            onClick={() => onChange({ highlightTransition: "instant" })}
            style={{
              flex: 1,
              padding: "6px 12px",
              border: `1px solid ${config.highlightTransition === "instant" ? "#4CAF50" : "#444"}`,
              borderRadius: 4,
              background: config.highlightTransition === "instant" ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
              color: config.highlightTransition === "instant" ? "#a5d6a7" : "#ccc",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Instant
          </button>
        </div>
      </div>

      {/* ── Bottom Offset (PREV-03) ────────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Bottom Offset: <strong style={{ color: "#fff" }}>{config.bottomOffset ?? 250}px</strong>
        </label>
        <input
          type="range"
          min={0}
          max={960}
          step={10}
          value={config.bottomOffset ?? 250}
          onChange={(e) => onChange({ bottomOffset: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#4CAF50" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
          <span>0px</span>
          <span>960px</span>
        </div>
      </div>

      {/* ── Subtitle Width ────────────────────────────────────── */}
      <div>
        <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
          Subtitle Width: <strong style={{ color: "#fff" }}>{(config.subtitleWidth ?? 0) || "auto"}</strong>
        </label>
        <input
          type="range"
          min={0}
          max={1080}
          step={10}
          value={config.subtitleWidth ?? 0}
          onChange={(e) => onChange({ subtitleWidth: Number(e.target.value) })}
          style={{ width: "100%", accentColor: "#4CAF50" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
          <span>0 (auto)</span>
          <span>1080px</span>
        </div>
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

      {/* ── Outer Glow (Phase 19, TYPO-04) ──────────────────────────────── */}
      <div style={{
        padding: "12px 16px",
        background: "#1e1e2e",
        borderRadius: 8,
        border: "1px solid #333",
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={glow.enabled}
            onChange={(e) => onChange({ outerGlow: { ...glow, enabled: e.target.checked } })}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>Outer Glow</span>
        </label>

        {glow.enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: 24 }}>
            {/* Glow Color */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <label style={{ fontSize: 12, color: "#999" }}>Glow Color</label>
              <input
                type="color"
                value={glow.color}
                onChange={(e) => onChange({ outerGlow: { ...glow, color: e.target.value } })}
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
              <span style={{ fontSize: 11, color: "#666" }}>{glow.color}</span>
            </div>

            {/* Intensity slider */}
            <div>
              <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 4 }}>
                Intensity: {glow.intensity}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={glow.intensity}
                onChange={(e) => onChange({ outerGlow: { ...glow, intensity: Number(e.target.value) } })}
                style={{ width: "100%", accentColor: "#4CAF50" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
                <span>0</span>
                <span>1</span>
              </div>
            </div>

            {/* Softness slider */}
            <div>
              <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 4 }}>
                Softness: {glow.softness}px
              </label>
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={glow.softness}
                onChange={(e) => onChange({ outerGlow: { ...glow, softness: Number(e.target.value) } })}
                style={{ width: "100%", accentColor: "#4CAF50" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
                <span>0px</span>
                <span>60px</span>
              </div>
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