// ─── OverlayEditor: PNG overlay editor — Phase 22 impeccable pass ────────────
// Phase 21 (OVERLAY-01/02/03): list + add/edit/delete for transparent PNG overlays.
//
// - Client-side 5 MB gate before FileReader (D-09, T-21-09).
// - MIME check (image/png) before FileReader (T-21-08).
// - Hard cap at 3 overlays (D-02, T-21-10) — Add trigger disabled past the cap.
// - Live preview via onPreviewChange on every draft field change (D-11).
// - imageData is a base64 data URL produced by FileReader; passed to the Player as
//   rawImageSrc by SubtitledVideo for browser preview.
// Phase 22: PositionPresets (px mode) in Posición section; Capa (Detrás|Delante)
//   layer control writing layer field (D-03); layer badges on overlay cards;
//   Posición→Estilo→Avanzado always-open sections; aria-labels; blue selection.

import React, { useRef, useState, useEffect } from "react";
import type { PngOverlayConfig } from "../../pipeline-config.js";
import { PositionPresets, computeOverlayElementHeight } from "./PositionPresets.js";

interface OverlayEditorProps {
  overlays: PngOverlayConfig[];
  onChange: (overlays: PngOverlayConfig[]) => void;
  onPreviewChange?: (liveOverlays: PngOverlayConfig[]) => void;
}

// Hard cap on simultaneous overlays (D-02).
const MAX_OVERLAYS = 3;

// Client-side upload gate: 5 MB (D-09 / T-21-09).
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// DEFAULT_OVERLAY — layer defaults to "back" (D-03: decorators behind text).
const DEFAULT_OVERLAY: PngOverlayConfig = {
  imageData: "",
  x: 40,
  y: 40,
  displayWidth: 200,
  opacity: 1,
  layer: "back",
};

// ─── Shared style helpers ──────────────────────────────────────────────────
// Color law (LOCKED): active = blue accent tokens; green is Render-CTA only.

function segBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "6px 12px",
    border: `1px solid ${active ? "var(--accent-strong, #6ba8e0)" : "var(--border, #333)"}`,
    borderRadius: "var(--r-xs, 4px)",
    background: active ? "var(--accent-tint, rgba(144,202,249,0.12))" : "var(--surface-2, #252535)",
    color: active ? "var(--accent, #90caf9)" : "var(--text-2, #a8a8b3)",
    cursor: "pointer",
    fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
    transition: "border-color var(--dur,170ms) var(--ease), background var(--dur,170ms) var(--ease), color var(--dur,170ms) var(--ease)",
  };
}

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)", marginBottom: "var(--s-5, 10px)" }}>
      <span style={{
        fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
        fontWeight: 600,
        color: "var(--text-muted, #777)",
        background: "var(--surface-2, #252535)",
        border: "1px solid var(--border, #333)",
        borderRadius: "var(--r-xs, 4px)",
        padding: "2px 5px",
        letterSpacing: "0.1em",
        textTransform: "uppercase" as React.CSSProperties["textTransform"],
        lineHeight: 1,
        flexShrink: 0,
      }}>{n}</span>
      <span style={{
        fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
        fontWeight: 600,
        color: "var(--text-muted, #777)",
        letterSpacing: "0.1em",
        textTransform: "uppercase" as React.CSSProperties["textTransform"],
        flexShrink: 0,
      }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border-faint, #2a2a38)" }} />
    </div>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
      color: "var(--text-2, #a8a8b3)",
      display: "block",
      marginBottom: "var(--s-2, 4px)",
    }}>{children}</label>
  );
}

// ─── Layer badge (read-only card indicator) ────────────────────────────────
// Detrás: muted; Delante: blue (UI-SPEC § Layer badge)

function LayerBadge({ layer }: { layer: "back" | "front" | undefined }) {
  const isFront = layer === "front";
  return (
    <span style={{
      fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
      fontWeight: 600,
      letterSpacing: "0.05em",
      padding: "2px 6px",
      borderRadius: "var(--r-full, 999px)",
      background: isFront ? "var(--accent-tint, rgba(144,202,249,0.12))" : "var(--surface-2, #252535)",
      color: isFront ? "var(--accent, #90caf9)" : "var(--text-muted, #777)",
      border: `1px solid ${isFront ? "var(--accent-strong, #6ba8e0)" : "var(--border, #333)"}`,
    }}>
      {isFront ? "Delante" : "Detrás"}
    </span>
  );
}

