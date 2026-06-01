# Timeline / Temporal Axis (frontier — scope-expanding)

Where the **time dimension** lives in the 001-D shell. Every other reference treats the preview as a
**static phone frame**, but the tool produces a *time-based video*: subtitles run word-by-word, titles
carry `startTimeMs` + `durationMs`. Sketch 020 is the only one that touched the temporal axis. **This is
frontier / scope-expanding — not committed Phase 22.** It most likely lands in a follow-on milestone;
treat it as the validated *direction* for when a timeline is built, not a Phase-22 deliverable.

## Design Decisions

### A strip under stage + controls (sketch 020-C — winner)
Three placements were tried for "where does the playhead live in a 3-column shell":

- **020-A scrubber-under-preview** — a thin scrub bar + transport + an "en pantalla ahora" chip beneath
  the phone. Lightest touch; you *preview* any moment but timing is still edited via the form. *Time is
  previewed, not edited on a track.*
- **020-B full-width multi-track dock** — a real editor timeline docked along the bottom spanning **all
  three columns** (Títulos / Overlays / Subtítulos lanes + gutter + playhead). The heaviest, most
  "video editor."
- **020-C strip under stage + controls (WINNER)** — the middle ground: the timeline sits under the
  **preview + controls only**, while the **metadata column keeps full height** to the right.

**Why C won:** this is a single-talking-head styling tool with auto subtitles, not Premiere. The
full-width dock (B) earns its weight only for a heavier editor; the bare scrubber (A) under-serves
retiming titles/overlays. C gives a **real multi-lane track surface** (scrub-to-preview, drag blocks to
retime) **without** letting the timeline annex the whole shell — the metadata column stays intact, so
the 001-D shell identity survives. The deliberate middle.

### Structural rule — wrap stage+controls so the strip sits under *them*, not under metadata
The key layout move: inside `.work`, **wrap the stage + controls in a flex-column** and put the timeline
dock as that wrapper's last child. The metadata `<aside>` is a **sibling** of that wrapper, so it spans
the full height to the right of both the editor and its strip. This is what makes "under stage+controls,
not under metadata" real in markup.

### Lanes, not cards
The timeline is a **multi-lane track surface** (Títulos / Overlays / Subtítulos coverage), explicitly
**not** a card grid — the panel's card vocabulary stops at the timeline edge. It reads as a calm part of
the dark chrome (`--chrome` dock, hairline lane separators, a single high-contrast playhead). Auto-zoom
had a 4th "⚡" lane in the original sketch; it was **removed** when emphasis-zoom was dropped (see
`references/video-effects.md`) — the timeline now carries **three** lanes only.

### Relationship to per-title timing (022)
Sketch 022's numeric Aparece/Dura rows are the **local** timing control; 020-C is the **global** one.
The decided division of labor (see `references/title-styling.md`): the **global timeline does visual
placement** (scrub, drag-to-retime), **numeric rows refine**. One timeline idiom — do **not** also build
a per-title mini-track (022-A/C), which would create two competing timelines.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### The dock + lane grid (020-C)
```css
.tl-dock  { flex: none; background: var(--chrome); border-top: 1px solid var(--border-strong); }
.tl-bar   { display: flex; align-items: center; justify-content: space-between; padding: var(--s-5) var(--s-10); }
.tl-bar .ttl { font-size: var(--t-2xs); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
               color: var(--text-muted); display: flex; align-items: center; gap: var(--s-5); }
/* gutter (track labels) + lanes, side by side */
.tl-grid   { display: grid; grid-template-columns: 92px 1fr; }
.tl-gutter { border-right: 1px solid var(--border); }
.tl-gutter .glabel { height: 26px; display: flex; align-items: center; gap: var(--s-3);
                     padding: 0 var(--s-8) 0 var(--s-10); font-size: var(--t-2xs); color: var(--text-2);
                     border-top: 1px solid var(--border-faint); }
.tl-gutter .glabel .sw { width: 8px; height: 8px; border-radius: 2px; flex: none; }  /* lane color swatch */
.tl-lanes  { position: relative; overflow: hidden; }
.ruler     { height: 20px; display: flex; border-bottom: 1px solid var(--border-faint); }
.ruler .tk { flex: 1; border-left: 1px solid var(--border-faint); font-size: 9px; color: var(--text-faint);
             padding: 3px 0 0 4px; font-variant-numeric: tabular-nums; }
.lane      { height: 26px; border-top: 1px solid var(--border-faint); position: relative; }
/* a block on a lane = an element's on-screen window; left/width are % of clip */
.blk       { position: absolute; top: 4px; bottom: 4px; border-radius: var(--r-xs); font-size: 9px;
             font-weight: 700; display: flex; align-items: center; padding: 0 6px; overflow: hidden;
             white-space: nowrap; cursor: grab; }
.blk.title { background: var(--accent); color: oklch(0.18 0.03 250); }   /* titles = the accent lane */
.blk.ov    { background: linear-gradient(135deg, #ffd36e, #ff9e5e); }    /* overlays carry their thumb hue */
.blk.sub   { background: var(--surface-hover); color: var(--text-2); border: 1px solid var(--border); }  /* subtitle coverage */
/* one high-contrast playhead with a flag cap */
.playhead          { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--text); z-index: 9; pointer-events: none; }
.playhead::before  { content: ""; position: absolute; top: -1px; left: -5px; width: 12px; height: 7px; border-radius: 2px; background: var(--text); }
.tl-scrub          { -webkit-appearance: none; width: 100%; height: 4px; border-radius: var(--r-full); background: var(--surface-hover); }
.tl-scrub::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--text); cursor: pointer; }
```

