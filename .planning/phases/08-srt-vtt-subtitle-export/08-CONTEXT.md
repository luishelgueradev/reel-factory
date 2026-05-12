# Phase 8: SRT/VTT Subtitle Export - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

SRT and VTT sidecar subtitle files generated alongside the final processed video, with timestamps aligned to the post-silence-removal timeline. This phase delivers SRTE-01 from REQUIREMENTS.md: the pipeline exports SRT/VTT subtitle files alongside the burned-in video. The key technical challenge is timestamp remapping — the subtitles must reflect the silence-removed video timeline, not the original timestamps from Whisper.

The implementation creates a new `srt-exporter` Docker service (Node.js) following the pipeline step contract. It reads transcript.json and silence-cuts.json, applies the proven `remapTimestamps()` binary search logic from `captions.ts`, groups words into sentence-level cues using Whisper segments, and outputs both .srt and .vtt files.

</domain>

<decisions>
## Implementation Decisions

### Architecture
- **D-01:** SRT/VTT generation runs in a new `srt-exporter` Docker container following the INPUT_PATH/OUTPUT_PATH step contract (D-05/D-07 Phase 1). This keeps the pipeline architecture consistent — each processing step is an isolated container that reads input artifacts and writes output artifacts. The srt-exporter reads transcript.json and silence-cuts.json as inputs and produces .srt and .vtt files as outputs.
- **D-02:** The srt-exporter container uses Node.js (same runtime as remotion-renderer). This allows direct import of the existing `remapTimestamps()` and `remapWordTimestamps()` functions from `services/remotion-renderer/src/captions.ts` rather than reimplementing the binary search remap logic in Python. The TypeScript logic is already tested and proven to handle edge cases (words inside silence cuts, partial overlaps, double-remap detection).
- **D-03:** The srt-exporter imports `remapTimestamps()` and related types directly from remotion-renderer's `captions.ts` module (via file path import or copy, not a shared npm package). Creating a shared npm package for a single function is over-engineering for this phase. If more services need shared code later, extraction can happen then.

### Cue Segmentation
- **D-04:** SRT/VTT cues follow a sentence-per-cue strategy using Whisper's existing `transcript.segments[]` boundaries. Each Whisper segment is already a coherent sentence — this matches the natural reading cadence for subtitles and avoids reimplementing segmentation logic that Whisper already provides.
- **D-05:** Long segments (greater than ~10 words) are split at the nearest punctuation mark (comma, period, semicolon) to prevent unwieldy subtitle cues that fill the screen. If no punctuation exists within a long segment, it stays as one cue rather than splitting mid-phrase.
- **D-06:** Words that fall inside silence cut regions (already handled by `remapWordTimestamps()`) are dropped from SRT/VTT output — these are hallucinations or artifacts during silence that shouldn't appear in the subtitles.

### SRT/VTT Format
- **D-07:** SRT format follows the standard SubRip format: sequential cue numbers, `HH:MM:SS,mmm --> HH:MM:SS,mmm` timestamps, text content, blank line separators. UTF-8 encoding, BOM-free.
- **D-08:** VTT format follows the WebVTT specification: `WEBVTT` header, `HH:MM:SS.mmm --> HH:MM:SS.mmm` timestamps (dot decimal separator), text content, blank line separators. No positioning, color, or styling tags — minimal VTT.
- **D-09:** SRT and VTT contain identical text content. SRT serves platforms that only accept SRT (YouTube, some editors); VTT serves web players and platforms that prefer WebVTT. No content differences between formats — same cues, same timestamps, different format syntax.
- **D-10:** Both SRT and VTT timestamps are aligned to the post-silence-removal timeline using `remapTimestamps()`. This is explicitly what the silence-cuts.json `cumulative_shift` field was designed for (schema.py comment: "Phase 8 uses this: new_ts = original_ts - cumulative_shift").

### Output Artifacts
- **D-11:** The srt-exporter writes three output files to its OUTPUT_PATH directory: `output.srt`, `output.vtt`, and `manifest.json`. Output filenames follow the D-13 naming convention from Phase 1.
- **D-12:** SRT/VTT files are placed in the srt-exporter step output directory (`/data/pipeline/{job_id}/srt-exporter/`), not alongside the final video. The orchestrator (Phase 9/10) will collect artifacts from all steps.

