# Header Action Zone

How the app header resolves the **three things that collided on one strip** — the save **status chip**
(008-B), the **Guardar config** button, and the **Render Video** green primary (010-A) — across the full
`idle → dirty → saving → rendering → done` lifecycle. This is the reconciliation
`references/states-and-save-feedback.md` and `references/render-export-surface.md` each implied but
never drew together. Read both first.

## Design Decisions

### The reconciliation (baked into every variant — the design-system invariant)
- **Render is the *only* green.** It is the surface's one true primary action (010-A).
- **Guardar config is *always* an outline button** — it never goes green, even when dirty. Its dirtiness
  is carried entirely by the **chip**.
- Result: the rule **"never two greens at once"** holds in every state, automatically. The chip is
  *info* (where things stand); the buttons are *action* (what you can do).
- **Single-job truth:** the pipeline is `MAX_CONCURRENT_JOBS = 1`, so save and render can never be
  mid-flight together. Guardar **disables while rendering**; the header only has to resolve the
  *transition*, not a true concurrent state.

### Split zones (sketch 013-B — winner)
Organize the header by **semantics, not by alignment**:
- **Left zone** = *status*. The chip rides next to the brand as ambient context. It has a **stable home**
  and never competes with the buttons for the same corner.
- **Right zone** = *actions*. `Guardar (outline)` ⟍ `Render (green)`, separated by a **1px hairline
  divider** (`.zone-div`). Left = where things stand, right = what you can do.
- **Mid-render:** because status lives on the left, the chip keeps its position when a render starts —
  no reflow of the action corner. This is the previously-untested edge case, and the left/right split is
  what makes it calm.

This reads like a Linear/Figma pro-tool header; the trio-in-one-corner alternative (013-A) got busy.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### Status chip — state-driven, low chroma (008-B, carried here)
```css
.statuschip { display: inline-flex; align-items: center; gap: 7px; font-size: var(--t-sm);
              font-weight: 500; padding: 5px 11px; border-radius: var(--r-full); white-space: nowrap; }
.statuschip .sdot { width: 7px; height: 7px; border-radius: 50%; }
.statuschip[data-s=clean]  { color: var(--text-muted); }
.statuschip[data-s=clean] .sdot { background: var(--success); }
.statuschip[data-s=dirty]  { color: var(--warning); background: oklch(0.80 0.12 78 / 0.12); }       /* amber = unsaved */
.statuschip[data-s=dirty] .sdot { background: var(--warning); box-shadow: 0 0 0 3px oklch(0.80 0.12 78 / 0.22); }
.statuschip[data-s=saving] { color: var(--text-2); }
.statuschip[data-s=saved]  { color: var(--success); background: oklch(0.72 0.14 150 / 0.12); }       /* green = confirmed */
.spin { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--text-faint);
        border-top-color: var(--text); animation: spin 0.7s linear infinite; }
```

### Guardar — ALWAYS outline (never the second green)
```css
.btn { font: inherit; font-size: var(--t-md); font-weight: 500; padding: 7px 14px; border-radius: var(--r-sm);
       border: 1px solid var(--border-strong); background: transparent; color: var(--text-2); cursor: pointer;
       transition: background var(--dur) var(--ease), color var(--dur) var(--ease), opacity var(--dur) var(--ease); }
.btn:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
.btn:disabled { opacity: 0.45; cursor: default; }   /* disabled while saving OR rendering (single-job) */
```

### Render — THE green primary (010-A)
```css
.render-cta { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: var(--t-md);
              font-weight: 600; padding: 7px 16px; border-radius: var(--r-sm); border: 1px solid transparent;
              background: var(--action); color: oklch(0.16 0.02 150); cursor: pointer;
              transition: opacity var(--dur) var(--ease), background var(--dur) var(--ease); }
.render-cta:hover:not(:disabled) { background: var(--action-hover); }
.render-cta:disabled { opacity: 0.55; cursor: not-allowed; }   /* while running: "Renderizando…" */

.zone-div { width: 1px; height: 24px; background: var(--border); flex: none; }   /* hairline between Guardar and Render */
```

## HTML Structures

### Split-zone header (013-B): brand + chip on the left, actions on the right
```html
<header class="hdr">
  <div class="brand"><div class="glyph">R</div><div><h1>Reel Factory Studio</h1><div class="tag">Vertical 9:16 · Subtítulos</div></div></div>
  <!-- LEFT zone: status, next to the brand -->
  <div class="hdr-actions" style="margin-left:var(--s-4)">
    <span class="statuschip" data-s="dirty"><span class="sdot"></span>Cambios sin guardar</span>
  </div>
  <div class="hdr-spacer"></div>
  <!-- RIGHT zone: actions, divider between Guardar and Render -->
  <div class="hdr-actions">
    <button class="btn" data-save-go>Guardar config</button>
    <span class="zone-div"></span>
    <button class="render-cta" data-render-go><span class="tri">▶</span>Render Video</button>
  </div>
</header>
```

### State map for the three controls
| Lifecycle state | Chip (left) | Guardar (right) | Render (right) |
|---|---|---|---|
| idle / clean | `✓ Todo guardado` (muted) | outline, enabled | green `▶ Render Video` |
| dirty | `● Cambios sin guardar` (amber) | outline, enabled | green `▶ Render Video` |
| saving | `⟳ Guardando…` | `Guardando…` disabled | green, enabled |
| rendering | last save state, **holds left** | disabled (single-job) | `⟳ Renderizando…` disabled |
| done | last save state | outline, enabled | green `▶ Render de nuevo` |
| failed | last save state | outline, enabled | `↻ Reintentar` (green) |

## What to Avoid
- **013-A trio right-aligned:** chip + Guardar + Render all share the right corner. Functional, but the
  corner gets busy and the chip competes with the buttons — less calm than the left/right split.
- **013-C render-priority collapse:** while rendering, the save cluster collapses and the header morphs
  into an inline progress strip (step · bar · % · Cancelar). Clever and honest to the single-job truth,
  but it makes the header *change shape* mid-flight — heavier than B's stable zones. Its inline-progress
  idea is kept in reserve if render progress ever needs to live in the header instead of on the stage
  (default is on-stage; see `references/render-export-surface.md`).
- **Never let Guardar go green when dirty.** Dirtiness is the chip's job. Two greens breaks the rule.
- **Don't move the chip into the action corner.** Its stable left home is what makes the mid-render
  transition calm.

## Origin
Synthesized from sketch 013 (header-action-zone, winner B). Reconciles 008-B
(`references/states-and-save-feedback.md`) and 010-A (`references/render-export-surface.md`). Source file
in `sources/013-header-action-zone/` (winner `#v-b`, marked ★ in the variant nav). Use the two jumpers
in the sketch to drive `guardar` and `render` states independently.
