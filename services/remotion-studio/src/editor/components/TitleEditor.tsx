// ─── TitleEditor: Title overlay editor (D-12, D-16) ────────────────────────────
// Per D-12: Titles array in pipeline-config.json with text, subtitle, startTimeMs, durationMs, style
// Per D-16: Config editor UI for adding/editing/removing title overlays
// Per T-06-12: XSS prevention — sanitize title text before rendering

import React, { useState } from "react";
import type { TitleConfig, TitleEntranceAnimation } from "../../pipeline-config.js";
import { AVAILABLE_FONTS } from "../../fonts.js";

interface TitleEditorProps {
  titles: TitleConfig[];
  onChange: (titles: TitleConfig[]) => void;
}

const ENTRANCE_ANIMATIONS: { id: TitleEntranceAnimation; label: string }[] = [
  { id: "slide-up", label: "Slide Up" },
  { id: "slide-down", label: "Slide Down" },
  { id: "fade-in", label: "Fade In" },
  { id: "none", label: "None" },
];

// Monospace is a system fallback and not suitable for title overlays
const FONT_OPTIONS = AVAILABLE_FONTS.filter(f => f !== "monospace");

const DEFAULT_TITLE_STYLE = {
  entranceAnimation: "slide-up" as TitleEntranceAnimation,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  textColor: "#FFFFFF",
  titleFontSize: 72,
  subtitleFontSize: 42,
  titleColor: "#FFFFFF",
  subtitleColor: "#FFFFFF",
  titleFontFamily: "PlusJakartaSans",
  subtitleFontFamily: "PlusJakartaSans",
  topOffset: 50,
  lineHeight: 1.2,
  padding: 40,
};

function rgbaToHex(rgba: string): string {
  const match = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/);
  if (!match) return "#000000";
  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function rgbaToAlpha(rgba: string): number {
  const match = rgba.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+))?\)/);
  if (!match) return 1;
  return match[1] !== undefined ? parseFloat(match[1]) : 1;
}

function hexAndAlphaToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function TitleEditor({ titles, onChange }: TitleEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  // ── New title form state ─────────────────────────────────────────────────
  const [newTitle, setNewTitle] = useState<Partial<TitleConfig>>({
    text: "",
    subtitle: "",
    startTimeMs: 0,
    durationMs: 3000,
    style: { ...DEFAULT_TITLE_STYLE },
  });

  const resetForm = () => {
    setNewTitle({
      text: "",
      subtitle: "",
      startTimeMs: 0,
      durationMs: 3000,
      style: { ...DEFAULT_TITLE_STYLE },
    });
    setAddingNew(false);
    setEditingIndex(null);
  };

  // ── Add title ─────────────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!newTitle.text?.trim()) return;

    const title: TitleConfig = {
      text: newTitle.text,
      subtitle: newTitle.subtitle || undefined,
      startTimeMs: newTitle.startTimeMs ?? 0,
      durationMs: newTitle.durationMs ?? 3000,
      style: newTitle.style,
    };

    const updated = [...titles, title];
    onChange(updated);
    resetForm();
  };

  // ── Remove title ──────────────────────────────────────────────────────────
  const handleRemove = (index: number) => {
    const updated = titles.filter((_, i) => i !== index);
    onChange(updated);
    if (editingIndex === index) {
      // Removed the entry currently being edited — cancel the form.
      resetForm();
    } else if (editingIndex !== null && index < editingIndex) {
      // A preceding entry was removed; shift the editing index down by one so
      // handleSaveEdit writes to the correct slot after the array shrinks.
      setEditingIndex(editingIndex - 1);
    }
  };

  // ── Edit existing title ───────────────────────────────────────────────────
  const handleStartEdit = (index: number) => {
    const title = titles[index];
    setNewTitle({
      text: title.text,
      subtitle: title.subtitle ?? "",
      startTimeMs: title.startTimeMs,
      durationMs: title.durationMs,
      style: title.style ? { ...title.style } : { ...DEFAULT_TITLE_STYLE },
    });
    setEditingIndex(index);
    setAddingNew(false);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !newTitle.text?.trim()) return;

    const updated = [...titles];
    updated[editingIndex] = {
      text: newTitle.text,
      subtitle: newTitle.subtitle || undefined,
      startTimeMs: newTitle.startTimeMs ?? 0,
      durationMs: newTitle.durationMs ?? 3000,
      style: newTitle.style,
    };

    onChange(updated);
    resetForm();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Title list ─────────────────────────────────────────────────── */}
      {titles.length === 0 && !addingNew && editingIndex === null && (
        <p style={{ fontSize: 13, color: "#666", fontStyle: "italic" }}>No title overlays configured. Click "Add Title" to create one.</p>
      )}

      {titles.map((title, i) => {
        if (editingIndex === i) return null; // editing this one, show form below
        return (
          <div
            key={i}
            style={{
              padding: "12px 16px",
              background: "#1e1e2e",
              borderRadius: 8,
              border: "1px solid #333",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#e0e0e0" }}>{title.text}</div>
              {title.subtitle && (
                <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{title.subtitle}</div>
              )}
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                {(title.startTimeMs / 1000).toFixed(1)}s → {(title.startTimeMs / 1000 + title.durationMs / 1000).toFixed(1)}s ({title.durationMs}ms)
                {title.style?.entranceAnimation && title.style.entranceAnimation !== "none" && (
                  <span style={{ marginLeft: 8, color: "#4CAF50" }}>
                    {title.style.entranceAnimation}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleStartEdit(i)}
                style={{ padding: "4px 10px", background: "#333", color: "#ccc", border: "1px solid #555", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
              >
                Edit
              </button>
              <button
                onClick={() => handleRemove(i)}
                style={{ padding: "4px 10px", background: "#b71c1c", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Add/edit form ──────────────────────────────────────────────── */}
      {(addingNew || editingIndex !== null) && (
        <div style={{
          padding: 16,
          background: "#16213e",
          borderRadius: 8,
          border: "1px solid #4CAF50",
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#a5d6a7", marginBottom: 12 }}>
            {editingIndex !== null ? "Edit Title" : "Add Title"}
          </h3>

          {/* Title text (required) */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
              Title Text *
            </label>
            <input
              type="text"
              value={newTitle.text ?? ""}
              onChange={(e) => setNewTitle((prev) => ({ ...prev, text: e.target.value }))}
              placeholder="e.g. Welcome to My Channel"
              style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
            />
          </div>

          {/* Subtitle (optional) */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
              Subtitle (optional)
            </label>
            <input
              type="text"
              value={newTitle.subtitle ?? ""}
              onChange={(e) => setNewTitle((prev) => ({ ...prev, subtitle: e.target.value }))}
              placeholder="e.g. Episode 42"
              style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
            />
          </div>

          {/* Timing: seconds displayed, milliseconds stored */}
          <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
                Start Time (seconds)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={(newTitle.startTimeMs ?? 0) / 1000}
                onChange={(e) => setNewTitle((prev) => ({ ...prev, startTimeMs: Math.round(Number(e.target.value) * 1000) }))}
                style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
                Duration (seconds)
              </label>
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={(newTitle.durationMs ?? 3000) / 1000}
                onChange={(e) => setNewTitle((prev) => ({ ...prev, durationMs: Math.round(Number(e.target.value) * 1000) }))}
                style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
              />
            </div>
          </div>

          {/* Title style (D-11) */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
              Entrance Animation
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {ENTRANCE_ANIMATIONS.map((anim) => {
                const isSelected = (newTitle.style?.entranceAnimation ?? "slide-up") === anim.id;
                return (
                  <button
                    key={anim.id}
                    onClick={() => setNewTitle((prev) => ({
                      ...prev,
                      style: { ...prev.style!, entranceAnimation: anim.id },
                    }))}
                    style={{
                      flex: 1,
                      padding: "6px 12px",
                      border: `1px solid ${isSelected ? "#4CAF50" : "#444"}`,
                      borderRadius: 4,
                      background: isSelected ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
                      color: isSelected ? "#a5d6a7" : "#ccc",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {anim.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style colors */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <label style={{ fontSize: 12, color: "#999" }}>Background</label>
              <input
                type="color"
                value={rgbaToHex(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)")}
                onChange={(e) => {
                  const alpha = rgbaToAlpha(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)");
                  setNewTitle((prev) => ({
                    ...prev,
                    style: { ...prev.style!, backgroundColor: hexAndAlphaToRgba(e.target.value, alpha) },
                  }));
                }}
                style={{ width: 48, height: 36, border: "1px solid #444", borderRadius: 4, padding: 2, background: "#2a2a3e", cursor: "pointer" }}
              />
              <label style={{ fontSize: 10, color: "#777" }}>Opacity</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={rgbaToAlpha(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)")}
                onChange={(e) => {
                  const hex = rgbaToHex(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)");
                  setNewTitle((prev) => ({
                    ...prev,
                    style: { ...prev.style!, backgroundColor: hexAndAlphaToRgba(hex, parseFloat(e.target.value)) },
                  }));
                }}
                style={{ width: 48 }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <label style={{ fontSize: 12, color: "#999" }}>Title Color</label>
              <input
                type="color"
                value={newTitle.style?.titleColor ?? newTitle.style?.textColor ?? "#FFFFFF"}
                onChange={(e) => setNewTitle((prev) => ({
                  ...prev,
                  style: { ...prev.style!, titleColor: e.target.value },
                }))}
                style={{ width: 48, height: 36, border: "1px solid #444", borderRadius: 4, padding: 2, background: "#2a2a3e", cursor: "pointer" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <label style={{ fontSize: 12, color: "#999" }}>Subtitle Color</label>
              <input
                type="color"
                value={newTitle.style?.subtitleColor ?? newTitle.style?.textColor ?? "#FFFFFF"}
                onChange={(e) => setNewTitle((prev) => ({
                  ...prev,
                  style: { ...prev.style!, subtitleColor: e.target.value },
                }))}
                style={{ width: 48, height: 36, border: "1px solid #444", borderRadius: 4, padding: 2, background: "#2a2a3e", cursor: "pointer" }}
              />
            </div>
          </div>

          {/* Font sizes */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
                Title Size: {newTitle.style?.titleFontSize ?? 72}
              </label>
              <input
                type="range"
                min={24}
                max={200}
                value={newTitle.style?.titleFontSize ?? 72}
                onChange={(e) => setNewTitle((prev) => ({
                  ...prev,
                  style: { ...prev.style!, titleFontSize: parseInt(e.target.value) },
                }))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
                <span>24</span>
                <span>200</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
                Subtitle Size: {newTitle.style?.subtitleFontSize ?? 42}
              </label>
              <input
                type="range"
                min={16}
                max={200}
                value={newTitle.style?.subtitleFontSize ?? 42}
                onChange={(e) => setNewTitle((prev) => ({
                  ...prev,
                  style: { ...prev.style!, subtitleFontSize: parseInt(e.target.value) },
                }))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
                <span>16</span>
                <span>200</span>
              </div>
            </div>
          </div>

          {/* Top offset */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
              Vertical Position (top %): {newTitle.style?.topOffset ?? 50}%
            </label>
            <input
              type="range"
              min={10}
              max={90}
              value={newTitle.style?.topOffset ?? 50}
              onChange={(e) => setNewTitle((prev) => ({
                ...prev,
                style: { ...prev.style!, topOffset: parseInt(e.target.value) },
              }))}
              style={{ width: "100%" }}
            />
          </div>

          {/* Line Height & Padding */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
                Line Height: {newTitle.style?.lineHeight ?? 1.2}
              </label>
              <input
                type="range"
                min={0.8}
                max={3}
                step={0.1}
                value={newTitle.style?.lineHeight ?? 1.2}
                onChange={(e) => setNewTitle((prev) => ({
                  ...prev,
                  style: { ...prev.style!, lineHeight: parseFloat(e.target.value) },
                }))}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
                Padding: {newTitle.style?.padding ?? 40}px
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={newTitle.style?.padding ?? 40}
                onChange={(e) => setNewTitle((prev) => ({
                  ...prev,
                  style: { ...prev.style!, padding: parseInt(e.target.value) },
                }))}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Font families */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
                Title Font
              </label>
              <select
                value={newTitle.style?.titleFontFamily ?? "PlusJakartaSans"}
                onChange={(e) => setNewTitle((prev) => ({
                  ...prev,
                  style: { ...prev.style!, titleFontFamily: e.target.value },
                }))}
                style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
                Subtitle Font
              </label>
              <select
                value={newTitle.style?.subtitleFontFamily ?? "PlusJakartaSans"}
                onChange={(e) => setNewTitle((prev) => ({
                  ...prev,
                  style: { ...prev.style!, subtitleFontFamily: e.target.value },
                }))}
                style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Font Weight toggle (Phase 19, TYPO-03) */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
              Font Weight
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => setNewTitle((prev) => ({ ...prev, style: { ...prev.style!, fontWeight: false } }))}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  border: `1px solid ${newTitle.style?.fontWeight === false ? "#4CAF50" : "#444"}`,
                  borderRadius: 4,
                  background: newTitle.style?.fontWeight === false ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
                  color: newTitle.style?.fontWeight === false ? "#a5d6a7" : "#ccc",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Regular
              </button>
              <button
                onClick={() => setNewTitle((prev) => ({ ...prev, style: { ...prev.style!, fontWeight: true } }))}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  border: `1px solid ${newTitle.style?.fontWeight !== false ? "#4CAF50" : "#444"}`,
                  borderRadius: 4,
                  background: newTitle.style?.fontWeight !== false ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
                  color: newTitle.style?.fontWeight !== false ? "#a5d6a7" : "#ccc",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Bold
              </button>
            </div>
          </div>

          {/* Font Style toggle (Phase 19, TYPO-03) */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
              Font Style
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => setNewTitle((prev) => ({ ...prev, style: { ...prev.style!, fontStyle: false } }))}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  border: `1px solid ${newTitle.style?.fontStyle !== true ? "#4CAF50" : "#444"}`,
                  borderRadius: 4,
                  background: newTitle.style?.fontStyle !== true ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
                  color: newTitle.style?.fontStyle !== true ? "#a5d6a7" : "#ccc",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Normal
              </button>
              <button
                onClick={() => setNewTitle((prev) => ({ ...prev, style: { ...prev.style!, fontStyle: true } }))}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  border: `1px solid ${newTitle.style?.fontStyle === true ? "#4CAF50" : "#444"}`,
                  borderRadius: 4,
                  background: newTitle.style?.fontStyle === true ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
                  color: newTitle.style?.fontStyle === true ? "#a5d6a7" : "#ccc",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Italic
              </button>
            </div>
          </div>

          {/* Outer Glow card (Phase 19, TYPO-04) */}
          {(() => {
            const titleGlow = newTitle.style?.outerGlow ?? {
              enabled: false,
              color: "#ffffff",
              intensity: 0.8,
              softness: 20,
            };
            return (
              <div style={{
                padding: "12px 16px",
                background: "#1e1e2e",
                borderRadius: 8,
                border: "1px solid #333",
                marginBottom: 12,
              }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={titleGlow.enabled}
                    onChange={(e) => setNewTitle((prev) => ({
                      ...prev,
                      style: { ...prev.style!, outerGlow: { ...titleGlow, enabled: e.target.checked } },
                    }))}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>Outer Glow</span>
                </label>

                {titleGlow.enabled && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: 24 }}>
                    {/* Glow Color */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                      <label style={{ fontSize: 12, color: "#999" }}>Glow Color</label>
                      <input
                        type="color"
                        value={titleGlow.color}
                        onChange={(e) => setNewTitle((prev) => ({
                          ...prev,
                          style: { ...prev.style!, outerGlow: { ...titleGlow, color: e.target.value } },
                        }))}
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
                      <span style={{ fontSize: 11, color: "#666" }}>{titleGlow.color}</span>
                    </div>

                    {/* Intensity slider */}
                    <div>
                      <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 4 }}>
                        Intensity: {titleGlow.intensity}
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={titleGlow.intensity}
                        onChange={(e) => setNewTitle((prev) => ({
                          ...prev,
                          style: { ...prev.style!, outerGlow: { ...titleGlow, intensity: Number(e.target.value) } },
                        }))}
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
                        Softness: {titleGlow.softness}px
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={1}
                        value={titleGlow.softness}
                        onChange={(e) => setNewTitle((prev) => ({
                          ...prev,
                          style: { ...prev.style!, outerGlow: { ...titleGlow, softness: Number(e.target.value) } },
                        }))}
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
            );
          })()}

          {/* Form actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={editingIndex !== null ? handleSaveEdit : handleAdd}
              disabled={!newTitle.text?.trim()}
              style={{
                padding: "8px 16px",
                background: newTitle.text?.trim() ? "#4CAF50" : "#555",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: newTitle.text?.trim() ? "pointer" : "not-allowed",
                fontSize: 13,
              }}
            >
              {editingIndex !== null ? "Save Changes" : "Add Title"}
            </button>
            <button
              onClick={resetForm}
              style={{
                padding: "8px 16px",
                background: "#444",
                color: "#ccc",
                border: "1px solid #555",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Add title button (hidden when form is open) ────────────────── */}
      {!addingNew && editingIndex === null && (
        <button
          onClick={() => {
            setAddingNew(true);
            setNewTitle({
              text: "",
              subtitle: "",
              startTimeMs: 0,
              durationMs: 3000,
              style: { ...DEFAULT_TITLE_STYLE },
            });
          }}
          style={{
            padding: "10px 20px",
            background: "#2a2a3e",
            color: "#a5d6a7",
            border: "1px dashed #4CAF50",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          + Add Title
        </button>
      )}
    </div>
  );
}