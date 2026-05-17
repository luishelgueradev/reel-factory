# Phase 12: Subtitle Preview Lab - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Source:** Derived from ROADMAP.md requirements and prior phase context

<domain>
## Phase Boundary

Interactive web page at `/preview` for live subtitle style preview with all tunable parameters, rendering fonts exactly as they appear in final video output over a sample background. The page uses Remotion's rendering engine (`@remotion/player`) for pixel-accurate preview of the same compositions used in production renders, and provides real-time parameter controls for SubtitleConfig fields.

This phase extends the existing `remotion-studio` service — adding a `/preview` route alongside the existing `/editor` route. It also adds `pastWordOpacity` to the production `SubtitleConfig` and all layout components so this parameter works in both preview and production rendering.

**Key requirements:** PREV-01 (9:16 viewport with sample video/image background and subtitle overlay using Remotion), PREV-02 (all 18 fonts render with production engine), PREV-03 (real-time parameter controls for all subtitle fields).

**Phase 6 context carried forward:** The remotion-studio service already has an Express server (`server.ts`) with GET/PUT `/api/config`, a React+Vite editor SPA at `/editor` with StyleControls/LayoutSelector/TitleEditor components, and shared `pipeline-config.ts` + `fonts.ts` imports.

</domain>

<decisions>
## Implementation Decisions

### Architecture & Service Placement
- **D-01:** The `/preview` page is served by the existing `remotion-studio` Express server. No new Docker container. Preview is a new route alongside `/editor` in the same service.
- **D-02:** Single SPA with routing — `/editor` and `/preview` coexist in the same Vite build. React Router or conditional rendering switches between them. One bundle, one build step. Shared component library.
- **D-03:** The preview focuses on SubtitleConfig parameters only — no visual effects (zooms, transitions) or title overlays. Those remain in `/editor`. The preview page controls: layout mode, fontFamily, fontSize, activeColor, inactiveColor, letterSpacing, lineHeight, backgroundHighlight (color, padding, borderRadius, enabled), outlineColor, outlineWidth, position, bottomOffset, pastWordOpacity.

### Preview Rendering
- **D-04:** Use `@remotion/player` (Remotion's React `<Player>` component) to render the exact same `SubtitledVideo` composition used in production. This guarantees pixel-accurate match — the same components, same fonts, same layout logic.
- **D-05:** The Remotion Player renders at native 1080x1920 composition size. CSS `transform: scale()` scales the viewport down to fit the preview panel. This ensures fonts and spacing are production-accurate.
- **D-06:** A sample video MP4 is bundled inside the `remotion-studio` container's `public/` directory. The preview loads it via `staticFile()` (Remotion's static asset API). Short clip (5-10 seconds), always available without user action.

### Parameters & Controls UX
- **D-07:** Add `pastWordOpacity` as a new field in `SubtitleConfig` (in `pipeline-config.ts`). Default value: `0.4`. All four layout components (TikTokLayout, SentenceLayout, BarLayout, KaraokeLayout) read this value and apply opacity to was-active (past) words. This ensures preview behavior matches production rendering.
- **D-08:** Layout: 9:16 preview viewport on the left, collapsible control panels on the right. Mirrors the existing `/editor` layout pattern.
- **D-09:** Reuse the existing `StyleControls.tsx` component from the editor SPA. Extend it to add missing parameters (lineHeight, pastWordOpacity). Import as a shared component between `/editor` and `/preview`.
- **D-10:** Word-by-word subtitle cycling uses standard Remotion Player playback controls (play/pause/scrub via timeline). The user controls playback speed and position, seeing how active/past/future words look at any moment.

### Sample Content & Font Grid
- **D-11:** Sample subtitle text comes from an editable textarea with hardcoded Spanish default text pre-filled on first load. User can modify the text freely. The text is converted to `TikTokPage[]` format at runtime for the Remotion Player.
- **D-12:** Font grid view is a separate route/tab (`/preview/fonts`) showing all 18 fonts in a grid layout. Each cell shows font name + sample text rendered in that font. Clicking a font selects it and returns to the main preview.
- **D-13:** Font grid uses CSS font rendering with Google Fonts loaded via `@remotion/google-fonts` (the same `loadFont()` function already in `fonts.ts`). Each cell is plain HTML/CSS — not a separate Remotion composition. Lightweight, fast, and the font-family strings match production exactly.

