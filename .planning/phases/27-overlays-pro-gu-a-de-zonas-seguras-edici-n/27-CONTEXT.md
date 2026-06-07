# Phase 27: Overlays pro — guía de zonas seguras + edición - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — autonomous overnight run, user asleep)

<domain>
## Phase Boundary

Users can load a safe-zone guide overlay that helps them frame titles/subtitles/eyeline for phones — it shows only in the Studio preview, is excluded from the final render, stays anchored as a fixed guide, and overlays can be named with that name shown while editing.

Requirements: OVERLAY-01 (load guide, shows in preview), OVERLAY-02 (excluded from render), OVERLAY-03 (visually distinguished + anchored, not in back/front reordering), OVERLAY-04 (edit overlay name, persists), OVERLAY-05 (name shown as title while editing).
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion (discuss skipped for autonomous run). Use the ROADMAP goal, success criteria, and codebase conventions. The following are strong steers from prior codebase exploration — follow unless a better path emerges during planning:

- **Data model:** overlays are `PngOverlayConfig` objects (in `services/remotion-studio/src/pipeline-config.ts`, mirrored in `services/remotion-renderer/src/pipeline-config.ts`) with an existing `layer` field (back/front) added in Phase 22. Add a guide marker (e.g. `isGuide: true` and/or a `name` field) rather than a whole new type, so the existing overlays array + validator + UI mostly reuse. Update `validatePipelineConfig` in BOTH services.
- **Render exclusion (OVERLAY-02):** the guide must be filtered OUT in the render path. The studio preview (PreviewApp/LayoutDispatcher) renders guides; the renderer (`remotion-renderer` Root.tsx / SubtitledVideo / overlay paint) must skip any overlay with `isGuide`. This is the critical renderer-sync point — verify with the renderer vitest and ideally a real render.
- **Anchoring (OVERLAY-03):** guide overlays must not participate in back/front layer reordering and should be painted as a fixed top guide layer in the preview only. Mark them visually in the Overlays tab (checkerboard/idiom per sketch-findings 039-B; a "guía · no se renderiza" chip).
- **Naming (OVERLAY-04/05):** add an editable `name` to overlays; the Overlays editor (`services/remotion-studio/src/editor/components/` overlay editor) must allow editing the name and show it as the title of the edit form (today the edit form is anonymous). Persist via the existing config save path (live/committed state pattern — see PreviewApp liveOverlays/overlays).

### Constraints (LOCKED)
- UI tooling non-negotiable: invoke `impeccable` + `frontend-design` at execute start; honor `sketch-findings-reel-factory` (overlay-acquisition idiom 039-B, checkerboard transparency) and green-discipline (--action green = Render CTA only; overlay actions use --accent).
- Renderer sync mandatory: after editing studio `compositions/*` or shared `src/*`, mirror to remotion-renderer per AGENTS.md and RE-RUN renderer vitest (clobber hazard).
- Do not break existing overlays (PNG back/front layering, resize, position presets) — additive change.
</decisions>

<code_context>
## Existing Code Insights

- Overlay config + validator: `services/remotion-studio/src/pipeline-config.ts` (+ renderer mirror). `PngOverlayConfig` has imageData, x, y, displayWidth, layer.
- Overlay editor UI: `services/remotion-studio/src/editor/components/` (overlay editor) + `OverlaysTab`/`PreviewApp` wiring; live/committed overlay state in `PreviewApp.tsx` (`overlays`/`liveOverlays`).
- Preview paint: `LayoutDispatcher` / composition overlay rendering (studio). Renderer paint: `remotion-renderer/src/` Root.tsx + compositions.
- Tests: `services/remotion-studio` vitest suite; `services/remotion-renderer` vitest suite. Both must stay green.
</code_context>

<specifics>
## Specific Ideas

The safe-zone guide PNG is provided by the USER (no auto-geometry). The guide marks phone safe areas (right bar, bottom bar, out-of-ideal-view zones) and reference levels for title / subtitle / eye-line. Treat it as an image; the app's job is to show it in preview, keep it anchored, exclude it from render, and let overlays be named.
</specifics>

<deferred>
## Deferred Ideas

- Auto-computed safe-area geometry per platform (Future Requirements).
- Multiple guides / reusable guide library (Future Requirements).
</deferred>
