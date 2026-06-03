// ─── TitleEditor: Title overlay editor — Phase 22 impeccable pass ────────────
// D-12: Titles array in pipeline-config.json with text, startTimeMs, durationMs, style
// D-16: Config editor UI for adding/editing/removing title overlays
// T-06-12: XSS prevention — sanitize title text before rendering
// Phase 20: removed subtitle, topOffset; added x/y pixel positioning + borderRadius slider
// Phase 22: PositionPresets (px mode) in Posición section; Posición→Estilo→Avanzado
//           always-open titled sections; aria-labels on delete buttons; blue selection

import React, { useState, useEffect } from "react";
import type { TitleConfig, TitleEntranceAnimation } from "../../pipeline-config.js";
import { AVAILABLE_FONTS } from "../../fonts.js";
import { getFontFamilyCSS } from "../../fonts.js";
import { PositionPresets } from "./PositionPresets.js";

// ─── measureTitleBox ──────────────────────────────────────────────────────────
// Returns the exact width/height (integer px, in 1080×1920 frame space) of the
// TitleOverlay text box for the given style params, by creating a detached DOM
// node that mirrors TitleOverlay's CSS exactly and reading its offsetWidth /
// offsetHeight.
//
// TitleOverlay box model (from TitleOverlay.tsx):
//   outer div: position absolute, width "80%"→864px, padding: ${padding}px 24px,
//              display flex, flexDirection column, alignItems center,
//              justifyContent center
//   inner span: fontSize, fontWeight, fontStyle, fontFamily, lineHeight,
//               whiteSpace "pre-wrap", wordBreak "break-word", textAlign center
//
// Because fontSize/padding are ABSOLUTE px values identical to the composition,
// the measured box is already in 1080×1920 frame space — no scale needed.
//
// Falls back to an estimated size if the DOM is not available (SSR / vitest).

interface MeasureTitleOpts {
  text: string;
  fontFamily: string;   // CSS font-family string (resolved, not module key)
  fontSize: number;     // px — matches titleFontSize in TitleOverlay
  fontWeight: number;   // 700 (bold) or 400 (regular)
  fontStyle: string;    // "italic" or "normal"
  lineHeight: number;
  padding: number;      // top/bottom padding px (left/right is always 24px in TitleOverlay)
}

// Outer div width = 80% of 1080 frame = 864px (matches TitleOverlay's width:"80%")
const TITLE_BOX_WIDTH_PX = 864;

function measureTitleBox(opts: MeasureTitleOpts): { width: number; height: number } {
  if (typeof document === "undefined") {
    // SSR fallback — return old estimate
    return {
      width: TITLE_BOX_WIDTH_PX,
      height: Math.round(opts.fontSize * 1.5 + opts.padding * 2),
    };
  }

  const outer = document.createElement("div");
  Object.assign(outer.style, {
    position: "absolute",
    visibility: "hidden",
    left: "-99999px",
    top: "-99999px",
    width: `${TITLE_BOX_WIDTH_PX}px`,
    padding: `${opts.padding}px 24px`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  });

  const inner = document.createElement("span");
  Object.assign(inner.style, {
    fontSize: `${opts.fontSize}px`,
    fontWeight: String(opts.fontWeight),
    fontStyle: opts.fontStyle,
    fontFamily: opts.fontFamily,
    lineHeight: String(opts.lineHeight),
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    textAlign: "center",
    width: "100%",
  });
  inner.textContent = opts.text;

  outer.appendChild(inner);
  document.body.appendChild(outer);

  const width = outer.offsetWidth;
  const height = outer.offsetHeight;

  document.body.removeChild(outer);

  return { width, height };
}

interface TitleEditorProps {
  titles: TitleConfig[];
  onChange: (titles: TitleConfig[]) => void;
  onPreviewChange?: (liveTitles: TitleConfig[]) => void;
}

const ENTRANCE_ANIMATIONS: { id: TitleEntranceAnimation; label: string }[] = [
  { id: "slide-up", label: "Slide ↑" },
  { id: "slide-down", label: "Slide ↓" },
  { id: "fade-in", label: "Fade" },
  { id: "none", label: "Ninguna" },
];

// Monospace is a system fallback and not suitable for title overlays
const FONT_OPTIONS = AVAILABLE_FONTS.filter(f => f !== "monospace");

