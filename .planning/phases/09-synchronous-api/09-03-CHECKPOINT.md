# Checkpoint: E2E Pipeline Verification

**Plan:** 09-03
**Task:** 2 of 2
**Type:** checkpoint:human-verify (blocking gate)

## What Was Built

Full synchronous API for processing MP4 videos through the Docker pipeline:

- **API server Dockerfile** (`services/api-server/Dockerfile`): Node.js 22 bookworm-slim with docker-cli installed for sibling container orchestration via Docker socket mount
- **GET /health endpoint** (`services/api-server/src/routes/health.ts`): Returns `{ status: "ok", timestamp, uptime_seconds }` — simple liveness check with no dependency probes
- **Docker Compose integration** (`docker-compose.yml`): `api-server` service with configurable `API_PORT` (default 3000), Docker socket mount (`/var/run/docker.sock`), pipeline volume, and `PROCESS_TIMEOUT_MS` environment variable
- **Route mounting** (`services/api-server/src/index.ts`): Health route registered before process/artifacts routes for fast liveness probing

The API server can orchestrate all 5 pipeline containers (whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → srt-exporter) via Docker socket, handle MP4 uploads, and return processed video URLs + artifact URLs.

## How to Verify

### 1. Build and start the pipeline

```bash
cd /home/luis/proyectos/reel-factory
docker compose build api-server
docker compose up -d
```

Wait for all services to be healthy (30-60 seconds for base images + whisper model download on first run):
```bash
docker compose ps
```

### 2. Verify the health endpoint

```bash
curl http://localhost:3000/health
```

Expected response (HTTP 200):
```json
{
  "status": "ok",
  "timestamp": "2026-05-12T...",
  "uptime_seconds": 3.14
}
```

### 3. Send a test video for processing

```bash
# Use any small MP4 talking-head video as test input
curl -X POST http://localhost:3000/process \
  -F "video=@/path/to/test.mp4" \
  -o response.json
cat response.json | python3 -m json.tool
```

Expected response (HTTP 200):
```json
{
  "jobId": "uuid-format",
  "videoUrl": "/artifacts/{jobId}/remotion-renderer/output.mp4",
  "artifacts": {
    "whisper": ["/artifacts/{jobId}/whisper/transcript.json", ...],
    "silence-cutter": ["/artifacts/{jobId}/silence-cutter/output.mp4", ...],
    "ffmpeg-finalizer": ["/artifacts/{jobId}/ffmpeg-finalizer/output.mp4", ...],
    "remotion-renderer": ["/artifacts/{jobId}/remotion-renderer/output.mp4", ...],
    "srt-exporter": ["/artifacts/{jobId}/srt-exporter/output.vtt", ...]
  },
  "duration_seconds": 42.5
}
```

### 4. Verify artifact access

```bash
# Use the jobId from step 3
JOB_ID=$(cat response.json | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])")

curl http://localhost:3000/artifacts/$JOB_ID/whisper/transcript.json | head -5
curl http://localhost:3000/artifacts/$JOB_ID/remotion-renderer/output.mp4 -o processed.mp4
```

### 5. Verify the processed video

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 processed.mp4
```

Expected output: `1080,1920` (9:16 vertical format)

### 6. (Optional) Test timeout handling

```bash
# Send a video with a very short timeout to verify 408 response
PROCESS_TIMEOUT_MS=5000 curl -X POST http://localhost:3000/process \
  -F "video=@/path/to/test.mp4" \
  -o timeout_response.json
```

Expected: HTTP 408 with `{ "jobId": "...", "error": { "step": "timeout", "message": "..." } }`

## Resume Signal

Type "approved" if the pipeline processes a video end-to-end correctly, or describe any issues encountered.

## Commit Reference

- Task 1: `8ddab7c` — feat(09-03): add API server Dockerfile, health endpoint, and Docker Compose service