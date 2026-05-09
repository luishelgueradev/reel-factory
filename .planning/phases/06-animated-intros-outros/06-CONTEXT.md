# Phase 6: Subtitle Enhancements, Titles & Web Config - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Configurable subtitle styles with multiple layout modes, timed title overlays, and a web-based studio UI for live preview and configuration — all rendered via an extended Remotion composition driven by a per-job config JSON. This phase repurposes the original "Animated Intros & Outros" phase to deliver: (1) four subtitle layout modes (TikTok word-by-word, sentence-at-a-time, full-width bar, karaoke-style fill), (2) static and timed title overlays with entrance animations, (3) a dedicated Remotion Studio web container for live preview and config editing, and (4) a per-job pipeline-config.json schema that drives the Remotion composition.

**Note:** The existing Subtitles.tsx and Root.tsx compositions in `services/remotion-renderer/` already implement the TikTok word-by-word style. This phase extends that composition to be config-driven with layout mode selection, adds title overlay Sequences, and creates a new remotion-studio container for web configuration.

</domain>

<decisions>
## Implementation Decisions

### Rendering Architecture
- **D-01:** Single config-driven Remotion composition — one composition receives the full config (subtitle style, layout mode, title overlays, colors, fonts) as input props and renders everything in a single pass. No separate compositions per style. The config JSON drives which subtitle layout component renders, which titles appear where, and all visual parameters.
- **D-02:** A new `pipeline-config.json` per job replaces environment variables for Remotion configuration. The file lives at `/data/pipeline/{job_id}/remotion-renderer/pipeline-config.json` alongside the existing input artifacts. This JSON contains: subtitle layout mode, style parameters (colors, fonts, font size, outline, background highlight, position), title overlay definitions (text, startTime, duration, style), and any other visual config. The Remotion container reads it as an input artifact following the step contract pattern.
- **D-03:** The existing environment variables (ACTIVE_COLOR, INACTIVE_COLOR, FONT_SIZE, bottomOffset) become fallback defaults — pipeline-config.json takes precedence when present. This maintains backward compatibility with CLI-only pipeline runs that don't use the web UI.

### Subtitle Layout Modes
- **D-04:** Four core subtitle layout modes in v1:
  1. **TikTok word-by-word** — existing implementation, active word highlighted, inactive words dimmed (current SUBT-01/SUBT-02 behavior)
  2. **Sentence-at-a-time** — full sentence appears at once, current sentence highlighted against previous sentences
  3. **Full-width bar** — colored background bar behind text, word-by-word fill within the bar (Instagram Reels style)
  4. **Karaoke-style fill** — text fills with a progress color as each word is spoken against a dimmed baseline (classic karaoke highlight)
- **D-05:** Layout mode is selected via `pipeline-config.json` field `subtitleLayout` (values: `tiktok`, `sentence`, `bar`, `karaoke`). Default: `tiktok` (matches current behavior).

