---
phase: quick-260605-pa2
plan: 01
subsystem: remotion-studio/ProfilesMenu
tags: [profiles, export, import, json, blob, filereader, green-discipline]
dependency_graph:
  requires: [Phase-24-profiles-API (GET /api/profiles/:slug, POST /api/profiles)]
  provides: [PA2-EXPORT, PA2-IMPORT]
  affects: [services/remotion-studio/src/preview/ProfilesMenu.tsx]
tech_stack:
  added: []
  patterns:
    - Blob download via URL.createObjectURL + programmatic anchor click
    - FileReader.readAsText + client-side JSON.parse + validatePipelineConfig gate
key_files:
  modified:
    - services/remotion-studio/src/preview/ProfilesMenu.tsx
    - services/remotion-studio/src/preview/profiles-menu.test.tsx
decisions:
  - "Import button uses neutral --text-muted/--text colors (not --accent) because importing is a neutral action, with --accent only on hover — aligns with green discipline (no --action)"
  - "validatePipelineConfig imported directly from pipeline-config.ts (not profiles.ts) to avoid pulling in Node.js fs dependency into the browser bundle"
  - "Test captured anchor.download via closure in click spy rather than DOM query after removeChild — anchor is removed before test can query it"
  - "FileReader mock triggers via Promise.resolve().then() microtask to mimic async behavior without hanging tests"
metrics:
  duration: "~15 min"
  completed: 2026-06-05
  tasks_completed: 2
  files_changed: 2
---

# Quick Task 260605-pa2: Export + Import Profile JSON Summary

**One-liner:** Client-side Blob download of per-row profile JSON (export) and FileReader + validatePipelineConfig + POST round-trip for .json import, with 7+3=10 new behavior tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Export — per-row ⬇ icon + Blob download | 8e861a5 | ProfilesMenu.tsx, profiles-menu.test.tsx |
| 2 | Import — file picker + validation + POST | ecb83d5 | ProfilesMenu.tsx, profiles-menu.test.tsx |

## What Was Built

### Task 1 — Export

- Extended `ProfileRowProps` with `onExport: () => void`
- Implemented `handleExport(slug)` async callback in `ProfilesMenu`:
  1. Fetches `GET /api/profiles/${slug}`
  2. On success: creates a Blob, triggers programmatic anchor `.click()` with `download="{slug}.json"`, revokes URL
  3. On fetch failure: sets `rowError` for the affected row (never touches `topError`)
- Added export `IconButton` (⬇ "Exportar") into the row action cluster between rename ✎ and delete ✕
- Colors: `--text-muted` default / `--accent` hover — never `--action` (green discipline)

### Task 2 — Import

- Added `importInputRef` (hidden file input) and `handleImport` callback
- Validation pipeline before any fetch:
  1. `JSON.parse` — SyntaxError → `setTopError("Archivo no válido: JSON inválido")`
  2. `typeof parsed.name !== "string"` → `setTopError("El archivo no tiene un campo 'name'")`
  3. `validatePipelineConfig(config)` — invalid → `setTopError("Config inválida: {errors[0]}")`
- On valid file: `POST /api/profiles { name, config }` — success shows "✓ Perfil importado" chip + `fetchProfiles()`; server error surfaces in `topError`
- Accepts both full `ProfileFile` envelope (`{slug, name, updatedAt, config}`) and bare `{name, config}`
- `ImportarButton` component: neutral `--text-muted/--border` outline, `--accent` on hover, never `--action`
- Imported `validatePipelineConfig` from `../pipeline-config.js` directly (browser-safe; `profiles.ts` pulls `fs`)

## Test Coverage

| Suite | Tests Before | Tests After |
|-------|-------------|-------------|
| profiles-menu.test.tsx | 22 | 32 |
| profiles.test.ts | (unchanged) | 56 |
| profiles-api.test.ts | (unchanged) | 13 |
| **Total** | **91** | **101** |

All 101 pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test anchor.download assertion after DOM removal**
- **Found during:** Task 1 GREEN
- **Issue:** `document.querySelector("a[download]")` returns null because `document.body.removeChild(a)` runs before the assertion
- **Fix:** Captured `this.download` via closure inside the `click` spy (`capturedDownload = this.download`) instead of querying DOM post-removal
- **Files modified:** profiles-menu.test.tsx
- **Commit:** 8e861a5

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Export and import are pure client-side; they use existing `GET /api/profiles/:slug` and `POST /api/profiles` routes. `validatePipelineConfig` client-side gate satisfies T-pa2-01 (double fence with server validation).

## Self-Check: PASSED

- `services/remotion-studio/src/preview/ProfilesMenu.tsx` — exists, modified
- `services/remotion-studio/src/preview/profiles-menu.test.tsx` — exists, modified
- Commits 8e861a5 and ecb83d5 — verified in git log
- 101/101 tests pass
- No `--action` token in style rules (comments only)
- `validatePipelineConfig` import from `pipeline-config.ts` (no `fs` dependency in browser bundle)
