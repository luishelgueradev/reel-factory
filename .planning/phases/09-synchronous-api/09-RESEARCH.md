# Phase 9 Research: Synchronous API

**Phase:** 9 - Synchronous API
**Researched:** 2026-05-12
**Stack:** Express.js 5, Node.js 22, Docker, Zod, Multer

---

## Standard Stack

| Technology | Version | Purpose | Justification |
|------------|---------|---------|----------------|
| **Express.js** | 5.2.1 | REST API framework | Per STACK.md — native async/await, middleware pipeline, file upload via Multer. v5 is stable and production-ready. |
| **Multer** | ^2.0 | Multipart file upload | Official Express middleware for handling multipart/form-data. Required for POST /process MP4 upload. |
| **Zod** | ^4.4 | Request/response validation | Per STACK.md — validate upload file presence, type check. Type-safe schemas that serve as both runtime validators and TypeScript types. |
| **uuid** | ^14.0 | Job ID generation | Per STACK.md — unique identifiers for each processing request. |
| **dockerode** | ^4.0 | Docker API from Node.js | Programmatic Docker container management from the API server. Create, start, wait, stop containers with the same env vars and volumes as process.sh. |

## Architecture Patterns

### Pattern 1: Thin API Orchestration Layer
The API server is NOT a processing service. It is a thin orchestration layer that:
1. Accepts file uploads via POST /process
2. Creates a job directory and copies the uploaded file to the pipeline volume
3. Runs each pipeline step via Docker API (dockerode)
4. Reads intermediate manifests to check for success/failure
5. Returns processed video URL and artifact URLs in the response

This preserves the existing pipeline architecture — each container (whisper, silence-cutter, etc.) remains unchanged. The API simply calls them programmatically instead of via bash.

### Pattern 2: Step-by-Step Sequential Orchestration
Following the exact order in process.sh:
1. whisper → 2. silence-cutter → 3. ffmpeg-finalizer → 4. remotion-renderer → 5. srt-exporter

Each step:
- Creates a container with the appropriate image and env vars
- Starts the container
- Waits for completion (container.wait())
- Reads manifest.json from the output directory
- If manifest.status === "error", stops pipeline and returns error
- If manifest.status === "success", proceeds to next step

### Pattern 3: Shared Volume for Artifact Serving
The API container mounts the same `./pipeline:/data/pipeline` volume and serves artifacts via Express static middleware:
- `GET /artifacts/:jobId/:stepName/:filename` → serves from `/data/pipeline/{jobId}/{stepName}/{filename}`
- The processed video URL: `GET /artifacts/:jobId/remotion-renderer/output.mp4`

## Don't Hand-Roll

| What | Use Instead |
|------|-------------|
| Manual multipart parsing | Multer (production-tested, handles streaming) |
| Custom job ID generation | uuid v4 (cryptographically random, no collisions) |
| HTTP timeout management | Express 5 built-in timeout + AbortController for Docker operations |
| Custom Docker CLI wrapper | dockerode (handles streaming logs, container lifecycle, env vars, volume mounts) |
| Response schema validation | Zod (type-safe, runtime validated, serves as TypeScript types) |

## Common Pitfalls

1. **Multipart upload memory exhaustion**: Multer stores files in memory by default. For video files (10-500MB), MUST configure disk storage (`dest: '/data/pipeline/tmp'`) to avoid OOM crashes. Set file size limits via `limits: { fileSize: 500 * 1024 * 1024 }`.

2. **Docker socket access from container**: The API container needs the Docker socket mounted (`/var/run/docker.sock`) to control sibling containers. This is standard Docker-in-Docker pattern. The API container must NOT run as PID 1 orchestrator of docker-compose — it uses the Docker API directly.

3. **Long-running requests blocking Express**: Video processing can take 2-10 minutes. Express 5 has built-in async support, but you must NOT change the default server timeout (0 = no timeout in Node.js). Instead, set `req.setTimeout()` to the configurable limit and use AbortController to cancel Docker operations.

4. **Container zombie processes**: After a step completes, the container must be removed (`AutoRemove: true` in dockerode createContainer). Without this, completed containers accumulate and exhaust disk/memory.

5. **Job directory cleanup race condition**: Never clean up a job directory while the client might still be downloading artifacts. Leave cleanup for later (Phase 10 async orchestrator) or use a TTL-based cleanup job.

6. **Container network isolation**: The API container and all pipeline containers must share the same Docker network (`pipeline-net` in docker-compose.yml) so the API can reach containers by name.

## Validation Architecture

### Dimension 1: Correctness
- POST /process with valid MP4 returns 200 + JSON with jobId, videoUrl, artifacts
- POST /process without file returns 400 with validation error
- POST /process with non-MP4 file returns 415 with type error
- Pipeline step failure returns 500 with step name and error message
- Timeout returns 408 with timeout message

### Dimension 2: Completeness
- All 5 pipeline steps are executed in correct order
- All intermediate artifacts are accessible via URLs
- manifest.json is read for each step to detect success/failure

### Dimension 3: Edge Cases
- Empty file upload (0 bytes) → 400 error
- Very large file (over limit) → 413 Payload Too Large
- Concurrent requests get unique job IDs and don't interfere
- Container startup failure → meaningful error response
- Missing Docker image → meaningful error response

---

*Phase: 09-synchronous-api*
*Research completed: 2026-05-12*