### Subtitle Styling Configuration
- **D-06:** Styling is independently configurable per layout mode. Global style props in pipeline-config.json: `fontFamily`, `fontSize`, `activeColor`, `inactiveColor`, `outlineColor`, `outlineWidth`, `backgroundHighlight` (on/off + color), `textShadow` (on/off + params), `letterSpacing`, `subtitlePosition` (`bottom-center`, `top-center`, `center-screen`).
- **D-07:** Three to five curated fonts shipped with the container. User selects from the list in config. Initial set: Inter, Roboto, Montserrat, Oswald, system monospace fallback. Fonts are bundled in the Docker image at build time (or loaded via Remotion's staticFile mechanism).
- **D-08:** Background highlight effect — optional colored rectangle behind subtitle words (Instagram/Reels style). Configurable per mode via `backgroundHighlight` prop: `{ enabled: boolean, color: string, padding: number, borderRadius: number }`.
- **D-09:** Subtitle position presets: `bottom-center` (default, respects safe zones from finalizer-info.json), `top-center`, `center-screen`. The `bottomOffset` value is derived from finalizer-info.json safe zones for `bottom-center`, or hardcoded presets for `top-center` and `center-screen`.

### Title Overlays
- **D-10:** Two types of title overlays:
  1. **Static intro title card** — a single title (e.g., video title, speaker name) that appears at video start with a configurable duration (default 3 seconds)
  2. **Timed title overlays** — multiple title entries defined in pipeline-config.json with explicit `startTime` and `duration` timestamps, positioned manually via the web UI timeline
- **D-11:** Title visual style: centered bold text with animated entrance (slide-up + fade-in) on a semi-transparent background bar. Matches social video aesthetics. Parameters: `titleText`, `subtitleText`, `backgroundColor`, `textColor`, `entranceAnimation` (`slide-up`, `fade-in`, `none`).
- **D-12:** Titles are defined in pipeline-config.json under `titles` array: `[{ text: string, subtitle?: string, startTimeMs: number, durationMs: number, style: TitleStyleProps }]`. The intro title has `startTimeMs: 0`.
- **D-13:** Title overlays render as Remotion `<Sequence>` components composed before and between subtitle `<Sequence>` components in the master composition. Titles and subtitles coexist — titles appear at their scheduled times while subtitles continue normally.

### Web Configuration UI (Remotion Studio)
- **D-14:** A dedicated `remotion-studio` Docker container serves the web configuration UI and Remotion Studio preview. This is separate from the production `remotion-renderer` container. Both containers share the same Remotion source code (mounted via shared volume or copied at build time), but serve different purposes: studio = interactive preview + config editing, renderer = headless production render.
- **D-15:** The web UI uses Remotion Studio's built-in timeline for preview and scrubbing. Config changes (subtitle style, title placement, layout mode selection) are reflected in real-time via Remotion's `inputProps` mechanism. The UI edits pipeline-config.json, which Remotion Studio reads as input props.
- **D-16:** The `remotion-studio` container serves two things: (1) Remotion Studio at a defined port for live preview with timeline scrubbing, and (2) a config editor React app for changing subtitle styles, layout modes, title overlays, and triggering renders. The config editor is a separate React SPA that writes pipeline-config.json via an API endpoint.
- **D-17:** Pipeline config JSON schema is the contract between the web UI and the Remotion composition. The schema definition lives in shared code (TypeScript interface) that both the studio and renderer import. Schema validation happens on both sides.

### Infrastructure
- **D-18:** Docker Compose adds: `remotion-studio` service (new container, `@remotion/studio` serving the composition + config editor). The `remotion-renderer` service remains for production headless renders. Both share the Remotion source code volume.
- **D-19:** The `remotion-studio` container and `remotion-renderer` container both read `pipeline-config.json` from the shared volume. When no config file exists (CLI-only pipeline run), the renderer falls back to environment variables and layout mode defaults.
- **D-20:** Render triggering from the web UI: the studio container calls the remotion-renderer's render endpoint (or directly calls renderMedia within the studio process) to produce the final video. The config editor has a "Render" button that starts the production render and provides download URL on completion.

### the agent's Discretion
- Exact TypeScript implementation of each layout mode component (TikTok, Sentence, Bar, Karaoke)
- Specific spring animation parameters for each layout mode's entrance/exit animations
- Default style values for each layout mode when config fields are omitted
- Font loading mechanism in Docker (bundled vs. staticFile vs. web fonts)
- React component structure for the config editor SPA
- Error handling for missing pipeline-config.json (graceful fallback)
- Whether the studio container renders internally or triggers the renderer container
- Specific colors for curated default themes
- Title entrance animation keyframes and easing functions
- Web UI layout and component architecture

### Folded Todos
No todos were folded into scope from cross-reference.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions (pipeline architecture, 9:16 output, extensible step contracts)
- `.planning/REQUIREMENTS.md` — VISU-01, VISU-02 requirements (now repurposed for subtitle enhancements + titles), traceability table
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, plan breakdown
- `.planning/STATE.md` — Current project position, blockers, and deferred items

### Prior Phase Context (Foundation)
- `.planning/phases/01-pipeline-infrastructure/01-CONTEXT.md` — Volume strategy (D-01 to D-04), step contract (D-05 to D-07), artifact naming (D-10 to D-13), orchestration (D-08 to D-09)
- `.planning/phases/02-whisper-transcription/02-CONTEXT.md` — Transcript schema (D-07, D-09), word-level timestamps
- `.planning/phases/03-silence-detection-removal/03-CONTEXT.md` — Silence-cuts.json with cumulative_shift (D-07), 50ms padding (D-06)
- `.planning/phases/04-9-16-vertical-output/04-CONTEXT.md` — 9:16 center-crop output (D-01 to D-04), safe zones (D-05 to D-07), finalizer-info.json
- `.planning/phases/05-remotion-animated-subtitles/05-CONTEXT.md` — Timestamp remapping (D-01 to D-04), pipeline order (D-05 to D-06), input artifacts (D-07 to D-09), render config (D-12 to D-13), Subtitles.tsx architecture

### Technology Stack
- `.planning/research/STACK.md` — Remotion 4.0.457, @remotion/captions, @remotion/studio, Express.js 5, Docker, Node 22

### Existing Codebase (CRITICAL — substantial implementation to extend)
- `services/remotion-renderer/src/compositions/Subtitles.tsx` — Current TikTok-style implementation with CaptionPage, CaptionWord components. This becomes one of four layout mode components.
- `services/remotion-renderer/src/Root.tsx` — RemotionRoot with SubtitledVideo composition, 1080x1920, calculateMetadata for dynamic duration. Must be extended for config-driven props and title Sequences.
- `services/remotion-renderer/src/captions.ts` — `transcriptToCaptionPages()` maps Whisper transcript → TikTokPage[]. Needs extension for other layout modes or genericization.
- `services/remotion-renderer/src/render.ts` — Production render pipeline with ffprobe, manifest writing, env var parsing. Must read pipeline-config.json and pass config to composition.
- `services/remotion-renderer/package.json` — Remotion 4.0.457 dependencies. Needs @remotion/studio for the studio container.
- `services/remotion-renderer/Dockerfile` — Node 22 bookworm-slim base with Chrome. Studio container inherits or shares this.
- `docker-compose.yml` — Current remotion-renderer service. Needs remotion-studio service addition.
- `services/ffmpeg-finalizer/src/schema.py` — SafeZone and FinalizerInfo models. Studio config must reference these for subtitle positioning.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/remotion-renderer/src/compositions/Subtitles.tsx`: CaptionPage and CaptionWord components with spring fade-in, TikTok-style active word highlighting. The TikTok layout mode reuses this directly. Other modes will use the same TikTokPage data but render differently.
- `services/remotion-renderer/src/Root.tsx`: RemotionRoot with SubtitledVideo composition, dynamic metadata calculation. Must be extended to accept config props (layout mode, style params, title overlays) via `inputProps`.
- `services/remotion-renderer/src/captions.ts`: `transcriptToCaptionPages()` function — creates TikTokPage[] from transcript. This is layout-mode-agnostic (it creates pages of words with timestamps). Other layout modes consume the same TikTokPage[] data.
- `services/remotion-renderer/src/render.ts`: Full render pipeline — env var parsing, video probing, composition selection, renderMedia. Must be extended to read pipeline-config.json and pass config as inputProps.
- `services/base-node/Dockerfile`: Node 22 bookworm-slim with FFmpeg 7.1.1 and Chrome dependencies. Studio container shares or inherits from this.
- `services/ffmpeg-finalizer/src/schema.py`: SafeZone and FinalizerInfo models — the config schema must reference safe zone values for subtitle positioning presets.

### Established Patterns
- Step contract: Read INPUT_PATH, write to OUTPUT_PATH, create manifest.json (D-05, D-07 from Phase 1)
- Pipeline-config.json follows the same artifact pattern — lives in the step's output/input directory, is a predictable filename consumed by the next step
- Container inherits from base image, runs main entrypoint script
- Error handling: exit codes 0/1/2+, structured manifest with status and error_message
- Config via environment variables with fallback defaults (D-03 — pipeline-config.json takes precedence, env vars are fallback)
- Artifact path: `/data/pipeline/{job_id}/{step_name}/` with fixed predictable filenames (D-13)
- Remotion composition at 1080x1920 (9:16) always (D-13/P5)
- --gl=angle-egl Chrome flag for Docker rendering stability (D-12/P5)

### Integration Points
- `services/remotion-renderer/src/Root.tsx`: Composition must accept extended props — subtitle layout mode, style config, title overlays array, pipeline config reference
- `services/remotion-renderer/src/render.ts`: Must read pipeline-config.json from input path, parse it, and pass as inputProps to renderMedia
- `docker-compose.yml`: New `remotion-studio` service with Remotion Studio serving the composition at a port, plus a React SPA for config editing
- `services/remotion-renderer/src/captions.ts`: TikTokPage[] data structure feeds all layout modes — no change needed to the data layer, only rendering components change
- Phase 7/8 future: Zooms and SRT export will also read pipeline-config.json for their configuration needs
- Web UI config editor writes pipeline-config.json → Remotion Studio picks it up as inputProps → live preview updates

### Key Gaps in Existing Code
- No layout mode selection mechanism — Subtitles.tsx is hardcoded to TikTok word-by-word style
- No title overlay components — no TitleCard or TimedOverlay exists yet
- No pipeline-config.json schema or reading logic in render.ts
- No Remotion Studio container or config editor SPA — only production rendering exists
- No config-driven prop passing — the composition currently reads env vars and static props, not a config JSON
- Font loading infrastructure not set up — only system fonts available

</code_context>

<specifics>
## Specific Ideas

- The config-driven composition approach means the existing SubtitledVideo component becomes a dispatcher that reads `subtitleLayout` from inputProps and renders the appropriate layout mode component (TikTokLayout, SentenceLayout, BarLayout, KaraokeLayout)
- Title overlays use Remotion's `<Sequence>` with `from` and `durationInFrames` calculated from the title's `startTimeMs` and `durationMs` — same pattern as existing caption page Sequences in Subtitles.tsx
- The intro title card (startTimeMs: 0) naturally overlaps with the first subtitle page — the title should have its own Sequence that renders on top, with semi-transparent background
- The four layout modes share TikTokPage[] as input data (from @remotion/captions) — the rendering layer changes per mode, not the data layer
- Background highlight for the "bar" mode uses a `<div>` behind the text with background color, padding, and border-radius — Remotion supports CSS-in-JS natively
- The remotion-studio container can use `npx remotion studio` to serve the composition with hot reload, just like local development but in Docker
- Config editor can use `@remotion/player` for inline preview within the editing form, or rely on the full Remotion Studio in an iframe next to the editor
- Safe zone positioning for `bottom-center` reads from finalizer-info.json (already established in Phase 5). `top-center` and `center-screen` use calculated offsets (top: ~100px from top, center: 50% minus half text height)
- Curated fonts can be loaded via Remotion's `@remotion/google-fonts` helper or by bundling .woff2 files and using `staticFile()` — the researcher decides which approach

</specifics>

<deferred>
## Deferred Ideas

- **Animated intros/outros (original Phase 6 scope):** branded intro/outro sequences at video start/end — repurposed in favor of subtitle enhancements + titles. May be revisited in a future phase if needed.
- **Auto-generated titles from transcript heuristics:** the user expressed interest in manual config timestamps for v1. Auto-generation from transcript analysis could be a later enhancement.
- **Named theme presets (e.g., 'Neon', 'Elegant', 'Minimal'):** more complex than per-mode style configuration. Could be added as a convenience layer on top of the config schema later.
- **Custom font upload via web UI:** v1 ships with a curated font set. User-provided fonts via upload is a future enhancement.
- **B-roll placeholders and clips:** already marked out of scope in PROJECT.md — not part of this phase.

</deferred>

---

*Phase: 6-Subtitle Enhancements, Titles & Web Config*
*Context gathered: 2026-05-09*