"""whisper-http-step entry point.

Pipeline step: a thin HTTP client to the standalone whisper-api that REPLACES
the embedded GPU Whisper container. It probes the input duration (ffprobe),
calls the external service (sync /transcribe <=120s or async /jobs+poll), and
writes the BARE profile=reels JSON body VERBATIM to OUTPUT_PATH (transcript.json)
— preserving the file-based step contract so every downstream step is untouched.

Reads:  INPUT_PATH (original video MP4 on the shared volume),
        OUTPUT_PATH (.../whisper/transcript.json),
        PIPELINE_JOB_ID,
        WHISPER_API_URL / WHISPER_API_KEY (via src.config, env-sourced).
Writes: OUTPUT_PATH (verbatim reels body) + manifest.json.

Per step contract:
- Container inherits from video-pipeline-base-python (Dockerfile); no GPU (D-4).
- manifest.json is written next to OUTPUT_PATH with step_name="whisper"
  (config.STEP_NAME) — the orchestrator reads pipeline/{jobId}/whisper/manifest.json.
- Any HTTP failure (401/400/413/500/persistent-503/oversize) becomes a non-zero
  exit + error manifest, which the orchestrator maps to a PipelineStepError.

DECISION (NO_AUDIO_STREAM): the legacy whisper step wrote an empty transcript and
exited 0 on a missing audio stream; this step FAILS instead (the whisper-api
returns 400 NO_AUDIO_STREAM). See src/transcribe_http.py docstring.
"""

import json
import os
import sys
import time
import traceback

from src import config
from src.transcribe_http import probe_duration, transcribe_via_http


def main():
    start_time = time.time()

    # Read environment variables (step contract).
    input_path = os.environ.get("INPUT_PATH")
    output_path = os.environ.get("OUTPUT_PATH")
    job_id = os.environ.get("PIPELINE_JOB_ID")

    # Validate required env vars.
    if not input_path:
        print("ERROR: INPUT_PATH environment variable is not set", file=sys.stderr)
        sys.exit(1)

    if not output_path:
        print("ERROR: OUTPUT_PATH environment variable is not set", file=sys.stderr)
        sys.exit(1)

    if not job_id:
        print("ERROR: PIPELINE_JOB_ID environment variable is not set", file=sys.stderr)
        sys.exit(1)

    # Validate the API key up front. A missing key would otherwise only surface
    # as a 401 mid-flight after we have already opened/uploaded the file. We
    # reference the variable NAME, never the value (T-15-02).
    if not config.WHISPER_API_KEY:
        print("ERROR: WHISPER_API_KEY environment variable is not set", file=sys.stderr)
        sys.exit(1)

    print(f"[{config.STEP_NAME}] Starting HTTP transcription for job: {job_id}")
    print(f"  INPUT_PATH:  {input_path}")
    print(f"  OUTPUT_PATH: {output_path}")
    print(f"  WHISPER_API_URL: {config.WHISPER_API_URL}")

    # Validate input file exists.
    if not os.path.exists(input_path):
        error_msg = f"Input file not found at {input_path}"
        print(f"ERROR: {error_msg}", file=sys.stderr)
        _write_manifest(
            input_file=input_path,
            output_files=[],
            duration_seconds=time.time() - start_time,
            status="error",
            exit_code=1,
            error_message=error_msg,
        )
        sys.exit(1)

    # Create output directory.
    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)

    try:
        print(f"[{config.STEP_NAME}] Step 1: Probing input duration")
        duration = probe_duration(input_path)
        print(f"  duration={duration:.1f}s")

        route = "sync /transcribe" if duration <= config.SYNC_THRESHOLD_S else "async /jobs"
        print(f"[{config.STEP_NAME}] Step 2: Transcribing via whisper-api ({route})")
        body = transcribe_via_http(input_path, duration)

        print(f"[{config.STEP_NAME}] Step 3: Writing transcript.json verbatim")
        with open(output_path, "w") as f:
            json.dump(body, f, indent=2)
        print(f"  Wrote {output_path}")

        duration_s = time.time() - start_time
        _write_manifest(
            input_file=input_path,
            output_files=[output_path],
            duration_seconds=duration_s,
            status="success",
            exit_code=0,
        )
        print(f"[{config.STEP_NAME}] Completed successfully in {duration_s:.2f}s")
        sys.exit(0)

    except Exception as e:
        error_msg = f"Whisper HTTP step failed: {e}"
        print(f"ERROR: {error_msg}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)

        _write_manifest(
            input_file=input_path,
            output_files=[],
            duration_seconds=time.time() - start_time,
            status="error",
            exit_code=1,
            error_message=error_msg,
        )
        sys.exit(1)


def _write_manifest(
    input_file: str,
    output_files: list,
    duration_seconds: float,
    status: str,
    exit_code: int,
    error_message: str = None,
):
    """Write manifest.json following the PipelineManifest schema.

    Matches the quality-finalizer/main.py pattern verbatim for consistency
    across steps. Manifest is written next to the output file. step_name is
    config.STEP_NAME ("whisper") — DO NOT rename: the orchestrator reads
    pipeline/{jobId}/whisper/manifest.json.
    """
    output_path = os.environ.get("OUTPUT_PATH", "/tmp")
    if output_files:
        manifest_dir = os.path.dirname(output_files[0])
    else:
        manifest_dir = os.path.dirname(output_path)

    manifest_path = os.path.join(manifest_dir, "manifest.json")

    manifest = {
        "step_name": config.STEP_NAME,
        "input_file": input_file,
        "output_files": output_files,
        "duration_seconds": round(duration_seconds, 2),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "status": status,
        "exit_code": exit_code,
    }

    if error_message:
        manifest["error_message"] = error_message

    os.makedirs(manifest_dir, exist_ok=True)
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"  Wrote manifest: {manifest_path}")


if __name__ == "__main__":
    main()
