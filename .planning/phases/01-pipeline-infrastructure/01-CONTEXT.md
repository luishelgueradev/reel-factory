# Phase 1: Pipeline Infrastructure - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Docker Compose foundation with shared volumes and step contracts — containers communicate via a contract-based pipeline. This phase establishes the infrastructure skeleton: how containers share data, how the step contract works, how the pipeline sequences, and how artifacts are organized. No processing logic yet — that comes in Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Volume Strategy
- **D-01:** Single shared Docker named volume for all pipeline data (e.g., `pipeline-data`). All containers mount the same volume at `/data/pipeline`.
- **D-02:** Job-scoped subdirectories inside the shared volume. Path pattern: `/data/pipeline/{job_id}/`. Each job is isolated within its own directory, enabling concurrent jobs (Phase 10) without collisions.
- **D-03:** Containers receive metadata via environment variables only — `PIPELINE_JOB_ID`, `INPUT_PATH`, `OUTPUT_PATH`. No config JSON files mounted into containers.
- **D-04:** Direct read-write mount pattern. Containers write directly to shared volume. Input dir is mounted read-only, output dir is mounted read-write. No staging/temp area.

### Step Contract Design
- **D-05:** Minimal env var contract: `INPUT_PATH` and `OUTPUT_PATH` only. Each container reads from `INPUT_PATH`, writes to `OUTPUT_PATH`. Pipeline step identity is implicit in the Compose service name and mount paths.
- **D-06:** Unix convention exit codes: `0` = success, `1` = generic error, `2+` = step-specific error codes defined per container. No pipeline-wide error taxonomy in v1.
- **D-07:** Per-step `manifest.json` artifact. Each step writes a manifest next to its output containing: `step_name`, `input_file`, `output_file(s)`, `duration_seconds`, `timestamp`, `status`. Self-contained, inspectable, no central registry needed.

### Pipeline Orchestration
- **D-08:** Docker Compose `depends_on` with healthchecks for step sequencing. Each step container declares `depends_on` the previous step with a healthcheck that confirms its output exists.
- **D-09:** Linear chain defined in `docker-compose.yml`. Steps are ordered services: step-1 → step-2 → step-3. New steps are added by inserting a service in the chain. No config-driven reordering in v1.

### Artifact Naming
- **D-10:** Job-scoped directory pattern with step-name subdirectories. Path structure: `/data/pipeline/{job_id}/{step_name}/`. Example: `/data/pipeline/job-001/whisper/transcript.json`.
- **D-11:** Input MP4 lives in the job root: `/data/pipeline/{job_id}/input/video.mp4`. Not treated as a step output — it's the source file that starts the pipeline.
- **D-12:** Fixed predictable filenames. Each step produces known output files: `transcript.json`, `silence-cuts.json`, `output.mp4`, `manifest.json`. No timestamps or UUIDs in filenames.
- **D-13:** Standardized output filenames across all steps: `transcript.json` (Whisper), `silence-cuts.json` (silence detection), `output.mp4` (video output), `manifest.json` (execution metadata).

### Agent's Discretion
- FFmpeg base image specifics (which distribution, how to pin version across Python and Node containers)
- Docker Compose healthcheck configuration details (interval, timeout, retries)
- Volume driver selection (local driver for v1)
- Log aggregation approach (stdout for v1, structured logging later)
- Container resource limits (defer to Phase 10 when concurrency matters)

### Folded Todos
No todos were folded into scope from cross-reference.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Definition
- `.planning/PROJECT.md` — Core value, constraints, key decisions, architecture context
- `.planning/REQUIREMENTS.md` — v1 requirements PIPE-01 through PIPE-05, traceability table
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, plan breakdown (01-01 through 01-05)
- `.planning/STATE.md` — Current project position and blockers

### Technology Stack
- `.planning/research/STACK.md` — Full technology stack decisions including Docker, Faster Whisper, Remotion, FastAPI, Express.js, BullMQ, Redis. Architecture mapping, version compatibility, model selection guide.

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — greenfield project. Only planning artifacts exist in `.planning/`.

### Established Patterns
- No established code patterns yet. Phase 1 establishes the foundational patterns that all subsequent phases will follow.

### Integration Points
- Shared Docker volume mount point: `/data/pipeline`
- Environment variable contract: `INPUT_PATH`, `OUTPUT_PATH`, `PIPELINE_JOB_ID`
- Step output convention: `{step_name}/manifest.json` in every step's output directory

</code_context>

<specifics>
## Specific Ideas

- Job-scoped subdirectory pattern inspired by CI/CD artifact isolation — each job gets its own namespace within the shared volume
- Per-step manifest.json is inspired by build artifact metadata patterns — self-describing outputs without a central registry
- Linear chain in docker-compose.yml is the simplest orchestration pattern; Phase 10 introduces the programmatic orchestrator for async/batch processing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Pipeline Infrastructure*
*Context gathered: 2026-05-05*