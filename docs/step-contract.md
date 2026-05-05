# Pipeline Step Contract

Every container in the video processing pipeline MUST follow this contract.
This document defines the interface that makes steps interchangeable and the pipeline extensible.

## Environment Variables

Each step container receives three required environment variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `INPUT_PATH` | Path to the input file this step must read | `/data/pipeline/job-001/input/video.mp4` |
| `OUTPUT_PATH` | Path where this step must write its primary output | `/data/pipeline/job-001/whisper/output.mp4` |
| `PIPELINE_JOB_ID` | Unique identifier for the current pipeline job | `job-001` |

No config files are mounted. No HTTP endpoints are exposed. Env vars only.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success — step completed, output written |
| 1 | Generic error — unexpected failure |
| 2+ | Step-specific error codes (defined per container) |

## Manifest Artifact

Each step MUST write a `manifest.json` file next to its output containing:

```json
{
  "step_name": "whisper",
  "input_file": "/data/pipeline/job-001/input/video.mp4",
  "output_files": [
    "/data/pipeline/job-001/whisper/transcript.json"
  ],
  "duration_seconds": 12.5,
  "timestamp": "2026-05-05T21:30:00.000Z",
  "status": "success",
  "exit_code": 0
}
```

On error:
```json
{
  "step_name": "whisper",
  "input_file": "/data/pipeline/job-001/input/video.mp4",
  "output_files": [],
  "duration_seconds": 2.1,
  "timestamp": "2026-05-05T21:30:00.000Z",
  "status": "error",
  "exit_code": 2,
  "error_message": "Audio extraction failed: no audio stream found"
}
```

## Adding a New Step

To add a new processing step to the pipeline:

1. Create a Docker container that reads from `INPUT_PATH` and writes to `OUTPUT_PATH`
2. Write a `manifest.json` next to the output on completion
3. Exit with code 0 on success, non-zero on failure
4. Add a service definition to `docker-compose.yml` with `x-pipeline-common` extension
5. Insert the service in the pipeline chain using `depends_on` with a healthcheck

No existing step configurations need modification.

## Container Responsibilities

- **Read** from `INPUT_PATH` only
- **Write** to `OUTPUT_PATH` and its parent directory only
- **Write** `manifest.json` in the output directory
- **Exit** with appropriate code
- **Do NOT** communicate with other containers via HTTP
- **Do NOT** require config files mounted into the container