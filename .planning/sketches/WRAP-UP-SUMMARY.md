# Sketch Wrap-Up Summary

**Wrap-up sessions:** 2026-05-31 (sketches 001–011) · 2026-06-01 (sketches 012–015) · 2026-06-01 (sketches 016–018) · 2026-06-01 (sketches 019–022) · 2026-06-01 (sketches 023–026) · 2026-06-01 (sketches 027–030) · 2026-06-01 (sketches 031–032) · 2026-06-02 (sketches 033–036) · 2026-06-02 (sketches 037–039) · 2026-06-02 (sketches 040–043)
**Sketches processed:** 43 (all)
**Design areas:** Workspace Shell, Control Density, Position Presets, Tab Patterns (+ TabLead/TabForm,
Overlays list-forward), PNG Overlay Acquisition (Phase 21), Subtitle Styling, Caption Animation Preview,
Title Styling (+ entrance timing), Video Effects/Transitions, Timeline (frontier), Font Picker,
Header Action Zone, States & Save, First-Run/Empty, Responsive Reflow, Motion, Preview Manipulation,
Render Surface, Render Last-Mile (frontier), Resultados Library/History (frontier), Metadata/AI Column
(AI phase), Pipeline-Step Inspection (frontier), Batch Queue (frontier/ops),
Pipeline Run-Flow Spine (integration), Pipeline Settings Home (processing params),
App Nav Shell v4 (left activity rail), Style Presets (save-a-look),
Background Render/Batch Notifications (toast + Cola-badge), Command Palette / Keyboard Model (⌘K),
North-Star Composite (015, superseded), North-Star v2 (023, superseded), North-Star v3 (027, superseded),
North-Star v4 (037, current canonical Editor screen — real editor in the rail shell),
Error & Failure States (040, inline-at-source), Modal-Stack Choreography (041, z-ladder/integration),
Direct-Manipulation Canvas (042, frontier), Intro/Outro Home (043, dormant/scope-gated)
**Skill output:** `./.claude/skills/sketch-findings-reel-factory/`

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | three-column-shell | D | Workspace Shell |
| 002 | control-density-disclosure | A | Control Density |
| 003 | position-presets | B | Position Presets |
| 004 | overlay-list-and-layering | A | Tab Patterns |
| 005 | subtitles-tab-restructure | C | Tab Patterns |
| 006 | all-three-tabs-coherence | A | Tab Patterns |
| 007 | preview-as-layer-map | A | Preview Manipulation (frontier) |
| 008 | states-and-empties | B | States & Save |
| 009 | motion-coherence | A | Motion |
| 010 | render-export-surface | A | Render Surface (frontier) |
| 011 | subtitle-style-density | C | Subtitle Styling |
| 012 | subtitle-density-in-shell | B | Tab Patterns (TabLead/TabForm) |
| 013 | header-action-zone | B | Header Action Zone |
| 014 | title-style-density | C | Title Styling |
| 015 | north-star-composite | A | North-Star Composite |
| 016 | font-picker | C | Font Picker |
| 017 | first-run-empty-workspace | B | First-Run & Empty Workspace |
| 018 | dense-tabs-at-breakpoint | B | Responsive Breakpoint Reflow |
| 019 | overlays-tab-density | C | Tab Patterns (Overlays list-forward) |
| 020 | timeline-scrubber | C | Timeline / Temporal (frontier) |
| 021 | video-effects-surface | A | Video Effects — Transitions Tab |
| 022 | title-entrance-timing | B | Title Styling (entrance timing) |
| 023 | north-star-v2 | B | North-Star v2 (superseded by 027) |
| 024 | render-last-mile | B | Render Last-Mile / Output (frontier) |
| 025 | caption-animation-preview | C | Caption Animation Preview |
| 026 | metadata-ai-column | C | Metadata / AI Column (AI phase) |
| 027 | north-star-v3 | B | North-Star v3 (current canonical, supersedes 023) |
| 028 | transcript-review | B | Pipeline-Step Inspection (frontier) |
| 029 | silence-cut-review | B | Pipeline-Step Inspection (frontier) |
| 030 | batch-queue | A | Batch Queue / Multi-Job (frontier/ops) |
| 031 | pipeline-run-flow-spine | A | Pipeline Run-Flow Spine (integration, frontier) |
| 032 | pipeline-settings-home | A | Pipeline Settings Home (processing params, frontier) |
| 033 | nav-shell-v4 | B | App Nav Shell v4 (left activity rail; supersedes 027 as the app map) |
| 034 | style-presets | A | Style Presets (save-a-look across 4 tabs; frontier/repeat-use) |
| 035 | background-notifications | D | Background Render/Batch Notifications (toast + Cola-badge; frontier/ops) |
| 036 | command-palette | A | Command Palette / Keyboard Model (⌘K palette; frontier/power-user) |
| 037 | north-star-v4 | B | North-Star v4 (real editor in the rail shell; current canonical Editor screen, supersedes 027) |
| 038 | resultados-library | A | Resultados Library/History (uniform gallery + featured-latest hero graft; frontier) |
| 039 | overlay-png-acquire | B | PNG Overlay Acquisition (drop onto canvas; checkerboard transparency; 3-cap; Phase 21) |
| 040 | error-failure-states | A | Error & Failure States (inline at source; danger never action-green; C's takeover folds in for fatal) |
| 041 | modal-stack-choreography | B | Modal-Stack Choreography (z-ladder + C's destinations graft; integration over the 6 floating surfaces) |
| 042 | direct-manipulation-canvas | C | Direct-Manipulation Canvas (hybrid: resize handles + 9-anchor snap + layer chips; frontier/scope-expanding) |
| 043 | intro-outro-home | B | Intro/Outro Home (timeline endcaps; dormant Phase-6 / scope-gated; C = Video-tab fallback) |

## Excluded Sketches
_None._

## Design Direction
The **dark indigo design system** (canvas `#1a1a2e`, chrome `#16213e`, blue accent `#90caf9`, action
green `#4CAF50`), tuned in OKLCH with tinted-indigo neutrals. Color stays **Restrained**: blue for
selection/focus/current, green for the single primary action. One well-tuned sans (Inter) for UI
chrome on a fixed rem scale; compact spacing rhythm; calm motion (170ms ease-out-quart). The realized
shell synthesis is the 3-column layout from 001-D, and the whole vision composed in one screen is
015-A.

## Key Decisions
- **Shell:** 3-column (content-sized 9:16 preview · 2-col controls · persistent metadata) — 001-D.
- **Density:** always-open Posición→Estilo→Avanzado sections, no collapsible sections — 002-A.
- **Position:** shared 9-point arrow-button preset grid — 003-B.
- **Tabs:** Titles/Overlays = list+form, Subtitles = textarea-led; coherence rule (full-width lead,
  form always 2-col) — 004-A / 005-C / 006-A. Made buildable as the **TabLead / TabForm** two-slot
  skeleton every tab fills — 012-B (`<TabLead>` + `<TabForm>` React contract).
- **Subtitle styling (dense):** layout-mode = preset cards (not dropdown) leading the section,
  in-panel live specimen, 2×2 color-role matrix, collapsible effect-rows (Glow/Fondo), against the
  real ~20-field caption schema — 011-C. Anti-pattern: A's flat ~20 rows = the wall.
- **Title styling (dense):** a title is a **boxed text card + entrance animation**. Specimen (showing
  the box) + **entrance preset cards** (Slide↑/↓·Fade·Ninguna) + 1×2 Texto/Caja color pairing +
  collapsible Glow — 014-C. The 011-C kit **transfers**: mode-cards→entrance-cards,
  color-matrix→box/text, effect-rows→glow. One component set styles both tabs.
- **Header action zone:** split zones — status chip left (by brand), Guardar(outline)+Render(green)
  right with a hairline between — 013-B. **Render is the only green; Guardar never greens (the chip
  carries dirty).** Reconciles 008-B + 010-A; chip holds its left home through render.
- **Font picker:** a **slide-over gallery sheet** opened from a current-font trigger — search +
  category chips over a 2-up grid of cards each rendering the **sample text in its own face**, against
  the real 26-font `AVAILABLE_FONTS` — 016-C. Selection = blue; self-contained shared component for
  Títulos + Subtítulos. Resolves the picker 011 flagged. Anti-pattern: inline scroll-box / popover.
- **States/save:** header status chip; empty/cap/loading states — 008-B.
- **First-run / empty workspace:** cold start = dropzone on the stage + dense controls **live on their
  defaults** (banner: "valores por defecto") — 017-B. Single green = upload; Guardar disabled, Render
  ghosted; metadata persists "Próximamente". Not gated, not a welcome takeover.
- **Responsive reflow:** at the narrow (~360px) column, **reflow the multi-up grids** — 2-col form →
  1-col, mode/entrance cards → 2×2, font grid → 1-up, color matrix stays 2×2 — 018-B. **002-A's
  always-open rule stays intact** (no disclosure-under-pressure). One reflow rule across all three tabs.
- **Overlays tab (dense vs lean):** the real `PngOverlayConfig` is a *small* schema (x/y, width,
  opacity, Capa, cap 3), so Overlays goes **list-forward** — fat per-item cards with inline
  width/opacity/Capa/anchor, no separate detail form — 019-C. ⚠ **Departs from the TabLead/TabForm
  contract** the other tabs share; **019-A (lean shared list+form)** is the named fallback if the
  off-pattern card reads wrong at build. Anti-pattern: 019-B inventing controls (lock-aspect/fit/nudge)
  not in the schema just for parity.
- **Title entrance timing:** plain **numeric rows** — Aparece (`startTimeMs`) / Dura (`durationMs`) /
  Velocidad — in the Tiempo section — 022-B. Division of labor with the global timeline (020-C): the
  timeline does **visual placement**, numeric rows **refine**. One timeline idiom; no per-title track
  (rejected 022-A/C).
- **Video effects / transitions:** **auto-emphasis-zoom DROPPED** (product decision 2026-06-01 — fired
  on Whisper confidence dips = mumbled words, not emphasis; off-brand; memory `auto-zoom-dropped`).
  Survivor `TransitionConfig` (1.08× push / crop-shift masking silence cuts) lives in a **minimal
  "Video" 4th tab** — transition type cards w/ looping motion preview + Duración — 021-A. Anti-pattern:
  rebuild `detectZoomEvents`; flashy preview; over-fill the thin tab (B/C are fallbacks if it stays
  one control).
- **Timeline (frontier / likely next-milestone):** a **strip under stage+controls** (Títulos/Overlays/
  Subtítulos lanes), **metadata column keeps full height** — 020-C. Track surface (not cards),
  scrub-to-preview + drag-to-retime. Middle ground vs preview-only scrubber (020-A) / full-width
  multi-track dock (020-B). Pairs with 022-B's numeric rows as the one timeline idiom.
- **Motion:** calm 170ms two-tier timing — 009-A.
- **Preview (frontier):** drag-to-position on the full preview, sharing the X/Y path — 007-A.
- **Render (frontier):** on the dimmed preview + green-primary reassignment to Render — 010-A.
- **North star & scope line:** the whole thing composed in one screen — 015-A. **Plan-split rule: ship
  the committed editing surface (015-B) first; bolt on the 007 drag + 010 render frontier layers later
  without rework.** The A↔B contrast names the boundary the build plan cuts along.
- **North star v2 (current canonical, supersedes 015):** recomposed after 016–022 — 023-B. **4-tab bar**
  (Títulos·Overlays·Subtítulos·**Video** pushed right via `margin-left:auto` = "per-frame vs global"),
  the timeline strip *inside* the work column (`.leftcol` wraps stage+controls+strip) so the **metadata
  column keeps full height**, list-forward overlays, font slide-over, numeric timing. Strip *places* /
  Tiempo rows *refine* — coordinated, not redundant. Ship B; 007/010/020 frontier layers bolt on.
- **Caption animation preview:** the word-by-word highlight **PLAYS** — 025-C. In-panel specimen loops
  the *style* (judge rhythm), stage transport scrubs the *real moment* (same idiom as the 020 timeline).
  One `paint(target, words, idx, mode)` renderer, two drivers. **Static subtitle specimens (011/014)
  retired.** Anti-pattern: forking the word renderer per surface; static-only preview.
- **Render last-mile (frontier):** where the finished reel lands — **full-screen results takeover**,
  024-B. Reel big + playable, file card (download · `📁 path · copiar ruta` · play · re-render) + AI
  metadata gathered as one "done, time to publish" moment; the metadata column **wakes** with the AI
  caption as the payoff. Single-job re-render surfaced; **download = accent (blue), not green** (Render
  already ran). Closes the core-value loop. Chosen over lighter stage-card (A) / right-column (C).
- **Metadata / AI column (AI phase, forward-looking):** the long-dormant "Próximamente" column awake —
  **per-platform tabs** TikTok/Reels/Shorts, 026-C. Each: tailored caption + its own char-limit counter
  (turns red over limit, e.g. Shorts ≤100) + platform hashtags. Editable in place; lands on 024-B's
  results screen. **Green discipline: Generar/Regenerar/copiar = accent (blue), NEVER action-green** —
  the named test of the sketch. Reserved for the AI phase; justifies the column's reserved ~320–340px.
- **North star v3 (current canonical, supersedes 023 & 015):** 023-B's committed slice refreshed so the
  **caption plays** — 027-B. Folds 025-C's live preview into the full composite: in-panel specimen loops
  the *style*, stage transport scrubs the *real moment*, **both at once**. The finding: the two
  simultaneous animations **stay ambient — no focus-discipline needed** (variant C's auto-pause read as
  "the panel went dead," not relief). One `paint()`, two drivers; the `.rdot` blink is the only animated
  attention-grabber. Ship B; frontier layers (007 drag · 010 render · 020 timeline · awake metadata)
  bolt on. v2's shell/4-tab/timeline CSS is unchanged — v3 only swaps the frozen specimen for the live one.
- **Pipeline-step inspection (frontier / scope-expanding):** the two invisible intermediate outputs earn
  **full-screen review *steps*** (not in-shell tabs), sharing one idiom — a header **step-rail**
  (Audio→Transcripción→Silencios→Render) + a single **"Confirmar … →"** green per surface. Both rejected
  their in-shell variant (cramped / over-reuses the timeline).
  - **Transcript review (028-B):** document-style read-through, ▶ per segment, **click-to-edit any word**.
    **Confidence is the legit flag** (vs the dropped auto-zoom that misread it as emphasis): two-tier
    underline, dotted **amber `<0.78`** / dotted **red `<0.6`** + tint, a "N dudosas" counter ticking down.
    Beat the triage queue (028-C, kept as power-user alt — it skips the 90% Whisper got right, can't catch
    a *confidently wrong* word).
  - **Silence-cut review (029-B):** core-value made inspectable. Before/after stat (`1:48 → 1:12 · −0:36`,
    `to` in accent), a **waveform with every removed silence in red** (click to restore → green), a per-cut
    list (mono range · red duration-bar · **source badge** ×2/ffmpeg/whisper · quitado⇄devuelto toggle).
    Source badge earns trust ("two detectors agreed"), not noise. Beat the sensitivity dial (029-C, kept as
    the "tune the knob, don't micromanage" alt). **Honesty note:** if restoring re-runs `silence-cutter`,
    surface that cost (029-C's "Volver a analizar" is the truthful model).
- **Batch queue / multi-job (frontier / ops):** the "por lotes" promise vs a strictly single-job pipeline,
  honestly — **queue list**, 030-A. Sectioned rows: **Procesando ahora** (one expanded, inline 3-step
  pipeline + progress + ETA) · **En espera** (numbered, drag-to-reorder) · **Fallaron** (the **real OOM**
  error + single ↻ Reintentar) · **Terminados** (⤓ download). An **ambient accent-tinted concurrency
  banner** states *"un video a la vez"* plainly (two renders OOM Chrome). Reached via an Editor⇄Cola header
  switch. **Honest about `MAX_CONCURRENT_JOBS=1`.** Beat the **kanban (030-B** — oversells parallelism the
  pipeline lacks, then has to hard-cap "Procesando" at 1) and the active-hero+strip (030-C). Anti-pattern:
  hide/apologize for the limit; dress the OOM as a generic error; a second action-green on queue chrome.
- **Pipeline run-flow spine (integration / frontier):** the four independently-sketched winners made
  *contradicting* navigation choices never composed together — 010-A inline render ("no modal") vs
  028-B/029-B full-screen review takeovers w/ step-rail + "Confirmar →" gates vs 024-B results takeover
  vs 030 Editor⇄Cola switch. 031 reduces the whole thing to one axis — **is inspection a PULL or a
  PUSH?** — and answers **PULL** (031-A). **Inline-first:** render runs on the **dimmed stage, no
  wizard**; the run stays **in-editor** so the Editor⇄Cola switch persists and "mid-render" reads in
  place. Each reviewable step **soft-pauses (3s auto-continue + a "Revisar" pull** opening 028/029 on
  demand); lands on a **small in-stage results card**, the big 024-B takeover opens **only if asked**.
  Crucially **coherent with single-job/batch (030):** a queued batch **runs auto** (can't gate each
  job), you only ever gate the **one foreground job** — A models exactly that; B's forced wizard can't.
  **One green at a time** (Render idle → Confirmar/Continuar in-flow). Beat the **forced gated wizard
  (031-B**, too heavy per render — its takeover chrome survives as *what a pulled review looks like*)
  and the **per-render toggle (031-C**, defers the decision instead of making one). **Build calibration:**
  the 3s soft-pause is a placeholder — validate against real Whisper/cut latency; keep "Revisar"
  reachable for the *whole* step, not a fixed 3s window. Anti-pattern: wizard-every-render; push-gate a
  batch; change app-mode to render; a second in-flow green.
- **Pipeline settings home (processing params / frontier, scope-expanding beyond Phase 22):** the params
  that drive `pipeline-config.json` — **Whisper model** (tiny→large-v3, *medium* REC), **language** (es
  fixed), **silence sensitivity** (threshold/min-dur/padding), **output** (1080×1920 9:16 **🔒 in v1**,
  FPS, H.264) — had **no home in any of the 31 prior sketches** (the tabs all configure the *look*).
  Resolved to a **slide-over "⚙ Procesamiento" sheet** (032-A) reusing the **016 font-picker
  shared-component idiom** — a header gear opens a right-anchored sheet over the editor; settings live
  one click off the per-element tabs, get real room (6 model chips + live tradeoff hints + sensitivity
  scale breathe), dismiss returns to the look-work untouched. Writes `pipeline-config.json` (same
  `ACTIVE_PIPELINE_CONFIG_PATH` propagation as Studio-saved config). **Green discipline:** the gear is
  neutral → **accent when open** (never green); Aplicar = green, Cancelar = outline. Beat the **5th tab
  (032-B** — breaks the per-element tab contract, muddies the "per-frame vs global" reading the
  right-pushed Video tab established) and the **Render popover (032-C** — overloads the now-load-bearing
  render action from 031-A; kept as the "settings at the moment of commit" alt). **Honest 9:16 lock:** a
  visible *disabled* select with a 🔒 caption beats hiding the constraint. Anti-pattern: 5th tab; couple
  config to Render; hide the lock; green the gear; invent a new slide-over pattern.

- **App nav shell v4 (consistency / north-star recompose — supersedes 027 as the *app map*):** the
  canonical Editor screen (027) was frozen before the queue (030), run spine (031) and settings sheet
  (032) bolted three navigation entry points onto the 013-B header (Editor⇄Cola switch · ⚙ trigger ·
  "Revisar" pull) it was never designed to carry. Resolved to a **left 56px activity rail** (033-B) that
  owns whole-app wayfinding — **Editor · Cola · Resultados · ⚙ · ?** — so the header becomes the
  **purely-contextual bar of the current destination** (content tabs are **editor-only**, never app
  chrome). The Linear/Figma separation of *app-navigation* from *screen-actions*: header stays legible,
  scales to more destinations, active rail button = `accent-tint` + a 3px accent spine, hover labels keep
  terse icons un-cryptic. Beat **header-resident (033-A** — densifies the header, app-switch competes with
  editor actions; kept as fallback) and the **hybrid ⋯-menu (033-C** — buries the Resultados payoff). 027
  stays the canonical *Editor screen*; 033 is the shell it hangs in. **Green discipline:** Render the only
  green; rail neutral/accent; ⚙ accent-when-open; Aplicar green only inside its sheet. Anti-pattern: pile
  app-nav into the header; bury Resultados behind ⋯; leak content tabs off-editor; green the rail.
- **Style presets (save-a-look / frontier, repeat-use):** first-run (017-B) starts every video from
  defaults, but this is a **batch/repeat-use** tool — a pro shouldn't re-dial the look weekly. Resolved to
  an **always-visible header preset bar** (034-A): `Estilo: [Mi estilo TikTok ▾]`, where a saved look is a
  **full four-tab configuration** (swatch/thumbnail renders a real mini-specimen — title box + caption
  word in the look's font/colors — not just a swatch). The **Modificado** divergence state (amber, inline
  in the trigger) **coexists with the save chip** without a second alarm — *diverged-from-preset* vs
  *unsaved-to-disk* are different facts, both low-chroma; applying a preset clears Modificado. "Guardar el
  actual como estilo…" is **gated on divergence**. Beat the **slide-over gallery (034-B** — kept as the
  *management* surface: rename/duplicate, real thumbnails) and the **first-run strip (034-C** — its
  *recall chip* "Desde X ✕" folds into A). **Green discipline:** Aplicar/Guardar-como/Duplicar = accent or
  outline, never action-green. Anti-pattern: preset-as-swatch; Modificado-as-alarm; hide the active look
  behind an open action; frame presets as one-time onboarding; green any preset control.
- **Background render / batch notifications (async-ops / frontier):** the run spine (031) keeps the
  *foreground* render inline on the stage where you watch it, but the queue (030) runs *other* jobs while
  you're elsewhere — completion/OOM must reach you off-stage, honestly framed (it earns its keep mainly
  for **queued-batch**, since foreground renders you watch). Resolved to a **synthesis** (035-D):
  **A's transient toast covers *the moment*** (success auto-dismisses ~5s w/ Abrir/⤓ Descargar; the **OOM
  failure persists** w/ Reintentar/Ver-en-cola, naming the real single-job / Chrome-RAM cause plainly,
  calm `--danger` icon not a red banner) **+ C's Cola-badge tally is *the durable record*** (`✓3 ✕1` on
  the Editor⇄Cola switch, the persistent truth that survives the toast). **Zero new header chrome** — no
  bell (B's notification center held in reserve for if batch volume ever justifies a durable log; reads
  "enterprise" for a per-session tool). **Green discipline:** success = `--success` (not action-green),
  every action link = accent, the reserved green never appears in a notification. Anti-pattern:
  auto-dismiss failures; generic error; ship a bell; rely on the quiet badge alone; green a toast.
