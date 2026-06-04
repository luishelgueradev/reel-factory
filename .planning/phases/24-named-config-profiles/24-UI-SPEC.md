---
phase: 24-named-config-profiles
type: ui-spec
requirements: [PROFILE-01, PROFILE-02, PROFILE-03]
tokens_source: existing OKLCH design tokens (PreviewApp/editor — --action, --accent, --danger, --t-*, --s-*, --r-*, --ease, --dur)
mandatory_tooling: "impeccable skill + frontend-design plugin (AGENTS.md non-negotiable) + sketch-findings-reel-factory"
---

# Phase 24 — UI design contract: Named config profiles

## Where it lives
The **header action zone** of the Studio, immediately left of the existing green **"Guardar config"** CTA. A single trigger button **"Perfiles ▾"** (neutral/outline, `--accent` on hover/active — NOT green). Clicking opens an **inline popover** anchored under the trigger (inline-first; no full-screen modal — honors the project modal-stack law). Column 3 is untouched (reserved for Phase 25).

Reference: sketch-findings `named style presets` + `header action zone`.

## Popover anatomy (top → bottom)
1. **Header row:** "Perfiles" label + a small count chip (e.g. "3"). 
2. **Save-as field:** a compact text input (placeholder "Nombre del perfil…") + a **"Guardar actual"** button (`--accent`, NOT `--action`-green). Saving the current Studio config under the typed name. If the name matches an existing profile, the button label becomes "Actualizar" and confirms overwrite inline (no modal). (PROFILE-01)
3. **Divider.**
4. **Profiles list** (scrollable, max-height ~ 5 rows then scroll), sorted by most-recently-updated. Each **row**:
   - Profile **name** (click anywhere on the row body → **load/apply**; the active profile row shows a subtle filled/`--accent` left border + a check). (PROFILE-02)
   - Relative "updated" timestamp, muted/`--t-dim`.
   - A right-aligned **row actions** cluster, revealed on hover/focus: **rename** (pencil) and **delete** (trash, `--danger`, low-chroma). (PROFILE-03)
   - **Rename** is inline: the name becomes an editable input in place (Enter = commit, Esc = cancel). No modal.
   - **Delete** asks for inline confirm in the row ("¿Borrar? Sí / No") — destructive, low-chroma danger, never a second green.
5. **Empty state:** when no profiles exist — a calm one-liner "Aún no guardaste perfiles" + hint "Guardá el estilo actual con un nombre arriba." (sketch-findings first-run/empty-workspace grammar.)

## States & feedback
- **Loading a profile:** the row shows a brief inline spinner; on success the popover can stay open with the new active row marked, and the preview updates (the apply response refreshes Studio state). A transient "✓ Perfil aplicado" chip (mirror the existing "✓ Guardado recién" chip pattern), auto-clearing ~2s.
- **Saving:** "✓ Perfil guardado" chip; the new/updated row appears/moves to top immediately (optimistic, reconciled with the server response). (PROFILE-01)
- **Error** (save/apply/rename/delete failure): inline danger line in the popover with the cause; never silent.
- **Disable** profile actions while a render is running if applying would change the active config mid-job (guard: if render state is `submitting|running`, disable apply + save and show a muted hint). Reuse the render-state machine from 23-04.

## Visual discipline (impeccable / frontend-design)
- **Green discipline:** exactly one `--action` green on screen — "Guardar config". All profile actions use `--accent` (primary affordance) / neutral outline / `--danger` (delete only). No second green.
- **Tokens only:** spacing `--s-*`, type `--t-*`, radius `--r-*`, motion `--ease`/`--dur`. No improvised px/colors.
- **Motion:** popover open = short scale/opacity with `--ease`; respects `prefers-reduced-motion` (collapse to instant).
- **Density:** compact rows, comfortable hit targets (≥ 32px). Keyboard accessible: trigger toggles popover, Esc closes, arrow keys move between rows, Enter loads, rename/delete reachable by Tab.
- **Focus management:** opening focuses the save-as input; closing returns focus to the trigger.

## Acceptance (visual)
- Profiles control reads as part of the header action zone, visually subordinate to "Guardar config".
- No modal; all interactions inline within the popover.
- Single green on screen at all times.
- Empty, populated, loading, and error states all designed (no raw/unstyled states).
