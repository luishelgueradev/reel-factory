---
phase: 24-named-config-profiles
plan: "03"
subsystem: remotion-studio/profiles-ui
tags: [profiles, react-popover, inline-first, green-discipline, testing-library, vitest]
dependency_graph:
  requires: [24-02-profiles-api, PreviewApp.tsx]
  provides: [ProfilesMenu.tsx, profiles-menu.test.tsx, PreviewApp.tsx (updated)]
  affects: [Studio header action zone, live preview state]
tech_stack:
  added: []
  patterns: [inline-popover, state-extraction-helper, green-discipline-tokens]
key_files:
  created:
    - services/remotion-studio/src/preview/ProfilesMenu.tsx
    - services/remotion-studio/src/preview/profiles-menu.test.tsx
  modified:
    - services/remotion-studio/src/preview/PreviewApp.tsx
decisions:
  - "ProfilesMenu is inline-first (no modal): popover anchored under trigger, zIndex=20 (sheet layer)"
  - "applyConfigToState() extracted as shared helper for load-on-mount + onProfileApplied (DRY, correctness)"
  - "Green discipline enforced: trigger=outline/--accent-on-hover, save=--accent, delete=--danger, zero --action"
  - "node_modules symlinked from primary tree into worktree for vitest to resolve (worktree pattern)"
  - "TriggerButton uses RefObject<HTMLButtonElement|null> for React 19 type compat"
metrics:
  duration: "~18 minutes"
  completed: "2026-06-04"
  tasks_completed: 2
  files_created: 2
  tests_passing: 269
---

# Phase 24 Plan 03: Studio UI for Named Config Profiles Summary

ProfilesMenu inline popover built and mounted in the Studio header — saves the current config under a name, lists saved profiles, applies one restoring full Studio state (subtitle + titles + overlays), and renames/deletes inline. Green discipline holds: exactly one `--action` green on screen.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ProfilesMenu component + 22 tests | 917e0b2 | src/preview/ProfilesMenu.tsx, src/preview/profiles-menu.test.tsx |
| 2 | Mount ProfilesMenu in PreviewApp + wire apply→state | 7348868 | src/preview/PreviewApp.tsx, src/preview/ProfilesMenu.tsx |

## What Was Built

### ProfilesMenu.tsx

A self-contained inline popover following the 24-UI-SPEC design contract:

**Trigger:** `Perfiles ▾` button — outline style, `--accent` on hover/open. Never `--action` green. `aria-expanded` + `aria-haspopup="dialog"` for accessibility.

**Popover anatomy (top → bottom):**
1. Header row with "Perfiles" label + profile count chip. Transient feedback chips appear here (`✓ Perfil guardado` / `✓ Perfil aplicado`).
2. Save-as field: text input + "Guardar actual" button (`--accent`). If name matches existing → label becomes "Actualizar" (inline confirm). Enter submits. Error inline below field.
3. Divider.
4. Profiles list (max-height 240px, scrollable): rows sorted by `updatedAt` desc.
   - Row click → `PUT /api/profiles/:slug/apply` → `onApplied(config)` → active row marked with `--accent` left border + ✓
   - Hover reveals rename (✎, `--accent`) and delete (✕, `--danger`) icon buttons
   - Rename: inline input, Enter commits via PATCH, Esc cancels
   - Delete: inline "¿Borrar este perfil? Sí / No" confirm row → DELETE
5. Empty state: "Aún no guardaste perfiles" + hint text

**States:** loading, empty, list error, row applying (spinner), rename mode, delete confirm, per-row error, render-disabled.

**Accessibility:** Esc closes popover (+ returns focus to trigger); click-outside closes; opening focuses the save input; `aria-expanded` on trigger.

**Motion:** `profiles-popover-in` keyframe (scale 0.97 + opacity → scale 1), `prefers-reduced-motion` collapses to opacity-only.

### profiles-menu.test.tsx

