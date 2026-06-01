# Sketch Wrap-Up Summary

**Wrap-up sessions:** 2026-05-31 (sketches 001–011) · 2026-06-01 (sketches 012–015) · 2026-06-01 (sketches 016–018) · 2026-06-01 (sketches 019–022) · 2026-06-01 (sketches 023–026) · 2026-06-01 (sketches 027–030)
**Sketches processed:** 30 (all)
**Design areas:** Workspace Shell, Control Density, Position Presets, Tab Patterns (+ TabLead/TabForm,
Overlays list-forward), Subtitle Styling, Caption Animation Preview, Title Styling (+ entrance timing),
Video Effects/Transitions, Timeline (frontier), Font Picker, Header Action Zone, States & Save,
First-Run/Empty, Responsive Reflow, Motion, Preview Manipulation, Render Surface, Render Last-Mile
(frontier), Metadata/AI Column (AI phase), Pipeline-Step Inspection (frontier), Batch Queue (frontier/ops),
North-Star Composite (015, superseded), North-Star v2 (023, superseded), North-Star v3 (027, current canonical)
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
- **Frontier / next-milestone:** the **timeline** (020-C), the committed-vs-frontier scope line
  (007 drag, 010 render), the **render last-mile** results screen (024-B), the **AI metadata column**
  (026-C), the two **pipeline-step inspection** surfaces (028-B transcript / 029-B silence-cut), and the
  **batch queue** (030-A) are validated *directions*, not Phase-22 control-panel deliverables. The two
  pipeline-step reviews are the strongest delivery on the "cada paso es inspeccionable" promise in AGENTS.md.
