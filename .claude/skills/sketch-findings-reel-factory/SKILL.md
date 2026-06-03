---
name: sketch-findings-reel-factory
description: Validated design decisions, CSS patterns, and visual direction from Phase 22 sketch experiments for the Remotion Studio control panel (3-column shell, control density, position presets, per-tab structure & TabLead/TabForm skeleton, subtitle & title styling controls, animated caption preview, title entrance timing, overlays tab density, PNG overlay acquisition (drop→preview→place, checkerboard transparency, 3-cap), font picker, header action zone, render surface, render last-mile/results screen, Resultados persistent library/history, AI metadata column, transitions Video tab, timeline strip, drag-to-position, first-run/empty workspace, responsive breakpoint reflow, north-star v4 canonical Editor screen (real editor in the rail shell) w/ live preview & scope boundary, pipeline-step inspection (transcript & silence-cut review), batch queue / multi-job status, pipeline run-flow spine (render·inspection·results·queue reconciled), pipeline settings home / processing-params sheet, app-level nav shell / left activity rail, named style presets, background render/batch notifications, ⌘K command palette / keyboard model, error/failure states (inline-at-source), modal-stack layering law (z-ladder), direct-manipulation canvas (resize handles + anchor snap + layer chips), intro/outro home (dormant Phase-6, scope-gated)). Auto-loaded during UI implementation on reel-factory.
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
underneath for power users), 2026-06-02 (sketches 037–039: **north-star v4** — the *real* dense editor
(027-B's live caption + dense Subtitles tab) recomposed **inside the 033-B rail shell**, resolving the
recompose-staleness conflicts the rail created (the 034 preset rehomes to the header as an *editor-scoped*
control; the 035-D `✓3 ✕1` tally rehomes onto the rail's Cola button) — **supersedes 027 as the canonical
Editor screen**; the **Resultados persistent library** — the rail's previously-unkept promise drawn as a
browsable gallery/history of finished reels grounded in the real `output/` dir (uniform 9:16 grid + a
featured-latest hero grafted in, empty-state teaches the surface); and **PNG overlay acquisition** for the
live Phase 21 feature — drop a PNG **onto the 9:16 canvas** (acquire = place, one gesture), transparency
rendered as a **checkerboard** so alpha reads as transparent not black, the honest **3-overlay cap** as a
calm disabled state, flowing into the 019-C list-forward cards), 2026-06-02 (sketches 040–043: the
**error/failure-state vocabulary** — faults surface *inline at their source* in the calm pro register
(dropzone reject w/ real `ffprobe` reason, Whisper-down panel over the dimmed stage "el resto del editor
sigue funcionando", save-failed flips the header chip→Reintentar), danger its own low-chroma red never
borrowing action-green, C's takeover folding into A for fatal blocks; the **modal-stack layering law** —
a literal **z-ladder** (toast 60 ▸ palette 40 ▸ takeover 30 ▸ sheet 20) governing the six
independently-sketched floating surfaces, with C's "takeovers are *destinations*" reframe grafted on;
the **direct-manipulation canvas** — the complete on-canvas editing model realized (resize **handles**
for size + position still **snaps to the 9 anchors** + on-canvas **layer-chip stack** for overlapping
elements), keeping "global places / panel refines"; and **intro/outro home** — a **dormant, scope-gated**
Phase-6 capability with no `pipeline-config.json` section, explored as timeline endcaps (B, depends on the
020-C timeline frontier) w/ a Video-tab section fallback (C), the sketch itself evidence it may stay cut
as scope-creep on a talking-head tool).
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

**The whole-app frame around the canonical Editor screen is sketch 033-B (nav shell v4)** — a **thin 56px
left activity rail** that owns app-level wayfinding — Editor · Cola · Resultados · ⚙ · ? — so the 013-B
header becomes the **purely-contextual bar of the current destination** (content tabs are editor-only,
never app chrome). This Linear/Figma separation of app-navigation from screen-actions was forced once 030
(queue), 031 (run spine) and 032 (settings) accreted destinations the header was never designed to carry.
Hanging off that shell: **named style presets** (034-A — an always-visible header bar where a saved look
captures all four tabs, with an ambient *Modificado* divergence state), **background render/batch
notifications** (035-D — transient toast for the moment + durable Cola-badge tally for the record,
OOM-honest, zero new chrome), and the **⌘K command palette** (036-A — the single discoverable keyboard
entry point over an honest command set, the Linear/Raycast idiom the direction names, with G-chord
accelerators layered underneath). Green discipline holds across all four: Render is the only green; the
rail, preset affordances, notification links, and palette rows are all accent/neutral.

**The current canonical Editor screen is sketch 037-B (north-star v4), which supersedes 027 (v3).** v4
composes the *real* dense editor (027-B's live caption + the dense Subtitles tab) **inside the 033-B rail
shell** and resolves the conflicts that recompose created: the **034 preset rehomes to the header as an
*editor-scoped* control** (one dense row — preset takes the brand's freed slot, then tabs, then status +
Guardar + Render; a saved look is editor-scope, *not* app-global like ⚙), and the **035-D `✓3 ✕1` tally
rehomes onto the rail's Cola button** (the header vswitch that hosted it is gone). 027's *content* still
holds; its header-resident *frame* is stale. Two more surfaces settled here: the **Resultados persistent
library** (038-A — the rail's previously-unkept promise drawn as a browsable gallery/history of finished
reels grounded in the real `output/` dir; a uniform 9:16 grid with a **featured-latest hero grafted from
C** to dodge card-grid monotony, the empty-state teaching the surface, the only green being its
`Ir al editor →` CTA), and **PNG overlay acquisition** for the live Phase 21 feature (039-B — drop a PNG
**onto the 9:16 canvas**, *acquire = place* in one gesture tied to the 007 drag frontier; **transparency
as a checkerboard** so alpha reads transparent not black; the **3-overlay cap** as a calm disabled state;
flowing into the 019-C list-forward cards). Green discipline holds: Render the only green throughout.
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
| North-Star v4 — Canonical Editor Screen | references/north-star-v4.md | **CURRENT canonical Editor screen (037-B), supersedes 027.** The *real* dense editor (027-B's live caption + dense Subtitles tab) recomposed **inside the 033-B rail shell**: one dense header row (preset takes the brand's freed slot → tabs → status + Guardar + Render); a saved look is **editor-scoped** (header, not the rail / not app-global); the **035-D `✓3 ✕1` tally rehomes onto the rail Cola button**. Render the only green. Fallback: A (preset sub-bar) if the one row overflows |
| North-Star v3 — Canonical (superseded) | references/north-star-v3.md | ⚠️ **Superseded by north-star-v4 (037)** as the whole-screen view — its content holds, its header-resident *frame* is stale (the rail replaced it). The live-preview milestone (027-B): 023-B's slice with the caption playing (025-C), one `paint()` two drivers, two animations stay ambient (no focus-discipline; C's auto-pause read as "panel went dead"). Keep for the caption-coherence findings |
| Resultados — Persistent Library / History (frontier) | references/resultados-library.md | ⚠️ Scope-expanding. The rail's previously-unkept Resultados promise when you **haven't** just rendered: a browsable library of finished reels grounded in the real `output/` dir. **Uniform 9:16 gallery (038-A) + a featured-latest hero grafted from C** (dodges card-grid monotony, bridges the 024-B takeover). Empty-state teaches the surface; **only green = the `Ir al editor →` CTA**; per-reel download/play/re-render = accent; per-platform 026-C badges; single-job re-render. B (file-manager list) kept as the management view |
| PNG Overlay Acquisition (Phase 21) | references/overlay-png-acquire.md | **Phase 21 live.** Acquire→preview→place a PNG overlay. **Drop onto the 9:16 canvas (039-B): acquire = place**, one gesture (007 drag frontier); click = drop-to-center fallback. **Transparency as a checkerboard** (thumb + on-canvas backing) so alpha reads transparent not black — load-bearing. **3-overlay cap = calm disabled dropzone** (008-B state, amber counter, never error). Flows into the 019-C list cards. No modal (impeccable law); delete = quiet danger-on-hover; Render the only green. A (tab dropzone) / C (inline placement bar) are fallbacks |
| Error & Failure States | references/error-failure-states.md | **Inline at the source (040-A):** each fault surfaces where it originated — dropzone reject w/ real `ffprobe` reason, Whisper-down panel over the dimmed stage ("el resto del editor sigue funcionando"), save-failed flips the header chip→`Reintentar`. No global error chrome; **danger = its own low-chroma red, never action-green**; the cause line (ECONNREFUSED/ENOSPC/signal 9) mono+muted under plain language. C's takeover folds in for *fatal* blocks. Completes 008 (happy-off) + 035 (OOM completion). Anti-pattern: header banner for small faults; alarm-red; lock the whole editor |
| Modal-Stack Choreography (integration) | references/modal-stack-choreography.md | ⚠️ Integration/consistency. **z-ladder (041-B):** toast 60 (never traps focus, survives takeover) ▸ palette 40 (opens **over** a sheet, Esc returns to it) ▸ takeover 30 (owns screen, clears floats but toast) ▸ sheet 20 (scrim+Esc, one at a time). Build encodes it literally. **C's "takeovers are *destinations*" reframe grafts on** (results/review reached via rail/run-flow, so the ladder really governs toast/palette/sheet). Governs 016/032/036/035/024/028/029. Anti-pattern: two sheets at once; takeover kills toast; palette replaces (not over) a sheet; scrim the toast |
| Direct-Manipulation Canvas (frontier) | references/direct-manipulation-canvas.md | ⚠️ Scope-expanding. **Hybrid (042-C):** resize **handles** for size (what the panel does worst) + position still **snaps to the 9 anchors** w/ guides (shared X/Y path, px→1080×1920 ×4) + on-canvas **layer-chip stack** to pick an overlapped element. Caption stays bottom-anchored (not free-dragged). Realizes the 007 drag frontier; keeps "global places / panel refines". Anti-pattern: full Figma box-transform (A); resize-as-slider (B); drag/numeric divergence; covered elements unselectable |
| Intro/Outro Home (dormant / scope-gated) | references/intro-outro-home.md | ⚠️ **DORMANT + SCOPE-GATED — confirm revival before building.** Phase-6 capability with no `intro`/`outro` in `pipeline-config.json`. **Timeline endcaps (043-B):** intro/outro as blocks bracketing the timeline body track (whole-clip category, like transitions); tap → config in panel. **Depends on the 020-C timeline frontier** — until then **C (Video-tab section) is the fallback host**; A (5th tab) is heavier. B is a *layer* on C/A, not standalone. The sketch is also evidence it may **stay cut** as general-editor scope-creep. Anti-pattern: build without a revival decision; file among per-element tabs; green the toggles |
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
- `sources/037-north-star-v4/index.html` — winner `#v-b` (real editor in the rail shell; **current canonical Editor screen**, supersedes 027; **playable** — caption plays, open the `Estilo ▾` preset)
- `sources/038-resultados-library/index.html` — winner `#v-a` (uniform 9:16 gallery + featured-latest hero graft; toggle "ver vacío" for the empty state; frontier / scope-expanding)
- `sources/039-overlay-png-acquire/index.html` — winner `#v-b` (drop PNG onto the canvas; **playable** — add PNGs, watch the checkerboard + 3/3 cap, ↺ reiniciar; Phase 21)
- `sources/040-error-failure-states/index.html` — winner `#v-a` (inline at source; **playable** — use the "simular falla" bar to trigger each fault per variant)
- `sources/041-modal-stack-choreography/index.html` — winner `#v-b` (z-ladder; **playable** — open surfaces from the dock, ⌘K over a sheet, Esc to pop the top; integration)
- `sources/042-direct-manipulation-canvas/index.html` — winner `#v-c` (hybrid handles+anchors+layer-chips; **playable** — drag elements, drag corner handles to resize PNG, tap a 9-anchor cell; frontier / scope-expanding)
- `sources/043-intro-outro-home/index.html` — winner `#v-b` (timeline endcaps; dormant Phase-6 / scope-gated — C = Video-tab fallback)
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
- 037-north-star-v4 (winner B — real dense editor recomposed inside the 033-B rail shell; one dense header row; preset editor-scoped; 035-D tally rehomed to rail Cola button; current canonical Editor screen, supersedes 027)
- 038-resultados-library (winner A — uniform 9:16 gallery + featured-latest hero graft; the rail's persistent Resultados destination; grounded in real output/; frontier/scope-expanding)
- 039-overlay-png-acquire (winner B — drop PNG onto the canvas / acquire = place; checkerboard transparency; calm 3-overlay cap; flows into 019-C list cards; Phase 21)
- 040-error-failure-states (winner A — inline at source; faults surface where they originate; danger its own low-chroma red, never action-green; C's takeover folds in for fatal blocks; completes 008 + 035)
- 041-modal-stack-choreography (winner B — z-ladder toast 60 ▸ palette 40 ▸ takeover 30 ▸ sheet 20, with C's "takeovers are destinations" reframe grafted on; integration over 016/032/036/035/024/028/029)
- 042-direct-manipulation-canvas (winner C — hybrid: resize handles for size + 9-anchor snap for position + on-canvas layer chips for overlap; realizes the 007 drag frontier; frontier/scope-expanding)
- 043-intro-outro-home (winner B — timeline endcaps; dormant Phase-6 capability, scope-gated, depends on 020-C timeline; C = Video-tab fallback host; sketch is also evidence it may stay cut)
- 044-north-star-v5 (EXCLUDED — winner B; v5 integration recompose of 040+041+042+043 in the canonical Editor. Not promoted: 037-B remains the canonical Editor screen in this skill. Exploration only.)
- 045-cancel-and-destroy (EXCLUDED — winner B; destructive-action + render-abort vocabulary, tiered by cost. Not baked into the validated set. Exploration only.)
- 046-help-destination (EXCLUDED — winner A; help as a slide-over sheet reusing the 016/032 idiom. Not promoted to a build decision. Exploration only.)
- 047-shell-responsive-ladder (EXCLUDED — winner A; shell-level responsive collapse, rail-persists. Not validated; 018's inner tab reflow stays the only committed responsive decision. Open whether multi-viewport is in scope. Exploration only.)
</metadata>
