---
name: sketch-findings-reel-factory
description: Validated design decisions, CSS patterns, and visual direction from Phase 22 sketch experiments for the Remotion Studio control panel (3-column shell, control density, position presets, per-tab structure & TabLead/TabForm skeleton, subtitle & title styling controls, animated caption preview, title entrance timing, overlays tab density, font picker, header action zone, render surface, render last-mile/results screen, AI metadata column, transitions Video tab, timeline strip, drag-to-position, first-run/empty workspace, responsive breakpoint reflow, north-star v3 canonical screen w/ live preview & scope boundary, pipeline-step inspection (transcript & silence-cut review), batch queue / multi-job status, pipeline run-flow spine (render·inspection·results·queue reconciled), pipeline settings home / processing-params sheet, app-level nav shell / left activity rail, named style presets, background render/batch notifications, ⌘K command palette / keyboard model). Auto-loaded during UI implementation on reel-factory.
---

<context>
## Project: reel-factory

Phase 22 polishes the Remotion Studio control surface into a **dense, deliberate, professional
control panel** (product register — earned familiarity, the tool disappears into the task) while
preserving the established **dark indigo design system**. Reference craft bar: Linear / Figma /
Raycast-grade control panels. The surface being elevated is
`services/remotion-studio/src/preview/PreviewApp.tsx` (the existing dark 2-column shell).

These findings come from the sketch pass for Phase 22 decision D-05 — layout and density questions
explored as throwaway HTML before the real React redesign.

Sketch sessions wrapped: 2026-05-31 (sketches 001–003: shell, density, presets), 2026-05-31
(sketches 004–007: per-tab structure, overlay layering, subtitles textarea, tab coherence, and the
frontier drag-to-position surface), 2026-05-31 (sketches 008–010: off-happy-path states & save
feedback, motion/timing coherence, and the frontier render/export surface), 2026-05-31 (sketch 011:
subtitle styling control density against the full real caption schema), 2026-06-01 (sketches 012–015:
the TabLead/TabForm coherence skeleton, the reconciled header action zone, title styling density, and
the north-star composite with its committed-vs-frontier scope boundary), 2026-06-01 (sketches 016–018:
the slide-over font-picker shared component, the first-run/empty-workspace cold start, and the
responsive breakpoint reflow rule for the dense tabs), 2026-06-01 (sketches 019–022: the list-forward
Overlays tab against its small real schema, the frontier timeline strip, the minimal transitions
"Video" tab with auto-emphasis-zoom dropped as a product decision, and numeric title entrance timing),
2026-06-01 (sketches 023–026: the recomposed **north-star v2** that supersedes 015 as the canonical
screen, the **render last-mile** results takeover that closes the core-value loop, the **animated
caption preview** that retires static subtitle specimens, and the **per-platform AI metadata column**
that finally wakes the long-dormant right column), 2026-06-01 (sketches 027–030: **north-star v3** that
folds the live caption preview into the canonical screen and supersedes 023, the two **pipeline-step
inspection** surfaces — full-screen transcript review and silence-cut review that make the
"inspeccionable" promise legible — and the **batch queue / multi-job status** view that's honest about
the single-job `MAX_CONCURRENT_JOBS=1` / Chrome-OOM constraint), 2026-06-01 (sketches 031–032: the
**pipeline run-flow spine** that reconciles the independently-sketched render / inspection / results /
queue winners into one *inline-first, review-as-pull* navigation model, and the **pipeline settings
home** — a slide-over "⚙ Procesamiento" sheet (reusing the 016 font-picker idiom) that finally gives
the non-look processing params, Whisper model / language / silence sensitivity / output, a home off the
per-element tabs), 2026-06-02 (sketches 033–036: the **app nav shell v4** — a left 56px activity rail
that owns whole-app wayfinding (Editor·Cola·Resultados·⚙) so the header goes purely contextual,
**superseding 027 as the app map** once 030/031/032 accreted destinations the 013-B header was never
designed to carry; **named style presets** — an always-visible header preset bar where a saved "look"
captures all four tabs at once, with an ambient *Modificado* divergence state distinct from the save
chip; **background render/batch notifications** — a synthesis of a transient toast (the moment, OOM
persists) + a durable Cola-badge tally (`✓3 ✕1`, the persistent record), zero new header chrome,
honest about single-job-foreground vs queued-batch; and the **⌘K command palette** — a Raycast-style
discoverable keyboard entry point over an honest command set, with C's G-chord accelerators kept layered
underneath for power users).
</context>

