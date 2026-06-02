# Modal-Stack Choreography — One Layering Law for the Floating Surfaces

Six floating surfaces were each sketched **in isolation and never composed**: the font slide-over
(016), the ⚙ settings sheet (032), the ⌘K palette (036), the toast (035), the full-screen results
takeover (024), and the transcript/silence review takeovers (028/029). There was no stacking
contract — which can coexist, which dismisses which, scrim/focus-trap policy, what `Esc` does when two
are stacked, where the palette sits relative to a sheet. A pro tool with this many overlay idioms needs
**one layering law** before they collide at build. Sketch 041 settles it.

⚠️ **Consistency / integration.** This is the cross-cutting contract that governs surfaces defined in
`font-picker.md` (016), `pipeline-settings.md` (032), `command-palette.md` (036),
`background-notifications.md` (035), `render-last-mile.md` (024), and `pipeline-inspection.md` (028/029).

## Design Decisions

### Winner 041-B — a defined z-ladder (with C's "takeovers are destinations" grafted in)
A literal stacking contract the build can encode as constants:

```
toast      z 60   never traps focus · survives a takeover opening · the courtesy record
palette    z 40   opens OVER a sheet · returns to that sheet on Esc
takeover   z 30   owns the screen · clears floats EXCEPT the toast
sheet      z 20   scrim + Esc · only one sheet at a time (a new sheet replaces the old)
```

The rungs as rules:
- **Toast (60)** is independent of everything. Opening a takeover does **not** kill it (it's a courtesy
  record — see `background-notifications.md`); it never traps focus.
- **Palette (40)** is the one surface allowed to stack **over** a sheet. ⌘K while the font sheet is open
  opens the palette *on top*; `Esc` pops the palette and **returns to the sheet** (not all the way out).
  This is the capability the single-surface law (A) loses.
- **Takeover (30)** owns the editor: opening Resultados/Revisión clears any sheet/palette but leaves the
  toast. Esc/back returns to the editor.
- **Sheet (20)** carries a scrim; a second sheet **replaces** the first (never two sheets); Esc closes.

### C's reframe grafts onto B (it's not a competing model)
C's insight — **takeovers (Resultados/Revisión) are *destinations*, not floats** — is correct and
consistent with `run-flow-spine.md` (031, "review = pull") and `app-nav-shell.md` (033, rail
navigation). Results/review are *reached as destinations* via the rail/run-flow, so in practice the
**z-ladder really governs only toast / palette / sheet coexistence**; the "takeover" rung is the
boundary where a float gives way to a navigation destination. B keeps the rung in the ladder as that
boundary, but the build treats results/review as destinations the rail owns — not modal floats you stack.

### Why B beat the alternatives
- **vs A (single-surface law):** calmest, zero focus ambiguity — but you **lose ⌘K-over-a-sheet** (the
  palette would have to replace the sheet). For a Raycast-idiom tool where the palette is the universal
  entry point (036), that's the wrong tradeoff.
- **vs C (two-planes) as a pure model:** C's reframe is right but under-specifies toast/palette/sheet
  coexistence — which still need a ladder. So C **becomes a graft onto B**, not a replacement.

### Scrim / focus / Esc policy (the contract)
- **Scrim** on sheet/palette/takeover (a *soft* scrim `oklch(0.12 0.02 280 / 0.32)` for sheets/palette);
  the toast carries **no scrim** (never blocks).
- **Esc pops the top of the stack only** — palette-over-sheet → Esc returns to the sheet, a second Esc
  closes the sheet. A takeover's Esc/back returns to the editor.
- **Click-scrim = dismiss the top floating surface.**
- The toast **never traps focus** and is never popped by Esc (dismiss via its own action/auto-timeout).

## CSS / HTML Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### The z-ladder as constants — the build encodes this literally
```js
const Z = { toast:60, palette:40, results:30, review:30, font:20, settings:20 };
// open(k): toast is independent; palette opens over a sheet; takeover clears floats but toast; sheet replaces sheet
function open(k){
  if (k==='toast'){ if(!stack.includes('toast')) stack.push('toast'); return; }
  const toast = stack.includes('toast');
  if (k==='palette'){                                   // opens OVER whatever sheet is there
    stack = stack.filter(s => s==='font'||s==='settings'||s==='toast'); stack.push('palette');
  } else if (k==='results' || k==='review'){            // takeover: clears floats except toast
    stack = toast ? ['toast'] : []; stack.push(k);
  } else {                                              // a sheet: replaces other sheet, keeps toast/palette
    stack = stack.filter(s => s==='toast' || s==='palette');
    stack = stack.filter(s => s!=='font' && s!=='settings'); stack.push(k);
  }
  stack.sort((a,b) => (Z[a]||0) - (Z[b]||0));
}
// Esc pops the top of the stack only (palette-over-sheet → returns to the sheet)
function esc(){ if (dest){ dest=null; return; } if (stack.length) stack.pop(); }
```

### The matching CSS z-index rungs
```css
.scrim    { position:absolute; inset:0; background:oklch(0.12 0.02 280 / 0.5); z-index:10; animation:fadein .15s var(--ease); }
.scrim.soft { background:oklch(0.12 0.02 280 / 0.32); }
.sheet    { position:absolute; top:0; right:0; bottom:0; width:340px; z-index:20;     /* slide-over */
            background:var(--surface); border-left:1px solid var(--border-strong);
            box-shadow:var(--shadow-pop); animation:sheetin .22s var(--ease); }
.takeover { position:absolute; inset:0; background:var(--canvas); z-index:30; animation:fadein .2s var(--ease); }
.palette  { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); z-index:40;  /* centered ⌘K */
            width:540px; background:var(--surface); border:1px solid var(--border-strong);
            border-radius:var(--r-lg); box-shadow:var(--shadow-pop); animation:popin .16s var(--ease); }
.toast    { position:absolute; bottom:18px; left:50%; transform:translateX(-50%); z-index:60;  /* never scrimmed */
            background:var(--surface); border:1px solid var(--border-strong); border-radius:var(--r-md);
            box-shadow:var(--shadow-pop); animation:toastin .2s var(--ease); }
```

### Global keyboard wiring (Esc pops top, ⌘K opens palette over anything)
```js
document.addEventListener('keydown', e=>{
  if (e.key==='Escape') esc();
  if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); open('palette'); }
});
```

## What to Avoid
- **Don't allow two sheets at once.** A new sheet replaces the current one (font ↔ settings never stack).
- **Don't let a takeover kill the toast** — the toast is the courtesy record and survives (035).
- **Don't trap focus in the toast** or pop it with Esc — it dismisses via its own action/timeout only.
- **Don't make the palette replace a sheet** (that's 041-A's loss). The palette stacks **over** the sheet
  and Esc returns to it.
- **Don't treat results/review as modal floats** — they're **destinations** reached via the rail/run-flow
  (031, 033). The ladder governs toast/palette/sheet.
- **Don't scrim the toast** or omit the scrim on sheets/palette/takeover.

## Origin
Synthesized from sketch 041 (modal-stack-choreography, winner **B** — z-ladder, with **C's
"takeovers are destinations" reframe grafted in**; A = single-surface law loses ⌘K-over-a-sheet). The
integration contract over `font-picker.md` (016), `pipeline-settings.md` (032), `command-palette.md`
(036), `background-notifications.md` (035), `render-last-mile.md` (024), `pipeline-inspection.md`
(028/029), consistent with `run-flow-spine.md` (031) and `app-nav-shell.md` (033). Source file in
`sources/041-modal-stack-choreography/` (winner `#v-b`).
