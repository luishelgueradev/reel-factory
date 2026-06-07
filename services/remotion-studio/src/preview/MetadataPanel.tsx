// ─── MetadataPanel: AI social metadata for col3 (Phase 25 · reworked Phase 29) ──
// Design contract: 25-UI-SPEC.md + sketch-findings-reel-factory `AI metadata column` (026-C)
//
// Green discipline: this component uses ONLY --accent/--danger. NEVER --action.
// --action (green) is RESERVED for Render / Guardar config in the header.
//
// Phase 29 (META-05 / META-06):
//   - ONE action "Generar metadata (todas las redes)" → POST /api/metadata/all
//     generates metadata for ALL 3 platforms in one round-trip.
//   - The platform <select> dropdown is replaced by a TAB strip (TikTok /
//     Instagram Reels / YouTube Shorts); each tab shows that platform's own
//     editable title/description/hashtags + copy. Tone stays a single select.
//   - Partial failure: a platform that failed shows an inline --danger line on
//     its own tab; the survivors render normally.
//
// States:
//   empty      — no jobId; Generar disabled + muted hint
//   ready      — jobId set, no results yet; Generar enabled
//   generating — fetch in flight; shimmer + spinner; controls disabled
//   generated  — at least one platform has results; tab strip + editable fields
//   error      — all-failed; inline --danger line + Reintentar
//
// Props: { jobId: string | null }
// API: POST /api/metadata/all { jobId, tone } → { results: { <platform>: Metadata }, errors?, _meta }
//      GET  /api/metadata-all/:jobId → restores persisted per-platform results

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

/** Editable per-platform buffer (what the user sees in the fields). */
interface EditBuffer {
  title: string;
  description: string;
  hashtagsText: string; // space/newline-joined
}

const PLATFORM_KEYS = Object.keys(PLATFORMS) as Platform[];

function emptyBuffer(): EditBuffer {
  return { title: "", description: "", hashtagsText: "" };
}

function bufferFromMetadata(m: Metadata): EditBuffer {
  return {
    title: m.title ?? "",
    description: m.description ?? "",
    hashtagsText: Array.isArray(m.hashtags) ? m.hashtags.join(" ") : "",
  };
}

