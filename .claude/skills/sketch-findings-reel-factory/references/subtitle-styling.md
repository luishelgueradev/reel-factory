# Subtitle Styling — Control Composition for the Dense Caption Field

How the **Subtitles Estilo/Avanzado controls** are organized when the *full real caption schema* is
present (~20 fields), and where the styling is previewed. This is the density stress-test sketch 002
anticipated. It refines the shell-level tab structure in `tab-patterns.md` (read that first) with the
control-level composition specific to the styling surface.

## The real caption schema (ground truth)

These are the actual fields from `services/remotion-studio/src/pipeline-config.ts`
(`SubtitleConfig` + `DEFAULT_SUBTITLE_CONFIG`). The mockup uses these names/defaults, not generic
placeholders. **Build against this list, not the simplified 5-control Estilo shown in 005/006.**

- **Tipografía:** `fontFamily` (26 fonts, default `PlusJakartaSans` — see `src/fonts.ts`
  `AVAILABLE_FONTS`), `fontSize` (24–200, default 58), `fontWeight` (bool → 400/700, *Phase 19*),
  `fontStyle` (bool → normal/italic, *Phase 19*), `letterSpacing` (−1…20), `lineHeight` (0.8–3.0,
  default 1.3)
- **Color (4 roles):** `activeColor` (#FFFF00), `inactiveColor` (#FFFFFF), `highlightColor`
  (#FFFFFF, the ephemeral flash on word activation), `outlineColor` (#000000) + `outlineWidth` (0–10)
- **Efectos (*Phase 19*):** `outerGlow` `{enabled, color, intensity 0–1, softness 0–60px}` →
  `textShadow`; `backgroundHighlight` `{enabled, color, padding 0–32, borderRadius 0–24}`
- **Ritmo / modo:** `layout` (`tiktok` | `sentence` | `bar` | `karaoke`), words-per-page,
  `highlightTransition` (`fade` | `instant`), `highlightDurationMs` (0–500, default 200),
  `pastWordOpacity` (0–1, default 0.4)
- **Posición:** `position` (`bottom-center` | `top-center` | `center-screen`), `bottomOffset`
  (0–960, default 250), `subtitleWidth` (0=auto…1080)

> Sketch 005/006 showed a deliberately simplified Estilo. 011 is the authoritative density target.

## Design Decisions (sketch 011, winner C — specimen + layout-mode presets)

### Layout-mode is a preset-card row, NOT a dropdown — and it leads the section
The `layout` mode (tiktok / barra / frase / karaoke) is the **highest-leverage caption decision**: it
bundles a whole highlight behavior. Promote it to a **4-up row of picture-cards above the form**, each
card previewing its behavior. Selecting a mode sets sensible defaults for that family; the fine
controls below then override. A/B buried `Modo` in an Avanzado dropdown — that hides the one control
you reach for first.

### Lead with an in-panel live specimen
A small caption specimen rendered from the current style + sample text sits at the top of the section
(below the textarea, above/with the mode cards). Even though the full phone preview is right there,
the at-the-controls specimen keeps cause-and-effect in one glance while dragging size / picking colors
— no eye ping-pong to the far preview. It's the in-panel echo of the 007-A "preview as editing
surface" instinct. Cheap to cut (the phone preview exists), but validated as worth keeping.

### 2×2 color-role matrix, not four stacked color rows
The four color roles (activo / inactivo / resalte / borde) read far better as a **2×2 matrix** of
swatch + label than as four sequential `.row`s. Native `<input type=color>` sits behind a styled
`.cswatch`; a mono hex/rgba readout (`.chex`) names the value. `outlineWidth` stays a normal range row
below the matrix.

### Effect-rows collapse when off (disclosure *inside* always-open)
`outerGlow` and `backgroundHighlight` each render as a **single switch line** when disabled; toggling
the switch reveals their params inline. This is disclosure *within* an always-open section — and is
**not** a contradiction of 002 (which rejected collapsible *sections*). The distinction: an effect is
genuinely binary on/off, so the collapsed state carries real information ("this effect is off"); a
section is always relevant, so hiding it only cost scannability. Off effects cost one row, not a block.

### Coherence holds (006-A)
The textarea, the specimen, and the mode-card row are the **full-width lead elements**; the
Tipografía/Posición/Color/Efectos form stays the **2-col grid**. The tab still reads as the same panel
as Titles/Overlays.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`. The `.sec`/`.row`/`.seg`/`.rng`/
`.pgrid`/`.fontgrid` atoms are the same as `control-panel-density.md`.

### Layout-mode preset cards
```css
.modecards { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-4); margin-bottom: var(--s-8); }
.modecard  { padding: var(--s-5) var(--s-3) var(--s-4); background: var(--surface);
             border: 1px solid var(--border); border-radius: var(--r-sm); cursor: pointer; text-align: center;
             transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease); }
