"""FFmpeg finalizer entry point.

Pipeline step: Converts video to 9:16 vertical format (1080x1920) with
center-crop strategy, H.264 encoding, and audio normalization for social media.

Reads: INPUT_PATH (MP4 file on shared volume)
Writes: OUTPUT_PATH (9:16 MP4), finalizer-info.json, manifest.json

Per step contract (D-05, D-06, D-07):
- Container inherits from base-python (D-02 base image pattern)
- INPUT_PATH points to silence-cutter output on shared volume
- Output is output.mp4 + finalizer-info.json + manifest.json
"""

import os
import sys
import time
import json

from src import config
from src.crop import probe_video, apply_finalizer
from src.schema import FinalizerInfo


def main():
    start_time = time.time()

    # Read environment variables (step contract: D-05, D-06)
    input_path = os.environ.get("INPUT_PATH")
    output_path = os.environ.get("OUTPUT_PATH")
    job_id = os.environ.get("PIPELINE_JOB_ID")

    # Allow env var overrides for configurable constants
    for env_name, env_val in [("VERTICAL_WIDTH", config.VERTICAL_WIDTH), ("VERTICAL_HEIGHT", config.VERTICAL_HEIGHT), ("CROP_STRATEGY", config.CROP_STRATEGY)]:
        val = os.environ.get(env_name)
        if val is not None:
            if env_name in ("VERTICAL_WIDTH", "VERTICAL_HEIGHT"):
                try:
                    int_val = int(val)
                    if env_name == "VERTICAL_WIDTH":
                        config.VERTICAL_WIDTH = int_val
                    else:
                        config.VERTICAL_HEIGHT = int_val
                    print(f"[{config.STEP_NAME}] Overriding {env_name} to {int_val}")
                except ValueError:
                    print(f"[{config.STEP_NAME}] WARNING: Invalid {env_name} '{val}'")
            elif env_name == "CROP_STRATEGY":
                if val != "center":
                    print(f"[{config.STEP_NAME}] WARNING: Only 'center' crop strategy supported in v1, ignoring '{val}'")
                config.CROP_STRATEGY = val

    # D-05: Safe zone constants are NOT configurable via env vars.
    # They are hardcoded constants written into finalizer-info.json as metadata
    # for Phase 5 to consume. This ensures consistent safe zone data across all runs.

    # Validate required env vars
    if not input_path:
        print("ERROR: INPUT_PATH environment variable is not set", file=sys.stderr)
        sys.exit(1)

    if not output_path:
        print("ERROR: OUTPUT_PATH environment variable is not set", file=sys.stderr)
        sys.exit(1)

    if not job_id:
        print("ERROR: PIPELINE_JOB_ID environment variable is not set", file=sys.stderr)
        sys.exit(1)

    print(f"[{config.STEP_NAME}] Starting 9:16 finalization for job: {job_id}")
    print(f"  INPUT_PATH:  {input_path}")
    print(f"  OUTPUT_PATH: {output_path}")

    # Validate input file exists
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

    # Create output directory
    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)

    try:
        print(f"[{config.STEP_NAME}] Step 1: Probing input video")
        probe_info = probe_video(input_path)
        print(f"  {probe_info['width']}x{probe_info['height']} duration={probe_info['duration']:.1f}s audio={probe_info['has_audio']}")

        print(f"[{config.STEP_NAME}] Step 2: Applying 9:16 crop + encode")
        meta = apply_finalizer(input_path, output_path, config.VERTICAL_WIDTH, config.VERTICAL_HEIGHT, probe_info)

        print(f"[{config.STEP_NAME}] Step 3: Writing finalizer-info.json")
        info = FinalizerInfo(**meta)
        info_path = os.path.join(output_dir, "finalizer-info.json")
        with open(info_path, "w") as f:
            f.write(info.model_dump_json(indent=2))
        print(f"  Wrote finalizer-info.json")

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
        error_msg = f"Finalizer failed: {e}"
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

    Matches the whisper/main.py pattern for consistency across steps.
    Manifest is written to the same directory as the output file.
    """
    # Determine manifest directory from OUTPUT_PATH or output_files
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