// ─── MetadataPanel: AI social metadata for col3 (Phase 25, Plan 03) ──────────
// Design contract: 25-UI-SPEC.md + sketch-findings-reel-factory `AI metadata column` (026-C)
//
// Green discipline: this component uses ONLY --accent/--danger. NEVER --action.
// --action (green) is RESERVED for Render / Guardar config in the header.
//
// States:
//   empty     — no jobId; Generar disabled + muted hint
//   ready     — jobId set, no generated result yet; Generar enabled
//   generating — fetch in flight; shimmer + spinner; controls disabled
//   generated  — fields populated, editable, copyable; Regenerar available
//   error      — inline --danger line + Reintentar
//
// Props: { jobId: string | null }
// API: POST /api/metadata { jobId, platform, tone } → { title, description, hashtags, _meta }
//      GET  /api/metadata/:jobId → restores persisted result (D-05)

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { PLATFORMS, TONES } from "../metadata.js";
import type { Metadata } from "../metadata.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Platform = keyof typeof PLATFORMS;
type Tone = keyof typeof TONES;
type PanelState = "empty" | "ready" | "generating" | "generated" | "error";

interface GeneratedResult extends Metadata {
  _meta?: { model?: string; backend?: string };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export interface MetadataPanelProps {
  jobId: string | null;
}

export function MetadataPanel({ jobId }: MetadataPanelProps) {
  // ── Platform / Tone selectors ─────────────────────────────────────────────
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [tone, setTone] = useState<Tone>("cercano");

  // ── Panel state ────────────────────────────────────────────────────────────
  const [panelState, setPanelState] = useState<PanelState>(jobId ? "ready" : "empty");
  const [error, setError] = useState<string | null>(null);

  // ── Generated result (editable) ──────────────────────────────────────────
  const [result, setResult] = useState<GeneratedResult | null>(null);

  // ── Local field editors (edits stay in UI state) ─────────────────────────
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editHashtagsText, setEditHashtagsText] = useState(""); // space/newline-joined

