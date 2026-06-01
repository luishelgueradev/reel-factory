# Sketch Wrap-Up Summary

**Wrap-up sessions:** 2026-05-31 (sketches 001–011) · 2026-06-01 (sketches 012–015) · 2026-06-01 (sketches 016–018) · 2026-06-01 (sketches 019–022)
**Sketches processed:** 22 (all)
**Design areas:** Workspace Shell, Control Density, Position Presets, Tab Patterns (+ TabLead/TabForm,
Overlays list-forward), Subtitle Styling, Title Styling (+ entrance timing), Video Effects/Transitions,
Timeline (frontier), Font Picker, Header Action Zone, States & Save, First-Run/Empty, Responsive
Reflow, Motion, Preview Manipulation, Render Surface, North-Star Composite
**Skill output:** `./.claude/skills/sketch-findings-reel-factory/`

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | three-column-shell | D | Workspace Shell |
| 002 | control-density-disclosure | A | Control Density |
| 003 | position-presets | B | Position Presets |
| 004 | overlay-list-and-layering | A | Tab Patterns |
| 005 | subtitles-tab-restructure | C | Tab Patterns |
| 006 | all-three-tabs-coherence | A | Tab Patterns |
| 007 | preview-as-layer-map | A | Preview Manipulation (frontier) |
| 008 | states-and-empties | B | States & Save |
| 009 | motion-coherence | A | Motion |
| 010 | render-export-surface | A | Render Surface (frontier) |
| 011 | subtitle-style-density | C | Subtitle Styling |
| 012 | subtitle-density-in-shell | B | Tab Patterns (TabLead/TabForm) |
| 013 | header-action-zone | B | Header Action Zone |
| 014 | title-style-density | C | Title Styling |
| 015 | north-star-composite | A | North-Star Composite |
| 016 | font-picker | C | Font Picker |
| 017 | first-run-empty-workspace | B | First-Run & Empty Workspace |
| 018 | dense-tabs-at-breakpoint | B | Responsive Breakpoint Reflow |
| 019 | overlays-tab-density | C | Tab Patterns (Overlays list-forward) |
| 020 | timeline-scrubber | C | Timeline / Temporal (frontier) |
| 021 | video-effects-surface | A | Video Effects — Transitions Tab |
| 022 | title-entrance-timing | B | Title Styling (entrance timing) |

## Excluded Sketches
_None._

## Design Direction
The **dark indigo design system** (canvas `#1a1a2e`, chrome `#16213e`, blue accent `#90caf9`, action
green `#4CAF50`), tuned in OKLCH with tinted-indigo neutrals. Color stays **Restrained**: blue for
selection/focus/current, green for the single primary action. One well-tuned sans (Inter) for UI
chrome on a fixed rem scale; compact spacing rhythm; calm motion (170ms ease-out-quart). The realized
shell synthesis is the 3-column layout from 001-D, and the whole vision composed in one screen is
015-A.

## Key Decisions
- **Shell:** 3-column (content-sized 9:16 preview · 2-col controls · persistent metadata) — 001-D.
- **Density:** always-open Posición→Estilo→Avanzado sections, no collapsible sections — 002-A.
- **Position:** shared 9-point arrow-button preset grid — 003-B.
- **Tabs:** Titles/Overlays = list+form, Subtitles = textarea-led; coherence rule (full-width lead,
  form always 2-col) — 004-A / 005-C / 006-A. Made buildable as the **TabLead / TabForm** two-slot
  skeleton every tab fills — 012-B (`<TabLead>` + `<TabForm>` React contract).
- **Subtitle styling (dense):** layout-mode = preset cards (not dropdown) leading the section,
  in-panel live specimen, 2×2 color-role matrix, collapsible effect-rows (Glow/Fondo), against the
  real ~20-field caption schema — 011-C. Anti-pattern: A's flat ~20 rows = the wall.
- **Title styling (dense):** a title is a **boxed text card + entrance animation**. Specimen (showing
  the box) + **entrance preset cards** (Slide↑/↓·Fade·Ninguna) + 1×2 Texto/Caja color pairing +
  collapsible Glow — 014-C. The 011-C kit **transfers**: mode-cards→entrance-cards,
  color-matrix→box/text, effect-rows→glow. One component set styles both tabs.
- **Header action zone:** split zones — status chip left (by brand), Guardar(outline)+Render(green)
  right with a hairline between — 013-B. **Render is the only green; Guardar never greens (the chip
  carries dirty).** Reconciles 008-B + 010-A; chip holds its left home through render.
