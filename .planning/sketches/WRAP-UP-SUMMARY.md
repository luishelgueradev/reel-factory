# Sketch Wrap-Up Summary

**Wrap-up sessions:** 2026-05-31 (sketches 001–011) · 2026-06-01 (sketches 012–015)
**Sketches processed:** 15 (all)
**Design areas:** Workspace Shell, Control Density, Position Presets, Tab Patterns (+ TabLead/TabForm),
Subtitle Styling, Title Styling, Header Action Zone, States & Save, Motion, Preview Manipulation,
Render Surface, North-Star Composite
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
- **States/save:** header status chip; empty/cap/loading states — 008-B.
- **Motion:** calm 170ms two-tier timing — 009-A.
- **Preview (frontier):** drag-to-position on the full preview, sharing the X/Y path — 007-A.
- **Render (frontier):** on the dimmed preview + green-primary reassignment to Render — 010-A.
- **North star & scope line:** the whole thing composed in one screen — 015-A. **Plan-split rule: ship
  the committed editing surface (015-B) first; bolt on the 007 drag + 010 render frontier layers later
  without rework.** The A↔B contrast names the boundary the build plan cuts along.

## Open Sub-Problems (not yet sketched)
- **Font picker** for 26 fonts with live previews (011/014 stubbed it as a font grid + overflow).
- Title-animation timing/keyframe UI; zoom-segment editor; the metadata column's real content (AI phase).
- Responsive behavior of the dense tabs (the 2-col→1-col collapse is documented, not sketched in full).
