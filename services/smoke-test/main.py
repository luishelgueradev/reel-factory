import os
import json
import shutil
import time
import subprocess
import sys
from pathlib import Path


def main():
    start_time = time.time()

    input_path = os.environ.get("INPUT_PATH")
    output_path = os.environ.get("OUTPUT_PATH")
    job_id = os.environ.get("PIPELINE_JOB_ID")

    if not input_path:
        print("ERROR: INPUT_PATH environment variable is not set", file=sys.stderr)
        sys.exit(1)

    if not output_path:
        print("ERROR: OUTPUT_PATH environment variable is not set", file=sys.stderr)
        sys.exit(1)

    if not job_id:
        print("ERROR: PIPELINE_JOB_ID environment variable is not set", file=sys.stderr)
        sys.exit(1)

    print(f"Smoke test starting for job: {job_id}")
    print(f"  INPUT_PATH:  {input_path}")
    print(f"  OUTPUT_PATH: {output_path}")

    try:
        ffmpeg_version_output = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        first_line = ffmpeg_version_output.stdout.split("\n")[0]
        print(f"  FFmpeg version: {first_line}")
    except Exception as e:
        print(f"WARNING: Could not verify FFmpeg version: {e}")

    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found at {input_path}", file=sys.stderr)
        write_manifest(
            step_name="smoke-test",
            input_file=input_path,
            output_files=[],
            duration_seconds=time.time() - start_time,
            status="error",
            exit_code=1,
            error_message=f"Input file not found at {input_path}"
        )
        sys.exit(1)

    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)

    shutil.copy2(input_path, output_path)
    print(f"  Copied {input_path} -> {output_path}")

    intermediate_dir = os.path.join(output_dir, "intermediate")
    os.makedirs(intermediate_dir, exist_ok=True)
    intermediate_file = os.path.join(intermediate_dir, "analysis.json")
    with open(intermediate_file, "w") as f:
        json.dump({
            "step": "smoke-test",
            "input_size_bytes": os.path.getsize(input_path),
            "output_size_bytes": os.path.getsize(output_path),
            "message": "This is an intermediate artifact demonstrating inspectability (PIPE-03)"
        }, f, indent=2)
    print(f"  Wrote intermediate artifact: {intermediate_file}")

    duration = time.time() - start_time
    write_manifest(
        step_name="smoke-test",
        input_file=input_path,
        output_files=[output_path, intermediate_file],
        duration_seconds=duration,
        status="success",
        exit_code=0
    )

    print(f"Smoke test completed successfully in {duration:.2f}s")
    sys.exit(0)


def write_manifest(step_name, input_file, output_files, duration_seconds,
                   status, exit_code, error_message=None):
    output_dir = os.environ.get("OUTPUT_PATH", "/tmp")
    manifest_dir = os.path.dirname(output_dir)

    if output_files:
        manifest_dir = os.path.dirname(output_files[0])

    manifest_path = os.path.join(manifest_dir, "manifest.json")

    os.makedirs(manifest_dir, exist_ok=True)

    manifest = {
        "step_name": step_name,
        "input_file": input_file,
        "output_files": output_files,
        "duration_seconds": round(duration_seconds, 2),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "status": status,
        "exit_code": exit_code,
    }

    if error_message:
        manifest["error_message"] = error_message

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"  Wrote manifest: {manifest_path}")


if __name__ == "__main__":
    main()