---
phase: 28-subt-tulos-pro-bar-background-por-palabra
plan: 03
subsystem: remotion-studio editor (Subtítulos tab)
tags: [frontend, subtitles, word-background, style-controls, SUB-01, SUB-02]
requires:
  - "28-01: WordBackground type + config.wordBackground + TikTokLayout render path + validatePipelineConfig"
  - "28-02: karaoke removed; StyleControls/PreviewApp coexist on the merged editor surface"
provides:
  - "Fondo por palabra editor controls (toggle + color + opacity + borderRadius + padding) wired to onChange({ wordBackground })"
affects:
  - services/remotion-studio/src/editor/components/StyleControls.tsx
tech-stack:
  added: []
  patterns:
    - "FxBlock collapsible effect-row idiom (reused verbatim from Fondo resaltado / Glow exterior)"
    - "Color law D-04: subtitle controls use --accent; --action green is the Render CTA only"
key-files:
  created:
    - services/remotion-studio/src/editor/components/word-background-controls.test.tsx
  modified:
    - services/remotion-studio/src/editor/components/StyleControls.tsx
decisions:
  - "Defaults for the editor fallback const mirror the schema default (disabled, color #000000, opacity 0.6, radius 8, padding 6) so the control reflects existing behavior until toggled on."
  - "No PreviewApp edit needed: onChange routes through updateSubtitle -> setSubtitleConfig -> Player, and TikTokLayout (28-01) reads config.wordBackground."
metrics:
  duration: ~10m
  completed: 2026-06-07
  tasks_completed: 1
  tasks_total: 2  # 1 auto + 1 checkpoint (deferred)
  files_created: 1
  files_modified: 1
  tests: "studio vitest 506 passed (500 baseline + 6 new)"
---

# Phase 28 Plan 03: Fondo por palabra editor controls Summary

Added the Studio editor controls for the per-word "Fondo por palabra" background (SUB-01 toggle, SUB-02 color/transparency/border-radius/padding) as a collapsible FxBlock in the Subtítulos tab, wired through the existing live-preview path (onChange → updateSubtitle → Player) — the per-word bar engine + schema were already delivered in 28-01.

## What Was Built

A new "Fondo por palabra" collapsible `FxBlock` in the **Efectos** section of the RIGHT colwrap of `StyleControls.tsx`, placed right after the existing "Glow exterior" and "Fondo resaltado" blocks. It is bound to `config.wordBackground` with these controls:

- **Toggle:** enables/disables via `onChange({ wordBackground: { ...wb, enabled: !wb.enabled } })`.
- **Color:** color-swatch input (same markup as Fondo resaltado) → `onChange({ wordBackground: { ...wb, color } })`.
- **Transparencia (opacity):** `RangeRow` min 0 / max 1 / step 0.05, `format` `toFixed(2)`.
- **Radio (borderRadius):** `RangeRow` min 0 / max 40.
- **Relleno (padding):** `RangeRow` min 0 / max 40.

The editor fallback const mirrors the `backgroundHighlight` (`bh`) pattern:
`const wb: WordBackground = config.wordBackground ?? { enabled: false, color: "#000000", opacity: 0.6, borderRadius: 8, padding: 6 }`, and `WordBackground` is imported from `../../pipeline-config.js` (the type delivered in 28-01).

Live preview: no `PreviewApp` edit required — the same `onChange` prop the sibling FxBlocks use routes through `updateSubtitle → setSubtitleConfig → Player`, and `TikTokLayout` (28-01) reads `config.wordBackground`.

## Tests

New `word-background-controls.test.tsx` (6 tests):
1. Block renders, off by default (`apagado` hint).
2. Toggle calls `onChange({ wordBackground: { enabled: true, ... } })`.
3. When enabled, Transparencia / Radio / Relleno + color input present.
4. Opacity edit routes through `onChange({ wordBackground: { opacity } })`.
5. Color edit routes through `onChange({ wordBackground: { color } })`.
6. Color law: no hardcoded `#4CAF50` (Render-CTA green) on the controls.

