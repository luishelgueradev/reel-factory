"""Whisper transcription container entry point.

Pipeline step: Whisper transcribes audio from an MP4 file with word-level timestamps.

Reads: INPUT_PATH (MP4 file on shared volume)
Writes: OUTPUT_PATH (transcript.json) + manifest.json

Per step contract (D-05, D-06, D-07, D-08):
- Audio extraction happens inside this container (D-06)
- Audio is resampled to 16kHz mono WAV before transcription (D-05)
- Output is a single transcript.json file (D-08)
- Words include no_speech_prob per D-09
"""

import os
import sys
import time
import json

from src import config
from src.audio_extraction import extract_audio
from src.transcribe import transcribe
from src.hallucination_filter import filter_hallucinations
from src.schema import Transcript


def main():
    start_time = time.time()

    # Read environment variables (step contract: D-05, D-06)
    input_path = os.environ.get("INPUT_PATH")
    output_path = os.environ.get("OUTPUT_PATH")
    job_id = os.environ.get("PIPELINE_JOB_ID")

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

    print(f"[{config.STEP_NAME}] Starting transcription for job: {job_id}")
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

    # Intermediate directory for WAV file (not preserved as artifact per D-08)
    intermediate_dir = os.path.join(output_dir, "intermediate")
    wav_path = os.path.join(intermediate_dir, "audio.wav")

    try:
        # Step 1: Extract audio from MP4 (D-06: audio extraction inside container)
        print(f"[{config.STEP_NAME}] Step 1: Extracting audio from {input_path}")
        extract_audio(input_path, wav_path)

        # Step 2: Transcribe with whisperx/faster-whisper (D-01: primary + fallback)
        print(f"[{config.STEP_NAME}] Step 2: Transcribing {wav_path}")
        transcript = transcribe(wav_path)
        print(f"[{config.STEP_NAME}] Transcription complete: "
              f"{len(transcript.segments)} segments, {len(transcript.words)} words, "
              f"{transcript.duration:.1f}s audio")

        # Step 3: Filter hallucinations (D-11, TRAN-03)
        print(f"[{config.STEP_NAME}] Step 3: Filtering hallucinations")
        filtered_transcript = filter_hallucinations(transcript)
        print(f"[{config.STEP_NAME}] After filtering: "
              f"{len(filtered_transcript.segments)} segments, "
              f"{len(filtered_transcript.words)} words")

        # Step 4: Write transcript.json (D-08: single output file)
        print(f"[{config.STEP_NAME}] Step 4: Writing transcript.json")
        transcript_json = filtered_transcript.model_dump_json(indent=2)
        with open(output_path, "w") as f:
            f.write(transcript_json)
        print(f"  Wrote transcript.json: {len(transcript_json)} bytes")

        # Clean up intermediate WAV file (D-08: not preserved as artifact)
        if os.path.exists(wav_path):
            os.remove(wav_path)
            print(f"  Cleaned up intermediate: {wav_path}")

        # Clean up intermediate directory if empty
        try:
            os.rmdir(intermediate_dir)
        except OSError:
            pass  # Directory not empty or doesn't exist — fine

        # Step 5: Write manifest.json (following smoke-test pattern)
        duration = time.time() - start_time
        _write_manifest(
            input_file=input_path,
            output_files=[output_path],
            duration_seconds=duration,
            status="success",
            exit_code=0,
        )

        print(f"[{config.STEP_NAME}] Completed successfully in {duration:.2f}s")
        sys.exit(0)

    except Exception as e:
        error_msg = f"Transcription failed: {e}"
        print(f"ERROR: {error_msg}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)

        # Clean up intermediate WAV on error
        if os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except OSError:
                pass

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

    Matches the smoke-test main.py pattern for consistency across steps.
    Manifest is written to the same directory as the output file.
    """
    # Determine manifest directory from OUTPUT_PATH or output_files
    output_path = os.environ.get("OUTPUT_PATH", "/tmp")
    if output_files:
        manifest_dir = os.path.dirname(output_files[0])
    else:
        manifest_dir = os.path.dirname(output_path) if os.path.isfile(output_path) else output_path

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