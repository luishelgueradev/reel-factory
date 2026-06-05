---
phase: 26
plan: "04"
subsystem: remotion-studio-editor
tags: [ui, layout, density, 2-col, sketch-convergence]
key-files:
  modified:
    - services/remotion-studio/src/editor/components/TitleEditor.tsx
    - services/remotion-studio/src/editor/components/StyleControls.tsx
    - services/remotion-studio/src/editor/components/OverlayEditor.tsx
  created:
    - services/remotion-studio/src/editor/components/title-density.test.tsx
decisions:
  - "Sketch 014-C variant C chosen for Títulos: entrance preset cards (full-width) then 2-col grid with Posición+Avanzado left, Texto/Estilo right"
  - "Sketch 011-C variant C chosen for Subtítulos: Tipografía+Posición left, Color+Efectos right with collapsible FxBlock pattern"
  - "Sketch 019-C lista-protagonista for Overlays: list is hero, edit form uses 2-col Posición left / Estilo right"
  - "data-ctrl-2col attribute on grid containers serves as test hook for grid assertion without CSS-in-JS class names"
  - "FxBlock replaces raw checkbox+collapse for glow/background-highlight: cleaner toggle semantics matching sketch .fx/.fx-head/.fx-params"
  - "Row helper (72px label + 1fr value) locks sketch .row grid-template-columns: 72px 1fr throughout all three components"
  - "Color law preserved: all active/selected states use --accent (blue); no #4CAF50 green introduced"
metrics:
  completed: "2026-06-05"
---

# Phase 26 Plan 04: Dense 2-Column Layout Convergence Summary

**One-liner:** Reorganized TitleEditor, StyleControls, and OverlayEditor from loose single-column stacks into sketch 014-C/011-C/019-C dense 2-column grid layouts, eliminating wasted vertical space with tight 72px-label rows and paired columns.

## What Was Built

### TitleEditor.tsx (sketch 014-C)
- Full-width entrance preset cards section above the form (unchanged cards, moved to top)
- Dense 2-col grid (`data-ctrl-2col`) with left/right `data-colwrap` columns
- Left: Posición (X/Y `.two` + PositionPresets) + Avanzado (interlínea, glow on/off toggle, glow color+difusión, aparece, duración)
- Right: Texto/Estilo (text input, font select, tamaño range, peso/itálica 3-button row, caja color pair as `.cmatrix`, opacity, relleno, radio)
- New `Row` helper: `grid-template-columns: 72px 1fr` for tight label+field rows
- New `RangeRow` helper: labeled range with output bubble (42px)
- New `TwoFields` helper: X/Y side-by-side with mini uppercase labels
- New `ColorSwatch` helper: 26×26 swatch + label (sketch `.crole` pattern)

### StyleControls.tsx (sketch 011-C)
- Dense 2-col grid (`data-ctrl-2col`) at component root
- Left: Tipografía (font, size, Reg/Bold/It combo, espaciado, interlínea) + Posición (PositionPresets enum, offset Y, ancho)
- Right: Color (2×2 `.cmatrix` for Activa/Resaltada/Inactiva/Contorno + contorno px) + Efectos (collapsible `FxBlock` for glow + background highlight) + Avanzado (op. pasada, resalte ms, transición)
- New `FxBlock` component: toggle switch + collapsible params matching sketch `.fx/.fx-head/.fx-params`
- Color swatch uses inline `<input type="color">` inside styled swatch div (sketch `.cswatch` pattern)

### OverlayEditor.tsx (sketch 019-C)
- List remains the hero (unchanged list cards)
- Edit form reorganized into 2-col grid (`data-ctrl-2col`)
- Left: Posición (X/Y inputs styled as sketch `.xy` + PositionPresets)
- Right: Estilo (PNG upload zone, Ancho px range, Opacidad range, Capa seg buttons)
- Removed empty "Avanzado" section (had no fields, was dead space)

### title-density.test.tsx (NEW)
- TitleEditor: 17 tests — 2-col grid presence, grid-template-columns, colwrap columns, entrance radiogroup, active card color law, all key inputs, cancel closes form
- StyleControls: 13 tests — 2-col grid, colwrap columns, font select, ranges, color swatches ≥4, FxBlock, Bold active state color law
- All 430 tests pass; build:editor passes

## Deviations from Plan

### Auto-fixed Issues

None — all controls preserved with identical onChange/config contracts. No features added or removed.

### Structural adaptations

**1. [Rule 2 - Enhancement] Replaced raw checkbox glow toggle with FxBlock component**
- **Found during:** StyleControls implementation
- **Issue:** The sketch explicitly shows a `.fx/.switch/.fx-head` collapsible pattern; the previous `<input type="checkbox">` did not match
- **Fix:** Extracted `FxBlock` component with switch toggle + collapsible body; same `onChange` calls
- **Files modified:** StyleControls.tsx

**2. [Rule 1 - Cleanup] Removed OverlayEditor "§ 3 Avanzado" empty section**
- **Found during:** OverlayEditor implementation
- **Issue:** Section existed with only italic placeholder text "Sin ajustes avanzados por ahora" — pure dead space in the dense layout
- **Fix:** Removed the empty section; future fields can be added to the right column when needed
- **Files modified:** OverlayEditor.tsx

## Self-Check

- [x] `services/remotion-studio/src/editor/components/TitleEditor.tsx` — exists, modified
- [x] `services/remotion-studio/src/editor/components/StyleControls.tsx` — exists, modified
- [x] `services/remotion-studio/src/editor/components/OverlayEditor.tsx` — exists, modified
- [x] `services/remotion-studio/src/editor/components/title-density.test.tsx` — exists, created
- [x] `git status --porcelain` shows only these 4 files changed/added (plus pre-existing untracked)
- [x] `npm run test` — 430/430 passed
- [x] `npm run build:editor` — built in 1.93s, no errors

## Self-Check: PASSED
