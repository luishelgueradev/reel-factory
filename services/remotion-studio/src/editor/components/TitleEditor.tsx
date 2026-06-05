// ─── TitleEditor: Title overlay editor — Phase 26-04 dense 2-col layout ──────
// D-12: Titles array in pipeline-config.json with text, startTimeMs, durationMs, style
// D-16: Config editor UI for adding/editing/removing title overlays
// T-06-12: XSS prevention — sanitize title text before rendering
// Phase 20: removed subtitle, topOffset; added x/y pixel positioning + borderRadius slider
// Phase 22: PositionPresets (px mode) in Posición section; Posición→Estilo→Avanzado
//           always-open titled sections; aria-labels on delete buttons; blue selection
// Phase 26-02: Entrance animation refactored from segmented buttons → 4-card preset grid
//              per sketch 014-C (blue active ring, static cards, D-03 deferred for animation)
// Phase 26-03: rf-form-grid / rf-card-grid className hooks added to 2-col form rows and
//              the 4-card entrance grid for @media reflow (sketch 018-B: 4-up → 2×2 at 380px)
// Phase 26-04: UICONV-01 — reorganize form into dense 2-col layout (sketch 014-C winner)
//              data-ctrl-2col attribute on the grid container for test assertions.

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

// Entrance animation options with glyphs for the 014-C preset card vis
// Static cards — no live animation (D-03 deferred). Per sketch 014-C .mc-vis.
const ENTRANCE_ANIMATIONS: { id: TitleEntranceAnimation; label: string; glyph: string }[] = [
  { id: "slide-up",   label: "Slide ↑", glyph: "↑" },
  { id: "slide-down", label: "Slide ↓", glyph: "↓" },
  { id: "fade-in",    label: "Fade",    glyph: "◍" },
  { id: "none",       label: "Ninguna", glyph: "∅" },
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

// ─── Section header — numbered chip + uppercase title + hairline fill ──────
// sketch 014-C .sec-h pattern

function SectionHeader({ n, title, note }: { n?: number; title: string; note?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-5, 10px)", marginBottom: "var(--s-6, 12px)" }}>
      {n !== undefined && (
        <span style={{
          width: 16,
          height: 16,
          display: "grid",
          placeItems: "center",
          fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
          fontWeight: 600,
          color: "var(--text-2, #a8a8b3)",
          background: "var(--surface-2, #252535)",
          border: "1px solid var(--border, #333)",
          borderRadius: "var(--r-xs, 4px)",
          flexShrink: 0,
        }}>{n}</span>
      )}
      <span style={{
        fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
        fontWeight: 700,
        color: "var(--text-muted, #777)",
        letterSpacing: "0.1em",
        textTransform: "uppercase" as React.CSSProperties["textTransform"],
        flexShrink: 0,
      }}>{title}</span>
      {note && (
        <span style={{
          fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
          fontWeight: 500,
          color: "var(--text-faint, #555)",
          textTransform: "none" as React.CSSProperties["textTransform"],
          letterSpacing: 0,
        }}>{note}</span>
      )}
      <div style={{ flex: 1, height: 1, background: "var(--border-faint, #2a2a38)" }} />
    </div>
  );
}

