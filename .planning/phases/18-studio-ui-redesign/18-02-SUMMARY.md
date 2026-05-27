---
phase: 18-studio-ui-redesign
plan: "02"
subsystem: ui
tags: [react, typescript, remotion-studio, tab-bar, font-grid, refactor, studio-consolidation]

# Dependency graph
requires:
  - 18-01
provides:
  - "Unified StudioApp in PreviewApp.tsx — two-column layout with TabBar (Titles/Subtitles/Text), FontGrid inline in Subtitles tab"
  - "ConfigPreview.tsx deleted — raw-JSON panel gone"
  - "FontGridPage.tsx deleted — standalone route absorbed"
affects:
  - 18-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TABS array-driven TabBar — add a tab in Phase 21 with one config entry, no JSX surgery"
    - "display:block/none tab panel visibility — all panels mounted, state preserved on tab switch"
    - "FontCard with useState(hovered) + useState(loaded) — avoids inline onMouseEnter style mutation"
    - "Module-level helper components (TabBar, TabButton, FontCard, FontGrid) — stable references, no re-creation per render"

key-files:
  created: []
  modified:
    - services/remotion-studio/src/preview/PreviewApp.tsx
  deleted:
    - services/remotion-studio/src/editor/components/ConfigPreview.tsx
    - services/remotion-studio/src/preview/FontGridPage.tsx

key-decisions:
  - "TabButton extracted as separate component to hold hovered state (useState) without recreating on every PreviewApp render — avoids inline onMouseEnter/onMouseLeave style mutation"
  - "FontCard uses useState(hovered) for hover styles to match the isSelected border logic cleanly — same pattern as TabButton"
  - "Sample text in FontCard is 'Hola mundo' (matches UI-SPEC exactly) not the longer FontGridPage sample — keeps cards compact in the narrower inline grid"
  - "AVAILABLE_FONTS cast as readonly string[] to satisfy TypeScript when filtering — avoids type error on .filter()"

patterns-established:
  - "Unified title state: single titles state, TitleEditor onChange={setTitles}, PreviewPlayer titles={titles} — no previewTitles, no special-case wiring"
  - "Tab panel pattern: three sibling divs, display:block/none toggled — preserves TitleEditor draft state during tab switches (RESEARCH Pitfall 5)"

requirements-completed:
  - STUDIO-01
  - STUDIO-02
  - STUDIO-03

# Metrics
duration: 18min
completed: 2026-05-27
---

# Phase 18 Plan 02: StudioApp Unification — TabBar + FontGrid + Cleanup Summary

**PreviewApp.tsx rewritten as unified two-column StudioApp with array-driven TabBar (Titles/Subtitles/Text), FontGrid inline in Subtitles tab, unified title state, and deletion of ConfigPreview.tsx and FontGridPage.tsx — build green**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-27T21:00:00Z
- **Completed:** 2026-05-27T21:18:00Z
- **Tasks:** 2
- **Files modified:** 1
- **Files deleted:** 2

## Accomplishments

- PreviewApp.tsx fully rewritten as StudioApp: 127 deletions, 234 insertions
- CollapsibleSection component gone — replaced by TABS array + TabBar + three display:block/none panels
- previewTitles / setPreviewTitles removed — titles state is the single source of truth (D-10)
- handleSave simplified to zero-parameter signature — always uses titles + subtitleConfig from state
- useSearchParams and fontFromUrl removed — no URL-param handoff needed
- Link/← Editor and Font Grid header links removed (D-01, D-02)
- Header updated: "Reel Factory Studio", disabled Render Video placeholder (D-05), Save Config
- FontCard + FontGrid inline in Subtitles tab — AVAILABLE_FONTS browsed without leaving the studio
- ConfigPreview.tsx deleted — raw-JSON panel dropped per D-06
- FontGridPage.tsx deleted — standalone /preview/fonts route absorbed per D-06
- build:editor exits 0 after both tasks (no dangling imports)

