// ─── OverlayEditor: PNG overlay editor (Phase 21 — OVERLAY-01/02/03) ──────────
// Mirrors TitleEditor.tsx structure, state machine, and inline-style conventions
// exactly (D-07). List + add/edit/delete form for transparent PNG overlays.
//
// - Client-side 5 MB gate before FileReader (D-09, T-21-09).
// - MIME check (image/png) before FileReader (T-21-08).
// - Hard cap at 3 overlays (D-02, T-21-10) — Add trigger disabled past the cap.
// - Live preview via onPreviewChange on every draft field change (D-11).
// - imageData is a base64 data URL produced by FileReader; passed to the Player as
//   rawImageSrc by SubtitledVideo for browser preview.

import React, { useRef, useState } from "react";
import type { PngOverlayConfig } from "../../pipeline-config.js";

interface OverlayEditorProps {
  overlays: PngOverlayConfig[];
  onChange: (overlays: PngOverlayConfig[]) => void;
  onPreviewChange?: (liveOverlays: PngOverlayConfig[]) => void;
}

// Hard cap on simultaneous overlays (D-02).
const MAX_OVERLAYS = 3;

// Client-side upload gate: 5 MB (D-09 / T-21-09).
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const DEFAULT_OVERLAY: PngOverlayConfig = {
  imageData: "",
  x: 40,
  y: 40,
  displayWidth: 200,
  opacity: 1,
};

