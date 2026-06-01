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

### The TabLead / TabForm skeleton (sketch 012-B — the coherence rule made buildable)
006's coherence rule was proven on a *simplified* Subtitles. Sketch 012 re-ran it with the **real dense
Subtitles** (011-C: full-width specimen + 4-up mode cards + 2×2 color matrix + collapsible effect-rows)
composed next to the still-lean Titles/Overlays — does the density jump read as "same panel showing
more," or as a different screen? **Winner 012-B: formalize the rule as a named two-slot skeleton every
tab fills.**

- **`tab-lead`** = the full-width lead region. Per tab it holds: Títulos/Overlays → the **card list**;
  Subtítulos → **textarea + specimen + mode cards**. Whatever the tab's full-width content is, it lives
  here, above the form.
- **`ctrl-2col` (TabForm)** = the **always-2-col** Posición/Estilo/Avanzado form, identical skeleton on
  every tab.
- **Finding:** *naming the slot* is what turns the density jump into "same panel, fuller lead" rather
  than "different screen." The dense Subtitles and the lean Títulos read as one panel because they fill
  the **same two slots** — only the lead's contents differ.
- **Build contract:** this hands the React build a literal **`<TabLead>` / `<TabForm>`** pair. Every tab
  is `<TabLead>{full-width content}</TabLead><TabForm>{2-col sections}</TabForm>`. This is the structural
  realization of the 006-A coherence rule — don't reimplement per-tab layout; compose these two.
- 012-A (011-C verbatim, no skeleton) already coheres; B's contribution is making the coherence
  *explicit and reusable*. 012-C (drop the in-panel specimen, lean on the phone preview) is the lighter
  fallback if vertical space gets tight (see `references/subtitle-styling.md`).

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

### Overlays density resolved — list-forward (sketch 019-C — supersedes 004-A's list+form for this tab)
004-A gave Overlays the shared **list + detail form** so it would match Titles/Subtitles. Sketch 019
stress-tested that against the **real `PngOverlayConfig`** — `x` / `y` (px from top-left of 1080×1920),
`displayWidth`, `opacity`, the `Capa: back/front` toggle (D-03), and the 3-overlay cap — and found it a
**genuinely small schema** (5 fields). The question flipped from "does it survive density?" to "does a
deliberately lean tab read as calm or as underfilled next to the dense Titles/Subtitles?" **Winner
019-C: list-forward.**

- **The list is the hero.** Each overlay is a **fat card** carrying its controls **inline**: width and
  opacity sliders, a `Capa: Detrás/Delante` segmented, and an anchor segmented — all on the card. No
  separate detail form below. You manipulate each overlay directly where it lives.
- **Why it won:** with only 5 fields, a separate form felt like ceremony — you'd select a card just to
  edit two sliders in a second place. Inline controls collapse select-then-edit into one gesture and the
  tab reads as *intentionally* lean, not half-built. A short header (`Overlays · controles por ítem ·
  2/3`) names the count; the `＋ Agregar overlay` button still respects the cap of 3.