.modecard:hover { border-color: var(--border-strong); }
.modecard.on    { border-color: var(--accent-strong); background: var(--accent-tint-2); }   /* selection = blue */
.modecard .mc-vis { height: 30px; border-radius: var(--r-xs); background: var(--stage);
                    display: grid; place-items: center; margin-bottom: var(--s-4); overflow: hidden; }
.modecard .mc-nm  { font-size: var(--t-2xs); color: var(--text-2); font-weight: 600; }
.modecard.on .mc-nm { color: var(--accent); }
```
Each `.mc-vis` holds a tiny rendition of the mode's highlight (active word colored, a filled bar for
`bar`, etc.) so the card previews behavior, not just a name.

### In-panel specimen
```css
.specimen { position: relative; border-radius: var(--r-md); margin-bottom: var(--s-8); overflow: hidden;
            background: linear-gradient(180deg, oklch(0.30 0.04 255), oklch(0.20 0.03 270));
            border: 1px solid var(--border); min-height: 96px; display: grid; place-items: center;
            padding: var(--s-10) var(--s-8); }
.specimen .sp-cap { font-weight: 800; font-size: 26px; line-height: 1.18; text-align: center; }   /* re-rendered from live style */
.specimen .sp-tag { position: absolute; top: 7px; right: 9px; font-size: var(--t-2xs);
                    color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.07em; }
```

### 2×2 color-role matrix + swatch picker
```css
.cmatrix  { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-5) var(--s-6); }
.crole    { display: flex; align-items: center; gap: var(--s-4); padding: var(--s-3) 0; }
.crole .rl { font-size: var(--t-xs); color: var(--text-2); flex: 1; min-width: 0; }

.cswatch  { position: relative; width: 26px; height: 26px; flex: none; border-radius: var(--r-sm);
            border: 1px solid var(--border-strong); overflow: hidden; cursor: pointer; }
.cswatch input[type=color] { position: absolute; inset: -4px; width: calc(100% + 8px); height: calc(100% + 8px);
            border: none; padding: 0; background: none; cursor: pointer; }   /* native picker, styled as a swatch */
.chex     { font-family: var(--mono); font-size: var(--t-xs); color: var(--text-2);
            text-transform: uppercase; letter-spacing: 0.03em; }
```

### Collapsible effect-row
```css
.fx        { border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface);
             margin-bottom: var(--s-5); overflow: hidden; transition: border-color var(--dur) var(--ease); }
.fx.open   { border-color: var(--border-strong); }
.fx-head   { display: flex; align-items: center; gap: var(--s-5); padding: var(--s-5) var(--s-6); cursor: pointer; }
.fx-head .fx-name { font-size: var(--t-sm); color: var(--text); flex: 1; font-weight: 500; }
.fx-head .fx-hint { font-size: var(--t-2xs); color: var(--text-faint); }   /* "apagado" / "activado" */
.switch    { position: relative; width: 30px; height: 17px; border-radius: var(--r-full);
             background: var(--surface-hover); border: 1px solid var(--border-strong); flex: none;
             transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease); }
.switch::after { content: ""; position: absolute; top: 1px; left: 1px; width: 13px; height: 13px;
             border-radius: 50%; background: var(--text-2);
             transition: transform var(--dur) var(--ease), background var(--dur) var(--ease); }
