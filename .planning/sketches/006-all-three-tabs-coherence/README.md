---
sketch: 006
name: all-three-tabs-coherence
question: "Composed in the 001-D shell, do Titles / Overlays / Subtitles hold the same section vocabulary when switching — or does the pattern drift? (integration check of the 004-A and 005-C winners.)"
winner: "A"
tags: [consistency, tabs, integration, phase-22]
---

# Sketch 006: All-Three-Tabs Coherence

## Design Question
Sketch 002 validated the Posición→Estilo→Avanzado section vocabulary on *one* generic tab and claimed
it "must generalize across Titles / Overlays / Subtitles." This sketch is the **integration check** —
all three real tabs composed in the 001-D shell, with the now-chosen winners folded in:

- **Titles & Overlays** both use the **004-A list + detail form** pattern (both `TitleEditor` and
  `OverlayEditor` are list-based in the real code — the Titles tab carries a count of 2). Overlays add
  the `Capa: Detrás/Delante` toggle (D-03).
- **Subtitles** has no list; it leads with the **005-C condensed/expanding textarea** (D-10), then the
  same Estilo/Avanzado form.
- Shared atoms throughout: 003-B presets, 002-A sections, 001-D two-column shell.

Switch tabs and watch whether it reads as **one coherent panel** or three different screens.

## How to View
open .planning/sketches/006-all-three-tabs-coherence/index.html

## Variants
- **A ★ (default): 2-column (desktop)** — the locked 001-D layout. The form portion of every tab lays
  out in the two-column grid; list (Titles/Overlays) and textarea (Subtitles) are full-width above the
  form. The consistent rule: *lists and the textarea span full width; the Posición/Estilo/Avanzado form
  is always 2-col.*
- **B: Single-column (responsive collapse)** — the same three tabs with the 2-col grid collapsed to one
  column (narrower preview + metadata), exercising the **responsive note** from the 001-D findings
  ("collapse `.ctrl-2col` to one column below a width breakpoint"). Verifies the pattern degrades
  gracefully, not just that it works at desktop width.

## Winner: A — rationale
**2-column (desktop) holds.** The three tabs cohere as one panel: the consistent rule — *lists
(Titles/Overlays) and the sample-text textarea (Subtitles) span full width above the form; the
Posición/Estilo/Avanzado form is always the 001-D two-column grid* — reads as deliberate, not drifty.
Titles and Overlays sharing the 004-A list+form pattern lands as intentional symmetry rather than
redundancy. Variant B (single-column) is **kept as the documented responsive-collapse behavior** below
the width breakpoint, not as the primary desktop layout. No rework needed — the 002 generalization
claim is confirmed against the real tab content.

Real-build rule: full-width breakouts = `{ Titles list, Overlays list, Subtitles textarea }`; the
form grid is `.ctrl-2col`, collapsing to one column under the breakpoint (variant B).

## What to Look For
- **Switch all three tabs in each variant.** Does the section rhythm, header style, and row cadence stay
  identical? Any tab feel like a different UI?
- **Titles vs Overlays:** they now share the exact list+form pattern — does that read as deliberate
  symmetry, or does the Titles list feel redundant (do users expect a single title)?
- **Subtitles transition:** going from a list tab (Titles/Overlays) to the textarea-led Subtitles tab —
  is the absence of a list jarring, or clearly "this one's different and that's fine"?
- **Responsive collapse (B):** at single-column width, is the panel still scannable, or does it become a
  long scroll that argues for keeping more on screen? Confirms the real-build breakpoint behavior.
- **Live preview:** the title text and overlay layering update from the active tab/selection — the
  composed result of 004 + 005 + 001/002/003 in one place.
