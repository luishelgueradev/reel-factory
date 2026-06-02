# Resultados — Persistent Library / History

⚠️ **Frontier / scope-expanding** beyond Phase 22 look-polish — but the **033-B activity rail creates the
expectation**, so the shape is settled. The rail lists **Editor · Cola · Resultados** as three persistent
destinations, but **Resultados was only ever drawn as the post-render *takeover moment*** (024-B: "the
finished reel lands here, big and playable"). Click "Resultados" from the rail when you *haven't* just
rendered, and there was no sketch for what's there. For a **repeat-use / batch tool** with a real
`output/` directory, the honest answer is **your past reels** — a browsable library/history. This surface
is the rail's previously-unkept promise.

## Design Decisions

### A — uniform 9:16 gallery grid (winner), with the latest-reel hero grafted from C
The destination is a **gallery of identical 9:16 thumbnail cards** (auto-fill, `minmax(168px, 1fr)`),
hover→play / ⤓ download / ↻ re-render. The familiar browse surface.

**Build-watch (the graft):** A's *own* anti-pattern is that uniform cards read as monotony — it trips the
"identical card grid" SaaS cliché, and nothing distinguishes the most-recent reel. So the winning build is
**A's uniform gallery + C's featured-latest hero**: the freshly-rendered reel sits **big and playable** at
the top (the 024-B takeover as the default landing, `● Recién renderizado`), older reels collapse into the
uniform grid below. This **bridges the takeover moment and the durable library** — arriving here right
after a render still feels like 024-B; arriving later, you browse. (Pure-A monotony and pure-C complexity
both lose; the hybrid honors recency without abandoning the simple grid.)

### The empty state teaches the destination (no welcome-takeover)
`"Todavía no renderizaste ningún reel"` + a dashed 9:16 illustration + one line explaining what lands here
(*descargables, reproducibles y con la metadata por plataforma ya generada*). It frames what the surface
is **for** without a gated onboarding — the same cold-start philosophy as 017-B framed the editor. **The
only green on the whole surface is the empty-state `Ir al editor →` CTA**, because that's the one action
that initiates the render flow.

### Grounded in the real `output/` directory
MP4 filenames (`reel-3-trucos.mp4`), `1080×1920`, durations, sizes, and the **per-platform metadata**
(026-C: TikTok / Reels / Shorts ready-badges) gathered at render time. The metadata reads as
**publish-ready state** carried over from 026-C, not noise. B (file-manager list) even surfaces the total
(`6 reels · 50.8 MB en output/`) and an `📁 Abrir output/` action — honest that this *is* the folder.

### Single-job honesty
**Re-render re-enters the one-at-a-time pipeline** (the `MAX_CONCURRENT_JOBS=1` / Chrome-OOM constraint).
The re-render action carries a quiet `title="Re-render (1 a la vez)"` cue; whether it warns harder or
defers entirely to the queue (030) is a build-time call.

### Green discipline (the named test)
Every **per-reel** action — download / play / re-render — is **accent (blue) or outline**, never green
(the reel already rendered; download isn't the primary creative action). The **only** green is the
empty-state CTA that routes back into the render flow. Confirm no populated row greens.

### B (file-manager list) kept as the management view
One dense row per reel: real filename · title · date · duration · size · per-platform badges · hover
actions (play / download / re-render / locate). Denser, scannable, management-forward — a strong
**alternate view toggle** when the library grows past a screen of cards.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### The shared reel thumbnail (9:16, the visual unit everywhere)
```css
.thumb { border-radius:var(--r-sm); position:relative; overflow:hidden; flex:none; }
.thumb .tt   { position:absolute; top:10%; left:8%; right:8%; text-align:center; font-weight:700;
               background:rgba(0,0,0,.5); color:#fff; border-radius:4px; }     /* baked-in title */
.thumb .cw   { position:absolute; bottom:12%; left:0; right:0; text-align:center; font-weight:800;
               color:#fff; text-shadow:0 1px 4px rgba(0,0,0,.6); }             /* baked-in caption */
.thumb .play { position:absolute; inset:0; display:grid; place-items:center; font-size:22px;
               color:rgba(255,255,255,.9); opacity:0; transition:opacity var(--dur) var(--ease);
               background:oklch(0.1 0.02 280 / 0.25); }
.gcard:hover .thumb .play { opacity:1; }                  /* reveal play on hover */
```

### A — the uniform gallery grid
```css
.grid  { display:grid; grid-template-columns:repeat(auto-fill, minmax(168px, 1fr)); gap:var(--s-10); }
.gcard .thumb { aspect-ratio:9/16; margin-bottom:var(--s-5); }
.gcard .ga { display:flex; gap:6px; margin-top:var(--s-5); opacity:0; transition:opacity var(--dur); }
.gcard:hover .ga { opacity:1; }                           /* per-card actions reveal on hover */
```

### The grafted C hero — featured latest + freshness tag
```css
.feat { display:flex; gap:var(--s-16); margin-bottom:var(--s-14); align-items:flex-start; }
.feat .thumb { width:230px; aspect-ratio:9/16; box-shadow:var(--shadow-md); }
.feat .freshtag { display:inline-flex; align-items:center; gap:6px; font-size:var(--t-2xs);
                  font-weight:700; color:var(--success); background:oklch(0.72 0.14 150 / 0.16);
                  padding:3px 9px; border-radius:var(--r-full); text-transform:uppercase; } /* ● Recién renderizado */
.feat .filecard { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-sm);
                  padding:var(--s-5) var(--s-8); font-family:var(--mono); font-size:var(--t-xs); } /* 📄 name · 1080×1920 · dur · size */
```

### Per-platform ready-badges (026-C carried in)
```css
.pb     { font-size:9px; font-weight:700; padding:1px 6px; border-radius:var(--r-full);
          background:var(--surface-2); color:var(--text-muted); }
.pb.rdy { background:var(--accent-tint); color:var(--accent); }   /* "ready for this platform" — accent, not green */
```

## HTML Structures

### Empty state (shared across variants — teaches without a takeover)
```html
<div class="empty">
  <div class="eill">🎬</div>
  <h2>Todavía no renderizaste ningún reel</h2>
  <p>Cuando termines de editar y le des a Render, tus reels listos para publicar van a vivir acá:
     descargables, reproducibles y con la metadata por plataforma ya generada.</p>
  <button class="btn btn-green">Ir al editor →</button>   <!-- the ONLY green on the surface -->
</div>
```

### Winner build — featured latest hero over the uniform grid/history
```html
<div class="feat">
  <div class="thumb">…9:16 playable…<div class="play">▶</div></div>
  <div class="meta">
    <span class="freshtag">● Recién renderizado</span>
    <h2>3 trucos de edición</h2>
    <div class="filecard">📄 reel-3-trucos.mp4 · 1080×1920 · 1:14 · 9.4 MB</div>
    <div class="factions">
      <button class="btn btn-acc">⤓ Descargar</button>      <!-- accent, not green -->
      <button class="btn btn-out">▶ Reproducir</button>
      <button class="btn btn-out">↻ Re-render</button>      <!-- single-job -->
    </div>
    <div class="metarow"><span class="lbl">Metadata:</span> …TikTok·Reels·Shorts badges… 3/3 listas</div>
  </div>
</div>
<!-- then: .grid of uniform .gcard thumbnails (older reels), or a dense .histrow list -->
```

## What to Avoid
- **Don't ship the pure uniform grid** — A's own warning: identical cards read as monotony and trip the
  "SaaS card-grid" cliché. Graft C's featured-latest hero so the most-recent reel is distinguished and the
  surface bridges the 024-B takeover.
- **Don't green any per-reel action** — download / play / re-render are accent or outline. The reserved
  green appears **only** on the empty-state CTA (it routes into the render flow).
- **Don't hide the single-job constraint** — re-render re-enters the one-at-a-time pipeline; cue it (or
  route to the queue), don't pretend re-renders are instant or parallel.
- **Don't drop the per-platform metadata** — the TikTok/Reels/Shorts ready-badges (026-C) are
  publish-ready state, the payoff of having rendered; keep them legible, not buried.
- **Don't build a welcome-takeover empty state** — teach what the destination is for (017-B idiom), don't
  gate entry behind onboarding.

## Origin
Synthesized from sketch 038 (resultados-library, winner A — uniform gallery; B = file-manager list, C =
featured latest + history). The build grafts **C's featured-latest hero onto A's uniform grid** to avoid
A's self-flagged monotony and bridge the 024-B post-render takeover. Fills the 033-B rail's Resultados
promise; grounded in the real `output/` dir; carries the 026-C per-platform metadata. Source file in
`sources/038-resultados-library/` (winner `#v-a`, ★ in the variant nav; toggle "ver vacío" per variant for
the empty state).