- **Command palette / keyboard model (power-user / frontier):** the direction names **Linear/Figma/Raycast**
  and *"the tool disappears into the task"* — a keyboard-first register no prior sketch felt. Resolved to a
  **⌘K palette only** (036-A): a Raycast-style centered overlay, fuzzy search over **grouped** commands
  (Ir a · Acciones · Estilos · Configuración · Ayuda) with **inline shortcut hints** (so it's
  self-teaching), keyboard-complete (↑↓/↵/esc) and pointer-optional (a `⌘K` header pill). The **command
  set is honest** — every row maps to an action that exists elsewhere (tabs 1–4, Render, presets 034,
  queue 030, settings 032, fonts 016); **no palette-only powers**. Beat **palette+cheatsheet (036-B** —
  the palette already shows shortcuts, so a separate `?` map is redundant; kept in reserve as a graduation
  aid) and **direct-bindings-only (036-C** — no discovery surface = unlearnable for the burst-use user;
  but its **G-chord engine + chord cue + ambient hints are kept as accelerators layered *under* the
  palette** for power users). **Green discipline:** Render carries green as its **palette-row icon tint
  only** — no command row, chord cue, or `kbd` badge turns green; selection stays `accent-tint` blue.
  Anti-pattern: ship bindings-only as the model; invent palette-only powers; green a command row; build a
  bolted-on search box instead of the real Raycast idiom.
