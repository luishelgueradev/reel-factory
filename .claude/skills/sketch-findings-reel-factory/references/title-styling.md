# Title Styling (dense controls)

How the **Titles** detail form handles its real `TitleStyleProps` field set without becoming a wall —
the title-side parallel to `references/subtitle-styling.md`. Read that first: this reference proves the
**same 011-C vocabulary transfers to titles**, so the two tabs are deliberately built from one kit.

Titles live in a **list + detail form** (004-A, see `references/tab-patterns.md`); this is that detail
form under stress against the full schema.

## Design Decisions

### The real field set (from `pipeline-config.ts` `TitleStyleProps`)
A title is structurally **different in kind** from a subtitle — it is a **boxed text card**, and it has
an **entrance animation**:
- **Texto:** `text`, `titleFontFamily` (26 fonts), `titleFontSize`, `fontWeight` (bool), `fontStyle`
  (italic bool), `lineHeight`
- **Caja *(title-only)*:** `backgroundColor`, `padding`, `borderRadius` (default **12**), plus the
  `titleColor`/`textColor` pairing. Subtitles have **no** container box.
- **Entrada *(title-only)*:** `entranceAnimation` — `slide-up` / `slide-down` / `fade-in` / `none`. The
  single highest-leverage stylistic choice for a title.
- **Efecto:** `outerGlow` {color, intensity, softness} — shared with subtitles.
- **Posición / Tiempo:** `x`, `y`, `startTimeMs`, `durationMs`.

### Specimen + entrance preset cards (sketch 014-C — winner)
Mirror 011-C exactly so Titles and Subtitles read as *the same panel for a different element*:

1. **Full-width in-panel specimen** showing the **boxed** title live (background + padding + radius +
   text color) — not the bare caption the subtitle specimen shows. Seeing the box render makes the Caja
   controls self-explanatory; the box *is* the thing being styled.
2. **Entrance-animation preset cards** promoted above the form (`Slide ↑ / Slide ↓ / Fade / Ninguna`) —
   the title analog of subtitle layout-mode cards. `entranceAnimation` is the title's signature choice,
   so it gets cards, not a buried `<select>`.
3. **2-col form** below: a **1×2 Texto/Caja color pairing** (the color-matrix reduced to two roles,
   since a title has text + box where a subtitle had up to four), and a **collapsible Glow effect-row**.

**Vocabulary transfer (the load-bearing finding):** `mode-cards → entrance-cards`,
`color-matrix → box/text pairing`, `effect-rows → glow`. The kit generalizes with no new affordances —
build one set of components (`<PresetCards>`, `<Specimen>`, `<ColorRolePair>`, `<EffectRow>`) and both
the Titles and Subtitles detail forms compose from it.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### In-panel specimen — renders the BOXED title (014-C)
```css
.specimen { position: relative; border-radius: var(--r-md); margin-bottom: var(--s-8); overflow: hidden;
            background: linear-gradient(180deg, oklch(0.30 0.04 255), oklch(0.20 0.03 270));
            border: 1px solid var(--border); min-height: 104px;
            display: grid; place-items: center; padding: var(--s-10) var(--s-8); }
.specimen .sp-tag { position: absolute; top: 7px; right: 9px; font-size: var(--t-2xs);
                    color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.07em; }
/* .pv-titlebox inside is the live boxed title: backgroundColor + padding + borderRadius + titleColor */
```

### Entrance-animation preset cards (014-C — title analog of subtitle layout-mode cards)
```css
.modecards { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-4); margin-bottom: var(--s-8); }
.modecard  { padding: var(--s-5) var(--s-3) var(--s-4); background: var(--surface);
             border: 1px solid var(--border); border-radius: var(--r-sm); cursor: pointer; text-align: center;
             transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease); }
.modecard:hover { border-color: var(--border-strong); }
.modecard.on    { border-color: var(--accent-strong); background: var(--accent-tint-2); }  /* blue = selected */
.modecard .mc-vis { height: 30px; border-radius: var(--r-xs); background: var(--stage);
                    display: grid; place-items: center; margin-bottom: var(--s-4); font-size: 15px; color: var(--accent); }
.modecard .mc-nm  { font-size: var(--t-2xs); color: var(--text-2); font-weight: 600; }
.modecard.on .mc-nm { color: var(--accent); }
```
The glyphs carry the meaning: `↑` Slide-up, `↓` Slide-down, `◍` Fade, `∅` Ninguna.

