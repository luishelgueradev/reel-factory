// ─── StyleControls: Subtitle style editing — Phase 22 impeccable pass ────────
// D-06: Global style props — fontFamily, fontSize, activeColor, inactiveColor,
//       outlineColor, outlineWidth
// D-08: Background highlight — enabled/on/off + color, padding, borderRadius
// D-09: Position presets — migrated to shared PositionPresets ENUM mode (22-05)
// Phase 26-03: rf-color-matrix className added to color grid for @media reference
//              (sketch 018-B: color matrix stays 2×2 at all widths — already compact)
// D-11: Posición → Estilo → Avanzado always-open titled sections
// Phase 19: Extended font size (200), fontWeight/fontStyle toggles, Outer Glow
// Phase 22: PositionPresets enum mode replaces 3-button position selector;
//           segmented-button selection flipped green→blue (color law)

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

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--s-4, 8px)",
      marginBottom: "var(--s-5, 10px)",
    }}>
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
      }}>
        {n}
      </span>
      <span style={{
        fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
        fontWeight: 600,
        color: "var(--text-muted, #777)",
        letterSpacing: "0.1em",
        textTransform: "uppercase" as React.CSSProperties["textTransform"],
        flexShrink: 0,
      }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border-faint, #2a2a38)" }} />
    </div>
  );
}

