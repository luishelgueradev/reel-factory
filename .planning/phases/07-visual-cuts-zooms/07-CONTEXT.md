# Phase 7: Visual Cuts & Zooms - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Automatic zoom on emphasis moments and visual jump-cut transitions — making cuts feel intentional and polished. This phase adds two visual effects to the Remotion rendering pipeline: (1) VISU-03 — auto-zoom on the speaker during emphasis moments detected via Whisper confidence dips and silence boundaries, and (2) VISU-04 — zoom/crop-shift transitions at jump-cut boundaries from silence removal, so cuts appear intentional rather than raw splices.

The implementation extends the existing Remotion composition (Root.tsx SubtitledVideo) and render.ts pipeline. No new containers are needed — zoom and transition effects are applied as Remotion composition overlays within the existing remotion-renderer service.

**Key data inputs already available:**
- `transcript.json` — Whisper confidence scores per word (0-1, lower = emphasis candidate) and no_speech_prob per word
- `silence-cuts.json` — Jump-cut boundaries (original_start, original_end, cumulative_shift) marking where silence was removed
- `pipeline-config.json` — Config-driven composition (will be extended with zoom/transition fields)

</domain>

<decisions>
## Implementation Decisions

### Zoom Trigger Logic (VISU-03)
- **D-01:** Zoom trigger detection is computed in render.ts at render time, NOT as a separate pipeline step. The function `detectZoomEvents(transcript, silenceCuts)` reads transcript.json and silence-cuts.json, identifies emphasis moments from confidence dips and silence boundaries, and produces a `ZoomEvent[]` array. This keeps the architecture simple — no new container, no new artifact format, the zoom events are derived from existing data and passed directly as Remotion inputProps.
- **D-02:** Emphasis detection heuristic uses two signals to identify zoom-worthy moments:
  1. **Confidence dips**: Words with `confidence < CONFIDENCE_THRESHOLD` (default 0.6) trigger a zoom-in. These represent moments where Whisper was uncertain, often corresponding to emphasis (louder speech, stress, pitch changes).
  2. **Sentence starts after silence**: The first word after a silence cut boundary (where `no_speech_prob` was high) gets a mild zoom. These are natural emphasis points where the speaker resumes after a pause.
- **D-03:** Zoom events have three parameters: `startTimeMs`, `durationMs`, and `scale` (peak zoom level, default 1.15 = 15% zoom). Zoom-in follows an ease-in-out curve over a 300ms ramp, holds at peak scale for the emphasis duration, then eases back to 1.0 over 300ms.
- **D-04:** Overlapping zoom events are merged — if two emphasis moments are within 500ms of each other, they combine into a single longer zoom. This prevents rapid zoom-in/zoom-out oscillation (zoom stutter).

### Jump-Cut Transitions (VISU-04)
- **D-05:** Jump-cut transitions apply a brief zoom or crop-shift effect at each silence cut boundary. The transition covers the 150ms before and 100ms after the cut point, creating a visual "breathing" that masks the hard splice.
- **D-06:** Two transition types are supported via pipeline-config.json:
  1. **`zoom`** (default): Brief scale-up to 1.08 at the cut point, ease-in/ease-out over 250ms total. Simulates a camera breathing effect.
  2. **`crop-shift`**: Horizontal shift of ~20px that creates a subtle framing change at the cut point. Best for content where zoom would be too noticeable.
- **D-07:** Transition type and parameters are configurable via `transitions.type` and `transitions.durationMs` in pipeline-config.json. Default: `zoom` with 250ms duration.

### Remotion Architecture
- **D-08:** Zoom is implemented by wrapping `OffthreadVideo` in a `ZoomContainer` component that applies per-frame `transform: scale()` via Remotion's `interpolate()` and `useCurrentFrame()`. The scale value is computed from the zoom events array — each frame checks if it falls within a zoom event's time range and interpolates the scale accordingly.
- **D-09:** Jump-cut transitions are implemented as `<Sequence>` components placed at each silence cut boundary in the composition. Each transition `Sequence` overlays a brief visual effect (zoom burst or crop shift) at the cut point, creating the impression of an intentional edit.
- **D-10:** Zoom and transition overlays compose with the existing subtitle and title layers in the correct visual order: `ZoomContainer(OffthreadVideo)` → `SubtitleLayoutRenderer` → `TitleOverlay` Sequences → `JumpCutTransition` Sequences. Subtitles and titles are NOT zoomed — they remain at fixed positions. Only the video background zooms.

