# Quick Task 260607-uzv: Correcciones de edición del Studio - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Task Boundary

Six Studio editing corrections across three surfaces (preview / títulos / subtítulos). Three are bugs introduced by the v1.5 autonomous run (subtitle per-word bg, active color, duplicate sample-text title); three are small features/UX. Root causes already traced by the orchestrator (below) — do NOT re-investigate from scratch; verify against the cited code.
</domain>

<decisions>
## Implementation Decisions (root-caused + user-confirmed)

### VISTA PREVIA — item 1: clear/replace + download uploaded video
- File: `services/remotion-studio/src/preview/PreviewApp.tsx`. When a file is uploaded (`uploadedFile` set) and `renderState === "idle"`, the dropzone (`UploadDropzone`, ~L783) is replaced by the player; there is NO way to remove/replace the loaded video or download it.
- FIX: when a video is loaded (pre-render), add two affordances near the preview: (a) "Reemplazar / Quitar video" → `setUploadedFile(null)` (returns to the dropzone), and (b) "Descargar video" → download the existing object URL (`videoObjectUrl`, derived ~L252) via an `<a download>` using `uploadedFile.name`. Honor green-discipline: these use `--accent`, NOT `--action` green (green stays reserved for the Render CTA). Studio-only, no renderer.

### TÍTULOS — item 2: configurable title box width
- File: `services/remotion-studio/src/compositions/TitleOverlay.tsx` — the box width is HARDCODED `width: "80%"` (~L217). `DEFAULT_TITLE_STYLE` (~L37) has no width field.
- FIX: add an optional `boxWidthPct` (or `backgroundWidth`) field to the TITLE style schema (`TitleConfig`/title style in `pipeline-config.ts`, mirrored in renderer), default = current behavior (80% → e.g. default 80). Replace the hardcoded `width: "80%"` with the configured value (as a %). Add a slider control in `TitleEditor.tsx` (Caja/Posición section, follow existing RangeRow idiom). Renderer sync REQUIRED (TitleOverlay is a synced composition): mirror compositions + pipeline-config to renderer, re-run renderer vitest.

### TÍTULOS — item 3: linear gradient (top→bottom only) for the title box
- FIX: add an optional `backgroundGradient?: { enabled: boolean; fromColor: string; toColor: string }` to the TITLE style schema (both services). When enabled, the title box background uses `linear-gradient(to bottom, fromColor, toColor)` — VERTICAL (top→bottom) ONLY, no direction control. When disabled, keep the existing flat `backgroundColor`. Apply in `TitleOverlay.tsx` (the box, ~L208-219). Add controls in `TitleEditor.tsx` (toggle + two color swatches, FxBlock-style). Renderer sync REQUIRED. Validation in both `validatePipelineConfig`.

### SUBTÍTULOS — item 4: highlighted background must be PER-WORD in tiktok (USER DECISION: single per-word control)
- Root cause: two controls exist in `StyleControls.tsx` "Efectos": `"Fondo resaltado"` = `backgroundHighlight` (painted on the PARENT div = full phrase; ALSO used by `SentenceLayout.tsx` and `BarLayout.tsx`) and `"Fondo por palabra"` = `wordBackground` (per-word, Phase 28). The user was using the full-phrase one.
- DECISION (user-confirmed): in the **tiktok** style, present ONE highlighted-background control that is PER-WORD. Implementation:
  - `TikTokLayout.tsx`: STOP applying the full-phrase `getBackgroundHighlightStyle(config.backgroundHighlight)` on the parent div (so tiktok never paints a full-phrase bg, even for existing configs that have it enabled). The per-word `wordBackground` (already applied per active word span) is the highlighted background for tiktok.
  - `StyleControls.tsx`: when `config.layout === "tiktok"`, show ONLY the per-word control and HIDE the full-phrase `backgroundHighlight` control. Label the per-word control "Fondo resaltado" (the name the user uses). For non-tiktok layouts (sentence/bar), keep the existing `backgroundHighlight` control as-is.
  - Do NOT delete the `backgroundHighlight` config field or its validation — `SentenceLayout`/`BarLayout` still use it. This is additive/conditional UI + a tiktok-only render change.
  - Renderer sync REQUIRED (TikTokLayout is synced): mirror + re-run renderer vitest.

### SUBTÍTULOS — item 5: active word must take the "Activa" color (USER DECISION: flash off by default)
- Root cause: active word renders `highlightColor` (default `#FFFFFF` white) for `highlightDurationMs` (default 200ms), lerping to `activeColor` (`#FFFF00`). On short/fast words the flash never finishes → active word looks white, not the configured "Activa" color. (`TikTokLayout.tsx` CaptionWord `wordColor` logic; defaults in `DEFAULT_SUBTITLE_CONFIG`.)
- DECISION (user-confirmed): **flash OFF by default** so the active word shows the "Activa" (`activeColor`) immediately. Implementation: set `DEFAULT_SUBTITLE_CONFIG.highlightDurationMs = 0` (both services) so the highlight flash is disabled by default (with duration 0, `showHighlight` is false → `wordColor = activeColor`). Keep the capability (a config with duration>0 still flashes) for anyone who wants it. Verify with a unit test that an active word renders `activeColor` when `highlightDurationMs` is 0/unset. Renderer sync REQUIRED (default lives in the synced pipeline-config). NOTE: if the active saved config/profile explicitly stores `highlightDurationMs: 200`, also consider exposing an on/off or duration control (optional) so the user can turn it off — but the default change is the core fix.

### SUBTÍTULOS — item 6: duplicate "Sample text" title
- Root cause: `services/remotion-studio/src/preview/TextareaInput.tsx` renders its own `<label>Sample Text</label>` (L23-24) AND the wrapping `CollapsibleSection title="Sample text"` (PreviewApp ~L867) shows the title → two headings.
- FIX: remove the inner `<label>Sample Text</label>` from `TextareaInput.tsx` (the CollapsibleSection owns the title). Keep the helper/description text. `TextareaInput` is only used in PreviewApp (safe). Studio-only.
</decisions>

<constraints>
## Constraints (LOCKED)
- UI tooling NON-NEGOTIABLE: invoke `impeccable` + `frontend-design` at execute start for all UI changes; honor `sketch-findings-reel-factory` + green-discipline (--action green = Render CTA ONLY; all these controls/buttons use --accent).
- Renderer sync MANDATORY for any change to `compositions/*` (TitleOverlay, TikTokLayout) or shared `src/*` (pipeline-config.ts): mirror studio→renderer per AGENTS.md `cp` pattern and RE-RUN the renderer vitest after EVERY sync (clobber hazard). Do NOT sync Root.tsx/SubtitledVideo.tsx.
- Additive/back-compatible schema changes; do NOT break existing titles/subtitles/overlays or the sentence/bar layouts.
- Studio is Docker-baked; live UAT (docker compose build/up) is the user's manual follow-up. Executors must pass `npm run build:editor` + BOTH vitest suites (studio currently 518, renderer 349).
</constraints>

<specifics>
## Specific Ideas
The 3 surfaces are largely independent. Suggested split: (Preview) item 1; (Títulos) items 2+3 (share TitleConfig schema + TitleOverlay + TitleEditor + renderer sync); (Subtítulos) items 4+5+6 (share subtitle config + TikTokLayout/StyleControls + renderer sync, except item 6 which is just TextareaInput). Títulos and Subtítulos both edit pipeline-config.ts → if parallel worktrees, sequence them or accept they touch disjoint sections of the same file.
</specifics>
