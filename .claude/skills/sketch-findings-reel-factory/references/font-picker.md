# Font Picker (shared component)

## Design Decisions

**Winner: Sketch 016 variant C — a slide-over gallery sheet.**

The font control is **not** a few preset cards (the 4-card stand-in that stood in for it across
sketches 011 and 014). The real control is a **current-font trigger row** that opens a **dedicated
slide-over sheet over the controls column**: search + category chips over a **2-up gallery of cards,
each rendering the sample text in its own live face**, against the real **26-font `AVAILABLE_FONTS`
set** from `services/remotion-studio/src/fonts.ts`. Selection marks the card blue (`--accent`),
commits, and dismisses the sheet. It's a **self-contained shared component** dropped unchanged into
both the Títulos and Subtítulos tabs.

### The trigger row (always visible in the Tipografía section)
A full-width button showing the **current font rendered in its own face** (large specimen text) plus
a small uppercase font name and an "⤢ Explorar" affordance. It is the only font UI in the dense form
— everything else is behind the sheet, so the panel stays calm.

### The sheet
- Slides in from the right **scoped to the controls column** (`position: absolute` inside
  `.controls`, not a full-page modal), behind a local scrim — the preview and metadata columns stay
  visible.
- Header: title + close ✕, then **search** ("Buscar entre 26 fuentes…") and **category chips**:
  `Todas · Sans · Condensada · Display · Serif · Script · Mono`.
- Body: a **2-up grid of gallery cards**. Each card renders the **sample text** ("Subtítulos que
  enganchan") in the font's actual face, with the font name + category. Selected card = blue border +
  `--accent-tint-2` fill + ✓.
- Picking a font: updates the trigger specimen, live-updates the preview caption, then **closes the
  sheet** (selection commits and dismisses).

### Why this won
- **Browsing 26 live specimens needs room.** Variant A (inline expanding scroll-box) pushes the form
  down and competes with the dense controls; variant B (anchored popover) floats but is cramped and
  only fits single-line specimens. The **slide-over is a deliberate detour** that gives the gallery
  enough room to show each font in sample-text size without swamping the panel.
- **Sample-text cards tell you more than font names.** A/B show the font *name* in its face on one
  line; C shows the **actual caption copy** in each face — which is what you're actually deciding
  ("how will this read in a subtitle?").
- **Self-contained = portable.** The sheet is anchored to the controls column and carries its own
  search/filter state, so the same component drops into Títulos and Subtítulos with no layout
  surgery. A's inline box and B's popover both entangle with the surrounding form rows.
- **Selection = blue** upholds the design-system color rule (blue for selection/current, never green).

## Real data the component must drive
The 26 fonts are the real `AVAILABLE_FONTS` set (`src/fonts.ts`), loaded live from Google Fonts.
Each entry is `[displayName, cssFamily, category]`. Categories in play:
`Sans` (majority), `Condensada` (Oswald, Bebas Neue, Antonio), `Display` (Righteous, Titan One),
`Serif` (Playfair Display, Cormorant Garamond), `Script` (Dancing Script), `Mono` (system mono).
Filter = category chip AND case-insensitive name search; show a `Sin resultados` empty state.

## CSS Patterns

```css
/* current-font trigger — renders the selected face inline */
.font-trigger {
  display: flex; align-items: center; gap: var(--s-6); width: 100%; text-align: left;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-sm);
  padding: var(--s-5) var(--s-6); cursor: pointer;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.font-trigger:hover { border-color: var(--border-strong); background: var(--surface-hover); }
.font-trigger.open  { border-color: var(--accent-strong); box-shadow: 0 0 0 3px var(--accent-tint); }
.ft-spec { flex: 1; min-width: 0; font-size: 21px; line-height: 1.1;        /* the live specimen */
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* slide-over sheet — scoped to the controls column (absolute, not fixed) */
.fp-scrim { position: absolute; inset: 0; z-index: 300; background: oklch(0.14 0.02 280 / 0.55);
            backdrop-filter: blur(1.5px); opacity: 0; pointer-events: none;
            transition: opacity var(--dur) var(--ease); }
.fp-scrim.open { opacity: 1; pointer-events: auto; }
.fp-sheet { position: absolute; inset: 0 0 0 auto; z-index: 301; width: min(560px, 100%);
            background: var(--canvas); border-left: 1px solid var(--border-strong);
            box-shadow: var(--shadow-pop); display: flex; flex-direction: column;
            transform: translateX(102%); transition: transform 260ms var(--ease); }
.fp-sheet.open { transform: none; }

/* category chips (shared with search row) */
.fp-chip { font-size: var(--t-xs); color: var(--text-2); background: var(--surface);
           border: 1px solid var(--border); border-radius: var(--r-full); padding: 3px 10px;
           cursor: pointer; transition: all var(--dur) var(--ease); }
.fp-chip.on { background: var(--accent-tint); border-color: var(--accent-strong);
              color: var(--accent); font-weight: 600; }

/* 2-up gallery of sample-text cards */
.fp-gallery { flex: 1; overflow-y: auto; padding: var(--s-8) var(--s-10);
              display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6); align-content: start; }
.fp-gcard  { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md);
             padding: var(--s-8); cursor: pointer; }
.fp-gcard.on      { border-color: var(--accent-strong); background: var(--accent-tint-2); }
.fp-gcard .g-sample { font-size: 25px; line-height: 1.12; /* font-family set per-card to the face */ }
.fp-gcard .g-name   { font-size: var(--t-2xs); text-transform: uppercase; letter-spacing: 0.06em;
                      color: var(--text-muted); }
.fp-gcard.on .g-name { color: var(--accent); }
```

```js
// pick = update trigger specimen + live preview, then dismiss
function pick(name) {
  state.sel = name;
  triggerSpec.style.fontFamily = cssFamily(name) + ", sans-serif";
  previewCaption.style.fontFamily = cssFamily(name) + ", sans-serif";
  close();                       // selection commits and closes the sheet
}
// focus the search box on open; outside-click / scrim / ✕ all close
```

## What to Avoid
- **An inline expanding scroll-box** (variant A) — pushes the dense form down while open and forces
  single-line specimens; the 26 live faces fight the surrounding controls for attention.
- **An anchored popover** (variant B) — floats cleanly but is too cramped to show sample-text cards;
  it's the right register for a small dropdown, not for browsing/comparing 26 faces.
- **Showing the font name in its own face but not the sample copy** — you decide a caption font by how
  the *caption text* reads, not how the word "Inter" reads.
- **A full-page modal** — overkill and breaks the "stays inside the tool" calm; scope the sheet to the
  controls column.

## Origin
Synthesized from sketch: 016 (winner C — slide-over gallery)
Resolves the picker sub-problem flagged in sketch 011 (the 4-card font stand-in).
Source file available in: sources/016-font-picker/index.html
