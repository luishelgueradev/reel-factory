// ─── PreviewApp: Unified StudioApp (Phase 18 — D-01, D-02, D-03, D-04, D-06, D-07, D-08, D-09, D-10) ──
// Two-column layout: left 40% live 9:16 Player, right panel with TabBar + three tab panels.
// Tabs: Titles (default), Subtitles, Text.
// Title state unified — single source of truth for titles (D-10).
// Font Grid inline in Subtitles tab (D-06).
// Render Video button disabled / coming-soon (D-05).

import React, { useState, useCallback, useMemo, useEffect } from "react";
import type { SubtitleConfig, TitleConfig } from "../pipeline-config";
import { DEFAULT_SUBTITLE_CONFIG } from "../pipeline-config";
import { PreviewPlayer } from "./PreviewPlayer";
import { TextareaInput } from "./TextareaInput";
import { textToCaptionPages, deriveTotalDurationMs, DEFAULT_SAMPLE_TEXT } from "./textToCaptions";
import { LayoutSelector } from "../editor/components/LayoutSelector";
import { StyleControls } from "../editor/components/StyleControls";
import { TitleEditor } from "../editor/components/TitleEditor";
import type { TikTokPage } from "@remotion/captions";
import { loadFont, AVAILABLE_FONTS, getFontFamilyCSS } from "../fonts";

const INITIAL_SUBTITLE_CONFIG: SubtitleConfig = {
  layout: "tiktok",
  ...DEFAULT_SUBTITLE_CONFIG,
};

// ─── Tab definitions ───────────────────────────────────────────────────────────

const TABS: { id: string; label: string }[] = [
  { id: "titles",    label: "Titles"    },
  { id: "subtitles", label: "Subtitles" },
  { id: "text",      label: "Text"      },
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
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("titles");

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
        if (data && data.titles) {
          setTitles(data.titles);
        }
      })
      .catch(() => {
        /* use defaults */
      });
  }, []);

  // ── Save config to API (PUT /api/config) — manual save button ──────────────
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const payload = {
        subtitle: subtitleConfig,
        titles,
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

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }, [subtitleConfig, titles]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1a1a2e" }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#16213e",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", margin: 0 }}>
          Reel Factory Studio
        </h1>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            disabled
            title="Coming soon — rendering via pipeline API"
            style={{
              background: "#333",
              color: "#777",
              border: "1px solid #444",
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: 14,
              cursor: "not-allowed",
              opacity: 0.6,
            }}
          >
            Render Video
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 20px",
              background: saving ? "#555" : "#4CAF50",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: saving ? "wait" : "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {saving ? "Saving..." : "Save Config"}
          </button>
        </div>
      </header>

      {/* ── Status messages ──────────────────────────────────────────────── */}
      {saveSuccess && (
        <div style={{ padding: "8px 24px", background: "#1b5e20", color: "#a5d6a7", fontSize: 14 }}>
          Configuration saved successfully
        </div>
      )}
      {saveError && (
        <div style={{ padding: "8px 24px", background: "#b71c1c", color: "#ef9a9a", fontSize: 14 }}>
          Save failed: {saveError}
        </div>
      )}

      {/* ── Main content: Two-column layout ────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left panel: 9:16 Preview Player ──────────────────────────────── */}
        <div
          style={{
            width: "40%",
            minWidth: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "#111",
            borderRight: "1px solid #333",
          }}
        >
          <PreviewPlayer
            subtitleConfig={subtitleConfig}
            captionPages={captionPages}
            totalDurationMs={totalDurationMs}
            titles={titles}
          />
        </div>

        {/* ── Right panel: TabBar + tab content ────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab content wrapper */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            {/* Titles tab */}
            <div style={{ display: activeTab === "titles" ? "block" : "none" }}>
              <TitleEditor titles={titles} onChange={setTitles} />
            </div>

            {/* Subtitles tab */}
            <div style={{ display: activeTab === "subtitles" ? "block" : "none" }}>
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

            {/* Text tab */}
            <div style={{ display: activeTab === "text" ? "block" : "none" }}>
              <TextareaInput value={sampleText} onChange={setSampleText} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
