// ─── PreviewApp: Unified StudioApp (Phase 22 — 3-column shell, D-01/D-02/D-10/D-11) ──
// Three-column layout: col1 preview (flex:0 1 470px, stage bg), col2 controls (flex:1, TabBar),
// col3 metadata placeholder (320px, always-visible, static).
// Header: ▶ Render Video (green, THE single CTA) | Guardar config (outline, never green).
// Tokens: default.css OKLCH token set inlined in index.html (:root block).
// Tabs: Títulos | Overlays | Subtítulos (Task 2 relocates TextareaInput into Subtítulos).

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { SubtitleConfig, TitleConfig, PngOverlayConfig } from "../pipeline-config";
import { DEFAULT_SUBTITLE_CONFIG } from "../pipeline-config";
import { PreviewPlayer } from "./PreviewPlayer";
import { TextareaInput } from "./TextareaInput";
import { textToCaptionPages, deriveTotalDurationMs, DEFAULT_SAMPLE_TEXT } from "./textToCaptions";
import { LayoutSelector } from "../editor/components/LayoutSelector";
import { StyleControls } from "../editor/components/StyleControls";
import { TitleEditor } from "../editor/components/TitleEditor";
import { OverlayEditor } from "../editor/components/OverlayEditor";
import type { TikTokPage } from "@remotion/captions";
import { loadFont, AVAILABLE_FONTS, getFontFamilyCSS } from "../fonts";

const INITIAL_SUBTITLE_CONFIG: SubtitleConfig = {
  layout: "tiktok",
  ...DEFAULT_SUBTITLE_CONFIG,
};

// ─── Tab definitions ───────────────────────────────────────────────────────────

// ─── Tab definitions (Phase 22 D-10) — Títulos | Overlays | Subtítulos (Text tab removed) ──
const TABS: { id: string; label: string }[] = [
  { id: "titles",    label: "Títulos"    },
  { id: "overlays",  label: "Overlays"   },
  { id: "subtitles", label: "Subtítulos" },
];

// ─── TabBar component ─────────────────────────────────────────────────────────

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid #333",
        background: "#16213e",
        padding: "0 24px",
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={isActive}
            onTabChange={onTabChange}
          />
        );
      })}
    </div>
  );
}

// ─── TabButton — extracted to avoid inline function recreation per render ─────

function TabButton({
  tab,
  isActive,
  onTabChange,
}: {
  tab: { id: string; label: string };
  isActive: boolean;
  onTabChange: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    padding: "12px 16px",
    minHeight: 44,
    border: "none",
    background: (!isActive && hovered) ? "rgba(255,255,255,0.04)" : "transparent",
    cursor: "pointer",
    fontSize: 14,
    borderBottom: isActive ? "2px solid #90caf9" : "2px solid transparent",
    color: isActive ? "#90caf9" : hovered ? "#e0e0e0" : "#aaa",
    fontWeight: isActive ? 600 : 400,
    transition: "color 0.15s, background 0.15s",
  };

  return (
    <button
      key={tab.id}
      onClick={() => onTabChange(tab.id)}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {tab.label}
    </button>
  );
}

// ─── FontCard component ───────────────────────────────────────────────────────

