# North-Star v4 — Canonical Editor Screen (real editor in the rail shell)

The **current canonical Editor screen**. **Supersedes `north-star-v3.md` (sketch 027)** as the
whole-screen view the real React build targets. 027-B was drawn against the *old header-resident
model* — but sketch 033 moved the brand into a **left activity rail** and made the header
*purely-contextual*, so 027's whole-screen frame went stale (its content is unchanged; its chrome
isn't). v4 composes the **real dense editor** (027-B's content: 025-C live caption + the 011-C dense
Subtitles tab + transport) **inside the 033-B rail shell** and resolves the conflicts that recompose
created. This is the recompose-staleness cadence (015→023→027) now at the **whole-app** level.

It resolved two real *conflicts*, not cosmetics, before the React shell gets built off a stale picture:
the **034-A preset bar** (its old home was beside the brand — now in the rail) and the **035-D `✓3 ✕1`
tally** (its old home was the header Editor⇄Cola vswitch — deleted by the rail).

## Design Decisions

### B — one dense header row (winner): the Linear idiom
The preset takes the **brand's freed left slot** (the brand lives in the rail now), then the content
tabs, then status + Guardar + Render — **all in one header row**:
- `[Estilo ▾ preset] · Títulos · Subtítulos · Overlays · ⟶spacer⟶ · Video · [chip] · Guardar · ▶ Render`
- **The "Video pushed right" idiom survives** the one-row layout: Títulos/Subtítulos/Overlays group
  left after the preset, `Video` sits after the spacer (still reads "per-frame vs global").
- Densest of the three, the Linear idiom. The named risk: the row carries a lot — watch it at build
  against real label widths before committing over A's calmer two-row split.

### A saved look is EDITOR-scoped, not app-global (the question this settled)
The preset lives in the **header** (editor chrome), **not** the rail. Variant **C** tested treating a
saved look as a *global* concept like ⚙ Procesamiento (a mini-swatch at the top of the rail) — and it
was rejected: a *look* is an **editor control**, scoped to the screen you style on, not an app-level
setting next to processing params. A (preset in a separate sub-bar with the tabs) stayed the calmer
fallback if the one-row header proves too full.

### The 035-D tally rehomes onto the rail's Cola button
The `✓3 ✕1` completion tally lost its home when 033-B deleted the header Editor⇄Cola vswitch. Its
**honest new home is the rail's Cola button** — which already carried a `.rdot` activity marker. Small
mono digits, top-right of the icon: `✓` in `--success`, `✕` in `--danger`. Legible and persistent
without wanting to be back near an action.

### The real dense editor coheres inside the rail shell
The composite — **56px rail + contextual header + 3-column work body** (stage+transport · dense
Subtitles tab · "Próximamente" metadata column) — reads as the **same screen everyone had in their
head** from 027-B, not a different app. The live caption (025-C) plays in both the stage and the
in-panel specimen via one `paint()`; the ~10-control Subtitles tab is the honest density stress, and it
holds.

### Green discipline (the named test)
**Render is the only green across all three variants.** The preset trigger, the rail, the rehomed
tally, the active-tab/active-rail states are all **accent (blue) or neutral**. Nothing else greens.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`. The shell/stage/transport/dense-tab
CSS is unchanged from `north-star-v3.md` and `north-star-v2.md`. What v4 settles is the **rail + contextual
header + rehomed chrome**:

### The contextual header (no brand — the rail owns it)
```css
/* the header is now the purely-contextual bar of the current destination */
.hdr { height:52px; display:flex; align-items:center; gap:var(--s-6);
       padding:0 var(--s-10); background:var(--chrome); border-bottom:1px solid var(--border); }
.ctxname { font-size:var(--t-md); font-weight:600; color:var(--text); } /* "Editor" — not a brand */
/* B: the preset takes the brand's freed left slot; Video pushed right keeps "global" reading */
.ctab.push { margin-left:auto; }
```

### The preset trigger (034-A, editor-scoped — lives in the header)
```css
.preset { display:inline-flex; align-items:center; gap:8px; background:var(--surface);
          border:1px solid var(--border); border-radius:var(--r-sm); padding:5px 10px 5px 8px;
          cursor:pointer; font-size:var(--t-sm); color:var(--text); }
