# Intro / Outro Home — Where a Dormant Phase-6 Capability Would Live (If Revived)

Phase 6 ("Animated Intros & Outros") shipped parameterized Remotion intro/outro sequences in v1.0 —
but the redesigned 4-tab editor (Títulos · Overlays · Subtítulos · Video) gave them **no config home**,
and the current studio schema (`pipeline-config.json`: `subtitle`, `titles`, overlays) has **no
intro/outro section**. So this sketch answered two questions at once: *if* the capability is revived,
**where does it live** — and does drawing it argue **for or against** reviving it on a talking-head
reel maker?

> ⚠️ **SCOPE-GATED / DORMANT — read before building.** Intro/outro is a *dormant renderer capability*,
> not a live config. This is **not** rehoming a live surface — it's exploring a revival. The sketch is
> also **evidence it may stay cut** as general-editor scope-creep that doesn't fit the "raw talking-head
> → clean reel" core value. **Confirm revival is in scope before building anything here.**

## Design Decisions

### Winner 043-B — timeline endcaps (intro/outro as blocks at the head & tail of the timeline)
Intro/outro are **temporal** (they live at the start and end of the clip), so the honest home is **as
blocks at the head and tail of the timeline strip** (020-C). Tapping an endcap opens its config
(template → text → duration) in the controls panel. This placement:
- reads **"these bookend the video"** — spatially obvious in a way a tab label never is,
- makes the **whole-clip category legible** — endcaps sit *outside* the body track, like transitions
  apply *across* it: both are whole-clip, not per-element,
- needs **no new tab** on the already-full 4-tab bar.

### ⚠️ B depends on the timeline frontier shipping — so it's a layer, not a standalone home
The timeline strip (020-C, `timeline-temporal.md`) is **itself scope-expanding / likely next-milestone**.
Until it ships, B **cannot be the only home**. Therefore:
- **C (Video-tab section) is the fallback host** if intro/outro is revived *before* the timeline exists —
  it's the path of least resistance and groups honestly (the Video tab already holds whole-clip
  transitions; Intro / Transiciones / Outro as sections is the same whole-clip category).
- **A (dedicated 5th tab)** is the heavier alternative — honest but adds a 5th tab (pushes Video right),
  and the per-element tab contract doesn't really fit a whole-clip feature.

The clean reading: **B is a layer on top of C/A**, not a competing standalone. Ship into the Video tab
(C) if revived early; promote to timeline endcaps (B) once the timeline lands.

### The meta-finding: this is also evidence for a *don't-revive* call
Drawing it surfaced the real question. Intro/outro reads like scope **borrowed from a general video
editor**, not core to a talking-head reel maker whose value is "eliminate silences + dynamic subtitles."
Keep this sketch as the **argument on both sides**: *if* revived, B (or C as fallback) is the home; but
the absence of an `intro`/`outro` section in `pipeline-config.json` and the 4-tab editor's silence about
it are themselves signals the feature may stay cut. **Don't build without an explicit revival decision.**

### Whole-clip, not per-element (whichever home wins)
Intro/outro is a **whole-clip** category like transitions — not a per-element style like a title or
overlay. The placement must make that legible: endcaps outside the body track (B), or grouped with
transitions in the Video tab (C). Don't file it among the per-element tabs as if it were one more
styleable element.

## CSS / HTML Patterns

All patterns use the shared tokens in `sources/themes/default.css`. The config form reuses the existing
TabLead/TabForm vocabulary (template cards → text/duration form) — see `tab-patterns.md`.