- **Font picker:** a **slide-over gallery sheet** opened from a current-font trigger — search +
  category chips over a 2-up grid of cards each rendering the **sample text in its own face**, against
  the real 26-font `AVAILABLE_FONTS` — 016-C. Selection = blue; self-contained shared component for
  Títulos + Subtítulos. Resolves the picker 011 flagged. Anti-pattern: inline scroll-box / popover.
- **States/save:** header status chip; empty/cap/loading states — 008-B.
- **First-run / empty workspace:** cold start = dropzone on the stage + dense controls **live on their
  defaults** (banner: "valores por defecto") — 017-B. Single green = upload; Guardar disabled, Render
  ghosted; metadata persists "Próximamente". Not gated, not a welcome takeover.
- **Responsive reflow:** at the narrow (~360px) column, **reflow the multi-up grids** — 2-col form →
  1-col, mode/entrance cards → 2×2, font grid → 1-up, color matrix stays 2×2 — 018-B. **002-A's
  always-open rule stays intact** (no disclosure-under-pressure). One reflow rule across all three tabs.
- **Overlays tab (dense vs lean):** the real `PngOverlayConfig` is a *small* schema (x/y, width,
  opacity, Capa, cap 3), so Overlays goes **list-forward** — fat per-item cards with inline
  width/opacity/Capa/anchor, no separate detail form — 019-C. ⚠ **Departs from the TabLead/TabForm
  contract** the other tabs share; **019-A (lean shared list+form)** is the named fallback if the
  off-pattern card reads wrong at build. Anti-pattern: 019-B inventing controls (lock-aspect/fit/nudge)
  not in the schema just for parity.
- **Title entrance timing:** plain **numeric rows** — Aparece (`startTimeMs`) / Dura (`durationMs`) /
  Velocidad — in the Tiempo section — 022-B. Division of labor with the global timeline (020-C): the
  timeline does **visual placement**, numeric rows **refine**. One timeline idiom; no per-title track
  (rejected 022-A/C).
- **Video effects / transitions:** **auto-emphasis-zoom DROPPED** (product decision 2026-06-01 — fired
  on Whisper confidence dips = mumbled words, not emphasis; off-brand; memory `auto-zoom-dropped`).
  Survivor `TransitionConfig` (1.08× push / crop-shift masking silence cuts) lives in a **minimal
  "Video" 4th tab** — transition type cards w/ looping motion preview + Duración — 021-A. Anti-pattern:
  rebuild `detectZoomEvents`; flashy preview; over-fill the thin tab (B/C are fallbacks if it stays
  one control).
- **Timeline (frontier / likely next-milestone):** a **strip under stage+controls** (Títulos/Overlays/
  Subtítulos lanes), **metadata column keeps full height** — 020-C. Track surface (not cards),
  scrub-to-preview + drag-to-retime. Middle ground vs preview-only scrubber (020-A) / full-width
  multi-track dock (020-B). Pairs with 022-B's numeric rows as the one timeline idiom.
- **Motion:** calm 170ms two-tier timing — 009-A.
- **Preview (frontier):** drag-to-position on the full preview, sharing the X/Y path — 007-A.
- **Render (frontier):** on the dimmed preview + green-primary reassignment to Render — 010-A.
- **North star & scope line:** the whole thing composed in one screen — 015-A. **Plan-split rule: ship
  the committed editing surface (015-B) first; bolt on the 007 drag + 010 render frontier layers later
  without rework.** The A↔B contrast names the boundary the build plan cuts along.

## Open Sub-Problems
- ~~**Font picker** for 26 fonts with live previews~~ — **resolved by sketch 016-C** (slide-over gallery).
- ~~Responsive behavior of the dense tabs~~ — **resolved by sketch 018-B** (reflow the multi-up grids).
- ~~Title-animation timing UI~~ — **resolved by sketch 022-B** (numeric Aparece/Dura/Velocidad rows).
- ~~Zoom-segment editor~~ — **moot:** auto-emphasis-zoom **dropped** (021 / memory `auto-zoom-dropped`).
  If emphasis-zoom is ever revived it needs a real signal (prosody/LLM/manual) + slow held push, as a
  separate spike.
- **Build-time watch (019-C):** the list-forward Overlays tab departs from the TabLead/TabForm contract
  — confirm it reads on-pattern next to the other tabs, else fall back to 019-A.
- **Frontier / next-milestone:** the **timeline** (020-C) and the committed-vs-frontier scope line
  (007 drag, 010 render) are validated *directions*, not Phase-22 deliverables. Still open: the
  metadata column's real content (AI phase).