## HTML Structures

### The "under stage+controls, full-height metadata" layout (020-C)
```html
<div class="shell"><div class="work">
  <!-- wrap left+center so the strip sits under THEM, not under metadata -->
  <div style="flex:1 1 auto; display:flex; flex-direction:column; min-width:0;">
    <div style="flex:1; display:flex; min-height:0;">
      <section class="stage">…phone + transport…</section>
      <section class="controls">…tabs + ctrl-body…</section>
    </div>
    <div class="tl-dock">
      <div class="tl-bar"><span class="ttl">▤ Tiempo · 0:10</span><button class="tl-collapse">Ocultar ⌄</button></div>
      <div class="tl-grid">
        <div class="tl-gutter"><div class="ruler-sp"></div>
          <div class="glabel"><span class="sw" style="background:var(--accent)"></span>Títulos</div>
          <div class="glabel"><span class="sw" style="background:#ffb36e"></span>Overlays</div>
          <div class="glabel"><span class="sw" style="background:var(--surface-hover)"></span>Subtítulos</div>
        </div>
        <div class="tl-lanes">
          <div class="ruler"><span class="tk">0:00</span>…<span class="tk">0:08</span></div>
          <div class="lane"><div class="blk title" style="left:20%;width:30%">Oferta por hoy</div></div>
          <div class="lane"><div class="blk ov" style="left:0;width:100%">logo-marca.png</div></div>
          <div class="lane"><div class="blk sub" style="left:2%;width:96%">subtítulos · auto</div></div>
          <div class="playhead" style="left:0"></div>
        </div>
      </div>
      <div class="tl-scrub-wrap"><input type="range" class="tl-scrub" min="0" max="100" value="0"></div>
    </div>
  </div>
  <aside class="meta"><!-- full height, NOT above the strip -->…Próximamente…</aside>
</div></div>
```

## What to Avoid
- **020-B full-width dock spanning all three columns:** turns a styling tool into a video editor it
  doesn't need to be, and lets the timeline annex the metadata column. Reserve for if/when the tool
  genuinely grows into multi-clip editing.
- **020-A scrubber-only:** fine for *previewing* a moment, but you can't retime titles/overlays on a
  track — under-serves the temporal editing the tool actually wants.
- **A per-title mini-timeline (022-A/C) in addition to this global one** — two timeline idioms. Pick the
  global strip; keep per-title timing numeric (`references/title-styling.md`).
- **Card vocabulary inside the timeline** — it's a track surface; don't wrap lanes/blocks in the panel's
  card chrome.
- **A 4th auto-zoom lane** — emphasis-zoom was dropped; the timeline carries three lanes only.

## Origin
Synthesized from sketch 020 (timeline-scrubber, winner C — strip under stage+controls). **Frontier /
scope-expanding** — likely next-milestone, not committed Phase 22. Pairs with per-title timing
(`references/title-styling.md`, 022-B) and the dropped-zoom decision (`references/video-effects.md`).
Source file in `sources/020-timeline-scrubber/` (winner `#v-c`, marked ★ in the variant nav).
Real schema: `TitleConfig.startTimeMs` / `durationMs` in `pipeline-config.ts`.
