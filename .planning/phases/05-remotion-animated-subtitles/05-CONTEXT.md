# Phase 5: Remotion + Animated Subtitles - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Word-by-word animated subtitles burned into the 9:16 video — the killer feature for short-form content. This phase delivers a working remotion-renderer container that takes the 9:16 video from ffmpeg-finalizer, reads transcript.json and silence-cuts.json, remaps word timestamps to the post-silence-removal timeline, creates TikTok-style caption pages using @remotion/captions, and renders a final 1080x1920 MP4 with burned-in animated subtitles positioned within safe zones.

**Note:** Substantial code already exists in `services/remotion-renderer/`. The Remotion project is scaffolded, Subtitles.tsx composition renders TikTok-style captions, captions.ts maps Whisper transcript to TikTokPages, and render.ts handles the full render pipeline. This phase focuses on validating, extending (timestamp remapping, safe zone reading, pipeline reordering), and testing the existing implementation.

</domain>

<decisions>
## Implementation Decisions

### Timestamp Remapping (Silence Cuts)
- **D-01:** Timestamp remapping happens in render.ts — the Remotion renderer reads both transcript.json and silence-cuts.json, remaps all word timestamps using cumulative_shift before creating TikTokPages. This keeps the mapping logic centralized and avoids a separate remap pipeline step.
- **D-02:** Full timeline remap function — implement a `remapTimestamps(transcript, silenceCuts)` function that maps any original timestamp to the post-silence-removal timeline. More flexible than per-word subtraction: works for grouping timestamps and any future timestamp needs.
- **D-03:** Graceful handling when silence-cuts.json is missing — process with original timestamps (no remapping). This allows debugging with just whisper → remotion-renderer without running the silence-cutter, while normal pipeline flow always includes the cuts file.
- **D-04:** Remap step goes before `createTikTokStyleCaptions` — the existing captions.ts pipeline becomes: load transcript → remap timestamps if silence-cuts.json exists → create TikTokPages from remapped data → render. The `createTikTokStyleCaptions` function from @remotion/captions continues to handle page grouping unchanged.

### Render Pipeline Order
- **D-05:** Pipeline order changes to: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer. Remotion takes the 9:16 video from ffmpeg-finalizer as INPUT_PATH, not the raw silence-cropped video. This means subtitles are overlaid on the already-cropped 9:16 video, simplifying the Remotion composition to always work at 1080x1920.
- **D-06:** Remotion is the LAST video processing step in the chain (before API/batch). Its output is the final video with subtitles burned in. Future phases (intros/outros, zooms) will extend the Remotion composition, not add new containers after it.

### Input Artifacts
- **D-07:** The remotion-renderer reads three input artifacts: (1) 9:16 video from ffmpeg-finalizer via INPUT_PATH env var, (2) transcript.json via TRANSCRIPT_PATH env var, (3) silence-cuts.json via SILENCE_CUTS_PATH env var. Docker Compose gets a new SILENCE_CUTS_PATH env var addition.
- **D-08:** The remotion-renderer reads safe zone metadata from finalizer-info.json via FINALIZER_INFO_PATH env var. Subtitle positioning (bottomOffset, left/right margins) is derived from the safe zone values rather than hardcoded. This keeps Phase 4's finalizer-info.json as the single source of truth for safe zones.
- **D-09:** Output artifacts: output.mp4 (final subtitled 9:16 video), caption-pages.json (TikTok pages for inspection), remotion-info.json (render metadata), manifest.json (step contract). Output filenames follow D-13 naming convention.

