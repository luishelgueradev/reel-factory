# Sketch Manifest

## Design Direction
Polish the Remotion Studio control surface into a **dense, deliberate, professional control panel** (product register — earned familiarity, the tool disappears into the task) while preserving the established **dark indigo design system** (canvas `#1a1a2e`, chrome `#16213e`, blue accent `#90caf9`, action green `#4CAF50`). Phase 22 reshapes the workspace into a **3-column shell** (live 9:16 preview · controls · social-media metadata placeholder), reorders each tab's controls **Position → Style → Advanced** with rarely-used controls disclosed, and introduces a shared **9-point position-preset** affordance for titles / overlays / subtitles. Color stays Restrained: tinted-indigo neutrals (OKLCH-tuned, no pure black/white), blue reserved for selection/focus, green reserved for the single primary action. This sketch pass (Phase 22 decision D-05) explores the layout and density questions before planning the real React redesign.

## Reference Points
- Existing Reel Factory Studio panel (`services/remotion-studio/src/preview/PreviewApp.tsx`) — the dark theme + 2-column shell being elevated.
- Product-tool craft bar: Linear / Figma / Raycast-grade control panels (dense, consistent, calm).
- Phase 22 context: `.planning/phases/22-studio-ui-polish/22-CONTEXT.md` (decisions D-01 … D-11).

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | three-column-shell | Does the preview \| controls \| metadata 3-column layout feel right, and how much room should the metadata placeholder get? | **D** — slim (content-sized) preview + controls grow into 2 internal columns + persistent (non-collapsing) metadata column | layout, shell, metadata-placeholder |
| 002 | control-density-disclosure | How should controls group/disclose within a tab so it reads as a deliberate panel, not stacked forms? | **A** — always-open titled sections, Position→Style→Advanced (height absorbed by 001-D's two columns) | density, disclosure, impeccable |
| 003 | position-presets | What should the shared 9-point position-preset affordance look like next to the X/Y inputs? | **B** — 9 arrow buttons (directional glyphs), compact enough for the 2-col panel | presets, position, shared-component |
| 004 | overlay-list-and-layering | How does the Overlays tab manage a multi-item list (add/select/remove + reorder=paint order + per-overlay back/front layer toggle) inside the dense panel, and how is "behind text" communicated? | **A** — overlay list (cards) + detail form below; list separate from the shared Posición→Estilo→Avanzado form, `Capa: Detrás/Delante` segmented in Estilo, drag-handle reorder = paint order | overlays, layering, list, D-03, D-04 |
| 005 | subtitles-tab-restructure | Does the sample-text textarea moved to the top of Subtitles (D-10) sit gracefully above Posición→Estilo→Avanzado, or break the dense row rhythm? | **C** — condensed single-line field at the top of Subtitles that expands on focus; keeps the dense grid intact ("set-once" input, "no se exporta" cue) | subtitles, tabs, textarea, D-10 |
| 006 | all-three-tabs-coherence | Composed in the 001-D shell, do Titles / Overlays / Subtitles hold the same section vocabulary when switching — or does the pattern drift? (integration check of 004 + 005 winners) | _TBD_ | consistency, tabs, integration |
| 007 | preview-as-layer-map | Could the full-size live preview itself be a drag-to-position + layer-stack surface (overlays z-stacked vs text), instead of only the in-panel controls? | **A** — drag-to-position on the full preview, snapping to the 9 anchors and sharing the X/Y path (scope-expanding; click-to-select is the cheap subset if full drag is deferred) | frontier, preview, drag, layering |

## Combined Direction (Phase 22)
Three columns: **content-sized 9:16 preview** · **controls that grow into two internal columns** (always-open Position → Style → Advanced sections, with **arrow-button 9-point presets** in Position) · **persistent ~320px social-metadata placeholder** ("Próximamente"). Dark indigo design system preserved, Restrained color. The realized synthesis is sketch **001 variant D**. Real-build note: collapse the controls' two internal columns to one below a width breakpoint.
