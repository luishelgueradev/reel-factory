# North-Star v2 — Recomposed Canonical (superseded by v3)

> ⚠️ **Superseded by `north-star-v3.md` (sketch 027).** v2's canonical drawing predates sketch 025 and
> still shows a **frozen** caption specimen; v3 folds in the **live word-by-word preview**. Use v3 as
> the screen the build targets. v2 stays as the pre-live-preview composite and the source of the shell /
> 4-tab / timeline CSS (unchanged in v3). The scope-line and coherence findings below still hold.

The canonical screen *recomposed after the seven decisions 016–022 landed*. **Supersedes
`north-star-composite.md` (sketch 015)** — 015 predated the 4th "Video" tab, the timeline strip,
list-forward overlays, the font slide-over, and numeric title timing, so its composite went stale.
Read every per-area reference first; this one only proves they still cohere as one tool and re-draws
the ship-now / frontier line.

## Design Decisions

### B — committed-scope slice (winner): what ships first
The screen the build targets, with all the **committed** decisions in place and the frontier layers
held back:
- **013-B split-zone header** — warning chip left · Guardar (outline) + Render right, Render the only green.
- **001-D three-column shell**, now with a temporal axis (see shell change below).
- **4-tab bar** — Títulos · Overlays · Subtítulos · **Video**, with Video **pushed right**
  (`margin-left:auto`) so the bar reads as **"per-frame edits ‹—› global effect"**. The thin one-control
  Video tab (021-A) belongs *because* it sits apart, not crammed beside the three dense tabs.
- **List-forward Overlays (019-C)** sit coherently beside the contract-following Títulos/Subtítulos —
  the density difference reads as "same panel, different schema," not drift.
- **Font slide-over (016-C)** opens from the Fuente trigger and lands cleanly over the controls column
  without disturbing the rest of the shell.
- **Numeric title timing rows (022-B)** in the Tiempo section.
- Render is a **ghost** button, the timeline is **collapsed**, the preview is **click-to-select** (the
  cheap 007 subset). A **green committed scope banner** names the boundary.

### A — north star v2 (the aspiration): everything composed
Same shell and 4 tabs, with the three **frontier layers live**: the 020-C **timeline strip** under
stage+controls, **007 drag-to-position** on the preview, and **010 render-on-stage**. The finding: the
whole post-016–022 tool **coheres** — it's one calm professional surface, not a stitched demo.

### The two coherence questions this sketch settled
- **Strip + numeric rows are coordinated, not redundant** — the timeline strip *places* a title block
  visually (where on the clock it appears); the 022-B Tiempo rows *refine* `Aparece`/`Dura`/`Velocidad`
  numerically. "Global places, local refines" — the same split as 020-C / 022-B. Not two competing idioms.
- **The 4-tab bar holds the header rhythm** — Video pushed right earns its place rather than crowding.

### The scope line (unchanged in spirit from 015)
**Ship B first; A's frontier layers (007 drag · 010 render · 020 timeline) bolt on later without rework.**
The A↔B contrast is the plan-split boundary you can point at — exactly the role it played in 015.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### Shell change — work column wraps stage+controls; timeline is a sibling row; metadata keeps full height (020-C)
```css
.work    { flex: 1; display: flex; min-height: 0; }
.leftcol { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; } /* stage+controls + strip */
.topwork { flex: 1; display: flex; min-height: 0; }                               /* stage | controls */
.tl-dock { flex: none; background: var(--chrome); border-top: 1px solid var(--border-strong); }
.tl-dock.hidden { display: none; }   /* committed B collapses it */
.meta    { flex: 0 0 300px; }        /* metadata column is a sibling of .leftcol — spans full height,
                                         the strip does NOT run under it */
```
This is the key structural difference from 015: the timeline strip lives **inside `.leftcol`** below
stage+controls, so the persistent metadata column is never shortened by it.

### 4-tab bar — Video pushed right to read as "per-frame vs global"
```css
.tab.video-tab { margin-left: auto; }   /* the one structural rule that makes the 4th tab belong */
```

### Timeline strip — track surface, gutter lanes, playhead (020-C)
```css
.tl-grid   { display: grid; grid-template-columns: 90px 1fr; }   /* label gutter | lanes */
.lane      { height: 24px; border-top: 1px solid var(--border-faint); position: relative; }
.blk       { position: absolute; top: 4px; bottom: 4px; border-radius: var(--r-xs); cursor: grab; }
.blk.title { background: var(--accent); }            /* selected block: box-shadow 0 0 0 2px var(--text) */
.blk.ov    { background: linear-gradient(135deg, #ffd36e, #ff9e5e); }
.blk.sub   { background: var(--surface-hover); border: 1px solid var(--border); }
.playhead  { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--text); z-index: 9; }
```

### Scope banner — committed (green) vs frontier (blue)
```css
.scope-note.committed { background: oklch(0.72 0.14 150 / 0.10); border: 1px solid oklch(0.72 0.14 150 / 0.3); }
.scope-note.frontier  { background: var(--accent-tint-2);        border: 1px solid var(--accent-strong); }
```

## HTML Structure — the recomposed shell
```html
<div class="work">
  <div class="leftcol">
    <div class="topwork">
      <section class="stage"> …phone + (frontier) transport/drag/render-overlay… </section>
      <section class="controls">
        <div class="tabs">
          <button class="tab sel">Títulos</button>
          <button class="tab">Overlays</button>
          <button class="tab">Subtítulos</button>
          <button class="tab video-tab">Video</button>   <!-- pushed right -->
        </div>
        <div class="ctrl-body"> …per-tab body… </div>
      </section>
    </div>
    <div class="tl-dock hidden"> …timeline strip (frontier; collapsed in committed B)… </div>
  </div>
  <aside class="meta"> …full-height metadata column… </aside>
</div>
```

## What to Avoid
- **Don't run the timeline strip under the metadata column.** It belongs inside `.leftcol` only; the
  metadata column stays full height (the 020-C decision this composite enforces).
- **Don't put Video inline with the three dense tabs.** `margin-left:auto` is what makes it read as
  "global effect" rather than a stub crammed into the row.
- **Don't treat the strip and the Tiempo rows as the same control.** Strip = visual placement, rows =
  numeric refinement. Building one to replace the other loses the "global places / local refines" split.
- **Don't ship A's frontier layers in the committed slice.** B is the planning boundary; A is the target.
- **Don't reference 015 as the current screen** — this v2 supersedes it. 015's reference stays only as
  the historical capstone of the 001–014 era.

## Origin
Synthesized from sketch 023 (north-star-v2, winner B — committed slice; A = the full aspiration).
Recomposes 013-B header, 001-D shell + 020-C timeline placement, 019-C overlays, 016-C font sheet,
021-A Video tab, 022-B numeric timing, plus frontier 007 drag / 010 render. Supersedes
`references/north-star-composite.md` (sketch 015). Source file in `sources/023-north-star-v2/`
(winner `#v-b`, marked ★ in the variant nav).