- **North-star v4 (current canonical Editor screen, supersedes 027):** the canonical Editor (027-B) was
  drawn against the *old header-resident model*, but 033-B moved the brand into a left rail and made the
  header purely-contextual — so 027's whole-screen frame went stale (its content didn't). Resolved by
  composing the **real dense editor** (027-B's 025-C live caption + the 011-C dense Subtitles tab +
  transport) **inside the 033-B rail shell** — 037-B. The recompose-staleness cadence (015→023→027) now at
  the **whole-app** level, resolving real *conflicts* before the React shell builds off a stale picture:
  (1) the **034 preset bar** lost its home beside the brand → rehomed to the **header** as **one dense
  row** (preset takes the brand's freed left slot → Títulos/Subtítulos/Overlays → spacer → Video pushed
  right → status + Guardar + Render), settling that **a saved look is *editor-scoped*** — rejected C which
  put it on the rail as an app-global concept like ⚙; A (preset in a sub-bar with the tabs) kept as the
  calmer fallback if the one row overflows real label widths. (2) the **035-D `✓3 ✕1` tally** lost its
  home when the header Editor⇄Cola vswitch was deleted → rehomed onto the **rail's Cola button** (which
  already carried a `.rdot` marker), small mono digits, `✓`=success / `✕`=danger. The real dense editor
  **coheres** inside the rail shell — same screen everyone had from 027-B, not a different app. **Green
  discipline:** Render the only green; preset, rail, tally, active states all accent/neutral.
  **Supersedes `north-star-v3.md` as the canonical Editor screen** (v3 kept for its caption-coherence
  findings). Anti-pattern: reference 027 as the current whole-screen view; put the preset on the rail;
  leave the tally orphaned near a deleted action; overflow the one dense row; green anything but Render.
