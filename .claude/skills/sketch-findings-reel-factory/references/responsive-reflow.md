# Responsive Breakpoint Reflow (dense tabs)

## Design Decisions

**Winner: Sketch 018 variant B — reflow the multi-up grids; keep every section always-open.**

When the controls column collapses to its narrow single-column width (~360px), **reflow the multi-up
grids** rather than cram or hide. Same sections, same order, all single-column — but the grids
**reacomodate** so nothing cramps. **Sketch 002-A's always-open rule stays intact** (no
disclosure-under-pressure). This is **one reflow rule that generalizes to all three tabs** (it's the
composition 015's north-star didn't cover). Lower stakes — this is a desktop-first local studio — but
the rule must be unambiguous so the build applies it consistently.

### The reflow rule (at the narrow breakpoint, ~360px)
| Element | Desktop (2-col) | Narrow (1-col) |
|---------|-----------------|----------------|
| Posición → Estilo → Avanzado **form** | 2-col grid | **1-col** |
| **Mode / entrance cards** (4-up) | 4 across | **2×2** |
| **Font grid** | 2-up | **1-up** (full font name, no truncation) |
| **Color-role matrix** | 2×2 | **stays 2×2** (already compact) |
| Specimen / textarea lead | full-width | full-width (unchanged) |
| Effect-rows (Glow / Fondo) | one switch line, expand on toggle | unchanged |

Key detail: reflowing the mode cards to **2×2** keeps their **behavior-preview thumbnails legible**;
the font grid going **1-up** lets the full font name show instead of truncating ("Plus Jakarta" →
"Plus Jakarta Sans"). The color matrix is already 2×2 and compact, so it doesn't change.

### Why this won
- **Nothing cramps.** Variant A (**literal stack** — 2-col form → 1-col but multi-up grids *unchanged*)
  squeezes 4 mode cards into a 360px row (~70px each, behavior previews unreadable) and truncates font
  names. The cramming is the anti-pattern the reflow fixes.
- **The always-open rule holds everywhere.** Variant C (**priority + disclosure** — only the
  highest-leverage controls stay open, the rest fold behind a "Más ajustes" toggle) **bends 002-A's
  "no collapsible sections" rule** under width pressure. It scans well but trades away rule integrity,
  and "only at the breakpoint" is a slippery slope — once disclosure is allowed under pressure, where
  does it stop? B keeps one rule true at every width.
- **One rule, three tabs.** The same reflow generalizes: Subtítulos (mode cards), Títulos (entrance
  cards), Overlays (the card list) all collapse the same way.

## CSS Patterns

The cleanest expression is grid columns that flip at the breakpoint — same markup, no JS, no hidden
sections. Pair with the `tab-form` / `tab-lead` skeleton from `tab-patterns.md`.

```css
/* the 2-col form collapses to 1-col (006-B) */
.tab-form { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6) var(--s-12); }

/* multi-up grids: desktop defaults */
.mode-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-4); } /* 4-up */
.font-grid  { display: grid; grid-template-columns: 1fr 1fr;        gap: var(--s-4); } /* 2-up */
.color-matrix { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-5) var(--s-6); } /* 2×2 */

/* the reflow: at the narrow breakpoint the multi-up grids reacomodate */
@container controls (max-width: 380px) {     /* or a width media query if not using container queries */
  .tab-form    { grid-template-columns: 1fr; }            /* form → 1-col   */
  .mode-cards  { grid-template-columns: 1fr 1fr; }        /* 4-up → 2×2     */
  .font-grid   { grid-template-columns: 1fr; }            /* 2-up → 1-up    */
  /* .color-matrix stays 1fr 1fr — already compact, no change */
}
```

> Prefer a **container query** on the controls column over a viewport media query — the column's width
> is what's pressured (the 3-column shell can be narrow while the viewport is wide). The real build's
> shell collapses its two internal control columns to one below a width breakpoint (see
> `workspace-shell.md`); this reflow is what happens to the *content* at that same point.

## What to Avoid
- **Literal stacking** (variant A) — leaving 4-up mode cards and 2-up font grids unchanged at 360px;
  the cards shrink to ~70px (behavior previews unreadable) and font names truncate. Cramped =
  anti-pattern.
- **Disclosure-under-pressure** (variant C) — folding "secondary" controls behind a "Más ajustes"
  toggle at narrow width **breaks 002-A's always-open rule**. Don't bend the always-open contract just
  because the column got narrow; reflow instead.
- **A different breakpoint rule per tab** — use one reflow rule that collapses Subtítulos, Títulos, and
  Overlays identically.

## Origin
Synthesized from sketch: 018 (winner B — reflow the multi-up grids)
Extends `tab-patterns.md` (the TabLead/TabForm skeleton) and `workspace-shell.md` (the column collapse
breakpoint); keeps `control-panel-density.md`'s always-open rule (002-A) intact at every width.
Source file available in: sources/018-dense-tabs-at-breakpoint/index.html
