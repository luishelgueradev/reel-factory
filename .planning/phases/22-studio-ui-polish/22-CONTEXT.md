# Phase 22: Studio UI polish - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the Remotion Studio right-panel control surface so it reads as a compact,
prioritized, deliberate control panel (full `impeccable` pass — not a single
component), define overlay layering relative to titles/subtitles, and add
auto-position presets to title/overlay X/Y controls.

The four locked ROADMAP success criteria stand:
1. Denser, reordered control panel (grouped, rarely-used disclosed) preserving the
   dark-theme design system — whole right panel, not one component.
2. Sample-text input moved into the Subtitles tab; the standalone "Text" tab is
   removed; final tabs are Titles | Overlays | Subtitles; sample text still drives
   the live preview.
3. Overlay layering defined & implemented; overlays default BELOW titles/subtitles;
   applied consistently in `SubtitledVideo` (studio) and renderer `Root.tsx`.
4. Titles & overlays get auto-position preset buttons mirroring subtitle presets,
   ideally via a shared component.

**Layout-scope extension (decided this discussion):** Phase 22 additionally adopts a
**3-column shell** (preview | controls | metadata) — see D-01. This is a deliberate
extension of the layout dimension beyond the literal ROADMAP text; the *AI metadata
generation* itself is explicitly OUT of scope (deferred — see Deferred Ideas).

**Out of scope:** Any AI/model logic for social-media metadata generation (the column-3
content). Phase 22 only builds the structural placeholder.
</domain>

<decisions>
## Implementation Decisions

### Layout shell (3-column)
- **D-01:** Adopt a **3-column layout** in this phase: column 1 = live 9:16 preview
  Player, column 2 = controls (titled sections / tabs), column 3 = **social-media
  metadata summary panel**. Column 3 is built NOW as a structured **placeholder**
  ("Metadata de redes — próximamente") with its visual scaffolding only. Rationale:
  lock the final layout so the redensification + sketch are not done against a
  2-column assumption that would later need full rework. The 3-column shell must be
  reflected in the sketch (see D-05) and the eventual UI redesign.
- **D-02:** The metadata panel's AI population (title, description, hashtags derived
  from the subtitle transcription + chosen titles, etc.) is a **future phase**. Phase
  22 wires no model, no data source, no generation — placeholder structure only.

### Overlay layering model
- **D-03:** Default render order: overlays sit **BELOW** titles/subtitles (decorators
  behind text). Add a **per-overlay back/front toggle** so an individual overlay CAN
  be promoted above text. Implies a new per-overlay `layer` field (e.g. `"back"` |
  `"front"`, default `"back"`) in the overlay config schema.
- **D-04:** Among multiple overlays, **array order = paint order** (later array entry
  paints on top, within its layer band). No explicit numeric z-index field. Reordering
  = moving items in the list. Must be applied identically in `SubtitledVideo.tsx`
  (studio) and the inline `SubtitledVideo` in renderer `Root.tsx` (keep in sync —
  renderer-sync clobber hazard applies).

### Process & density
- **D-05:** Run a **sketch pass first** (`/gsd-sketch`) producing a throwaway HTML
  mockup of the **new 3-column panel** before planning/executing — this is a redesign,
  not a tweak. React to the sketch, then plan.
- **D-06:** The specific **disclosure mechanism** (collapsible sections vs multi-column
  vs accordions) is **left to the `impeccable`/design pass per tab** — not locked now.
  Constraint: preserve the established dark-theme design system; elevate hierarchy,
  alignment, density.

### Auto-position presets
- **D-07:** Preset button set = **9-point grid** (4 corners + 4 edge-centers + center).
  Chosen over the literal 6-button list because overlays (logos/watermarks) commonly
  target corners.
- **D-08:** Extract a **shared `PositionPresets` component** consumed by titles and
  overlays; **also migrate the existing subtitle presets** onto it (DRY, one
  affordance). Subtitle presets today live in
  `services/remotion-studio/src/editor/components/StyleControls.tsx` (~line 192,
  bottom-center / top-center / center). Migration must not regress the working subtitle
  path — re-verify after.
- **D-09:** Centering math must be **size-aware**: overlay anchor is the **top-left** of
  the image at its `displayWidth`, so center/right/bottom presets must subtract image
  width/height. Titles likewise account for their rendered size. Compute X/Y against the
  **1080×1920** frame, push via the existing `handleDraftChange` so live preview updates.

### Tabs & control ordering
- **D-10:** Remove the `{ id: "text", label: "Text" }` tab from `TABS` in
  `PreviewApp.tsx`. Move `<TextareaInput>` (sample text) to the **top of the Subtitles
  tab/section**, above LayoutSelector/StyleControls/FontGrid. Final tab order:
  Titles | Overlays | Subtitles. Verify sample text still drives caption pages / preview.
