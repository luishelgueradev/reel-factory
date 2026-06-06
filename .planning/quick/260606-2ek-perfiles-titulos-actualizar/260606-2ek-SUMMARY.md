---
phase: quick-260606-2ek
plan: 01
subsystem: remotion-studio / preview
tags: [profiles, ui, ux, studio, titles, green-discipline]
requires:
  - ProfilesMenu.tsx existing save/apply/activeSlug machinery (Phase 24-03)
  - POST /api/profiles overwrite-on-slug-collision contract (server, unchanged)
provides:
  - One-click "Actualizar «{activeName}»" update-active-profile affordance
affects:
  - services/remotion-studio/src/preview/ProfilesMenu.tsx
tech-stack:
  added: []
  patterns:
    - "Reuse POST /api/profiles { name: activeName, config } as the update path (slug collision = overwrite)"
    - "Label spans multiple text nodes → query the control by its title attribute in tests"
key-files:
  created: []
  modified:
    - services/remotion-studio/src/preview/ProfilesMenu.tsx
    - services/remotion-studio/src/preview/profiles-menu.test.tsx
decisions:
  - "Update affordance placed as the PRIMARY action at the top of the save-as block, above the save-as-new input, so it reads as the default when a profile is active."
  - "Green discipline held: --accent (blue) only; diverged config gets a calm low-chroma accent-tint fill + '· Modificado' cue (sketch 034-A), never --action green nor a new red alarm."
  - "No side-stripe accent border (impeccable absolute ban) — used a full border + background tint for the divergence emphasis instead."
  - "Optional saveName pre-fill was SKIPPED (planner-flagged risk: it invites accidentally overwriting when the user meant 'save new'). The explicit affordance is the primary fix."
metrics:
  duration: ~12 min
  completed: 2026-06-06
---

# Phase quick-260606-2ek Plan 01: Perfiles — títulos actualizar Summary

One-click "Actualizar «{activeName}»" affordance in ProfilesMenu re-saves the live config (titles included) to the active profile with no name re-typing, so distinct profiles can finally diverge in their titles.

## What Was Built

A primary, full-width update-active control inside the ProfilesMenu popover that appears **only when a profile is active**. Clicking it POSTs `{ name: activeName, config: getCurrentConfig() }` to `/api/profiles` — the server slugifies the name and a slug collision overwrites the existing file, which IS the documented update path (no server change). The list refreshes, the profile stays active, and the existing `✓ Perfil guardado` chip confirms.

The root cause of the reported symptom ("switching profiles doesn't change the titles") was a UX gap, not a save/apply bug: the only prior way to re-save a profile was to manually re-type its exact name into the save-as field so the button flipped to "Actualizar" — easy to skip or mistype, so profiles never reliably diverged. This change removes that friction at the UX level.

### Task 1 — Update-active affordance + tests (TDD)
- `handleUpdateActive` callback: reuses the existing POST flow with `name = activeName` (held in an `activeNameRef` so the callback re-saves under the current active name without re-creating on every list change). On error it reuses `setTopError` exactly like `handleSave`; guarded on `saving || disabled`.
- `UpdateActiveButton` component: full-width, `--accent` (blue) outline; when `modified` is true it gains a low-chroma accent-tint fill + a `· Modificado` amber cue, inviting the update calmly (informational, not an alarm). Truncates long names with ellipsis.
- Rendered only when `activeName` is present; the save-as-new ("Guardar actual") input+button and the "Importar" row are untouched and clearly distinct ("…o guardá como nuevo perfil:" divider).
- 4 new tests (absence when no active profile, presence + label/title when active, POST body = `{ name: activeName, config: getCurrentConfig() }` + chip, green-discipline color assertion).

### Task 2 — Build + full suite
- `npm run build:editor`: succeeds (only pre-existing informational warnings — outDir-outside-root note, chunk-size advisory, react-router "use client" directive notes).
- `npm test` (full studio vitest): **452 tests across 21 files pass**, including the 4 new update-active tests; no prior tests broken.

