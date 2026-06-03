---
quick_id: 260603-igq
slug: guardar-config-saves-committed-state-not
phase: quick
subsystem: remotion-studio/preview
tags: [bug-fix, state-wiring, save-persistence]
key-files:
  modified:
    - services/remotion-studio/src/preview/PreviewApp.tsx
decisions:
  - Serialize liveTitles/liveOverlays (preview state) in handleSave instead of committed titles/overlays
  - Reconcile committed state on successful save to prevent revert when editing a different item later
metrics:
  duration: ~5m
  completed: 2026-06-03
---

# Quick 260603-igq: Guardar config saves committed state not live preview — Summary

**One-liner:** Fixed `handleSave` to serialize the live preview state (`liveTitles`/`liveOverlays`) instead of the committed state, with post-save reconciliation to prevent revert on subsequent edits.

## What Was Done

Single change to `services/remotion-studio/src/preview/PreviewApp.tsx`, three lines touched:

1. **Payload uses live state (L306-310):** `titles: liveTitles, overlays: liveOverlays` — "Guardar config" now persists exactly what the preview shows.
2. **useCallback deps updated (L343):** `[subtitleConfig, liveTitles, liveOverlays]` — closure always captures current preview state.
3. **Committed state reconciled on success (L332-333):** `setTitles(liveTitles); setOverlays(liveOverlays);` — prevents `computeLiveTitles`/`computeLiveOverlays` from reverting a saved-but-uncommitted edit when the user next edits a different item.

## Root Cause

PreviewApp maintains two state layers: committed (`titles`/`overlays`) and live preview (`liveTitles`/`liveOverlays`). Position/style edits in TitleEditor/OverlayEditor call only `onPreviewChange` (live), not `onChange` (committed), until the user explicitly clicks the per-item "Guardar edicion" button. The old `handleSave` was serializing committed state — so live-only edits were silently dropped on save.

## Verification

- `npm run build:editor` — exits 0 (TypeScript + Vite clean)
- `npx vitest run` — 7 files, 142 tests, all green

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- File modified: `services/remotion-studio/src/preview/PreviewApp.tsx` — FOUND
- Build: exits 0
- Tests: 142/142 passed
