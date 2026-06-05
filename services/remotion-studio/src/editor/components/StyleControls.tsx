// ─── StyleControls: Subtitle style editing — Phase 26-04 dense 2-col layout ──
// D-06: Global style props — fontFamily, fontSize, activeColor, inactiveColor,
//       outlineColor, outlineWidth
// D-08: Background highlight — enabled/on/off + color, padding, borderRadius
// D-09: Position presets — migrated to shared PositionPresets ENUM mode (22-05)
// Phase 26-03: rf-color-matrix className added to color grid for @media reference
// D-11: Posición → Estilo → Avanzado always-open titled sections
// Phase 19: Extended font size (200), fontWeight/fontStyle toggles, Outer Glow
// Phase 22: PositionPresets enum mode replaces 3-button position selector;
//           segmented-button selection flipped green→blue (color law)
// Phase 26-04: UICONV-01 — reorganize into dense 2-col layout (sketch 011-C winner)
//              data-ctrl-2col attribute on the grid container for test assertions.

import React from "react";
import type { SubtitleConfig, SubtitlePosition, BackgroundHighlight, OuterGlow } from "../../pipeline-config.js";
import { AVAILABLE_FONTS } from "../../fonts.js";
import { PositionPresets } from "./PositionPresets.js";

interface StyleControlsProps {
  config: SubtitleConfig;
  onChange: (partial: Partial<SubtitleConfig>) => void;
}

// ─── Shared segmented-button style helpers ─────────────────────────────────
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
// sketch 011-C .sec-h pattern

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

// ─── Dense labeled row — sketch 011-C .row ─────────────────────────────────
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
      <label style={{ fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)" }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

// ─── Range row helper ────────────────────────────────────────────────────────

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

// ─── Color swatch (sketch 011-C .crole) ────────────────────────────────────

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)", padding: "var(--s-3, 6px) 0" }}>
      <div style={{
        position: "relative", width: 26, height: 26, flexShrink: 0,
        borderRadius: "var(--r-sm, 6px)", border: "1px solid var(--border-strong, #444)",
        overflow: "hidden", cursor: "pointer",
      }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", border: "none", padding: 0, background: "none", cursor: "pointer" }} />
      </div>
      <span style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)", flex: 1, minWidth: 0 }}>{label}</span>
    </div>
  );
}

// ─── Collapsible fx block — sketch 011-C .fx / .fx-head / .fx-params ───────

