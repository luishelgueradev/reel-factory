# Command Palette / Keyboard Model — The ⌘K Layer for the Dense Panel

The whole design direction names **Linear / Figma / Raycast** as the craft bar and *"the tool disappears
into the task"* as the register. That idiom is **keyboard-first** — but every sketch through 035 was
pointer-driven. Sketch 036 asks what the **keyboard layer** is for this dense panel: a discoverable
**⌘K command palette** (search every action, jump to any tab, apply a preset, render, open the queue /
settings)? The palette plus a learnable **cheat sheet**? Or **direct bindings only**?

The command palette is an **explicitly sanctioned product pattern** — *not* the banned reach-for-a-modal
— so the real question is which keyboard model fits a tool used in **focused bursts**.

⚠️ **Frontier / power-user.** Beyond Phase 22 look-polish; settles the keyboard model so the real build
has one discoverable entry point that scales with the app's actions.

## Design Decisions

### Winner 036-A — palette only (⌘K), the single discoverable entry point
A **Raycast-style centered overlay**: fuzzy search over **grouped** commands (Ir a · Acciones · Estilos ·
Configuración · Ayuda), each row showing its **icon, sub-label, and shortcut hint**, with the primary
**Render** command tinted **action-green in its icon only**. It's **keyboard-complete** (↑↓ navigate, ↵
run, esc close) and **pointer-optional** (click a row, or the `⌘K` header pill). One surface is the
discoverable home for *everything the app can do*.

Why it wins:
- **It's the idiom users already trust.** Fuzzy match + grouping + inline shortcut hints + keyboard-complete
  *is* the Linear/Raycast pattern the whole direction cites — not a bolted-on search box.
- **It's self-teaching.** The palette **shows each command's shortcut next to it**, so it doubles as the
  discovery surface that *graduates* users toward direct keys — which makes B's separate cheat sheet
  largely **redundant** for a focused tool.
- **It scales with the app.** Every destination/action already lives somewhere (tabs, render, presets
  034, queue 030, settings 032, fonts 016); the palette indexes them in one place and **grows by adding
  a registry entry**, not new chrome.
- **One discoverable door** fits *"used in focused bursts"* better than a no-discovery binding scheme:
  open ⌘K, type, run — nothing to memorize cold.

### Why the palette-only beat palette+cheatsheet (B) and direct-bindings (C)
- **B — palette + cheat sheet:** the same ⌘K palette **plus** a `?` overlay mapping every binding, plus
  inline `kbd` hints on header buttons. Tests whether the palette alone teaches itself — and the finding
  is **it does**: the palette already shows shortcuts per row, so a separate memorizable card is extra
  surface for a burst-use tool. *Kept in reserve: the `?` cheat-sheet overlay and inline `kbd` hints are
  a clean graduation aid if power users ask for a printable map — additive, not core.*
- **C — direct bindings only (no overlay):** single keys switch tabs (1–4); chords run actions
  (**G→R** render, **G→E** apply style, **G→F** font), with a persistent ambient hint card + inline
  `kbd` badges. The **vim-register take** — fastest for a *memorized* tool, nothing to open — but a
  **steep cold-start with no discovery surface** makes it unlearnable for the occasional user, the exact
  user a burst-use tool has. Rejected as the model. *Kept: the **G-chord engine + chord cue** and the
  **ambient hint card** are excellent **accelerators layered under** the palette — power users get chords,
  everyone else gets ⌘K. The inline `kbd` on Render (`G R`) and Guardar (`⌘S`) are worth shipping.*

### The command set must be HONEST
The palette lists **only actions that exist elsewhere in the app** — tabs (1–4), Render, presets (034),
queue (030), settings (032), fonts (016), help. It **invents no palette-only powers**. The palette is a
*faster route to existing capability*, never a second, hidden feature set. Every row maps to a real
control the pointer can also reach.

### Green discipline (tight)
**Render is the only action that carries green** — and only its **palette-row icon tint** + the existing
header button. **No command row background, no chord cue, no `kbd` badge turns green.** The selected
palette row uses `accent-tint` (blue), exactly like every other selection in the system. Render's green
is a one-pixel signal (the `▶` icon), not a green row.

### Keyboard-complete + accessible defaults
- `⌘K` / `Ctrl+K` opens from anywhere; `esc` closes; `↑↓` move selection (with `scrollIntoView`); `↵`
  runs the selected row; typing fuzzy-filters and **highlights the matched substring** (`<em>` in accent).
- Selection follows both keyboard and `mousemove` (hover sets `palSel`) so pointer and keyboard never fight.
- The footer always shows `↑↓ navegar · ↵ ejecutar · esc cerrar` — the palette teaches its own controls.

