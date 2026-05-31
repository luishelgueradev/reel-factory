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

## Combined Direction (Phase 22)
Three columns: **content-sized 9:16 preview** · **controls that grow into two internal columns** (always-open Position → Style → Advanced sections, with **arrow-button 9-point presets** in Position) · **persistent ~320px social-metadata placeholder** ("Próximamente"). Dark indigo design system preserved, Restrained color. The realized synthesis is sketch **001 variant D**. Real-build note: collapse the controls' two internal columns to one below a width breakpoint.