- **Resultados as a persistent library / history (frontier, scope-expanding):** the 033-B rail lists
  **Editor · Cola · Resultados** as persistent destinations, but Resultados was only ever drawn as the
  post-render *takeover moment* (024-B). Click it when you *haven't* just rendered and there was no sketch
  — for a repeat-use/batch tool with a real `output/` dir, the honest answer is **your past reels**, a
  browsable library. Resolved to a **uniform 9:16 gallery grid** (038-A) — *but* A's own anti-pattern is
  that identical cards read as monotony (the "SaaS card-grid" cliché, nothing distinguishes the latest
  reel), so the winning build **grafts C's featured-latest hero**: the freshly-rendered reel big +
  playable at the top (`● Recién renderizado`, the 024-B takeover as the default landing) over the uniform
  grid of older reels — **bridges the post-render moment and the durable library**. Grounded in real
  output: MP4 filenames, 1080×1920, durations, sizes, **per-platform metadata badges** (026-C
  TikTok/Reels/Shorts ready-state). **Empty state teaches** what the destination is for without a
  welcome-takeover (017-B idiom: "Todavía no renderizaste ningún reel"). **Green discipline:** the **only**
  green is the empty-state `Ir al editor →` CTA (it routes into the render flow); every per-reel action
  (download/play/re-render) is accent or outline. **Single-job honesty:** re-render re-enters the
  one-at-a-time pipeline. Beat the pure uniform grid (monotony) and pure-C (complexity); **B
  (file-manager list)** kept as the dense management view / view toggle. Anti-pattern: ship the pure
  uniform grid; green a per-reel action; hide the single-job constraint; drop the per-platform metadata;
  build a welcome-takeover empty state.
