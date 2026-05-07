# Phase 4: 9:16 Vertical Output - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

FFmpeg finalizer that crops and encodes vertical social video — takes a silence-removed MP4 from the silence-cutter step, applies center-crop reframing to 1080x1920 (9:16), encodes H.264 with audio normalization, and produces a 9:16 MP4 with safe zone metadata. This phase delivers a working ffmpeg-finalizer container that follows the step contract (INPUT_PATH/OUTPUT_PATH/manifest.json) and produces finalizer-info.json with crop geometry and safe zone data for Phase 5 subtitle positioning.

**Note:** Substantial code already exists in `services/ffmpeg-finalizer/`. This phase focuses on validating, refining, and testing the existing implementation to meet all success criteria, rather than building from scratch.

</domain>

<decisions>
## Implementation Decisions

### Crop Strategy
- **D-01:** Center-crop only for v1 — no face detection or speech-aware reframing. Smart reframing deferred to future phase (SMRT-01/SMRT-02 in v2 REQUIREMENTS.md).
- **D-02:** Pure center crop anchor — always use geometric center of the frame, no shift based on speech activity data.
- **D-03:** Conditional crop path — skip the crop filter when input is already 9:16 or taller aspect ratio, just scale and re-encode. When ratio is wider than 9:16, apply the full scale+crop filter chain.
- **D-04:** Always output 1080x1920 regardless of input resolution. Uniform output size for all downstream steps (subtitle rendering, social platform specs). Vertical inputs at other resolutions (e.g. 720x1280) are scaled up to 1080x1920.

### Safe Zone Bounds
- **D-05:** Safe zone bounds hardcoded as constants in code, written into finalizer-info.json as metadata for Phase 5 to consume. Not configurable via environment variables.
- **D-06:** Safe zone values: top=100px, bottom=230px, left=54px, right=54px at 1080x1920 — appropriate for TikTok/Instagram Reels overlay avoidance zones.
- **D-07:** Safe zone data is metadata only — no runtime validation that output respects safe zones. Phase 5 Remotion subtitle positioning reads the JSON values to position subtitles within the safe area.

### Encoding Parameters
- **D-08:** H.264 CRF 20 for quality/filesize balance. Good visual quality for 1080x1920 talking-head social content without excessive file sizes.
- **D-09:** Encoding preset `medium` — good balance of encoding speed vs compression efficiency for pipeline processing. ~2x realtime on modern CPUs.
- **D-10:** Loudnorm audio normalization kept (I=-14 LUFS, TP=-1, LRA=11). Consistent loudness across all outputs, best practice for social content where inconsistent volume is a common user complaint.
- **D-11:** Force 30fps output with `-r 30`. Consistent frame rate for all downstream steps (subtitle timing, Remotion rendering). Inputs at 24/60fps are converted, 30fps inputs pass through unchanged.

### Agent's Discretion
- Exact FFmpeg filter chain ordering for the conditional crop path (scale+crop vs scale-only)
- Whether to use a two-pass loudnorm (requires initial FFmpeg pass to measure) or single-pass approximation
- Specific test fixture video creation approach (synthetic via FFmpeg or shared existing fixture)
- Logging verbosity and format (follow whisper/main.py pattern)
- Error handling for edge cases (video with no audio track, corrupted input)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions (pipeline architecture, 9:16 output format, extensible step contracts)
- `.planning/REQUIREMENTS.md` — VERT-01 through VERT-03 requirements, traceability table
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, plan breakdown (04-01 through 04-05)
- `.planning/STATE.md` — Current project position and blockers

### Prior Phase Context (Foundation)
- `.planning/phases/01-pipeline-infrastructure/01-CONTEXT.md` — Volume strategy (D-01 to D-04), step contract (D-05 to D-07), artifact naming (D-10 to D-13), orchestration (D-08 to D-09)
- `.planning/phases/03-silence-detection-removal/03-CONTEXT.md` — Silence cutter output (silence-cuts.json, output.mp4), cross-reference approach, cumulative shift for timestamp remapping

### Technology Stack
- `.planning/research/STACK.md` — FFmpeg 7.x static build, H.264 encoding for social media, audio normalization patterns