### the agent's Discretion
- Exact default Spanish paragraph content for the textarea
- Sample video selection (what MP4 to bundle, how long)
- CSS scale-down implementation details (transform-origin, responsive sizing)
- Layout of control panels (section grouping, collapse behavior)
- Color picker vs color input implementation
- Font grid cell size and layout (3 columns? 4? responsive?)
- How textarea text converts to TikTokPage[] for the player (use `transcriptToCaptionPages` with synthetic word timestamps, or a simpler conversion)
- Whether lineHeight and letterSpacing sliders have specific min/max/step values beyond what StyleControls already uses
- React Router vs conditional rendering for SPA routing
- `@remotion/player` import and bundle integration details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions (Docker pipeline, extensible steps, Remotion for overlays)
- `.planning/REQUIREMENTS.md` — PREV-01, PREV-02, PREV-03 requirements
- `.planning/ROADMAP.md` — Phase 12 goal, success criteria, plan breakdown
- `.planning/STATE.md` — Current project position

### Prior Phase Context (Foundation)
- `.planning/phases/06-subtitle-enhancements-titles/06-CONTEXT.md` — Config editor SPA architecture, StyleControls, LayoutSelector, font infrastructure (18 Google Fonts + monospace)
- `.planning/phases/05-remotion-subtitles/05-CONTEXT.md` — Remotion rendering pipeline, caption pages, SubtitledVideo composition

### Technology Stack
- `.planning/research/STACK.md` — Remotion 4.0.457, `@remotion/captions`, `@remotion/player`, `@remotion/google-fonts`, React 19