## Task Commits

1. **Task 1: Rewrite PreviewApp.tsx as unified StudioApp with tabs and inline FontGrid** — `74d1c45` (feat)
2. **Task 2: Delete ConfigPreview.tsx and FontGridPage.tsx** — `fa8788c` (feat)

## Files Created/Modified

- `services/remotion-studio/src/preview/PreviewApp.tsx` — Full rewrite: TABS constant, TabBar, TabButton, FontCard, FontGrid, PreviewApp function with unified title state and tab-driven right panel
- `services/remotion-studio/src/editor/components/ConfigPreview.tsx` — Deleted
- `services/remotion-studio/src/preview/FontGridPage.tsx` — Deleted

## Decisions Made

- **TabButton extracted as separate component:** The plan specified hover state via onMouseEnter/onMouseLeave inline style mutation (as in the original FontCard pattern). However, TabButton also needed isSelected border logic and clean inactive-state restoration. Extracting to a component with `useState(hovered)` produces cleaner style logic with no mutation and avoids re-creating event handlers on every PreviewApp render.

- **FontCard uses useState(hovered):** Same rationale as TabButton — the selected-border logic interacts with hover color in a way that is cleaner with controlled state than with direct DOM mutation.

- **AVAILABLE_FONTS cast:** TypeScript infers `AVAILABLE_FONTS` as `readonly ["Inter", "Roboto", ...]` (a const tuple). Calling `.filter()` on it requires casting to `readonly string[]` — added inline to avoid changing fonts.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TabButton extracted from inline button render in TabBar**
- **Found during:** Task 1 (writing TabBar with hover state)
- **Issue:** The plan's TabBar spec uses onMouseEnter to set `color` and `background` via inline style mutation. But this conflicts with the selected border logic (`isSelected ? "2px solid #90caf9" : "2px solid transparent"`) — a simple mutation would overwrite the border incorrectly on mouse leave. The cleanest fix is a stateful TabButton subcomponent.
- **Fix:** Extracted `TabButton` function with `useState(hovered)` — style object is derived from `isActive` and `hovered` together.
- **Files modified:** services/remotion-studio/src/preview/PreviewApp.tsx
- **Committed in:** 74d1c45

---

**Total deviations:** 1 auto-fixed (component extraction for correctness)
**Impact on plan:** Minimal — same visual contract, cleaner implementation. No extra state, no scope creep.

## Context from Parallel Plan (18-03)

Plan 18-03 ran in parallel (Wave 2) and had already modified App.tsx and deleted EditorApp.tsx before Task 2 committed. This confirmed:
- ConfigPreview had no remaining consumers in the build (App.tsx no longer imports it)
- FontGridPage had no remaining consumers in the build (App.tsx routes collapsed to PreviewApp only)
- build:editor exits 0 after Task 2 — no dangling import errors

## Issues Encountered

None — both tasks executed cleanly with one minor extraction deviation.

## Stub Scan

No stubs found. FontGrid renders live font cards from AVAILABLE_FONTS. PreviewPlayer receives live titles state. No placeholder data flowing to UI rendering.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. PUT /api/config and GET /api/config remain the only trust boundaries — unchanged. No threat flags.

## User Setup Required

None — pure frontend refactor, no external services or environment variables required.

## Next Phase Readiness

- STUDIO-01, STUDIO-02, STUDIO-03 requirements satisfied by Plans 18-01 + 18-02 + 18-03 combined
- Phase 19 (Typography & text effects): Subtitles tab has space below StyleControls for new font-effects controls — no restructuring needed
- Phase 20 (Title block precision): Titles tab has space for pixel-positioning controls under TitleEditor
- Phase 21 (PNG overlays): TABS array accepts a fourth `{ id: "overlays", label: "Overlays" }` entry — one-line config change

---
*Phase: 18-studio-ui-redesign*
*Completed: 2026-05-27*