.preset .pl  { font-size:var(--t-2xs); color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; }
.preset .pv  { font-weight:600; }                       /* the active look's name */
.preset .mod { color:var(--warning); font-size:var(--t-2xs); font-weight:600; } /* · Modificado, ambient */
```

### The 035-D tally rehomed onto the rail Cola button
```css
.railbtn { position:relative; }                          /* the Cola icon */
.railbtn .tally { position:absolute; top:2px; right:2px; display:flex; gap:2px;
                  font-size:8px; font-weight:700; font-family:var(--mono); }
.railbtn .tally .ok { color:var(--success); }            /* ✓3 */
.railbtn .tally .er { color:var(--danger);  }            /* ✕1 */
```

### The rail active-item spine (a nav indicator, not a card side-stripe)
```css
.railbtn.on { background:var(--accent-tint); color:var(--accent); }
.railbtn.on::before { content:""; position:absolute; left:-8px; top:8px; bottom:8px;
                      width:3px; border-radius:2px; background:var(--accent); } /* "you are here" */
```

## HTML Structures

### Winner B — one dense header row (the whole shell)
```html
<nav class="rail">
  <div class="rlogo">R</div>
  <button class="railbtn on">✎<span class="lab">Editor</span></button>
  <button class="railbtn">≣<span class="lab">Cola · 1 en proceso</span>
    <span class="tally"><span class="ok">✓3</span><span class="er">✕1</span></span></button>   <!-- tally rehomed here -->
  <button class="railbtn">✓<span class="lab">Resultados</span></button>
  <div class="rsp"></div>
  <button class="railbtn">⚙<span class="lab">Procesamiento</span></button>
  <button class="railbtn">?<span class="lab">Atajos (⌘K)</span></button>
</nav>
<div class="colwrap">
  <header class="hdr">
    <div class="preset">…Estilo · Mi estilo TikTok · Modificado ▾</div>  <!-- brand's freed slot -->
    <div class="ctabs"><span class="ctab">Títulos</span><span class="ctab on">Subtítulos</span><span class="ctab">Overlays</span></div>
    <div class="spacer"></div>
    <span class="ctab">Video</span>                                       <!-- pushed right = "global" -->
    <span class="chip dirty">●Sin guardar</span>
    <button class="btn btn-out">Guardar</button>
    <button class="btn btn-green">▶ Render</button>                       <!-- the only green -->
  </header>
  <div class="work"><!-- stagecol (live caption + transport) · ctrlcol (dense Subtitles) · metacol --></div>
</div>
```

## What to Avoid
- **Don't reference 027 (v3) as the current whole-screen view** — v4 supersedes it. v3's *content* still
  holds; its header-resident *frame* is stale (the rail replaced it). v3 stays as the live-preview-folding
  milestone in the lineage.
- **Don't put the preset on the rail** (variant C) — a saved look is an **editor** control, not an
  app-global setting beside ⚙. The rail is wayfinding; the look is screen-scope.
- **Don't leave the tally orphaned near a deleted action** — its home is the rail Cola button now, not a
  header vswitch that no longer exists.
- **Don't let the one dense row overflow.** If real label widths fill it, fall back to **A** (preset in a
  sub-bar with the tabs) — two calm rows beat one crammed one.
- **Don't green anything but Render** — not the preset, not the rail, not the tally.
- **Don't redraw the rail active spine as a card side-stripe** — the 3px accent is "you are here" nav, a
  different signal from a selected-card border.

## Origin
Synthesized from sketch 037 (north-star-v4, winner B — one dense header row; A = preset sub-bar, C =
preset on the rail / app-scope). Composes 027-B's editor content inside 033-B's rail shell and resolves
the 034-A preset home (→ header, editor-scoped) and the 035-D tally home (→ rail Cola button).
**Supersedes `references/north-star-v3.md` (sketch 027)** as the canonical Editor screen, which supersedes
v2 (023) and the composite (015). Source file in `sources/037-north-star-v4/` (winner `#v-b`, ★ in the
variant nav).