### Timeline endcaps (B) — intro/outro blocks bracketing the body track
```css
.tlstrip   { flex:none; border-top:1px solid var(--border); background:var(--canvas); padding:var(--s-5) var(--s-8); }
.tltrack   { display:flex; align-items:stretch; gap:4px; height:46px; }
.tlcap     { flex:0 0 84px; border-radius:var(--r-sm); display:flex; flex-direction:column;          /* the endcap block */
             align-items:center; justify-content:center; gap:2px; cursor:pointer; border:1px solid var(--border);
             background:linear-gradient(160deg, oklch(0.3 0.08 295), oklch(0.2 0.04 280)); transition:all var(--dur) var(--ease); }
.tlcap.on  { border-color:var(--accent-strong); box-shadow:inset 0 0 0 1px var(--accent-strong); }    /* selected → config in panel */
.tlcap.add { background:none; border-style:dashed; color:var(--text-muted); }                         /* "+ Outro · añadir" */
.tlmain    { flex:1; border-radius:var(--r-sm); border:1px solid var(--border);                       /* the body track between caps */
             background:repeating-linear-gradient(90deg, oklch(0.27 0.03 280) 0 2px, transparent 2px 5px); }
```
```html
<div class="tltrack">
  <div class="tlcap on"><div class="ct">▸ Intro</div><div class="cd">1.5 s</div></div>
  <div class="tlmain"><div class="lanes">…body lanes…</div></div>
  <div class="tlcap add"><div class="ct">＋ Outro</div><div class="cd">añadir</div></div>   <!-- absent endcap = dashed add -->
</div>
```

### Template cards + the optional-feature toggle (shared by B fallback-C and A)
```css
.tmpl     { border:1px solid var(--border); border-radius:var(--r-sm); padding:var(--s-4); cursor:pointer;
            text-align:center; background:var(--surface); transition:all var(--dur) var(--ease); }
.tmpl.on  { border-color:var(--accent-strong); background:var(--accent-tint); }
.tog      { width:34px; height:19px; border-radius:var(--r-full); background:var(--surface-2); position:relative; cursor:pointer; }
.tog.on   { background:var(--accent-strong); }                                  /* enable intro / outro — accent, never action-green */
.tog i    { position:absolute; top:2px; left:2px; width:15px; height:15px; border-radius:50%; background:#fff; transition:left var(--dur) var(--ease); }
.tog.on i { left:17px; }
.scopeflag{ font-size:var(--t-2xs); color:var(--warning); }                     /* the visible "⚠ depende de la timeline" cue */
```

### The phase label on the stage (which clip-phase the preview is showing)
```css
.stage9x16 .phaselabel { position:absolute; top:8px; left:8px; font-size:8px; letter-spacing:.08em;
                         text-transform:uppercase; color:#fff; background:rgba(0,0,0,.5); padding:2px 6px; border-radius:3px; }
/* e.g. "0:00 · intro" — names the whole-clip phase the stage is previewing */
```

## What to Avoid
- **Don't build this without an explicit revival decision.** It's dormant + scope-gated; the sketch is
  itself evidence it may stay cut as scope-creep on a talking-head tool.
- **Don't make B (timeline endcaps) the only home** — it depends on the timeline frontier (020-C)
  shipping. Use **C (Video-tab section) as the fallback** if revived before the timeline exists.
- **Don't file intro/outro among the per-element tabs** as if it were a styleable element — it's
  **whole-clip** (like transitions). Make that category legible.
- **Don't add a 5th tab** (043-A) unless the dedicated weight is clearly justified — it pushes Video
  right and bends the per-element tab contract.
- **Don't green the enable toggles or template selection** — accent only; Render stays the only green.

## Origin
Synthesized from sketch 043 (intro-outro-home, winner **B** — timeline endcaps; **C = Video-tab section
fallback** when the timeline is deferred, A = dedicated 5th tab the heavier alternative). **Scope-gated:
dormant Phase-6 capability, no `intro`/`outro` in `pipeline-config.json` — confirm revival before
building.** Depends on `timeline-temporal.md` (020-C); the Video-tab fallback relates to
`video-effects.md` (021-A, whole-clip transitions); config form reuses `tab-patterns.md`. Source file in
`sources/043-intro-outro-home/` (winner `#v-b`).
