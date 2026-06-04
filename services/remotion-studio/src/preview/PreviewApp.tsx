// ─── PreviewApp: Unified StudioApp (Phase 22 + Phase 23-04 + Phase 24-03) ─────
// Three-column layout: col1 preview (flex:0 1 470px, stage bg), col2 controls (flex:1, TabBar),
// col3 metadata placeholder (320px, always-visible, static).
// Header: Perfiles ▾ (outline) | Guardar config (outline) | ▶ Render Video (green CTA).
// Tokens: default.css OKLCH token set inlined in index.html (:root block).
// Tabs: Títulos | Overlays | Subtítulos (Task 2 relocates TextareaInput into Subtítulos).
//
// Phase 23-04 additions:
//   - Upload affordance: dropzone hero on the stage (§1 UI-SPEC)
//   - D-02: uploaded MP4 becomes live @remotion/player background via object URL
//   - Render state machine: idle → submitting → running → success | failure
//   - Poll loop: GET /api/status/:jobId every ~1.5s (clearInterval on terminal + unmount)
//   - 4 inline surfaces: upload-affordance, live-progress, success "Reel listo", failure
//   - Header CTA 4-state cycle per copywriting contract
//   - Green discipline: exactly one action-green at any time (UI-SPEC Color law)
//
// Phase 24-03 additions:
//   - ProfilesMenu: header "Perfiles ▾" inline popover (left of Guardar config)
//   - applyConfigToState(): extracted helper shared by load-on-mount + onProfileApplied
//   - onProfileApplied(): applies a profile's config to Studio state immediately

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { SubtitleConfig, TitleConfig, PngOverlayConfig, PipelineConfig } from "../pipeline-config";
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
import { stepLabel, causeLine, isLongStep, parseStatusError } from "./render-status";
import { ProfilesMenu } from "./ProfilesMenu.js";
import { MetadataPanel } from "./MetadataPanel.js";
import { Z } from "./z-layers.js";

const INITIAL_SUBTITLE_CONFIG: SubtitleConfig = {
  layout: "tiktok",
  ...DEFAULT_SUBTITLE_CONFIG,
};

// ─── Render state machine type (Plan 23-04) ──────────────────────────────────
type RenderState = "idle" | "submitting" | "running" | "success" | "failure";

