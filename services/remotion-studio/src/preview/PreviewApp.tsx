// ─── PreviewApp: Main preview page (D-08) ──────────────────────────────────────
// 9:16 viewport on the left (~40%), collapsible control panels on the right (~60%).
// Per D-04: Uses @remotion/player with SubtitledVideo for pixel-accurate preview.
// Per D-03: All SubtitleConfig parameters adjustable in real-time (no page reload).
// Per D-11: Editable textarea with Spanish default text.
// Per D-08: Layout mirrors existing /editor pattern.

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { SubtitleConfig, TitleConfig } from "../pipeline-config";
import { DEFAULT_SUBTITLE_CONFIG } from "../pipeline-config";
import { PreviewPlayer } from "./PreviewPlayer";
import { TextareaInput } from "./TextareaInput";
import { textToCaptionPages, deriveTotalDurationMs, DEFAULT_SAMPLE_TEXT } from "./textToCaptions";
import { LayoutSelector } from "../editor/components/LayoutSelector";
import { StyleControls } from "../editor/components/StyleControls";
import { TitleEditor } from "../editor/components/TitleEditor";
import type { TikTokPage } from "@remotion/captions";
import { loadFont } from "../fonts";

const INITIAL_SUBTITLE_CONFIG: SubtitleConfig = {
  layout: "tiktok",
  ...DEFAULT_SUBTITLE_CONFIG,
};

export function PreviewApp() {
  // ── Read font selection from URL params (from FontGridPage) ────────────────
  const [searchParams] = useSearchParams();

  // ── State ──────────────────────────────────────────────────────────────────
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(() => {
    const fontFromUrl = searchParams.get("font");
    return {
      ...INITIAL_SUBTITLE_CONFIG,
      ...(fontFromUrl ? { fontFamily: fontFromUrl } : {}),
    };
  });
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
  const [titles, setTitles] = useState<TitleConfig[]>([]);
  const [previewTitles, setPreviewTitles] = useState<TitleConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
          setPreviewTitles(data.titles);
        }
      })
      .catch(() => {
        /* use defaults */
      });
  }, []);

  // ── Save config to API (PUT /api/config) — manual save button ──────────────
  const handleSave = useCallback(async (updatedTitles?: TitleConfig[]) => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const payload = {
        subtitle: subtitleConfig,
        titles: updatedTitles ?? titles,
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
      if (updatedTitles) {
        setTitles(updatedTitles);
        setPreviewTitles(updatedTitles);
      }
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
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            to="/editor"
            style={{
              color: "#90caf9",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            ← Editor
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", margin: 0 }}>
            Subtitle Preview Lab
          </h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            to="/preview/fonts"
            style={{
              padding: "8px 16px",
              background: "#333",
              color: "#e0e0e0",
              border: "1px solid #555",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            Font Grid
          </Link>
          <button
            onClick={() => handleSave()}
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
        </div>
      </header>

      {/* ── Status messages ──────────────────────────────────────────────── */}
      {saveSuccess && (
        <div style={{ padding: "8px 24px", background: "#1b5e20", color: "#a5d6a7", fontSize: 14 }}>
          ✓ Configuration saved successfully
        </div>
      )}
      {saveError && (
        <div style={{ padding: "8px 24px", background: "#b71c1c", color: "#ef9a9a", fontSize: 14 }}>
          Error: {saveError}
        </div>
      )}

      {/* ── Main content: Player + Controls ────────────────────────────── */}
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
            titles={previewTitles}
          />
        </div>

        {/* ── Right panel: Collapsible control sections ────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {/* Layout mode */}
          <section>
            <CollapsibleSection title="Subtitle Layout">
              <LayoutSelector
                value={subtitleConfig.layout}
                onChange={(layout) => updateSubtitle({ layout })}
              />
            </CollapsibleSection>
          </section>

          {/* Style controls */}
          <section>
            <CollapsibleSection title="Subtitle Style" defaultOpen={true}>
              <StyleControls config={subtitleConfig} onChange={updateSubtitle} />
            </CollapsibleSection>
          </section>

          {/* Title overlays */}
          <section>
            <CollapsibleSection title="Title Overlays" defaultOpen={false}>
              <TitleEditor titles={titles} onChange={setTitles} onPreviewChange={setPreviewTitles} onSave={handleSave} />
            </CollapsibleSection>
          </section>

          {/* Sample text */}
          <section>
            <CollapsibleSection title="Sample Text" defaultOpen={true}>
              <TextareaInput value={sampleText} onChange={setSampleText} />
            </CollapsibleSection>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible section helper ────────────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div style={{ borderRadius: 8, border: "1px solid #333", background: "#1e1e2e" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "transparent",
          border: "none",
          color: "#90caf9",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {title}
        <span style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          ▼
        </span>
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}