export function OverlayEditor({ overlays, onChange, onPreviewChange }: OverlayEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  // ── Draft form state ───────────────────────────────────────────────────────
  const [draft, setDraft] = useState<PngOverlayConfig>({ ...DEFAULT_OVERLAY });
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadHover, setUploadHover] = useState(false);

  // ── Natural image dimensions (runtime-only, NOT persisted to config) ───────
  // Loaded lazily from draft.imageData so PositionPresets can use the real
  // aspect-ratio height instead of the displayWidth=height square fallback.
  const [natW, setNatW] = useState(0);
  const [natH, setNatH] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load natural pixel dimensions from imageData whenever it changes.
  // Runtime-only — never written to draft or saved config.
  useEffect(() => {
    if (!draft.imageData) {
      setNatW(0);
      setNatH(0);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setNatW(img.naturalWidth);
      setNatH(img.naturalHeight);
    };
    img.onerror = () => {
      setNatW(0);
      setNatH(0);
    };
    img.src = draft.imageData;
  }, [draft.imageData]);

  const resetForm = () => {
    setDraft({ ...DEFAULT_OVERLAY });
    setFileName(null);
    setFileError(null);
    setLoading(false);
    setAddingNew(false);
    setEditingIndex(null);
    setNatW(0);
    setNatH(0);
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
      setFileError("Archivo demasiado grande. Máximo 5 MB.");
      return;
    }
    if (file.type !== "image/png") {
      setFileError("Por favor selecciona un archivo PNG.");
      return;
    }

    setFileError(null);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setLoading(false);
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        setFileError("Error al leer el archivo. Inténtalo de nuevo.");
        return;
      }
      setFileName(file.name);
      handleDraftChange((prev) => ({ ...prev, imageData: dataUrl }));
    };
    reader.onerror = () => {
      setLoading(false);
      setFileError("Error al leer el archivo. Inténtalo de nuevo.");
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
      layer: ov.layer ?? "back",
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-6, 12px)" }}>
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
        <p style={{ fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)", fontStyle: "italic" }}>
          Sin overlays todavía. Haz clic en &quot;＋ Agregar overlay&quot; para añadir un logo o marca de agua.
        </p>
      )}

      {/* ── Overlay list ─────────────────────────────────────────────────── */}
      {overlays.map((ov, i) => {
        if (editingIndex === i) return null; // editing this one, form shows below
        return (
          <div
            key={i}
            style={{
              padding: "var(--s-6, 12px) var(--s-8, 16px)",
              background: "var(--surface, #1e1e2e)",
              borderRadius: "var(--r-md, 8px)",
              border: "1px solid var(--border, #333)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)", marginBottom: "var(--s-2, 4px)" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], color: "var(--text, #e6e6ea)" }}>
                  Overlay {i + 1}
                </div>
                {/* Read-only layer badge */}
                <LayerBadge layer={ov.layer} />
              </div>
              <div style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-muted, #777)" }}>
                x: {ov.x}, y: {ov.y}, ancho: {ov.displayWidth}px
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--s-4, 8px)", flexShrink: 0, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => handleStartEdit(i)}
                style={{
                  padding: "4px 10px",
                  background: "var(--surface-2, #252535)",
                  color: "var(--text-2, #a8a8b3)",
                  border: "1px solid var(--border, #333)",
                  borderRadius: "var(--r-xs, 4px)",
                  cursor: "pointer",
                  fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"],
                }}
              >
                Editar
              </button>
              {/* Icon-only delete — 44×44px touch target (WCAG 2.5.5) with Spanish aria-label */}
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: -8 }}>
                <button
                  aria-label="Eliminar overlay"
                  type="button"
                  onClick={() => handleRemove(i)}
                  style={{
                    width: 32,
                    height: 32,
                    display: "grid",
                    placeItems: "center",
                    background: "transparent",
                    color: "var(--danger, #e57373)",
                    border: "1px solid transparent",
                    borderRadius: "var(--r-xs, 4px)",
                    cursor: "pointer",
                    fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
                    transition: "background var(--dur,170ms) var(--ease), border-color var(--dur,170ms) var(--ease)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(229,115,115,0.12)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--danger, #e57373)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Add/edit form ──────────────────────────────────────────────── */}
      {formOpen && (
        <div style={{
          padding: "var(--s-8, 16px)",
          background: "var(--surface, #1e1e2e)",
          borderRadius: "var(--r-md, 8px)",
          border: "1px solid var(--accent-strong, #6ba8e0)",
        }}>
          <h3 style={{ fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], fontWeight: 600, color: "var(--text, #e6e6ea)", marginBottom: "var(--s-6, 12px)" }}>
            {editingIndex !== null ? "Editar overlay" : "Agregar overlay"}
          </h3>

          {/* ─────────────────────────────────────────────────────────────
              § 1  POSICIÓN — X/Y inputs + PositionPresets (px mode, D-07/D-09)
          ───────────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: "var(--s-8, 16px)" }}>
            <SectionHeader n={1} title="Posición" />

            {/* X/Y number inputs */}
            <div style={{ display: "flex", gap: "var(--s-8, 16px)", marginBottom: "var(--s-5, 10px)" }}>
              <div style={{ flex: 1 }}>
                <RowLabel>X (px)</RowLabel>
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
                  style={{ width: "100%", padding: "6px 8px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"] }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <RowLabel>Y (px)</RowLabel>
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
                  style={{ width: "100%", padding: "6px 8px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"] }}
                />
              </div>
            </div>

            {/* PositionPresets px mode — real aspect-ratio height once natural dims are known */}
            <div>
              <RowLabel>Preset de posición</RowLabel>
              <PositionPresets
                elementWidth={draft.displayWidth}
                elementHeight={computeOverlayElementHeight(draft.displayWidth, natW, natH)}
                onApply={(x, y) => handleDraftChange((prev) => ({ ...prev, x, y }))}
              />
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              § 2  ESTILO — PNG upload, width, opacity, Capa layer control
          ───────────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: "var(--s-8, 16px)" }}>
            <SectionHeader n={2} title="Estilo" />

            {/* PNG upload zone / selected-file state */}
            <div style={{ marginBottom: "var(--s-5, 10px)" }}>
              <RowLabel>Imagen PNG</RowLabel>

              {!draft.imageData ? (
                <div
                  onClick={() => !loading && fileInputRef.current?.click()}
                  onMouseEnter={() => setUploadHover(true)}
                  onMouseLeave={() => setUploadHover(false)}
                  style={{
                    minHeight: 44,
                    background: "var(--surface-2, #252535)",
                    border: `1px dashed ${uploadHover ? "var(--accent-strong, #6ba8e0)" : "var(--border, #333)"}`,
                    borderRadius: "var(--r-sm, 6px)",
                    padding: "var(--s-8, 16px)",
                    textAlign: "center",
                    cursor: loading ? "wait" : "pointer",
                    transition: "border-color var(--dur,170ms) var(--ease)",
                  }}
                >
                  {loading ? (
                    <div style={{ fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)" }}>Cargando...</div>
                  ) : (
                    <>
                      <div style={{ fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"], color: "var(--text, #e6e6ea)" }}>Haz clic para seleccionar un PNG</div>
                      <div style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-muted, #777)", marginTop: "var(--s-2, 4px)" }}>Máx. 5 MB · Solo PNG</div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--s-6, 12px)" }}>
                  <img
                    src={draft.imageData}
                    alt="Vista previa del overlay"
                    style={{ width: 120, height: "auto", background: "var(--surface-2, #252535)", borderRadius: "var(--r-xs, 4px)", display: "block" }}
                  />
                  <div>
                    <div style={{ fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], color: "var(--text, #e6e6ea)", wordBreak: "break-all" }}>
                      {fileName ?? "PNG seleccionado"}
                    </div>
                    <span
                      onClick={() => !loading && fileInputRef.current?.click()}
                      style={{ fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"], color: "var(--accent, #90caf9)", cursor: "pointer", display: "inline-block", marginTop: "var(--s-2, 4px)" }}
                    >
                      {loading ? "Cargando..." : "Cambiar"}
                    </span>
                  </div>
                </div>
              )}

              {fileError && (
                <div style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--danger, #e57373)", marginTop: "var(--s-4, 8px)" }}>{fileError}</div>
              )}
            </div>

            {/* Display width */}
            <div style={{ marginBottom: "var(--s-5, 10px)" }}>
              <RowLabel>Ancho (px)</RowLabel>
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
                style={{ width: "100%", padding: "6px 8px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"] }}
              />
            </div>

            {/* Opacity slider */}
            <div style={{ marginBottom: "var(--s-5, 10px)" }}>
              <RowLabel>Opacidad: {(draft.opacity ?? 1).toFixed(2)}</RowLabel>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.opacity ?? 1}
                onChange={(e) => handleDraftChange((prev) => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>
                <span>0</span>
                <span>1</span>
              </div>
            </div>

            {/* Capa (layer) segmented control (D-03) — blue selection (color law) */}
            {/* Detrás = "back" (default, decorators behind text); Delante = "front" (above text) */}
            <div>
              <RowLabel>Capa</RowLabel>
              <div style={{ display: "flex", gap: "var(--s-4, 8px)" }}>
                <button
                  type="button"
                  onClick={() => handleDraftChange((prev) => ({ ...prev, layer: "back" }))}
                  style={segBtnStyle((draft.layer ?? "back") === "back")}
                >
                  Detrás
                </button>
                <button
                  type="button"
                  onClick={() => handleDraftChange((prev) => ({ ...prev, layer: "front" }))}
                  style={segBtnStyle(draft.layer === "front")}
                >
                  Delante
                </button>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              § 3  AVANZADO — no fields yet; section reserved for future props
              Always-open titled section — NOT an accordion (UI-SPEC L236-243)
          ───────────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: "var(--s-8, 16px)" }}>
            <SectionHeader n={3} title="Avanzado" />
            <p style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)", fontStyle: "italic" }}>
              Sin ajustes avanzados por ahora.
            </p>
          </div>

          {/* Form actions */}
          <div style={{ display: "flex", gap: "var(--s-4, 8px)" }}>
            <button
              type="button"
              onClick={editingIndex !== null ? handleSaveEdit : handleAdd}
              disabled={!canSubmit}
              style={{
                padding: "8px 16px",
                background: canSubmit ? "var(--accent-tint, rgba(144,202,249,0.12))" : "var(--surface-2, #252535)",
                color: canSubmit ? "var(--accent, #90caf9)" : "var(--text-muted, #777)",
                border: `1px solid ${canSubmit ? "var(--accent-strong, #6ba8e0)" : "var(--border, #333)"}`,
                borderRadius: "var(--r-sm, 6px)",
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
                fontWeight: 600,
              }}
            >
              {editingIndex !== null ? "Guardar cambios" : "Agregar overlay"}
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              style={{
                padding: "8px 16px",
                background: "var(--surface-2, #252535)",
                color: "var(--text-2, #a8a8b3)",
                border: "1px solid var(--border, #333)",
                borderRadius: "var(--r-sm, 6px)",
                cursor: "pointer",
                fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
              }}
            >
              Descartar cambios
            </button>
          </div>
        </div>
      )}

      {/* ── Add overlay trigger (hidden when form is open) ────────────────── */}
      {/* 3-overlay cap preserved: atCap disables the trigger */}
      {!formOpen && (
        <button
          type="button"
          onClick={() => {
            if (atCap) return;
            setAddingNew(true);
            setDraft({ ...DEFAULT_OVERLAY });
            setFileName(null);
            setFileError(null);
          }}
          disabled={atCap}
          title={atCap ? "Máximo de 3 overlays alcanzado" : undefined}
          style={{
            padding: "10px 20px",
            background: atCap ? "var(--surface-2, #252535)" : "var(--surface-2, #252535)",
            color: atCap ? "var(--text-faint, #555)" : "var(--text-2, #a8a8b3)",
            border: `1px dashed ${atCap ? "var(--border, #333)" : "var(--border-strong, #444)"}`,
            borderRadius: "var(--r-sm, 6px)",
            cursor: atCap ? "not-allowed" : "pointer",
            fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"],
            transition: "border-color var(--dur,170ms) var(--ease), color var(--dur,170ms) var(--ease)",
          }}
          onMouseEnter={(e) => {
            if (!atCap) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-strong, #6ba8e0)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--accent, #90caf9)";
            }
          }}
          onMouseLeave={(e) => {
            if (!atCap) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong, #444)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2, #a8a8b3)";
            }
          }}
        >
          {atCap ? "Máximo 3 overlays" : "＋ Agregar overlay"}
        </button>
      )}
    </div>
  );
}