## Frontend Tooling Mandate (AGENTS.md, non-negotiable)
- `impeccable` skill: **invoked.** Register = product (dense control panel). Honored shared design laws — no side-stripe borders (full border + tint used instead for the divergence emphasis), no em dashes, OKLCH accent tint, motion only on color/background (not layout).
- `frontend-design` plugin (Claude Code): **invoked.** Reinforced intentional, token-grammar-consistent styling.
- `sketch-findings-reel-factory`: **loaded and honored.** Green discipline (—`--action` reserved for Render Video CTA only) held — the update control uses `--accent`. Reused the established `--warning` "Modificado" divergence cue (sketch 034-A) rather than inventing a new alarm. Token grammar (`--s-*`, `--t-*`, `--r-*`, `--ease`, `--dur`) matched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed studio dependencies in the worktree**
- **Found during:** Task 1 verification (first `vitest` run).
- **Issue:** The worktree had no `services/remotion-studio/node_modules` (worktree devDep gotcha — node_modules doesn't merge), so vitest/vite could not resolve. This blocked both the TDD RED run and Task 2.
- **Fix:** Ran `npm install` in `services/remotion-studio/` (used the existing committed `package-lock.json`; no lockfile change, no new deps). This is an install of already-declared, already-locked dependencies — not a new/ambiguous package add, so the Rule 3 package-install exclusion does not apply.
- **Files modified:** None tracked (node_modules is gitignored).
- **Commit:** n/a (no source change).
- **Follow-up for user:** After this branch merges, the primary tree may need `npm install` in `services/remotion-studio/` before its tests run (per MEMORY: worktree-devdep-install-gotcha).

**2. [Plan adjustment] Tests query the control by its `title` attribute, not split label text**
- **Found during:** Task 1 GREEN.
- **Issue:** The button label renders across multiple `<span>` nodes ("Actualizar" + "«{activeName}»"), so `getByText(startsWith("Actualizar «"))` cannot match (per-node matching). This is a test-authoring detail, not a behavior change.
- **Fix:** Query the control by its `title` ("Actualizar el perfil activo «{name}» …"), an accessible, unambiguous selector; still assert label text via `textContent`. Behavior asserted is identical to the plan's `<behavior>` (presence/absence, POST body, chip, color).

### Skipped (intentional, plan-sanctioned)
- **Optional `saveName` pre-fill on open when active:** skipped. The planner flagged the risk that pre-filling the save-as-new field with the active name invites accidental overwrite when the user meant "save new". The explicit affordance is the primary, safer fix; the empty save-as path stays the default.

## Out of Scope (untouched, per constraints)
- Server (`server.ts` / `profiles.ts`) — unchanged.
- PreviewApp title/state wiring — unchanged.
- No renderer sync (ProfilesMenu is studio/preview-only UI).

## Manual Follow-up (user, NOT executor)
The :3123 Studio runs as a Docker container baking `dist/editor` at build time. To see this live:
```
docker compose build remotion-studio && docker compose up -d remotion-studio
```
Then: edit titles in the Títulos tab → open Perfiles → click "Actualizar «{activeName}»" → switch to another profile and back → confirm the active profile now carries its own titles. (Pre-existing `general.json`/`rojo.json` already converged to identical titles; re-saving each with its intended titles is what makes them diverge going forward.)

## Known Stubs
None.

## Self-Check: PASSED
- `services/remotion-studio/src/preview/ProfilesMenu.tsx` — FOUND (modified, contains `handleUpdateActive` + `UpdateActiveButton` + "Actualizar").
- `services/remotion-studio/src/preview/profiles-menu.test.tsx` — FOUND (modified, 4 update-active tests).
- Commit `62ca286` (test/RED) — FOUND.
- Commit `ab06116` (feat/GREEN) — FOUND.
- `npm run build:editor` — PASSED. `npm test` — PASSED (452/452).

## TDD Gate Compliance
- RED gate: `test(quick-260606-2ek): add failing tests …` (`62ca286`) — failing tests committed first (3 fail / 1 pass on RED).
- GREEN gate: `feat(quick-260606-2ek): one-click 'Actualizar «{activeName}»' …` (`ab06116`) — implementation, 4/4 update-active + 37/37 menu + 452/452 suite pass.
- REFACTOR: none needed (code clean, helper appropriately factored).