- **PNG overlay acquisition (Phase 21, live):** the Overlays tab (019-C) was sketched managing *existing*
  overlays, but the **acquisition moment** — drop/upload a PNG → see its transparency → place it on the
  9:16 canvas → the empty→first transition — was never its focus. Resolved by **dropping the PNG directly
  onto the 9:16 canvas** (039-B): it **lands where you drop it**, then appears in the list — **acquire =
  place, one gesture**, tied to the 007 drag-to-position frontier (clicking the mini dropzone drops to
  center as the pointer-free fallback). The load-bearing decision: **PNG transparency renders as a
  checkerboard** — on the list-card thumb *and* as the on-canvas backing — so a logo with alpha reads as
  transparent, **not a black box** (critical for Phase 21). The honest **3-overlay cap** (OOM-adjacent) is
  a **calm disabled dropzone** + amber `N/3` counter matching the 008-B cap state, never an error. The
  **empty→first transition teaches in place** (the tab's empty state *is* the acquire affordance, shrinking
  to a mini "drop another" after the first), flowing into the **019-C list-forward cards** (checkerboard
  thumb · width/opacity/Capa/9-point anchor from 003). The impeccable **no-modal law** shaped it: C's
  `＋ Agregar` is reframed as an *inline* placement bar, not a modal — kept as the most-guided fallback;
  **A (dropzone in the tab)** is the build's path of least resistance (reuses 019-C + 017's dropzone).
  **Green discipline:** Render the only green; dropzone/add/confirm = accent/outline; **delete = quiet
  danger-on-hover**, never a standing red button. Anti-pattern: render transparency as black; open a
  file-picker modal; dress the 3/3 cap as an error; separate acquire from place for a precision tool;
  bolt acquisition onto a separate uploader; give delete a standing red button.

