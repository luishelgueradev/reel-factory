# Per-Tab Structure & Coherence

How each control tab (Titles / Overlays / Subtitles) is built inside the 001-D shell, and the rule
that keeps all three reading as **one panel** rather than three screens. This builds directly on the
already-validated section vocabulary (`references/control-panel-density.md`) and 9-point presets
(`references/position-presets.md`); read those first.

## Design Decisions

### The coherence rule (sketch 006-A — the load-bearing decision)
The Posición→Estilo→Avanzado **form is always the 001-D two-column grid** (`.ctrl-2col`). Anything
that is *not* the form — the **Titles list, the Overlays list, the Subtitles sample-text textarea** —
spans **full width above the form**. That single rule is what makes the three tabs cohere: the
section rhythm, header style, and row cadence stay identical when switching tabs; only the full-width
"lead" element differs per tab.

- Confirmed against real tab content (not a generic mock) — the sketch 002 generalization claim
  ("must generalize across all three tabs") holds with **no rework**.
- **Titles and Overlays share the exact same list+form pattern** (both `TitleEditor` and
  `OverlayEditor` are list-based in the real code; the Titles tab carries a count of 2). This reads
  as *deliberate symmetry*, not redundancy.
- **Subtitles has no list** — it leads with the textarea, then the same Estilo/Avanzado form. Going
  from a list tab to the textarea-led tab is "this one's different and that's fine," not jarring.
- **Responsive collapse (006-B) is the documented degrade path, not the desktop layout:** below a
  width breakpoint, `.ctrl-2col` collapses to one column (preview + metadata narrow). Kept as
  real-build behavior, never the primary view.

### Overlays — list + detail form (sketch 004-A)
The Overlays tab manages a multi-item list (hard cap **3** = real `MAX_OVERLAYS`) while keeping the
dense form identical to Titles/Subtitles:

- **Card list at the top** — each card: drag-handle · thumbnail · name · `cap × pos` sub-line ·
  **Detrás/Delante badge** · visibility eye. Selecting a card opens the standard
  Posición→Estilo→Avanzado form below. This mirrors the existing `OverlayEditor` (list +
  add/edit/delete) so the migration is the smallest, and keeps the list *separate from* the form so
  the form generalizes cleanly.
- **Layering model (D-03 / D-04):**
  - `Capa: Detrás del texto / Delante` is a **segmented control in the form's Estilo section**, not
    on the card row. It sets the new `layer: "back" | "front"` field, **default `"back"`** (overlays
    sit behind titles/subtitles unless promoted).
  - **Card order = array order = paint order** (D-04). Reorder by dragging the card handle. No
    z-index field.
  - **"Behind text" cue lives in the preview only:** back overlays render slightly dimmed
    (`opacity: 0.85; filter: saturate(0.8)`) as a legibility hint — **not** in the exported render.
- **Cap of 3:** the "Agregar overlay" button disables at 3 with a quiet "Máximo 3" note — clear
  without nagging.

### Subtitles — condensed/expanding sample-text textarea (sketch 005-C)
D-10 removes the standalone "Text" tab and moves the sample-text `<TextareaInput>` to the **top of
the Subtitles tab**. The textarea is the one control much taller than the compact density rows, so it
gets special treatment:

- **Condensed by default to a single line** (`height: 40px; white-space: nowrap; text-overflow:
  ellipsis`), **expanding on focus** to a comfortable multi-line editor (`:focus` → `height: 96px;
  white-space: normal`). Sample text is a *set-once* input — it shouldn't permanently occupy the most
  valuable vertical space above the controls. Collapsed, it keeps the dense Posición→Estilo→Avanzado
  grid front-and-center.
- **Role affordance:** a blue "Alimenta los subtítulos · no se exporta" dot keeps it legible in
  either state — it drives the live preview but is **not** an export/caption-override field.
- Sits full-width above the 2-col grid (per the coherence rule).

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### Overlay card list (004-A)
```css
.ovlist { display: flex; flex-direction: column; gap: var(--s-4); margin-bottom: var(--s-6); }
.ovcard { display: flex; align-items: center; gap: var(--s-5); padding: var(--s-4) var(--s-5);
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm);
          cursor: pointer; transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease); }
.ovcard:hover { border-color: var(--border-strong); background: var(--surface-hover); }
.ovcard.sel  { border-color: var(--accent-strong); background: var(--accent-tint-2); }
.ovcard .drag { color: var(--text-faint); font-size: 15px; cursor: grab; user-select: none; }  /* paint-order reorder */
.ovthumb { width: 34px; height: 34px; border-radius: var(--r-xs); flex: none;
           display: grid; place-items: center; font-weight: 700; }

/* Detrás/Delante badge on the card — back is muted, front is accent */
.lbadge { font-size: var(--t-2xs); font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
          padding: 2px 7px; border-radius: var(--r-full); border: 1px solid var(--border); white-space: nowrap; }
.lbadge.back  { color: var(--text-muted); background: var(--surface-2); }
.lbadge.front { color: var(--accent); background: var(--accent-tint); border-color: var(--accent-strong); }

/* add button respects the cap of 3 */
.addbtn { width: 100%; padding: 9px; border: 1px dashed var(--border-strong); background: transparent;
          color: var(--text-2); border-radius: var(--r-sm); cursor: pointer; }
.addbtn:hover    { border-color: var(--accent-strong); color: var(--accent); }
.addbtn:disabled { opacity: 0.4; cursor: not-allowed; }
.cap-note { font-size: var(--t-2xs); color: var(--text-faint); text-align: center; margin-top: var(--s-3); }
```

