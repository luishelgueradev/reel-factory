# Phase 18: Studio UI redesign - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

The remotion-studio frontend becomes **one** screen: a two-column interface with the live 9:16 video preview on the left and all controls organized into tabs on the right. The currently-separate `/editor` (config-form + raw-JSON) and `/preview` (live-player + collapsible sections) screens are consolidated into this single surface, and the duplicated control-component usage between them is removed.

**In scope:** Unifying the two screens into one tabbed two-column layout; converting the right-panel control groups into tabs; consolidating/removing the redundant editor screen and its routing; light visual polish; building the tab/control framework so phases 19–21 can plug in new controls.

**Out of scope (later phases):** New config *fields* / typography & text effects (19), title-block pixel precision (20), PNG overlays (21). No new pipeline behavior. No formal design-token system (explicitly deferred — see D-07). Backend/persistence is untouched — Phase 17 already made `PUT /api/config` → `./pipeline/pipeline-config.json` the deterministic sole writer.

**UI hint: YES** — `impeccable` skill + `frontend-design` plugin MUST be invoked at the start of plan/execute (AGENTS.md, non-negotiable).
</domain>

<decisions>
## Implementation Decisions

### Canonical screen & consolidation mechanic (STUDIO-01, STUDIO-03)
- **D-01:** The `/preview` (`PreviewApp.tsx`) live-player two-column layout is the **base** for the unified screen — it already implements left 9:16 `<Player>` + right control panel. The `/editor` (`EditorApp.tsx`) form-only screen is **removed**.
- **D-02:** `App.tsx` routing collapses to a single canonical studio route. The `/editor` route and the `/` → `/editor` default redirect go away (or redirect to the unified screen). Eliminate the duplicated import of `LayoutSelector` / `StyleControls` / `TitleEditor` so there is exactly one usage path (STUDIO-03).

### Tab structure (STUDIO-02)
- **D-03:** Right panel uses **three tabs: `Subtitles` / `Titles` / `Text`**.
  - `Subtitles` = layout selector + subtitle style controls (+ font browsing, see D-06).
  - `Titles` = title overlay editor.
  - `Text` = sample-text input.
- **D-04:** **`Titles` is the default-open tab** on load.

### Editor-only feature fates
- **D-05:** The **Render Video button is kept but disabled** — greyed-out with a "coming soon" affordance. It must NOT fire the `POST /api/render` 501 path. (Rendering happens via the pipeline/API, not the studio; placeholder preserved for a future studio-render feature.)
- **D-06:** The raw-JSON `ConfigPreview` panel is **dropped** — the live video preview is the real feedback, and the config file is inspectable on disk (Phase 17). The **Font Grid** (`/preview/fonts` `FontGridPage`) is **folded into the `Subtitles` tab** as integrated font browsing (the standalone route is absorbed, not just linked).

### Redesign depth
- **D-07:** **Restructure + light polish** — reorganize the existing dark-theme UI into the two-column tabbed layout with a modest visual cleanup (consistent spacing/colors). **No formal design-token system** in this phase (deferred to a future design-system effort).
- **D-08:** **Build for extension** — the tab/control framework must let phases 19–21 add new controls (font effects, pixel positioning, overlay uploads) without restructuring. The `Subtitles` and `Titles` tabs should anticipate growth. (Extensible structure ≠ formal token system; D-07 still holds.)

### Save & live model
- **D-09:** **Manual `Save Config` button** is kept (writes via `PUT /api/config`). Live preview updates in-memory; persistence happens on explicit save. No autosave.
- **D-10:** **Unify title state** — drop the `previewTitles` vs `titles` split in `PreviewApp.tsx`. Title edits behave like every other control: live preview in-memory, persisted on Save. Removes the special-case state and its `onPreviewChange`/`onSave` wiring in `TitleEditor`.

### Claude's Discretion
- Exact tab-bar component/visual treatment, header/toolbar contents after consolidation, responsive behavior, and how Font Grid browsing is laid out inside the `Subtitles` tab (D-06) — decide during planning under `impeccable` + `frontend-design` guidance.
- Whether removed routes (`/editor`, `/preview/fonts`) should 301-redirect to the unified screen or be deleted outright.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 18: Studio UI redesign" — goal + 4 success criteria
- `.planning/REQUIREMENTS.md` — STUDIO-01 (single two-column interface, left preview/right controls), STUDIO-02 (all controls in right-panel tabs), STUDIO-03 (consolidate/remove duplicated editor/preview screens & components)
- `.planning/phases/17-config-persistence/17-CONTEXT.md` — deterministic save target: `PUT /api/config` → `./pipeline/pipeline-config.json`; studio is sole writer. The Save behavior (D-09) builds directly on this.

