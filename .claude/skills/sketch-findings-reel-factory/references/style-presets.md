# Style Presets — Named, Saved Looks (save-a-look across all 4 tabs)

First-run (017-B) starts **every** video from defaults, and the editor's whole job is to dial in a look
across four tabs (Títulos · Overlays · Subtítulos · Video). But this is explicitly a **batch /
repeat-use** tool ("procesamiento individual y por lotes", real BullMQ queue). A professional making the
same kind of reel weekly should **not re-dial the look each time**. Sketch 034 finds where **named,
saved configurations** live — and the key reframe is that a preset's real payload is **all four tabs at
once**, not just a font or a color swatch.

The four questions 034 answers:
1. Where do saved looks **live** (header bar · gallery sheet · first-run strip)?
2. How do you **apply** one (it overwrites all four tabs)?
3. How do you **save** the current config as a new look?
4. How is the **"applied a preset, then tweaked it" (Modificado)** state communicated — without
   colliding with the existing "Cambios sin guardar" save chip?

⚠️ **Frontier / repeat-use.** Presets are a reuse feature beyond Phase 22 look-polish, but the placement
is settled here so the real build knows where they go.

## Design Decisions

### Winner 034-A — always-visible header preset bar
An **always-on trigger** by the brand: `Estilo: [Mi estilo TikTok ▾]`. Clicking opens a dropdown listing
saved looks (swatch + name + descriptor + ✓ on the active one) and offers **"Guardar el actual como
estilo…"** — *enabled only when the current config has diverged* from the active preset. The active look
and its dirty state are **always on screen**, with the lowest possible ceremony for switching.

Why it wins:
- **Frictionless for frequent switching.** The whole value is *not re-dialing weekly*; an always-visible
  trigger makes "which look am I on, switch to another" a one-click, zero-navigation gesture. A gallery
  (B) hides the active look behind an open action.
- **The active look + its divergence are ambient.** `Estilo: Mi estilo TikTok · Modificado` reads at a
  glance — you always know what you branched from and whether you've drifted. The **Modificado** marker
  uses `--warning` (amber, low chroma), the same dirty language as the save chip, so it reads as
  *informational divergence*, not a second alarm.
- **"Save the current as new" lives exactly where you'd reach for it** — in the same dropdown, gated on
  divergence (disabled with a "(sin cambios)" hint when nothing diverged, so the affordance is *honest*
  about when it does something).

### The Modificado / diverged-from-preset state (the subtle part)
A preset is applied → config matches it → clean. Tweak any control → **Modificado** appears. This must
**coexist with "Cambios sin guardar"** without reading as a second warning:
- **Save chip** (`● Cambios sin guardar`, amber) = *this config isn't persisted to disk yet* (013-B /
  states-and-save-feedback) — about the **config file**.
- **Modificado** (`· Modificado`, amber, inline in the preset trigger) = *this config no longer matches
  the preset you applied* — about the **preset relationship**.

They're different facts that often co-occur; both use the same low-chroma amber so neither escalates.
Applying a preset **clears Modificado** (and dirties the save chip, since the config changed).

### Why the header bar beat the gallery (B) and first-run strip (C)
- **B — slide-over gallery** (reuses the 016 font-picker / 032 settings idiom): a `◫ Estilos` trigger
  opens a sheet of **preview cards**, each a mini 9:16 thumbnail rendering the *actual* look (font +
  color + title-box), active card badged "Activo" with Renombrar / Duplicar, closed by a dashed "Guardar
  el actual" card. **Richer management and real thumbnails the dropdown can't give** — but the active
  look is hidden until you open the sheet, and for a tool where you **switch occasionally but manage
  rarely**, the always-on bar's low ceremony wins. *B is the right home for the **management** affordances
  (rename/duplicate/delete) — keep its card idiom as the "manage looks" surface reachable from the bar.*
- **C — first-run strip + recall:** ties presets to onboarding (017-B) — the cold workspace offers the
  dropzone *and* a strip of look-cards to start from (plus "Empezar limpio"), then a compact
  `Desde [look] ✕` recall chip sits in the header. **Presets as a starting point, not a mid-task
  switcher.** Good discovery, but it frames presets as a one-time choice; the real need is switching and
  saving *throughout* repeat use. *The **recall chip** ("Desde X") is a genuinely good idea — it answers
  "which look did I branch off" — and folds into A as the trigger's own active-name display.*

