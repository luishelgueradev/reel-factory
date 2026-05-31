# Workspace Shell & Layout

Phase 22 app-level structure for the Remotion Studio control surface. Validated in sketch 001
(winner **D**).

## Design Decisions

### 3-column workspace, NOT balanced thirds
The workspace is a single horizontal flex row (`.work { display:flex }`) under a fixed 52px header,
with three columns:

1. **Preview stage** — `flex: 0 1 470px` (**content-sized, not flex-grow**)
2. **Controls** — `flex: 1 1 auto` (**grows to fill the freed space**)
3. **Metadata placeholder** — `flex: 0 0 320px` (**persistent, fixed width, never collapses**)

**Why content-size the preview (the key insight):** the 9:16 phone is *height-bounded*
(`aspect-ratio: 9/16; height: min(100%, 640px)`). Giving it `flex-grow` only padded empty dark
space left/right of the phone. Capping it at ~470px hands that real estate to the controls column,
which is the actual work surface. This beat variant A (balanced thirds) and B (preview-dominant).

### Controls grow into TWO internal columns
Because the preview gave up width, each tab's controls lay out in a 2-column internal grid
(`.ctrl-2col`) instead of one tall scroll: **left column = Posición + Avanzado**, **right column =
Estilo**. This is what makes the always-open sections from sketch 002 affordable height-wise.

> **Real-build responsive note:** collapse `.ctrl-2col` to a single column below a width
> breakpoint. The two-column split assumes desktop width.

### Metadata column is a persistent placeholder — do NOT make it collapsible
This phase the metadata column is non-functional ("Metadata de redes — **Próximamente**"). Variant C
tried a collapsible/edge-rail metadata column; collapsing it **reflowed the 2-column controls grid
and read as a "weird effect."** Decision: keep it a fixed 320px column, always visible. It locks the
final layout for the future AI-metadata phase and stays calm. Ghost scaffolding (dashed boxes, line
skeletons, chips, platform tiles) at `opacity: 0.55; pointer-events: none` signals "coming soon"
without looking broken.

## CSS Patterns

```css
/* Shell skeleton */
.work   { flex: 1; display: flex; min-height: 0; }          /* 3-column row */
.stage  { flex: 0 1 470px; background: var(--stage);        /* content-sized preview */
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          border-right: 1px solid var(--border); min-width: 0; }
.controls { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }
.meta   { flex: 0 0 320px; background: var(--chrome);       /* persistent placeholder */
          border-left: 1px solid var(--border); }

/* Height-bounded 9:16 phone — never flex its width */
.phone  { aspect-ratio: 9/16; height: min(100%, 640px);
          border-radius: 18px; overflow: hidden;
          box-shadow: var(--shadow-pop), inset 0 0 0 1px oklch(0.6 0.02 280 / 0.18); }

/* Controls grow into two internal columns; tighter label col inside them */
.ctrl-2col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6) var(--s-12);
             align-items: start; }
.ctrl-2col .row { grid-template-columns: 72px 1fr; }   /* vs 84px in single-column */

/* "Coming soon" ghost metadata */
.soon   { font-size: var(--t-2xs); font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--accent);
          background: var(--accent-tint); padding: 3px 8px; border-radius: var(--r-full); }
.ghost  { opacity: 0.55; pointer-events: none; }
.gh-box { background: var(--surface); border: 1px dashed var(--border-strong);
          border-radius: var(--r-sm); padding: var(--s-6);
          color: var(--text-faint); font-size: var(--t-sm); }
```

## HTML Structure

```html
<header class="hdr">                          <!-- 52px fixed app header -->
  <div class="brand">… Reel Factory Studio …</div>
  <div class="hdr-actions">
    <button class="btn ghost">Render Video</button>   <!-- disabled / próximamente -->
    <button class="btn primary">Guardar config</button> <!-- the ONE green action -->
  </div>
</header>
<div class="work">
  <section class="stage"><div class="phone">…preview…</div></section>
  <section class="controls">
    <div class="tabs">Titles · Overlays · Subtitles</div>
    <div class="ctrl-body"><div class="ctrl-2col">…sections…</div></div>
  </section>
  <aside class="meta">…ghost metadata, "Próximamente"…</aside>
</div>
```

The tab strip (`.tabs`/`.tab`) sits at the top of the controls column only — `Titles · Overlays ·
Subtitles`, active tab marked with the blue accent underline + count badge. The single green
primary button (`Guardar config`) is the only chromatic action; `Render Video` is a disabled ghost
this phase.

## What to Avoid
- **Flex-growing the preview** — wastes width as empty stage around a height-bounded phone.
- **Collapsible metadata column** — collapse animation reflows the controls grid; reads as a glitch.
  Keep it persistent and fixed-width.
- **Single tall scrolling controls column** — once the preview frees width, use two internal columns.
- **Balanced thirds / preview-dominant** — controls are the work surface and should get the room.

## Origin
Synthesized from sketch **001-three-column-shell** (winner D).
Source: `sources/001-three-column-shell/index.html` (variant `#v-d`).