## Open Sub-Problems
- ~~**Font picker** for 26 fonts with live previews~~ — **resolved by sketch 016-C** (slide-over gallery).
- ~~Responsive behavior of the dense tabs~~ — **resolved by sketch 018-B** (reflow the multi-up grids).
- ~~Title-animation timing UI~~ — **resolved by sketch 022-B** (numeric Aparece/Dura/Velocidad rows).
- ~~Zoom-segment editor~~ — **moot:** auto-emphasis-zoom **dropped** (021 / memory `auto-zoom-dropped`).
  If emphasis-zoom is ever revived it needs a real signal (prosody/LLM/manual) + slow held push, as a
  separate spike.
- **Build-time watch (019-C):** the list-forward Overlays tab departs from the TabLead/TabForm contract
  — confirm it reads on-pattern next to the other tabs, else fall back to 019-A.
- ~~Static subtitle specimens can't show rhythm~~ — **resolved by sketch 025-C** (specimen loops style,
  stage transport scrubs the real moment; one shared `paint()` renderer).
- ~~Where the finished reel lands (download/locate/play/re-render) and the metadata payoff~~ — **resolved
  by sketch 024-B** (full-screen results takeover; metadata column wakes).
- ~~The metadata column's real content (AI phase)~~ — **sketched as 026-C** (per-platform AI metadata).
  Still **reserved for the AI phase**, not Phase-22 committed scope — but its shape is now drawn.