### the agent's Discretion
- Exact max word threshold for long segment splitting (10 words is a starting point)
- Whether to use `areTimestampsAlreadyRemapped()` from captions.ts to handle the edge case where Whisper ran on the already-cut video
- Exact TypeScript module import strategy for sharing remapTimestamps() (file path import, tsconfig path alias, or copy)
- Error handling for missing/empty transcript or silence-cuts files
- Whether to validate SRT/VTT output format with a linter/checker
- Test fixture selection for E2E validation

### Folded Todos
No todos were folded into scope from cross-reference.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions (pipeline architecture, extensible step contracts)
- `.planning/REQUIREMENTS.md` — SRTE-01 requirement, traceability table
- `.planning/ROADMAP.md` — Phase 8 goal, success criteria, plan breakdown (08-01 through 08-03)
- `.planning/STATE.md` — Current project position

### Prior Phase Context (Foundation)
- `.planning/phases/01-pipeline-infrastructure/01-CONTEXT.md` — Volume strategy (D-01 to D-04), step contract (D-05 to D-07), artifact naming (D-10 to D-13)
- `.planning/phases/02-whisper-transcription/02-CONTEXT.md` — Transcript schema (D-07, D-09), word-level timestamps
- `.planning/phases/03-silence-detection-removal/03-CONTEXT.md` — Silence-cuts.json with cumulative_shift (D-07), 50ms padding (D-06)
- `.planning/phases/05-remotion-animated-subtitles/05-CONTEXT.md` — Timestamp remapping (D-01 to D-04), input artifacts (D-07 to D-09)

### Technology Stack
- `.planning/research/STACK.md` — Node.js, Docker, Express.js 5