<design_direction>
## Overall Direction

A 3-column workspace shell — **content-sized 9:16 preview · controls that grow into two internal
columns · persistent ~320px social-metadata placeholder** ("Próximamente"). Each tab (Titles /
Overlays / Subtitles) orders controls **Posición → Estilo → Avanzado** as always-open titled
sections, with a shared **9-point arrow-button position-preset** affordance in the Posición section.

**Color is Restrained** (design-system rule, see theme): tinted-indigo neutrals tuned in OKLCH, no
pure black/white. **Blue (`--accent` ~#90caf9) is reserved for selection / focus / current**; the
segmented-control "on" state, swatch selection, focus rings, active tab, and active preset are all
blue. **Green (`--action` ~#4CAF50) marks THE single primary action of the *current* surface** —
context-dependent (ratified across sketches 008 + 010): `Render Video` when render is in play, with
`Guardar config` demoted to a secondary outline button; `Guardar config` in the editing-only state.
**Never two greens at once.** Amber (`--warning`) = dirty/unsaved, `--success` = confirm — both low
chroma. See `references/states-and-save-feedback.md` and `references/render-export-surface.md`.

**Typography:** one well-tuned sans (Inter), fixed rem-ish scale (`--t-2xs` 10.5px … `--t-2xl`
23px). **Spacing:** compact rhythm (`--s-1` 2px … `--s-16` 32px). **Shape:** 4–12px radii.
**Motion:** 150–250ms ease-out-quart (`--ease`, `--dur` 170ms), state-conveying not decorative.

The realized synthesis is **sketch 001 variant D** — it folds in 002-A's always-open sections and
003-B's arrow presets into the real shell.

**Current canonical screen is sketch 027-B (north-star v3), which supersedes 023 (v2) and 015** —
023-B's committed slice recomposed after 016–022, then refreshed so the caption **plays**: a **4-tab
bar** (Títulos · Overlays · Subtítulos · **Video** pushed right via `margin-left:auto` to read
"per-frame vs global"), the timeline strip living *inside* the work column so the metadata column keeps
full height, list-forward overlays, and the font slide-over. **The subtitle/caption preview now plays**
the word-by-word highlight (025-C: in-panel specimen loops the *style*, stage transport scrubs the
*real moment* — static specimens retired; v3 folds this live preview into the canonical composite and
confirms the two simultaneous animations stay ambient, no focus-discipline needed). **The render's payoff is
a full-screen results takeover** (024-B: the finished reel big + playable with file + AI metadata
gathered) that closes the core-value loop. The persistent right column's awake form is **per-platform
AI metadata** (026-C: TikTok/Reels/Shorts with per-platform char limits + hashtags) — reserved for the
AI phase, but it justifies the column's reserved width. Green discipline held throughout: AI
generate/copy use **accent (blue)**, never the reserved action-green.

**The whole-app frame around the canonical Editor screen is now sketch 033-B (nav shell v4), which
supersedes 027 as the *app map*** (027 stays the canonical *Editor* screen; 033 is the shell it hangs
in). A **thin 56px left activity rail** owns app-level wayfinding — Editor · Cola · Resultados · ⚙ · ? —
so the 013-B header becomes the **purely-contextual bar of the current destination** (content tabs are
editor-only, never app chrome). This Linear/Figma separation of app-navigation from screen-actions was
forced once 030 (queue), 031 (run spine) and 032 (settings) accreted destinations the header was never
designed to carry. Hanging off that shell: **named style presets** (034-A — an always-visible header
bar where a saved look captures all four tabs, with an ambient *Modificado* divergence state),
**background render/batch notifications** (035-D — transient toast for the moment + durable Cola-badge
tally for the record, OOM-honest, zero new chrome), and the **⌘K command palette** (036-A — the single
discoverable keyboard entry point over an honest command set, the Linear/Raycast idiom the direction
names, with G-chord accelerators layered underneath). Green discipline holds across all four: Render is
the only green; the rail, preset affordances, notification links, and palette rows are all accent/neutral.
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Workspace Shell & Layout | references/workspace-shell.md | 3-column shell: content-sized preview (`flex:0 1 470px`) · controls grow into 2 internal columns · persistent (non-collapsing) 320px metadata placeholder |
| Control Panel Density & Disclosure | references/control-panel-density.md | Always-open titled sections, Posición→Estilo→Avanzado, hairline dividers; no collapse/accordion (height absorbed by 2-col layout) |
| Position Presets (shared component) | references/position-presets.md | 9-point arrow-button grid (↖↑↗ …), size-aware X/Y math vs 1080×1920 top-left anchor, inputs flash on apply |
| Per-Tab Structure & Coherence | references/tab-patterns.md | Coherence rule: lists (Titles/Overlays) + Subtitles textarea span full width, the Posición→Estilo→Avanzado form is always 2-col; **TabLead/TabForm skeleton (012-B)** = the two slots every tab fills; Subtitles = condensed/expanding sample-text textarea (D-10). **Overlays resolved list-forward (019-C):** fat per-item cards with inline width/opacity/Capa/anchor, no separate form (small real schema) — *departs from the TabLead/TabForm contract; 019-A = contract-preserving fallback if it reads off-pattern at build* |
| Subtitle Styling (dense controls) | references/subtitle-styling.md | Layout-mode = preset cards (not dropdown) leading the section, in-panel live specimen, 2×2 color-role matrix, collapsible Glow/Fondo effect-rows; validated against the real ~20-field caption schema from `pipeline-config.ts` (011-C). **Specimen now ANIMATES** — see caption-animation-preview. Anti-pattern: flat ~20 rows = the wall |
| Caption Animation Preview | references/caption-animation-preview.md | **Word-by-word highlight PLAYS** (025-C): in-panel specimen loops the *style* (judge rhythm), stage transport scrubs the *real moment* — same idiom as 020 timeline. One `paint()` renderer, two drivers. **Static subtitle specimens retired.** Anti-pattern: forking the word renderer; static-only preview |
| Title Styling (dense controls) | references/title-styling.md | Titles = **boxed text card + entrance animation**. Specimen + **entrance preset cards** (Slide↑/↓·Fade·Ninguna) + 1×2 Texto/Caja color pairing + collapsible Glow (014-C); 011-C kit transfers. **Entrance timing = numeric Aparece/Dura/Velocidad rows in Tiempo (022-B)** — global timeline does visual placement, rows refine; no per-title track. Anti-pattern: flat ~16 rows = the wall |
| Video Effects — Transitions Tab | references/video-effects.md | **Auto-emphasis-zoom DROPPED** (product decision — Whisper confidence ≠ emphasis, off-brand). Survivor `TransitionConfig` (1.08× push / crop-shift masking silence cuts) lives in a **minimal "Video" 4th tab (021-A)**: transition type cards w/ looping motion preview + Duración. Anti-pattern: rebuild `detectZoomEvents`; flashy preview; over-fill the thin tab |
| Timeline / Temporal Axis (frontier) | references/timeline-temporal.md | ⚠️ Scope-expanding / likely next-milestone. **Strip under stage+controls (020-C):** Títulos/Overlays/Subtítulos lanes below preview+controls, **metadata column keeps full height**. Track surface (not cards), scrub-to-preview + drag-to-retime. Middle ground vs preview-only scrubber (A) / full-width dock (B). One timeline idiom — pairs with 022-B numeric rows |
| Font Picker (shared component) | references/font-picker.md | **Slide-over gallery sheet** (016-C) opened from a current-font trigger: search + category chips (Sans/Condensada/Display/Serif/Script/Mono) over a 2-up grid of cards each rendering the **sample text in its own face**, against the real 26-font `AVAILABLE_FONTS`. Selection = blue; self-contained, drops into Títulos + Subtítulos. Resolves the picker 011 flagged. Anti-pattern: inline scroll-box / popover (too cramped for 26 live specimens) |
| First-Run & Empty Workspace | references/first-run-empty-workspace.md | Cold start = **dropzone on the stage + dense controls live on their defaults** (017-B), framed by a "valores por defecto" banner. Single green = the upload action; Guardar disabled, Render ghosted; metadata column persists "Próximamente". Not gated, not a welcome takeover |
| Responsive Breakpoint Reflow | references/responsive-reflow.md | At the narrow (~360px) column, **reflow the multi-up grids** (018-B): 2-col form → 1-col, mode/entrance cards → 2×2, font grid → 1-up, color matrix stays 2×2. **002-A's always-open rule stays intact** (no disclosure-under-pressure). One reflow rule across all three tabs |
| Header Action Zone | references/header-action-zone.md | Split zones (013-B): status chip left (ambient, by brand) · Guardar(outline)+Render(green) right, hairline between. **Render is the only green; Guardar never greens — the chip carries dirty.** Chip holds its left home through render. State map idle→dirty→saving→rendering→done |
| Preview as Editing Surface (frontier) | references/preview-direct-manipulation.md | ⚠️ Scope-expanding. Drag-to-position on the full preview, snapping to the same 9 anchors and writing the same X/Y path; cheap subset = click-to-select. Beyond committed control-driven scope |
| States, Empties & Save Feedback | references/states-and-save-feedback.md | Save = header status chip (`● Cambios sin guardar`→`Guardando…`→`✓ Guardado recién`) left of a stay-put button; validated empty (0/3), cap (3/3 disabled), no-video & Whisper-loading states |
| Motion & Timing | references/motion-and-timing.md | Calm 170ms ease-out-quart; two-tier timing (state `--dur` 170ms / travel `--dur2` 300ms); all 5 motions cohere; `prefers-reduced-motion` collapse required |
| Render / Export Surface (frontier) | references/render-export-surface.md | ⚠️ Scope-expanding. Render on the dimmed preview (progress ring + 3-step pipeline → "Reel listo"), no modal; Render takes the green primary; single-job constraint surfaced; OOM-aware failure. **Continues into render-last-mile** |
| Render Last-Mile / Output (frontier) | references/render-last-mile.md | ⚠️ Scope-expanding. Where the finished reel lands: **full-screen results takeover (024-B)** — reel big + playable, file card (download · path · play · re-render) + AI metadata gathered as one "done, publish" moment. Metadata column **wakes**. Single-job re-render; download = accent not green |
| Metadata / AI Column (AI phase) | references/metadata-ai-column.md | ⚠️ AI-phase / forward-looking. The awakened right column: **per-platform tabs (026-C)** TikTok/Reels/Shorts, each with tailored caption + char-limit counter (red over limit) + hashtags. Editable in place; lands on 024-B. **Green discipline: Generar/copiar = accent, never action-green** |
| North-Star v3 — Canonical Screen | references/north-star-v3.md | **CURRENT canonical screen (027-B), supersedes 023 & 015.** 023-B's committed slice with the **caption now playing** (025-C live preview folded in): one `paint()`, two drivers; the two simultaneous animations stay ambient — **no focus-discipline needed** (variant C's auto-pause read as "panel went dead"). Ship B; frontier layers (007/010/020/awake-metadata) bolt on |
| North-Star v2 — Canonical (superseded) | references/north-star-v2.md | ⚠️ **Superseded by north-star-v3 (027).** Pre-live-preview composite (frozen specimen) + source of the shell/4-tab/timeline CSS (unchanged in v3): 4-tab bar (Video pushed right), timeline strip *inside* work column, list-forward overlays, font sheet, numeric timing. Scope-line + coherence findings still hold |
| North-Star Composite (superseded) | references/north-star-composite.md | ⚠️ **Superseded by north-star-v2/v3.** Historical 015 capstone of the 001–014 era: 013-B header + 001-D shell + 3 tabs + 007 drag + 010 render, A↔B scope boundary. Plan-split rule originates here; the screen itself is stale (3 tabs, no timeline) |
| Pipeline-Step Inspection (frontier) | references/pipeline-inspection.md | ⚠️ Scope-expanding. **Full-screen review *steps*** (not in-shell tabs) make the "inspeccionable" promise legible: shared **step-rail** (Audio→Transcripción→Silencios→Render) + single **"Confirmar … →"** green. **Transcript (028-B):** document read-through, click-to-edit, confidence underlines (amber<0.78/red<0.6) — the *legit* confidence use vs dropped auto-zoom. **Silence cuts (029-B):** before/after stat + waveform w/ removed silences in red (click-restore) + per-cut list w/ source badges (×2/ffmpeg/whisper) + toggles. Makes core-value inspectable. Anti-pattern: cram into shell; flat-tone underline; free-restore if re-render |
| Batch Queue / Multi-Job (frontier/ops) | references/batch-queue.md | ⚠️ Scope-expanding / ops. **Queue list (030-A):** sectioned rows (Procesando ahora w/ inline pipeline+ETA · En espera numbered+drag · Fallaron w/ real OOM+retry · Terminados+download) + an **ambient concurrency banner** stating "un video a la vez" plainly. Honest about `MAX_CONCURRENT_JOBS=1` / Chrome-OOM. Reached via Editor⇄Cola switch. Anti-pattern: kanban (oversells parallelism); hide/apologize for the limit; second action-green |
| Pipeline Run-Flow Spine (integration) | references/run-flow-spine.md | ⚠️ Scope-expanding / integration. **Inline-first, review = PULL (031-A):** 010-A stays the spine — render runs on the dimmed stage (no wizard), run stays in-editor so the Editor⇄Cola switch persists; each reviewable step soft-pauses (3s auto-continue + a "Revisar" pull opening 028/029 on demand); small in-stage results, big 024-B takeover opens only if asked. Honest with single-job/batch (a queued batch runs auto; you only gate the one foreground job). One green at a time (Render→Confirmar). Reconciles 010/028/029/024/030. Anti-pattern: forced wizard per render (031-B); push-gate a batch; second green; ship the literal 3s window unchecked |
| App Nav Shell v4 (whole-app wayfinding) | references/app-nav-shell.md | **Supersedes 027 as the app map. Left 56px activity rail (033-B):** owns app-nav (Editor·Cola·Resultados·⚙·?) so the header becomes the *purely-contextual* bar of the current destination (content tabs are editor-only, never app chrome). The Linear/Figma idiom — separates app-navigation from screen-actions, scales to more destinations, keeps the 013-B header legible once 030/031/032 accreted. Anti-pattern: pile app-nav into the header (033-A densifies); bury Resultados behind "⋯" (033-C hides the payoff); leak tabs off-editor; green the rail |
| Style Presets (save-a-look) | references/style-presets.md | ⚠️ Frontier / repeat-use. **Always-visible header preset bar (034-A):** `Estilo: [Mi estilo TikTok ▾]`; a saved look = **all four tabs at once** (swatch/thumbnail renders a real mini-specimen, not a swatch). *Modificado* (amber, diverged-from-preset) coexists with the save chip without reading as a second alarm; "save as" gated on divergence. B=gallery kept for *management* (rename/duplicate); C's *recall chip* folds into A. Green discipline: Aplicar/Guardar-como = accent. Anti-pattern: preset-as-swatch; Modificado-as-alarm; green any preset control |
| Background Render / Batch Notifications | references/background-notifications.md | ⚠️ Frontier / async-ops. **Synthesis (035-D): toast (the moment) + Cola-badge tally (the durable record).** Success toast auto-dismisses w/ Abrir/Descargar; **OOM failure persists** w/ Reintentar/Ver-en-cola, names the real single-job/Chrome-RAM cause plainly; the `✓3 ✕1` switch badge is the persistent truth. **Zero new header chrome** (no bell — B held in reserve for high batch volume). Honest: matters mainly for *queued-batch*, since foreground renders you watch (031). Green discipline: success=`--success`, links=accent, never action-green. Anti-pattern: auto-dismiss failures; generic error; ship a bell; green a toast |
| Command Palette / Keyboard Model | references/command-palette.md | ⚠️ Frontier / power-user. **⌘K palette only (036-A)** — the single discoverable entry point; Raycast idiom (fuzzy + grouped + inline shortcut hints + keyboard-complete, pointer-optional). **Honest command set** — only actions that exist elsewhere (tabs·render·presets 034·queue 030·settings 032·fonts 016), no palette-only powers; self-teaching (shows each shortcut), so B's cheat sheet is redundant (kept in reserve). C's **G-chord accelerators + chord cue kept layered underneath** for power users. Green discipline: Render = green **icon only**, never a green row/chord/kbd. Anti-pattern: bindings-only (no discovery); invent palette-only powers; green a command row |
| Pipeline Settings Home (processing params) | references/pipeline-settings.md | ⚠️ Scope-expanding (beyond Phase 22 look-polish). **Slide-over "⚙ Procesamiento" sheet (032-A):** reuses the 016 font-picker idiom to home the *non-look* params — Whisper model (6 chips + tradeoff hints, REC on medium), language (es fixed), silence sensitivity (conservador→máximo), output (9:16 🔒 in v1, FPS, H.264) — off the per-element tabs. Writes `pipeline-config.json`. Green discipline: gear neutral→accent-when-open, Aplicar green. Anti-pattern: 5th tab (breaks per-element contract); Render popover (overloads the run action); hide the 9:16 lock; green the gear |

## Theme

The winning theme file is at `sources/themes/default.css` — the canonical OKLCH token set (surfaces,
borders, text, accent, semantic colors, type scale, spacing, shape, elevation, motion). All
reference CSS uses these variables. Reuse it verbatim as the design-token source for the real build.

## Source Files

Original sketch HTML files (all variants, winners marked with ★ in the variant nav) are preserved in
`sources/` for complete reference:
- `sources/001-three-column-shell/index.html` — winner `#v-d`
- `sources/002-control-density-disclosure/index.html` — winner `#v-a`
- `sources/003-position-presets/index.html` — winner `#v-b`
- `sources/004-overlay-list-and-layering/index.html` — winner `#v-a`
- `sources/005-subtitles-tab-restructure/index.html` — winner `#v-c`
- `sources/006-all-three-tabs-coherence/index.html` — winner `#v-a`
- `sources/007-preview-as-layer-map/index.html` — winner `#v-a` (frontier / scope-expanding)
- `sources/008-states-and-empties/index.html` — winner `#v-b`
- `sources/009-motion-coherence/index.html` — winner `#v-a`
- `sources/010-render-export-surface/index.html` — winner `#v-a` (frontier / scope-expanding)
- `sources/011-subtitle-style-density/index.html` — winner `#v-c`
- `sources/012-subtitle-density-in-shell/index.html` — winner `#v-b`
- `sources/013-header-action-zone/index.html` — winner `#v-b`
- `sources/014-title-style-density/index.html` — winner `#v-c`
- `sources/015-north-star-composite/index.html` — winner `#v-a` (A = north star; B = committed-scope slice)
- `sources/016-font-picker/index.html` — winner `#v-c` (slide-over gallery; shared component)
- `sources/017-first-run-empty-workspace/index.html` — winner `#v-b` (controls live with defaults)
- `sources/018-dense-tabs-at-breakpoint/index.html` — winner `#v-b` (reflow the multi-up grids)
- `sources/019-overlays-tab-density/index.html` — winner `#v-c` (list-forward; 019-A = contract-preserving fallback)
- `sources/020-timeline-scrubber/index.html` — winner `#v-c` (strip under stage+controls; frontier / scope-expanding)
- `sources/021-video-effects-surface/index.html` — winner `#v-a` (minimal "Video" tab; auto-zoom dropped)
- `sources/022-title-entrance-timing/index.html` — winner `#v-b` (numeric timing rows)
- `sources/023-north-star-v2/index.html` — winner `#v-b` (committed slice; superseded by 027)
- `sources/024-render-last-mile/index.html` — winner `#v-b` (full-screen results takeover; frontier / scope-expanding)
- `sources/025-caption-animation-preview/index.html` — winner `#v-c` (loop + transport; specimens now animate)
- `sources/026-metadata-ai-column/index.html` — winner `#v-c` (per-platform AI metadata; AI-phase / forward-looking)
- `sources/027-north-star-v3/index.html` — winner `#v-b` (committed slice + live preview; **current canonical**, supersedes 023)
- `sources/028-transcript-review/index.html` — winner `#v-b` (full-screen transcript read-through; frontier / scope-expanding)
- `sources/029-silence-cut-review/index.html` — winner `#v-b` (full-screen per-cut review; frontier / scope-expanding)
- `sources/030-batch-queue/index.html` — winner `#v-a` (queue list; frontier / ops, honest single-job constraint)
- `sources/031-pipeline-run-flow-spine/index.html` — winner `#v-a` (inline-first / review = pull; **playable** — press ▶ Render)
- `sources/032-pipeline-settings-home/index.html` — winner `#v-a` (slide-over "⚙ Procesamiento" sheet)
- `sources/033-nav-shell-v4/index.html` — winner `#v-b` (left activity rail; **supersedes 027 as the app map**)
- `sources/034-style-presets/index.html` — winner `#v-a` (header preset bar; save-a-look across 4 tabs; frontier / repeat-use)
- `sources/035-background-notifications/index.html` — winner `#v-d` (toast + Cola-badge synthesis; **playable** — use the dashed sim panel; frontier / async-ops)
- `sources/036-command-palette/index.html` — winner `#v-a` (⌘K palette; **playable** — press ⌘K; frontier / power-user)
</findings_index>

<metadata>
## Processed Sketches

- 001-three-column-shell (winner D)
- 002-control-density-disclosure (winner A)
- 003-position-presets (winner B)
- 004-overlay-list-and-layering (winner A)
- 005-subtitles-tab-restructure (winner C)
- 006-all-three-tabs-coherence (winner A)
- 007-preview-as-layer-map (winner A — frontier, scope-expanding)
- 008-states-and-empties (winner B)
- 009-motion-coherence (winner A)
- 010-render-export-surface (winner A — frontier, scope-expanding)
- 011-subtitle-style-density (winner C)
- 012-subtitle-density-in-shell (winner B — TabLead/TabForm skeleton)
- 013-header-action-zone (winner B — split zones)
- 014-title-style-density (winner C — specimen + entrance cards)
- 015-north-star-composite (winner A — north star; B = committed-scope slice)
- 016-font-picker (winner C — slide-over gallery, shared component)
- 017-first-run-empty-workspace (winner B — controls live with defaults)
- 018-dense-tabs-at-breakpoint (winner B — reflow the multi-up grids)
- 019-overlays-tab-density (winner C — list-forward; 019-A contract-preserving fallback)
- 020-timeline-scrubber (winner C — strip under stage+controls; frontier, scope-expanding)
- 021-video-effects-surface (winner A — minimal "Video" tab; auto-emphasis-zoom dropped)
- 022-title-entrance-timing (winner B — numeric timing rows)
- 023-north-star-v2 (winner B — committed slice; superseded as canonical by 027)
- 024-render-last-mile (winner B — full-screen results takeover; frontier, scope-expanding)
- 025-caption-animation-preview (winner C — loop + transport; static subtitle specimens retired)
- 026-metadata-ai-column (winner C — per-platform AI metadata tabs; AI-phase, forward-looking)
- 027-north-star-v3 (winner B — committed slice + live caption preview; current canonical screen, supersedes 023)
- 028-transcript-review (winner B — full-screen Whisper transcript read-through; frontier, scope-expanding)
- 029-silence-cut-review (winner B — full-screen per-cut review; frontier, core-value, scope-expanding)
- 030-batch-queue (winner A — queue list; frontier/ops, honest single-job concurrency)
- 031-pipeline-run-flow-spine (winner A — inline-first / review = pull; integration of render·inspection·results·queue; frontier, scope-expanding)
- 032-pipeline-settings-home (winner A — slide-over "⚙ Procesamiento" sheet; processing params off the per-element tabs; scope-expanding beyond Phase 22)
- 033-nav-shell-v4 (winner B — left activity rail; whole-app wayfinding; supersedes 027 as the app map; consistency/north-star recompose)
- 034-style-presets (winner A — header preset bar; named saved looks across all 4 tabs; frontier/repeat-use)
- 035-background-notifications (winner D — toast + Cola-badge synthesis; OOM-honest async/batch completion; frontier/ops)
- 036-command-palette (winner A — ⌘K palette as the single discoverable keyboard entry point; honest command set; frontier/power-user)
</metadata>
