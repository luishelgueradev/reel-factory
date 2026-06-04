// ─── ProfilesMenu: Named config profiles inline popover ──────────────────────
// Phase 24 Plan 03 — UI Design Contract: 24-UI-SPEC.md
//
// Design system: sketch-findings-reel-factory (style-presets + header-action-zone)
// Tokens: OKLCH set from default.css (--action, --accent, --danger, --t-*, --s-*, --r-*, --ease, --dur)
// Green discipline: NO --action green inside this menu. Profile actions use --accent/--danger.
//
// Props:
//   getCurrentConfig()  → PipelineConfig  (same shape as PUT /api/config)
//   onApplied(config)   → called when a profile is applied; caller refreshes Studio state
//   disabled?           → true while render is submitting|running

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import type { PipelineConfig } from "../pipeline-config.js";

// ─── Types (mirror server-side ProfileSummary / ProfileFile) ─────────────────

interface ProfileSummary {
  slug: string;
  name: string;
  updatedAt: string;
}

// ─── Relative time formatter ─────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "ahora";
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return "ayer";
    if (diffD < 7) return `hace ${diffD} días`;
    const diffW = Math.floor(diffD / 7);
    return `hace ${diffW} sem`;
  } catch {
    return "";
  }
}

// ─── ProfilesMenu ────────────────────────────────────────────────────────────

export interface ProfilesMenuProps {
  getCurrentConfig: () => PipelineConfig;
  onApplied: (config: PipelineConfig) => void;
  disabled?: boolean;
}

