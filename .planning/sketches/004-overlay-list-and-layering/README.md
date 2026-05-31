---
sketch: 004
name: overlay-list-and-layering
question: "How does the Overlays tab manage a multi-item list (add/select/remove + reorder=paint order + per-overlay back/front layer toggle) inside the dense control panel, and how is 'behind text' communicated?"
winner: "A"
tags: [overlays, layering, list, phase-22, D-03, D-04]
---

# Sketch 004: Overlay List & Layering

## Design Question
Phase 22 locks the overlay layering model (**D-03 / D-04**) but no prior sketch touched it:
- Overlays default **behind** titles/subtitles; a **per-overlay back/front toggle** can promote one above text (D-03 — new `layer: "back" | "front"` field).
- Among overlays, **array order = paint order** (D-04) — reorder by moving items in the list, no z-index field.
- Overlays are a **multi-item list** (hard cap **3**, real `MAX_OVERLAYS`), unlike the singular Titles/Subtitles form. Does that list reconcile with the dense Posición→Estilo→Avanzado vocabulary validated in sketch 002? And how do we make "this overlay is behind the text" legible at a glance?

Grounded in the real `PngOverlayConfig` (`imageData, x, y, displayWidth, opacity`) + the new `layer` field.

## How to View
open .planning/sketches/004-overlay-list-and-layering/index.html

## Variants
- **A: List + detail form** — a list of overlay cards at the top (thumbnail · name · `Detrás/Delante` badge · visibility eye · drag handle); selecting one opens the standard Posición→Estilo→Avanzado form below, with **Capa: Detrás del texto / Delante** as a segmented control. Master/detail — familiar, mirrors the existing OverlayEditor list+form.
- **B: Layer-stack band** — a Photoshop-style stack (top = front). The **text** (títulos + subtítulos) is a fixed band in the middle; overlays sit above (front) or below (back) it. Reorder/drag across the band = change layer + paint order. Makes D-03/D-04 spatially obvious; selecting a layer edits it below.
- **C: Inline accordion** — each overlay is an expandable row; the header carries the `Detrás/Delante` pill toggle + ▲▼ reorder arrows, and expanding reveals its controls inline. One column, no separate form region — most compact.

## Winner: A — rationale
**List + detail form** won. It mirrors the existing `OverlayEditor` (list + add/edit/delete) so the
migration is the smallest, and it keeps the multi-item list *separate from* the dense
Posición→Estilo→Avanzado form — so the form stays identical to Titles/Subtitles (the section
vocabulary generalizes cleanly) while the list handles the overlay-specific concerns (cap of 3,
add/remove, visibility, reorder). The **Capa: Detrás del texto / Delante** segmented lives in the
form's Estilo section; reorder is via drag handle on the cards (paint order, D-04). The layer-stack
band (B) was the most spatial but introduced a second metaphor (a fixed "text band" layer) that
doesn't otherwise exist in the panel; the inline accordion (C) packed toggle + reorder onto each row
but got busy fast and made the form controls feel cramped inside the list.

Real-build notes: the `Detrás/Delante` toggle sets the new `layer` field (default `"back"`). Card
order = array order = paint order. Keep the back overlays' slight dim in the *preview only* (a
legibility cue), not in the exported render.

## What to Look For
- **Live layering in the preview:** the logo (front) sits above the title; the watermark + frame (back) sit behind the text and render slightly dimmed. Toggle a layer / reorder and watch the phone restack. Does "behind text" read clearly?
- **List vs the density vocabulary:** does the multi-item list feel of-a-piece with the Titles/Subtitles section pattern, or like a different UI? (This is the consistency risk sketch 002 flagged but didn't test.)
- **Where does the layer toggle belong** — inside the form (A), implied by stack position (B), or on the row header (C)?
- **Reorder affordance:** drag handle (A/B) vs explicit ▲▼ arrows (C) — which reads faster for "paint order"?
- **3-overlay cap:** the disabled "Agregar overlay" + "Máximo 3" note — clear without nagging?
- Pick a preset / it pushes size-aware X/Y and the inputs flash (shared with sketch 003).