- **Build-time watch (023-B / 027-B):** confirm the timeline strip lives *inside* `.leftcol` (work
  column) so the metadata column keeps full height, the 4th "Video" tab reads as "global" pushed right,
  and the live caption preview stays ambient (no focus-discipline) once real footage plays.
- ~~The canonical screen still shows a frozen caption (023 predates 025)~~ — **resolved by sketch 027-B**
  (north-star v3 folds the live preview in; supersedes 023 as the canonical screen).
- ~~No surface reviews the Whisper transcript / lets you fix mishears before captions render~~ —
  **sketched as 028-B** (full-screen transcript read-through; confidence-flagged). Frontier / scope-expanding.
- ~~No surface shows what the silence-cutter removed or lets you toggle a cut back~~ — **sketched as
  029-B** (full-screen per-cut review w/ waveform). Frontier / scope-expanding; the core-value made inspectable.
- ~~The "por lotes" promise has no multi-video / job-status surface~~ — **sketched as 030-A** (queue list,
  honest single-job concurrency). Frontier / ops; may belong outside the Studio for a one-person tool.
- ~~The render/inspection/results/queue winners make contradicting navigation choices never composed
  together — what's the actual flow when you hit Render?~~ — **resolved by sketch 031-A** (inline-first,
  review = pull: render on the dimmed stage, soft-pause + "Revisar" per reviewable step, batch runs auto,
  one green at a time). The integration spine that reconciles 010/028/029/024/030.
- ~~The pipeline params (Whisper model, language, silence sensitivity, output res/codec) have no home in
  any sketch~~ — **resolved by sketch 032-A** (slide-over "⚙ Procesamiento" sheet reusing the 016
  font-picker idiom; off the per-element tabs; writes `pipeline-config.json`). Scope-expanding beyond
  Phase 22 — the marker for *where* settings land when built.
- **Build-time watch (031-A):** the 3s soft-pause countdown is a placeholder — calibrate against real
  `faster-whisper` + `silence-cutter` latency; keep the "Revisar" pull reachable for the whole step, not
  a fixed 3s window after completion.
- ~~The whole-app wayfinding went stale once 030/031/032 accreted destinations the 013-B header was
  never designed to carry~~ — **resolved by sketch 033-B** (left activity rail; app-nav vs screen-actions;
  supersedes 027 as the *app map*). Consistency / north-star recompose.
- ~~A batch/repeat-use tool re-dials the look from defaults every video, with no home for saved looks~~ —
  **resolved by sketch 034-A** (always-visible header preset bar; a look = all 4 tabs; ambient Modificado
  state). Frontier / repeat-use.
- ~~Queued renders finish off-stage with no way for completion/OOM to reach you~~ — **resolved by sketch
  035-D** (toast for the moment + Cola-badge tally as the durable record; OOM-honest; zero new chrome).
  Frontier / async-ops.
- ~~The Linear/Figma/Raycast direction is keyboard-first but no sketch felt the keyboard layer~~ —
  **resolved by sketch 036-A** (⌘K command palette as the single discoverable entry point over an honest
  command set; G-chord accelerators layered underneath). Frontier / power-user.
- **Build-time watch (033-B):** confirm content tabs (Títulos/Overlays/Subtítulos/Video) appear **only in
  the Editor** destination and never leak into the rail's Cola/Resultados contextual headers — the rail's
  app-scope vs screen-scope clarity depends on it.
- ~~027 (v3) was drawn against the old header-resident model; the rail (033) made its whole-screen frame
  stale~~ — **resolved by sketch 037-B** (north-star v4: the real dense editor recomposed inside the
  033-B rail shell; preset → header/editor-scoped, 035-D tally → rail Cola button). Supersedes 027 as the
  canonical Editor screen.
- ~~The rail promises Resultados as a persistent destination but only its post-render takeover (024-B) was
  drawn — what's there when you open it later?~~ — **resolved by sketch 038-A** (a browsable library/
  history of finished reels; uniform 9:16 gallery + a featured-latest hero grafted from C; empty-state
  teaches the surface; grounded in real `output/`). Frontier / scope-expanding.
- ~~The Overlays tab (019) managed *existing* overlays; the PNG **acquisition** moment (drop → preview
  transparency → place) was never sketched~~ — **resolved by sketch 039-B** (drop onto the 9:16 canvas /
  acquire = place; checkerboard transparency so alpha reads; calm 3-overlay cap; flows into 019-C cards).
  Phase 21, live.
