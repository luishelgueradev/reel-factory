# Phase 3: Silence Detection & Removal - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Cross-referenced silence detection and hard-cut removal preserving A/V sync — the step that takes an MP4 + transcript.json, detects silent sections by cross-referencing FFmpeg silencedetect with Whisper no_speech data, removes them with hard cuts, and produces a silence-removed MP4 with an inspectable cut list. This phase delivers a silence-cutter container that reads the original MP4 from INPUT_PATH and the Whisper transcript.json, runs silencedetect, cross-references both sources to confirm real silence, cuts with hard edges (plus small padding), re-assembles the video preserving A/V sync, and writes output.mp4 and silence-cuts.json to OUTPUT_PATH.

</domain>

<decisions>
## Implementation Decisions

### Cross-Reference Strategy
- **D-01:** Intersection approach — a silence segment is confirmed as real only when BOTH FFmpeg silencedetect AND Whisper no_speech_prob agree. This avoids false positives from background noise that FFmpeg might flag when Whisper recognizes speech, and vice versa.
- **D-02:** FFmpeg drives the cross-reference. FFmpeg silencedetect runs first to find candidate silence segments, then Whisper no_speech_prob confirms each candidate. This is simpler than the reverse: FFmpeg produces clear segment boundaries while Whisper provides per-word probabilities.
- **D-03:** Whisper confirmation uses an ANY-word threshold. If ANY word overlapping a candidate FFmpeg silence segment has no_speech_prob > 0.6 (the NO_SPEECH_THRESHOLD from Phase 2), the silence is confirmed. This is safer than requiring majority agreement because even one high-probability word in a segment indicates Whisper detected silence there.

### Minimum Silence Duration
- **D-04:** Default minimum silence duration is 0.5 seconds — removes noticeable silence while keeping brief breath pauses. Good balance for social media talking-head content where pacing should stay punchy but not robotic.
- **D-05:** The minimum silence duration is configurable via the SILENCE_MIN_DURATION environment variable (default 0.5). This allows tuning for different content types without redeploying the container.

### Cut Boundary Padding
- **D-06:** 50ms padding before and after speech at cut boundaries. This prevents clipping word starts/ends due to timestamp imprecision while still being a hard cut (no transition effects). The 50ms offset is a fixed constant — not configurable via env var.

### Cut List Artifact
- **D-07:** silence-cuts.json uses a detailed schema with cumulative time shift. Each entry includes: original_start, original_end, new_start, new_end, duration, source (ffmpeg/whisper/both), and cumulative_shift (total time removed up to that cut point). The cumulative_shift makes timestamp remapping trivial for Phase 8 SRT generation — just add cumulative_shift to any original timestamp to get the post-cut timestamp.
- **D-08:** Output files per D-13 naming convention: `output.mp4` (silence-removed video) and `silence-cuts.json` (cut list artifact), plus `manifest.json`.

### Agent's Discretion
- FFmpeg silencedetect filter parameters (noise tolerance/dB threshold) — researcher picks appropriate values
- Exact silence-cuts.json Pydantic schema structure and field types
- Container entrypoint script structure and error handling (follow whisper/main.py pattern)
- Whether to re-extract audio inside this container or read from a shared audio path
- FFmpeg video re-assembly filter chain specifics (select/asetpts/setpts/concat)
- Test video sample selection for validation
- Logging verbosity and format

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions (pipeline architecture, hard cuts, no transitions)
- `.planning/REQUIREMENTS.md` — SILC-01 through SILC-04 requirements, traceability table
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, plan breakdown (03-01 through 03-05)
- `.planning/STATE.md` — Current project position and blockers

### Prior Phase Context (Foundation)
- `.planning/phases/01-pipeline-infrastructure/01-CONTEXT.md` — Volume strategy (D-01 to D-04), step contract (D-05 to D-07), artifact naming (D-10 to D-13), orchestration (D-08 to D-09)
- `.planning/phases/02-whisper-transcription/02-CONTEXT.md` — Transcript schema (D-07, D-09), NO_SPEECH_THRESHOLD=0.6, audio not preserved as artifact (D-08)

