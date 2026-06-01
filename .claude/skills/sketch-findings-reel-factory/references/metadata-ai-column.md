# Metadata / AI Column — the awakened right column (frontier, AI phase)

⚠️ **Reserved for the AI phase — forward-looking target, not Phase 22 committed scope.** The right
column of the 3-column shell was a **"Próximamente" placeholder in every sketch 001–025** — the largest
unexplored surface of the tool. This finding finally draws it **awake**: generating social metadata
(título · descripción · hashtags) from the transcription + the reel's titles, and adapting per platform.
It also justifies the column's persistent ~320–340px width across all the other sketches.

## Design Decisions

### C — per-platform tabs (winner): TikTok / Reels / Shorts
The column's north star is **publishing-ready output adapted to where the reel goes**, not one generic
blob:
- Three platform sub-tabs (**TikTok · Reels · Shorts**), each with a small brand swatch
  (`#69C9D0` · `#E1306C` · `#FF0000`).
- Each platform re-tunes **caption text, its own char-limit counter, and platform-appropriate
  hashtags**: TikTok ≤2.200 + `#fyp/#parati`; Reels ≤2.200 + up to 30 tags incl. `#reelsinstagram`;
  Shorts **título ≤100** + `#Shorts`. The counter turns **red (`--danger`)** when over limit (Shorts'
  100-char cap is the live example).
- Every field is **editable in place** (título/caption textareas, removable hashtag chips + add button),
  with per-field **copiar** and a footer **↻ Regenerar** + **⤓ copiar**.

Chosen over **A** (generate-on-demand: empty-state CTA → shimmer → fields wake in; manual, explicit) and
**B** (render byproduct: auto-generated when the render finishes, arrives pre-filled with a
"transcripción + títulos" source note). C is the most "publishing tool" of the three. **Lands on
024-B's results screen** as the place per-platform metadata gathers.

### Empty state earns the width (from A, worth keeping)
An empty-state CTA ("✦ Generar metadata", accent) makes the column's *purpose* obvious before first use
— strictly better than a dead "Próximamente" badge. Even in the per-platform target, the pre-generation
state should explain what the column is for.

### Green discipline — the explicit test this sketch had to pass
**"Generar", "Regenerar", and "copiar" are SECONDARY actions → they use accent (blue), never the
reserved action-green.** The only green anywhere is Render (header) / Guardar. Verified holding across
all three variants. This is the rule to re-check at build: an AI-generation button is tempting to make
the loud primary, but green stays reserved.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### Generate button — accent, NOT action-green (the discipline made literal)
```css
.gen-btn       { font-weight: 600; padding: 9px 18px; border-radius: var(--r-sm);
                 border: 1px solid var(--accent-strong); background: var(--accent-tint); color: var(--accent); }
.gen-btn:hover { background: oklch(0.82 0.095 242 / 0.2); }
.gen-btn .gs   { width: 12px; height: 12px; border: 2px solid var(--accent); border-top-color: transparent;
                 border-radius: 50%; animation: spin .7s linear infinite; }  /* generating spinner */
```

### Status badges — idle vs generated vs render-sourced
```css
.badge.idle { color: var(--text-muted); background: var(--surface-2); }            /* "En espera" */
.badge.ai   { color: var(--accent);     background: var(--accent-tint); }          /* "✦ Generado" */
.badge.ok   { color: var(--success);    background: oklch(0.72 0.14 150 / 0.14); } /* "✦ Generado" via render (B) */
```

### Per-platform tabs + over-limit counter (C)
```css
.ptabs       { display: flex; gap: var(--s-3); padding: var(--s-6) var(--s-10) 0; }
.ptab        { flex: 1; font-size: var(--t-xs); font-weight: 600; color: var(--text-muted);
               background: var(--surface); border: 1px solid var(--border); border-bottom: none;
               border-radius: var(--r-sm) var(--r-sm) 0 0; }
.ptab.on     { color: var(--accent); background: var(--accent-tint-2); border-color: var(--accent-strong); }
.ptab .pf    { width: 8px; height: 8px; border-radius: 2px; }   /* per-platform brand swatch */
.field-lab .count      { color: var(--text-faint); font-variant-numeric: tabular-nums; }
.field-lab .count.over { color: var(--danger); }   /* caption/título exceeds the platform limit */
.plat-limit  { font-size: var(--t-2xs); color: var(--text-muted); padding: var(--s-4) var(--s-6);
               background: var(--surface); border-radius: var(--r-sm); border: 1px solid var(--border-faint); }
```

### Editable fields + removable hashtag chips
```css
.editbox  { width: 100%; font-size: var(--t-sm); background: var(--surface); border: 1px solid var(--border);
            border-radius: var(--r-sm); padding: var(--s-5) var(--s-6); line-height: 1.5; resize: none; }
.editbox:focus { outline: none; border-color: var(--accent-strong); box-shadow: 0 0 0 3px var(--accent-tint); }
.hash     { color: var(--accent); background: var(--accent-tint); border: 1px solid var(--accent-strong);
            border-radius: var(--r-full); padding: 3px 9px 3px 10px; display: inline-flex; gap: 5px; }
.hash .rm { cursor: pointer; opacity: 0.6; }   /* per-chip remove */
.hash-add { border: 1px dashed var(--border-strong); border-radius: var(--r-full); color: var(--text-faint); }
.shimmer  { height: 13px; border-radius: var(--r-full);
            background: linear-gradient(90deg, var(--surface-2) 0%, var(--surface-hover) 40%, var(--surface-2) 80%);
            background-size: 220px 100%; animation: shimmer 1s linear infinite; }  /* generating skeleton */
@keyframes shimmer { 0% { background-position: -200px 0; } 100% { background-position: 220px 0; } }
@keyframes wake    { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
```

### Per-platform data shape (the model the panel re-renders from)
```js
const PLAT = {
  tiktok: { limit:'TikTok · caption ≤ 2.200 car · 3-5 hashtags',  max:2200, desc:'…', tags:['#reels','#edición','#fyp','#parati'] },
  ig:     { limit:'Instagram Reels · caption ≤ 2.200 car · hasta 30 hashtags', max:2200, desc:'…', tags:['#reels','#edición','#tutorial','#contentcreator','#reelsinstagram'] },
  yt:     { limit:'YouTube Shorts · título ≤ 100 car · #Shorts recomendado',   max:100,  desc:'…', tags:['#Shorts','#edición','#tutorial'] },
};
// switching platform re-renders título / caption (with over = desc.length > max) / hashtags
```

## What to Avoid
- **Don't green the Generar/Regenerar/copiar buttons.** They are secondary → accent (blue). Green stays
  reserved for Render / Guardar. This was the named test of the sketch.
- **Don't ship one generic caption blob** when the value is per-platform tailoring (limits + tone + tags).
- **Don't leave a dead "Próximamente" badge** as the pre-generation state — an empty-state CTA that names
  the column's purpose is the floor.
- **Don't treat this as Phase 22 committed scope** — it's reserved for the AI phase. It informs the
  column's reserved width and the 024-B results screen, but isn't built in the control-panel pass.

## Origin
Synthesized from sketch 026 (metadata-ai-column, winner C — per-platform tabs; A = generate-on-demand;
B = render byproduct). The awakened form of the persistent column placeholder seen in every prior
sketch; lands on `references/render-last-mile.md` (024-B). Reserved for the AI phase. Source file in
`sources/026-metadata-ai-column/` (winner `#v-c`, marked ★ in the variant nav).
