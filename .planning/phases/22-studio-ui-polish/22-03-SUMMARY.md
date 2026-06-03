---
phase: 22-studio-ui-polish
plan: "03"
subsystem: remotion-studio/preview-shell
tags: [ui, layout, 3-column, tokens, tabs, spanish]
dependency_graph:
  requires: []
  provides: [22-03-shell, 22-03-tokens, 22-03-tabs]
  affects: [22-04, 22-05, 22-06]
tech_stack:
  added: []
  patterns:
    - OKLCH CSS custom property token set inlined in index.html :root block
    - 3-column flex shell (col1 flex:0 1 470px, col2 flex:1, col3 width:320px flex:none)
    - Outline-only Guardar button (color law: single green CTA = Render Video)
    - prefers-reduced-motion collapse rule
key_files:
  created: []
  modified:
    - services/remotion-studio/src/preview/PreviewApp.tsx
    - services/remotion-studio/src/editor/index.html
    - services/remotion-studio/src/preview/TextareaInput.tsx
decisions:
  - "Col3 is a static 'Próximamente' placeholder — no state/fetch/controls (D-02)"
  - "Guardar config is transparent/outline, Render Video is the sole green CTA (color law)"
  - "Text tab removed; TextareaInput relocated to top of Subtítulos tab (D-10)"
  - "OKLCH tokens inlined in index.html :root, not a CSS file import, to avoid build complexity"
  - "placeholder prop added to TextareaInput interface to support UI-SPEC placeholder copy"
metrics:
  duration: "~20 min"
  completed: "2026-06-03"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 22 Plan 03: 3-Column Shell + Token System + Tab Restructure Summary

3-column Studio shell with OKLCH tokens, static metadata placeholder, Spanish tabs (Títulos | Overlays | Subtítulos), TextareaInput relocated to Subtítulos, and single-green-CTA header contract.

## Tasks Completed

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: 3-column shell + tokens + header | b2ecab3 | index.html tokens, 3-col flex, col3 placeholder, Guardar outline, Render green |
| Task 2: Tab restructure + textarea relocation | d8864f4 | Text tab removed, Spanish labels, TextareaInput atop Subtítulos with role-cue |

## What Was Built

### Task 1: Token system + 3-column shell + header contract

**index.html (`services/remotion-studio/src/editor/index.html`):**
- Inlined the complete default.css OKLCH `:root { … }` token block (verbatim from `.claude/skills/sketch-findings-reel-factory/sources/themes/default.css`)
- All tokens now available app-wide: `--canvas`, `--chrome`, `--surface`, `--surface-2`, `--surface-hover`, `--stage`, `--border`, `--border-strong`, `--border-faint`, `--text`, `--text-2`, `--text-muted`, `--text-faint`, `--accent`, `--accent-strong`, `--accent-tint`, `--accent-tint-2`, `--action`, `--action-hover`, `--danger`, `--warning`, `--success`, `--font`, `--mono`, `--t-*` scale, `--s-*` scale, `--r-*` scale, shadow tokens, `--ease`, `--dur`, `--dur2`
- Added `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` per UI-SPEC Motion contract
- Added `.col3-metadata { display: none !important; }` at `@media (max-width: 1023px)` for the col3 hide rule

**PreviewApp.tsx (`services/remotion-studio/src/preview/PreviewApp.tsx`):**
- Converted 2-column `width: "40%"` shell to 3-column flex layout:
  - Col 1: `flex: "0 1 470px"`, `minWidth: 280`, `background: "var(--stage)"` — content-sized 9:16 preview
  - Col 2: `flex: 1`, `background: "var(--surface)"` — controls + TabBar (existing contents unchanged)
  - Col 3: `width: 320`, `flexShrink: 0`, `flexGrow: 0`, `className: "col3-metadata"` — static metadata placeholder
- Col 3 contains a surface-2 card: heading "Metadata de redes" + muted italic "Próximamente — descripción, hashtags y más generados a partir de tus subtítulos." — NO state, NO fetch, NO controls (D-02)
- Header contract applied:
  - `Guardar config` = transparent/outline button, `border: "1px solid var(--border-strong)"`, never green, Spanish label
  - `▶ Render Video` = `background: "var(--action, #4CAF50)"`, fontWeight 600, THE single green CTA (color law)
  - Save success/error status chips use token colors (`var(--success)`, `var(--danger)`) with pill shape
  - Brand h1 uses `var(--t-base, 14px)` + `var(--text)` — token-driven
