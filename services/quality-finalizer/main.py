"""Quality-finalizer entry point.

Pipeline step: Probe-gated Lanczos downscale from remotion-renderer's
output (which is either 2160x3840 at scale=2 or 1080x1920 at scale=1)
back to the deliverable 1080x1920. Idempotent — if input is already at
target, the step stream-copies (no re-encode); otherwise it Lanczos
downscales with CRF 18 + BT.709 carry-through (D-08, D-09, D-11).

Reads:  INPUT_PATH (remotion-renderer output MP4 on shared volume)
Writes: OUTPUT_PATH (1080x1920 MP4), downscale-info.json, manifest.json

Per step contract:
- Container inherits from video-pipeline-base-python (Dockerfile).
- INPUT_PATH points to remotion-renderer/output.mp4 on the shared volume.
- Output is output.mp4 + downscale-info.json + manifest.json in the
  quality-finalizer output directory.
- D-06: No env-var override loop here; tunable Remotion knobs live in
  render.ts env vars, not in the finalizer.
"""

import json
import os
import sys
import time

from src import config
from src.downscale import probe_video, apply_downscale
from src.schema import DownscaleInfo


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

    print(f"[{config.STEP_NAME}] Starting probe-gated downscale for job: {job_id}")
    print(f"  INPUT_PATH:  {input_path}")
    print(f"  OUTPUT_PATH: {output_path}")

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
        print(f"[{config.STEP_NAME}] Step 1: Probing input video")
        probe_info = probe_video(input_path)
        print(
            f"  {probe_info['width']}x{probe_info['height']} "
            f"duration={probe_info['duration']:.1f}s audio={probe_info['has_audio']}"
        )

        # D-08: log which branch we will take before invoking ffmpeg, so the
        # logs make it obvious whether the run was an encode or a passthrough.
        if probe_info["width"] > config.TARGET_WIDTH or probe_info["height"] > config.TARGET_HEIGHT:
            print(f"[{config.STEP_NAME}] Step 2: Applying Lanczos downscale to 1080x1920")
        else:
            print(f"[{config.STEP_NAME}] Step 2: Stream-copying — already 1080x1920")

        meta = apply_downscale(input_path, output_path, probe_info)

        print(f"[{config.STEP_NAME}] Step 3: Writing downscale-info.json")
        info = DownscaleInfo(**meta)
        info_path = os.path.join(output_dir, "downscale-info.json")
        with open(info_path, "w") as f:
            f.write(info.model_dump_json(indent=2))
        print(f"  Wrote downscale-info.json")

        duration = time.time() - start_time
        _write_manifest(
            input_file=input_path,
            output_files=[output_path, info_path],
            duration_seconds=duration,
            status="success",
            exit_code=0,
        )
        print(f"[{config.STEP_NAME}] Completed successfully in {duration:.2f}s")
        sys.exit(0)

    except Exception as e:
        error_msg = f"Quality-finalizer failed: {e}"
        print(f"ERROR: {error_msg}", file=sys.stderr)
        import traceback
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
    """Write manifest.json following PipelineManifest schema.

    Matches the ffmpeg-finalizer/main.py pattern for consistency across steps.
    Manifest is written to the same directory as the output file.
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