// ─── Status response shape from GET /api/status/:jobId ───────────────────────
interface StatusResponse {
  status: string;
  currentStep?: string;
  progress?: number;
  stepInfo?: string;
  error?: string;
}

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
        borderBottom: "1px solid var(--border, #333)",
        background: "var(--chrome, #16213e)",
        padding: "0 var(--s-12, 24px)",
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
    padding: "var(--s-6, 12px) var(--s-8, 16px)",
    minHeight: 44,
    border: "none",
    background: (!isActive && hovered) ? "var(--surface-hover, rgba(255,255,255,0.04))" : "transparent",
    cursor: "pointer",
    fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"],
    borderBottom: isActive ? "2px solid var(--accent, #90caf9)" : "2px solid transparent",
    color: isActive ? "var(--accent, #90caf9)" : hovered ? "var(--text, #e6e6ea)" : "var(--text-2, #a8a8b3)",
    fontWeight: isActive ? 600 : 400,
    transition: "color var(--dur, 170ms) var(--ease), background var(--dur, 170ms) var(--ease)",
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
        background: hovered ? "var(--accent-tint-2, rgba(144,202,249,0.06))" : "var(--surface, #1e1e2e)",
        borderRadius: 8,
        cursor: "pointer",
        border: isSelected
          ? "2px solid var(--accent, #90caf9)"
          : hovered
          ? "1px solid var(--accent-strong, #6ba8e0)"
          : "1px solid var(--border, #333)",
        transition: "border-color 0.2s, background 0.2s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: "var(--t-base, 14px)" as React.CSSProperties["fontSize"], fontWeight: 600, color: "var(--accent, #90caf9)", marginBottom: "var(--s-4, 8px)" }}>
        {fontName}
      </div>
      {loaded ? (
        <div style={{ fontSize: "var(--t-xl, 19px)" as React.CSSProperties["fontSize"], fontFamily: getFontFamilyCSS(fontName), color: "var(--text, #e6e6ea)" }}>
          Hola mundo
        </div>
      ) : (
        <div style={{ fontSize: "var(--t-xl, 19px)" as React.CSSProperties["fontSize"], fontFamily: "monospace", color: "var(--text-faint, #555)" }}>
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
          fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
          fontWeight: 600,
          color: "var(--accent, #90caf9)",
          marginBottom: "var(--s-4, 8px)",
          marginTop: "var(--s-8, 16px)",
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

  // ── Plan 23-04: Upload + Render state ─────────────────────────────────────
  // D-02: Uploaded file drives the live preview background (object URL)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Derive object URL from uploaded file; revoke on change (RESEARCH Pitfall 4)
  const objectUrl = useMemo(
    () => (uploadedFile ? URL.createObjectURL(uploadedFile) : null),
    [uploadedFile]
  );
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  // Render state machine (idle | submitting | running | success | failure)
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("queued");
  const [progress, setProgress] = useState<number>(0);
  const [stepInfo, setStepInfo] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [renderCauseLine, setRenderCauseLine] = useState<string>("");

  // ── Phase 25-03: last successful render jobId — gates the MetadataPanel ─────
  // Set when a render transitions to "success". NOT cleared on reset so the
  // metadata panel stays populated if the user clicks "Renderizar de nuevo".
  const [lastRenderJobId, setLastRenderJobId] = useState<string | null>(null);

  // Poll interval ref — cleared on terminal state AND on unmount (mirror saveTimeoutRef pattern)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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

  // ── Phase 24-03: applyConfigToState ─────────────────────────────────────────
  // Shared state-population logic used by:
  //   1. load-on-mount fetch (GET /api/config)
  //   2. onProfileApplied (PUT /api/profiles/:slug/apply response)
  // Validates each field before entering state (WR-04 discipline).
  const applyConfigToState = useCallback((data: PipelineConfig) => {
    if (data.subtitle) {
      setSubtitleConfig((prev) => ({ ...prev, ...data.subtitle }));
    }
    if (Array.isArray(data.titles)) {
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
      setLiveTitles(validTitles);
    }
    if (Array.isArray(data.overlays)) {
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
      setLiveOverlays(validOverlays);
    }
  }, []);

  // ── Phase 24-03: getCurrentConfig ────────────────────────────────────────────
  // Returns the same shape PUT /api/config sends: { subtitle, titles, overlays }.
  // ProfilesMenu uses this for POST /api/profiles { name, config }.
  const getCurrentConfig = useCallback((): PipelineConfig => ({
    subtitle: subtitleConfig,
    titles: liveTitles,
    overlays: liveOverlays,
  }), [subtitleConfig, liveTitles, liveOverlays]);

  // ── Phase 24-03: handleProfileApplied ─────────────────────────────────────────
  // Called by ProfilesMenu when a profile is applied (PUT /api/profiles/:slug/apply).
  // Repopulates all Studio state from the profile config so the live preview
  // immediately reflects the applied profile.
  const handleProfileApplied = useCallback((config: PipelineConfig) => {
    applyConfigToState(config);
  }, [applyConfigToState]);

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
      .then((data: PipelineConfig) => {
        applyConfigToState(data);
      })
      .catch(() => {
        /* use defaults */
      });
  // applyConfigToState is stable (no deps that change); ok to include
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Plan 23-04: Render submit handler (mirrors handleSave try/catch/finally shape) ──
  const handleRender = useCallback(async () => {
    if (!uploadedFile || renderState !== "idle") return;

    // Stop any lingering poll
    if (pollRef.current) clearInterval(pollRef.current);

    setRenderState("submitting");
    setRenderCauseLine("");
    setResultUrl(null);

    try {
      // POST FormData with field `videos` to /api/render (Plan 02 proxy)
      // Do NOT set Content-Type manually — let browser set multipart boundary
      const formData = new FormData();
      formData.append("videos", uploadedFile);

      const submitRes = await fetch("/api/render", {
        method: "POST",
        body: formData,
      });

      if (!submitRes.ok) {
        const errData = await submitRes.json().catch(() => ({ error: { step: "proxy", message: "Submit failed" } }));
        const msg = errData?.error?.message ?? `Submit failed: ${submitRes.status}`;
        throw new Error(msg);
      }

      const submitData = await submitRes.json();
      const newJobId: string = submitData?.jobs?.[0]?.jobId;
      if (!newJobId) throw new Error("No jobId returned from /api/render");

      setJobId(newJobId);
      setCurrentStep("queued");
      setProgress(0);
      setRenderState("running");

      // Start poll loop (RESEARCH Pattern 2 — ~1.5s interval)
      // Mirror saveTimeoutRef cleanup discipline: clear on terminal state + unmount
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/status/${newJobId}`);

          if (statusRes.status === 404) {
            if (pollRef.current) clearInterval(pollRef.current);
            setRenderState("failure");
            setRenderCauseLine("Job no encontrado");
            return;
          }

          if (!statusRes.ok) {
            if (pollRef.current) clearInterval(pollRef.current);
            setRenderState("failure");
            setRenderCauseLine(`Error ${statusRes.status}`);
            return;
          }

          const statusData: StatusResponse = await statusRes.json();

          // Update progress display
          if (statusData.currentStep) setCurrentStep(statusData.currentStep);
          if (statusData.progress !== undefined) setProgress(statusData.progress);
          if (statusData.stepInfo) setStepInfo(statusData.stepInfo);

          // Handle terminal states
          if (statusData.status === "completed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setResultUrl(`/api/result/${newJobId}`);
            setLastRenderJobId(newJobId); // Phase 25-03: gate MetadataPanel
            setRenderState("success");
            return;
          }

          if (statusData.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            // Parse the error string from /status into step + exitCode
            const parsed = parseStatusError(statusData.error ?? "");
            const cause = causeLine(
              parsed.step ?? "error",
              parsed.exitCode
            );
            setRenderCauseLine(cause);
            setRenderState("failure");
            return;
          }
        } catch {
          // Network error during poll — keep polling; don't terminate
        }
      }, 1500);
    } catch (err) {
      if (pollRef.current) clearInterval(pollRef.current);
      setRenderCauseLine(err instanceof Error ? err.message : "Error desconocido");
      setRenderState("failure");
    }
  }, [uploadedFile, renderState]);

  // ── Plan 23-04: Reset render state for "Renderizar de nuevo" / "Reintentar" ──
  const handleRenderReset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setRenderState("idle");
    setJobId(null);
    setResultUrl(null);
    setRenderCauseLine("");
    setCurrentStep("queued");
    setProgress(0);
    setStepInfo("");
  }, []);

  // ── Save config to API (PUT /api/config) — manual save button ──────────────
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const payload = {
        subtitle: subtitleConfig,
        titles: liveTitles,
        overlays: liveOverlays,
      };

      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        // Prefer the field-level errors array (e.g. ["titles[1].style.x must be …"])
        // over the generic top-level message ("Invalid config").
        const fieldErrors: string[] = Array.isArray(errData.errors) ? errData.errors : [];
        const message = fieldErrors.length > 0
          ? fieldErrors.join("; ")
          : (errData.error || `Save failed: ${res.status}`);
        throw new Error(message);
      }

      // Reconcile committed state to match what was just saved so that
      // computeLiveTitles/computeLiveOverlays don't revert a previously-saved
      // live edit when the user next edits a different item.
      setTitles(liveTitles);
      setOverlays(liveOverlays);

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveSuccess(true);
      saveTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }, [subtitleConfig, liveTitles, liveOverlays]);

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
            <span
              title={saveError}
              style={{
                fontSize: "var(--t-sm, 12.5px)",
                color: "var(--danger, #e57373)",
                padding: "3px var(--s-4, 8px)",
                borderRadius: "var(--r-full, 999px)",
                border: "1px solid var(--danger, #e57373)",
                maxWidth: 320,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "inline-block",
                verticalAlign: "middle",
              }}
            >
              {`✕ ${saveError.length > 60 ? saveError.slice(0, 57) + "…" : saveError}`}
            </span>
          )}

          {/* Hairline divider before buttons */}
          <div style={{ width: 1, height: 20, background: "var(--border, #333)", margin: "0 2px" }} />

          {/* Perfiles ▾ — Phase 24-03: inline popover for named config profiles.
               Immediately left of Guardar config. Uses --accent/--danger, NOT --action.
               Green discipline: ProfilesMenu never uses --action; Guardar config is outline;
               only Render Video may be green. */}
          <ProfilesMenu
            getCurrentConfig={getCurrentConfig}
            onApplied={handleProfileApplied}
            disabled={renderState === "submitting" || renderState === "running"}
          />

          {/* Guardar config — OUTLINE, never green (color law); disabled while rendering */}
          <button
            onClick={handleSave}
            disabled={saving || renderState === "running" || renderState === "submitting"}
            style={{
              padding: "7px 14px",
              background: "transparent",
              color: (saving || renderState === "running" || renderState === "submitting")
                ? "var(--text-muted, #777)"
                : "var(--text, #e6e6ea)",
              border: "1px solid var(--border-strong, #444)",
              borderRadius: "var(--r-sm, 6px)",
              cursor: (saving || renderState === "running" || renderState === "submitting")
                ? "not-allowed"
                : "pointer",
              fontSize: "var(--t-sm, 12.5px)",
              fontWeight: 400,
              transition: "border-color var(--dur, 170ms) var(--ease), color var(--dur, 170ms) var(--ease)",
              minHeight: 32,
              opacity: (renderState === "running" || renderState === "submitting") ? 0.5 : 1,
            }}
          >
            {saving ? "Guardando…" : "Guardar config"}
          </button>

          {/* ▶ Render Video — THE single green CTA (color law: never two greens)    */}
          {/* 4-state cycle per UI-SPEC Copywriting Contract                            */}
          {/* Green discipline: when no file is uploaded, the green is in the dropzone  */}
          {/* ("Elegir archivo") — the header CTA is neutral/outline until a file loads */}
          {renderState === "idle" && !uploadedFile && (
            <button
              disabled
              title="Subí un video para renderizar"
              style={{
                padding: "7px 16px",
                background: "transparent",
                color: "var(--text-muted, #777)",
                border: "1px solid var(--border-strong, #444)",
                borderRadius: "var(--r-sm, 6px)",
                cursor: "not-allowed",
                fontSize: "var(--t-sm, 12.5px)",
                fontWeight: 600,
                opacity: 0.55,
                minHeight: 32,
              }}
            >
              ▶ Render Video
            </button>
          )}
          {renderState === "idle" && uploadedFile && (
            <button
              onClick={handleRender}
              style={{
                padding: "7px 16px",
                background: "var(--action, #4CAF50)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--r-sm, 6px)",
                cursor: "pointer",
                fontSize: "var(--t-sm, 12.5px)",
                fontWeight: 600,
                minHeight: 32,
                transition: "opacity var(--dur, 170ms) var(--ease)",
              }}
            >
              ▶ Render Video
            </button>
          )}
          {(renderState === "submitting" || renderState === "running") && (
            <button
              disabled
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
              ⟳ Renderizando…
            </button>
          )}
          {renderState === "success" && (
            <button
              onClick={handleRenderReset}
              style={{
                padding: "7px 16px",
                background: "var(--action, #4CAF50)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--r-sm, 6px)",
                cursor: "pointer",
                fontSize: "var(--t-sm, 12.5px)",
                fontWeight: 600,
                minHeight: 32,
              }}
            >
              ▶ Renderizar de nuevo
            </button>
          )}
          {renderState === "failure" && (
            <button
              onClick={handleRenderReset}
              style={{
                padding: "7px 16px",
                background: "var(--action, #4CAF50)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--r-sm, 6px)",
                cursor: "pointer",
                fontSize: "var(--t-sm, 12.5px)",
                fontWeight: 600,
                minHeight: 32,
              }}
            >
              ↻ Reintentar
            </button>
          )}
        </div>
      </header>

      {/* ── Main content: 3-column layout (D-01) ──────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Col 1: 9:16 Preview Stage — flex:0 1 470px ──────────────────── */}
        {/* Stage dims during non-idle render states (UI-SPEC §2) */}
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
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Stage dim layer — covers the player when render is not idle */}
          {(renderState === "running" || renderState === "submitting") && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 10,
                pointerEvents: "none",
                background: "transparent",
                // Dim applied to the player wrapper below via filter
              }}
            />
          )}

          {/* Upload dropzone hero — shown when no file has been uploaded (§1 UI-SPEC) */}
          {!uploadedFile && renderState === "idle" ? (
            <UploadDropzone onFileSelected={setUploadedFile} />
          ) : (
            /* @remotion/player — dims during render (filter on wrapper) */
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                filter:
                  renderState === "running" || renderState === "submitting"
                    ? "brightness(0.32) saturate(0.5)"
                    : "none",
                transition: "filter var(--dur, 170ms) var(--ease)",
              }}
            >
              <PreviewPlayer
                subtitleConfig={subtitleConfig}
                captionPages={captionPages}
                totalDurationMs={totalDurationMs}
                titles={liveTitles}
                overlays={liveOverlays}
                rawVideoSrc={objectUrl}
              />
            </div>
          )}

          {/* ── Inline render surfaces (§2/§3/§4 UI-SPEC) — overlay the stage ── */}
          {(renderState === "submitting" || renderState === "running") && (
            <RenderProgressOverlay
              currentStep={currentStep}
              progress={progress}
              stepInfo={stepInfo}
            />
          )}
          {renderState === "success" && resultUrl && (
            <RenderSuccessOverlay
              resultUrl={resultUrl}
              onRenderAgain={handleRenderReset}
            />
          )}
          {renderState === "failure" && (
            <RenderFailureOverlay
              causeLine={renderCauseLine}
              onRetry={handleRenderReset}
            />
          )}
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

        {/* ── Col 3: Live AI metadata panel — 320px, always-visible (Phase 25-03) ─ */}
        {/* Replaced the Phase 22 static placeholder. MetadataPanel gates on lastRenderJobId. */}
        {/* Green discipline: MetadataPanel uses ONLY --accent/--danger, never --action.      */}
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
          <MetadataPanel jobId={lastRenderJobId} />
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline render surface components (Plan 23-04)
// All surfaces use the canonical OKLCH token set from default.css (no new values).
// Green discipline: --action is ONLY for the CTA in PreviewApp header.
// ─────────────────────────────────────────────────────────────────────────────

// ─── §1 Upload dropzone hero ──────────────────────────────────────────────────
// Shown when no file uploaded. Picker button is the single green at cold start.
// Once a file loads, green returns to the header Render CTA.
function UploadDropzone({ onFileSelected }: { onFileSelected: (f: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type === "video/mp4") onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        aspectRatio: "9/16",
        maxHeight: "100%",
        maxWidth: "100%",
        borderRadius: 18,
        border: dragOver
          ? "2px dashed var(--accent-strong, #6ba8e0)"
          : "2px dashed var(--border-strong, #444)",
        background: dragOver
          ? "oklch(0.20 0.025 280 / 0.7)"
          : "oklch(0.20 0.025 280 / 0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--s-5, 10px)",
        padding: "var(--s-12, 24px)",
        cursor: "pointer",
        transition: "border-color var(--dur, 170ms) var(--ease), background var(--dur, 170ms) var(--ease)",
      }}
      onClick={() => inputRef.current?.click()}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4"
        style={{ display: "none" }}
        onChange={handleChange}
      />

      {/* Upload icon */}
      <span style={{ fontSize: 32, color: "var(--text-muted, #777)" }}>⤓</span>

      {/* Heading */}
      <div style={{
        fontSize: "var(--t-lg, 16px)",
        fontWeight: 600,
        color: "var(--text, #e6e6ea)",
        textAlign: "center",
      }}>
        Subí tu video
      </div>

      {/* Sublabel */}
      <div style={{
        fontSize: "var(--t-xs, 11.5px)",
        fontWeight: 500,
        color: "var(--text-muted, #777)",
        textAlign: "center",
      }}>
        MP4 · hasta 10 min
      </div>

      {/* Single green at cold start — "Elegir archivo" picker button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        style={{
          padding: "7px 16px",
          background: "var(--action, #4CAF50)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--r-sm, 6px)",
          cursor: "pointer",
          fontSize: "var(--t-sm, 12.5px)",
          fontWeight: 600,
          minHeight: 32,
          marginTop: "var(--s-4, 8px)",
        }}
      >
        Elegir archivo
      </button>

      {/* Preview-sync note (D-02 nuance) */}
      <p style={{
        fontSize: "var(--t-2xs, 10.5px)",
        fontWeight: 500,
        color: "var(--text-faint, #666)",
        textAlign: "center",
        lineHeight: 1.5,
        maxWidth: 220,
        margin: 0,
        marginTop: "var(--s-3, 6px)",
      }}>
        Vas a ver tus subtítulos sincronizados recién en el video final.
      </p>
    </div>
  );
}

// ─── §2 Live progress overlay ─────────────────────────────────────────────────
// Overlays the dimmed stage. Shows step label, honest %, long-step affordance.
// Z.takeover (30) — sits above sheets (popovers) per modal-stack-choreography (041).
function RenderProgressOverlay({
  currentStep,
  progress,
  stepInfo,
}: {
  currentStep: string;
  progress: number;
  stepInfo: string;
}) {
  const label = stepLabel(currentStep);
  const longStep = isLongStep(currentStep);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: Z.takeover,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--s-8, 16px)",
        padding: "var(--s-12, 24px)",
        animation: "fadeIn 0.22s ease-out",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes shimmer {
          0%   { transform: translateX(-100%) }
          100% { transform: translateX(100%) }
        }
        @media (prefers-reduced-motion: reduce) {
          .render-shimmer { display: none; }
          .render-nudge { animation: none !important; }
        }
      `}</style>

      {/* Step name — prominent, accent color */}
      <div style={{
        fontSize: "var(--t-xl, 19px)",
        fontWeight: 600,
        color: "var(--accent, #90caf9)",
        textAlign: "center",
        lineHeight: 1.2,
      }}>
        {label}
      </div>

      {/* Progress bar */}
      <div style={{
        width: "80%",
        maxWidth: 240,
        height: 4,
        background: "var(--surface, rgba(30,30,46,0.8))",
        borderRadius: 2,
        overflow: "hidden",
        position: "relative",
      }}>
        <div style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          width: `${progress}%`,
          background: "var(--accent, #90caf9)",
          borderRadius: 2,
          transition: "width var(--dur, 170ms) var(--ease)",
        }} />
        {/* Indeterminate shimmer on the long step (not faked forward movement) */}
        {longStep && (
          <div
            className="render-shimmer"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: "40%",
              background: "linear-gradient(90deg, transparent, var(--accent-tint, rgba(144,202,249,0.25)), transparent)",
              animation: "shimmer 1.8s linear infinite",
            }}
          />
        )}
      </div>

      {/* Percent + step counter */}
      <div style={{
        fontSize: "var(--t-sm, 12.5px)",
        fontWeight: 500,
        color: "var(--text-2, #a8a8b3)",
        textAlign: "center",
        lineHeight: 1.2,
      }}>
        {Math.round(progress)}% · {stepInfo || "…"}
      </div>

      {/* Long-step hint */}
      {longStep && (
        <div style={{
          fontSize: "var(--t-xs, 11.5px)",
          fontWeight: 500,
          color: "var(--text-2, #a8a8b3)",
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          este paso toma más tiempo
        </div>
      )}
    </div>
  );
}

// ─── §3 Inline success "Reel listo" ──────────────────────────────────────────
// Finished 9:16 plays inline. Descargar = accent (NOT green). Renderizar de nuevo = green.
// Z.takeover (30) — sits above sheets (popovers) per modal-stack-choreography (041).
function RenderSuccessOverlay({
  resultUrl,
  onRenderAgain,
}: {
  resultUrl: string;
  onRenderAgain: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: Z.takeover,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--s-8, 16px)",
        padding: "var(--s-12, 24px)",
        animation: "fadeIn 0.22s ease-out",
        background: "oklch(0.165 0.022 280 / 0.85)",
      }}
    >
      {/* Inline 9:16 video player */}
      <div style={{
        width: "70%",
        maxWidth: 220,
        aspectRatio: "9/16",
        borderRadius: 18,
        overflow: "hidden",
        background: "#000",
        flexShrink: 0,
      }}>
        <video
          src={resultUrl}
          controls
          autoPlay
          loop
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Success heading */}
      <div style={{
        fontSize: "var(--t-lg, 16px)",
        fontWeight: 600,
        color: "var(--success, #81C784)",
        textAlign: "center",
      }}>
        ✓ Reel listo
      </div>

      {/* Actions: Descargar (accent) + Renderizar de nuevo (green) */}
      <div style={{
        display: "flex",
        gap: "var(--s-4, 8px)",
        flexWrap: "wrap",
        justifyContent: "center",
      }}>
        {/* Descargar — accent blue, explicitly NOT green */}
        <a
          href={`${resultUrl}?download=1`}
          download
          style={{
            padding: "7px 16px",
            background: "var(--accent, #90caf9)",
            color: "oklch(0.165 0.022 280)",
            border: "none",
            borderRadius: "var(--r-sm, 6px)",
            cursor: "pointer",
            fontSize: "var(--t-sm, 12.5px)",
            fontWeight: 600,
            minHeight: 32,
            display: "inline-flex",
            alignItems: "center",
            textDecoration: "none",
          }}
        >
          ⤓ Descargar
        </a>

        {/* Renderizar de nuevo — green */}
        <button
          type="button"
          onClick={onRenderAgain}
          style={{
            padding: "7px 16px",
            background: "var(--action, #4CAF50)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--r-sm, 6px)",
            cursor: "pointer",
            fontSize: "var(--t-sm, 12.5px)",
            fontWeight: 600,
            minHeight: 32,
          }}
        >
          Renderizar de nuevo
        </button>
      </div>
    </div>
  );
}