### Project conventions (mandatory)
- `AGENTS.md` §"UI/frontend work — REQUIRED tooling" — `impeccable` + `frontend-design` are non-negotiable for any UI phase
- `AGENTS.md` §"Development Conventions" — remotion-studio ALWAYS port 3123; start command with `setsid` + `ACTIVE_PIPELINE_CONFIG_PATH`; `npm run build:editor` to build; renderer-sync rules (NOTE: this phase is studio-frontend-only — no composition/shared-module changes expected, so the renderer-sync step likely does not apply, but verify)

### Files to change (the consolidation surface)
- `services/remotion-studio/src/editor/App.tsx` — router; collapses to single screen (D-02)
- `services/remotion-studio/src/editor/EditorApp.tsx` — removed/absorbed (D-01)
- `services/remotion-studio/src/preview/PreviewApp.tsx` — base for unified screen; collapsible sections → tabs; title-state unification (D-01, D-03, D-10)
- `services/remotion-studio/src/preview/PreviewPlayer.tsx` — left-column 9:16 player (reused)
- `services/remotion-studio/src/preview/FontGridPage.tsx` + `src/preview/TextareaInput.tsx` + `src/preview/textToCaptions.ts` — Font Grid folds into Subtitles tab; sample-text becomes Text tab (D-06, D-03)
- `services/remotion-studio/src/editor/components/{LayoutSelector,StyleControls,TitleEditor,ConfigPreview}.tsx` — shared controls (dedupe usage); ConfigPreview dropped (D-06); TitleEditor preview/save props simplified (D-10)
- `services/remotion-studio/src/editor/index.tsx` + `index.html` + `src/server.ts` — entry/serving; verify route changes don't break the dev server (port 3123) or `EDITOR_DIST` build output

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`PreviewApp.tsx` is already the target layout** — left 40% `<Player>` (via `PreviewPlayer`), right control panel with `CollapsibleSection` groups (Subtitle Layout / Subtitle Style / Title Overlays / Sample Text). The redesign converts these sections into the 3 tabs (D-03) rather than building from scratch.
- **Control components are already shared** — `LayoutSelector`, `StyleControls`, `TitleEditor` live in `editor/components/` and are imported by both screens today. Consolidation means a single consumer, not new components.
- **Live config load on mount** — both screens already `fetch("/api/config")` on mount and hydrate state; the unified screen keeps this.
- **Font loading** — `PreviewApp` eagerly `loadFont("Inter")` and reads a `?font=` URL param from `FontGridPage`. Folding Font Grid in (D-06) can replace the URL-param handoff with direct in-tab state.

### Established Patterns
- **In-memory live edit + manual PUT save** — `updateSubtitle` mutates local state for instant preview; `handleSave` persists. D-09 keeps this; D-10 extends it to titles (removing the `previewTitles`/`titles` divergence).
- **Dark theme inline styles** — `#1a1a2e` bg, `#16213e` header, `#90caf9` accents, inline `style={{}}` objects throughout. D-07 keeps this palette, just tidied — no token extraction.

### Integration Points
- `PUT /api/config` (write) and `GET /api/config` (load) in `services/remotion-studio/src/server.ts` — unchanged contract; the UI is the only thing that changes.
- `server.ts` serves the built editor bundle (`EDITOR_DIST`) and the SPA routes — route consolidation (D-02) must keep the dev server on **port 3123** working and the `npm run build:editor` output intact.

</code_context>

<specifics>
## Specific Ideas

- User selected the `Titles` tab as the default-open tab (D-04) — slightly unusual vs opening on Subtitles; honor it as stated.
- User's standing quality bar: element/text crispness "vs internet reels." Even though D-07 is "light polish, no token system," visual execution under `impeccable`/`frontend-design` should not feel cheap — this is the foundational control surface for the whole milestone (phases 19–21 build on it).
- Render Video button must be visibly present-but-disabled (D-05), not silently removed — user wants the affordance retained as a "coming soon" signal.

</specifics>

<deferred>
## Deferred Ideas

- **Formal design-token system** (color/spacing/typography scale + primitive component library) — explicitly deferred (D-07). Candidate for a dedicated design-system effort; this phase only does light polish on the existing theme.
- **Functional studio-side render trigger** — the Render Video button stays disabled (D-05); wiring `POST /api/render` to a real render is a future feature, not this phase.
- **Autosave** — considered and rejected for this phase (D-09); manual Save stays. Could revisit if save friction becomes a pain.

None of these add new capabilities to Phase 18 — discussion stayed within the consolidation/redesign scope.

</deferred>

---

*Phase: 18-studio-ui-redesign*
*Context gathered: 2026-05-27*
