// ─── Config Editor: Editor Page Component (extracted from App.tsx for routing) ──
// Per D-16: Web UI for selecting subtitle styles, layout modes, title overlays,
// and triggering renders. Per D-15: Config changes reflected in Remotion Studio preview.
// Per D-20: Render trigger button sends request to start production render.

import React, { useState, useEffect, useCallback } from "react";
import type { PipelineConfig, SubtitleConfig, TitleConfig } from "../pipeline-config.js";
import { LayoutSelector } from "./components/LayoutSelector.js";
import { StyleControls } from "./components/StyleControls.js";
import { TitleEditor } from "./components/TitleEditor.js";
import { ConfigPreview } from "./components/ConfigPreview.js";
import { Link } from "react-router-dom";

const DEFAULT_CONFIG: PipelineConfig = {
  subtitle: {
    layout: "tiktok",
  },
  titles: [],
};

export function EditorApp() {
  const [config, setConfig] = useState<PipelineConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // ── Load config on mount (GET /api/config) ──────────────────────────────
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
      const data = await res.json();
      // Strip _meta from server response
      const { _meta, ...rawConfig } = data as PipelineConfig & { _meta?: unknown };
      setConfig(rawConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
      // Keep default config on error
    } finally {
      setLoading(false);
    }
  };

  // ── Save config (PUT /api/config) (D-16) ────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error || `Save failed: ${res.status}`);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }, [config]);

  // ── Render trigger (D-20 scaffolding) ───────────────────────────────────
  const handleRender = useCallback(async () => {
    try {
      setRendering(true);
      setRenderError(null);

      const res = await fetch("/api/render", { method: "POST" });
      const data = await res.json();

      if (res.status === 501) {
        // Render not yet implemented — expected
        setRenderError("Render trigger not yet implemented. Coming soon!");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `Render failed: ${res.status}`);
      }
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "Render request failed");
    } finally {
      setRendering(false);
    }
  }, []);

  // ── Config updaters ─────────────────────────────────────────────────────
  const updateSubtitle = useCallback((partial: Partial<SubtitleConfig>) => {
    setConfig((prev: PipelineConfig) => ({
      ...prev,
      subtitle: { ...prev.subtitle, ...partial },
    }));
  }, []);

  const updateTitles = useCallback((titles: TitleConfig[]) => {
    setConfig((prev: PipelineConfig) => ({ ...prev, titles }));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p style={{ fontSize: 18 }}>Loading configuration…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: 1200, margin: "0 auto" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        padding: "16px 24px",
        borderBottom: "1px solid #333",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#16213e",
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff" }}>
          Remotion Config Editor
        </h1>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            to="/preview"
            style={{
              padding: "8px 20px",
              background: "#9C27B0",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Preview Lab
          </Link>
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
            {saving ? "Saving…" : "Save Config"}
          </button>
          <button
            onClick={handleRender}
            disabled={rendering}
            style={{
              padding: "8px 20px",
              background: rendering ? "#555" : "#2196F3",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: rendering ? "wait" : "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {rendering ? "Starting…" : "Render Video"}
          </button>
        </div>
      </header>

      {/* ── Status messages ───────────────────────────────────────────── */}
      {saveSuccess && (
        <div style={{ padding: "8px 24px", background: "#1b5e20", color: "#a5d6a7", fontSize: 14 }}>
          ✓ Configuration saved successfully
        </div>
      )}
      {error && (
        <div style={{ padding: "8px 24px", background: "#b71c1c", color: "#ef9a9a", fontSize: 14 }}>
          Error: {error}
        </div>
      )}
      {renderError && (
        <div style={{ padding: "8px 24px", background: "#e65100", color: "#ffcc80", fontSize: 14 }}>
          {renderError}
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left panel: Config controls ──────────────────────────────── */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: 24,
          borderRight: "1px solid #333",
        }}>
          {/* Layout mode (D-04, D-16) */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#90caf9", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              Subtitle Layout
            </h2>
            <LayoutSelector
              value={config.subtitle.layout}
              onChange={(layout) => updateSubtitle({ layout })}
            />
          </section>

          {/* Style controls (D-16) */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#90caf9", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              Subtitle Style
            </h2>
            <StyleControls
              config={config.subtitle}
              onChange={updateSubtitle}
            />
          </section>

          {/* Title overlays (D-16, D-12) */}
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#90caf9", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              Title Overlays
            </h2>
            <TitleEditor
              titles={config.titles ?? []}
              onChange={updateTitles}
            />
          </section>
        </div>

        {/* ── Right panel: Config preview ──────────────────────────────── */}
        <div style={{ width: 400, overflowY: "auto", padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#90caf9", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            Config Preview
          </h2>
          <ConfigPreview config={config} />
        </div>
      </div>
    </div>
  );
}