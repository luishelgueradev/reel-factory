# App Nav Shell v4 — Whole-App Wayfinding (supersedes 027 as the app map)

The canonical screen (027 / north-star v3) was frozen **before** the queue (030), the run-flow spine
(031), and the settings sheet (032) existed. Each of those bolted a navigation entry point onto the
header without anyone drawing them together:

- the **Editor⇄Cola** mode switch (030),
- the **⚙ Procesamiento** slide-over trigger (032),
- the run-flow spine's inline render + **"Revisar"** pull (031),
- and the **Resultados** takeover (024-B) that a finished render opens.

The header contract (013-B: status chip left · Guardar+Render right) was designed for **just the
editor**. Sketch 033 asks whether it still holds once the bar must also reach the queue, the results
screen, and global settings — the same recompose cadence that produced 015→023→027, now at the
**whole-app** level rather than the run-flow (which 031 already resolved).

The app has **5 real destinations/surfaces**: Editor · Cola · Resultados · ⚙ Procesamiento · (help /
⌘K). The question is which navigation model honors *"the tool disappears into the task"* while staying
honest about all five.

⚠️ **Scope note.** 033 is a **consistency / north-star recompose**, not new feature scope. It reconciles
surfaces that already have winners. Its output is *where app-nav lives* — the resting-state wayfinding
shell the real React app hangs every destination off. It **supersedes 027 as the app map** (027 stays
the canonical *Editor screen*; 033 is the frame around it).

## Design Decisions

### Winner 033-B — left activity rail (the Linear / Figma idiom)
A **thin 56px icon rail** owns *"where am I in the app"* — `Editor · Cola · Resultados`, a spacer, then
`⚙ · ?`. The header below it becomes the **purely-contextual bar of the current destination**: in the
Editor it carries the 4 content tabs + status chip + Guardar + Render; in Cola/Resultados it carries
*that* surface's name and actions. This is the canonical separation **app-navigation (rail) vs
screen-actions (header)** that Linear/Figma/Raycast use, and it's exactly the craft bar the whole
direction names.

Why it wins:
- **The header gets legible again.** 013-B's split-zone header was already full (chip · Guardar ·
  Render). Adding an app-level destination switch *next to* those actions (variant A) puts **two
  navigation-shaped controls** (mode switch + content tabs) plus two actions plus a chip plus ⚙ in one
  bar — it densifies past the point the dense-but-deliberate register tolerates.
- **It scales.** Five destinations today; a sixth (e.g. a templates/presets home from 034, or a history
  view) drops into the rail as one more icon with **zero header cost**. A header-resident switch (A)
  has no room to grow.
- **"Contextual bar changes per destination" reads cleanly.** The content tabs (Títulos/Overlays/…)
  **only appear in the Editor** — because they *are* editor controls, not app nav. The rail makes that
  obvious: tabs live in the header (screen scope), destinations live in the rail (app scope).
- **Active state is unmistakable.** The active rail button gets `accent-tint` fill + a 3px accent
  spine on its left edge; hover reveals a tooltip label (the icons stay terse but never cryptic).

### Why the rail beat header-resident (A) and the hybrid (C)
- **A — todo en el header:** the top bar carries brand · Editor⇄Cola⇄Resultados switch · ⚙ · chip ·
  Guardar · Render, with the 4 content tabs pushed to a sub-bar. *One* navigation row, but the header
  **densifies past comfort** and the app-level switch **competes** with the editor's own actions for the
  same eye. Two different kinds of "navigation" (which app screen vs which element tab) sit adjacent and
  blur. Rejected — but it's the **fallback if a left rail ever feels too heavy for a 5-destination tool**.
- **C — híbrido:** the frequent **Editor⇄Cola** switch stays a header segment; the set-once-ish
  destinations (Resultados · ⚙ · ⌘K · atajos) collapse into a **"⋯" app menu**. Fewest visible pieces —
  but **burying Resultados hides the payoff of the whole tool**: the finished reel is the core value
  (024-B), and tucking it behind a "⋯" reads as hiding the reward. Rejected. *(The Editor⇄Cola-in-header
  pattern itself is sound and survives as the 030 switch — C just over-hid the rest.)*

### What stays fixed from earlier findings
- **Green discipline holds across the whole app.** Render is the only green; the ⚙ rail button is
  neutral→accent-when-open; **Aplicar is green only inside its own sheet** (032). Never two greens.
- **The ⚙ sheet opens identically from any destination** — it's a *global* param surface (032), so it's
  a rail button, not a per-screen action. Scrim covers the whole app (`inset: 46px 0 0` below the
  sketch harness; `inset: 0` in the real app).
- **The status chip keeps its left home through render** (013-B / states-and-save-feedback): in the
  rail model it lives in the Editor's contextual header, ambient, by brand-adjacent.

