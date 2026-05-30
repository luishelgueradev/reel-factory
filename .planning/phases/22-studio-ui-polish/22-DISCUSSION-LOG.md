# Phase 22: Studio UI polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 22-studio-ui-polish
**Areas discussed:** Overlay layering model, Density & disclosure pattern, 3-column layout shell, Auto-position preset set, Control order & sample-text placement

---

## Overlay layering model

### Default override capability

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed below-text default | All overlays always below text, no per-overlay control | |
| Per-overlay back/front toggle | Default below; each overlay can be promoted above text via toggle (new `layer` field) | ✓ |
| Full z-index field | Numeric z spanning whole stack | |

### Multi-overlay stacking

| Option | Description | Selected |
|--------|-------------|----------|
| Array order = paint order | Later array entry paints on top, within layer band; no new field | ✓ |
| Explicit z field per overlay | Each overlay carries its own z number | |

**User's choice:** Per-overlay back/front toggle + array-order paint order.
**Notes:** Decorators (logos/watermarks/frames) belong behind text by default, but a specific overlay can be promoted. Must be mirrored in studio `SubtitledVideo` and renderer `Root.tsx`.

---

## Density & disclosure pattern

### Upfront design structure

| Option | Description | Selected |
|--------|-------------|----------|
| UI-SPEC pass first | `/gsd-ui-phase 22` design contract before planning | |
| Sketch pass first | `/gsd-sketch` throwaway HTML mockup, react, then plan | ✓ |
| Go straight to plan | Let impeccable drive layout during execution | |

### Disclosure mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible sections | Labeled sections, rarely-used collapsed | |
| Multi-column / grid | Pack related controls side-by-side | |
| Let impeccable decide | No locked mechanism; design pass chooses per tab | ✓ |

**User's choice:** Sketch first; disclosure mechanism left to impeccable/design pass.
**Notes:** Sketch must reflect the 3-column shell (see below).

---

## 3-column layout shell (raised by user during discussion)

| Option | Description | Selected |
|--------|-------------|----------|
| Scaffold visible con placeholder | Adopt 3-column shell now: preview \| controls \| metadata placeholder ("próximamente") | ✓ |
| Diseñar para 3, construir 2 | Design contemplates col-3 but ship only 2 columns | |
| Mantener 2 columnas, no precluir | Stay 2-column, just don't block future col-3 | |

**User's choice:** Build the 3-column shell now with a structured placeholder column.
**Notes:** User clarified a future feature — an AI panel that auto-fills social-media metadata (title, description, hashtags) from the subtitle transcription + chosen titles. Desired layout: col1 preview / col2 controles / col3 metadata redes (preferred always-visible). The AI generation logic is deferred to its own phase; Phase 22 builds the placeholder structure so the redesign isn't done against a 2-column assumption.

---

## Auto-position preset set

### Preset buttons

| Option | Description | Selected |
|--------|-------------|----------|
| 9-point grid | 4 corners + 4 edge-centers + center | ✓ |
| 6 buttons (edges + axes) | Top/bottom/left/right/center-x/center-y (ROADMAP literal) | |
| Mirror subtitle presets exactly | Only the 3 existing subtitle presets | |

### Shared component

| Option | Description | Selected |
|--------|-------------|----------|
| Shared PositionPresets component | One component for titles + overlays; migrate subtitles too | ✓ |
| Shared, but don't touch subtitles | New component for titles+overlays only | |

**User's choice:** 9-point grid + shared `PositionPresets` (migrate subtitles).
**Notes:** Centering must be size-aware — overlay anchor is top-left at displayWidth; compute against 1080×1920 and push via `handleDraftChange`.

---

## Control order & sample-text placement

### Sample-text location within Subtitles

| Option | Description | Selected |
|--------|-------------|----------|
| Arriba de Subtitles | First element of the Subtitles section | ✓ |
| Colapsable arriba | Collapsible "test text" section, closed by default | |
| Al final de Subtitles | After style controls | |

### Control priority order

| Option | Description | Selected |
|--------|-------------|----------|
| Posición → Estilo → Avanzado | Location first, then style, then advanced (collapsed) | ✓ |
| Contenido → Estilo → Posición | Content first, then style, then position | |
| Que lo defina el sketch | Don't lock order now | |

**User's choice:** Sample-text at top of Subtitles; controls ordered Position → Style → Advanced, consistent across tabs.
**Notes:** "Text" tab removed; final tabs Titles | Overlays | Subtitles.

---

## Claude's Discretion

- Disclosure mechanism per tab (collapsible vs columns vs accordions) — impeccable/design pass.
- Spacing rhythm, token values, section grouping within the dark theme — bounded by the sketch + impeccable pass.

## Deferred Ideas

- **AI social-media metadata generation** — future phase. AI auto-fills title / description / hashtags / etc. from the subtitle transcription + chosen titles, surfaced in column 3. Phase 22 ships only the placeholder column.