function FxBlock({ title, enabled, onToggle, children }: {
  title: string; enabled: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      border: `1px solid ${enabled ? "var(--border-strong, #444)" : "var(--border, #333)"}`,
      borderRadius: "var(--r-sm, 6px)",
      background: "var(--surface, #1e1e2e)",
      marginBottom: "var(--s-5, 10px)",
      overflow: "hidden",
      transition: "border-color var(--dur,170ms) var(--ease)",
    }}>
      {/* fx-head */}
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: "var(--s-5, 10px)",
        padding: "var(--s-5, 10px) var(--s-6, 12px)", cursor: "pointer",
      }}>
        {/* switch */}
        <div style={{
          position: "relative", width: 30, height: 17, flexShrink: 0,
          borderRadius: "var(--r-full, 999px)",
          background: enabled ? "var(--accent-tint, rgba(144,202,249,0.12))" : "var(--surface-hover, #2e2e3e)",
          border: `1px solid ${enabled ? "var(--accent-strong, #6ba8e0)" : "var(--border-strong, #444)"}`,
          transition: "background var(--dur,170ms) var(--ease), border-color var(--dur,170ms) var(--ease)",
        }}>
          <div style={{
            position: "absolute", top: 1, left: 1,
            width: 13, height: 13, borderRadius: "50%",
            background: enabled ? "var(--accent, #90caf9)" : "var(--text-2, #a8a8b3)",
            transform: enabled ? "translateX(13px)" : "none",
            transition: "transform var(--dur,170ms) var(--ease), background var(--dur,170ms) var(--ease)",
          }} />
        </div>
        <span style={{ fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"], color: "var(--text, #e6e6ea)", flex: 1, fontWeight: 500 }}>{title}</span>
        <span style={{ fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>{enabled ? "activado" : "apagado"}</span>
      </div>
      {/* fx-params */}
      {enabled && (
        <div style={{ padding: "0 var(--s-6, 12px) var(--s-6, 12px)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function StyleControls({ config, onChange }: StyleControlsProps) {
  const bh: BackgroundHighlight = config.backgroundHighlight ?? {
    enabled: false, color: "#000000", padding: 8, borderRadius: 4,
  };
  const glow: OuterGlow = config.outerGlow ?? {
    enabled: false, color: "#ffffff", intensity: 0.8, softness: 20,
  };

  return (
    // data-ctrl-2col: test hook for 2-column grid assertion
    <div
      data-ctrl-2col
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "var(--s-6, 12px) var(--s-12, 24px)",
        alignItems: "start",
      }}
    >
      {/* ── LEFT COLWRAP: Tipografía + Posición ─────────────────────────── */}
      <div data-colwrap="left" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* § 1 Tipografía — font, size, style, spacing */}
        <div style={{ marginBottom: "var(--s-8, 16px)" }}>
          <SectionHeader n={1} title="Tipografía" />

          {/* Font family */}
          <Row label="Fuente">
            <select value={config.fontFamily ?? "PlusJakartaSans"}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              style={{ width: "100%", padding: "6px 9px", background: "var(--surface-2, #252535)", border: "1px solid var(--border, #333)", borderRadius: "var(--r-sm, 6px)", color: "var(--text, #e6e6ea)", fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"] }}
            >
              {AVAILABLE_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
            </select>
          </Row>

          {/* Font size */}
          <RangeRow label="Tamaño" min={24} max={200}
            value={config.fontSize ?? 58}
            onChange={(v) => onChange({ fontSize: v })}
          />

          {/* Peso + Itálica in one row */}
          <Row label="Estilo">
            <div style={{ display: "flex", gap: "var(--s-3, 6px)" }}>
              <button type="button" onClick={() => onChange({ fontWeight: false })} style={segBtnStyle(config.fontWeight === false)}>Reg</button>
              <button type="button" onClick={() => onChange({ fontWeight: true })} style={segBtnStyle(config.fontWeight !== false)}>Bold</button>
              <button type="button" onClick={() => onChange({ fontStyle: !config.fontStyle })} style={{ ...segBtnStyle(config.fontStyle === true), fontStyle: "italic" }}>It</button>
            </div>
          </Row>

          {/* Espaciado */}
          <RangeRow label="Espaciado" min={-1} max={20}
            value={config.letterSpacing ?? 0}
            onChange={(v) => onChange({ letterSpacing: v })}
          />

          {/* Interlínea */}
          <RangeRow label="Interlínea" min={0.8} max={3} step={0.1}
            value={config.lineHeight ?? 1.3}
            onChange={(v) => onChange({ lineHeight: v })}
            format={(v) => v.toFixed(1)}
          />
        </div>

        {/* § 3 Posición */}
        <div>
          <SectionHeader n={3} title="Posición" />

          {/* Position preset grid (enum mode) */}
          <div style={{ marginBottom: "var(--s-5, 10px)" }}>
            <PositionPresets
              mode="enum"
              anchorToValue={{
                "center-bottom": "bottom-center",
                "center-top": "top-center",
                "center-center": "center-screen",
              }}
              activeAnchor={config.position ?? "bottom-center"}
              onApplyAnchor={(value: SubtitlePosition) => onChange({ position: value })}
            />
          </div>

          {/* Bottom offset */}
          <RangeRow label="Offset Y" min={0} max={960} step={10}
            value={config.bottomOffset ?? 250}
            onChange={(v) => onChange({ bottomOffset: v })}
          />

          {/* Subtitle width */}
          <RangeRow label="Ancho"
            min={0} max={1080} step={10}
            value={config.subtitleWidth ?? 0}
            onChange={(v) => onChange({ subtitleWidth: v })}
            format={(v) => v === 0 ? "auto" : String(v)}
          />
        </div>
      </div>

      {/* ── RIGHT COLWRAP: Color + Efectos ──────────────────────────────── */}
      <div data-colwrap="right" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* § 2 Color — .cmatrix 2×2 grid */}
        <div style={{ marginBottom: "var(--s-8, 16px)" }}>
          <SectionHeader n={2} title="Color" />

          {/* 2×2 color matrix */}
          <div className="rf-color-matrix" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-5, 10px) var(--s-6, 12px)", marginBottom: "var(--s-5, 10px)" }}>
            <ColorSwatch label="Activa" value={config.activeColor ?? "#FFFF00"} onChange={(v) => onChange({ activeColor: v })} />
            <ColorSwatch label="Resaltada" value={config.highlightColor ?? "#FFFFFF"} onChange={(v) => onChange({ highlightColor: v })} />
            <ColorSwatch label="Inactiva" value={config.inactiveColor ?? "#FFFFFF"} onChange={(v) => onChange({ inactiveColor: v })} />
            <ColorSwatch label="Contorno" value={config.outlineColor ?? "#000000"} onChange={(v) => onChange({ outlineColor: v })} />
          </div>

          {/* Outline width */}
          <RangeRow label="Contorno px" min={0} max={10}
            value={config.outlineWidth ?? 3}
            onChange={(v) => onChange({ outlineWidth: v })}
          />
        </div>

        {/* § Efectos — collapsible glow + background highlight */}
        <div>
          <SectionHeader title="Efectos" note="· opcionales" />

          {/* Glow collapsible */}
          <FxBlock title="Glow exterior" enabled={glow.enabled}
            onToggle={() => onChange({ outerGlow: { ...glow, enabled: !glow.enabled } })}
          >
            <div style={{ marginTop: "var(--s-5, 10px)" }}>
              <Row label="Color">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)" }}>
                  <div style={{ position: "relative", width: 26, height: 26, flexShrink: 0, borderRadius: "var(--r-sm, 6px)", border: "1px solid var(--border-strong, #444)", overflow: "hidden", cursor: "pointer" }}>
                    <input type="color" value={glow.color}
                      onChange={(e) => onChange({ outerGlow: { ...glow, color: e.target.value } })}
                      style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", border: "none", padding: 0, background: "none", cursor: "pointer" }} />
                  </div>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)", textTransform: "uppercase" }}>{glow.color}</span>
                </div>
              </Row>
              <RangeRow label="Difusión" min={0} max={60}
                value={glow.softness}
                onChange={(v) => onChange({ outerGlow: { ...glow, softness: v } })}
              />
            </div>
          </FxBlock>

          {/* Background highlight collapsible */}
          <FxBlock title="Fondo resaltado" enabled={bh.enabled}
            onToggle={() => onChange({ backgroundHighlight: { ...bh, enabled: !bh.enabled } })}
          >
            <div style={{ marginTop: "var(--s-5, 10px)" }}>
              <Row label="Color">
                <div style={{ position: "relative", width: 26, height: 26, flexShrink: 0, borderRadius: "var(--r-sm, 6px)", border: "1px solid var(--border-strong, #444)", overflow: "hidden", cursor: "pointer" }}>
                  <input type="color" value={bh.color}
                    onChange={(e) => onChange({ backgroundHighlight: { ...bh, color: e.target.value } })}
                    style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", border: "none", padding: 0, background: "none", cursor: "pointer" }} />
                </div>
              </Row>
              <RangeRow label="Relleno" min={0} max={32}
                value={bh.padding}
                onChange={(v) => onChange({ backgroundHighlight: { ...bh, padding: v } })}
              />
              <RangeRow label="Radio" min={0} max={24}
                value={bh.borderRadius}
                onChange={(v) => onChange({ backgroundHighlight: { ...bh, borderRadius: v } })}
              />
            </div>
          </FxBlock>
        </div>

        {/* § Avanzado — ritmo + timing */}
        <div style={{ marginTop: "var(--s-8, 16px)" }}>
          <SectionHeader title="Avanzado" note="· ritmo" />

          {/* Past word opacity */}
          <RangeRow label="Op. pasada" min={0} max={1} step={0.05}
            value={config.pastWordOpacity ?? 0.4}
            onChange={(v) => onChange({ pastWordOpacity: v })}
            format={(v) => v.toFixed(2)}
          />

          {/* Highlight duration */}
          <RangeRow label="Resalte ms" min={0} max={500} step={10}
            value={config.highlightDurationMs ?? 200}
            onChange={(v) => onChange({ highlightDurationMs: v })}
          />

          {/* Highlight transition */}
          <Row label="Transición">
            <div style={{ display: "flex", gap: "var(--s-4, 8px)" }}>
              <button type="button" onClick={() => onChange({ highlightTransition: "fade" })}
                style={segBtnStyle((config.highlightTransition ?? "fade") === "fade")}>Gradual</button>
              <button type="button" onClick={() => onChange({ highlightTransition: "instant" })}
                style={segBtnStyle(config.highlightTransition === "instant")}>Instant.</button>
            </div>
          </Row>
        </div>
      </div>
    </div>
  );
}