- **D-11:** Within each tab, order controls **Position → Style → Advanced** (advanced/
  rarely-used collapsed), consistently across Titles / Overlays / Subtitles.

### Claude's Discretion
- D-06: disclosure mechanism per tab (impeccable/design pass decides).
- Exact spacing rhythm, token values, and section grouping within the dark theme —
  bounded by the sketch (D-05) and impeccable pass.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope / source intent
- `.planning/ROADMAP.md` § "Phase 22: Studio UI polish" — goal + 4 locked success criteria.
- `.planning/todos/pending/2026-05-30-full-studio-ui-polish-with-impeccable-skill.md` — full-panel polish intent.
- `.planning/todos/pending/2026-05-30-move-sample-text-input-into-subtitles-tab.md` — tab restructure (D-10).
- `.planning/todos/pending/2026-05-30-define-overlay-layering-z-order-model.md` — layering model (D-03/D-04).
- `.planning/todos/pending/2026-05-30-add-auto-position-buttons-to-x-y-controls.md` — presets (D-07/D-08/D-09).

### UI tooling (NON-NEGOTIABLE per AGENTS.md)
- `AGENTS.md` § "UI/frontend work — REQUIRED tooling" — every frontend task MUST invoke
  the `impeccable` skill + `frontend-design` plugin at start of plan/execute.
- `AGENTS.md` § "Renderer sync pattern" — studio→renderer copy rules; re-run renderer
  vitest after any sync (clobber hazard).

### Key source files
- `services/remotion-studio/src/preview/PreviewApp.tsx` — 2→3 column shell, TABS array, tab panels.
- `services/remotion-studio/src/preview/TextareaInput.tsx` — sample-text input (moves into Subtitles).
- `services/remotion-studio/src/SubtitledVideo.tsx` — render order (overlays currently ABOVE titles, line ~109).
- `services/remotion-renderer/src/Root.tsx` — inline `SubtitledVideo`; must mirror layering (D-04).
- `services/remotion-studio/src/editor/components/{TitleEditor,OverlayEditor,StyleControls}.tsx` — X/Y controls + subtitle presets.
- `services/remotion-studio/src/compositions/PngOverlay.tsx` — overlay rendering / anchor.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Subtitle position presets in `StyleControls.tsx` (~line 192): bottom-center /
  top-center / center — the pattern to generalize into shared `PositionPresets` (D-08).
- `handleDraftChange` (TitleEditor/OverlayEditor): existing draft-update path for live
  preview — presets push X/Y through it (D-09).
- `TextareaInput.tsx`: keep as-is; only its mount location changes (D-10).

### Established Patterns
- Two-column layout today (preview 40% | right panel with TabBar + 3 tab panels) in
  `PreviewApp.tsx` — becomes 3-column (D-01).
- Studio/renderer dual maintenance: composition + shared modules exist in BOTH
  `remotion-studio` and `remotion-renderer`; the renderer defines `SubtitledVideo`
  inline in `Root.tsx`. Layering change (D-03/D-04) must land in both, then re-run
  renderer vitest (renderer-sync clobber hazard).
- Inline-styled dark-theme forms accumulated across phases 12–21 — the density target.

### Integration Points
- Overlay `layer` field (D-03) flows: config schema → pipeline-config types →
  SubtitledVideo (studio) → renderer Root.tsx → OverlayEditor control.
- Column-3 placeholder is purely presentational in this phase; no pipeline/config wiring.
</code_context>

<specifics>
## Specific Ideas

- User's explicit target layout: **col1 preview // col2 controles (secciones tituladas
  o tabs) // col3 resumen metadata redes** — col3 preferred always-visible (not a tab).
- Overlay decorators (logos, watermarks, frames) conceptually belong behind text →
  motivates the below-text default (D-03).
- Sketch and impeccable pass should make the panel read as "a deliberate, professional
  control panel — not stacked forms."
</specifics>

<deferred>
## Deferred Ideas

- **AI social-media metadata generation (own future phase):** A panel/column where an
  AI auto-completes social-media metadata — title, description, hashtags, etc. — derived
  from the subtitle transcription, the chosen titles, and other pipeline context. Phase
  22 builds only the structural placeholder column (D-01/D-02); the model call, data
  sourcing, prompt design, result editing/copy UX, and config wiring are a separate phase.

### Reviewed Todos (not folded)
None — all four Phase-21 follow-up todos are in scope and folded.

</deferred>

---

*Phase: 22-studio-ui-polish*
*Context gathered: 2026-05-30*