- TABS array and panel contents left untouched (per plan: Task 2 scope)

### Task 2: Tab restructure + TextareaInput relocation

**PreviewApp.tsx:**
- Removed `{ id: "text", label: "Text" }` from TABS array
- Relabeled remaining 3 tabs to Spanish: `"Títulos"`, `"Overlays"`, `"Subtítulos"`
- Deleted the Text panel (`activeTab === "text"` branch — entire div removed)
- Added `<TextareaInput value={sampleText} onChange={setSampleText} placeholder="Cómo edité este reel en 30 segundos…" />` at the TOP of the Subtítulos panel (above LayoutSelector)
- Added role-cue below textarea: `● Alimenta los subtítulos · no se exporta` in `var(--accent)` blue (UI-SPEC Copywriting Contract)
- sampleText → `useMemo(() => textToCaptionPages(sampleText), [sampleText])` → `captionPages` → PreviewPlayer props UNCHANGED — preview chain preserved

**TextareaInput.tsx (`services/remotion-studio/src/preview/TextareaInput.tsx`):**
- Added optional `placeholder?: string` prop to interface
- Changed hardcoded `placeholder="Type your subtitle text here..."` to `placeholder={placeholder ?? "Type your subtitle text here..."}` (backward-compatible fallback)

## Verification

All acceptance criteria passed:
- `npm run build:editor` exits 0 (both after Task 1 and Task 2)
- `Metadata de redes` present in PreviewApp.tsx
- `Próximamente — descripción, hashtags` present
- `width: 320` (col3 fixed width) present (3 occurrences)
- `470` preview column marker present
- `--accent` and `--surface` in index.html `<style>` (4 and 3 occurrences respectively)
- `prefers-reduced-motion` rule in index.html
- Guardar button uses `background: "transparent"` + `border: "1px solid var(--border-strong)"` — no `#4CAF50`
- Zero `accordion` matches in new shell chrome
- `{ id: "text"` gone from TABS
- `activeTab === "text"` gone (Text panel removed)
- `Títulos` and `Subtítulos` labels present
- `<TextareaInput` appears exactly once
- `onChange={setSampleText}` wiring preserved
- `textToCaptionPages(sampleText)` useMemo chain intact
- `captionPages={captionPages}` passed to PreviewPlayer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing prop] Added placeholder prop to TextareaInput**
- **Found during:** Task 2 implementation
- **Issue:** Plan requires setting `placeholder="Cómo edité este reel en 30 segundos…"` per UI-SPEC, but TextareaInput interface only accepted `{ value, onChange }` — no `placeholder` prop.
- **Fix:** Added `placeholder?: string` to `TextareaInputProps`; changed hardcoded textarea placeholder to `placeholder={placeholder ?? "Type your subtitle text here..."}` (backward-compatible)
- **Files modified:** `services/remotion-studio/src/preview/TextareaInput.tsx`
- **Commit:** d8864f4 (bundled with Task 2)

**2. [Infrastructure] Symlinked node_modules for worktree build**
- **Found during:** Task 1 build verification
- **Issue:** git worktree does not copy `node_modules`. `npm run build:editor` fails with `vite: not found`.
- **Fix:** Created symlink `services/remotion-studio/node_modules` → main repo's `services/remotion-studio/node_modules`
- **Impact:** Build-time only; no source code change; symlink untracked (not committed)

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `Próximamente — descripción, hashtags...` (col-3 body) | PreviewApp.tsx:558 | Intentional per D-02: AI metadata generation is a future phase. Col-3 is a structural placeholder only in Phase 22. |
| `▶ Render Video` disabled (title="Próximamente…") | PreviewApp.tsx:406 | Pre-existing — rendering via pipeline API is out of scope for Studio UI polish. |

These stubs are correct per plan design decisions — not blocking the plan's goal (3-column shell restructure is fully achieved).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. Col-3 placeholder is entirely static HTML — no data source, no fetch, no user input flows (D-02 compliance). `TextareaInput.placeholder` prop is a purely presentational addition.

## Self-Check: PASSED

- FOUND: services/remotion-studio/src/preview/PreviewApp.tsx
- FOUND: services/remotion-studio/src/editor/index.html
- FOUND: services/remotion-studio/src/preview/TextareaInput.tsx
- FOUND: b2ecab3 (Task 1 commit)
- FOUND: d8864f4 (Task 2 commit)
- Build: `npm run build:editor` exits 0
