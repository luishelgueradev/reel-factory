# First-Run & Empty Workspace

## Design Decisions

**Winner: Sketch 017 variant B — controls live with defaults.**

The cold start (whole 3-column shell, no video loaded, nothing configured) keeps the **dense controls
fully live on their default values**. The stage shows a **dropzone hero** as the one primary action;
a banner frames the panel as "configurando los valores por defecto" so you can pre-set your look
before the video lands. The tool **never feels locked**. Where sketch 008 validated the no-video
*preview tile* in isolation, this resolves the **entire shell** the first time it opens.

### The three columns, cold
- **Stage** = a **dropzone** ("Subí tu video" + "Elegir archivo" + `MP4 · hasta 10 min`). The
  `Elegir archivo` button is the **single green** — load-a-video is the only primary action available.
- **Controls** = the normal dense Posición → Estilo → Avanzado form, **fully editable**, preceded by a
  one-line **defaults banner** (`✎ Estás configurando los valores por defecto. Se aplicarán al video
  apenas lo cargues.`).
- **Metadata** = the **persistent "Próximamente" placeholder** (D-01) — present even cold, with dashed
  ghost-line skeletons for Título / Descripción.

### Green discipline holds (consistent with 008 / 010 / 013)
- `Elegir archivo` (load a video) = the **only green**, because it's the single primary action of this
  surface.
- `Guardar config` = **disabled** (nothing dirty yet).
- `Render` = **ghosted** (dashed outline, `cursor: not-allowed`) — no video to render.
- Save chip reads **`Sin cambios`** (quiet, muted — not amber).

### Why this won
- **Reassuring, not noise.** Seeing the real controls live (B) makes the tool feel ready and lets you
  prep a look; variant A (controls **gated** behind a blur with "Cargá un video para editar") hides the
  panel's value and makes it feel half-loaded.
- **Right register for a local studio.** Variant C (a centered **welcome takeover** card with value
  prop + 3-step pipeline) is too heavy/marketing-flavored for a single-purpose local tool you reopen
  constantly. B's quiet banner gives the same orientation without a takeover.
- **One unambiguous next step** still reads — the green dropzone is the obvious action even with the
  panel live.

## CSS Patterns

```css
/* dropzone hero — the cold-start primary surface */
.dropzone {
  width: 100%; max-width: 320px; aspect-ratio: 9 / 16; border-radius: 18px;
  border: 2px dashed var(--border-strong); background: oklch(0.20 0.025 280 / 0.5);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-8);
  text-align: center; padding: var(--s-12); cursor: pointer;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.dropzone:hover { border-color: var(--accent-strong); background: var(--accent-tint-2); }
.dz-btn {                                   /* the single green = load a video */
  font-weight: 600; padding: 8px 18px; border-radius: var(--r-sm);
  background: var(--action); color: oklch(0.16 0.02 150); border: none; cursor: pointer;
}

/* "configuring defaults" banner above the live controls (variant B) */
.pre-banner {
  display: flex; align-items: center; gap: var(--s-5); margin-bottom: var(--s-8);
  padding: var(--s-5) var(--s-6); border-radius: var(--r-sm);
  font-size: var(--t-xs); line-height: 1.45; color: var(--text-2);
  background: var(--accent-tint-2); border: 1px solid var(--accent-strong);
}
.pre-banner b { color: var(--text); font-weight: 600; }

/* inert actions: Guardar disabled, Render ghosted */
.btn:disabled    { opacity: 0.45; cursor: not-allowed; }
.btn.ghost       { color: var(--text-faint); border-style: dashed; cursor: not-allowed; }
.save-chip       { color: var(--text-muted); background: var(--surface);   /* "Sin cambios" = quiet */
                   border: 1px solid var(--border-faint); }
.save-chip .dot  { opacity: 0.6; }

/* persistent metadata placeholder, even cold (D-01) */
.gh-box  { background: var(--surface); border: 1px dashed var(--border-strong);
           border-radius: var(--r-sm); padding: var(--s-6); opacity: 0.5; }
.gh-line { height: 9px; border-radius: var(--r-full); background: var(--surface-2); margin: 7px 0; }
```

## HTML Structure

```html
<section class="controls">
  <div class="tabs">…</div>
  <div class="ctrl-body">
    <div class="pre-banner">✎ <span>Estás configurando los <b>valores por defecto</b>.
      Se aplicarán al video apenas lo cargues.</span></div>
    <!-- the SAME dense Posición→Estilo→Avanzado form, fully live -->
    <div class="ctrl-2col">…</div>
  </div>
</section>
```

## What to Avoid
- **Gating the controls behind a blur** (variant A: "Cargá un video para editar") — hides the panel's
  value and reads as a half-loaded screen; you can't prep your look.
- **A welcome takeover card** (variant C) — too heavy for a single-purpose *local* studio you reopen
  often; the brand/value-prop/3-step pitch belongs on a marketing page, not the editor's cold start.
- **A second green, or greening Guardar/Render while inert** — the only green is the load action;
  Guardar stays disabled and Render ghosted until there's a video (green discipline from 008/010/013).
- **Dropping the metadata column when empty** — keep its "Próximamente" placeholder persistent (D-01).

## Origin
Synthesized from sketch: 017 (winner B — controls live with defaults)
Extends `states-and-save-feedback.md` (008 validated the no-video tile; this is the whole shell cold).
Source file available in: sources/017-first-run-empty-workspace/index.html
