# Phase 2: Whisper Transcription - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Audio extraction from MP4 and Spanish transcription with word-level timestamps — the data foundation for all downstream steps. This phase delivers a Whisper container that reads an MP4 from INPUT_PATH, extracts audio, transcribes with word-level timestamps (including no_speech probabilities), applies a hallucination filter, and writes transcript.json to OUTPUT_PATH. The transcript.json is the single artifact that feeds Phase 3 (silence detection) and Phase 5 (animated subtitles).

</domain>

<decisions>
## Implementation Decisions

### Whisper Engine
- **D-01:** whisperx is the primary transcription engine, using forced alignment for word-level timestamps. If whisperx proves unreliable or alignment quality is worse than faster-whisper word timestamps, fallback to faster-whisper with its built-in word_timestamps=True.
- **D-02:** Whisper model size is `medium` — best balance of accuracy (~5GB RAM) and speed for Spanish language. Not GPU-exclusive; works on CPU with int8 quantization if needed (though GPU is required per D-04).

### GPU & Runtime
- **D-03:** GPU-required setup. The Whisper container requires CUDA/NVIDIA GPU. Docker Compose includes `deploy.resources.reservations.devices` for GPU passthrough via NVIDIA Container Toolkit. No CPU fallback path in v1 — if no GPU is available, the container will fail with a clear error message.
- **D-04:** Auto-detection of GPU at application level is NOT needed since GPU is required (D-03). The container assumes CUDA is available and fails fast if not.

### Audio Extraction
- **D-05:** Audio is extracted as 16kHz mono WAV before transcription. FFmpeg resamples explicitly rather than relying on Whisper's internal resampler. This avoids quality loss and gives deterministic audio properties.
- **D-06:** Audio extraction happens inside the Whisper container (not a separate step). The container uses the FFmpeg binary from the base-python image to extract audio as a pre-processing step before running Whisper.

### Output Schema
- **D-07:** transcript.json uses a word list + segments structure: flat list of `{word, start, end, confidence, no_speech_prob}` objects grouped under segment-level entries. This is the simplest format that directly maps to Remotion @remotion/captions TikTokPage tokens (Phase 5) while providing no_speech_prob for Phase 3 silence cross-referencing.
- **D-08:** Single output file: `transcript.json`. Extracted audio is not preserved as a separate artifact — Phase 3 will re-extract audio from the original MP4 using FFmpeg silencedetect when needed. This follows the D-13 convention for fixed predictable filenames.
- **D-09:** no_speech probability is included per-word in transcript.json (not as a separate silence segments array). Phase 3 will cross-reference these probabilities with FFmpeg silencedetect output.

### Spanish Language
- **D-10:** Language is explicitly set to `language="es"` in the Whisper/whisperx call. No language detection step — Spanish is assumed per TRAN-04. Non-.en model is used (medium is multilingual).

### Hallucination Filter
- **D-11:** hallucination_silence_threshold is applied per REQUIREMENTS TRAN-03. Implementation uses whisperx/faster-whisper's built-in VAD filter or a post-processing step that removes segments with high no_speech probability and no word-level content. Exact mechanism deferred to research/planning phase.

### Agent's Discretion
- Exact Python package versions (whisperx, faster-whisper, torch, ctranslate2) — researcher picks compatible versions
- Container entrypoint script structure and error handling patterns
- Specific hallucination filter implementation details
- Test audio sample selection for validation
- Logging verbosity and format

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions (pipeline architecture, tech stack, 9:16 output)
- `.planning/REQUIREMENTS.md` — TRAN-01 through TRAN-04 requirements, traceability table
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, plan breakdown (02-01 through 02-05)
- `.planning/STATE.md` — Current project position and blockers (Whisper output → Remotion mapping, GPU contention)

### Phase 1 Context (Foundation)
- `.planning/phases/01-pipeline-infrastructure/01-CONTEXT.md` — Volume strategy (D-01 to D-04), step contract (D-05 to D-07), artifact naming (D-10 to D-13), orchestration (D-08 to D-09)

### Technology Stack
- `.planning/research/STACK.md` — Faster Whisper configuration (device, compute_type, model selection), whisperx evaluation notes, Docker setup patterns, version compatibility table

### Existing Codebase
- `docker-compose.yml` — Whisper service template (commented out), x-pipeline-common extension, volume/network config
- `services/base-python/Dockerfile` — Base image: python:3.12-slim + FFmpeg 7.1.1 static build
- `services/smoke-test/main.py` — Reference implementation of step contract: env var parsing, manifest writing, intermediate artifacts
- `shared/schemas/manifest.ts` — PipelineManifest TypeScript interface (step_name, input_file, output_files, duration_seconds, timestamp, status, exit_code)
- `shared/schemas/step-contract.ts` — StepContract interface and env var parsing (INPUT_PATH, OUTPUT_PATH, PIPELINE_JOB_ID)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/base-python/Dockerfile`: Already has Python 3.12 + FFmpeg 7.1.1 — Whisper container inherits from this. No need to rebuild FFmpeg installation.
- `services/smoke-test/main.py`: Reference pattern for manifest writing, env var parsing, and error handling. Whisper container should follow the same structure.
- `shared/schemas/manifest.ts`: TypeScript manifest interface — the Whisper container writes JSON matching this schema (though in Python, not TypeScript).
- `docker-compose.yml`: Whisper service is already sketched (commented out) with INPUT_PATH pointing to input/video.mp4 and OUTPUT_PATH pointing to whisper/transcript.json.

### Established Patterns
- Step contract: Read INPUT_PATH, write to OUTPUT_PATH, create manifest.json in output directory (D-05, D-07)
- Container inherits from base-python image, runs main.py as entrypoint (from Dockerfile CMD)
- Error handling: exit codes 0/1/2+, structured manifest with status and error_message
- Artifact path: `/data/pipeline/{job_id}/whisper/` with `transcript.json` and `manifest.json`

### Integration Points
- docker-compose.yml: Whisper service needs to be uncommented and configured with GPU device reservation, depends_on base-python, healthcheck for manifest.json
- Phase 3 reads: transcript.json no_speech_prob field for silence cross-referencing
- Phase 5 reads: transcript.json word-level timestamps for Remotion subtitle rendering
- Phase 3 reads: Original MP4 for FFmpeg silencedetect (re-extracts audio independently)

</code_context>

<specifics>
## Specific Ideas

- whisperx forced alignment provides better word-level timestamps than raw faster-whisper word_timestamps — this is the primary reason for choosing whisperx first
- The 16kHz WAV extraction is a deliberate pre-processing step to avoid Whisper's internal resampling which can introduce artifacts
- The transcript.json schema favors downstream simplicity: flat word list with no_speech_prob per word, so Phase 3 can filter on probability threshold and Phase 5 can map directly to Remotion captions
- GPU requirement means Docker must have NVIDIA Container Toolkit installed — this is a deployment prerequisite

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Whisper Transcription*
*Context gathered: 2026-05-05*