.fx.open .switch        { background: var(--accent-tint); border-color: var(--accent-strong); }
.fx.open .switch::after { transform: translateX(13px); background: var(--accent); }
.fx-params { display: none; padding: 0 var(--s-6) var(--s-6); }
.fx.open .fx-params { display: block; }
```

### Range row with value bubble (used heavily here — size, glow, offsets)
```css
.rng { display: grid; grid-template-columns: 1fr 42px; align-items: center; gap: var(--s-5); }
.rng output { font-size: var(--t-xs); color: var(--text-2); font-variant-numeric: tabular-nums; text-align: right; }
```
Wire `oninput` to write the live value into `<output>`; map the `lineHeight` range (80–200) to a
displayed `1.x`.

### Font picker (stand-in — needs a real picker in the build)
The `.fontgrid` 2-up cards with a `+ N fuentes` overflow line is a **stand-in**. 26 fonts with live
previews is its own problem: the real build needs a searchable/scrollable picker (each option set in
its own face), not 4 cards. Flagged as an open sub-problem (candidate for its own sketch).

## HTML Structure (winner C, the styling section)
```html
<!-- full-width lead elements (coherence rule) -->
<textarea class="ta">…sample text…</textarea>
<div class="specimen fullbleed"><span class="sp-tag">vista en vivo</span><div class="sp-cap" data-cap></div></div>
<div class="sec fullbleed"><div class="sec-h">Modo de subtítulo</div>
  <div class="modecards"> …4 .modecard, each with a .mc-vis behavior preview… </div>
</div>

<!-- the 2-col form -->
<div class="ctrl-2col">
  <div class="colwrap">
    <div class="sec"><div class="sec-h"><span class="num">1</span>Tipografía</div>
      <div class="fontgrid">…+ 22 fuentes</div>
      … Tamaño (rng) · Estilo (Reg/Bold/It seg) · Espaciado (rng) …
    </div>
    <div class="sec"><div class="sec-h"><span class="num">3</span>Posición</div> … Lugar seg · 9-pt pgrid · Ancho … </div>
  </div>
  <div class="colwrap">
    <div class="sec"><div class="sec-h"><span class="num">2</span>Color</div>
      <div class="cmatrix"> …4 .crole (activo/inactivo/resalte/borde)… </div>
      … Borde px (rng) …
    </div>
    <div class="sec"><div class="sec-h">Efectos · opcionales</div>
      <div class="fx"> Glow → switch + collapsed params </div>
      <div class="fx"> Fondo → switch + collapsed params </div>
    </div>
  </div>
</div>
```

## What to Avoid
- **A — flat orthodox (~20 stacked `.row`s):** confirmed the *wall*. At full schema density,
  undifferentiated rows scan as noise and the high-value `Modo` control disappears among them. The
  always-open section vocabulary needs **intra-section structure** (sub-labels, matrix, mode cards) to
  survive this field count — flat alone does not.
- **Layout mode as a dropdown** buried in Avanzado — it's the first decision, not a footnote.
- **Four stacked color rows** — use the 2×2 matrix.
- **Always-expanded effect params** for off effects — collapse to a switch line; only `bar`/`karaoke`
  and enabled glow/bg should spend rows.
- **Four-card font "picker"** as the final answer — it's a stand-in; 26 fonts need a real picker.
- **Adding a new chromatic UI color** — four *caption* colors are edited via swatches, but the panel
  chrome stays Restrained: blue = selection (mode card / font card / seg on), green = the single
  primary (Guardar). The caption colors live in swatches, never leak into UI chrome.

## Origin
Synthesized from sketch **011-subtitle-style-density** (winner C). Real fields sourced from
`services/remotion-studio/src/pipeline-config.ts` and `src/fonts.ts`.
Source file: `sources/011-subtitle-style-density/index.html` (variant C marked ★ in the nav).
Builds on `control-panel-density.md` (002-A atoms) and `tab-patterns.md` (005-C/006-A shell).
