---
phase: 09-synchronous-api
plan: 03
subsystem: api, docker, infra
tags: [docker, dockerfile, express, health-endpoint, docker-compose, api-server, container-orchestration]

# Dependency graph
requires:
  - phase: 09-synchronous-api
    provides: "POST /process endpoint, orchestrator, artifacts routes (plans 01-02)"
  - phase: 01-pipeline-infrastructure
    provides: "Docker Compose pipeline, shared schemas, step contracts"
provides:
  - "API server Dockerfile with docker-cli for sibling container orchestration"
  - "GET /health liveness endpoint"
  - "api-server Docker Compose service with Docker socket and pipeline volume"
  - "API_PORT configurable environment variable (default 3000)"
  - "HOST_PIPELINE_DIR for correct Docker bind mount host paths"
  - "PIPELINE_NETWORK for configurable Docker network name"
  - "GPU DeviceRequests for whisper container"
affects: [docker-deployment, pipeline-orchestration, e2e-testing]

# Tech tracking
tech-stack:
  added: [docker-cli, node:22-bookworm-slim]
  patterns: [sibling-container-orchestration-via-docker-socket, health-check-liveness-probe, host-path-volumes-for-sibling-containers]

key-files:
  created:
    - services/api-server/Dockerfile
    - services/api-server/src/routes/health.ts
  modified:
    - docker-compose.yml
    - services/api-server/src/index.ts
    - services/api-server/src/orchestrator.ts
    - services/api-server/src/orchestrator.test.ts
    - services/api-server/src/constants.ts

key-decisions:
  - "Used node:22-bookworm-slim directly (not base-node) since API server doesn't need Chrome/FFmpeg"
  - "Installed docker-cli from official Docker apt repo for sibling container management via Docker socket"
  - "Health endpoint returns simple liveness status without dependency checks to avoid hanging"
  - "Docker socket mounted for container orchestration per D-01/D-06"
  - "Added group_add for docker GID in docker-compose.yml to enable Docker socket access from non-root container"
  - "Dockerfile adds node user to docker group with configurable DOCKER_GID (default 1001)"
  - "Orchestrator uses HOST_PIPELINE_DIR env var for bind mount source (container path ≠ host path)"
  - "Orchestrator uses PIPELINE_NETWORK env var for Docker network name (Compose adds project prefix)"
  - "Image names changed from video-pipeline-* to reel-factory-* to match Compose build naming"
  - "GPU DeviceRequests added for whisper step to enable CUDA acceleration"

patterns-established:
  - "Health route pattern: GET /health returning {status, timestamp, uptime_seconds} for container liveness probing"
  - "Sibling container pattern: API server creates pipeline containers via Docker socket, using host-side volume paths for bind mounts"
  - "Configurable naming: PIPELINE_NETWORK, HOST_PIPELINE_DIR, API_PORT, PROCESS_TIMEOUT_MS all configurable via env vars"

requirements-completed: [APIS-01, APIS-02, APIS-03]

# Metrics
duration: 15min
completed: 2026-05-13
---

# Phase 9 Plan 03: Dockerfile, Health Endpoint & Docker Compose Summary

**API server Docker container with Docker socket orchestration, health liveness endpoint, Docker Compose integration, and E2E pipeline verification**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-12T23:37:49Z
- **Completed:** 2026-05-13T00:45:00Z
- **Tasks:** 2 (1 autonomous, 1 checkpoint verified)
- **Files modified:** 6

## Accomplishments
- Created API server Dockerfile with Node.js 22 and docker-cli for sibling container management
- Added GET /health endpoint returning status, timestamp, and uptime for liveness probes
- Configured api-server service in docker-compose.yml with Docker socket mount, pipeline volume, and configurable API_PORT
- Fixed Docker socket permissions: added group_add for docker GID, DOCKER_GID build arg in Dockerfile
- Fixed Docker image names from video-pipeline-* to reel-factory-* to match Compose build naming
- Added HOST_PIPELINE_DIR env var for correct bind mount paths (container path ≠ host path in sibling containers)
- Added PIPELINE_NETWORK env var for configurable Docker network name (Compose adds project prefix)
- Added GPU DeviceRequests for whisper step in orchestrator
- Verified E2E pipeline: uploaded MP4 → all 5 steps completed → output 1080x1920 (9:16) video
- All 28 unit tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create API server Dockerfile, health endpoint, and Docker Compose integration** - `8ddab7c` (feat)