### The payload is all four tabs — make that legible
A saved look is a **full multi-tab configuration**, not a swatch. Both the dropdown swatch and the
gallery thumbnail render a **real mini-specimen** (title box + caption word in the preset's font/colors)
so the look reads as *a whole configuration at a glance*, not just "a color." Descriptor text
(`Bebas · amarillo · glow`) names the salient axes. This is the anti-pattern guard: a preset that looks
like just a font picker undersells what it carries.

### Green discipline
Applying / saving / duplicating a look is **not** the surface's primary action (Render owns green). All
preset affordances use **accent or outline**: the trigger is neutral, "Aplicar"/"Guardar como"/"Duplicar"
use `accent-tint` (blue) or outline. The reserved action-green **never** appears on a preset control.

## CSS / HTML Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### The header preset trigger (A) — always-visible, carries active name + Modificado
```css
.preset-trigger { display:inline-flex; align-items:center; gap:8px; background:var(--surface);
                  border:1px solid var(--border); border-radius:var(--r-sm); padding:5px 10px 5px 8px;
                  cursor:pointer; font-size:var(--t-sm); color:var(--text); transition:all var(--dur) var(--ease); }
.preset-trigger:hover { border-color:var(--border-strong); background:var(--surface-hover); }
.preset-trigger .pl  { font-size:var(--t-2xs); color:var(--text-muted); letter-spacing:0.05em; text-transform:uppercase; }
.preset-trigger .pv  { font-weight:600; }                                  /* active look name */
.preset-trigger .mod { color:var(--warning); font-size:var(--t-2xs); font-weight:600; }  /* "· Modificado" — amber, not alarm */
```

### The dropdown — saved looks + divergence-gated "save as"
```css
.pitem        { display:flex; align-items:center; gap:var(--s-5); padding:7px 9px; border-radius:var(--r-xs); cursor:pointer; }
.pitem:hover  { background:var(--surface-hover); }
.pitem.on     { background:var(--accent-tint); }                           /* active = blue, never green */
.pitem.on .pn { color:var(--accent); }
.pitem .sw    { width:26px; height:26px; border-radius:var(--r-xs); display:grid; place-items:center;
                font-weight:800; font-size:11px; }                          /* mini-specimen swatch in the look's own font/colors */
.pitem .chk   { margin-left:auto; color:var(--accent); }
.save-as      { color:var(--accent); font-weight:500; }                     /* accent, not green */
.save-as.dis  { color:var(--text-faint); cursor:default; }                  /* disabled when config hasn't diverged */
```
```js
// a preset = a full multi-tab config, here distilled to its visible "look" axes
const PRESETS = [
  { id:'tiktok', name:'Mi estilo TikTok', meta:'Bebas · amarillo · glow',
    bg:'…', cap:'#ffe14d', capFont:"'Bebas Neue',sans-serif", ttlBg:'rgba(0,0,0,.5)', ttlColor:'#fff' },
  // …each carries the title-box + caption font/color that the swatch & thumbnail render live
];
// "save as" is enabled ONLY when the current config has diverged from the active preset
const saveAsEnabled = state.dirty;   // dirty === diverged-from-preset (the Modificado condition)
```

### The gallery card (B) — real 9:16 thumbnail of the whole look (the management home)
```css
.pcard        { background:var(--canvas); border:1px solid var(--border); border-radius:var(--r-md);
                padding:var(--s-5); cursor:pointer; position:relative; transition:all var(--dur) var(--ease); }
.pcard.on     { border-color:var(--accent-strong); box-shadow:0 0 0 1px var(--accent-strong); }  /* selection = blue */
.pcard .thumb { height:124px; border-radius:var(--r-sm); position:relative; overflow:hidden; }    /* renders title box + caption word live */
.pcard.on .badge { position:absolute; top:10px; right:10px; background:var(--accent); color:var(--stage);
                   font-size:9px; font-weight:700; padding:2px 7px; border-radius:var(--r-full); }  /* "Activo" */
.pcard .rowact   { display:none; }                                          /* Renombrar / Duplicar */
.pcard.on .rowact{ display:flex; }                                          /* management revealed on the active card */
.pcard.newcard   { border-style:dashed; color:var(--accent); }             /* "Guardar el actual" — accent, dashed */
```

### The recall chip (from C, folds into A) — "which look did I branch off"
```css
.recall    { display:inline-flex; align-items:center; gap:7px; background:var(--surface);
             border:1px solid var(--border); border-radius:var(--r-full); padding:4px 6px 4px 11px;
             font-size:var(--t-xs); color:var(--text-2); }
.recall .pn{ color:var(--text); font-weight:600; }
```

## What to Avoid
- **Don't make a preset read as just a font/color swatch.** Its real payload is all four tabs — render
  a mini-specimen (title box + caption word) so the *whole look* is legible, or it undersells itself.
- **Don't let Modificado read as a second alarm.** Use the same low-chroma amber as the save chip; it's
  *informational divergence from the preset*, distinct from *unsaved-to-disk* — both true, neither escalates.
- **Don't hide the active look behind an open action (B as primary).** For a switch-often / manage-rarely
  tool, the always-visible header bar wins; keep the gallery for the *management* (rename/duplicate), not
  the everyday switch.
- **Don't frame presets as a one-time onboarding choice (C as primary).** They're a throughout-use
  switcher; the first-run strip's good idea is the *recall chip*, which belongs in the always-on trigger.
- **Don't green any preset affordance.** Aplicar / Guardar-como / Duplicar use accent or outline; Render
  keeps the only green.
- **Don't gate "save as" carelessly.** Enable it *only* when the config has diverged; a disabled
  "(sin cambios)" state is honest about when saving does anything.

## Origin
Synthesized from sketch 034 (style-presets, winner **A** — always-visible header preset bar; B =
slide-over gallery kept as the *management* surface, C = first-run strip whose *recall chip* folds into
A). Builds on 017-B first-run (`first-run-empty-workspace.md`) and reuses the 016/032 slide-over idiom
(`font-picker.md`, `pipeline-settings.md`) for B's gallery. Modificado coexists with the 013-B save chip
(`header-action-zone.md`, `states-and-save-feedback.md`). Source file in `sources/034-style-presets/`
(winner `#v-a`).