22 vitest tests with `@testing-library/react` + fetch mocks:
- Trigger renders; popover opens; fetch called; empty state when no profiles
- Save-as POSTs `{ name, config }`, shows new profile + `✓ Perfil guardado` chip (PROFILE-01)
- "Actualizar" label when name matches existing
- Row click PUTs `.../apply`, calls `onApplied` without `_meta`, shows `✓ Perfil aplicado` chip (PROFILE-02)
- Active row gets ✓ mark after apply
- Rename: PATCH called with new name, row updated; Esc cancel doesn't PATCH (PROFILE-03)
- Delete: inline confirm → DELETE → row removed; "No" cancels without DELETE (PROFILE-03)
- Green discipline: no `--action`/`#4CAF50` inside the popover
- Trigger uses `--accent` not `--action` on hover
- Esc closes popover; `aria-expanded` reflects open state
- `disabled` prop prevents popover from opening

### PreviewApp.tsx changes

**`applyConfigToState(data: PipelineConfig)`**: extracted helper shared by:
- Load-on-mount `GET /api/config` fetch
- `handleProfileApplied` (apply response from ProfilesMenu)
Validates subtitle/titles/overlays shapes (WR-04), sets `setSubtitleConfig`, `setTitles`+`setLiveTitles`, `setOverlays`+`setLiveOverlays`. Live preview immediately reflects the applied profile.

**`getCurrentConfig()`**: returns `{ subtitle: subtitleConfig, titles: liveTitles, overlays: liveOverlays }` — same shape `PUT /api/config` sends.

**`handleProfileApplied(config)`**: calls `applyConfigToState(config)`.

**ProfilesMenu in header**: placed immediately left of "Guardar config", with `disabled={renderState === "submitting" || renderState === "running"}` guard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React 19 RefObject<HTMLButtonElement> type mismatch**
- **Found during:** Task 2 TypeScript check
- **Issue:** `useRef<HTMLButtonElement>(null)` returns `RefObject<HTMLButtonElement | null>` in React 19 strict types, but `TriggerButton`'s prop was typed as `RefObject<HTMLButtonElement>` (non-null).
- **Fix:** Changed prop type to `RefObject<HTMLButtonElement | null>`.
- **Files modified:** `ProfilesMenu.tsx`
- **Commit:** 7348868

**2. [Rule 3 - Blocking] Worktree has no node_modules for vitest**
- **Found during:** Task 1 test execution
- **Issue:** Git worktrees share the git tree but not `node_modules`. Running `npx vitest` from the worktree tried to load `vitest.config.ts` but couldn't resolve `vitest/config` since the worktree had no `node_modules`.
- **Fix:** Created a symlink `services/remotion-studio/node_modules → primary/services/remotion-studio/node_modules`. The symlink is untracked (gitignored via the worktree's git ignore rules for `node_modules`).
- **Note:** This is a standard worktree pattern; primary tree's `npm install` post-merge is not required for these UI-only files.
- **Files modified:** symlink only (not committed)

**3. [Rule 1 - Bug] Test assertion `toBeNull()` fails when value is `undefined`**
- **Found during:** Task 1 test — "cancels rename on Esc without patching"
- **Issue:** After Esc, the popover closes entirely (keyboard handler fires on `document`). `document.querySelector('[data-testid="..."]')` returns `null`, and `null?.querySelector(...)` returns `undefined`. `toBeNull()` rejects `undefined`.
- **Fix:** Changed assertion to `expect(input == null).toBe(true)` accepting both `null` (row gone) and `undefined` (input removed).
- **Files modified:** `profiles-menu.test.tsx`
- **Commit:** 917e0b2

## Verification

- `npx vitest run` (worktree): **269 tests passing (13 files)** — includes 22 new profiles-menu tests
- `npm run build:editor`: **succeeds** — 111 modules transformed, no TS errors in new files
- `npx tsc --noEmit`: no new errors (pre-existing errors in Root.tsx, fonts.ts, server.ts unchanged)
- Green discipline: no `--action` / `#4CAF50` inside ProfilesMenu verified by test + visual review

## Known Stubs

None. ProfilesMenu is fully wired to the 24-02 API and all states are implemented.

## Threat Flags

None. ProfilesMenu is a client-side UI component making calls to existing 24-02 API routes. No new server-side surface introduced. The `_meta` field from apply responses is stripped before passing to `onApplied`.

## Self-Check: PASSED

- `services/remotion-studio/src/preview/ProfilesMenu.tsx`: FOUND
- `services/remotion-studio/src/preview/profiles-menu.test.tsx`: FOUND
- `services/remotion-studio/src/preview/PreviewApp.tsx` (modified): FOUND
- Commit 917e0b2 (Task 1): FOUND
- Commit 7348868 (Task 2): FOUND