## Gates

- `npx vitest run` (studio): **506 passed (26 files)** — 500 baseline + 6 new. PASSED.
- `npm run build:editor`: **built in ~1.8s, 189 modules transformed.** PASSED. (Only pre-existing benign warnings: react-router/`@remotion/player` `"use client"` directive notices, the 500 kB chunk-size advisory, and the gitignored `dist/editor` outDir notice — no errors.)

## Frontend Tooling Mandate (AGENTS.md)

The `impeccable` skill and `frontend-design` plugin are **not invokable as tool surfaces in this execution runtime** (no Skill/plugin tool available to this agent) — documented here as a skip per the AGENTS.md "document the skip if unavailable" clause. The design-system intent was honored directly via the loaded `sketch-findings-reel-factory` SKILL.md:
- **Green-discipline:** controls use `--accent` / neutral tokens; zero `#4CAF50` (asserted by test). The bar's user color picker is separate user content, not a UI accent.
- **Idiom reuse:** the new block reuses the existing `FxBlock` + color-swatch + `RangeRow` markup verbatim (matches the title outerGlow / Fondo resaltado control grammar) — no improvised UI.
- **Token grammar:** all spacing/type/radius/motion use the existing `--s-*`, `--t-*`, `--r-*`, `--ease`, `--dur` tokens; no side-stripe borders.

## Deviations from Plan

None — plan executed exactly as written. No bugs, missing functionality, or blocking issues encountered (Rules 1–4 not triggered). No renderer changes were needed (UI-only; no synced composition touched).

**Worktree note (not a plan deviation):** the agent started on a base (`8c94196`) that did not contain the 28-01/28-02 merge; per the `<worktree_branch_check>` instruction the worktree was `git reset --hard` to the expected base `8333302` (the 28-02 merge commit) before any work. `node_modules` was symlinked from the main checkout (no installs) to satisfy the gates.

## DEFERRED — Docker live-UAT checkpoint (Task 2, blocking human-verify)

Task 2 is a **blocking human-verify checkpoint** requiring a Studio Docker rebuild (`docker compose build remotion-studio && docker compose up -d remotion-studio`) and manual UAT at http://localhost:3123. Per the execution constraints, this was **NOT attempted** by the executor (no Docker rebuild). It is **deferred to the user** as a manual follow-up.

Manual steps for the user (verbatim from the plan):
1. `docker compose build remotion-studio && docker compose up -d remotion-studio` (the studio runs as a Docker container baking `dist` at build time; the `npx tsx` CLAUDE.md command cannot bind :3123 — see memory note `studio-runs-as-docker-not-host-tsx`).
2. Open http://localhost:3123 → Subtítulos tab → layout = TikTok.
3. Enable "Fondo por palabra" → confirm a rounded colored rectangle appears behind the active (highlighted) word in the live preview.
4. Adjust Color / Transparencia / Radio / Relleno → confirm each updates the bar in real time.
5. Confirm Karaoke is no longer offered as a layout option (SUB-04 visual check — delivered in 28-02).
6. (Optional parity spot-check) short real render with the bar enabled to confirm render matches preview (SUB-03), or defer to milestone UAT.

Resume signal: user types "approved" or describes any mismatch.

## Success Criteria

- **SUB-01:** ✅ (code) — the user can toggle the per-word bar from the Subtítulos tab. Live-UAT confirmation deferred to the user.
- **SUB-02:** ✅ (code) — the user can configure color, transparency, border-radius, and padding; edits flow to the live preview path. Live-UAT confirmation deferred to the user.

## Commits

- `41893de` feat(28-03): Fondo por palabra controls in StyleControls (SUB-01/02)

## Self-Check: PASSED

- FOUND: services/remotion-studio/src/editor/components/StyleControls.tsx (modified)
- FOUND: services/remotion-studio/src/editor/components/word-background-controls.test.tsx (created)
- FOUND: commit 41893de