### Collapsible Glow effect-row (shared with subtitles — `.fx`)
```css
.fx { border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface);
      margin-bottom: var(--s-5); overflow: hidden; transition: border-color var(--dur) var(--ease); }
.fx.open { border-color: var(--border-strong); }
.fx-head { display: flex; align-items: center; gap: var(--s-5); padding: var(--s-5) var(--s-6); cursor: pointer; }
.fx-params { display: none; padding: 0 var(--s-6) var(--s-6); }   /* params hidden until the switch is on */
.fx.open .fx-params { display: block; }
.fx.open .switch { background: var(--accent-tint); border-color: var(--accent-strong); }
.fx.open .switch::after { transform: translateX(13px); background: var(--accent); }
```

## HTML Structures

### Titles detail form — specimen + entrance cards, then the 2-col form (014-C)
```html
<!-- list lead (Títulos card list) sits above, per tab-patterns.md -->
<div class="specimen fullbleed"><span class="sp-tag">vista en vivo</span><div class="pv-titlebox" data-spec></div></div>
<div class="sec fullbleed"><div class="sec-h">Animación de entrada</div>
  <div class="modecards">
    <div class="modecard on" data-anim><div class="mc-vis">↑</div><div class="mc-nm">Slide ↑</div></div>
    <div class="modecard" data-anim><div class="mc-vis">↓</div><div class="mc-nm">Slide ↓</div></div>
    <div class="modecard" data-anim><div class="mc-vis">◍</div><div class="mc-nm">Fade</div></div>
    <div class="modecard" data-anim><div class="mc-vis">∅</div><div class="mc-nm">Ninguna</div></div>
  </div>
</div>
<div class="editing-head"><span class="t">Título · …</span></div>
<div class="ctrl-2col">
  <div class="colwrap">
    <div class="sec"><div class="sec-h"><span class="num">1</span>Tipografía</div> … font grid · tamaño · Reg/Bold/It … </div>
    <div class="sec"><div class="sec-h"><span class="num">3</span>Posición</div> … X/Y · 9-point presets … </div>
  </div>
  <div class="colwrap">
    <div class="sec"><div class="sec-h"><span class="num">2</span>Caja &amp; color</div>
      <div class="cmatrix">  <!-- 1×2 role pairing: Texto + Caja -->
        <div class="crole"><span class="cswatch"><input type="color" value="#ffffff" data-textcolor></span><span class="rl">Texto</span></div>
        <div class="crole"><span class="cswatch"><input type="color" value="#1a1a2e" data-boxcolor></span><span class="rl">Caja</span></div>
      </div>
      … padding · radio (radius) sliders …
    </div>
    <div class="sec"><div class="sec-h">Efectos <span class="note">· opcionales</span></div>
      <div class="fx" data-fx>…Glow switch + params…</div>
    </div>
  </div>
</div>
```

## What to Avoid
- **014-A flat-orthodox (~16 rows):** the real title field count tips into the **same wall** flat
  subtitles hit in 011-A. Confirms specimen + cards (C) is the right call for *both* elements.
- **Entrance animation in a `<select>` (014-A):** buries the title's highest-leverage choice. It earns
  preset cards.
- **Don't invent title-only affordances for box + entrance.** They reuse the subtitle kit
  (cards / matrix / effect-rows). 014-B's heavier "Caja as its own collapsible cluster" treatment was a
  valid runner-up but the C transfer is cleaner and keeps one component set across both tabs.
- **Don't drop the box from the specimen.** A title's box (bg/padding/radius) is invisible on a bare
  text specimen — the boxed render is what makes Caja controls legible.

## Origin
Synthesized from sketch 014 (title-style-density, winner C). Builds on 011-C
(`references/subtitle-styling.md`). Source file in `sources/014-title-style-density/` (winner `#v-c`,
marked ★ in the variant nav). Real schema: `TitleStyleProps` in `pipeline-config.ts`.