  // ── Transient copy chips: field → timer ref ───────────────────────────────
  const [copyChip, setCopyChip] = useState<"title" | "description" | "hashtags" | null>(null);
  const copyChipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Sync panelState when jobId changes ──────────────────────────────────
  useEffect(() => {
    if (!jobId) {
      setPanelState("empty");
      // Clear result on jobId lost
      setResult(null);
      setError(null);
      return;
    }

    // jobId became available or changed: try to restore persisted result
    const controller = new AbortController();
    setPanelState("ready"); // optimistic ready while we check
    setError(null);

    fetch(`/api/metadata/${jobId}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) {
          // No persisted result — stay ready
          setPanelState("ready");
          return;
        }
        if (!res.ok) {
          // Server error restoring — stay ready (non-blocking)
          setPanelState("ready");
          return;
        }
        const data = await res.json() as GeneratedResult;
        setResult(data);
        setEditTitle(data.title ?? "");
        setEditDescription(data.description ?? "");
        setEditHashtagsText(
          Array.isArray(data.hashtags) ? data.hashtags.join(" ") : ""
        );
        setPanelState("generated");
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Silently fall back to ready (not a user-visible error; they can Generar)
        setPanelState("ready");
      });

    return () => controller.abort();
  }, [jobId]);

  // ── Cleanup copy chip timer on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (copyChipRef.current) clearTimeout(copyChipRef.current);
    };
  }, []);

  // ── Generate / Regenerate ─────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!jobId || panelState === "generating") return;

    setPanelState("generating");
    setError(null);

    try {
      const res = await fetch("/api/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, platform, tone }),
      });

      const data = await res.json() as GeneratedResult & { error?: string };

      if (!res.ok) {
        const errMsg = data?.error ?? `Error ${res.status}`;
        setError(errMsg);
        setPanelState("error");
        return;
      }

      setResult(data);
      setEditTitle(data.title ?? "");
      setEditDescription(data.description ?? "");
      setEditHashtagsText(
        Array.isArray(data.hashtags) ? data.hashtags.join(" ") : ""
      );
      setPanelState("generated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      setError(msg);
      setPanelState("error");
    }
  }, [jobId, panelState, platform, tone]);

  // ── Copy field to clipboard ───────────────────────────────────────────────
  const copyField = useCallback(
    async (field: "title" | "description" | "hashtags") => {
      let text = "";
      if (field === "title") text = editTitle;
      if (field === "description") text = editDescription;
      if (field === "hashtags") text = editHashtagsText.trim();

      try {
        await navigator.clipboard.writeText(text);
        if (copyChipRef.current) clearTimeout(copyChipRef.current);
        setCopyChip(field);
        copyChipRef.current = setTimeout(() => setCopyChip(null), 2000);
      } catch {
        // Clipboard unavailable — silently skip
      }
    },
    [editTitle, editDescription, editHashtagsText]
  );

  // ── Retry after error ─────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (!jobId) return;
    setPanelState("ready");
    setError(null);
  }, [jobId]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const hasResult = panelState === "generated";
  const isGenerating = panelState === "generating";
  const isDisabled = !jobId || isGenerating;

  const platformLabel = PLATFORMS[platform]?.label ?? platform;
  const toneLabel = TONES[tone]?.label ?? tone;

  // Hashtag chips — parse the text back into chips for display
  const hashtagChips = editHashtagsText
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.startsWith("#") && t.length > 1);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-6, 12px)",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-3, 6px)",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "var(--t-base, 14px)",
            fontWeight: 600,
            color: "var(--text, #e6e6ea)",
          }}
        >
          Metadata de redes
        </span>
        {/* Backend chip — shown when generated */}
        {hasResult && result?._meta?.model && (
          <span
            style={{
              fontSize: "var(--t-2xs, 10.5px)",
              color: "var(--accent, #90caf9)",
              background: "var(--accent-tint, rgba(144,202,249,0.08))",
              border: "1px solid var(--accent-strong, #6ba8e0)",
              borderRadius: "var(--r-full, 999px)",
              padding: "2px 6px",
              whiteSpace: "nowrap",
            }}
          >
            {result._meta.model}
          </span>
        )}
      </div>

      {/* ── Controls row: Platform + Tone selectors ─────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-3, 6px)",
        }}
      >
        {/* Platform selector */}
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-1, 2px)",
          }}
        >
          <span
            style={{
              fontSize: "var(--t-xs, 11.5px)",
              color: "var(--text-muted, #777)",
              fontWeight: 500,
            }}
          >
            Plataforma
          </span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            disabled={isGenerating}
            aria-label="Plataforma"
            style={{
              width: "100%",
              padding: "5px var(--s-5, 10px)",
              background: "var(--surface-2, #252535)",
              color: "var(--text, #e6e6ea)",
              border: "1px solid var(--border, #333)",
              borderRadius: "var(--r-sm, 6px)",
              fontSize: "var(--t-sm, 12.5px)",
              cursor: isGenerating ? "not-allowed" : "pointer",
              outline: "none",
            }}
          >
            {Object.entries(PLATFORMS).map(([key, spec]) => (
              <option key={key} value={key}>
                {spec.label}
              </option>
            ))}
          </select>
        </label>

        {/* Tone selector */}
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-1, 2px)",
          }}
        >
          <span
            style={{
              fontSize: "var(--t-xs, 11.5px)",
              color: "var(--text-muted, #777)",
              fontWeight: 500,
            }}
          >
            Tono
          </span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            disabled={isGenerating}
            aria-label="Tono"
            style={{
              width: "100%",
              padding: "5px var(--s-5, 10px)",
              background: "var(--surface-2, #252535)",
              color: "var(--text, #e6e6ea)",
              border: "1px solid var(--border, #333)",
              borderRadius: "var(--r-sm, 6px)",
              fontSize: "var(--t-sm, 12.5px)",
              cursor: isGenerating ? "not-allowed" : "pointer",
              outline: "none",
            }}
          >
            {Object.entries(TONES).map(([key, spec]) => (
              <option key={key} value={key}>
                {spec.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Primary action: Generar / Regenerar ─────────────────────────── */}
      {/* IMPORTANT: uses --accent (blue), NEVER --action (green) — UI-SPEC discipline */}
      <button
        onClick={handleGenerate}
        disabled={isDisabled}
        aria-label={hasResult ? `Regenerar metadata para ${platformLabel}, tono ${toneLabel}` : "Generar metadata"}
        style={{
          width: "100%",
          padding: "8px var(--s-6, 12px)",
          background: isDisabled
            ? "var(--surface-2, #252535)"
            : "var(--accent-tint, rgba(144,202,249,0.08))",
          color: isDisabled ? "var(--text-muted, #777)" : "var(--accent, #90caf9)",
          border: isDisabled
            ? "1px solid var(--border, #333)"
            : "1px solid var(--accent-strong, #6ba8e0)",
          borderRadius: "var(--r-sm, 6px)",
          cursor: isDisabled ? "not-allowed" : "pointer",
          fontSize: "var(--t-sm, 12.5px)",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--s-2, 4px)",
          transition: "opacity var(--dur, 170ms) var(--ease), background var(--dur, 170ms) var(--ease)",
          minHeight: 36,
        }}
      >
        {isGenerating ? (
          <>
            <Spinner />
            <span>Generando…</span>
          </>
        ) : hasResult ? (
          <span>↻ Regenerar</span>
        ) : (
          <span>✨ Generar metadata</span>
        )}
      </button>

      {/* ── Disabled hint when no jobId ────────────────────────────────── */}
      {panelState === "empty" && (
        <p
          style={{
            fontSize: "var(--t-xs, 11.5px)",
            color: "var(--text-muted, #777)",
            margin: 0,
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          Generá un render para crear la metadata.
        </p>
      )}

      {/* ── Error state: inline --danger line + Reintentar ────────────── */}
      {panelState === "error" && error && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-2, 4px)",
          }}
        >
          <p
            style={{
              fontSize: "var(--t-xs, 11.5px)",
              color: "var(--danger, #e57373)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {error}
          </p>
          <button
            onClick={handleRetry}
            style={{
              alignSelf: "flex-start",
              padding: "4px var(--s-5, 10px)",
              background: "transparent",
              color: "var(--accent, #90caf9)",
              border: "1px solid var(--accent-strong, #6ba8e0)",
              borderRadius: "var(--r-sm, 6px)",
              cursor: "pointer",
              fontSize: "var(--t-xs, 11.5px)",
              fontWeight: 500,
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Generating shimmer (fields skeleton) ─────────────────────── */}
      {isGenerating && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--s-6, 12px)" }}
          aria-hidden="true"
        >
          <ShimmerField label="Título" height={32} />
          <ShimmerField label="Descripción" height={72} />
          <ShimmerField label="Hashtags" height={28} />
        </div>
      )}

      {/* ── Generated result: editable fields + copy buttons ─────────── */}
      {hasResult && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--s-8, 16px)" }}
        >
          {/* Título */}
          <FieldBlock
            label="Título"
            onCopy={() => copyField("title")}
            showChip={copyChip === "title"}
          >
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              aria-label="Título"
              style={{
                width: "100%",
                padding: "var(--s-3, 6px) var(--s-5, 10px)",
                background: "var(--surface-2, #252535)",
                color: "var(--text, #e6e6ea)",
                border: "1px solid var(--border, #333)",
                borderRadius: "var(--r-sm, 6px)",
                fontSize: "var(--t-sm, 12.5px)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </FieldBlock>

          {/* Descripción */}
          <FieldBlock
            label="Descripción"
            onCopy={() => copyField("description")}
            showChip={copyChip === "description"}
          >
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              aria-label="Descripción"
              rows={4}
              style={{
                width: "100%",
                padding: "var(--s-3, 6px) var(--s-5, 10px)",
                background: "var(--surface-2, #252535)",
                color: "var(--text, #e6e6ea)",
                border: "1px solid var(--border, #333)",
                borderRadius: "var(--r-sm, 6px)",
                fontSize: "var(--t-sm, 12.5px)",
                resize: "vertical",
                lineHeight: 1.5,
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </FieldBlock>

          {/* Hashtags */}
          <FieldBlock
            label="Hashtags"
            onCopy={() => copyField("hashtags")}
            showChip={copyChip === "hashtags"}
          >
            {/* Chips display */}
            {hashtagChips.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--s-2, 4px)",
                  marginBottom: "var(--s-2, 4px)",
                }}
              >
                {hashtagChips.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      color: "var(--accent, #90caf9)",
                      background: "var(--accent-tint, rgba(144,202,249,0.08))",
                      border: "1px solid var(--accent-strong, #6ba8e0)",
                      borderRadius: "var(--r-full, 999px)",
                      padding: "2px var(--s-5, 10px)",
                      fontSize: "var(--t-xs, 11.5px)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {/* Editable text for hashtags */}
            <textarea
              value={editHashtagsText}
              onChange={(e) => setEditHashtagsText(e.target.value)}
              aria-label="Hashtags"
              rows={2}
              placeholder="#hashtag1 #hashtag2"
              style={{
                width: "100%",
                padding: "var(--s-3, 6px) var(--s-5, 10px)",
                background: "var(--surface-2, #252535)",
                color: "var(--text, #e6e6ea)",
                border: "1px solid var(--border, #333)",
                borderRadius: "var(--r-sm, 6px)",
                fontSize: "var(--t-sm, 12.5px)",
                resize: "none",
                lineHeight: 1.5,
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
          </FieldBlock>
        </div>
      )}
    </div>
  );
}

// ─── FieldBlock: labeled block with copy button + ✓ Copiado chip ────────────

function FieldBlock({
  label,
  onCopy,
  showChip,
  children,
}: {
  label: string;
  onCopy: () => void;
  showChip: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2, 4px)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-3, 6px)",
        }}
      >
        <span
          style={{
            fontSize: "var(--t-xs, 11.5px)",
            color: "var(--text-muted, #777)",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2, 4px)" }}>
          {/* ✓ Copiado transient chip — mirrors PreviewApp "✓ Guardado recién" pattern */}
          {showChip && (
            <span
              aria-live="polite"
              style={{
                fontSize: "var(--t-2xs, 10.5px)",
                color: "var(--accent, #90caf9)",
                padding: "2px 6px",
                borderRadius: "var(--r-full, 999px)",
                border: "1px solid var(--accent, #90caf9)",
              }}
            >
              ✓ Copiado
            </span>
          )}
          <button
            onClick={onCopy}
            aria-label={`Copiar ${label}`}
            title={`Copiar ${label}`}
            style={{
              padding: "3px 6px",
              background: "transparent",
              color: "var(--text-muted, #777)",
              border: "1px solid var(--border, #333)",
              borderRadius: "var(--r-sm, 6px)",
              cursor: "pointer",
              fontSize: "var(--t-2xs, 10.5px)",
              lineHeight: 1,
              transition: "color var(--dur, 170ms) var(--ease), border-color var(--dur, 170ms) var(--ease)",
            }}
          >
            📋
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Spinner: accent-colored, respects prefers-reduced-motion ────────────────

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        border: "2px solid var(--accent, #90caf9)",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "mp-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ─── ShimmerField: skeleton while generating ─────────────────────────────────

function ShimmerField({ label, height }: { label: string; height: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2, 4px)" }}>
      <span
        style={{
          fontSize: "var(--t-xs, 11.5px)",
          color: "var(--text-muted, #777)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <div
        style={{
          height,
          borderRadius: "var(--r-sm, 6px)",
          background:
            "linear-gradient(90deg, var(--surface-2, #252535) 0%, var(--surface-hover, #2d2d42) 40%, var(--surface-2, #252535) 80%)",
          backgroundSize: "220px 100%",
          animation: "mp-shimmer 1s linear infinite",
        }}
      />
    </div>
  );
}

// ─── Inject keyframes via a <style> element (avoids a CSS file dependency) ──
// Injected once at module load via a singleton guard.
// prefers-reduced-motion: zero-duration animations (element still renders).

const _STYLE_ID = "mp-panel-keyframes";
if (typeof document !== "undefined" && !document.getElementById(_STYLE_ID)) {
  const styleEl = document.createElement("style");
  styleEl.id = _STYLE_ID;
  styleEl.textContent = `
    @keyframes mp-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes mp-shimmer {
      0%   { background-position: -200px 0; }
      100% { background-position: 220px 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .mp-spin, [style*="mp-spin"] { animation-duration: 0.01ms !important; }
      .mp-shimmer, [style*="mp-shimmer"] { animation: none !important; }
    }
  `;
  document.head.appendChild(styleEl);
}