// ─── Shared control-row label ──────────────────────────────────────────────

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
      color: "var(--text-2, #a8a8b3)",
      display: "block",
      marginBottom: "var(--s-2, 4px)",
    }}>
      {children}
    </label>
  );
}

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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-8, 16px)" }}>

      {/* ═══════════════════════════════════════════════════════════════════
          § 1  POSICIÓN
          Contains: PositionPresets (enum mode, 3 enabled cells) + bottomOffset
          Migration (D-08): shared <PositionPresets mode="enum"> replaces the
          old 3-button selector. The 3 anchor cells map to SubtitlePosition:
            center-bottom → "bottom-center"
            center-top    → "top-center"
            center-center → "center-screen"
          onApplyAnchor writes through the EXISTING onChange({ position }) path —
          same writes as the old 3 buttons → subtitle preview cannot regress.
      ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader n={1} title="Posición" />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5, 10px)" }}>

          {/* Position preset grid (enum mode — D-08 migration path) */}
          <div>
            <RowLabel>Preset de posición</RowLabel>
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
          <div>
            <RowLabel>
              Offset inferior: <strong style={{ color: "var(--text, #e6e6ea)" }}>{config.bottomOffset ?? 250}px</strong>
            </RowLabel>
            <input
              type="range"
              min={0}
              max={960}
              step={10}
              value={config.bottomOffset ?? 250}
              onChange={(e) => onChange({ bottomOffset: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>
              <span>0px</span>
              <span>960px</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          § 2  ESTILO
          Contains: font family, size, weight, style, color matrix, glow
      ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader n={2} title="Estilo" />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5, 10px)" }}>

          {/* Font family */}
          <div>
            <RowLabel>Fuente</RowLabel>
            <select
              value={config.fontFamily ?? "PlusJakartaSans"}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              style={{
                width: "100%",
                padding: "6px 10px",
                background: "var(--surface-2, #252535)",
                border: "1px solid var(--border, #333)",
                borderRadius: "var(--r-sm, 6px)",
                color: "var(--text, #e6e6ea)",
                fontSize: "var(--t-md, 13.5px)" as React.CSSProperties["fontSize"],
              }}
            >
              {AVAILABLE_FONTS.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </div>

          {/* Font size slider */}
          <div>
            <RowLabel>
              Tamaño: <strong style={{ color: "var(--text, #e6e6ea)" }}>{config.fontSize ?? 58}</strong>
            </RowLabel>
            <input
              type="range"
              min={24}
              max={200}
              value={config.fontSize ?? 58}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>
              <span>24</span>
              <span>200</span>
            </div>
          </div>

          {/* Font Weight segmented toggle — blue selection (color law) */}
          <div>
            <RowLabel>Grosor</RowLabel>
            <div style={{ display: "flex", gap: "var(--s-4, 8px)", marginTop: "var(--s-2, 4px)" }}>
              <button
                type="button"
                onClick={() => onChange({ fontWeight: false })}
                style={segBtnStyle(config.fontWeight === false)}
              >
                Regular
              </button>
              <button
                type="button"
                onClick={() => onChange({ fontWeight: true })}
                style={segBtnStyle(config.fontWeight !== false)}
              >
                Negrita
              </button>
            </div>
          </div>

          {/* Font Style segmented toggle — blue selection (color law) */}
          <div>
            <RowLabel>Estilo de fuente</RowLabel>
            <div style={{ display: "flex", gap: "var(--s-4, 8px)", marginTop: "var(--s-2, 4px)" }}>
              <button
                type="button"
                onClick={() => onChange({ fontStyle: false })}
                style={segBtnStyle(config.fontStyle !== true)}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => onChange({ fontStyle: true })}
                style={segBtnStyle(config.fontStyle === true)}
              >
                Itálica
              </button>
            </div>
          </div>

          {/* Color matrix (2×2 grid) — stays 2×2 at all widths per sketch 018-B */}
          <div>
            <RowLabel>Colores</RowLabel>
            <div className="rf-color-matrix" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-4, 8px)" }}>
              <ColorControl
                label="Activa"
                value={config.activeColor ?? "#FFFF00"}
                onChange={(v) => onChange({ activeColor: v })}
              />
              <ColorControl
                label="Resaltada"
                value={config.highlightColor ?? "#FFFFFF"}
                onChange={(v) => onChange({ highlightColor: v })}
              />
              <ColorControl
                label="Inactiva"
                value={config.inactiveColor ?? "#FFFFFF"}
                onChange={(v) => onChange({ inactiveColor: v })}
              />
              <ColorControl
                label="Contorno"
                value={config.outlineColor ?? "#000000"}
                onChange={(v) => onChange({ outlineColor: v })}
              />
            </div>
          </div>

          {/* Outer Glow card */}
          <div style={{
            padding: "var(--s-6, 12px) var(--s-8, 16px)",
            background: "var(--surface, #1e1e2e)",
            borderRadius: "var(--r-md, 8px)",
            border: "1px solid var(--border, #333)",
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)", cursor: "pointer", marginBottom: "var(--s-4, 8px)" }}>
              <input
                type="checkbox"
                checked={glow.enabled}
                onChange={(e) => onChange({ outerGlow: { ...glow, enabled: e.target.checked } })}
              />
              <span style={{ fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], fontWeight: 600, color: "var(--text, #e6e6ea)" }}>
                Brillo exterior
              </span>
            </label>

            {glow.enabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5, 10px)", marginLeft: 24 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--s-2, 4px)" }}>
                  <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)" }}>Color</label>
                  <input
                    type="color"
                    value={glow.color}
                    onChange={(e) => onChange({ outerGlow: { ...glow, color: e.target.value } })}
                    style={{ width: 48, height: 36, border: "1px solid var(--border, #333)", borderRadius: "var(--r-xs, 4px)", padding: 2, background: "var(--surface-2, #252535)", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>{glow.color}</span>
                </div>
                <div>
                  <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)", display: "block", marginBottom: "var(--s-2, 4px)" }}>
                    Intensidad: {glow.intensity}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={glow.intensity}
                    onChange={(e) => onChange({ outerGlow: { ...glow, intensity: Number(e.target.value) } })}
                    style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)", display: "block", marginBottom: "var(--s-2, 4px)" }}>
                    Suavidad: {glow.softness}px
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={1}
                    value={glow.softness}
                    onChange={(e) => onChange({ outerGlow: { ...glow, softness: Number(e.target.value) } })}
                    style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          § 3  AVANZADO
          Contains: letterSpacing, lineHeight, pastWordOpacity,
                    highlightDuration/transition, subtitleWidth, outlineWidth,
                    backgroundHighlight
          Always-open titled section — NOT an accordion (UI-SPEC Layout Contract
          L236-243 overrides the literal "collapsed" wording in D-11/ROADMAP).
      ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader n={3} title="Avanzado" />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5, 10px)" }}>

          {/* Letter spacing */}
          <div>
            <RowLabel>
              Espaciado de letras: <strong style={{ color: "var(--text, #e6e6ea)" }}>{config.letterSpacing ?? 0}</strong>
            </RowLabel>
            <input
              type="range"
              min={-1}
              max={20}
              value={config.letterSpacing ?? 0}
              onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
            />
          </div>

          {/* Line height */}
          <div>
            <RowLabel>
              Altura de línea: <strong style={{ color: "var(--text, #e6e6ea)" }}>{config.lineHeight ?? 1.3}</strong>
            </RowLabel>
            <input
              type="range"
              min={0.8}
              max={3}
              step={0.1}
              value={config.lineHeight ?? 1.3}
              onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>
              <span>0.8</span>
              <span>3.0</span>
            </div>
          </div>

          {/* Past word opacity */}
          <div>
            <RowLabel>
              Opacidad palabra anterior: <strong style={{ color: "var(--text, #e6e6ea)" }}>{config.pastWordOpacity ?? 0.4}</strong>
            </RowLabel>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.pastWordOpacity ?? 0.4}
              onChange={(e) => onChange({ pastWordOpacity: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* Highlight duration */}
          <div>
            <RowLabel>
              Duración resaltado: <strong style={{ color: "var(--text, #e6e6ea)" }}>{config.highlightDurationMs ?? 200}ms</strong>
            </RowLabel>
            <input
              type="range"
              min={0}
              max={500}
              step={10}
              value={config.highlightDurationMs ?? 200}
              onChange={(e) => onChange({ highlightDurationMs: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>
              <span>0ms (off)</span>
              <span>500ms</span>
            </div>
          </div>

          {/* Highlight transition — blue selection (color law) */}
          <div>
            <RowLabel>Transición de resaltado</RowLabel>
            <div style={{ display: "flex", gap: "var(--s-4, 8px)" }}>
              <button
                type="button"
                onClick={() => onChange({ highlightTransition: "fade" })}
                style={segBtnStyle((config.highlightTransition ?? "fade") === "fade")}
              >
                Gradual
              </button>
              <button
                type="button"
                onClick={() => onChange({ highlightTransition: "instant" })}
                style={segBtnStyle(config.highlightTransition === "instant")}
              >
                Instantáneo
              </button>
            </div>
          </div>

          {/* Subtitle width */}
          <div>
            <RowLabel>
              Ancho subtítulos: <strong style={{ color: "var(--text, #e6e6ea)" }}>{(config.subtitleWidth ?? 0) || "auto"}</strong>
            </RowLabel>
            <input
              type="range"
              min={0}
              max={1080}
              step={10}
              value={config.subtitleWidth ?? 0}
              onChange={(e) => onChange({ subtitleWidth: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>
              <span>0 (auto)</span>
              <span>1080px</span>
            </div>
          </div>

          {/* Outline width */}
          <div>
            <RowLabel>
              Ancho contorno: <strong style={{ color: "var(--text, #e6e6ea)" }}>{config.outlineWidth ?? 3}</strong>
            </RowLabel>
            <input
              type="range"
              min={0}
              max={10}
              value={config.outlineWidth ?? 3}
              onChange={(e) => onChange({ outlineWidth: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
            />
          </div>

          {/* Background highlight card */}
          <div style={{
            padding: "var(--s-6, 12px) var(--s-8, 16px)",
            background: "var(--surface, #1e1e2e)",
            borderRadius: "var(--r-md, 8px)",
            border: "1px solid var(--border, #333)",
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)", cursor: "pointer", marginBottom: "var(--s-4, 8px)" }}>
              <input
                type="checkbox"
                checked={bh.enabled}
                onChange={(e) => onChange({
                  backgroundHighlight: { ...bh, enabled: e.target.checked },
                })}
              />
              <span style={{ fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], fontWeight: 600, color: "var(--text, #e6e6ea)" }}>
                Fondo resaltado
              </span>
            </label>

            {bh.enabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5, 10px)", marginLeft: 24 }}>
                <ColorControl
                  label="Color"
                  value={bh.color}
                  onChange={(v) => onChange({ backgroundHighlight: { ...bh, color: v } })}
                />
                <div>
                  <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)" }}>
                    Relleno: {bh.padding}px
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={32}
                    value={bh.padding}
                    onChange={(e) => onChange({ backgroundHighlight: { ...bh, padding: Number(e.target.value) } })}
                    style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)" }}>
                    Radio borde: {bh.borderRadius}px
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={bh.borderRadius}
                    onChange={(e) => onChange({ backgroundHighlight: { ...bh, borderRadius: Number(e.target.value) } })}
                    style={{ width: "100%", accentColor: "var(--accent, #90caf9)" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Color picker sub-component ────────────────────────────────────────────

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--s-2, 4px)" }}>
      <label style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-2, #a8a8b3)" }}>{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 48,
          height: 36,
          border: "1px solid var(--border, #333)",
          borderRadius: "var(--r-xs, 4px)",
          padding: 2,
          background: "var(--surface-2, #252535)",
          cursor: "pointer",
        }}
      />
      <span style={{ fontSize: "var(--t-xs, 11.5px)" as React.CSSProperties["fontSize"], color: "var(--text-faint, #555)" }}>{value}</span>
    </div>
  );
}