### Existing Codebase (CRITICAL — substantial implementation exists)
- `services/ffmpeg-finalizer/main.py` — Full entry point with env var parsing, manifest writing, pipeline steps (probe → crop/encode → write info)
- `services/ffmpeg-finalizer/src/config.py` — All encoding constants (CRF, preset, profile, audio bitrate, loudnorm params, safe zone values)
- `services/ffmpeg-finalizer/src/crop.py` — probe_video(), compute_crop(), apply_finalizer() with scale+crop filter chain
- `services/ffmpeg-finalizer/src/schema.py` — FinalizerInfo and SafeZone Pydantic models
- `services/ffmpeg-finalizer/Dockerfile` — Base-python image, pydantic dependency
- `docker-compose.yml` — FFmpeg finalizer service definition with INPUT_PATH, OUTPUT_PATH, VERTICAL_WIDTH/HEIGHT, CROP_STRATEGY env vars

### Prior Phase Reference Implementations
- `services/whisper/main.py` — Reference pattern for container entrypoint, env var parsing, manifest writing
- `services/whisper/src/config.py` — Config constants pattern with decision ID traceability
- `services/whisper/src/schema.py` — Pydantic model pattern for step output
- `services/silence-cutter/main.py` — Another reference implementation following same patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/base-python/Dockerfile`: Already has Python 3.12 + FFmpeg 7.1.1 — finalizer inherits from this. No need to rebuild FFmpeg installation.
- `services/ffmpeg-finalizer/`: **Substantial existing implementation.** main.py, src/crop.py, src/schema.py, src/config.py, Dockerfile all exist. This phase needs to validate, refine, and add tests rather than build from scratch.
- `services/ffmpeg-finalizer/src/crop.py`: `compute_crop()` function handles aspect ratio math — input wider than target crops sides, input taller crops top/bottom. `probe_video()` uses ffprobe for metadata. `apply_finalizer()` builds the FFmpeg filter chain.
- `services/ffmpeg-finalizer/src/schema.py`: `FinalizerInfo` and `SafeZone` Pydantic models for output metadata.

### Established Patterns
- Step contract: Read INPUT_PATH, write to OUTPUT_PATH, create manifest.json in output directory (D-05, D-07 from Phase 1)
- Container inherits from base-python image, runs main.py as entrypoint
- Error handling: exit codes 0/1/2+, structured manifest with status and error_message
- Config constants in src/config.py with decision ID traceability (D-XX comments)
- Artifact path: `/data/pipeline/{job_id}/{step_name}/` with fixed predictable filenames (D-13)
- Pydantic models for output schema (following whisper/schema.py pattern)

### Integration Points
- docker-compose.yml: FFmpeg finalizer service already defined. `FINALIZER_INPUT_PATH` defaults to silence-cutter output. Depends on base-python image.
- INPUT_PATH: The silence-cutter output MP4 (`/data/pipeline/{job_id}/silence-cutter/output.mp4`)
- OUTPUT_PATH: `/data/pipeline/{job_id}/ffmpeg-finalizer/output.mp4`
- Phase 5 reads: output.mp4 (9:16 video) + finalizer-info.json (safe zone metadata for subtitle positioning)
- Phase 5 also reads: transcript.json from whisper step (needs access via known path convention)
- The existing filter chain in crop.py uses `scale={target_width}:{target_height}:force_original_aspect_ratio=increase,crop={target_width}:{target_height},setsar=1` — this needs updating for the conditional crop path (D-03)

### Key Gap in Existing Code
- The current implementation always applies the full scale+crop filter chain regardless of input aspect ratio. D-03 requires skipping the crop when input is already 9:16 or taller. This logic needs to be added.
- The tests/ directory is empty — no unit or integration tests exist yet.

</code_context>

<specifics>
## Specific Ideas

- The conditional crop path (D-03) means the code should check the input aspect ratio before building the filter chain. If input is already 9:16, just scale to 1080x1920 with no crop. If input is taller than 9:16, scale width to 1080 and height proportionally (then pad or crop). If wider, apply current scale+crop logic.
- Safe zone bottom is 230px (larger than top: 100px) because TikTok/Instagram Reels place UI elements (username, description, sound info) in the bottom portion of the screen, requiring more clearance for subtitle positioning.
- The 50px safe zones on left/right (54px at 1080px width = ~5%) account for side buttons and progress bars on mobile platforms.
- Loudnorm I=-14 LUFS aligns with broadcast loudness standards (EBU R128) and is commonly used for social media content consistency.
- The `+faststart` flag and `-map_metadata -1` are already in the existing code — good for social media (faststart enables progressive download, metadata stripping reduces file size).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-9:16 Vertical Output*
*Context gathered: 2026-05-07*