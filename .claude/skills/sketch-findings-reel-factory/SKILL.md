---
name: sketch-findings-reel-factory
description: Validated design decisions, CSS patterns, and visual direction from Phase 22 sketch experiments for the Remotion Studio control panel (3-column shell, control density, position presets, per-tab structure & TabLead/TabForm skeleton, subtitle & title styling controls, header action zone, render surface, drag-to-position, north-star composite & scope boundary). Auto-loaded during UI implementation on reel-factory.
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
frontier drag-to-position surface), 2026-05-31 (sketches 008–010: off-happy-path states & save
feedback, motion/timing coherence, and the frontier render/export surface), 2026-05-31 (sketch 011:
subtitle styling control density against the full real caption schema), 2026-06-01 (sketches 012–015:
the TabLead/TabForm coherence skeleton, the reconciled header action zone, title styling density, and
the north-star composite with its committed-vs-frontier scope boundary).
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
blue. **Green (`--action` ~#4CAF50) marks THE single primary action of the *current* surface** —
context-dependent (ratified across sketches 008 + 010): `Render Video` when render is in play, with
`Guardar config` demoted to a secondary outline button; `Guardar config` in the editing-only state.
**Never two greens at once.** Amber (`--warning`) = dirty/unsaved, `--success` = confirm — both low
chroma. See `references/states-and-save-feedback.md` and `references/render-export-surface.md`.

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
| Per-Tab Structure & Coherence | references/tab-patterns.md | Coherence rule: lists (Titles/Overlays) + Subtitles textarea span full width, the Posición→Estilo→Avanzado form is always 2-col; **TabLead/TabForm skeleton (012-B)** = the two slots every tab fills, the buildable form of the rule; Overlays = list+form with Detrás/Delante layer toggle (D-03) & drag-reorder paint order (D-04); Subtitles = condensed/expanding sample-text textarea (D-10) |
| Subtitle Styling (dense controls) | references/subtitle-styling.md | Layout-mode = preset cards (not dropdown) leading the section, in-panel live specimen, 2×2 color-role matrix, collapsible Glow/Fondo effect-rows; validated against the real ~20-field caption schema from `pipeline-config.ts` (011-C). Anti-pattern: flat ~20 rows = the wall |
| Title Styling (dense controls) | references/title-styling.md | Titles = **boxed text card + entrance animation**. Specimen showing the box + **entrance preset cards** (Slide↑/↓·Fade·Ninguna) + 1×2 Texto/Caja color pairing + collapsible Glow (014-C). The 011-C vocabulary transfers: mode-cards→entrance-cards, color-matrix→box/text, effect-rows→glow. One component kit for both tabs. Anti-pattern: flat ~16 rows = the same wall |
| Header Action Zone | references/header-action-zone.md | Split zones (013-B): status chip left (ambient, by brand) · Guardar(outline)+Render(green) right, hairline between. **Render is the only green; Guardar never greens — the chip carries dirty.** Chip holds its left home through render. State map idle→dirty→saving→rendering→done |
| Preview as Editing Surface (frontier) | references/preview-direct-manipulation.md | ⚠️ Scope-expanding. Drag-to-position on the full preview, snapping to the same 9 anchors and writing the same X/Y path; cheap subset = click-to-select. Beyond committed control-driven scope |
| States, Empties & Save Feedback | references/states-and-save-feedback.md | Save = header status chip (`● Cambios sin guardar`→`Guardando…`→`✓ Guardado recién`) left of a stay-put button; validated empty (0/3), cap (3/3 disabled), no-video & Whisper-loading states |
| Motion & Timing | references/motion-and-timing.md | Calm 170ms ease-out-quart; two-tier timing (state `--dur` 170ms / travel `--dur2` 300ms); all 5 motions cohere; `prefers-reduced-motion` collapse required |
| Render / Export Surface (frontier) | references/render-export-surface.md | ⚠️ Scope-expanding. Render on the dimmed preview (progress ring + 3-step pipeline → "Reel listo"), no modal; Render takes the green primary; single-job constraint surfaced; OOM-aware failure |
| North-Star Composite & Scope Boundary | references/north-star-composite.md | The whole vision in one screen (015-A: 013-B header + 001-D shell + all tabs + 007 drag + 010 render). **Plan-split rule: ship the committed editing surface (B) first, bolt on the 007/010 frontier layers later without rework.** The A↔B contrast names the boundary |

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
- `sources/008-states-and-empties/index.html` — winner `#v-b`
- `sources/009-motion-coherence/index.html` — winner `#v-a`
- `sources/010-render-export-surface/index.html` — winner `#v-a` (frontier / scope-expanding)
- `sources/011-subtitle-style-density/index.html` — winner `#v-c`
- `sources/012-subtitle-density-in-shell/index.html` — winner `#v-b`
- `sources/013-header-action-zone/index.html` — winner `#v-b`
- `sources/014-title-style-density/index.html` — winner `#v-c`
- `sources/015-north-star-composite/index.html` — winner `#v-a` (A = north star; B = committed-scope slice)
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
- 008-states-and-empties (winner B)
- 009-motion-coherence (winner A)
- 010-render-export-surface (winner A — frontier, scope-expanding)
- 011-subtitle-style-density (winner C)
- 012-subtitle-density-in-shell (winner B — TabLead/TabForm skeleton)
- 013-header-action-zone (winner B — split zones)
- 014-title-style-density (winner C — specimen + entrance cards)
- 015-north-star-composite (winner A — north star; B = committed-scope slice)
</metadata>