// ─── Dense labeled row — sketch 014-C .row ────────────────────────────────
// grid-template-columns: 72px 1fr; align-items: center; gap: var(--s-6); margin-bottom: var(--s-5)

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "72px 1fr",
      alignItems: "center",
      gap: "var(--s-6, 12px)",
      marginBottom: "var(--s-5, 10px)",
    }}>
      <label style={{
        fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
        color: "var(--text-2, #a8a8b3)",
      }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

// ─── X/Y two-field mini row — sketch 014-C .two ───────────────────────────

function TwoFields({
  xValue, yValue,
  onXChange, onYChange,
  xMax = 1080, yMax = 1920,
  layout = "row",
}: {
  xValue: number; yValue: number;
  onXChange: (v: number) => void; onYChange: (v: number) => void;
  xMax?: number; yMax?: number;
  layout?: "row" | "stack";
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    padding: "6px 6px",
    background: "var(--surface-2, #252535)",
    border: "1px solid var(--border, #333)",
    borderRadius: "var(--r-sm, 6px)",
    color: "var(--text, #e6e6ea)",
    fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"],
    fontVariantNumeric: "tabular-nums",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
    color: "var(--text-muted, #777)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };
  const numberInput = (value: number, max: number, onChange: (v: number) => void) => (
    <input type="number" min={0} max={max} step={1} value={value}
      onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) onChange(v); }}
      style={inputStyle} />
  );
  if (layout === "stack") {
    // Y over X, inline "label :" + value box, inputs aligned in a shared column
    return (
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "var(--s-3, 6px)", rowGap: "var(--s-5, 10px)", alignItems: "center" }}>
        <span style={labelStyle}>Y :</span>
        {numberInput(yValue, yMax, onYChange)}
        <span style={labelStyle}>X :</span>
        {numberInput(xValue, xMax, onXChange)}
      </div>
    );
  }
  // row: X | Y, label above input
  const field = (label: string, value: number, max: number, onChange: (v: number) => void) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3, 6px)" }}>
      <span style={labelStyle}>{label}</span>
      {numberInput(value, max, onChange)}
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-5, 10px)" }}>
      {field("X", xValue, xMax, onXChange)}
      {field("Y", yValue, yMax, onYChange)}
    </div>
  );
}

// ─── Range with value output — sketch 014-C .rng ─────────────────────────