// ─── §4 Inline failure panel ──────────────────────────────────────────────────
// Low-chroma danger (tint + thin border). Never action-green. Never saturated alarm.
// Reintentar = green (the one green on this surface).
// Z.takeover (30) — sits above sheets (popovers) per modal-stack-choreography (041).
function RenderFailureOverlay({
  causeLine: causeLineText,
  onRetry,
}: {
  causeLine: string;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: Z.takeover,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--s-5, 10px)",
        padding: "var(--s-10, 20px)",
        animation: "fadeIn 0.22s ease-out",
      }}
    >
      {/* Fault panel card */}
      <div
        className="render-nudge"
        style={{
          background: "oklch(0.63 0.185 25 / 0.08)",
          border: "1px solid oklch(0.63 0.185 25 / 0.4)",
          borderRadius: "var(--r-lg, 12px)",
          padding: "var(--s-10, 20px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--s-4, 8px)",
          maxWidth: 280,
          width: "100%",
          animation: "nudge 0.3s ease-out",
        }}
      >
        <style>{`
          @keyframes nudge {
            0%   { transform: translateX(0) }
            20%  { transform: translateX(-3px) }
            40%  { transform: translateX(3px) }
            60%  { transform: translateX(-2px) }
            80%  { transform: translateX(2px) }
            100% { transform: translateX(0) }
          }
        `}</style>

        {/* Failure icon */}
        <span style={{
          fontSize: 24,
          color: "var(--danger, #e57373)",
        }}>✕</span>

        {/* Plain-language reason */}
        <div style={{
          fontSize: "var(--t-md, 13.5px)",
          fontWeight: 600,
          color: "var(--text, #e6e6ea)",
          textAlign: "center",
          lineHeight: 1.3,
        }}>
          No se pudo generar el reel
        </div>

        {/* Technical cause line — muted mono */}
        {causeLineText && (
          <div style={{
            fontSize: "var(--t-2xs, 10.5px)",
            fontWeight: 500,
            color: "var(--text-faint, #666)",
            fontFamily: "var(--mono, 'JetBrains Mono', monospace)",
            textAlign: "center",
            lineHeight: 1.4,
            wordBreak: "break-all",
          }}>
            {causeLineText}
          </div>
        )}

        {/* Reintentar — green, the one green on this surface */}
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: "7px 16px",
            background: "var(--action, #4CAF50)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--r-sm, 6px)",
            cursor: "pointer",
            fontSize: "var(--t-sm, 12.5px)",
            fontWeight: 600,
            minHeight: 32,
            marginTop: "var(--s-2, 4px)",
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