### Existing Codebase (CRITICAL — remap logic to reuse)
- `services/remotion-renderer/src/captions.ts` — `remapTimestamps()`, `remapWordTimestamps()`, `areTimestampsAlreadyRemapped()`, WhisperTranscript/WhisperWord/SilenceCut/SilenceCutList types. This is the primary reuse target for SRT/VTT timestamp mapping.
- `services/remotion-renderer/src/render.ts` — Reference for how transcript.json and silence-cuts.json are loaded, parsed, and error-handled. The srt-exporter follows the same pattern.
- `services/whisper/src/schema.py` — TranscriptWord, TranscriptSegment, Transcript Pydantic models (source of truth for the JSON structure that srt-exporter must parse).
- `services/silence-cutter/src/schema.py` — SilenceCut, SilenceCutList Pydantic models with cumulative_shift field explicitly designed for Phase 8 SRT remapping.
- `services/remotion-renderer/src/pipeline-config.ts` — PipelineConfig schema (pattern reference for config-driven services).
- `docker-compose.yml` — Pipeline service definitions (pattern for adding new srt-exporter service).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/remotion-renderer/src/captions.ts`: The `remapTimestamps(originalTimeMs, silenceCuts)` function performs binary search through sorted silence cuts to map original timestamps to the post-silence-removal timeline. Handles three cases: before any cut (no shift), after a cut (full cumulative shift), and inside a cut (partial shift). Also `remapWordTimestamps()` which filters words inside silence regions and remaps start/end times. `areTimestampsAlreadyRemapped()` detects if timestamps are from a Whisper run on the already-cut video.
- `services/remotion-renderer/src/captions.ts`: TypeScript interfaces `WhisperTranscript`, `WhisperWord`, `SilenceCutList`, `SilenceCut` mirror the Python schemas and can be reused by srt-exporter.
- `services/remotion-renderer/src/render.ts`: Pattern for loading JSON input files (transcript.json, silence-cuts.json) with try/catch error handling and `process.env` path resolution. The srt-exporter follows this pattern for reading its inputs.
- `services/whisper/src/schema.py`: `TranscriptSegment` model with `id`, `start`, `end`, `text`, `words[]` — this is the source of sentence-level cue boundaries for SRT/VTT.
- `services/silence-cutter/src/schema.py`: `SilenceCut.cumulative_shift` field — "Phase 8 uses this: new_ts = original_ts - cumulative_shift" — explicitly designed for this phase.

### Established Patterns
- Step contract: Read INPUT_PATH, write to OUTPUT_PATH, create manifest.json (D-05, D-07 Phase 1)
- Container inherits from base image, runs main entrypoint script
- Error handling: exit codes 0/1/2+, structured manifest.json with status and error_message
- Input artifacts loaded via environment variables (TRANSCRIPT_PATH, SILENCE_CUTS_PATH)
- Output artifact path: `/data/pipeline/{job_id}/{step_name}/` with fixed predictable filenames (D-13)
- Docker service added to docker-compose.yml with depends_on chain

### Integration Points
- `docker-compose.yml`: New `srt-exporter` service with INPUT_PATH, TRANSCRIPT_PATH, SILENCE_CUTS_PATH env vars, depends_on silence-cutter (or remotion-renderer — must read transcript.json and silence-cuts.json)
- `services/remotion-renderer/src/captions.ts`: Import source for remapTimestamps(), remapWordTimestamps(), areTimestampsAlreadyRemapped(), and TypeScript types
- Pipeline order: srt-exporter runs after silence-cutter (needs silence-cuts.json) and can run in parallel with remotion-renderer (both consume the same transcript + silence-cuts data independently)
- Output files: `output.srt`, `output.vtt`, `manifest.json` in srt-exporter output directory

### Key Gaps in Existing Code
- No SRT/VTT format generation code exists anywhere in the codebase
- No srt-exporter container — needs Dockerfile, entrypoint, and docker-compose.yml service
- `remapTimestamps()` is exported from captions.ts but not yet installed as a shared dependency — import strategy needs to be decided during implementation
- Whisper segments[] contain sentence-level text but no SRT cue number or timestamp formatting logic exists

</code_context>

<specifics>
## Specific Ideas

- The `remapTimestamps()` function in captions.ts already handles all edge cases: binary search through sorted silence cuts, partial shifts for timestamps inside cuts, and graceful fallback when silence-cuts.json is missing. The srt-exporter calls the same function — no new remap logic needed.
- SRT cue timestamps use the format `HH:MM:SS,mmm` (comma as decimal separator). VTT uses `HH:MM:SS.mmm` (dot as decimal separator). The remap logic outputs milliseconds, so both formats are trivial conversions from `remapTimestamps()` output.
- Using Whisper `segments[]` for cue boundaries means each SRT/VTT cue gets its start time from `segment.start` and end time from `segment.end` — these are already in seconds relative to the original timeline, so they need remapping before formatting into SRT/VTT timestamps.
- The pipeline position of srt-exporter is flexible: it only needs transcript.json and silence-cuts.json, so it can run in parallel with remotion-renderer. It doesn't depend on video data at all — it's a pure text transformation step.
- Since the srt-exporter doesn't process video, it uses a lightweight Node.js base (no Chrome, no Remotion dependencies). It only needs the remap functions and TypeScript type definitions from captions.ts.
- The `areTimestampsAlreadyRemapped()` detection function from captions.ts should be reused to handle the edge case where Whisper ran on the already-cut video (timestamps already on the silence-removed timeline).

</specifics>

<deferred>
## Deferred Ideas

- **ASS/SSG subtitle format:** Advanced SubStation Alpha format with positioning and styling. Deferred — SRT and VTT cover platform upload needs. ASS can be added in a future phase if needed.
- **Configurable subtitle styling in SRT/VTT:** VTT supports inline styling (position, color, font). Deferred — platforms strip custom styling, so minimal VTT was chosen. If needed later, the VTT generator can be extended.
- **Per-word highlighting in VTT:** VTT supports `<b>` and `<i>` tags and karaoke-style timing. Deferred — the burned-in Remotion subtitles already provide word-by-word highlighting. SRT/VTT sidecars serve a different purpose (platform upload for accessibility/metadata).
- **Segmented VTT for HLS:** WebVTT supports chapter-based subtitles for HTTP Live Streaming. Deferred — not needed for v1 batch processing.

</deferred>

---

*Phase: 8-SRT/VTT Subtitle Export*
*Context gathered: 2026-05-12*