The `Capa: Detrás/Delante` toggle in Estilo reuses the standard `.seg` segmented control (see
`control-panel-density.md`); its "on" state is the same blue `.seg button.on { background:
var(--accent-tint); color: var(--accent); }`.

### "Behind text" preview cue (004) — preview only, never exported
```css
.pv-ov.behind { opacity: 0.85; filter: saturate(0.8); }   /* legibility hint that this overlay sits behind the text band */
.pv-ov.sel    { outline: 2px solid var(--accent); outline-offset: 2px; }
```

### Condensed/expanding sample-text textarea (005-C)
```css
.ta { font: inherit; font-size: var(--t-md); line-height: 1.5; color: var(--text);
      background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-sm);
      padding: var(--s-5) var(--s-6); width: 100%; resize: vertical;
      transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.ta:focus { outline: none; border-color: var(--accent-strong); box-shadow: 0 0 0 3px var(--accent-tint); }

/* the winning behavior: set-once, condensed until focused */
.ta.condensed       { min-height: 0; height: 40px; overflow: hidden; cursor: text;
                      white-space: nowrap; text-overflow: ellipsis; }
.ta.condensed:focus { height: 96px; white-space: normal; }

/* role cue: drives preview, not exported */
.ta-meta .drives { display: inline-flex; align-items: center; gap: 5px; color: var(--accent); }
```

### Coherence layout rule (006-A)
```css
.ctrl-2col { /* the form grid — ALWAYS two columns on desktop */ }
/* full-width breakouts sit above .ctrl-2col, spanning the controls width: */
.fullbleed { margin-bottom: var(--s-10); }   /* Titles list / Overlays list / Subtitles textarea */

/* responsive collapse (006-B) — documented degrade, not the desktop view */
@media (max-width: …) { .ctrl-2col { grid-template-columns: 1fr; } }
```

## HTML Structures

### Subtitles tab — textarea-led, then the 2-col form (005-C composed)
```html
<div class="ctrl-body">
  <div class="sec fullbleed">
    <div class="sec-h"><span class="num">✎</span>Texto de muestra
      <span class="hint-inline">enfocá para expandir</span></div>
    <textarea class="ta condensed" rows="1">Cómo edité este reel…</textarea>
    <div class="ta-meta"><span class="drives"><span class="dot"></span>Alimenta los subtítulos</span></div>
  </div>
  <div class="ctrl-2col">
    <div class="colwrap">
      <div class="sec"><div class="sec-h"><span class="num">1</span>Posición</div> … 9-point .pgrid … </div>
      <div class="sec"><div class="sec-h"><span class="num">3</span>Avanzado</div> … words/page, highlight mode … </div>
    </div>
    <div class="colwrap">
      <div class="sec"><div class="sec-h"><span class="num">2</span>Estilo</div> … size/weight/color/highlight + font grid … </div>
    </div>
  </div>
</div>
```

### Overlays tab — full-width card list, then the same form (004-A)
```html
<div class="ctrl-body">
  <div class="ovlist fullbleed">
    <div class="ovcard sel"><span class="drag">⠿</span><div class="ovthumb th-logo">R</div>
      <div class="info"><div class="nm">logo.png</div><div class="sub">64×64 · 540,120</div></div>
      <span class="lbadge front">Delante</span><button class="eye">👁</button></div>
    <!-- …up to 3 cards… -->
  </div>
  <button class="addbtn" disabled>+ Agregar overlay</button>
  <div class="cap-note">Máximo 3 overlays</div>
  <div class="ctrl-2col"> … Posición / Estilo (with Capa segmented) / Avanzado … </div>
</div>
```

## What to Avoid
- **004-B layer-stack band (Photoshop-style):** the most spatial way to show D-03/D-04, but it
  introduces a second metaphor — a fixed "text band" layer — that doesn't otherwise exist in the
  panel. Rejected for everyday use. (Its paint-order-number idea is kept in reserve; see the frontier
  reference.)
- **004-C inline accordion:** packed the layer toggle + ▲▼ reorder onto each overlay row and expanded
  controls inline. Got busy fast and made the form controls feel cramped inside the list rows.
- **005-A full-width banner textarea:** safest and most obvious, but permanently spends prime
  vertical height on a field you rarely re-edit.
- **005-B in-column textarea:** preserved the strict 2-col grid but felt cramped for editing a full
  sentence.
- **Don't put the layer toggle on the overlay card row** — it belongs in the form's Estilo section
  (the card carries only a read-only Detrás/Delante *badge*).
- **Don't carry the back-overlay dim into the exported render** — it's a preview-only legibility cue.
- **Don't make single-column the desktop layout** — it's the responsive-collapse fallback only.

## Origin
Synthesized from sketches: 004 (overlay list & layering, winner A), 005 (subtitles tab restructure,
winner C), 006 (all-three-tabs coherence, winner A). Source files in `sources/004-overlay-list-and-layering/`,
`sources/005-subtitles-tab-restructure/`, `sources/006-all-three-tabs-coherence/` (winners marked ★
in each variant nav).