function FontCard({
  fontName,
  isSelected,
  onSelect,
}: {
  fontName: string;
  isSelected: boolean;
  onSelect: (font: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    loadFont(fontName)
      .then(() => setLoaded(true))
      .catch(() => setLoaded(true));
  }, [fontName]);

  return (
    <div
      onClick={() => onSelect(fontName)}
      style={{
        padding: 16,
        background: hovered ? "rgba(76, 175, 80, 0.08)" : "#1e1e2e",
        borderRadius: 8,
        cursor: "pointer",
        border: isSelected
          ? "2px solid #90caf9"
          : hovered
          ? "1px solid #4CAF50"
          : "1px solid #333",
        transition: "border-color 0.2s, background 0.2s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "#90caf9", marginBottom: 8 }}>
        {fontName}
      </div>
      {loaded ? (
        <div style={{ fontSize: 24, fontFamily: getFontFamilyCSS(fontName), color: "#e0e0e0" }}>
          Hola mundo
        </div>
      ) : (
        <div style={{ fontSize: 24, fontFamily: "monospace", color: "#666" }}>
          Loading...
        </div>
      )}
    </div>
  );
}

// ─── FontGrid component ───────────────────────────────────────────────────────

function FontGrid({
  selectedFont,
  onSelect,
}: {
  selectedFont: string | undefined;
  onSelect: (font: string) => void;
}) {
  return (
    <>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#90caf9",
          marginBottom: 8,
          marginTop: 16,
        }}
      >
        Browse Fonts
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {(AVAILABLE_FONTS as readonly string[]).filter((f) => f !== "monospace").map((fontName) => (
          <FontCard
            key={fontName}
            fontName={fontName}
            isSelected={selectedFont === fontName}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  );
}

// ─── PreviewApp: Unified StudioApp ────────────────────────────────────────────

export function PreviewApp() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(() => ({
    ...INITIAL_SUBTITLE_CONFIG,
  }));
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
  const [titles, setTitles] = useState<TitleConfig[]>([]);
  const [liveTitles, setLiveTitles] = useState<TitleConfig[]>([]);
  const [overlays, setOverlays] = useState<PngOverlayConfig[]>([]);
  const [liveOverlays, setLiveOverlays] = useState<PngOverlayConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("titles");
  // WR-03: Ref to track the save-success clear timeout so it can be cancelled
  // on unmount and on rapid re-saves, preventing state updates on unmounted components.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  const captionPages = useMemo(() => textToCaptionPages(sampleText), [sampleText]);
  const totalDurationMs = useMemo(
    () => deriveTotalDurationMs(captionPages, 10000),
    [captionPages]
  );

  // ── Config updater ──────────────────────────────────────────────────────────
  const updateSubtitle = useCallback((partial: Partial<SubtitleConfig>) => {
    setSubtitleConfig((prev: SubtitleConfig) => ({ ...prev, ...partial }));
  }, []);

  // ── Eagerly load default font on mount ──────────────────────────────────────
  useEffect(() => {
    loadFont("Inter").catch(() => {
      /* continue even if font fails */
    });
  }, []);

  // ── Load saved config from API on mount ─────────────────────────────────────
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.subtitle) {
          setSubtitleConfig((prev) => ({ ...prev, ...data.subtitle }));
        }
        if (data && Array.isArray(data.titles)) {
          // WR-04: Validate shape before entering state — pipeline-config.json may have
          // been hand-edited or migrated from an older schema. Missing numeric fields
          // would produce NaN in time-range calculations downstream.
          const validTitles = (data.titles as unknown[]).filter(
            (t): t is TitleConfig =>
              typeof t === "object" && t !== null &&
              typeof (t as TitleConfig).text === "string" &&
              typeof (t as TitleConfig).startTimeMs === "number" &&
              typeof (t as TitleConfig).durationMs === "number"
          );
          setTitles(validTitles);
        }
        if (data && Array.isArray(data.overlays)) {
          // Validate shape before entering state — pipeline-config.json may have
          // been hand-edited. Missing numeric/string fields would break the Player.
          const validOverlays = (data.overlays as unknown[]).filter(
            (o): o is PngOverlayConfig =>
              typeof o === "object" && o !== null &&
              typeof (o as PngOverlayConfig).imageData === "string" &&
              typeof (o as PngOverlayConfig).x === "number" &&
              typeof (o as PngOverlayConfig).y === "number" &&
              typeof (o as PngOverlayConfig).displayWidth === "number"
          );
          setOverlays(validOverlays);
        }
      })
      .catch(() => {
        /* use defaults */
      });
  }, []);

  // ── WR-03: Cancel save-success timeout on unmount ────────────────────────────
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Sync liveTitles to committed titles when not in draft-edit mode
  useEffect(() => {
    setLiveTitles(titles);
  }, [titles]);

  // Sync liveOverlays to committed overlays when not in draft-edit mode
  useEffect(() => {
    setLiveOverlays(overlays);
  }, [overlays]);

  // ── Save config to API (PUT /api/config) — manual save button ──────────────
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const payload = {
        subtitle: subtitleConfig,
        titles,
        overlays,
      };

      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error || `Save failed: ${res.status}`);
      }

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveSuccess(true);
      saveTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }, [subtitleConfig, titles, overlays]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--canvas, #1a1a2e)" }}>
      {/* ── Header — brand + Guardar config (outline) | ▶ Render Video (green CTA) ── */}
      <header
        style={{
          padding: "10px var(--s-12, 24px)",
          borderBottom: "1px solid var(--border, #333)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--chrome, #16213e)",
          minHeight: 48,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)" }}>
          <span style={{ fontSize: "var(--t-lg, 16px)", color: "var(--text-muted, #777)" }}>▶</span>
          <h1 style={{ fontSize: "var(--t-base, 14px)", fontWeight: 600, color: "var(--text, #e6e6ea)", margin: 0 }}>
            Reel Factory Studio
          </h1>
        </div>

        {/* ── Right zone: status + button group ─────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4, 8px)" }}>
          {/* Save status chips */}
          {saveSuccess && (
            <span style={{
              fontSize: "var(--t-sm, 12.5px)",
              color: "var(--success, #81C784)",
              padding: "3px var(--s-4, 8px)",
              borderRadius: "var(--r-full, 999px)",
              border: "1px solid var(--success, #81C784)",
            }}>
              ✓ Guardado recién
            </span>
          )}
          {saveError && (
            <span style={{
              fontSize: "var(--t-sm, 12.5px)",
              color: "var(--danger, #e57373)",
              padding: "3px var(--s-4, 8px)",
              borderRadius: "var(--r-full, 999px)",
              border: "1px solid var(--danger, #e57373)",
            }}>
              ✕ Error al guardar
            </span>
          )}

          {/* Hairline divider before buttons */}
          <div style={{ width: 1, height: 20, background: "var(--border, #333)", margin: "0 2px" }} />

          {/* Guardar config — OUTLINE, never green (color law) */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "7px 14px",
              background: "transparent",
              color: saving ? "var(--text-muted, #777)" : "var(--text, #e6e6ea)",
              border: "1px solid var(--border-strong, #444)",
              borderRadius: "var(--r-sm, 6px)",
              cursor: saving ? "wait" : "pointer",
              fontSize: "var(--t-sm, 12.5px)",
              fontWeight: 400,
              transition: "border-color var(--dur, 170ms) var(--ease), color var(--dur, 170ms) var(--ease)",
              minHeight: 32,
            }}
          >
            {saving ? "Guardando…" : "Guardar config"}
          </button>

          {/* ▶ Render Video — THE single green CTA (color law: never two greens) */}
          <button
            disabled
            title="Próximamente — renderizado vía pipeline API"
            style={{
              padding: "7px 16px",
              background: "var(--action, #4CAF50)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--r-sm, 6px)",
              cursor: "not-allowed",
              fontSize: "var(--t-sm, 12.5px)",
              fontWeight: 600,
              opacity: 0.65,
              minHeight: 32,
            }}
          >
            ▶ Render Video
          </button>
        </div>
      </header>

      {/* ── Main content: 3-column layout (D-01) ──────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Col 1: 9:16 Preview Player — flex:0 1 470px, stage bg ─────────── */}
        <div
          style={{
            flex: "0 1 470px",
            minWidth: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--s-8, 16px)",
            background: "var(--stage, #111)",
            borderRight: "1px solid var(--border, #333)",
          }}
        >
          <PreviewPlayer
            subtitleConfig={subtitleConfig}
            captionPages={captionPages}
            totalDurationMs={totalDurationMs}
            titles={liveTitles}
            overlays={liveOverlays}
          />
        </div>

        {/* ── Col 2: Controls — TabBar + tab content panels ─────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--surface, #1e1e2e)",
          }}
        >
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab content wrapper */}
          <div style={{ flex: 1, overflowY: "auto", padding: "var(--s-12, 24px)" }}>
            {/* Titles tab */}
            <div style={{ display: activeTab === "titles" ? "block" : "none" }}>
              <TitleEditor titles={titles} onChange={setTitles} onPreviewChange={setLiveTitles} />
            </div>

            {/* Overlays tab */}
            <div style={{ display: activeTab === "overlays" ? "block" : "none" }}>
              <OverlayEditor
                overlays={overlays}
                onChange={(updated) => { setOverlays(updated); setLiveOverlays(updated); }}
                onPreviewChange={setLiveOverlays}
              />
            </div>

            {/* Subtítulos tab — TextareaInput at TOP (D-10), drives captionPages→PreviewPlayer */}
            <div style={{ display: activeTab === "subtitles" ? "block" : "none" }}>
              {/* Sample text textarea — MUST stay at top; sampleText → captionPages (L224 useMemo) → PreviewPlayer */}
              <div style={{ marginBottom: "var(--s-10, 20px)" }}>
                <TextareaInput
                  value={sampleText}
                  onChange={setSampleText}
                  placeholder="Cómo edité este reel en 30 segundos…"
                />
                {/* Role cue: blue dot = var(--accent) per UI-SPEC */}
                <div style={{
                  marginTop: "var(--s-2, 4px)",
                  fontSize: "var(--t-xs, 11.5px)",
                  color: "var(--accent, #90caf9)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-2, 4px)",
                }}>
                  <span style={{ color: "var(--accent, #90caf9)", fontSize: "0.7em" }}>●</span>
                  Alimenta los subtítulos · no se exporta
                </div>
              </div>
              <LayoutSelector
                value={subtitleConfig.layout}
                onChange={(layout) => updateSubtitle({ layout })}
              />
              <StyleControls config={subtitleConfig} onChange={updateSubtitle} />
              <FontGrid
                selectedFont={subtitleConfig.fontFamily}
                onSelect={(font) => updateSubtitle({ fontFamily: font })}
              />
            </div>
          </div>
        </div>

        {/* ── Col 3: Metadata placeholder — 320px, always-visible (D-01/D-02) ─ */}
        {/* Hidden below 1024px viewport (CSS media query via inline conditional not possible — col3 renders */}
        {/* but we use a dedicated class via a <style> block or rely on the viewport-width hidden pattern) */}
        <div
          className="col3-metadata"
          style={{
            width: 320,
            flexShrink: 0,
            flexGrow: 0,
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid var(--border, #333)",
            background: "var(--surface, #1e1e2e)",
            padding: "var(--s-12, 24px) var(--s-8, 16px)",
            overflowY: "auto",
          }}
        >
          {/* Metadata placeholder card — NO state, NO fetch, NO controls (D-02) */}
          <div
            style={{
              background: "var(--surface-2, #252535)",
              borderRadius: "var(--r-md, 8px)",
              border: "1px solid var(--border-faint, #2a2a38)",
              padding: "var(--s-6, 12px)",
            }}
          >
            <div
              style={{
                fontSize: "var(--t-base, 14px)",
                fontWeight: 600,
                color: "var(--text, #e6e6ea)",
                marginBottom: "var(--s-3, 6px)",
              }}
            >
              Metadata de redes
            </div>
            <p
              style={{
                fontSize: "var(--t-sm, 12.5px)",
                color: "var(--text-muted, #777)",
                fontStyle: "italic",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Próximamente — descripción, hashtags y más generados a partir de tus subtítulos.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
