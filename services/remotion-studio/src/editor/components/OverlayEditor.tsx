// ─── OverlayEditor: PNG overlay editor — Phase 26-04 dense 2-col layout ──────
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
//   Posición→Estilo always-open sections; aria-labels; blue selection.
// Phase 26-03: rf-form-grid className hook added to X/Y input row for @media reflow
// Phase 26-04: UICONV-01 — reorganize form into dense 2-col layout (sketch 019-C)
//              data-ctrl-2col attribute on the grid container for test assertions.

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
  imageData: "", x: 40, y: 40, displayWidth: 200, opacity: 1, layer: "back",
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

function SectionHeader({ n, title, note }: { n?: number; title: string; note?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-5, 10px)", marginBottom: "var(--s-6, 12px)" }}>
      {n !== undefined && (
        <span style={{
          width: 16, height: 16, display: "grid", placeItems: "center",
          fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
          fontWeight: 600, color: "var(--text-2, #a8a8b3)",
          background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)",
          borderRadius: "var(--r-xs, 4px)", flexShrink: 0,
        }}>{n}</span>
      )}
      <span style={{
        fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
        fontWeight: 700, color: "var(--text-muted, #777)",
        letterSpacing: "0.1em", textTransform: "uppercase" as React.CSSProperties["textTransform"],
        flexShrink: 0,
      }}>{title}</span>
      {note && (
        <span style={{
          fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
          fontWeight: 500, color: "var(--text-faint, #555)",
          textTransform: "none" as React.CSSProperties["textTransform"], letterSpacing: 0,
        }}>{note}</span>
      )}
      <div style={{ flex: 1, height: 1, background: "var(--border-faint, #2a2a38)" }} />
    </div>
  );
}

