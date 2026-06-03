---
quick_id: 260603-hob
slug: save-config-shows-generic-error-al-guard
status: complete
date: 2026-06-03
files_modified:
  - services/remotion-studio/src/preview/PreviewApp.tsx
decisions:
  - "Field-level errors joined with '; ' into a single message, falling back to errData.error then HTTP status"
  - "Badge truncates at 60 chars for header compactness; full message always available via title tooltip"
---

# Quick Task 260603-hob Summary

**One-liner:** Surface PUT /api/config field-level validation errors (`errData.errors[]`) in the Guardar config badge instead of the hardcoded "✕ Error al guardar" string.

## What Was Done

Two defects in `PreviewApp.tsx` caused save failures to show a generic hardcoded message:

1. `handleSave` (L318-321): read only `errData.error` ("Invalid config" — generic), ignoring `errData.errors` (the array of field-level messages from `validatePipelineConfig`).
2. The error badge (L368-378): rendered the fixed string "✕ Error al guardar" instead of the `saveError` state value.

### Fix 1 — handleSave error extraction

When `!res.ok`, the new code checks `errData.errors` first (a `string[]` of field-level messages like `"titles[1].style.x must be a non-negative number"`). If present, it joins them with `"; "`. Falls back to `errData.error`, then to `"Save failed: ${res.status}"`. The resulting message is thrown and lands in `saveError` state.

### Fix 2 — Error badge renders real content

The badge now renders `✕ ${saveError}` (truncated to 60 chars in the visible text) instead of the hardcoded string. The `title` attribute carries the full untruncated `saveError` for hover inspection. CSS `maxWidth: 320 / overflow hidden / textOverflow ellipsis / whiteSpace nowrap` keeps the header single-line and prevents layout breakage. `display: inline-block / verticalAlign: middle` preserves the existing pill geometry.

The existing danger token (`--danger, #e57373` border + color) is unchanged — no new colors.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npm run build:editor` passes (verified from main repo with node_modules; worktree shares the same source).
- `npx vitest run` — 142 tests pass (caption/config/layout logic, none testing PreviewApp directly).
- No styling/color regressions; header layout stays single-line.

## Self-Check

- [x] `services/remotion-studio/src/preview/PreviewApp.tsx` modified with both fixes
- [x] Badge shows real `saveError` content, not hardcoded text
- [x] `handleSave` incorporates `errData.errors` array
- [x] `title` tooltip carries full error for hover
- [x] Danger token unchanged; no new colors introduced