## CSS / HTML Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### The activity rail (B) — 56px icon column, accent spine on active
```css
.rail      { width:56px; flex:none; background:var(--chrome); border-right:1px solid var(--border);
             display:flex; flex-direction:column; align-items:center; padding:var(--s-6) 0; gap:var(--s-3); }
.rlogo     { width:30px; height:30px; border-radius:var(--r-sm);
             background:linear-gradient(145deg,var(--accent),var(--accent-strong));
             display:grid; place-items:center; font-weight:800; color:var(--stage); margin-bottom:var(--s-6); }
.railbtn   { width:40px; height:40px; border-radius:var(--r-sm); border:none; background:none;
             color:var(--text-muted); display:grid; place-items:center; font-size:17px;
             position:relative; transition:all var(--dur) var(--ease); }
.railbtn:hover { background:var(--surface-2); color:var(--text); }
.railbtn.on    { background:var(--accent-tint); color:var(--accent); }
.railbtn.on::before { content:""; position:absolute; left:-8px; top:8px; bottom:8px; width:3px;
                      border-radius:2px; background:var(--accent); }          /* the active spine */
.rail .rsp { flex:1; }                                                         /* pushes ⚙ / ? to the bottom */
```
```css
/* hover-revealed label tooltip — icons stay terse but never cryptic */
.railbtn .lab { position:absolute; left:48px; top:50%; transform:translateY(-50%);
                background:var(--surface); border:1px solid var(--border-strong); color:var(--text);
                font-size:var(--t-xs); font-weight:500; padding:4px 9px; border-radius:var(--r-xs);
                white-space:nowrap; opacity:0; pointer-events:none; transition:opacity var(--dur);
                box-shadow:var(--shadow-md); z-index:50; }
.railbtn:hover .lab { opacity:1; }
.railbtn .rdot { position:absolute; top:6px; right:6px; width:7px; height:7px; border-radius:50%;
                 background:var(--accent); }                                   /* "queue has activity" */
```

### The contextual header — same 52px bar, content changes per destination
```css
.hdrB { height:52px; flex:none; display:flex; align-items:center; gap:var(--s-6);
        padding:0 var(--s-12); background:var(--chrome); border-bottom:1px solid var(--border); }
.hdrB .ctxname { font-size:var(--t-md); font-weight:600; color:var(--text); }  /* destination name */
```
```html
<!-- rail = app nav; header = this destination's name + (editor-only) tabs + actions -->
<nav class="rail">
  <div class="rlogo">R</div>
  <button class="railbtn on" data-d="editor">✎<span class="lab">Editor</span></button>
  <button class="railbtn"    data-d="cola">≣<span class="lab">Cola · 3 en proceso</span><span class="rdot"></span></button>
  <button class="railbtn"    data-d="resultados">✓<span class="lab">Resultados</span></button>
  <div class="rsp"></div>
  <button class="railbtn" onclick="openSheet()">⚙<span class="lab">Procesamiento</span></button>
  <button class="railbtn">?<span class="lab">Atajos (⌘K)</span></button>
</nav>
<div class="colB">
  <header class="hdrB">
    <span class="ctxname">Editor</span>
    <div class="ctabs"><!-- Títulos·Overlays·Subtítulos·Video — EDITOR ONLY --></div>
    <div class="spacer"></div>
    <span class="chip dirty"><span class="dot"></span>Cambios sin guardar</span>
    <button class="btn btn-out">Guardar config</button>
    <button class="btn btn-green">▶ Render</button>
  </header>
  <!-- destination body: editor / cola / resultados swaps here; tabs hidden off-editor -->
</div>
```

### The destination-swap rule
One function renders the current destination's body **and** updates: (1) which rail button is `.on`,
(2) the header `ctxname`, (3) **tabs visible only when `dest === 'editor'`**. The content tabs are an
editor concern, never app chrome.

## What to Avoid
- **Don't pile app-nav into the header (033-A).** Two navigation-shaped controls (mode switch + content
  tabs) + two actions + chip + ⚙ overloads 013-B's already-full split bar and makes the app-switch
  compete with editor actions.
- **Don't bury Resultados behind a "⋯" menu (033-C).** The finished reel is the core-value payoff
  (024-B); hiding it reads as hiding the reward. Frequent-modes-in-header is fine; over-hiding the rest is not.
- **Don't show the content tabs outside the Editor.** They're per-element editor controls, not app
  navigation — leaking them into Cola/Resultados breaks the rail's "app scope vs screen scope" clarity.
- **Don't green the rail.** Active rail buttons are `accent-tint`; ⚙ is accent-when-open. Render stays
  the only green, in the Editor's contextual header.
- **Don't make rail icons cryptic.** Terse glyphs are fine *because* every one has a hover label; drop
  the tooltip and the rail becomes a guessing game.

## Origin
Synthesized from sketch 033 (nav-shell-v4, winner **B** — left activity rail; A = header-resident
rejected for densifying the header & app/screen-nav competing, C = hybrid rejected for burying the
Resultados payoff). **Supersedes 027 as the whole-app map** (027 remains the canonical Editor screen).
Reconciles the navigation entry points from 030 (Editor⇄Cola), 031 (run spine / Revisar pull), 032
(⚙ sheet), 024-B (Resultados). Coheres with `header-action-zone.md` (013-B contextual header now lives
*below* the rail) and `run-flow-spine.md`. Source file in `sources/033-nav-shell-v4/` (winner `#v-b`).
