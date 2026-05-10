// ─── TitleEditor: Title overlay editor (D-12, D-16) ────────────────────────────
// Per D-12: Titles array in pipeline-config.json with text, subtitle, startTimeMs, durationMs, style
// Per D-16: Config editor UI for adding/editing/removing title overlays
// Per T-06-12: XSS prevention — sanitize title text before rendering

import React, { useState } from "react";
import type { TitleConfig, TitleEntranceAnimation } from "../../../pipeline-config.js";

interface TitleEditorProps {
  titles: TitleConfig[];
  onChange: (titles: TitleConfig[]) => void;
}

const ENTRANCE_ANIMATIONS: { id: TitleEntranceAnimation; label: string }[] = [
  { id: "slide-up", label: "Slide Up" },
  { id: "fade-in", label: "Fade In" },
  { id: "none", label: "None" },
];

const DEFAULT_TITLE_STYLE = {
  entranceAnimation: "slide-up" as TitleEntranceAnimation,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  textColor: "#FFFFFF",
};

/** Sanitize text for XSS prevention (T-06-12) */
function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

    onChange([...titles, title]);
    resetForm();
  };

  // ── Remove title ──────────────────────────────────────────────────────────
  const handleRemove = (index: number) => {
    const updated = titles.filter((_, i) => i !== index);
    onChange(updated);
    if (editingIndex === index) {
      resetForm();
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
      {titles.length === 0 && !addingNew && !editingIndex !== null && (
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
              <div style={{ fontWeight: 600, fontSize: 14, color: "#e0e0e0" }}>{sanitizeText(title.text)}</div>
              {title.subtitle && (
                <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{sanitizeText(title.subtitle)}</div>
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
                value={newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)"}
                onChange={(e) => setNewTitle((prev) => ({
                  ...prev,
                  style: { ...prev.style!, backgroundColor: e.target.value },
                }))}
                style={{ width: 48, height: 36, border: "1px solid #444", borderRadius: 4, padding: 2, background: "#2a2a3e", cursor: "pointer" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <label style={{ fontSize: 12, color: "#999" }}>Text Color</label>
              <input
                type="color"
                value={newTitle.style?.textColor ?? "#FFFFFF"}
                onChange={(e) => setNewTitle((prev) => ({
                  ...prev,
                  style: { ...prev.style!, textColor: e.target.value },
                }))}
                style={{ width: 48, height: 36, border: "1px solid #444", borderRadius: 4, padding: 2, background: "#2a2a3e", cursor: "pointer" }}
              />
            </div>
          </div>

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