export function OverlayEditor({ overlays, onChange, onPreviewChange }: OverlayEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  // ── Draft form state ───────────────────────────────────────────────────────
  const [draft, setDraft] = useState<PngOverlayConfig>({ ...DEFAULT_OVERLAY });
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadHover, setUploadHover] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setDraft({ ...DEFAULT_OVERLAY });
    setFileName(null);
    setFileError(null);
    setLoading(false);
    setAddingNew(false);
    setEditingIndex(null);
  };

  // Compute preview overlays by merging the current draft into the committed list.
  // The draft only joins the preview once it has image data (D-11).
  const computeLiveOverlays = (next: PngOverlayConfig): PngOverlayConfig[] => {
    if (editingIndex !== null) {
      const live = [...overlays];
      live[editingIndex] = next;
      return live;
    }
    if (addingNew && next.imageData) {
      return [...overlays, next];
    }
    return overlays;
  };

  // Update local draft AND emit live preview to parent (mirrors handleDraftChange).
  const handleDraftChange = (updater: (prev: PngOverlayConfig) => PngOverlayConfig) => {
    const updated = updater(draft);
    setDraft(updated);
    onPreviewChange?.(computeLiveOverlays(updated));
  };

  // ── File selection: size gate → MIME gate → FileReader → data URL ───────────
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file still fires onChange.
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setFileError("File too large. Maximum size is 5 MB.");
      return;
    }
    if (file.type !== "image/png") {
      setFileError("Please select a PNG file.");
      return;
    }

    setFileError(null);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setLoading(false);
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        setFileError("Failed to read file. Please try again.");
        return;
      }
      setFileName(file.name);
      handleDraftChange((prev) => ({ ...prev, imageData: dataUrl }));
    };
    reader.onerror = () => {
      setLoading(false);
      setFileError("Failed to read file. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  // ── Add overlay ──────────────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!draft.imageData) return;
    const updated = [...overlays, draft];
    onChange(updated);
    onPreviewChange?.(updated);
    resetForm();
  };

  // ── Remove overlay ────────────────────────────────────────────────────────────
  const handleRemove = (index: number) => {
    const updated = overlays.filter((_, i) => i !== index);
    onChange(updated);
    onPreviewChange?.(updated);
    if (editingIndex === index) {
      resetForm();
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
  };

  // ── Edit existing overlay ───────────────────────────────────────────────────
  const handleStartEdit = (index: number) => {
    const ov = overlays[index];
    setDraft({
      imageData: ov.imageData,
      x: ov.x,
      y: ov.y,
      displayWidth: ov.displayWidth,
      opacity: ov.opacity ?? 1,
      ...(ov._resolvedFile ? { _resolvedFile: ov._resolvedFile } : {}),
    });
    setFileName(null);
    setFileError(null);
    setEditingIndex(index);
    setAddingNew(false);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !draft.imageData) return;
    const updated = [...overlays];
    updated[editingIndex] = draft;
    onChange(updated);
    onPreviewChange?.(updated);
    resetForm();
  };

  const handleDiscard = () => {
    onPreviewChange?.(overlays);
    resetForm();
  };

  const formOpen = addingNew || editingIndex !== null;
  const atCap = overlays.length >= MAX_OVERLAYS;
  const canSubmit = !!draft.imageData;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Hidden native file input — driven by the upload zone label / Change link */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        onChange={handleFileSelected}
        style={{ display: "none" }}
      />

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {overlays.length === 0 && !formOpen && (
        <p style={{ fontSize: 12, color: "#666", fontStyle: "italic" }}>
          No PNG overlays configured. Click &quot;Add Overlay&quot; to add a logo or watermark.
        </p>
      )}

      {/* ── Overlay list ─────────────────────────────────────────────────── */}
      {overlays.map((ov, i) => {
        if (editingIndex === i) return null; // editing this one, form shows below
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
              <div style={{ fontWeight: 600, fontSize: 14, color: "#e0e0e0" }}>
                Overlay {i + 1}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                x: {ov.x}, y: {ov.y}, width: {ov.displayWidth}px
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
      {formOpen && (
        <div style={{
          padding: 16,
          background: "#16213e",
          borderRadius: 8,
          border: "1px solid #4CAF50",
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#a5d6a7", marginBottom: 12 }}>
            {editingIndex !== null ? "Edit Overlay" : "Add Overlay"}
          </h3>

          {/* 1. PNG upload zone / selected-file state */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
              PNG Image
            </label>

            {!draft.imageData ? (
              <div
                onClick={() => !loading && fileInputRef.current?.click()}
                onMouseEnter={() => setUploadHover(true)}
                onMouseLeave={() => setUploadHover(false)}
                style={{
                  minHeight: 44,
                  background: "#2a2a3e",
                  border: `1px dashed ${uploadHover ? "#4CAF50" : "#444"}`,
                  borderRadius: 6,
                  padding: 16,
                  textAlign: "center",
                  cursor: loading ? "wait" : "pointer",
                  transition: "border-color 0.15s",
                }}
              >
                {loading ? (
                  <div style={{ fontSize: 12, color: "#aaa" }}>Loading...</div>
                ) : (
                  <>
                    <div style={{ fontSize: 14, color: "#e0e0e0" }}>Click to select a PNG file</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Max 5 MB · PNG only</div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={draft.imageData}
                  alt="Overlay preview"
                  style={{ width: 120, height: "auto", background: "#2a2a3e", borderRadius: 4, display: "block" }}
                />
                <div>
                  <div style={{ fontSize: 14, color: "#e0e0e0", wordBreak: "break-all" }}>
                    {fileName ?? "Selected PNG"}
                  </div>
                  <span
                    onClick={() => !loading && fileInputRef.current?.click()}
                    style={{ fontSize: 12, color: "#90caf9", cursor: "pointer", display: "inline-block", marginTop: 4 }}
                  >
                    {loading ? "Loading..." : "Change"}
                  </span>
                </div>
              </div>
            )}

            {fileError && (
              <div style={{ fontSize: 12, color: "#ef9a9a", marginTop: 8 }}>{fileError}</div>
            )}
          </div>

          {/* 2. X / Y position inputs */}
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
                X (px)
              </label>
              <input
                type="number"
                min={0}
                max={1080}
                step={1}
                value={draft.x}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (isNaN(val)) return;
                  handleDraftChange((prev) => ({ ...prev, x: val }));
                }}
                style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
                Y (px)
              </label>
              <input
                type="number"
                min={0}
                max={1920}
                step={1}
                value={draft.y}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (isNaN(val)) return;
                  handleDraftChange((prev) => ({ ...prev, y: val }));
                }}
                style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
              />
            </div>
          </div>

          {/* 3. Display width */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
              Width (px)
            </label>
            <input
              type="number"
              min={10}
              max={1080}
              step={1}
              value={draft.displayWidth}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (isNaN(val)) return;
                handleDraftChange((prev) => ({ ...prev, displayWidth: val }));
              }}
              style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
            />
          </div>

          {/* 4. Opacity slider */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
              Opacity: {(draft.opacity ?? 1).toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={draft.opacity ?? 1}
              onChange={(e) => handleDraftChange((prev) => ({ ...prev, opacity: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: "#4CAF50" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666" }}>
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* 5. Form actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={editingIndex !== null ? handleSaveEdit : handleAdd}
              disabled={!canSubmit}
              style={{
                padding: "8px 16px",
                background: canSubmit ? "#4CAF50" : "#555",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontSize: 13,
              }}
            >
              {editingIndex !== null ? "Save Changes" : "Add Overlay"}
            </button>
            <button
              onClick={handleDiscard}
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
              Discard Changes
            </button>
          </div>
        </div>
      )}

      {/* ── Add overlay trigger (hidden when form is open) ────────────────── */}
      {!formOpen && (
        <button
          onClick={() => {
            if (atCap) return;
            setAddingNew(true);
            setDraft({ ...DEFAULT_OVERLAY });
            setFileName(null);
            setFileError(null);
          }}
          disabled={atCap}
          title={atCap ? "Maximum of 3 overlays reached" : undefined}
          style={{
            padding: "10px 20px",
            background: atCap ? "#555" : "#2a2a3e",
            color: atCap ? "#888" : "#a5d6a7",
            border: `1px dashed ${atCap ? "#555" : "#4CAF50"}`,
            borderRadius: 6,
            cursor: atCap ? "not-allowed" : "pointer",
            fontSize: 14,
          }}
        >
          + Add Overlay
        </button>
      )}
    </div>
  );
}
