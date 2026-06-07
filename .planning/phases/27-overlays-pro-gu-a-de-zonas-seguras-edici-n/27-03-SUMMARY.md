---
phase: 27-overlays-pro-gu-a-de-zonas-seguras-edici-n
plan: 03
subsystem: remotion-studio (editor + preview)
tags: [overlays, safe-zone-guide, overlay-naming, studio-ui, frontend]
requires:
  - "27-01: PngOverlayConfig.name/isGuide + partitionGuideOverlays helper (data model)"
  - "27-02: render-path guide exclusion (guarantees guides never leave the preview)"
provides:
  - "OVERLAY-01: a loaded guide PNG paints in the Studio 9:16 preview"
  - "OVERLAY-03: guide is a fixed top preview layer, marked with a chip, excluded from back/front reordering"
  - "OVERLAY-04: editable, persisted overlay name"
  - "OVERLAY-05: overlay name shown as the edit-form title"
affects:
  - "services/remotion-studio/src/SubtitledVideo.tsx (studio preview composition)"
  - "services/remotion-studio/src/editor/components/OverlayEditor.tsx (overlay editor UI)"
tech-stack:
  added: []
  patterns:
    - "partitionGuideOverlays(overlays) → {guides, renderable}: guides painted as a fixed topmost preview layer, renderable banded back/front"
    - "Guide vs normal as a segmented Tipo toggle; Capa control conditionally hidden for guides"
    - "Calm GuideChip (neutral tokens) marks non-rendered guides — never green, never danger"
key-files:
  created:
    - services/remotion-studio/src/editor/components/overlay-editor.test.tsx
    - services/remotion-studio/src/preview/overlay-persistence.test.tsx
  modified:
    - services/remotion-studio/src/SubtitledVideo.tsx
    - services/remotion-studio/src/editor/components/OverlayEditor.tsx
decisions:
  - "PreviewApp needed NO code change: the overlay validator filter returns the whole object (name/isGuide ride along), and getCurrentConfig/handleSave already emit overlays: liveOverlays unchanged — round-trip works as-is. Locked it with a dedicated test instead of touching the wiring."
  - "Guide round-trip verified at the PreviewApp level (real OverlayEditor, heavy deps mocked) rather than asserting the inline predicate, so the test guards the actual hydration → preview path."
metrics:
  duration: ~25m
  completed: 2026-06-07
  tasks: 3
  files: 4
  commits: 3
---

# Phase 27 Plan 03: Studio Safe-Zone Guides + Overlay Naming Summary

Studio-facing half of safe-zone guides + overlay naming: a guide PNG now paints as a fixed topmost layer in the Studio 9:16 preview (never banded, never dimmed), the Overlays tab gains an editable name, a Tipo (normal/guide) toggle, a calm "guía · no se renderiza" chip, name-as-edit-title, and anchored guide cards with no back/front control. The whole thing persists through the existing config save path unchanged.

## What was built

### Task 1 — SubtitledVideo guide layer (OVERLAY-01/03) · commit `12b22d9`
- Imported `partitionGuideOverlays`; split `{guides, renderable}` BEFORE banding.
- back/front bands now computed from `renderable` (guide-free) → guides cannot be reordered by the Capa control.
- Guides painted LAST (topmost), with no preview legibility dim so a guide reads clearly.
- Studio-only file (per AGENTS.md): the renderer's `SubtitledVideo` in `Root.tsx` is separate and excludes guides per Plan 02.

### Task 2 — OverlayEditor name + guide controls (OVERLAY-03/04/05) · commit `ebde5d7`
- `DEFAULT_OVERLAY` extended with `name: ""` + `isGuide: false`; `handleStartEdit` copies both into the draft.
- "Nombre" text input (accent on focus, neutral surface, never green); fires `onPreviewChange` live.
- "Tipo" segmented toggle (Overlay normal | Guía de zonas) writes `isGuide`.
- Capa (Detrás/Delante) control hidden for guides, replaced by a muted note ("Las guías no se renderizan y quedan fijas…").
- Edit heading shows `Editar: «{name}»` when set, else the generic "Editar overlay".
- List card label = `ov.name?.trim() || `Overlay ${i+1}``.
- New `GuideChip` ("guía · no se renderiza", calm neutral tokens, LayerBadge weight) replaces the LayerBadge on guide cards.

