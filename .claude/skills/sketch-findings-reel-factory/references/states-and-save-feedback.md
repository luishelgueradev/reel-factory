# States, Empties & Save Feedback

## Design Decisions

**Winner: Sketch 008 variant B — save-state lives in a header status chip.**

A dedicated **status chip** sits to the **left of the action buttons** and names the save state in
words; the `Guardar config` button stays put and only enables/disables. **Status is information, the
button is the action** — keeping them separate is the calmest, most legible read for a panel you save
dozens of times a session.

Chip is an idle/dirty/saving/saved state machine:

| State | Chip text | Color token |
|-------|-----------|-------------|
| clean / idle | _(hidden, or quiet)_ | — |
| dirty | `● Cambios sin guardar` | `--warning` (amber, low chroma) |
| saving | `Guardando…` (spinner) | `--text-2` |
| saved | `✓ Guardado recién` | `--success` |

The `Guardar config` button **enables only when dirty**.

### Why this won
- **Unmissable without nagging** — the named state reads instantly in a dense dark panel, where
  variant A's morphing-button signal (a small green tint on one button) was too easy to miss.
- **No drama on every edit** — variant C's footer action-bar that slides up on each edit was the
  loudest/most unmissable but costs vertical space + a slide animation every time; too much for a
  tweak-and-save loop.
- **Separation of concerns** — one element doing both status *and* trigger (variant A) is ambiguous.

## Off-the-happy-path states (validated, adopt as drawn — carry across all save treatments)

- **Empty overlay list (0 of 3):** `Sin overlays todavía` + a dashed Add CTA. Reads as inviting and
  on-brand, not broken/unfinished — matches the calm density of populated tabs.
- **The cap (3 of 3):** `3 / 3 · al tope`, **Add disabled**, plus a `Máximo 3` hint so the disabled
  button never reads as a bug. Grounded in real `MAX_OVERLAYS = 3`.
- **No video loaded:** blank stage `Sin video cargado` + drop affordance; dimmed `1080×1920 / 9:16`
  context pills.
- **Whisper processing:** `Transcribiendo… paso 1 de 3` shimmer over the preview — the first step of
  the single-job pipeline (`MAX_CONCURRENT_JOBS = 1`, Whisper → silence-cut → Remotion). Holds the
  same visual quality as the live preview.

## Green-primary rule (reconcile with sketch 010)

008-B keeps green = `Guardar config` (editing-only state). Sketch **010-A reassigns green to Render**.
The ratified resolution is **context-dependent**: green marks **THE single primary action of the
current surface** — `Render` when render is the focus, `Save` in the editing-only state. See
`render-export-surface.md`. Never two greens at once.

## CSS Patterns

```css
/* header: status chip left of actions, button stays put */
.panel-actions { display: flex; align-items: center; gap: var(--s-4); }
.save-chip {
  display: inline-flex; align-items: center; gap: var(--s-2);
  font-size: var(--t-xs); padding: var(--s-2) var(--s-4);
  border-radius: var(--r-full); transition: color var(--dur) var(--ease);
}
.save-chip.is-dirty  { color: var(--warning); }
.save-chip.is-saved  { color: var(--success); }
.save-chip .dot { width: 6px; height: 6px; border-radius: var(--r-full); background: currentColor; }

.empty-state {                 /* 0-overlay invitation */
  border: 1px dashed var(--border); border-radius: var(--r-md);
  padding: var(--s-12); text-align: center; color: var(--text-3);
}
.btn-action[disabled] { opacity: 0.45; cursor: not-allowed; } /* the 3/3 cap */
```

## What to Avoid
- **Morphing the action button into the status** (variant A) — the dirty signal is too subtle in a
  dense dark panel; "you have unsaved changes" gets missed.
- **A footer action-bar that slides up on every edit** (variant C) — too much vertical cost and
  animation drama for a high-frequency save loop.
- **A disabled Add with no explanation** — always pair the cap's disabled state with the `Máximo 3`
  hint, or it reads as a bug.
- **High-chroma dirty/saved colors** — keep `--warning`/`--success` low chroma so the chip informs
  without alarming.

## Origin
Synthesized from sketch: 008 (winner B)
Source file available in: sources/008-states-and-empties/index.html