### Existing Codebase (CRITICAL — extend, don't rebuild)
- `services/remotion-studio/src/server.ts` — Express server with GET/PUT `/api/config`, static SPA serving. ADD `/preview` route here.
- `services/remotion-studio/src/editor/App.tsx` — React SPA root. ADD preview route/tab here.
- `services/remotion-studio/src/editor/components/StyleControls.tsx` — Subtitle style parameter controls (fontSize, colors, outline, letterSpacing, position, backgroundHighlight). EXTEND with lineHeight and pastWordOpacity.
- `services/remotion-studio/src/editor/components/LayoutSelector.tsx` — Layout mode selector (TikTok, Sentence, Bar, Karaoke). REUSE in preview.
- `services/remotion-renderer/src/pipeline-config.ts` — SubtitleConfig, PipelineConfig, DEFAULT_SUBTITLE_CONFIG, validatePipelineConfig(). ADD pastWordOpacity field.
- `services/remotion-renderer/src/fonts.ts` — AVAILABLE_FONTS (18 + monospace), loadFont() function. REUSE in preview and font grid.
- `services/remotion-renderer/src/Root.tsx` — SubtitledVideo composition, RemotionRoot registration. REUSE with @remotion/player.
- `services/remotion-renderer/src/compositions/TikTokLayout.tsx` — Word-by-word subtitle layout with CaptionWord component. EXTEND with pastWordOpacity.
- `services/remotion-renderer/src/compositions/SentenceLayout.tsx` — Sentence layout. EXTEND with pastWordOpacity.
- `services/remotion-renderer/src/compositions/BarLayout.tsx` — Bar layout. EXTEND with pastWordOpacity.
- `services/remotion-renderer/src/compositions/KaraokeLayout.tsx` — Karaoke layout. EXTEND with pastWordOpacity.
- `services/remotion-renderer/src/compositions/LayoutDispatcher.tsx` — Layout selector component. Passes SubtitleConfig through.
- `services/remotion-renderer/src/compositions/shared-styles.ts` — getPositionStyles(), getBackgroundHighlightStyle(). REUSE.
- `services/remotion-renderer/src/captions.ts` — transcriptToCaptionPages() for converting words to TikTokPage[].
- `services/remotion-studio/vite.config.ts` — Vite configuration for editor SPA build. EXTEND for preview.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StyleControls.tsx` — Already has sliders for fontSize (24-120), outlineWidth (0-10), letterSpacing, color pickers for activeColor/inactiveColor/outlineColor, position selector (bottom-center, top-center, center-screen), backgroundHighlight toggle. Needs: lineHeight, pastWordOpacity.
- `LayoutSelector.tsx` — Already renders 4 layout mode buttons (tiktok, sentence, bar, karaoke). Can be imported directly into preview.
- `fonts.ts` — AVAILABLE_FONTS array (18 + monospace), loadFont() async function. Directly reusable for font grid and preview font loading.
- `pipeline-config.ts` — SubtitleConfig interface, DEFAULT_SUBTITLE_CONFIG, validatePipelineConfig(). Must add pastWordOpacity field and default.
- `Root.tsx:SubtitledVideo` — The production composition. Used directly by @remotion/player in preview for pixel-accurate rendering.
- `captions.ts:transcriptToCaptionPages()` — Can convert a synthetic transcript (from textarea) into TikTokPage[] for the Remotion Player.
- `server.ts` — Express server with CORS, JSON parsing, config API. Add `/preview` static serving route.

### Established Patterns
- React + Vite SPA pattern in remotion-studio (editor SPA at /editor with Vite dev server proxy)
- SubtitleConfig-driven rendering — all layout components read from SubtitleConfig with defaults
- @remotion/google-fonts loading pipeline — loadFont() with monospace fallback for Docker environments
- PipelineConfig validation — validatePipelineConfig() for config writes
- Express static serving — editor SPA served via express.static with SPA fallback

### Integration Points
- `services/remotion-studio/src/server.ts` — Add `app.use("/preview", express.static(PREVIEW_DIST))` and SPA fallback route for `/preview`
- `services/remotion-studio/src/editor/` — Restructure to share components between /editor and /preview (React Router)
- `services/remotion-renderer/src/pipeline-config.ts` — Add `pastWordOpacity?: number` field to SubtitleConfig, add default `0.4` to DEFAULT_SUBTITLE_CONFIG, update validation
- `services/remotion-renderer/src/compositions/*.tsx` — All 4 layout components need to read pastWordOpacity from config and apply it to was-active words
- `services/remotion-studio/package.json` — Add `@remotion/player` dependency
- `services/remotion-studio/vite.config.ts` — May need updates for the preview SPA entry point or routing
- `services/remotion-renderer/src/compositions/shared-styles.ts` — May add a helper for past word opacity styling

### Key Gaps in Existing Code
- No `/preview` route or page exists in remotion-studio
- No pastWordOpacity field in SubtitleConfig — needs to be added to the interface, defaults, validation, and all 4 layout components
- No @remotion/player dependency in remotion-studio — needs to be added
- No font grid view (separate page showing all 18 fonts)
- No sample video bundled in the container
- No textarea-based caption text input — only hardcoded transcript loading exists
- StyleControls.tsx is missing lineHeight and pastWordOpacity controls

</code_context>

<specifics>
## Specific Ideas

- The Remotion Player `<Player>` component accepts `component`, `inputProps`, `compositionWidth`, `compositionHeight`, `fps`, `durationInFrames`, and `controls` props. Setting `compositionWidth={1080}` and `compositionHeight={1920}` with CSS `transform: scale()` to fit the preview panel gives exact production rendering.
- For converting textarea text to `TikTokPage[]`: create a synthetic WhisperTranscript from the textarea text with evenly-distributed timestamps (e.g., 3 words per second, so each word gets a start/end timestamp). Then call `transcriptToCaptionPages()` with this synthetic transcript. This leverages existing infrastructure.
- The font grid page (`/preview/fonts`) loads all 18 fonts via `loadFont()` from `fonts.ts`, renders each in a card showing the font name and sample text. CSS `font-family` applies the loaded font directly. No Remotion Player needed for the grid — just CSS.
- `pastWordOpacity` implementation: in each layout component, words where `wasActive === true && isActive === false` get `opacity: config.pastWordOpacity ?? DEFAULT_SUBTITLE_CONFIG.pastWordOpacity`. TikTokLayout already distinguishes `isActive` and `wasActive` in CaptionWord — just add the opacity style.
- The sample video should be short (5-10 seconds) and representative of a talking-head clip. It gets bundled in the Docker image at build time (COPY to `public/`).
- The preview page reads SubtitleConfig state from React local state (not from pipeline-config.json API). Changes update local state immediately and flow to the Remotion Player via `inputProps`. "Save Config" writes current state to the API (PUT `/api/config`), same as the editor.

</specifics>

<deferred>
## Deferred Ideas

- **Visual effects preview (zooms, transitions)** — Preview could extend to show zoom and transition effects, but that's beyond PREV-01/02/03 scope and adds complexity. Future phase.
- **Title overlay preview** — The /editor already handles title configuration. Adding title preview to /preview is a separate concern.
- **Custom video upload** — PREV-01 says "sample video/image background". Allowing user video uploads is a natural extension but not in scope.
- **Export/apply config to pipeline** — The /editor already has PUT `/api/config`. The preview could have a "Copy config JSON" or "Apply to pipeline" button as a convenience, but saving via the existing editor API is already available.
- **Responsive multi-device preview** — Showing how subtitles look at different aspect ratios (e.g., 1:1 for Instagram) is out of scope for v1 (9:16 only per PROJECT.md).

---

*Phase: 12-Subtitle Preview Lab*
*Context gathered: 2026-05-17*