### Pipeline Config Extension
- **D-11:** PipelineConfig gains a new `visualEffects` top-level section:
  ```typescript
  interface VisualEffectsConfig {
    zooms?: ZoomConfig;
    transitions?: TransitionConfig;
  }
  interface ZoomConfig {
    enabled?: boolean;           // default: true
    confidenceThreshold?: number; // default: 0.6
    maxScale?: number;           // default: 1.15
    rampMs?: number;              // default: 300
    mergeGapMs?: number;          // default: 500
  }
  interface TransitionConfig {
    enabled?: boolean;           // default: true
    type?: "zoom" | "crop-shift" | "none"; // default: "zoom"
    durationMs?: number;          // default: 250
    maxScale?: number;           // default: 1.08 (for zoom type)
    shiftPx?: number;            // default: 20 (for crop-shift type)
  }
  ```
- **D-12:** When `visualEffects.zooms.enabled` is false (or the section is absent), no zoom events are computed and the video renders at scale=1.0 throughout. When `visualEffects.transitions.enabled` is false (or absent), no transition effects appear at cut points. This allows users to disable effects via the config editor.

### the agent's Discretion
- Exact interpolation easing function for zoom (cubic-bezier parameters, Remotion spring config)
- Whether to add a subtle vignette during zoom for depth effect (cosmetic enhancement)
- Exact confidence threshold value (0.6 is a starting point, may need tuning per video)
- Whether emphasis detection considers speaker pitch/intensity in addition to confidence (future ML enhancement)
- Specific pixel offset for crop-shift transitions (20px default is a starting point)
- Test video selection for E2E validation (existing test video vs. new test fixture)
- Whether to add visual debugging tools (e.g., render zoom event markers as colored dots on a timeline)

### Folded Todos
No todos were folded into scope from cross-reference.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — VISU-03, VISU-04 requirements
- `.planning/ROADMAP.md` — Phase 7 goal, success criteria, plan breakdown
- `.planning/STATE.md` — Current project position

### Prior Phase Context (Foundation)
- `.planning/phases/01-pipeline-infrastructure/01-CONTEXT.md` — Volume strategy (D-01 to D-04), step contract (D-05 to D-07), artifact naming (D-10 to D-13)
- `.planning/phases/02-whisper-transcription/02-CONTEXT.md` — Transcript schema (D-07, D-09), word-level timestamps with confidence and no_speech_prob
- `.planning/phases/03-silence-detection-removal/03-CONTEXT.md` — Silence-cuts.json with cumulative_shift (D-07), 50ms padding (D-06)
- `.planning/phases/04-9-16-vertical-output/04-CONTEXT.md` — 9:16 center-crop output (D-01 to D-04), safe zones (D-05 to D-07), finalizer-info.json
- `.planning/phases/05-remotion-animated-subtitles/05-CONTEXT.md` — Timestamp remapping (D-01 to D-04), pipeline order (D-05 to D-06), input artifacts (D-07 to D-09), render config (D-12 to D-13), Subtitles.tsx architecture
- `.planning/phases/06-animated-intros-outros/06-CONTEXT.md` — Config-driven composition (D-01 to D-03), layout modes (D-04 to D-09), title overlays (D-10 to D-13), remotion-studio container (D-14 to D-20)

### Technology Stack
- `.planning/research/STACK.md` — Remotion 4.0.457, @remotion/captions, @remotion/studio, Express.js 5, Docker, Node 22