### Subtitle Visual Style
- **D-10:** Refine the existing TikTok-style implementation in Subtitles.tsx — active word yellow (#FFFF00) with scale animation, inactive words white (#FFFFFF) with bold variation, spring fade-in per page, black outline. No redesign needed; the existing style already meets SUBT-01 and SUBT-02 requirements.
- **D-11:** Style parameters remain configurable via ACTIVE_COLOR, INACTIVE_COLOR, FONT_SIZE env vars (already in docker-compose.yml). Safe zone positioning moves from hardcoded bottomOffset=250 to dynamic reading from finalizer-info.json (D-08).

### Render Configuration
- **D-12:** Render config stays close to existing implementation: H.264 codec, 30fps, enableMultiProcessOnLinux flag, progress callback. Add the `--gl=angle-egl` Chrome flag per STACK.md recommendation to avoid memory leaks during long renders in Docker. This addresses the known "Remotion angle renderer memory leak for renders >3 minutes" blocker from STATE.md.
- **D-13:** Composition is always 1080x1920 (9:16) — since input is already 9:16 video from ffmpeg-finalizer, the Remotion composition doesn't need to handle cropping or aspect ratio conversion. Video dimensions are read from the input via ffprobe (already implemented in render.ts).

### Agent's Discretion
- Exact TypeScript implementation of `remapTimestamps()` function — researcher picks the algorithm
- Whether to add unit tests for the remap function separately from E2E render tests
- Specific spring animation timing parameters (damping, stiffness) in Subtitles.tsx — current values are reasonable
- Logging format and verbosity in render.ts (follow existing pattern)
- Whether to add a validation/warning when input video is not 9:16 (defensive check)
- Error handling for edge cases (empty transcript, zero caption pages, video longer than Remotion max)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions (pipeline architecture, 9:16 output, extensible step contracts)
- `.planning/REQUIREMENTS.md` — SUBT-01, SUBT-02, SUBT-03 requirements, traceability table
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, plan breakdown (05-01 through 05-06)
- `.planning/STATE.md` — Current project position and blockers (Remotion output mapping, angle renderer memory leak)

### Prior Phase Context (Foundation)
- `.planning/phases/01-pipeline-infrastructure/01-CONTEXT.md` — Volume strategy (D-01 to D-04), step contract (D-05 to D-07), artifact naming (D-10 to D-13)
- `.planning/phases/02-whisper-transcription/02-CONTEXT.md` — Transcript schema (D-07, D-09), word-level timestamps with no_speech_prob
- `.planning/phases/03-silence-detection-removal/03-CONTEXT.md` — Silence-cuts.json with cumulative_shift (D-07), 50ms padding (D-06)
- `.planning/phases/04-9-16-vertical-output/04-CONTEXT.md` — 9:16 center-crop output (D-01 to D-04), safe zones (D-05 to D-07), finalizer-info.json

### Technology Stack
- `.planning/research/STACK.md` — Remotion 4.0.457 setup, @remotion/captions TikTok-style API, Docker rendering with --gl=angle-egl, all @remotion packages must be same version

### Existing Codebase (CRITICAL — substantial implementation exists)
- `services/remotion-renderer/Dockerfile` — Node 22 bookworm-slim base, Chrome headless via `npx remotion browser ensure`
- `services/remotion-renderer/package.json` — Remotion 4.0.457 with @remotion/captions, @remotion/renderer, @remotion/bundler
- `services/remotion-renderer/src/render.ts` — Full render entry point: env var parsing, video probe, transcript loading, caption page creation, Remotion bundling, composition selection, renderMedia, manifest writing
- `services/remotion-renderer/src/captions.ts` — `transcriptToCaptionPages()` function mapping Whisper transcript → TikTokPage[]
- `services/remotion-renderer/src/Root.tsx` — Remotion root with SubtitledVideo composition, 1080x1920, calculateMetadata for dynamic duration
- `services/remotion-renderer/src/compositions/Subtitles.tsx` — CaptionPage and CaptionWord components with spring animations, TikTok-style word highlighting
- `services/remotion-renderer/remotion.config.ts` — JPEG image format, overwrite output
- `services/base-node/Dockerfile` — Node 22 bookworm-slim with FFmpeg 7.1.1 static + Chrome dependencies

### Prior Phase Reference Implementations
- `services/whisper/main.py` — Reference pattern for container entrypoint, env var parsing, manifest writing
- `services/whisper/src/schema.py` — TranscriptWord, TranscriptSegment, Transcript Pydantic models
- `services/ffmpeg-finalizer/src/schema.py` — FinalizerInfo and SafeZone Pydantic models
- `docker-compose.yml` — remotion-renderer service definition (needs updating for pipeline order change)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/remotion-renderer/`: **Substantial existing implementation.** The entire Remotion project is scaffolded — Dockerfile, package.json, render.ts, captions.ts, Root.tsx, Subtitles.tsx, remotion.config.ts. This phase extends and validates rather than builds from scratch.
- `services/remotion-renderer/src/captions.ts`: `transcriptToCaptionPages()` already maps Whisper words → Caption[] → TikTokPages via `createTikTokStyleCaptions`. Needs extension to accept remapped timestamps.
- `services/remotion-renderer/src/render.ts`: Full render pipeline with ffprobe video dimensions, manifest writing, progress callback. Needs: (1) silence-cuts.json loading, (2) timestamp remap step, (3) finalizer-info.json loading for safe zones, (4) new INPUT_PATH pointing to ffmpeg-finalizer output.
- `services/remotion-renderer/src/compositions/Subtitles.tsx`: CaptionPage and CaptionWord components with spring fade-in, TikTok-style active word highlighting. Works well — needs safe zone positioning from dynamic props instead of hardcoded bottomOffset.
- `services/remotion-renderer/src/Root.tsx`: RemotionRoot with SubtitledVideo composition, dynamic metadata calculation. Already at 1080x1920.
- `services/base-node/Dockerfile`: Node 22 bookworm-slim with FFmpeg 7.1.1 and all Chrome dependencies. Remotion-renderer inherits from this.
- `services/whisper/src/schema.py`: TranscriptWord model with word, start, end, confidence, no_speech_prob — the TypeScript interface in captions.ts maps to this.
- `services/ffmpeg-finalizer/src/schema.py`: SafeZone model with top, bottom, left, right values — the remotion-renderer needs to read this for subtitle positioning.

### Established Patterns
- Step contract: Read INPUT_PATH, write to OUTPUT_PATH, create manifest.json (D-05, D-07 from Phase 1)
- Container inherits from base image, runs main entrypoint script
- Error handling: exit codes 0/1/2+, structured manifest with status and error_message
- Config via environment variables (ACTIVE_COLOR, INACTIVE_COLOR, FONT_SIZE, and now SILENCE_CUTS_PATH, FINALIZER_INFO_PATH)
- Artifact path: `/data/pipeline/{job_id}/{step_name}/` with fixed predictable filenames (D-13)

### Integration Points
- docker-compose.yml: remotion-renderer service needs updating — INPUT_PATH changes from silence-cutter output to ffmpeg-finalizer output, depends_on changes from base-node to ffmpeg-finalizer, new SILENCE_CUTS_PATH and FINALIZER_INFO_PATH env vars
- INPUT_PATH: `/data/pipeline/{job_id}/ffmpeg-finalizer/output.mp4` (changed from silence-cutter)
- TRANSCRIPT_PATH: `/data/pipeline/{job_id}/whisper/transcript.json` (unchanged)
- SILENCE_CUTS_PATH: `/data/pipeline/{job_id}/silence-cutter/silence-cuts.json` (new)
- FINALIZER_INFO_PATH: `/data/pipeline/{job_id}/ffmpeg-finalizer/finalizer-info.json` (new)
- OUTPUT_PATH: `/data/pipeline/{job_id}/remotion-renderer/output.mp4` (unchanged)
- Phase 6 (intros/outros) extends the Remotion composition — it will add Sequence components before and after the subtitled video
- Phase 7 (zooms) extends the Remotion composition — it adds zoom animation overlays
- Phase 8 (SRT/VTT) reads transcript.json and silence-cuts.json for sidecar generation

### Key Gaps in Existing Code
- No timestamp remapping — captions.ts maps transcript timestamps directly without accounting for silence removal. Words after a silence cut will appear at wrong times.
- No safe zone reading — Subtitles.tsx uses hardcoded bottomOffset=250 instead of reading from finalizer-info.json.
- Docker Compose pipeline order is wrong — remotion-renderer comes before ffmpeg-finalizer, but now it needs to come after.
- No SILENCE_CUTS_PATH or FINALIZER_INFO_PATH env vars — render.ts and docker-compose.yml only handle INPUT_PATH, OUTPUT_PATH, TRANSCRIPT_PATH.
- No --gl=angle-egl flag in render.ts renderMedia call — needed for Docker rendering stability on long videos.

</code_context>

<specifics>
## Specific Ideas

- The timestamp remapping function should handle the edge case where silence was removed from the beginning of the video — the first word's timestamp may shift to near-zero if the opening silence is cut.
- The remapTimestamps function can binary-search through silence cuts (sorted by original_start) to find the applicable cumulative_shift for any given timestamp — this is efficient and works for both word timestamps and any future timestamp needs.
- Safe zone bottom (230px) is larger than top (100px) because TikTok/Instagram Reels place UI elements in the bottom portion. The dynamic reading from finalizer-info.json means these values can be adjusted in Phase 4 without re-deploying the Remotion container.
- When silence-cuts.json is missing (debugging scenario), the render should still work with original timestamps. The existing code in captions.ts already creates TikTokPages from the raw transcript — just skip the remap step.
- The docker-compose.yml needs its depends_on chain updated: remotion-renderer now depends_on ffmpeg-finalizer (not silence-cutter directly), matching the new pipeline order.
- The existing render.ts copies the input video to public/ for Remotion's staticFile() access. This pattern works fine and should be kept.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Remotion + Animated Subtitles*
*Context gathered: 2026-05-07*