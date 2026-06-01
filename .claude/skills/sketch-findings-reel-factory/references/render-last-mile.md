# Render Last-Mile — Output Handoff & Results Screen (frontier)

⚠️ **Scope-expanding / pairs with the AI phase.** Sketch 010 took the render *in-progress* to a "Reel
listo" card and stopped. This finding draws the **last tramo**: where the finished MP4 lands, how you
act on it (download · locate · play · re-render), and the moment the long-dormant metadata column
**wakes up** with the AI caption as the render's true payoff. Closes the core-value loop:
*raw video → edited reel → ready to publish*. Extends `references/render-export-surface.md`.

## Design Decisions

### B — full-screen results takeover (winner): the finished reel earns its own surface
When the render completes it routes to a **dedicated results screen** (replacing the editor's
`.work` body), not a card tucked over the editor:
- The reel is **big and playable** on the left (`.rphone`, ~70vh, a large center play button).
- A right **panel** gathers all deliverables as one "done, time to publish" moment: a check-row
  ("Reel listo · Procesado en 1 m 12 s · Whisper → FFmpeg → Remotion"), the **file card**
  (`reel-final.mp4` · 1080×1920 · H.264 · size · duration · `📁 path · copiar ruta`), the action row
  (**⤓ Descargar MP4** primary + **↻ Render de nuevo**), and the **AI metadata** (título + hashtags).
- Header collapses to a single **‹ Volver al editor** back-link — the cost is acknowledged (it leaves
  the editor; returning is one click), accepted because the pipeline's payoff deserves a real surface.

Chosen over **A** (lighter "done card" on the dimmed stage, editor stays put — extends 010-A) and
**C** (output consolidates into the right metadata column as a "Listo para publicar" deliverables panel,
editor never blocks). B won because the finished reel is the whole point of the tool and earns a
moment, not a corner. **Pairs naturally with 026-C** (per-platform metadata) as the place that metadata
lands.

### The metadata column wakes (drawn in A, the payoff for all variants)
The right column — "Próximamente" in every prior sketch — transitions **asleep → Generado**, animating
in the AI caption (título · descripción · hashtags) with a staggered `wake` keyframe. Turning
render-completion into the moment the AI metadata appears reads as the **right payoff**, not two
unrelated events. (In B this lands on the results panel; in C it lands in the persistent column.)

### Re-render under the single-job constraint
"↻ Render de nuevo" belongs on whichever output surface is shown, and its toast names the constraint
("Re-render encolado (1 job a la vez)") — honoring `MAX_CONCURRENT_JOBS = 1`. The pipeline never
implies parallel renders.

### Green discipline holds
Copy / download / locate / play are all **neutral or accent (blue)** actions. The only green is the
header **Render** CTA when an editing surface is shown. On the results screen there is no green at all
(the render already ran) — `⤓ Descargar MP4` is the `.da.prim` accent (blue) button, never green.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### B — full results takeover layout
```css
.results        { flex: 1; display: flex; align-items: center; justify-content: center;
                  gap: var(--s-16); padding: var(--s-16); overflow-y: auto; }
.results .rphone{ aspect-ratio: 9/16; height: min(70vh, 540px); border-radius: 18px; flex: none;
                  position: relative; overflow: hidden; box-shadow: var(--shadow-pop); display: grid; place-items: center; }
.results .rphone .play-big { width: 64px; height: 64px; border-radius: 50%;
                  background: oklch(0.96 0.01 280 / 0.9); color: var(--stage); display: grid; place-items: center; }
.panel          { width: min(440px, 42vw); }
.back-link      { font-size: var(--t-sm); color: var(--text-2); cursor: pointer; display: inline-flex; gap: 6px; }
```

### File card — the deliverable, findable + actionable
```css
.filecard       { display: flex; align-items: center; gap: var(--s-5); padding: var(--s-6);
                  border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); text-align: left; }
.filecard .ic   { width: 40px; height: 52px; border-radius: var(--r-xs); flex: none; display: grid; place-items: center; }
.filecard .fn   { font-size: var(--t-sm); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.filecard .fmeta{ font-size: var(--t-2xs); color: var(--text-muted); font-family: var(--mono); }  /* 1080×1920 · H.264 · 8.4 MB · 00:42 */
.filecard .loc  { font-size: var(--t-2xs); color: var(--accent); cursor: pointer; }                /* 📁 path · copiar ruta */
.da.prim        { background: var(--accent); color: var(--stage); border-color: transparent; }     /* download = accent, NOT green */
```

### Metadata wake animation (re-triggerable)
```css
@keyframes wake { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
.wakeitem { animation: wake var(--dur) var(--ease) both; }   /* stagger via inline animation-delay: 60/140/220ms */
```
Re-trigger on demand by clearing and restoring `style.animation` after a forced reflow (`void el.offsetWidth`).

## What to Avoid
- **Don't imply parallel renders.** Re-render must surface the single-job queue (`MAX_CONCURRENT_JOBS=1`).
- **Don't green the download/copy/play actions.** Render owns green; output actions are accent/neutral.
- **Don't strand the finished file.** The MP4 must be downloadable *and* locatable on disk (path + copy);
  "Reel listo" with no findable artifact was the gap 010 left.
- **Don't make the results takeover the only path if the user iterates heavily** — B costs the editor;
  A (stage card) / C (right-column) are the lighter fallbacks if build-time UAT shows churn.

## Origin
Synthesized from sketch 024 (render-last-mile, winner B — full results takeover; A = stage done-card +
metadata wake; C = right-column deliverables). Extends `references/render-export-surface.md` (010) and
feeds `references/metadata-ai-column.md` (026). Source file in `sources/024-render-last-mile/`
(winner `#v-b`, marked ★ in the variant nav).