- **Error & failure states:** **inline at the source** — each fault surfaces where it originated
  (dropzone reject w/ the real `ffprobe`/codec reason; Whisper-down as a calm panel over the dimmed
  stage, "el resto del editor sigue funcionando"; save-failed flips the header chip→`No se guardó` and
  the button→`Reintentar guardado`) — 040-A. **No global error chrome; context explains the fault.**
  Danger is its own **low-chroma red, never the reserved action-green**; the real cause line
  (ECONNREFUSED/ENOSPC/signal 9) sits mono+muted under the plain-language explanation. **C's takeover
  idiom folds into A** for the genuinely fatal blocks (Whisper/disk/OOM). Completes the off-happy-path
  coverage (008 happy-off + 035 OOM completion). Anti-pattern: a header banner for a small recoverable
  fault (040-B over-weights it); alarm-red; locking the whole editor on a transcription fault.
- **Modal-stack choreography (integration):** one **z-ladder** governs the six independently-sketched
  floating surfaces — toast 60 (never traps focus, survives a takeover) ▸ palette 40 (opens **over** a
  sheet, Esc returns to it) ▸ takeover 30 (owns the screen, clears floats but the toast) ▸ sheet 20
  (scrim + Esc, one sheet at a time) — 041-B. The build encodes the ladder literally as `Z = {…}`
  constants. **C's "takeovers are *destinations*" reframe grafts on** (results/review are reached via the
  rail/run-flow per 031/033, so the ladder really governs only toast/palette/sheet). Anti-pattern: two
  sheets at once; a takeover killing the toast; the palette *replacing* (not stacking over) a sheet
  (041-A's loss); scrimming the toast.
- **Direct-manipulation canvas (frontier):** the complete on-canvas editing model = **hybrid** — resize
  **handles** for size (the one thing the panel does worst) + position still **snaps to the 9 anchors**
  with guides (the shared X/Y path, canvas px → 1080×1920 at ×4) + an on-canvas **layer-chip stack** to
  pick an overlapped element — 042-C. Caption stays bottom-anchored (not free-dragged). Realizes the 007
  drag frontier while keeping "global places / panel refines" (020-C/022-B/025-C). Anti-pattern: full
  Figma box-transform (A, over-chrome); resize-as-slider (B, indirect); drag/numeric X-Y divergence;
  covered elements unselectable.
- **Intro/outro home (DORMANT / scope-gated):** ⚠️ a *dormant* Phase-6 capability with **no
  `intro`/`outro` section in `pipeline-config.json` — confirm revival is in scope before building.** If
  revived: **timeline endcaps** — intro/outro as blocks bracketing the timeline body track (whole-clip
  category, like transitions, not per-element); tap → config in panel — 043-B. **Depends on the 020-C
  timeline frontier shipping**, so until then **C (Video-tab section) is the fallback host** and A (5th
  tab) is the heavier alternative; B is a *layer* on C/A, not standalone. The sketch is **also evidence
  the feature may stay cut** as general-editor scope-creep on a talking-head reel maker. Anti-pattern:
  building without an explicit revival decision; filing it among the per-element tabs; greening the
  enable toggles.
- **Build-time watch (037-B):** the one dense header row carries a lot (preset + 4 tabs + status + 2
  actions) — validate against real label widths; if it overflows, fall back to **037-A** (preset in a
  sub-bar with the tabs, two calm rows). And confirm the 035-D `✓3 ✕1` tally reads legibly on the rail
  Cola button rather than wanting to be back near an action.
- **Build-time watch (038-A):** the winner is A's uniform grid **plus** C's featured-latest hero — don't
  ship the pure uniform grid (its own monotony anti-pattern). Confirm the hero/grid rhythm reads, and
  decide whether re-render warns about the single-job pipeline or defers to the queue (030).
- **Build-time watch (039-B):** the checkerboard must back **both** the list-card thumb and the on-canvas
  overlay so a transparent PNG never reads as a black box; confirm "lands where you drop it" (canvas drag)
  is worth the plumbing over A's tab-dropzone fallback for the Phase-21 budget.
- **Frontier / next-milestone:** the **timeline** (020-C), the committed-vs-frontier scope line
  (007 drag, 010 render), the **render last-mile** results screen (024-B), the **Resultados library**
  (038-A), the **AI metadata column** (026-C), the two **pipeline-step inspection** surfaces (028-B
  transcript / 029-B silence-cut), the **batch queue** (030-A), the **run-flow spine** (031-A), the
  **pipeline settings sheet** (032-A), the **app nav shell / left activity rail** (033-B), **style
  presets** (034-A), **background notifications** (035-D), and the **⌘K command palette** (036-A) are
  validated *directions*, not Phase-22 control-panel deliverables. The two pipeline-step reviews + the
  run-flow spine are the strongest delivery on the "cada paso es inspeccionable" promise in AGENTS.md;
  033-B is the whole-app frame the rest hang in, and **037-B (north-star v4) is now the canonical Editor
  screen inside it**. **PNG overlay acquisition (039-B) is the exception — it ships now for the live
  Phase 21 feature**, not a future milestone.