function RangeRow({ label, min, max, step = 1, value, onChange, format }: {
  label: string; min: number; max: number; step?: number;
  value: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  return (
    <Row label={label}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 42px", alignItems: "center", gap: "var(--s-5, 10px)" }}>
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

// ─── Color pair matrix — sketch 014-C .cmatrix ────────────────────────────

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)", padding: "var(--s-3, 6px) 0" }}>
      <div style={{
        position: "relative",
        width: 26, height: 26,
        flexShrink: 0,
        borderRadius: "var(--r-sm, 6px)",
        border: "1px solid var(--border-strong, #444)",
        overflow: "hidden",
        cursor: "pointer",
        background: value,
      }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", border: "none", padding: 0, background: "none", cursor: "pointer" }} />
      </div>
      <span style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)", flex: 1, minWidth: 0 }}>{label}</span>
    </div>
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
        text: text || "A",
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
    setNewTitle({ text: "", startTimeMs: 0, durationMs: 3000, style: { ...DEFAULT_TITLE_STYLE } });
    setAddingNew(false);
    setEditingIndex(null);
  };

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
    if (addingNew && entry.text.trim()) return [...titles, entry];
    return titles;
  };

  const handleDraftChange = (updater: (prev: Partial<TitleConfig>) => Partial<TitleConfig>) => {
    const updated = updater(newTitle);
    setNewTitle(updated);
    onPreviewChange?.(computeLiveTitles(updated));
  };

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

  const handleRemove = (index: number) => {
    const updated = titles.filter((_, i) => i !== index);
    onChange(updated);
    onPreviewChange?.(updated);
    if (editingIndex === index) resetForm();
    else if (editingIndex !== null && index < editingIndex) setEditingIndex(editingIndex - 1);
  };

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
        if (editingIndex === i) return null;
        return (
          <div key={i} style={{
            padding: "var(--s-4, 8px) var(--s-5, 10px)",
            background: "var(--surface, #1e1e2e)",
            borderRadius: "var(--r-md, 8px)",
            border: "1px solid var(--border, #333)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], color: "var(--text, #e6e6ea)" }}>{title.text}</div>
              <div style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-muted, #777)", marginTop: "var(--s-1, 2px)" }}>
                {(title.startTimeMs / 1000).toFixed(1)}s → {((title.startTimeMs + title.durationMs) / 1000).toFixed(1)}s
                {title.style?.entranceAnimation && title.style.entranceAnimation !== "none" && (
                  <span style={{ marginLeft: "var(--s-4, 8px)", color: "var(--accent, #90caf9)" }}>{title.style.entranceAnimation}</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--s-4, 8px)", flexShrink: 0, alignItems: "center" }}>
              <button type="button" onClick={() => handleStartEdit(i)} style={{
                padding: "4px 10px",
                background: "var(--surface-2, #252535)",
                color: "var(--text-2, #a8a8b3)",
                border: "1px solid var(--border, #333)",
                borderRadius: "var(--r-xs, 4px)",
                cursor: "pointer",
                fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"],
              }}>Editar</button>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, margin: -8 }}>
                <button aria-label="Eliminar título" type="button" onClick={() => handleRemove(i)} style={{
                  width: 32, height: 32, display: "grid", placeItems: "center",
                  background: "transparent", color: "var(--danger, #e57373)",
                  border: "1px solid transparent", borderRadius: "var(--r-xs, 4px)",
                  cursor: "pointer", fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
                  transition: "background var(--dur,170ms) var(--ease), border-color var(--dur,170ms) var(--ease)",
                }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(229,115,115,0.12)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--danger, #e57373)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
                  }}>✕</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Add/edit form — sketch 014-C dense layout ─────────────────── */}
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

          {/* ── Full-width: Animación de entrada (sketch 014-C .fullbleed .sec) ── */}
          <div style={{ marginBottom: "var(--s-8, 16px)" }}>
            <SectionHeader title="Animación de entrada" />
            {/* 4-card grid — sketch 014-C .modecards */}
            <div
              role="radiogroup"
              aria-label="Animación de entrada"
              className="rf-card-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--s-4, 8px)" }}
            >
              {ENTRANCE_ANIMATIONS.map((anim) => {
                const isSelected = (newTitle.style?.entranceAnimation ?? "slide-up") === anim.id;
                return (
                  <button key={anim.id} type="button" role="radio" aria-checked={isSelected}
                    data-entrance={anim.id} data-selected={isSelected}
                    onClick={() => handleDraftChange((prev) => ({
                      ...prev, style: { ...prev.style!, entranceAnimation: anim.id },
                    }))}
                    style={{
                      padding: "var(--s-5, 10px) var(--s-3, 6px) var(--s-4, 8px)",
                      background: isSelected ? "var(--accent-tint-2, rgba(144,202,249,0.08))" : "var(--surface, #1e1e2e)",
                      border: `1px solid ${isSelected ? "var(--accent-strong, #6ba8e0)" : "var(--border, #333)"}`,
                      borderRadius: "var(--r-sm, 6px)",
                      cursor: "pointer",
                      textAlign: "center" as React.CSSProperties["textAlign"],
                      transition: "border-color var(--dur,170ms) var(--ease), background var(--dur,170ms) var(--ease)",
                      font: "inherit",
                      display: "flex",
                      flexDirection: "column" as React.CSSProperties["flexDirection"],
                      alignItems: "center",
                      gap: "var(--s-3, 6px)",
                    }}
                  >
                    <div style={{
                      width: "100%", height: 30, borderRadius: "var(--r-xs, 4px)",
                      background: "var(--stage, #0f0f17)",
                      display: "grid", placeItems: "center", overflow: "hidden",
                      fontSize: 15,
                      color: isSelected ? "var(--accent, #90caf9)" : "var(--text-2, #a8a8b3)",
                    }}>{anim.glyph}</div>
                    <span style={{
                      fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
                      fontWeight: 600,
                      color: isSelected ? "var(--accent, #90caf9)" : "var(--text-2, #a8a8b3)",
                    }}>{anim.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Dense 2-col form — sketch 014-C .ctrl-2col ─────────────── */}
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
            {/* ── LEFT COLWRAP: Posición + Avanzado ────────────────────── */}
            <div data-colwrap="left" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>

              {/* § Posición — grid LEFT + X/Y stacked RIGHT (saves vertical space) */}
              <div style={{ marginBottom: "var(--s-8, 16px)" }}>
                <SectionHeader n={1} title="Posición" />

                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--s-4, 8px)", alignItems: "center" }}>
                  {/* PositionPresets — left */}
                  <PositionPresets
                    elementWidth={measuredBox.width}
                    elementHeight={measuredBox.height}
                    onApply={(x, y) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, x, y } }))}
                  />

                  {/* X/Y .two — stacked, right */}
                  <TwoFields
                    layout="stack"
                    xValue={newTitle.style?.x ?? 200}
                    yValue={newTitle.style?.y ?? 960}
                    onXChange={(v) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, x: v } }))}
                    onYChange={(v) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, y: v } }))}
                  />
                </div>
              </div>

              {/* § Avanzado — glow on/off, glow color, glow difusión, aparece, duración */}
              <div>
                <SectionHeader n={3} title="Avanzado" note="· rara vez" />

                {/* Interlínea */}
                <RangeRow label="Interlínea"
                  min={0.8} max={3} step={0.1}
                  value={newTitle.style?.lineHeight ?? 1.2}
                  onChange={(v) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, lineHeight: v } }))}
                  format={(v) => v.toFixed(1)}
                />

                {/* Glow on/off toggle */}
                {(() => {
                  const titleGlow = newTitle.style?.outerGlow ?? { enabled: false, color: "#ffffff", intensity: 0.8, softness: 20 };
                  return (
                    <>
                      <Row label="Glow">
                        <div style={{ display: "flex", gap: "var(--s-4, 8px)" }}>
                          <button type="button"
                            onClick={() => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, outerGlow: { ...titleGlow, enabled: false } } }))}
                            style={segBtnStyle(!titleGlow.enabled)}>Off</button>
                          <button type="button"
                            onClick={() => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, outerGlow: { ...titleGlow, enabled: true } } }))}
                            style={segBtnStyle(titleGlow.enabled)}>On</button>
                        </div>
                      </Row>
                      {titleGlow.enabled && (
                        <>
                          <Row label="Glow color">
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)" }}>
                              <div style={{ position: "relative", width: 26, height: 26, flexShrink: 0, borderRadius: "var(--r-sm, 6px)", border: "1px solid var(--border-strong, #444)", overflow: "hidden", cursor: "pointer" }}>
                                <input type="color" value={titleGlow.color}
                                  onChange={(e) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, outerGlow: { ...titleGlow, color: e.target.value } } }))}
                                  style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", border: "none", padding: 0, background: "none", cursor: "pointer" }} />
                              </div>
                              <span style={{ fontFamily: "var(--mono)", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)", textTransform: "uppercase" }}>{titleGlow.color}</span>
                            </div>
                          </Row>
                          <RangeRow label="Glow difus."
                            min={0} max={60} step={1}
                            value={titleGlow.softness}
                            onChange={(v) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, outerGlow: { ...titleGlow, softness: v } } }))}
                          />
                        </>
                      )}
                    </>
                  );
                })()}

                {/* Aparece */}
                <Row label="Aparece">
                  <input type="number" min={0} step={0.1}
                    value={(newTitle.startTimeMs ?? 0) / 1000}
                    onChange={(e) => handleDraftChange((prev) => ({ ...prev, startTimeMs: Math.round(Number(e.target.value) * 1000) }))}
                    style={{ width: "100%", padding: "6px 9px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-sm, 6px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"] }} />
                </Row>

                {/* Duración */}
                <Row label="Duración">
                  <input type="number" min={0.1} step={0.5}
                    value={(newTitle.durationMs ?? 3000) / 1000}
                    onChange={(e) => handleDraftChange((prev) => ({ ...prev, durationMs: Math.round(Number(e.target.value) * 1000) }))}
                    style={{ width: "100%", padding: "6px 9px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-sm, 6px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"] }} />
                </Row>
              </div>
            </div>

            {/* ── RIGHT COLWRAP: Texto/Estilo ───────────────────────────── */}
            <div data-colwrap="right" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>

              {/* § Texto / Estilo — text, font, size, weight/italic, caja bg/padding/radius, color pair */}
              <div>
                <SectionHeader n={2} title="Texto / Estilo" />

                {/* Texto */}
                <Row label="Texto">
                  <input type="text"
                    value={newTitle.text ?? ""}
                    onChange={(e) => handleDraftChange((prev) => ({ ...prev, text: e.target.value }))}
                    placeholder="ej. Bienvenido a mi canal"
                    style={{ width: "100%", padding: "6px 9px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-sm, 6px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"] }} />
                </Row>

                {/* Fuente */}
                <Row label="Fuente">
                  <select
                    value={newTitle.style?.titleFontFamily ?? "PlusJakartaSans"}
                    onChange={(e) => handleDraftChange((prev) => ({
                      ...prev, style: { ...prev.style!, titleFontFamily: e.target.value },
                    }))}
                    style={{ width: "100%", padding: "6px 9px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-sm, 6px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"] }}
                  >
                    {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Row>

                {/* Tamaño */}
                <RangeRow label="Tamaño"
                  min={24} max={200}
                  value={newTitle.style?.titleFontSize ?? 72}
                  onChange={(v) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, titleFontSize: v } }))}
                />

                {/* Peso + Itálica */}
                <Row label="Peso / It.">
                  <div style={{ display: "flex", gap: "var(--s-3, 6px)" }}>
                    <button type="button"
                      onClick={() => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, fontWeight: false } }))}
                      style={segBtnStyle(newTitle.style?.fontWeight === false)}>Reg</button>
                    <button type="button"
                      onClick={() => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, fontWeight: true } }))}
                      style={segBtnStyle(newTitle.style?.fontWeight !== false)}>Bold</button>
                    <button type="button"
                      onClick={() => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, fontStyle: !prev.style?.fontStyle } }))}
                      style={{ ...segBtnStyle(newTitle.style?.fontStyle === true), fontStyle: "italic" }}>It</button>
                  </div>
                </Row>

                {/* Caja bg/padding/radius + color pair as .cmatrix */}
                <div style={{ marginTop: "var(--s-5, 10px)" }}>
                  <div style={{ fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"], fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as React.CSSProperties["textTransform"], color: "var(--text-faint, #555)", marginBottom: "var(--s-5, 10px)" }}>Caja</div>

                  {/* Color pair — .cmatrix (1fr 1fr) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-5, 10px) var(--s-6, 12px)", marginBottom: "var(--s-5, 10px)" }}>
                    <ColorSwatch label="Texto"
                      value={newTitle.style?.titleColor ?? newTitle.style?.textColor ?? "#FFFFFF"}
                      onChange={(v) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, titleColor: v } }))}
                    />
                    <ColorSwatch label="Caja"
                      value={rgbaToHex(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)")}
                      onChange={(v) => {
                        const alpha = rgbaToAlpha(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)");
                        handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, backgroundColor: hexAndAlphaToRgba(v, alpha) } }));
                      }}
                    />
                  </div>

                  {/* Caja opacity */}
                  <RangeRow label="Opac. caja"
                    min={0} max={1} step={0.05}
                    value={rgbaToAlpha(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)")}
                    onChange={(v) => {
                      const hex = rgbaToHex(newTitle.style?.backgroundColor ?? "rgba(0, 0, 0, 0.7)");
                      handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, backgroundColor: hexAndAlphaToRgba(hex, v) } }));
                    }}
                    format={(v) => v.toFixed(2)}
                  />

                  {/* Relleno */}
                  <RangeRow label="Relleno"
                    min={0} max={100}
                    value={newTitle.style?.padding ?? 40}
                    onChange={(v) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, padding: v } }))}
                  />

                  {/* Radio */}
                  <RangeRow label="Radio"
                    min={0} max={50}
                    value={newTitle.style?.borderRadius ?? 12}
                    onChange={(v) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, borderRadius: v } }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form actions */}
          <div style={{ display: "flex", gap: "var(--s-4, 8px)", marginTop: "var(--s-8, 16px)" }}>
            <button type="button"
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
            >{editingIndex !== null ? "Guardar cambios" : "Agregar título"}</button>
            <button type="button"
              onClick={() => { onPreviewChange?.(titles); resetForm(); }}
              style={{
                padding: "8px 16px",
                background: "var(--surface-2, #252535)",
                color: "var(--text-2, #a8a8b3)",
                border: "1px solid var(--border, #333)",
                borderRadius: "var(--r-sm, 6px)",
                cursor: "pointer",
                fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
              }}
            >Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Add title button ─────────────────────────────────────────────── */}
      {!addingNew && editingIndex === null && (
        <button type="button"
          onClick={() => { setAddingNew(true); setNewTitle({ text: "", startTimeMs: 0, durationMs: 3000, style: { ...DEFAULT_TITLE_STYLE } }); }}
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
        >＋ Agregar título</button>
      )}
    </div>
  );
}