export function ProfilesMenu({
  getCurrentConfig,
  onApplied,
  disabled = false,
}: ProfilesMenuProps) {
  // ── Popover open/close ─────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // ── Profiles list ──────────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // ── Active slug (applied profile) ─────────────────────────────────────────
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // ── Save-as field ──────────────────────────────────────────────────────────
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveChip, setSaveChip] = useState<string | null>(null); // transient chip
  const saveChipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Per-row state (applying, renaming, deleting) ──────────────────────────
  const [applyingSlug, setApplyingSlug] = useState<string | null>(null);
  const [applyChip, setApplyChip] = useState<string | null>(null);
  const applyChipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // rename: slug → edited name; null = not renaming
  const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // delete: slug → confirming; null = not confirming
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // per-row error (save/apply/rename/delete)
  const [rowError, setRowError] = useState<{ slug: string; msg: string } | null>(null);
  const [topError, setTopError] = useState<string | null>(null); // save-as errors

  // ── Fetch profiles ─────────────────────────────────────────────────────────
  const fetchProfiles = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/profiles");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Error ${res.status}`);
      }
      const data = await res.json() as { profiles?: ProfileSummary[] };
      setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Error al cargar perfiles");
    } finally {
      setListLoading(false);
    }
  }, []);

  // ── Open → fetch + focus save input ───────────────────────────────────────
  useEffect(() => {
    if (open) {
      fetchProfiles();
      // Focus the save input after the popover renders
      requestAnimationFrame(() => {
        saveInputRef.current?.focus();
      });
    }
  }, [open, fetchProfiles]);

  // ── Esc closes; click-outside closes ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // Cancel any in-progress rename without committing
        setRenamingSlug(null);
        triggerRef.current?.focus();
      }
    };
    const onOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [open]);

  // ── Cleanup timeouts on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (saveChipRef.current) clearTimeout(saveChipRef.current);
      if (applyChipRef.current) clearTimeout(applyChipRef.current);
    };
  }, []);

  // ── Save-as: does the name match an existing profile? ─────────────────────
  const nameMatchesExisting = profiles.some(
    (p) => p.name.toLowerCase() === saveName.trim().toLowerCase()
  );

  // ── Handle save-as ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const name = saveName.trim();
    if (!name) {
      setTopError("Ingresá un nombre");
      return;
    }
    setSaving(true);
    setTopError(null);
    try {
      const config = getCurrentConfig();
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Error ${res.status}`);
      }
      const data = await res.json() as { slug?: string };
      // Refresh list and set active slug to the saved profile
      await fetchProfiles();
      setActiveSlug(data.slug ?? null);
      setSaveName("");
      // Transient chip
      if (saveChipRef.current) clearTimeout(saveChipRef.current);
      setSaveChip("✓ Perfil guardado");
      saveChipRef.current = setTimeout(() => setSaveChip(null), 2000);
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [saveName, getCurrentConfig, fetchProfiles]);

  // ── Handle apply ──────────────────────────────────────────────────────────
  const handleApply = useCallback(
    async (slug: string) => {
      if (disabled || applyingSlug) return;
      setApplyingSlug(slug);
      setRowError(null);
      try {
        const res = await fetch(`/api/profiles/${encodeURIComponent(slug)}/apply`, {
          method: "PUT",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `Error ${res.status}`);
        }
        const data = await res.json() as PipelineConfig & { _meta?: unknown };
        // Strip _meta before handing to caller
        const { _meta: _m, ...config } = data;
        void _m;
        onApplied(config as PipelineConfig);
        setActiveSlug(slug);
        // Transient chip
        if (applyChipRef.current) clearTimeout(applyChipRef.current);
        setApplyChip("✓ Perfil aplicado");
        applyChipRef.current = setTimeout(() => setApplyChip(null), 2000);
      } catch (err) {
        setRowError({
          slug,
          msg: err instanceof Error ? err.message : "Error al aplicar",
        });
      } finally {
        setApplyingSlug(null);
      }
    },
    [disabled, applyingSlug, onApplied]
  );

  // ── Handle rename ─────────────────────────────────────────────────────────
  const commitRename = useCallback(
    async (slug: string) => {
      const newName = renameValue.trim();
      if (!newName) {
        setRenamingSlug(null);
        return;
      }
      if (newName === profiles.find((p) => p.slug === slug)?.name) {
        setRenamingSlug(null);
        return;
      }
      setRenaming(true);
      setRowError(null);
      try {
        const res = await fetch(`/api/profiles/${encodeURIComponent(slug)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `Error ${res.status}`);
        }
        const data = await res.json() as { slug?: string; updatedAt?: string };
        // Update list optimistically: replace old slug row with new
        setProfiles((prev) =>
          prev.map((p) =>
            p.slug === slug
              ? { slug: data.slug ?? slug, name: newName, updatedAt: data.updatedAt ?? p.updatedAt }
              : p
          )
        );
        // If this was the active profile, update active slug
        if (activeSlug === slug) setActiveSlug(data.slug ?? slug);
        setRenamingSlug(null);
      } catch (err) {
        setRowError({
          slug,
          msg: err instanceof Error ? err.message : "Error al renombrar",
        });
        setRenamingSlug(null);
      } finally {
        setRenaming(false);
      }
    },
    [renameValue, profiles, activeSlug]
  );

  // ── Handle delete ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (slug: string) => {
      setDeleting(true);
      setRowError(null);
      try {
        const res = await fetch(`/api/profiles/${encodeURIComponent(slug)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `Error ${res.status}`);
        }
        setProfiles((prev) => prev.filter((p) => p.slug !== slug));
        if (activeSlug === slug) setActiveSlug(null);
        setDeletingSlug(null);
      } catch (err) {
        setRowError({
          slug,
          msg: err instanceof Error ? err.message : "Error al eliminar",
        });
        setDeletingSlug(null);
      } finally {
        setDeleting(false);
      }
    },
    [activeSlug]
  );

  // ─── Inline rename key handler ────────────────────────────────────────────
  const handleRenameKey = useCallback(
    (e: React.KeyboardEvent, slug: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitRename(slug);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setRenamingSlug(null);
      }
    },
    [commitRename]
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <TriggerButton
        triggerRef={triggerRef}
        open={open}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((v) => !v);
            if (!open) {
              setSaveName("");
              setTopError(null);
              setRowError(null);
            }
          }
        }}
      />

      {/* ── Popover ────────────────────────────────────────────────────────── */}
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Perfiles de configuración"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 20, // sheet layer per modal-stack-choreography
            width: 320,
            background: "var(--chrome, #16213e)",
            border: "1px solid var(--border-strong, #444)",
            borderRadius: "var(--r-md, 8px)",
            boxShadow: "0 8px 32px oklch(0 0 0 / 0.45)",
            overflow: "hidden",
            // Motion: short scale/opacity with --ease; reduced-motion collapses to instant
            animation: "profiles-popover-in var(--dur, 170ms) var(--ease, cubic-bezier(0.16,1,0.3,1))",
          }}
        >
          {/* ── Popover header row ──────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--s-5, 10px) var(--s-5, 10px) var(--s-4, 8px)",
              borderBottom: "1px solid var(--border, #333)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3, 6px)" }}>
              <span
                style={{
                  fontSize: "var(--t-sm, 12.5px)",
                  fontWeight: 600,
                  color: "var(--text, #e6e6ea)",
                }}
              >
                Perfiles
              </span>
              <span
                style={{
                  fontSize: "var(--t-2xs, 10.5px)",
                  fontWeight: 500,
                  color: "var(--text-muted, #777)",
                  background: "var(--surface-2, #252535)",
                  borderRadius: "var(--r-full, 999px)",
                  padding: "1px 6px",
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {profiles.length}
              </span>
            </div>
            {/* Transient chips */}
            {saveChip && (
              <span
                style={{
                  fontSize: "var(--t-2xs, 10.5px)",
                  color: "var(--success, #81C784)",
                  padding: "2px 7px",
                  borderRadius: "var(--r-full, 999px)",
                  border: "1px solid var(--success, #81C784)",
                }}
              >
                {saveChip}
              </span>
            )}
            {applyChip && (
              <span
                style={{
                  fontSize: "var(--t-2xs, 10.5px)",
                  color: "var(--accent, #90caf9)",
                  padding: "2px 7px",
                  borderRadius: "var(--r-full, 999px)",
                  border: "1px solid var(--accent, #90caf9)",
                }}
              >
                {applyChip}
              </span>
            )}
          </div>

          {/* ── Save-as field ───────────────────────────────────────────────── */}
          <div
            style={{
              padding: "var(--s-4, 8px) var(--s-5, 10px)",
              borderBottom: "1px solid var(--border, #333)",
            }}
          >
            <div style={{ display: "flex", gap: "var(--s-3, 6px)" }}>
              <input
                ref={saveInputRef}
                type="text"
                value={saveName}
                onChange={(e) => {
                  setSaveName(e.target.value);
                  setTopError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving && !disabled) handleSave();
                }}
                placeholder="Nombre del perfil…"
                disabled={saving || disabled}
                style={{
                  flex: 1,
                  padding: "5px var(--s-4, 8px)",
                  background: "var(--surface, #1e1e2e)",
                  border: topError
                    ? "1px solid var(--danger, #e57373)"
                    : "1px solid var(--border, #333)",
                  borderRadius: "var(--r-sm, 6px)",
                  color: "var(--text, #e6e6ea)",
                  fontSize: "var(--t-sm, 12.5px)",
                  outline: "none",
                  minHeight: 32,
                  transition: "border-color var(--dur, 170ms) var(--ease)",
                  opacity: disabled ? 0.5 : 1,
                }}
              />
              <button
                onClick={handleSave}
                disabled={saving || disabled || !saveName.trim()}
                title={
                  nameMatchesExisting
                    ? "Actualizar el perfil existente con este nombre"
                    : "Guardar la config actual como perfil"
                }
                style={{
                  padding: "5px 10px",
                  background: "transparent",
                  // --accent (blue), NOT --action (green) — green discipline
                  color:
                    saving || disabled || !saveName.trim()
                      ? "var(--text-faint, #555)"
                      : "var(--accent, #90caf9)",
                  border: "1px solid",
                  borderColor:
                    saving || disabled || !saveName.trim()
                      ? "var(--border, #333)"
                      : "var(--accent, #90caf9)",
                  borderRadius: "var(--r-sm, 6px)",
                  fontSize: "var(--t-sm, 12.5px)",
                  fontWeight: 500,
                  cursor:
                    saving || disabled || !saveName.trim() ? "not-allowed" : "pointer",
                  minHeight: 32,
                  whiteSpace: "nowrap",
                  transition: "color var(--dur, 170ms) var(--ease), border-color var(--dur, 170ms) var(--ease)",
                  opacity: saving || disabled ? 0.5 : 1,
                }}
              >
                {saving ? "…" : nameMatchesExisting ? "Actualizar" : "Guardar actual"}
              </button>
            </div>
            {/* Inline save error */}
            {topError && (
              <div
                style={{
                  marginTop: "var(--s-2, 4px)",
                  fontSize: "var(--t-2xs, 10.5px)",
                  color: "var(--danger, #e57373)",
                }}
              >
                {topError}
              </div>
            )}
            {/* Render-disabled hint */}
            {disabled && (
              <div
                style={{
                  marginTop: "var(--s-2, 4px)",
                  fontSize: "var(--t-2xs, 10.5px)",
                  color: "var(--text-muted, #777)",
                }}
              >
                No disponible durante el renderizado
              </div>
            )}
          </div>

          {/* ── Profiles list ───────────────────────────────────────────────── */}
          <div
            style={{
              maxHeight: 240,
              overflowY: "auto",
              padding: "var(--s-2, 4px) 0",
            }}
          >
            {listLoading && (
              <div
                style={{
                  padding: "var(--s-8, 16px) var(--s-5, 10px)",
                  fontSize: "var(--t-sm, 12.5px)",
                  color: "var(--text-muted, #777)",
                  textAlign: "center",
                }}
              >
                Cargando…
              </div>
            )}
            {listError && (
              <div
                style={{
                  padding: "var(--s-4, 8px) var(--s-5, 10px)",
                  fontSize: "var(--t-sm, 12.5px)",
                  color: "var(--danger, #e57373)",
                }}
              >
                {listError}
              </div>
            )}
            {!listLoading && !listError && profiles.length === 0 && (
              <EmptyState />
            )}
            {!listLoading &&
              !listError &&
              profiles.map((profile) => (
                <ProfileRow
                  key={profile.slug}
                  profile={profile}
                  isActive={activeSlug === profile.slug}
                  isApplying={applyingSlug === profile.slug}
                  isRenaming={renamingSlug === profile.slug}
                  renameValue={renamingSlug === profile.slug ? renameValue : profile.name}
                  isDeleting={deletingSlug === profile.slug}
                  isDeletingInProgress={deleting && deletingSlug === profile.slug}
                  isRenamingInProgress={renaming && renamingSlug === profile.slug}
                  rowError={rowError?.slug === profile.slug ? rowError.msg : null}
                  disabled={disabled}
                  onApply={() => handleApply(profile.slug)}
                  onRenameStart={() => {
                    setRenamingSlug(profile.slug);
                    setRenameValue(profile.name);
                    setRowError(null);
                    setDeletingSlug(null);
                  }}
                  onRenameChange={(v) => setRenameValue(v)}
                  onRenameKey={(e) => handleRenameKey(e, profile.slug)}
                  onRenameBlur={() => commitRename(profile.slug)}
                  onDeleteStart={() => {
                    setDeletingSlug(profile.slug);
                    setRowError(null);
                    setRenamingSlug(null);
                  }}
                  onDeleteCancel={() => setDeletingSlug(null)}
                  onDeleteConfirm={() => handleDelete(profile.slug)}
                />
              ))}
          </div>
        </div>
      )}

      {/* ── Keyframe style (inline, no external CSS) ─────────────────────── */}
      <style>{`
        @keyframes profiles-popover-in {
          from { opacity: 0; transform: scale(0.97) translateY(-4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes profiles-popover-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}

// ─── TriggerButton ────────────────────────────────────────────────────────────

function TriggerButton({
  triggerRef,
  open,
  disabled,
  onClick,
}: {
  triggerRef: React.RefObject<HTMLButtonElement>;
  open: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      ref={triggerRef}
      onClick={onClick}
      disabled={disabled}
      aria-expanded={open}
      aria-haspopup="dialog"
      title="Perfiles de configuración"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "7px 14px",
        // Outline style — NOT green (green discipline: --action is for Render Video only)
        background: open
          ? "var(--surface-2, #252535)"
          : hovered
          ? "var(--surface, #1e1e2e)"
          : "transparent",
        color: disabled
          ? "var(--text-muted, #777)"
          : open || hovered
          ? "var(--accent, #90caf9)"
          : "var(--text, #e6e6ea)",
        border: "1px solid",
        borderColor:
          disabled
            ? "var(--border, #333)"
            : open || hovered
            ? "var(--accent, #90caf9)"
            : "var(--border-strong, #444)",
        borderRadius: "var(--r-sm, 6px)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "var(--t-sm, 12.5px)",
        fontWeight: 400,
        minHeight: 32,
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--s-2, 4px)",
        transition:
          "color var(--dur, 170ms) var(--ease), border-color var(--dur, 170ms) var(--ease), background var(--dur, 170ms) var(--ease)",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      Perfiles
      <span
        style={{
          fontSize: "0.7em",
          lineHeight: 1,
          display: "inline-block",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform var(--dur, 170ms) var(--ease)",
        }}
      >
        ▾
      </span>
    </button>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
// sketch-findings first-run/empty-workspace grammar: calm one-liner + hint

function EmptyState() {
  return (
    <div
      style={{
        padding: "var(--s-8, 16px) var(--s-5, 10px)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "var(--t-sm, 12.5px)",
          color: "var(--text-muted, #777)",
          marginBottom: "var(--s-2, 4px)",
        }}
      >
        Aún no guardaste perfiles
      </div>
      <div
        style={{
          fontSize: "var(--t-2xs, 10.5px)",
          color: "var(--text-faint, #555)",
          lineHeight: 1.4,
        }}
      >
        Guardá el estilo actual con un nombre arriba.
      </div>
    </div>
  );
}

// ─── ProfileRow ───────────────────────────────────────────────────────────────

interface ProfileRowProps {
  profile: ProfileSummary;
  isActive: boolean;
  isApplying: boolean;
  isRenaming: boolean;
  renameValue: string;
  isDeleting: boolean;
  isDeletingInProgress: boolean;
  isRenamingInProgress: boolean;
  rowError: string | null;
  disabled: boolean;
  onApply: () => void;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameKey: (e: React.KeyboardEvent) => void;
  onRenameBlur: () => void;
  onDeleteStart: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}

function ProfileRow({
  profile,
  isActive,
  isApplying,
  isRenaming,
  renameValue,
  isDeleting,
  isDeletingInProgress,
  isRenamingInProgress,
  rowError,
  disabled,
  onApply,
  onRenameStart,
  onRenameChange,
  onRenameKey,
  onRenameBlur,
  onDeleteStart,
  onDeleteCancel,
  onDeleteConfirm,
}: ProfileRowProps) {
  const [hovered, setHovered] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming) {
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [isRenaming]);

  return (
    <div
      data-testid={`profile-row-${profile.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        // Active profile: subtle filled/--accent left border
        borderLeft: isActive
          ? "3px solid var(--accent, #90caf9)"
          : "3px solid transparent",
        background: isActive
          ? "oklch(0.55 0.09 240 / 0.12)"
          : hovered
          ? "var(--surface-hover, rgba(255,255,255,0.04))"
          : "transparent",
        padding: "0 var(--s-5, 10px) 0 var(--s-4, 8px)",
        transition: "background var(--dur, 170ms) var(--ease)",
        cursor: isApplying || disabled ? "default" : "pointer",
      }}
    >
      {/* ── Row body ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          minHeight: 36,
          gap: "var(--s-3, 6px)",
        }}
      >
        {/* Applying spinner */}
        {isApplying && (
          <span
            style={{
              width: 12,
              height: 12,
              flexShrink: 0,
              border: "2px solid var(--border, #333)",
              borderTopColor: "var(--accent, #90caf9)",
              borderRadius: "50%",
              display: "inline-block",
              animation: "profiles-spin 0.7s linear infinite",
            }}
          />
        )}
        {/* Active check (not applying) */}
        {isActive && !isApplying && (
          <span
            style={{
              color: "var(--accent, #90caf9)",
              fontSize: "var(--t-sm, 12.5px)",
              flexShrink: 0,
            }}
          >
            ✓
          </span>
        )}

        {/* Name (editable when renaming) */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={onRenameKey}
            onBlur={onRenameBlur}
            style={{
              flex: 1,
              padding: "2px var(--s-3, 6px)",
              background: "var(--surface, #1e1e2e)",
              border: "1px solid var(--accent, #90caf9)",
              borderRadius: "var(--r-xs, 4px)",
              color: "var(--text, #e6e6ea)",
              fontSize: "var(--t-sm, 12.5px)",
              outline: "none",
              minHeight: 26,
            }}
          />
        ) : (
          <div
            onClick={!disabled && !isApplying ? onApply : undefined}
            style={{
              flex: 1,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: "var(--t-sm, 12.5px)",
                color: isActive
                  ? "var(--accent, #90caf9)"
                  : "var(--text, #e6e6ea)",
                fontWeight: isActive ? 500 : 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {profile.name}
            </div>
            <div
              style={{
                fontSize: "var(--t-2xs, 10.5px)",
                // --t-dim equivalent = --text-muted
                color: "var(--text-muted, #777)",
                marginTop: 1,
              }}
            >
              {relativeTime(profile.updatedAt)}
            </div>
          </div>
        )}

        {/* Row actions — revealed on hover/focus (rename + delete) */}
        {!isRenaming && !isDeleting && (hovered || isActive) && (
          <div
            style={{
              display: "flex",
              gap: "var(--s-2, 4px)",
              flexShrink: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Rename (pencil) */}
            <IconButton
              title="Renombrar"
              onClick={onRenameStart}
              disabled={isRenamingInProgress || disabled}
              color="var(--text-muted, #777)"
              hoverColor="var(--accent, #90caf9)"
            >
              ✎
            </IconButton>
            {/* Delete (trash) — --danger, low-chroma */}
            <IconButton
              title="Eliminar"
              onClick={onDeleteStart}
              disabled={isDeletingInProgress || disabled}
              color="var(--text-muted, #777)"
              hoverColor="var(--danger, #e57373)"
            >
              ✕
            </IconButton>
          </div>
        )}
      </div>

      {/* ── Inline delete confirm ──────────────────────────────────────────── */}
      {isDeleting && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-3, 6px)",
            padding: "var(--s-2, 4px) 0 var(--s-3, 6px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            style={{
              fontSize: "var(--t-2xs, 10.5px)",
              color: "var(--danger, #e57373)",
              flex: 1,
            }}
          >
            ¿Borrar este perfil?
          </span>
          <button
            onClick={onDeleteConfirm}
            disabled={isDeletingInProgress}
            style={deleteConfirmBtnStyle(true)}
          >
            {isDeletingInProgress ? "…" : "Sí"}
          </button>
          <button
            onClick={onDeleteCancel}
            disabled={isDeletingInProgress}
            style={deleteConfirmBtnStyle(false)}
          >
            No
          </button>
        </div>
      )}

      {/* ── Row error ─────────────────────────────────────────────────────── */}
      {rowError && (
        <div
          style={{
            fontSize: "var(--t-2xs, 10.5px)",
            color: "var(--danger, #e57373)",
            padding: "var(--s-2, 4px) 0 var(--s-3, 6px)",
          }}
        >
          {rowError}
        </div>
      )}

      {/* ── Spin keyframe (shared; added once per render of a row with spinner) */}
      {isApplying && (
        <style>{`
          @keyframes profiles-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      )}
    </div>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────

function IconButton({
  children,
  title,
  onClick,
  disabled,
  color,
  hoverColor,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled: boolean;
  color: string;
  hoverColor: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "transparent",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        color: hovered && !disabled ? hoverColor : color,
        fontSize: 13,
        padding: "2px 4px",
        borderRadius: "var(--r-xs, 4px)",
        minHeight: 24,
        minWidth: 24,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "color var(--dur, 170ms) var(--ease)",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ─── Delete confirm button style helper ──────────────────────────────────────

function deleteConfirmBtnStyle(isDanger: boolean): React.CSSProperties {
  return {
    padding: "2px 8px",
    background: "transparent",
    // danger = --danger (low-chroma red); cancel = neutral/muted
    color: isDanger ? "var(--danger, #e57373)" : "var(--text-muted, #777)",
    border: "1px solid",
    borderColor: isDanger ? "var(--danger, #e57373)" : "var(--border, #333)",
    borderRadius: "var(--r-xs, 4px)",
    fontSize: "var(--t-2xs, 10.5px)",
    fontWeight: 500,
    cursor: "pointer",
    minHeight: 22,
  };
}
