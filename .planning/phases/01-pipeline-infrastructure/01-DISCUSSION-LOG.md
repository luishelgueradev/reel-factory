# Phase 1: Pipeline Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 1-Pipeline Infrastructure
**Areas discussed:** Volume strategy, Step contract design, Pipeline orchestration, Artifact naming

---

## Volume Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Single shared volume | One shared volume mount at /data/pipeline. All steps read/write in subdirs. Simple, every artifact is inspectable. | ✓ |
| Hybrid (shared + per-step) | Shared input/output volume + per-step volume for intermediates. Better isolation but more complex Compose. | |
| Per-step volumes | Each step gets its own named volume. Maximum isolation but complex wiring. | |

**User's choice:** Single shared volume
**Notes:** Risk of name collisions mitigated by job-scoped subdirs.

| Option | Description | Selected |
|--------|-------------|----------|
| Job-scoped subdirs | Each job gets /data/pipeline/{job_id}/. Steps read/write within their job dir. Concurrent support. | ✓ |
| Flat (defer concurrency) | No job isolation in v1. Simpler but blocks concurrent runs. | |

**User's choice:** Job-scoped subdirs
**Notes:** Smoke test can use a hardcoded job_id like 'test-001'.

| Option | Description | Selected |
|--------|-------------|----------|
| Env vars only | PIPELINE_JOB_ID for scoping, INPUT_PATH/OUTPUT_PATH per step contract. Clean, consistent with PIPE-02. | ✓ |
| Env vars + config JSON | Shared config JSON mounted into each container with step metadata. More flexible but more moving parts. | |

**User's choice:** Env vars only
**Notes:** Keep contract minimal per extensibility requirement.

| Option | Description | Selected |
|--------|-------------|----------|
| Read-write mount | Containers write directly to shared volume. Standard Docker pattern. Phase 10 handles cleanup. | ✓ |
| Write-through temp dir | Containers write to temp, init script moves to shared volume. More robust against partial writes but adds complexity. | |

**User's choice:** Read-write mount
**Notes:** Simplicity wins for v1. Phase 10 orchestrator will handle lifecycle.

---

## Step Contract Design

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: INPUT/OUTPUT only | INPUT_PATH and OUTPUT_PATH only. Containers know their own logic. Maximum step autonomy. | ✓ |
| Lean: add STEP + JOB_ID | Add PIPELINE_STEP and PIPELINE_JOB_ID env vars. Containers can self-identify. | |

**User's choice:** Minimal: INPUT_PATH/OUTPUT_PATH only
**Notes:** PIPELINE_JOB_ID is separate volume metadata, not part of step contract per se.

| Option | Description | Selected |
|--------|-------------|----------|
| Unix convention: 0/1/2+ | Standard Unix exit codes. 0=success, 1=fail, 2+=step-specific. Simple, idiomatic. | ✓ |
| Pipeline-wide exit code table | Predefined codes (10=bad_input, 20=processing_error, etc.). More discoverable but rigid. | |

**User's choice:** Unix convention: 0/1/2+
**Notes:** Phase 10 can define its own error taxonomy when needed.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-step manifest JSON | Each step writes manifest.json with step_name, input/output, duration, status. Self-contained, inspectable. | ✓ |
| No metadata (defer) | Just output files. File existence = success. Add manifests when orchestrator needs them. | |

**User's choice:** Per-step manifest JSON
**Notes:** Self-describing outputs without a central registry.

---

## Pipeline Orchestration

| Option | Description | Selected |
|--------|-------------|----------|
| Compose depends_on | Docker Compose depends_on with healthchecks. Sequential startup, built-in retry. Works for linear v1 pipeline. | ✓ |
| Orchestrator script | Shell/Node script with docker compose run per step. More control but custom code. | |
| Make-based | GNU Make targets for docker compose. Familiar but weak error handling/cleanup. | |

**User's choice:** Compose depends_on
**Notes:** v1 pipeline is linear, so depends_on is sufficient.

| Option | Description | Selected |
|--------|-------------|----------|
| Linear chain in Compose | Hardcoded service chain in docker-compose.yml. Each step depends_on the previous. | ✓ |
| Config-driven sequence | pipeline.yaml defines step list and order. More flexible but adds a config layer for v1. | |

**User's choice:** Linear chain in Compose
**Notes:** New steps are added by inserting a service in the chain.

---

## Artifact Naming

| Option | Description | Selected |
|--------|-------------|----------|
| Job dir / step dir pattern | /data/pipeline/{job_id}/{step_name}/output.ext. Human-readable, inspectable, no collisions. | ✓ |
| Flat with prefixed filenames | /data/pipeline/{job_id}/01-whisper-transcript.json. Flatter but filename carries step info. | |

**User's choice:** Job-scoped directory with step-name subdirs
**Notes:** Example: /data/pipeline/job-001/whisper/transcript.json

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed predictable names | transcript.json, cut-list.json, output.mp4. Each step knows what it produces and what's expected. | ✓ |
| Timestamped/UUID names | transcript-20260505.json. Avoids overwrites but requires discovery. | |

**User's choice:** Fixed predictable names
**Notes:** No guesswork, no filename parsing needed.

| Option | Description | Selected |
|--------|-------------|----------|
| Job root for input | /data/pipeline/{job_id}/input/video.mp4. Input is just a file drop, not a step output. | ✓ |
| Input as step 00 | /data/pipeline/{job_id}/00-input/video.mp4. Treats input as another step, symmetric but adds a layer. | |

**User's choice:** Job root for input
**Notes:** Input is conceptually a file drop, not a processing step.

| Filename | Description | Selected |
|----------|-------------|----------|
| transcript.json | Whisper transcription output | ✓ |
| silence-cuts.json | Silence detection cut list | ✓ |
| output.mp4 | Processed video output per step | ✓ |
| manifest.json | Per-step execution metadata | ✓ |

**User's choice:** All four standardized filenames selected

---

## Agent's Discretion

- FFmpeg base image specifics and version pinning across containers
- Docker Compose healthcheck configuration (interval, timeout, retries)
- Volume driver (local for v1)
- Log aggregation approach (stdout for v1)
- Container resource limits (defer to Phase 10)

## Deferred Ideas

None — discussion stayed within phase scope.