## CSS / HTML Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### The palette overlay (A) — centered, scrim, fuzzy, grouped
```css
.palscrim       { position:fixed; inset:0; background:oklch(0.12 0.02 280 / 0.55); display:none;
                  z-index:300; align-items:flex-start; justify-content:center; padding-top:12vh;
                  animation:fadein .12s var(--ease); }
.palscrim.show  { display:flex; }
.pal            { width:580px; max-width:92vw; max-height:64vh; background:var(--surface);
                  border:1px solid var(--border-strong); border-radius:var(--r-lg);
                  box-shadow:var(--shadow-pop); overflow:hidden; display:flex; flex-direction:column;
                  animation:palin .18s var(--ease); }
.pal .pin input { flex:1; background:none; border:none; outline:none; color:var(--text); font:inherit; font-size:var(--t-lg); }
.pal .grp       { font-size:var(--t-2xs); color:var(--text-muted); letter-spacing:0.07em;
                  text-transform:uppercase; padding:var(--s-5) var(--s-5) var(--s-3); }  /* group headers */
.pcmd           { display:flex; align-items:center; gap:var(--s-6); padding:9px 10px;
                  border-radius:var(--r-sm); cursor:pointer; }
.pcmd.sel       { background:var(--accent-tint); }                          /* selection = blue, like everything else */
.pcmd .cl em    { font-style:normal; color:var(--accent); font-weight:700; } /* matched-substring highlight */
.pcmd .ck       { margin-left:auto; display:flex; gap:4px; }                 /* inline shortcut hint — self-teaching */
.pcmd.primary .ci { color:var(--action); }                                  /* Render: green ICON ONLY, never the row */
@keyframes palin { from { opacity:0; transform:translateY(-10px) scale(0.985); } to { opacity:1; transform:none; } }
```
```css
.kbd { font-family:var(--mono); font-size:var(--t-2xs); font-weight:600; background:var(--surface-2);
       border:1px solid var(--border); border-bottom-width:2px; border-radius:var(--r-xs);
       padding:1px 6px; color:var(--text-2); min-width:18px;
       display:inline-flex; align-items:center; justify-content:center; }   /* the keycap, reused everywhere */
.kpill { display:inline-flex; align-items:center; gap:6px; background:var(--surface);
         border:1px solid var(--border); border-radius:var(--r-sm); padding:4px 9px;
         font-size:var(--t-xs); color:var(--text-muted); cursor:pointer; }  /* header ⌘K trigger — pointer-optional */
```

### The honest command registry — one entry per real capability
```js
const COMMANDS = [
  { grp:'Ir a',          ic:'1', label:'Tab: Títulos',     sub:'editar el título',          keys:['1'],      run:v=>setTab(v,'tit') },
  { grp:'Ir a',          ic:'≣', label:'Ir a la Cola',     sub:'estado de los renders',     keys:['⌘','2'],  run:_=>goCola() },        // 030
  { grp:'Acciones',      ic:'▶', label:'Render',           sub:'generar el reel',           keys:['G','R'], primary:true, run:_=>render() }, // green icon only
  { grp:'Acciones',      ic:'⤓', label:'Guardar config',   sub:'persistir cambios',         keys:['⌘','S'],  run:_=>save() },
  { grp:'Estilos',       ic:'◫', label:'Aplicar estilo: Mi estilo TikTok', sub:'preset guardado', keys:['G','E'], run:_=>applyPreset() }, // 034
  { grp:'Configuración', ic:'⚙', label:'Procesamiento…',   sub:'Whisper · idioma · silencio · salida', keys:['⌘',','], run:_=>openSettings() }, // 032
  { grp:'Configuración', ic:'𝐀', label:'Buscar fuente…',   sub:'galería de 26 fuentes',     keys:['G','F'],  run:_=>openFonts() },     // 016
  // …every row maps to a control the pointer can also reach — no palette-only powers
];
```

### The keyboard engine — ⌘K + accelerator chords layered under the palette (from C, kept)
```js
// ⌘K / Ctrl+K opens from anywhere
if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); openPal(); return; }
// when palette open: ↑↓ select, ↵ run, esc close (keyboard-complete)
// power-user accelerators UNDER the palette: number keys = tabs, G-chord = actions
if (chordPending === 'g') { if (key==='r') render(); else if (key==='e') applyPreset(); else if (key==='f') openFonts(); chordPending=null; return; }
if (['1','2','3','4'].includes(e.key)) { setTab(TABS[+e.key-1].k); return; }
if (e.key.toLowerCase()==='g') { chordPending='g'; chordCue('G luego… R render · E estilo · F fuente'); /* guided, not arcane */ }
```
The **chord cue** (a centered hint that appears after `G` and lists the next keys) makes chords feel
**guided rather than memorized** — the accelerator path for power users that *doesn't* gate the
occasional user, who just uses ⌘K.

## What to Avoid
- **Don't ship direct-bindings-only (C as the model).** No discovery surface = unlearnable for the
  burst-use / occasional user the tool actually has. Keep chords as *accelerators under* the palette.
- **Don't add a separate cheat sheet as core (B as primary).** The palette already shows each shortcut
  inline and teaches itself; reserve the `?` overlay as an additive graduation aid only if asked.
- **Don't invent palette-only powers.** Every command must map to a real control reachable by pointer;
  the palette is a faster route, never a hidden second feature set.
- **Don't green a command row.** Render's green is its `▶` icon tint *only* (`.pcmd.primary .ci`); the
  selected row stays `accent-tint` blue, like every selection in the system. No chord cue or `kbd` greens.
- **Don't make it a bolted-on search box.** Honor the Raycast idiom: grouping, fuzzy match with
  substring highlight, inline shortcut hints, full keyboard control, a self-describing footer.
- **Don't fight pointer and keyboard.** Hover sets the same selection index the arrows do; both paths
  converge on one `palSel`.

## Origin
Synthesized from sketch 036 (command-palette, winner **A** — palette only / ⌘K; B = palette+cheatsheet,
its `?` overlay kept in reserve as a graduation aid; C = direct-bindings-only rejected as the model but
its **G-chord engine + chord cue + ambient hints kept as accelerators layered under the palette**).
Indexes capabilities from across the app: tabs (027/north-star), Render (`run-flow-spine.md`), presets
(`style-presets.md`, 034), queue (`batch-queue.md`, 030), settings (`pipeline-settings.md`, 032), fonts
(`font-picker.md`, 016). Realizes the Linear/Figma/Raycast craft bar the whole direction names. Source
file in `sources/036-command-palette/` (winner `#v-a`).