### Task 3 — Persistence round-trip + gates (OVERLAY-01/04) · commit `a8e93cf`
- Confirmed PreviewApp requires no change: `applyConfigToState`'s overlay `.filter` is a type guard that returns the whole object, so `name`/`isGuide` survive hydration; `getCurrentConfig` + `handleSave` emit `overlays: liveOverlays` (full objects); PreviewPlayer gets `overlays={liveOverlays}` so guides ride into the preview.
- Added `overlay-persistence.test.tsx`: hydrates a named guide overlay from `/api/config` via the real OverlayEditor and asserts the name label + guide chip surface (proves the fields survived hydration and reach the preview/persist path).

## Tests
- `overlay-editor.test.tsx` — 12 tests: name-as-title (OVERLAY-05), name input wiring + handleStartEdit preservation (OVERLAY-04), guide toggle / Capa-hidden / chip / non-guide LayerBadge (OVERLAY-01/03), card label, and a green-discipline guard (no action-green in the editor).
- `overlay-persistence.test.tsx` — 1 test: name + isGuide round-trip through `applyConfigToState`.

## Verification
- Studio vitest full suite: **PASS** — 24 files / 477 tests (baseline was 22 / 464; +2 files, +13 tests).
- `npm run build:editor` (`vite build src/editor`): **PASS** — 190 modules transformed, built in ~1.8s. Pre-existing warnings only (outDir notice, react-router/@remotion/player "use client" directives, chunk-size).
- `tsc --noEmit` on the worktree shows 8 errors — all pre-existing (Root.tsx, fonts.ts, index.ts, PreviewPlayer.tsx, server.ts); count is identical before/after my change and none reference SubtitledVideo/guides. The project's real gates are vite build + vitest (both green).
- Acceptance greps: `partitionGuideOverlays|guides` present in SubtitledVideo.tsx; `isGuide` present in OverlayEditor.tsx.

## Renderer sync
**None required.** Modified files: `SubtitledVideo.tsx` (studio-only — AGENTS.md explicitly says do NOT sync `SubtitledVideo`), `OverlayEditor.tsx` (editor-only, under `src/editor/`, no renderer twin), and two test files. No `compositions/*` or shared `src/*` modules (`pipeline-config.ts`/`fonts.ts`/`captions.ts`/`zoom-detection.ts`) were touched.

## UI tooling mandate
`impeccable` skill + `frontend-design` plugin both loaded at the start (both present under `~/.claude/skills/`). This is a product-register task inside a LOCKED design system (sketch-findings-reel-factory): reused the existing token grammar (`--accent`, `--surface-2`, `--border`, `--r-*`, `--s-*`, `--t-*`, `--dur`, `--ease`), honored green-discipline (Render green only; all overlay controls accent/neutral), used the 039-B/019-C list-card idiom, and added no ad-hoc colors or side-stripe borders.

## Deviations from Plan
None — plan executed as written. The only plan-anticipated finding: PreviewApp needed no code edit (the plan's Task 3 said "no change expected; confirm and note"), confirmed and locked with a test.

## Known Stubs
None.

## Threat Flags
None — no new network endpoints, auth paths, or trust-boundary surface. Overlay name is rendered as React text content (auto-escaped); guide exclusion from render is enforced by Plan 02 + the validator from Plan 01.

## Human UAT follow-up (NOT an executor task)
`docker compose build/up remotion-studio` on port 3123 to visually confirm: the guide paints in the 9:16 preview, the chip reads "guía · no se renderiza", the name shows as the edit title, and a guide card has no back/front control.

## Self-Check: PASSED
- Files: all 4 FOUND.
- Commits: 12b22d9, ebde5d7, a8e93cf all FOUND.