- **⚠ Consistency caveat (carry to build):** 019-C **departs from the `TabLead`/`TabForm` contract**
  (012-B) that Titles and Subtitles share — there is no 2-col form slot, the controls live in the cards.
  This was a deliberate schema-honest tradeoff (direct manipulation for a tiny schema beat forced
  symmetry). **Revisit at build time:** if the inline-card Overlays tab reads as *off-pattern* next to
  the two `TabLead`/`TabForm` tabs, fall back to **019-A** (lean-by-design: the shared list+form kept,
  just single-column and generously spaced with a footer note explaining why it's short) — that variant
  keeps the contract. 019-C is the chosen direction; 019-A is the named escape hatch.
- Rejected **019-B (enriched parity)**: added an in-form preview, nudge pad, lock-aspect, and fit
  (contain/cover) to bulk the tab up to the others' weight — but **lock-aspect / fit / nudge aren't in
  `PngOverlayConfig`**. Inventing controls that don't map to real render props to manufacture visual
  parity is the anti-pattern; honor the schema instead.

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

### List-forward overlay cards (019-C) — inline controls, no separate form
```css
/* fat card per overlay; controls live inline, not in a detail form below */
.ovc-list { display: flex; flex-direction: column; gap: var(--s-6); }
.ovc      { background: var(--surface); border: 1px solid var(--border);
            border-radius: var(--r-md); padding: var(--s-6); }
.ovc.sel  { border-color: var(--accent-strong); }
.ovc-top  { display: flex; align-items: center; gap: var(--s-5); margin-bottom: var(--s-6); }
.ovc-top .grip  { color: var(--text-faint); cursor: grab; }   /* drag = paint order (D-04) */
.ovc-thumb { width: 52px; height: 52px; border-radius: var(--r-sm); flex: none;
             display: grid; place-items: center; font-size: 10px; font-weight: 800; }
.ovc-name .nm  { font-size: var(--t-md); color: var(--text); }
.ovc-name .sub { font-size: var(--t-2xs); color: var(--text-faint);
                 font-variant-numeric: tabular-nums; margin-top: 2px; }   /* x/y readout */
/* the inline control grid — width / opacity / Capa / anchor, 2-up */
.ovc-inline { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-5) var(--s-8); align-items: center; }
.ovc-inline .lbl { font-size: var(--t-xs); color: var(--text-muted); margin-bottom: 3px; }
```
```html
<div class="ovc-list">
  <div class="ovc sel">
    <div class="ovc-top"><span class="grip">⠿</span><span class="ovc-thumb logo">PNG</span>
      <div class="ovc-name"><div class="nm">logo-marca.png</div><div class="sub">x 64 · y 110</div></div>
      <button class="ov-del">✕</button></div>
    <div class="ovc-inline">
      <div><div class="lbl">Ancho · 92px</div><input type="range" min="24" max="540" value="92"></div>
      <div><div class="lbl">Opacidad · 100%</div><input type="range" min="0" max="100" value="100"></div>
      <div><div class="lbl">Capa</div><div class="seg"><button>Detrás</button><button class="on">Delante</button></div></div>
      <div><div class="lbl">Anclaje</div><div class="seg"><button class="on">↗</button><button>•</button><button>↙</button></div></div>
    </div>
  </div>
  <!-- …up to 3… --><button class="ov-add">＋ Agregar overlay</button>
</div>
```
The `Capa` and anchor segmenteds reuse the standard `.seg` control. **Note this is the off-contract
path** — it has no `.ctrl-2col` form slot; see the consistency caveat above.

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

### The TabLead / TabForm skeleton (012-B) — the two slots every tab fills
```css
/* slot 1: full-width lead. list (Títulos/Overlays) OR textarea+specimen+mode-cards (Subtítulos) */
.tab-lead { margin-bottom: var(--s-10); }
.tab-lead > .sec { margin-bottom: var(--s-8); }
.tab-lead > .sec:last-child { margin-bottom: 0; }
/* slot 2: the form = .ctrl-2col (always 2-col). identical on every tab. */
```
```js
// every tab body is exactly: <TabLead>{leadContent}</TabLead><TabForm>{2-col sections}</TabForm>
function subtitleBody(vk) {                       // Subtítulos lead = textarea + specimen + mode cards
  const lead = `<div class="tab-lead">${subTextarea}${specimenBlock}${modeBlock}</div>`;
  return lead + `<div class="ctrl-2col"><div class="colwrap">${subFormLeft}</div><div class="colwrap">${subFormRight}</div></div>`;
}
function listTabBody(vk, isOv) {                  // Títulos/Overlays lead = the card list
  const lead = `<div class="tab-lead"><div class="listhead">…</div><div class="ovlist">…cards…</div><button class="addbtn">＋ Agregar</button></div>`;
  return lead + editHead + `<div class="ctrl-2col"><div class="colwrap">${form.left}</div><div class="colwrap">${form.right}</div></div>`;
}
```
012-B's sketch makes the skeleton *visible* with dashed `ZONA CABECERA` / `FORMULARIO · 2 columnas`
frames purely to prove the slots are identical across tabs — those frames are a teaching device, not a
shipping treatment.

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
- **019-B enriched parity (invented controls):** lock-aspect / fit (contain·cover) / nudge pad don't
  exist in `PngOverlayConfig`. Don't manufacture controls to bulk a lean tab up to its neighbors' weight
  — honor the schema; lean is fine when the schema is small.
- **Don't force a separate detail form onto the Overlays tab just for symmetry** — with 5 real fields it
  reads as ceremony (select-a-card-to-edit-elsewhere). 019-C puts the controls inline on the card. (But
  do watch the contract tension — 019-A is the fallback if off-pattern bites.)

## Origin
Synthesized from sketches: 004 (overlay list & layering, winner A), 005 (subtitles tab restructure,
winner C), 006 (all-three-tabs coherence, winner A), 012 (subtitle density in shell, winner B — the
`TabLead`/`TabForm` skeleton), 019 (overlays tab density, winner C — list-forward; **supersedes 004-A's
list+form for the Overlays tab**, with 019-A as the contract-preserving fallback). Source files in
`sources/004-overlay-list-and-layering/`, `sources/005-subtitles-tab-restructure/`,
`sources/006-all-three-tabs-coherence/`, `sources/012-subtitle-density-in-shell/`,
`sources/019-overlays-tab-density/` (winners marked ★ in each variant nav).
