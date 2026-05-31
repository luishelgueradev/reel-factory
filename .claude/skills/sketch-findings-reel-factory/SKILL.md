---
name: sketch-findings-reel-factory
description: Validated design decisions, CSS patterns, and visual direction from Phase 22 sketch experiments for the Remotion Studio control panel (3-column shell, control density, position presets, per-tab structure, drag-to-position). Auto-loaded during UI implementation on reel-factory.
---

<context>
## Project: reel-factory

Phase 22 polishes the Remotion Studio control surface into a **dense, deliberate, professional
control panel** (product register — earned familiarity, the tool disappears into the task) while
preserving the established **dark indigo design system**. Reference craft bar: Linear / Figma /
Raycast-grade control panels. The surface being elevated is
`services/remotion-studio/src/preview/PreviewApp.tsx` (the existing dark 2-column shell).

These findings come from the sketch pass for Phase 22 decision D-05 — layout and density questions
explored as throwaway HTML before the real React redesign.

Sketch sessions wrapped: 2026-05-31 (sketches 001–003: shell, density, presets), 2026-05-31
(sketches 004–007: per-tab structure, overlay layering, subtitles textarea, tab coherence, and the
frontier drag-to-position surface).
</context>

<design_direction>
## Overall Direction

A 3-column workspace shell — **content-sized 9:16 preview · controls that grow into two internal
columns · persistent ~320px social-metadata placeholder** ("Próximamente"). Each tab (Titles /
Overlays / Subtitles) orders controls **Posición → Estilo → Avanzado** as always-open titled
sections, with a shared **9-point arrow-button position-preset** affordance in the Posición section.

**Color is Restrained** (design-system rule, see theme): tinted-indigo neutrals tuned in OKLCH, no
pure black/white. **Blue (`--accent` ~#90caf9) is reserved for selection / focus / current**; the
segmented-control "on" state, swatch selection, focus rings, active tab, and active preset are all
blue. **Green (`--action` ~#4CAF50) is reserved for the single primary action** (`Guardar config`) —
nothing else is green.

**Typography:** one well-tuned sans (Inter), fixed rem-ish scale (`--t-2xs` 10.5px … `--t-2xl`
23px). **Spacing:** compact rhythm (`--s-1` 2px … `--s-16` 32px). **Shape:** 4–12px radii.
**Motion:** 150–250ms ease-out-quart (`--ease`, `--dur` 170ms), state-conveying not decorative.

The realized synthesis is **sketch 001 variant D** — it folds in 002-A's always-open sections and
003-B's arrow presets into the real shell.
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Workspace Shell & Layout | references/workspace-shell.md | 3-column shell: content-sized preview (`flex:0 1 470px`) · controls grow into 2 internal columns · persistent (non-collapsing) 320px metadata placeholder |
| Control Panel Density & Disclosure | references/control-panel-density.md | Always-open titled sections, Posición→Estilo→Avanzado, hairline dividers; no collapse/accordion (height absorbed by 2-col layout) |
| Position Presets (shared component) | references/position-presets.md | 9-point arrow-button grid (↖↑↗ …), size-aware X/Y math vs 1080×1920 top-left anchor, inputs flash on apply |
| Per-Tab Structure & Coherence | references/tab-patterns.md | Coherence rule: lists (Titles/Overlays) + Subtitles textarea span full width, the Posición→Estilo→Avanzado form is always 2-col; Overlays = list+form with Detrás/Delante layer toggle (D-03) & drag-reorder paint order (D-04); Subtitles = condensed/expanding sample-text textarea (D-10) |
| Preview as Editing Surface (frontier) | references/preview-direct-manipulation.md | ⚠️ Scope-expanding. Drag-to-position on the full preview, snapping to the same 9 anchors and writing the same X/Y path; cheap subset = click-to-select. Beyond committed control-driven scope |

## Theme

The winning theme file is at `sources/themes/default.css` — the canonical OKLCH token set (surfaces,
borders, text, accent, semantic colors, type scale, spacing, shape, elevation, motion). All
reference CSS uses these variables. Reuse it verbatim as the design-token source for the real build.

## Source Files

Original sketch HTML files (all variants, winners marked with ★ in the variant nav) are preserved in
`sources/` for complete reference:
- `sources/001-three-column-shell/index.html` — winner `#v-d`
- `sources/002-control-density-disclosure/index.html` — winner `#v-a`
- `sources/003-position-presets/index.html` — winner `#v-b`
- `sources/004-overlay-list-and-layering/index.html` — winner `#v-a`
- `sources/005-subtitles-tab-restructure/index.html` — winner `#v-c`
- `sources/006-all-three-tabs-coherence/index.html` — winner `#v-a`
- `sources/007-preview-as-layer-map/index.html` — winner `#v-a` (frontier / scope-expanding)
</findings_index>

<metadata>
## Processed Sketches

- 001-three-column-shell (winner D)
- 002-control-density-disclosure (winner A)
- 003-position-presets (winner B)
- 004-overlay-list-and-layering (winner A)
- 005-subtitles-tab-restructure (winner C)
- 006-all-three-tabs-coherence (winner A)
- 007-preview-as-layer-map (winner A — frontier, scope-expanding)
</metadata>