### Technology Stack
- `.planning/research/STACK.md` — FFmpeg silencedetect filter, reset_timestamps + setpts=PTS-STARTPTS for sync, version compatibility

### Existing Codebase
- `docker-compose.yml` — Silence cutter service placeholder (Step 2 comment), x-pipeline-common extension, volume/network config
- `services/base-python/Dockerfile` — Base image: python:3.12-slim + FFmpeg 7.1.1 static build
- `services/whisper/main.py` — Reference implementation of step contract: env var parsing, manifest writing, error handling, intermediate cleanup
- `services/whisper/src/config.py` — Config constants pattern (STEP_NAME, thresholds, model settings)
- `services/whisper/src/schema.py` — Pydantic model pattern for step output (TranscriptWord, TranscriptSegment, Transcript)
- `shared/schemas/manifest.ts` — PipelineManifest TypeScript interface
- `shared/schemas/step-contract.ts` — StepContract interface and env var parsing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/base-python/Dockerfile`: Already has Python 3.12 + FFmpeg 7.1.1 — silence cutter inherits from this. No need to rebuild FFmpeg installation.
- `services/whisper/main.py`: Full reference pattern for container entrypoint — env var parsing, error handling with exit codes, manifest writing, step logging. The silence cutter should follow the same structure exactly.
- `services/whisper/src/config.py`: Config constants pattern. Silence cutter should define SILENCE_MIN_DURATION, NO_SPEECH_THRESHOLD, SILENCE_CUT_PADDING, STEP_NAME in the same style.
- `services/whisper/src/schema.py`: Pydantic model pattern. Silence-cuts.json should use the same approach (Pydantic models, model_dump_json for serialization).
- `shared/schemas/manifest.ts`: Manifest schema — silence cutter writes manifest.json matching this interface.

### Established Patterns
- Step contract: Read INPUT_PATH, write to OUTPUT_PATH, create manifest.json in output directory (D-05, D-07)
- Container inherits from base-python image, runs main.py as entrypoint (from Dockerfile CMD)
- Error handling: exit codes 0/1/2+, structured manifest with status and error_message
- Config constants in src/config.py with decision ID traceability (D-XX comments)
- Artifact path: `/data/pipeline/{job_id}/{step_name}/` with fixed predictable filenames (D-13)

### Integration Points
- docker-compose.yml: Silence cutter service needs to replace the "Step 2: Silence Cutter" comment. depends_on: whisper (healthcheck confirms transcript.json exists). INPUT_PATH points to original MP4, needs additional access to transcript.json.
- INPUT_PATH for silence cutter: the original MP4 (re-extracts audio for silencedetect). Also needs to read `/data/pipeline/{job_id}/whisper/transcript.json` — this may require an additional env var or a known path convention.
- OUTPUT_PATH: `/data/pipeline/{job_id}/silence-cutter/output.mp4` and `silence-cuts.json`
- Phase 4 reads: output.mp4 from silence cutter for 9:16 vertical rendering
- Phase 5 reads: output.mp4 + transcript.json + silence-cuts.json for timestamp remapping during subtitle alignment
- Phase 8 reads: silence-cuts.json cumulative_shift for SRT timestamp remapping

</code_context>

<specifics>
## Specific Ideas

- Intersection approach avoids the common pitfall of FFmpeg false-positives from low-volume background music or room tone — Whisper confirms there's actually no speech
- The 50ms padding is a practical safeguard against Whisper/FFmpeg timestamp imprecision (Whisper timestamps can be off by 20-50ms depending on model and language)
- Cumulative shift in silence-cuts.json is a deliberate design for Phase 8: SRT remapping becomes `new_time = original_time - cumulative_shift_at_point` rather than recomputing from scratch
- FFmpeg-first cross-referencing is natural because silencedetect produces clear segment boundaries (start/end times), while Whisper provides scattered per-word probabilities that need merging into segments

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Silence Detection & Removal*
*Context gathered: 2026-05-06*