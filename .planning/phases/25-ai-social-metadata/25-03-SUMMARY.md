---
phase: 25-ai-social-metadata
plan: "03"
subsystem: remotion-studio/metadata-panel
tags: [react-component, metadata-panel, col3, testing-library, green-discipline, ai-metadata]
dependency_graph:
  requires: [metadata-api-routes]
  provides: [metadata-panel-ui]
  affects:
    - services/remotion-studio/src/preview/MetadataPanel.tsx
    - services/remotion-studio/src/preview/PreviewApp.tsx
    - services/remotion-studio/src/preview/metadata-panel.test.tsx
tech_stack:
  added: []
  patterns: [transient-chip-pattern, shimmer-skeleton, singleton-style-inject, singleton-abort-controller, state-machine-panel]
key_files:
  created:
    - services/remotion-studio/src/preview/MetadataPanel.tsx
    - services/remotion-studio/src/preview/metadata-panel.test.tsx
  modified:
    - services/remotion-studio/src/preview/PreviewApp.tsx
decisions:
  - "lastRenderJobId persists across reset — panel stays populated when user clicks Renderizar de nuevo, avoiding accidental loss of generated metadata"
  - "tone/platform change does NOT auto-regenerate (META-04): avoids surprise cloud calls, explicit user intent required"
  - "GET /api/metadata/:jobId on mount/jobId-change silently falls back to 'ready' on 404/error — non-blocking restore (D-05)"
  - "Keyframes injected via singleton <style> element at module load — no external CSS file dependency, compatible with Vite bundler"
  - "Hashtags stored as space-joined text string in state; parsed back to chips for display — simpler than array-of-objects and round-trips cleanly through the copy button"
metrics:
  duration: "~7 minutes"
  completed: "2026-06-04T22:20:00Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 25 Plan 03: Studio col3 Live AI Metadata Panel Summary

Live MetadataPanel component replacing the Phase 22 "Próximamente" placeholder in col3: platform+tone selectors, Generar/Regenerar against POST /api/metadata, three inline-editable + per-field copyable fields, five designed states, green discipline enforced, gated on a completed render jobId.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | MetadataPanel component + 24 tests | 9845ab3 | MetadataPanel.tsx, metadata-panel.test.tsx |
| 2 | Mount MetadataPanel in PreviewApp col3 + thread jobId | d5e8397 | PreviewApp.tsx |

## What Was Built

### MetadataPanel.tsx (371 lines)

**Props:** `{ jobId: string | null }`

**State machine (5 states):**
- `empty` — jobId is null; Generar disabled with muted italic hint "Generá un render para crear la metadata."
- `ready` — jobId set; Generar enabled; fields not shown yet
- `generating` — POST in flight; Generar → Spinner + "Generando…"; shimmer skeletons for title/desc/hashtags; controls disabled
- `generated` — fields populated, editable, copyable; button becomes "↻ Regenerar"
- `error` — inline `--danger` error message + Reintentar button

**Controls row:**
- Plataforma select: tiktok (TikTok) / instagram (Instagram Reels) / youtube_shorts (YouTube Shorts)
- Tono select: cercano (Cercano) / profesional (Profesional) / llamativo (Llamativo)
- Both selectors driven by `PLATFORMS`/`TONES` from metadata.ts (single source of truth)

**Primary action (green discipline enforced):**
- Uses `--accent` (blue) + `--accent-strong` border — NEVER `--action` (green)
- `--action` is reserved for the header Render / Guardar config buttons

**On mount / jobId change:**
- GET `/api/metadata/:jobId` to restore persisted result (D-05); 404 → stay ready; network error → stay ready (non-blocking)
- AbortController cleans up on jobId change / unmount

**Fields (META-02, META-03):**
- **Título** — `<input type="text">`, aria-label, inline edit
- **Descripción** — `<textarea rows=4>`, resizable vertically, inline edit
- **Hashtags** — chips display (rendered from text) + editable `<textarea>` in monospace

**Per-field copy (META-03):**
- 📋 button per field; aria-label="Copiar {Título|Descripción|Hashtags}"
- `navigator.clipboard.writeText(text)`
- Transient "✓ Copiado" chip for 2s (mirrors existing "✓ Guardado recién" pattern in PreviewApp)

**Backend chip:**
- Shows `result._meta.model` in `--accent` when generated

**Visual quality (sketch-findings-reel-factory, 026-C grammar):**
- `--accent-tint` background on Generar button
- `--accent` hashtag chips
- Shimmer skeleton uses CSS gradient animation (`mp-shimmer` keyframe)
- Spinner uses `mp-spin` keyframe
- Keyframes injected via singleton `<style id="mp-panel-keyframes">` at module load
- `@media (prefers-reduced-motion: reduce)` disables animations

### metadata-panel.test.tsx (24 tests)

Covers all behaviors using vitest + @testing-library/react + mocked fetch (zero real network):

| Group | Tests |
|-------|-------|
| jobId null | renders header, Generar disabled, shows hint, fetch not called |
| generate flow (META-01/02) | GET on mount, Generar enabled with jobId, POSTs {jobId,platform,tone}, populates fields, shows Regenerar, restores from GET (D-05) |
| platform/tone change (META-04) | no auto-regenerate on platform change, no auto-regenerate on tone change, Regenerar re-POSTs with new platform |
| field editing + copy (META-03) | title edit, description edit, copy title, copy description, copy hashtags, shows ✓ Copiado chip |
| error state | shows inline error message, shows Reintentar, clicking Reintentar → ready state |
| green discipline (D-10) | no --action token in rendered styles |

### PreviewApp.tsx changes

- Import `MetadataPanel` from `./MetadataPanel.js`
- New state: `const [lastRenderJobId, setLastRenderJobId] = useState<string | null>(null)`
- Poll loop success path: added `setLastRenderJobId(newJobId)` before `setRenderState("success")`
- col3: replaced 30-line static placeholder card with `<MetadataPanel jobId={lastRenderJobId} />`
- Same 320px `col3-metadata` container, same width/visibility behavior

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All fields are live and wired to the API.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: clipboard-access | MetadataPanel.tsx | navigator.clipboard.writeText — browser permission required; gracefully handles failure (silently no-ops if clipboard unavailable) |

The clipboard access is intentional (META-03 copy feature). Failure is silently swallowed — no data leaves the browser.

## Self-Check: PASSED

- [x] `services/remotion-studio/src/preview/MetadataPanel.tsx` exists (371 lines)
- [x] `services/remotion-studio/src/preview/metadata-panel.test.tsx` exists (24 tests)
- [x] `services/remotion-studio/src/preview/PreviewApp.tsx` imports MetadataPanel and renders it in col3
- [x] Commit 9845ab3 exists: feat(25-03) MetadataPanel component + 24 tests
- [x] Commit d5e8397 exists: feat(25-03) mount MetadataPanel in PreviewApp col3 + thread jobId
- [x] 373/373 studio tests pass (17 test files, 0 failures)
- [x] `npm run build:editor` succeeds (189 modules, ✓ built in 1.84s)
- [x] No --action token in MetadataPanel.tsx (green discipline)
- [x] lastRenderJobId set on render success, not cleared on reset