2. **Task 2 (checkpoint:human-verify): E2E verification** - Verified manually:
   - `docker compose build api-server` ✅
   - `GET /health` → `{"status":"ok","timestamp":"...","uptime_seconds":5.14}` ✅
   - `POST /process` with MP4 → pipeline runs all 5 steps → 1080x1920 output ✅
   - All 5 pipeline manifests present ✅
   - SRT/VTT exports present ✅

   E2E fix commits:
   - `d88998f` fix(09-03): fix Docker socket permissions, image names, bind mount paths, and GPU passthrough for E2E

## Files Created/Modified
- `services/api-server/Dockerfile` - Node.js 22 container with docker-cli, DOCKER_GID build arg
- `services/api-server/src/routes/health.ts` - GET /health liveness endpoint
- `services/api-server/src/index.ts` - Health route mounted before process/artifacts routes
- `docker-compose.yml` - api-server service with Docker socket, pipeline volume, API_PORT, group_add, HOST_PIPELINE_DIR, PIPELINE_NETWORK
- `services/api-server/src/orchestrator.ts` - Fixed image names, added HOST_PIPELINE_DIR bind mount, GPU DeviceRequests for whisper
- `services/api-server/src/orchestrator.test.ts` - Updated image name expectations to reel-factory-*
- `services/api-server/src/constants.ts` - Added HOST_PIPELINE_DIR and PIPELINE_NETWORK env vars

## Decisions Made
- Used `node:22-bookworm-slim` directly instead of `video-pipeline-base-node` since the API server doesn't need Chrome or FFmpeg — smaller image, faster builds
- Installed docker-cli from official Docker apt repository for Docker-in-Docker socket access per D-01
- Health endpoint intentionally simple (no dependency checks) per plan spec — checking Docker connectivity could hang on startup
- Docker socket mount at `/var/run/docker.sock` enables the API container to manage sibling containers for pipeline orchestration
- Used `group_add: ["1001"]` in docker-compose.yml to grant Docker socket access to node user (GID matches host's docker group)
- Used HOST_PIPELINE_DIR env var because Docker bind mounts reference host paths, not container paths — inside the API container, `/data/pipeline` maps to host `./pipeline`, so sibling containers need the host path
- Used PIPELINE_NETWORK env var because Docker Compose prefixes network names with the project name (e.g., `reel-factory_pipeline-net`)

## Deviations from Plan

E2E testing uncovered 4 infrastructure issues that required fixes:
1. Docker socket permissions: node user (uid 1000) couldn't access `/var/run/docker.sock` owned by `root:docker(1001)`. Fixed by adding `group_add` in docker-compose.yml and DOCKER_GID build arg in Dockerfile.
2. Image naming mismatch: orchestrator used `video-pipeline-*` but Docker Compose builds `reel-factory-*`. Fixed image names in STEPS constant and tests.
3. Docker network name: orchestrator used `pipeline-net` but Compose creates `reel-factory_pipeline-net`. Made configurable via PIPELINE_NETWORK env var.
4. Bind mount host path: orchestrator used container path `/data/pipeline` for bind mount source, but Docker needs the host path. Added HOST_PIPELINE_DIR env var.

## Issues Encountered

- E2E test required 4 infrastructure fixes (documented in Deviations above)
- Whisper container needs GPU DeviceRequests for CUDA acceleration — added to orchestrator
- Host docker group GID varies by system (1001 on this host) — made configurable via DOCKER_GID build arg

## Self-Check: PASSED

- All 6 key files verified on disk: Dockerfile, health.ts, index.ts, docker-compose.yml, orchestrator.ts, constants.ts
- Commits verified in git log
- Docker build passes: `docker compose build api-server` succeeds
- All 28 unit tests pass
- E2E pipeline verified: upload → 5 steps → 1080x1920 output ✅

---
*Phase: 09-synchronous-api*
*Completed: 2026-05-13*