function makeRecord<T>(make: () => T): Record<Platform, T> {
  const out = {} as Record<Platform, T>;
  for (const k of PLATFORM_KEYS) out[k] = make();
  return out;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export interface MetadataPanelProps {
  jobId: string | null;
}

export function MetadataPanel({ jobId }: MetadataPanelProps) {
  // ── Tone selector (single, applied to ALL platforms) ──────────────────────
  const [tone, setTone] = useState<Tone>("cercano");

  // ── Active platform tab ───────────────────────────────────────────────────
  const [activePlatformTab, setActivePlatformTab] = useState<Platform>("tiktok");

  // ── Panel state ────────────────────────────────────────────────────────────
  const [panelState, setPanelState] = useState<PanelState>(jobId ? "ready" : "empty");
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | undefined>(undefined);

  // ── Per-platform editable buffers + per-platform errors ───────────────────
  const [buffers, setBuffers] = useState<Record<Platform, EditBuffer>>(() => makeRecord(emptyBuffer));
  const [platformErrors, setPlatformErrors] = useState<Record<Platform, string | undefined>>(() =>
    makeRecord<string | undefined>(() => undefined)
  );
  // Which platforms have a result (success) — drives whether a tab renders fields.
  const [haveResult, setHaveResult] = useState<Record<Platform, boolean>>(() =>
    makeRecord<boolean>(() => false)
  );

  // ── Transient copy chips: field → timer ref ───────────────────────────────
  const [copyChip, setCopyChip] = useState<"title" | "description" | "hashtags" | null>(null);
  const copyChipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Apply a results/errors map into per-platform state ─────────────────────
  const applyResults = useCallback(
    (results: Partial<Record<Platform, Metadata>>, errors?: Partial<Record<Platform, string>>) => {
      setBuffers((prev) => {
        const next = { ...prev };
        for (const k of PLATFORM_KEYS) {
          const m = results[k];
          if (m) next[k] = bufferFromMetadata(m);
        }
        return next;
      });
      setHaveResult((prev) => {
        const next = { ...prev };
        for (const k of PLATFORM_KEYS) {
          if (results[k]) next[k] = true;
        }
        return next;
      });
      setPlatformErrors((prev) => {
        const next = { ...prev };
        for (const k of PLATFORM_KEYS) {
          // Clear error on success, set it on failure.
          if (results[k]) next[k] = undefined;
          if (errors && errors[k]) next[k] = errors[k];
        }
        return next;
      });
    },
    []
  );

  // ─── Restore persisted per-platform results when jobId changes ───────────
  useEffect(() => {
    if (!jobId) {
      setPanelState("empty");
      setBuffers(makeRecord(emptyBuffer));
      setHaveResult(makeRecord<boolean>(() => false));
      setPlatformErrors(makeRecord<string | undefined>(() => undefined));
      setError(null);
      setModel(undefined);
      return;
    }

    const controller = new AbortController();
    setPanelState("ready"); // optimistic ready while we check
    setError(null);

    fetch(`/api/metadata-all/${jobId}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setPanelState("ready"); // non-blocking — they can Generar
          return;
        }
        const data = (await res.json()) as {
          results?: Partial<Record<Platform, Metadata>>;
        };
        const results = data.results ?? {};
        if (Object.keys(results).length === 0) {
          setPanelState("ready");
          return;
        }
        applyResults(results);
        setPanelState("generated");
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setPanelState("ready"); // silent fallback
      });

    return () => controller.abort();
  }, [jobId, applyResults]);

  // ── Cleanup copy chip timer on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (copyChipRef.current) clearTimeout(copyChipRef.current);
    };
  }, []);

  // ── Generate all networks in one action ───────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!jobId || panelState === "generating") return;

    setPanelState("generating");
    setError(null);

    try {
      const res = await fetch("/api/metadata/all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, tone }),
      });

      const data = (await res.json()) as {
        results?: Partial<Record<Platform, Metadata>>;
        errors?: Partial<Record<Platform, string>>;
        _meta?: { model?: string };
        error?: string;
      };

      if (!res.ok) {
        // All-failed → single inline error + Reintentar.
        const errMsg = data?.error ?? `Error ${res.status}`;
        setError(errMsg);
        setPanelState("error");
        return;
      }

      const results = data.results ?? {};
      applyResults(results, data.errors);
      setModel(data._meta?.model);

      // Land the user on a platform that succeeded (prefer the current tab).
      if (!results[activePlatformTab]) {
        const firstOk = PLATFORM_KEYS.find((k) => results[k]);
        if (firstOk) setActivePlatformTab(firstOk);
      }

      setPanelState("generated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      setError(msg);
      setPanelState("error");
    }
  }, [jobId, panelState, tone, applyResults, activePlatformTab]);

  // ── Update the active platform's buffer field ─────────────────────────────
  const updateField = useCallback(
    (field: keyof EditBuffer, value: string) => {
      setBuffers((prev) => ({
        ...prev,
        [activePlatformTab]: { ...prev[activePlatformTab], [field]: value },
      }));
    },
    [activePlatformTab]
  );

  // ── Copy active platform field to clipboard ───────────────────────────────
  const copyField = useCallback(
    async (field: "title" | "description" | "hashtags") => {
      const buf = buffers[activePlatformTab];
      let text = "";
      if (field === "title") text = buf.title;
      if (field === "description") text = buf.description;
      if (field === "hashtags") text = buf.hashtagsText.trim();

      try {
        await navigator.clipboard.writeText(text);
        if (copyChipRef.current) clearTimeout(copyChipRef.current);
        setCopyChip(field);
        copyChipRef.current = setTimeout(() => setCopyChip(null), 2000);
      } catch {
        // Clipboard unavailable — silently skip
      }
    },
    [buffers, activePlatformTab]
  );

  // ── Retry after all-failed error ──────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (!jobId) return;
    setPanelState("ready");
    setError(null);
  }, [jobId]);

  // ── Tab switch (pure UI — never triggers a fetch) ─────────────────────────
  const handleTabSelect = useCallback((p: Platform) => {
    setActivePlatformTab(p);
    setCopyChip(null);
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const hasResult = panelState === "generated";
  const isGenerating = panelState === "generating";
  const isDisabled = !jobId || isGenerating;

  const activeBuffer = buffers[activePlatformTab];
  const activeError = platformErrors[activePlatformTab];
  const activeHasResult = haveResult[activePlatformTab];

  // Hashtag chips — parse the active tab's text back into chips for display
  const hashtagChips = activeBuffer.hashtagsText
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
        {hasResult && model && (
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
            {model}
          </span>
        )}
      </div>

      {/* ── Controls row: Tone selector (single, applies to all platforms) ─ */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-3, 6px)",
        }}
      >
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
        aria-label={hasResult ? "Regenerar metadata (todas las redes)" : "Generar metadata (todas las redes)"}
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
          <span>↻ Regenerar (todas)</span>
        ) : (
          <span>✨ Generar metadata (todas las redes)</span>
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

      {/* ── Generated result: per-platform TAB strip + editable fields ── */}
      {hasResult && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--s-6, 12px)" }}
        >
          {/* Tab strip — mirrors the PreviewApp TabButton underline idiom. */}
          {/* GREEN DISCIPLINE: active tab uses --accent, never --action. */}
          <div
            role="tablist"
            aria-label="Plataforma"
            style={{
              display: "flex",
              gap: "var(--s-1, 2px)",
              borderBottom: "1px solid var(--border, #333)",
              overflowX: "auto",
            }}
          >
            {PLATFORM_KEYS.map((p) => {
              const isActive = p === activePlatformTab;
              const failed = Boolean(platformErrors[p]);
              return (
                <button
                  key={p}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabSelect(p)}
                  style={{
                    padding: "var(--s-3, 6px) var(--s-5, 10px)",
                    minHeight: 32,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontSize: "var(--t-xs, 11.5px)",
                    fontWeight: isActive ? 600 : 400,
                    borderBottom: isActive
                      ? "2px solid var(--accent, #90caf9)"
                      : "2px solid transparent",
                    color: isActive
                      ? "var(--accent, #90caf9)"
                      : "var(--text-2, #a8a8b3)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--s-1, 2px)",
                    transition:
                      "color var(--dur, 170ms) var(--ease), border-color var(--dur, 170ms) var(--ease)",
                  }}
                >
                  {PLATFORMS[p]?.label ?? p}
                  {failed && (
                    <span
                      aria-hidden="true"
                      title="Falló"
                      style={{ color: "var(--danger, #e57373)" }}
                    >
                      !
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active tab body */}
          {activeError ? (
            // Failed platform — show its inline --danger message (no fields).
            <p
              style={{
                fontSize: "var(--t-xs, 11.5px)",
                color: "var(--danger, #e57373)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {activeError}
            </p>
          ) : activeHasResult ? (
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
                  value={activeBuffer.title}
                  onChange={(e) => updateField("title", e.target.value)}
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
                  value={activeBuffer.description}
                  onChange={(e) => updateField("description", e.target.value)}
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
                  value={activeBuffer.hashtagsText}
                  onChange={(e) => updateField("hashtagsText", e.target.value)}
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
          ) : (
            // No result yet for this platform (and no error) — muted hint.
            <p
              style={{
                fontSize: "var(--t-xs, 11.5px)",
                color: "var(--text-muted, #777)",
                margin: 0,
                lineHeight: 1.5,
                fontStyle: "italic",
              }}
            >
              Sin metadata para esta red todavía.
            </p>
          )}
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
