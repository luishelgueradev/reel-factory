// ─── FontGridPage: Font grid view (D-12, D-13) ───────────────────────────────
// Per D-12: Separate route at /preview/fonts showing all 18 fonts.
// Per D-13: CSS font rendering with @remotion/google-fonts loadFont().
// Per D-13: Each card shows font name + sample text. Click selects and returns to /preview.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AVAILABLE_FONTS, loadFont } from "../../fonts";

const SAMPLE_TEXT = "Hola mundo ¿Cómo estás?";

function FontCard({
  fontName,
  onSelect,
}: {
  fontName: string;
  onSelect: (font: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadFont(fontName)
      .then(() => setLoaded(true))
      .catch(() => setLoaded(true)); // Continue even if font fails
  }, [fontName]);

  return (
    <div
      onClick={() => onSelect(fontName)}
      style={{
        padding: 16,
        background: "#1e1e2e",
        borderRadius: 8,
        border: "1px solid #333",
        cursor: "pointer",
        transition: "border-color 0.2s, background 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#4CAF50";
        e.currentTarget.style.background = "rgba(76, 175, 80, 0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#333";
        e.currentTarget.style.background = "#1e1e2e";
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#90caf9" }}>
        {fontName}
      </div>
      {loaded ? (
        <div style={{ fontSize: 24, fontFamily: fontName, color: "#e0e0e0" }}>
          {SAMPLE_TEXT}
        </div>
      ) : (
        <div style={{ fontSize: 24, fontFamily: "monospace", color: "#666" }}>
          Loading...
        </div>
      )}
    </div>
  );
}

export function FontGridPage() {
  const navigate = useNavigate();

  const handleSelectFont = (font: string) => {
    // Navigate back to preview with the selected font as a URL parameter
    navigate(`/preview?font=${encodeURIComponent(font)}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1a1a2e", color: "#e0e0e0" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#16213e",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="/preview"
            style={{
              color: "#90caf9",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            ← Back to Preview
          </a>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", margin: 0 }}>
            Font Grid
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
          Click a font to select it for subtitle preview
        </p>
      </header>

      {/* ── Font grid ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
          padding: 24,
        }}
      >
        {AVAILABLE_FONTS.map((fontName: string) => (
          <FontCard key={fontName} fontName={fontName} onSelect={handleSelectFont} />
        ))}
      </div>
    </div>
  );
}