const DEFAULT_TITLE_STYLE = {
  entranceAnimation: "slide-up" as TitleEntranceAnimation,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  textColor: "#FFFFFF",
  titleFontSize: 72,
  titleColor: "#FFFFFF",
  titleFontFamily: "PlusJakartaSans",
  x: 200,
  y: 960,
  borderRadius: 12,
  lineHeight: 1.2,
  padding: 40,
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

// ─── rgba helpers (unchanged from Phase 20) ───────────────────────────────

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

export function TitleEditor({ titles, onChange, onPreviewChange }: TitleEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  // ── New title form state ─────────────────────────────────────────────────
  const [newTitle, setNewTitle] = useState<Partial<TitleConfig>>({
    text: "",
    startTimeMs: 0,
    durationMs: 3000,
    style: { ...DEFAULT_TITLE_STYLE },
  });

  // ── Measured title box dimensions (runtime-only, NOT persisted) ──────────
  // Re-computed whenever text or relevant style fields change; fed to
  // PositionPresets so center/right/bottom presets use the REAL box size.
  const [measuredBox, setMeasuredBox] = useState({
    width: TITLE_BOX_WIDTH_PX,
    height: Math.round(DEFAULT_TITLE_STYLE.titleFontSize * 1.5 + DEFAULT_TITLE_STYLE.padding * 2),
  });

  useEffect(() => {
    const style = newTitle.style;
    if (!style) return;
    const text = newTitle.text ?? "";
    const fontFamily = getFontFamilyCSS(style.titleFontFamily ?? DEFAULT_TITLE_STYLE.titleFontFamily);
    const fontSize = style.titleFontSize ?? DEFAULT_TITLE_STYLE.titleFontSize;
    const fontWeight = style.fontWeight !== false ? 700 : 400;
    const fontStyleStr = style.fontStyle === true ? "italic" : "normal";
    const lineHeight = style.lineHeight ?? DEFAULT_TITLE_STYLE.lineHeight;
    const padding = style.padding ?? DEFAULT_TITLE_STYLE.padding;

    const doMeasure = () => {
      const box = measureTitleBox({
        text: text || "A", // always measure at least one char to get a valid height
        fontFamily,
        fontSize,
        fontWeight,
        fontStyle: fontStyleStr,
        lineHeight,
        padding,
      });
      setMeasuredBox(box);
    };

    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(doMeasure);
    } else {
      doMeasure();
    }
  }, [
    newTitle.text,
    newTitle.style?.titleFontFamily,
    newTitle.style?.titleFontSize,
    newTitle.style?.fontWeight,
    newTitle.style?.fontStyle,
    newTitle.style?.lineHeight,
    newTitle.style?.padding,
  ]);

  const resetForm = () => {
    setNewTitle({
      text: "",
      startTimeMs: 0,
      durationMs: 3000,
      style: { ...DEFAULT_TITLE_STYLE },
    });
    setAddingNew(false);
    setEditingIndex(null);
  };

  // Compute preview titles by merging the current draft into the committed list
  const computeLiveTitles = (draft: Partial<TitleConfig>): TitleConfig[] => {
    const entry: TitleConfig = {
      text: draft.text ?? "",
      startTimeMs: draft.startTimeMs ?? 0,
      durationMs: draft.durationMs ?? 3000,
      style: draft.style,
    };
    if (editingIndex !== null) {
      const live = [...titles];
      live[editingIndex] = entry;
      return live;
    }
    if (addingNew && entry.text.trim()) {
      return [...titles, entry];
    }
    return titles;
  };

  // Update local draft state AND emit live preview to parent
  const handleDraftChange = (updater: (prev: Partial<TitleConfig>) => Partial<TitleConfig>) => {
    const updated = updater(newTitle);
    setNewTitle(updated);
    onPreviewChange?.(computeLiveTitles(updated));
  };

  // ── Add title ─────────────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!newTitle.text?.trim()) return;

    const title: TitleConfig = {
      text: newTitle.text,
      startTimeMs: newTitle.startTimeMs ?? 0,
      durationMs: newTitle.durationMs ?? 3000,
      style: newTitle.style,
    };

    const updated = [...titles, title];
    onChange(updated);
    onPreviewChange?.(updated);
    resetForm();
  };

  // ── Remove title ──────────────────────────────────────────────────────────
  const handleRemove = (index: number) => {
    const updated = titles.filter((_, i) => i !== index);
    onChange(updated);
    if (editingIndex === index) {
      resetForm();
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
  };

  // ── Edit existing title ───────────────────────────────────────────────────
  const handleStartEdit = (index: number) => {
    const title = titles[index];
    setNewTitle({
      text: title.text,
      startTimeMs: title.startTimeMs,
      durationMs: title.durationMs,
      style: title.style ? {
        entranceAnimation: title.style.entranceAnimation,
        backgroundColor: title.style.backgroundColor,
        textColor: title.style.textColor,
        titleFontSize: title.style.titleFontSize,
        titleColor: title.style.titleColor,
        titleFontFamily: title.style.titleFontFamily,
        x: title.style.x,
        y: title.style.y,
        borderRadius: title.style.borderRadius,
        lineHeight: title.style.lineHeight,
        padding: title.style.padding,
        fontWeight: title.style.fontWeight,
        fontStyle: title.style.fontStyle,
        outerGlow: title.style.outerGlow,
      } : { ...DEFAULT_TITLE_STYLE },
    });
    setEditingIndex(index);
    setAddingNew(false);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !newTitle.text?.trim()) return;

    const updated = [...titles];
    updated[editingIndex] = {
      text: newTitle.text,
      startTimeMs: newTitle.startTimeMs ?? 0,
      durationMs: newTitle.durationMs ?? 3000,
      style: newTitle.style,
    };

    onChange(updated);
    onPreviewChange?.(updated);
    resetForm();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-6, 12px)" }}>

      {/* ── Title list ─────────────────────────────────────────────────── */}
      {titles.length === 0 && !addingNew && editingIndex === null && (
        <p style={{ fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)", fontStyle: "italic" }}>
          Sin títulos todavía. Haz clic en &quot;＋ Agregar título&quot; para crear uno.
        </p>
      )}

      {titles.map((title, i) => {
        if (editingIndex === i) return null; // editing this one, show form below
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
              <div style={{ fontWeight: 600, fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], color: "var(--text, #e6e6ea)" }}>{title.text}</div>
              <div style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-muted, #777)", marginTop: "var(--s-2, 4px)" }}>
                {(title.startTimeMs / 1000).toFixed(1)}s → {(title.startTimeMs / 1000 + title.durationMs / 1000).toFixed(1)}s ({title.durationMs}ms)
                {title.style?.entranceAnimation && title.style.entranceAnimation !== "none" && (
                  <span style={{ marginLeft: "var(--s-4, 8px)", color: "var(--accent, #90caf9)" }}>
                    {title.style.entranceAnimation}
                  </span>
                )}
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
                  aria-label="Eliminar título"
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
      {(addingNew || editingIndex !== null) && (
        <div style={{
          padding: "var(--s-8, 16px)",
          background: "var(--surface, #1e1e2e)",
          borderRadius: "var(--r-md, 8px)",
          border: "1px solid var(--accent-strong, #6ba8e0)",
        }}>
          <h3 style={{ fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], fontWeight: 600, color: "var(--text, #e6e6ea)", marginBottom: "var(--s-6, 12px)" }}>
            {editingIndex !== null ? "Editar título" : "Agregar título"}
          </h3>

          {/* ─────────────────────────────────────────────────────────────
              § 1  POSICIÓN — X/Y inputs + PositionPresets (px mode, D-07/D-09)
              Box size from measureTitleBox() — mirrors TitleOverlay DOM exactly.
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
                  value={newTitle.style?.x ?? 200}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (isNaN(val)) return;
                    handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, x: val } }));
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
                  value={newTitle.style?.y ?? 960}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (isNaN(val)) return;
                    handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, y: val } }));
                  }}
                  style={{ width: "100%", padding: "6px 8px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"] }}
                />
              </div>
            </div>

            {/* PositionPresets px mode (D-07/D-09) — measured real box from measureTitleBox */}
            <div>
              <RowLabel>Preset de posición</RowLabel>
              <PositionPresets
                elementWidth={measuredBox.width}
                elementHeight={measuredBox.height}
                onApply={(x, y) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, x, y } }))}
              />
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              § 2  ESTILO — text, font, size, weight/style, color pair,
                            entrance animation, glow
          ───────────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: "var(--s-8, 16px)" }}>
            <SectionHeader n={2} title="Estilo" />

            {/* Title text (required) */}
            <div style={{ marginBottom: "var(--s-5, 10px)" }}>
              <RowLabel>Texto del título *</RowLabel>
              <input
                type="text"
                value={newTitle.text ?? ""}
                onChange={(e) => handleDraftChange((prev) => ({ ...prev, text: e.target.value }))}
                placeholder="ej. Bienvenido a mi canal"
                style={{ width: "100%", padding: "6px 8px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"] }}
              />
            </div>

            {/* Entrance Animation — blue selection (color law) */}
            <div style={{ marginBottom: "var(--s-5, 10px)" }}>
              <RowLabel>Animación de entrada</RowLabel>
              <div style={{ display: "flex", gap: "var(--s-3, 6px)" }}>
                {ENTRANCE_ANIMATIONS.map((anim) => {
                  const isSelected = (newTitle.style?.entranceAnimation ?? "slide-up") === anim.id;
                  return (
                    <button
                      key={anim.id}
                      type="button"
                      onClick={() => handleDraftChange((prev) => ({
                        ...prev,
                        style: { ...prev.style!, entranceAnimation: anim.id },
                      }))}
                      style={segBtnStyle(isSelected)}
                    >
                      {anim.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font + size */}
            <div style={{ display: "flex", gap: "var(--s-6, 12px)", marginBottom: "var(--s-5, 10px)" }}>
              <div style={{ flex: 2 }}>
                <RowLabel>Fuente</RowLabel>
                <select
                  value={newTitle.style?.titleFontFamily ?? "PlusJakartaSans"}
                  onChange={(e) => handleDraftChange((prev) => ({
                    ...prev,
                    style: { ...prev.style!, titleFontFamily: e.target.value },
                  }))}
                  style={{ width: "100%", padding: "6px 8px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"] }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <RowLabel>Tamaño: {newTitle.style?.titleFontSize ?? 72}</RowLabel>
                <input
                  type="range"
                  min={24}
                  max={200}
                  value={newTitle.style?.titleFontSize ?? 72}
                  onChange={(e) => handleDraftChange((prev) => ({
                    ...prev,
                    style: { ...prev.style!, titleFontSize: parseInt(e.target.value) },
                  }))}
                  style={{ width: "100%", accentColor: "var(--accent, #90caf9)", marginTop: 4 }}
                />
              </div>
            </div>

            {/* Font Weight toggle — blue selection (color law) */}
            <div style={{ marginBottom: "var(--s-5, 10px)" }}>
              <RowLabel>Grosor</RowLabel>
              <div style={{ display: "flex", gap: "var(--s-4, 8px)" }}>
                <button
                  type="button"
                  onClick={() => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, fontWeight: false } }))}
                  style={segBtnStyle(newTitle.style?.fontWeight === false)}
                >
                  Regular
                </button>
                <button
                  type="button"
                  onClick={() => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, fontWeight: true } }))}
                  style={segBtnStyle(newTitle.style?.fontWeight !== false)}
                >
                  Negrita
                </button>
              </div>
            </div>

            {/* Font Style toggle — blue selection (color law) */}
            <div style={{ marginBottom: "var(--s-5, 10px)" }}>
              <RowLabel>Estilo</RowLabel>
              <div style={{ display: "flex", gap: "var(--s-4, 8px)" }}>
                <button
                  type="button"
                  onClick={() => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, fontStyle: false } }))}
                  style={segBtnStyle(newTitle.style?.fontStyle !== true)}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, fontStyle: true } }))}
                  style={segBtnStyle(newTitle.style?.fontStyle === true)}
                >
                  Itálica
                </button>
              </div>
            </div>

            {/* Color pair: background + title color */}
            <div style={{ display: "flex", gap: "var(--s-8, 16px)", marginBottom: "var(--s-5, 10px)" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--s-2, 4px)" }}>
                <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)" }}>Caja</label>
                <input
                  type="color"
                  value={rgbaToHex(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)")}
                  onChange={(e) => {
                    const alpha = rgbaToAlpha(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)");
                    handleDraftChange((prev) => ({
                      ...prev,
                      style: { ...prev.style!, backgroundColor: hexAndAlphaToRgba(e.target.value, alpha) },
                    }));
                  }}
                  style={{ width: 48, height: 36, border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", padding: 2, background: "var(--surface-2, #252535)", cursor: "pointer" }}
                />
                <label style={{ fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>Opac.</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={rgbaToAlpha(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)")}
                  onChange={(e) => {
                    const hex = rgbaToHex(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)");
                    handleDraftChange((prev) => ({
                      ...prev,
                      style: { ...prev.style!, backgroundColor: hexAndAlphaToRgba(hex, parseFloat(e.target.value)) },
                    }));
                  }}
                  style={{ width: 48, accentColor: "var(--accent, #90caf9)" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--s-2, 4px)" }}>
                <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)" }}>Texto</label>
                <input
                  type="color"
                  value={newTitle.style?.titleColor ?? newTitle.style?.textColor ?? "#FFFFFF"}
                  onChange={(e) => handleDraftChange((prev) => ({
                    ...prev,
                    style: { ...prev.style!, titleColor: e.target.value },
                  }))}
                  style={{ width: 48, height: 36, border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", padding: 2, background: "var(--surface-2, #252535)", cursor: "pointer" }}
                />
              </div>
            </div>

            {/* Outer Glow card */}
            {(() => {
              const titleGlow = newTitle.style?.outerGlow ?? {
                enabled: false,
                color: "#ffffff",
                intensity: 0.8,
                softness: 20,
              };
              return (
                <div style={{
                  padding: "var(--s-6, 12px) var(--s-8, 16px)",
                  background: "var(--surface-2, #252535)",
                  borderRadius: "var(--r-md, 8px)",
                  border: "1px solid var(--border, #333)",
                }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)", cursor: "pointer", marginBottom: titleGlow.enabled ? "var(--s-4, 8px)" : 0 }}>
                    <input
                      type="checkbox"
                      checked={titleGlow.enabled}
                      onChange={(e) => handleDraftChange((prev) => ({
                        ...prev,
                        style: { ...prev.style!, outerGlow: { ...titleGlow, enabled: e.target.checked } },
                      }))}
                    />
                    <span style={{ fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], fontWeight: 600, color: "var(--text, #e6e6ea)" }}>Brillo exterior</span>
                  </label>

                  {titleGlow.enabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5, 10px)", marginLeft: 24 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--s-2, 4px)" }}>
                        <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)" }}>Color</label>
                        <input
                          type="color"
                          value={titleGlow.color}
                          onChange={(e) => handleDraftChange((prev) => ({
                            ...prev,
                            style: { ...prev.style!, outerGlow: { ...titleGlow, color: e.target.value } },
                          }))}
                          style={{ width: 48, height: 36, border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", padding: 2, background: "var(--surface-2, #252535)", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>{titleGlow.color}</span>
                      </div>
                      <div>
                        <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)", display: "block", marginBottom: "var(--s-2, 4px)" }}>
                          Intensidad: {titleGlow.intensity}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={titleGlow.intensity}
                          onChange={(e) => handleDraftChange((prev) => ({
                            ...prev,
                            style: { ...prev.style!, outerGlow: { ...titleGlow, intensity: Number(e.target.value) } },
                          }))}
                          style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)", display: "block", marginBottom: "var(--s-2, 4px)" }}>
                          Suavidad: {titleGlow.softness}px
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={60}
                          step={1}
                          value={titleGlow.softness}
                          onChange={(e) => handleDraftChange((prev) => ({
                            ...prev,
                            style: { ...prev.style!, outerGlow: { ...titleGlow, softness: Number(e.target.value) } },
                          }))}
                          style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              § 3  AVANZADO — timing, borderRadius, lineHeight, padding
              Always-open titled section — NOT an accordion (UI-SPEC L236-243)
          ───────────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: "var(--s-8, 16px)" }}>
            <SectionHeader n={3} title="Avanzado" />

            {/* Timing */}
            <div style={{ display: "flex", gap: "var(--s-6, 12px)", marginBottom: "var(--s-5, 10px)" }}>
              <div style={{ flex: 1 }}>
                <RowLabel>Aparece (s)</RowLabel>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={(newTitle.startTimeMs ?? 0) / 1000}
                  onChange={(e) => handleDraftChange((prev) => ({ ...prev, startTimeMs: Math.round(Number(e.target.value) * 1000) }))}
                  style={{ width: "100%", padding: "6px 8px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"] }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <RowLabel>Dura (s)</RowLabel>
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={(newTitle.durationMs ?? 3000) / 1000}
                  onChange={(e) => handleDraftChange((prev) => ({ ...prev, durationMs: Math.round(Number(e.target.value) * 1000) }))}
                  style={{ width: "100%", padding: "6px 8px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"] }}
                />
              </div>
            </div>

            {/* Border Radius */}
            <div style={{ marginBottom: "var(--s-5, 10px)" }}>
              <RowLabel>Radio de borde: {newTitle.style?.borderRadius ?? 12}px</RowLabel>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={newTitle.style?.borderRadius ?? 12}
                onChange={(e) => handleDraftChange((prev) => ({
                  ...prev,
                  style: { ...prev.style!, borderRadius: parseInt(e.target.value) },
                }))}
                style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>
                <span>0px</span>
                <span>50px</span>
              </div>
            </div>

            {/* Line Height & Padding */}
            <div style={{ display: "flex", gap: "var(--s-6, 12px)" }}>
              <div style={{ flex: 1 }}>
                <RowLabel>Altura de línea: {newTitle.style?.lineHeight ?? 1.2}</RowLabel>
                <input
                  type="range"
                  min={0.8}
                  max={3}
                  step={0.1}
                  value={newTitle.style?.lineHeight ?? 1.2}
                  onChange={(e) => handleDraftChange((prev) => ({
                    ...prev,
                    style: { ...prev.style!, lineHeight: parseFloat(e.target.value) },
                  }))}
                  style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <RowLabel>Relleno: {newTitle.style?.padding ?? 40}px</RowLabel>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={newTitle.style?.padding ?? 40}
                  onChange={(e) => handleDraftChange((prev) => ({
                    ...prev,
                    style: { ...prev.style!, padding: parseInt(e.target.value) },
                  }))}
                  style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
                />
              </div>
            </div>
          </div>

          {/* Form actions */}
          <div style={{ display: "flex", gap: "var(--s-4, 8px)" }}>
            <button
              type="button"
              onClick={editingIndex !== null ? handleSaveEdit : handleAdd}
              disabled={!newTitle.text?.trim()}
              style={{
                padding: "8px 16px",
                background: newTitle.text?.trim() ? "var(--accent-tint, rgba(144,202,249,0.12))" : "var(--surface-2, #252535)",
                color: newTitle.text?.trim() ? "var(--accent, #90caf9)" : "var(--text-muted, #777)",
                border: `1px solid ${newTitle.text?.trim() ? "var(--accent-strong, #6ba8e0)" : "var(--border, #333)"}`,
                borderRadius: "var(--r-sm, 6px)",
                cursor: newTitle.text?.trim() ? "pointer" : "not-allowed",
                fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
                fontWeight: 600,
              }}
            >
              {editingIndex !== null ? "Guardar cambios" : "Agregar título"}
            </button>
            <button
              type="button"
              onClick={() => {
                onPreviewChange?.(titles);
                resetForm();
              }}
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
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Add title button (hidden when form is open) ────────────────── */}
      {!addingNew && editingIndex === null && (
        <button
          type="button"
          onClick={() => {
            setAddingNew(true);
            setNewTitle({
              text: "",
              startTimeMs: 0,
              durationMs: 3000,
              style: { ...DEFAULT_TITLE_STYLE },
            });
          }}
          style={{
            padding: "10px 20px",
            background: "var(--surface-2, #252535)",
            color: "var(--text-2, #a8a8b3)",
            border: "1px dashed var(--border-strong, #444)",
            borderRadius: "var(--r-sm, 6px)",
            cursor: "pointer",
            fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"],
            transition: "border-color var(--dur,170ms) var(--ease), color var(--dur,170ms) var(--ease)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-strong, #6ba8e0)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--accent, #90caf9)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong, #444)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2, #a8a8b3)";
          }}
        >
          ＋ Agregar título
        </button>
      )}
    </div>
  );
}