// ─── Dense labeled row — sketch 019 .row ─────────────────────────────────
// grid-template-columns: 78px 1fr; align-items: center; gap: var(--s-6); margin-bottom: var(--s-5)

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "78px 1fr",
      alignItems: "center", gap: "var(--s-6, 12px)", marginBottom: "var(--s-5, 10px)",
    }}>
      <label style={{ fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)" }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

function RangeRow({ label, min, max, step = 1, value, onChange, format }: {
  label: string; min: number; max: number; step?: number;
  value: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  return (
    <Row label={label}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 46px", alignItems: "center", gap: "var(--s-5, 10px)" }}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }} />
        <output style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
          {display}
        </output>
      </div>
    </Row>
  );
}

// ─── Layer badge (read-only card indicator) ────────────────────────────────

function LayerBadge({ layer }: { layer: "back" | "front" | undefined }) {
  const isFront = layer === "front";
  return (
    <span style={{
      fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
      fontWeight: 600, letterSpacing: "0.05em",
      padding: "2px 6px", borderRadius: "var(--r-full, 999px)",
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
  const [draft, setDraft] = useState<PngOverlayConfig>({ ...DEFAULT_OVERLAY });
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadHover, setUploadHover] = useState(false);
  const [natW, setNatW] = useState(0);
  const [natH, setNatH] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!draft.imageData) { setNatW(0); setNatH(0); return; }
    const img = new Image();
    img.onload = () => { setNatW(img.naturalWidth); setNatH(img.naturalHeight); };
    img.onerror = () => { setNatW(0); setNatH(0); };
    img.src = draft.imageData;
  }, [draft.imageData]);

  const resetForm = () => {
    setDraft({ ...DEFAULT_OVERLAY });
    setFileName(null); setFileError(null); setLoading(false);
    setAddingNew(false); setEditingIndex(null);
    setNatW(0); setNatH(0);
  };

  const computeLiveOverlays = (next: PngOverlayConfig): PngOverlayConfig[] => {
    if (editingIndex !== null) { const live = [...overlays]; live[editingIndex] = next; return live; }
    if (addingNew && next.imageData) return [...overlays, next];
    return overlays;
  };

  const handleDraftChange = (updater: (prev: PngOverlayConfig) => PngOverlayConfig) => {
    const updated = updater(draft);
    setDraft(updated);
    onPreviewChange?.(computeLiveOverlays(updated));
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setFileError("Archivo demasiado grande. Máximo 5 MB."); return; }
    if (file.type !== "image/png") { setFileError("Por favor selecciona un archivo PNG."); return; }
    setFileError(null); setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setLoading(false);
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) { setFileError("Error al leer el archivo. Inténtalo de nuevo."); return; }
      setFileName(file.name);
      handleDraftChange((prev) => ({ ...prev, imageData: dataUrl }));
    };
    reader.onerror = () => { setLoading(false); setFileError("Error al leer el archivo. Inténtalo de nuevo."); };
    reader.readAsDataURL(file);
  };

  const handleAdd = () => {
    if (!draft.imageData) return;
    const updated = [...overlays, draft];
    onChange(updated); onPreviewChange?.(updated); resetForm();
  };

  const handleRemove = (index: number) => {
    const updated = overlays.filter((_, i) => i !== index);
    onChange(updated); onPreviewChange?.(updated);
    if (editingIndex === index) resetForm();
    else if (editingIndex !== null && index < editingIndex) setEditingIndex(editingIndex - 1);
  };

  const handleStartEdit = (index: number) => {
    const ov = overlays[index];
    setDraft({
      imageData: ov.imageData, x: ov.x, y: ov.y,
      displayWidth: ov.displayWidth, opacity: ov.opacity ?? 1,
      layer: ov.layer ?? "back",
      ...(ov._resolvedFile ? { _resolvedFile: ov._resolvedFile } : {}),
    });
    setFileName(null); setFileError(null);
    setEditingIndex(index); setAddingNew(false);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !draft.imageData) return;
    const updated = [...overlays];
    updated[editingIndex] = draft;
    onChange(updated); onPreviewChange?.(updated); resetForm();
  };

  const handleDiscard = () => { onPreviewChange?.(overlays); resetForm(); };

  const formOpen = addingNew || editingIndex !== null;
  const atCap = overlays.length >= MAX_OVERLAYS;
  const canSubmit = !!draft.imageData;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-6, 12px)" }}>
      {/* Hidden native file input */}
      <input ref={fileInputRef} type="file" accept="image/png" onChange={handleFileSelected} style={{ display: "none" }} />

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {overlays.length === 0 && !formOpen && (
        <p style={{ fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)", fontStyle: "italic" }}>
          Sin overlays todavía. Haz clic en &quot;＋ Agregar overlay&quot; para añadir un logo o marca de agua.
        </p>
      )}

      {/* ── Overlay list — sketch 019-C lista protagonista ───────────────── */}
      {overlays.map((ov, i) => {
        if (editingIndex === i) return null;
        return (
          <div key={i} style={{
            padding: "var(--s-4, 8px) var(--s-5, 10px)",
            background: "var(--surface, #1e1e2e)",
            borderRadius: "var(--r-md, 8px)",
            border: "1px solid var(--border, #333)",
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)", marginBottom: "var(--s-1, 2px)" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], color: "var(--text, #e6e6ea)" }}>Overlay {i + 1}</div>
                <LayerBadge layer={ov.layer} />
              </div>
              <div style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-muted, #777)" }}>
                x: {ov.x}, y: {ov.y}, ancho: {ov.displayWidth}px
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--s-4, 8px)", flexShrink: 0, alignItems: "center" }}>
              <button type="button" onClick={() => handleStartEdit(i)} style={{
                padding: "4px 10px", background: "var(--surface-2, #252535)", color: "var(--text-2, #a8a8b3)",
                border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)",
                cursor: "pointer", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"],
              }}>Editar</button>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: -8 }}>
                <button aria-label="Eliminar overlay" type="button" onClick={() => handleRemove(i)} style={{
                  width: 32, height: 32, display: "grid", placeItems: "center",
                  background: "transparent", color: "var(--danger, #e57373)",
                  border: "1px solid transparent", borderRadius: "var(--r-xs, 4px)",
                  cursor: "pointer", fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
                  transition: "background var(--dur,170ms) var(--ease), border-color var(--dur,170ms) var(--ease)",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(229,115,115,0.12)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--danger, #e57373)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
                >✕</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Add/edit form — sketch 019-B 2-col dense layout ─────────────── */}
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

          {/* data-ctrl-2col: test hook for 2-column grid assertion */}
          <div
            data-ctrl-2col
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--s-6, 12px) var(--s-12, 24px)",
              alignItems: "start",
            }}
          >
            {/* ── LEFT: Posición ──────────────────────────────────────── */}
            <div data-colwrap="left" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <SectionHeader n={1} title="Posición" />

              {/* X/Y inputs — sketch 019 .xy */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-5, 10px)", marginBottom: "var(--s-5, 10px)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "14px 1fr", alignItems: "center", gap: "var(--s-3, 6px)", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-sm, 6px)", padding: "4px 8px" }}>
                  <span style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>X</span>
                  <input type="number" min={0} max={1080} step={1} value={draft.x}
                    onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) handleDraftChange((prev) => ({ ...prev, x: v })); }}
                    style={{ font: "inherit", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"], color: "var(--text, #e6e6ea)", background: "none", border: "none", width: "100%", fontVariantNumeric: "tabular-nums" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "14px 1fr", alignItems: "center", gap: "var(--s-3, 6px)", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-sm, 6px)", padding: "4px 8px" }}>
                  <span style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>Y</span>
                  <input type="number" min={0} max={1920} step={1} value={draft.y}
                    onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) handleDraftChange((prev) => ({ ...prev, y: v })); }}
                    style={{ font: "inherit", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"], color: "var(--text, #e6e6ea)", background: "none", border: "none", width: "100%", fontVariantNumeric: "tabular-nums" }} />
                </div>
              </div>

              {/* PositionPresets px mode */}
              <PositionPresets
                elementWidth={draft.displayWidth}
                elementHeight={computeOverlayElementHeight(draft.displayWidth, natW, natH)}
                onApply={(x, y) => handleDraftChange((prev) => ({ ...prev, x, y }))}
              />
            </div>

            {/* ── RIGHT: Estilo — PNG upload, width, opacity, capa ──────── */}
            <div data-colwrap="right" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <SectionHeader n={2} title="Estilo" />

              {/* PNG upload zone */}
              <div style={{ marginBottom: "var(--s-5, 10px)" }}>
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
                    <img src={draft.imageData} alt="Vista previa del overlay"
                      style={{ width: 80, height: "auto", background: "var(--surface-2, #252535)", borderRadius: "var(--r-xs, 4px)", display: "block" }} />
                    <div>
                      <div style={{ fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"], color: "var(--text, #e6e6ea)", wordBreak: "break-all" }}>{fileName ?? "PNG seleccionado"}</div>
                      <span onClick={() => !loading && fileInputRef.current?.click()}
                        style={{ fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"], color: "var(--accent, #90caf9)", cursor: "pointer", display: "inline-block", marginTop: "var(--s-2, 4px)" }}>
                        {loading ? "Cargando..." : "Cambiar"}
                      </span>
                    </div>
                  </div>
                )}
                {fileError && (
                  <div style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--danger, #e57373)", marginTop: "var(--s-4, 8px)" }}>{fileError}</div>
                )}
              </div>

              {/* Ancho */}
              <RangeRow label="Ancho px" min={24} max={540}
                value={draft.displayWidth}
                onChange={(v) => handleDraftChange((prev) => ({ ...prev, displayWidth: v }))}
              />

              {/* Opacidad */}
              <RangeRow label="Opacidad" min={0} max={1} step={0.05}
                value={draft.opacity ?? 1}
                onChange={(v) => handleDraftChange((prev) => ({ ...prev, opacity: v }))}
                format={(v) => v.toFixed(2)}
              />

              {/* Capa */}
              <Row label="Capa">
                <div style={{ display: "flex", gap: "var(--s-4, 8px)" }}>
                  <button type="button"
                    onClick={() => handleDraftChange((prev) => ({ ...prev, layer: "back" }))}
                    style={segBtnStyle((draft.layer ?? "back") === "back")}>Detrás</button>
                  <button type="button"
                    onClick={() => handleDraftChange((prev) => ({ ...prev, layer: "front" }))}
                    style={segBtnStyle(draft.layer === "front")}>Delante</button>
                </div>
              </Row>
            </div>
          </div>

          {/* Form actions */}
          <div style={{ display: "flex", gap: "var(--s-4, 8px)", marginTop: "var(--s-8, 16px)" }}>
            <button type="button"
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
            >{editingIndex !== null ? "Guardar cambios" : "Agregar overlay"}</button>
            <button type="button" onClick={handleDiscard} style={{
              padding: "8px 16px", background: "var(--surface-2, #252535)",
              color: "var(--text-2, #a8a8b3)", border: "1px solid var(--border, #333)",
              borderRadius: "var(--r-sm, 6px)", cursor: "pointer",
              fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
            }}>Descartar cambios</button>
          </div>
        </div>
      )}

      {/* ── Add overlay trigger ───────────────────────────────────────────── */}
      {!formOpen && (
        <button type="button"
          onClick={() => { if (atCap) return; setAddingNew(true); setDraft({ ...DEFAULT_OVERLAY }); setFileName(null); setFileError(null); }}
          disabled={atCap}
          title={atCap ? "Máximo de 3 overlays alcanzado" : undefined}
          style={{
            padding: "10px 20px",
            background: "var(--surface-2, #252535)",
            color: atCap ? "var(--text-faint, #555)" : "var(--text-2, #a8a8b3)",
            border: `1px dashed ${atCap ? "var(--border, #333)" : "var(--border-strong, #444)"}`,
            borderRadius: "var(--r-sm, 6px)",
            cursor: atCap ? "not-allowed" : "pointer",
            fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"],
            transition: "border-color var(--dur,170ms) var(--ease), color var(--dur,170ms) var(--ease)",
          }}
          onMouseEnter={(e) => { if (!atCap) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-strong, #6ba8e0)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent, #90caf9)"; } }}
          onMouseLeave={(e) => { if (!atCap) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong, #444)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2, #a8a8b3)"; } }}
        >{atCap ? "Máximo 3 overlays" : "＋ Agregar overlay"}</button>
      )}
    </div>
  );
}