### Existing Codebase (CRITICAL — substantial implementation to extend)
- `services/remotion-renderer/src/Root.tsx` — RemotionRoot with SubtitledVideo composition; zoom/transition overlays will be added here
- `services/remotion-renderer/src/render.ts` — Render pipeline; will load zoom events and pass them as inputProps
- `services/remotion-renderer/src/captions.ts` — Timestamp remapping, WhisperWord interface (confidence, no_speech_prob)
- `services/remotion-renderer/src/pipeline-config.ts` — PipelineConfig schema; will be extended with VisualEffectsConfig
- `services/remotion-renderer/src/compositions/LayoutDispatcher.tsx` — Layout mode router
- `services/remotion-renderer/src/compositions/TitleOverlay.tsx` — Title overlay with entrance animations (pattern reference for zoom animation)
- `services/remotion-renderer/src/compositions/shared-styles.ts` — Shared timing constants (FADE_IN_MS, FADE_OUT_MS)
- `services/remotion-renderer/src/validate.ts` — Output validation module
- `services/remotion-renderer/src/fonts.ts` — Font loading infrastructure
- `docker-compose.yml` — Pipeline service definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/remotion-renderer/src/Root.tsx`: Main composition with `OffthreadVideo` (background), `SubtitleLayoutRenderer` (captions), `TitleOverlay` Sequences (titles). Zoom container will wrap OffthreadVideo; transition Sequences will be added alongside title Sequences.
- `services/remotion-renderer/src/render.ts`: Full render pipeline — loads transcript.json, silence-cuts.json, finalizer-info.json, pipeline-config.json. Will be extended to compute zoom events and pass them as inputProps. Already has error handling patterns for missing/invalid JSON files.
- `services/remotion-renderer/src/captions.ts`: Contains WhisperWord interface (with `confidence` and `no_speech_prob` fields), SilenceCut/SilenceCutList interfaces, `remapTimestamps()` binary search function, `areTimestampsAlreadyRemapped()` detection. Zoom detection will read the same transcript data.
- `services/remotion-renderer/src/pipeline-config.ts`: Full PipelineConfig schema with SubtitleConfig, TitleConfig, validation. Will be extended with VisualEffectsConfig.
- `services/remotion-renderer/src/compositions/TitleOverlay.tsx`: Uses `interpolate()` for entrance animations (slide-up). Same Remotion interpolation pattern will be used for zoom scale animations.
- `services/remotion-renderer/src/compositions/shared-styles.ts`: Shared timing constants. Can be extended with ZOOM_RAMP_MS, TRANSITION_DURATION_MS.
- `services/whisper/src/schema.py`: TranscriptWord model with `confidence` (0-1) and `no_speech_prob` (0-1). These are the signals for zoom trigger detection.

### Established Patterns
- Step contract: Read INPUT_PATH, write to OUTPUT_PATH, create manifest.json (D-05, D-07 from Phase 1)
- Config-driven composition via pipeline-config.json (D-01 from Phase 6)
- Remotion `<Sequence>` for timed overlays (TitleOverlay pattern)
- `interpolate()` for frame-to-value animations (TitleOverlay entrance, subtitle fade-in/out)
- InputProps from render.ts → composition → child components
- PipelineConfig validation with `validatePipelineConfig()`

### Integration Points
- `render.ts`: Must compute zoom events from transcript + silence-cuts, pass as inputProps
- `Root.tsx SubtitledVideo`: Must wrap OffthreadVideo in zoom container, add transition Sequences
- `pipeline-config.ts`: Must add VisualEffectsConfig with zoom/transition settings
- `validate.ts`: Must add VISU-03, VISU-04 validation checks
- Remotion Studio config editor: Must add zoom/transition configuration controls (Phase 6 web UI)
- `docker-compose.yml`: No changes needed — zoom/transition logic stays in remotion-renderer

### Key Gaps in Existing Code
- No zoom or transition components exist — `ZoomContainer` and `JumpCutTransition` need to be created
- No zoom event detection function — `detectZoomEvents()` needs to be written
- No VisualEffectsConfig in PipelineConfig — schema extension needed
- No VISU-03/VISU-04 validation checks in validate.ts
- OffthreadVideo is rendered at fixed scale=1.0 — needs a wrapping container that applies dynamic scale
- Confidence threshold detection is a new concept — no heuristic exists in the codebase yet

</code_context>

<specifics>
## Specific Ideas

- The `detectZoomEvents()` function should process whisper words in order, merging overlapping/nearby emphasis events into consolidated zoom ranges. This is similar to how `transcriptToCaptionPages()` processes word-level data into page-level groupings.
- The `confidence < 0.6` threshold is adjustable via config — some speakers may trigger too many zooms (constantly low confidence) or too few (high confidence throughout). The config editor should expose this as a "sensitivity" slider (low/medium/high mapping to threshold values).
- Zoom scale of 1.15 (15%) is subtle enough to feel natural on vertical video without causing visible quality loss. The 9:16 format means the source video is already 1080 pixels wide — 15% zoom crops to ~940px displayed at 1080px, which Remotion handles via CSS transform without resolution loss.
- Crop-shift transitions (VISU-04) create a "breathing" edit effect common in social media editing. The 20px horizontal shift at 1080px wide is ~1.85% — barely perceptible individually but creates a professional edit feel when every cut has a consistent micro-transition.
- The visual order matters: zoom affects the background video only, not subtitles/titles. This means subtitles remain readable during zoom events. The composition order is: `(ZoomContainer(OffthreadVideo)) → (SubtitleLayoutRenderer) → (TitleOverlay Sequences) → (JumpCutTransition Sequences)`.
- The jump-cut transition `Sequence` uses `from` and `durationInFrames` calculated from silence-cuts.json boundaries, similar to how title overlays use `startTimeMs` and `durationMs`.

</specifics>

<deferred>
## Deferred Ideas

- **Auto-generated zoom events from audio energy analysis:** Using audio RMS/loudness to detect emphasis moments in addition to Whisper confidence. This would require a new audio analysis step. Deferred to future enhancement.
- **Config editor slider for zoom sensitivity:** The web UI could expose confidence threshold as a slider. Deferred — the config schema supports it, but the editor UI update is cosmetic and can be added in a later iteration.
- **Zoom preview in Remotion Studio:** Live preview of zoom events while editing config. The Remotion Studio already supports live preview of config changes, so this works automatically once zoom events are in the composition.
- **Multiple transition styles per video:** Currently one transition type applies to all cuts. Per-cut transition types could be a future config enhancement.

</deferred>

---

*Phase: 7-Visual Cuts & Zooms*
*Context gathered: 2026-05-12*