"""Silence cutter container entry point.

Pipeline step: Silence cutter detects silent sections by cross-referencing
FFmpeg silencedetect with Whisper no_speech data, then removes them with
hard cuts preserving A/V sync.

Reads: INPUT_PATH (original MP4), TRANSCRIPT_PATH (transcript.json from Whisper step)
Writes: OUTPUT_PATH (silence-removed MP4), silence-cuts.json, manifest.json

Per step contract (D-05, D-06, D-07):
- Container inherits from base-python (D-02 base image pattern)
- INPUT_PATH points to original MP4 on shared volume
- TRANSCRIPT_PATH points to transcript.json from whisper step
- Output is output.mp4 + silence-cuts.json (D-08) + manifest.json
"""

import os
import sys
import time
import json

from src import config
from src.silencedetect import detect_silence
from src.cross_reference import cross_reference_silence
from src.cut_video import cut_silences, get_video_duration
from src.remap_transcript import remap_transcript
from src.schema import SilenceCutList


def main():
    start_time = time.time()

    # Read environment variables (step contract: D-05, D-06)
    input_path = os.environ.get("INPUT_PATH")
    output_path = os.environ.get("OUTPUT_PATH")
    transcript_path = os.environ.get("TRANSCRIPT_PATH")
    job_id = os.environ.get("PIPELINE_JOB_ID")

    # Allow SILENCE_MIN_DURATION override per D-05
    min_duration = os.environ.get(config.SILENCE_MIN_DURATION_ENV)
    if min_duration is not None:
        try:
            config.SILENCE_MIN_DURATION = float(min_duration)
            print(f"[{config.STEP_NAME}] Overriding SILENCE_MIN_DURATION to {config.SILENCE_MIN_DURATION}")
        except ValueError:
            print(f"[{config.STEP_NAME}] WARNING: Invalid SILENCE_MIN_DURATION value '{min_duration}', using default {config.SILENCE_MIN_DURATION}")

    # Allow SILENCE_CUT_SHRINK override
    shrink = os.environ.get(config.SILENCE_CUT_SHRINK_ENV)
    if shrink is not None:
        try:
            config.SILENCE_CUT_SHRINK = float(shrink)
            print(f"[{config.STEP_NAME}] Overriding SILENCE_CUT_SHRINK to {config.SILENCE_CUT_SHRINK}")
        except ValueError:
            print(f"[{config.STEP_NAME}] WARNING: Invalid SILENCE_CUT_SHRINK value '{shrink}', using default {config.SILENCE_CUT_SHRINK}")

    # Validate required env vars
    if not input_path:
        print("ERROR: INPUT_PATH environment variable is not set", file=sys.stderr)
        sys.exit(1)

    if not output_path:
        print("ERROR: OUTPUT_PATH environment variable is not set", file=sys.stderr)
        sys.exit(1)

    if not transcript_path:
        print(f"[{config.STEP_NAME}] No TRANSCRIPT_PATH set — using FFmpeg-only mode (no Whisper cross-reference)")
    elif not os.path.exists(transcript_path):
        print(f"[{config.STEP_NAME}] WARNING: Transcript not found at {transcript_path} — using FFmpeg-only mode")

    if not job_id:
        print("ERROR: PIPELINE_JOB_ID environment variable is not set", file=sys.stderr)
        sys.exit(1)

    print(f"[{config.STEP_NAME}] Starting silence detection and removal for job: {job_id}")
    print(f"  INPUT_PATH:      {input_path}")
    print(f"  OUTPUT_PATH:     {output_path}")
    print(f"  TRANSCRIPT_PATH: {transcript_path}")

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

    # Validate transcript if provided
    has_transcript = False
    if transcript_path and os.path.exists(transcript_path):
        has_transcript = True
    elif transcript_path:
        print(f"[{config.STEP_NAME}] WARNING: Transcript not found at {transcript_path} — using FFmpeg-only mode")

    # Create output directory
    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)

    try:
        # Step 1: Get video duration (needed for SilenceCutList)
        print(f"[{config.STEP_NAME}] Step 1: Getting video duration")
        original_duration = get_video_duration(input_path)
        print(f"  Video duration: {original_duration:.2f}s")

        # Step 2: Run FFmpeg silencedetect to find candidate silence segments
        print(f"[{config.STEP_NAME}] Step 2: Running FFmpeg silencedetect")
        silence_candidates = detect_silence(input_path)
        print(f"  Found {len(silence_candidates)} candidate silence segments")

        # Step 3: Cross-reference with Whisper transcript (if available)
        if has_transcript:
            print(f"[{config.STEP_NAME}] Step 3: Cross-referencing with Whisper transcript")
            cut_list = cross_reference_silence(
                silence_candidates,
                transcript_path,
                original_duration,
            )
        else:
            print(f"[{config.STEP_NAME}] Step 3: No transcript — confirming all FFmpeg candidates")
            from .schema import SilenceSource
            confirmed_cuts = []
            cumulative_shift = 0.0
            for candidate in silence_candidates:
                padded_start = max(0, candidate.start - config.SILENCE_CUT_PADDING)
                padded_end = candidate.end + config.SILENCE_CUT_PADDING if candidate.end > 0 else candidate.end
                shrink = config.SILENCE_CUT_SHRINK
                actual_start = max(0, padded_start + shrink)
                actual_end = min(padded_end - shrink, original_duration)
                actual_duration = actual_end - actual_start
                if actual_duration < 0.01:
                    continue
                confirmed_cuts.append(SilenceCut(
                    original_start=actual_start,
                    original_end=actual_end,
                    new_start=max(0, actual_start - cumulative_shift),
                    new_end=max(0, min(actual_end - cumulative_shift, actual_end - cumulative_shift)),
                    duration=actual_duration,
                    source=SilenceSource.FFMPEG,
                    cumulative_shift=cumulative_shift,
                ))
                cumulative_shift += actual_duration
            cut_list = SilenceCutList(
                total_segments_removed=len(confirmed_cuts),
                total_silence_removed=round(sum(c.duration for c in confirmed_cuts), 4),
                original_duration=original_duration,
                new_duration=round(original_duration - sum(c.duration for c in confirmed_cuts), 4),
                cuts=confirmed_cuts,
            )
        print(f"  Confirmed {cut_list.total_segments_removed} silence segments "
              f"({cut_list.total_silence_removed:.2f}s total silence)")
        print(f"  New duration: {cut_list.new_duration:.2f}s "
              f"(was {cut_list.original_duration:.2f}s)")

        # Step 4: Remove confirmed silences with hard cuts (SILC-02, SILC-03)
        print(f"[{config.STEP_NAME}] Step 4: Cutting silences from video")
        cut_silences(input_path, cut_list, output_path)
        print(f"  Output written to: {output_path}")

        # Step 5: Remap transcript timestamps (only if transcript was provided)
        if has_transcript:
            print(f"[{config.STEP_NAME}] Step 5: Remapping transcript timestamps")
            remapped_transcript_path = os.path.join(output_dir, "transcript.json")
            remap_transcript(transcript_path, cut_list, remapped_transcript_path)
            print(f"  Remapped transcript: {remapped_transcript_path}")

        # Step 6: Write silence-cuts.json artifact (D-07, D-08)
        print(f"[{config.STEP_NAME}] Step 6: Writing silence-cuts.json")
        cuts_path = os.path.join(output_dir, "silence-cuts.json")
        cuts_json = cut_list.model_dump_json(indent=2)
        with open(cuts_path, "w") as f:
            f.write(cuts_json)
        print(f"  Wrote silence-cuts.json: {len(cuts_json)} bytes "
              f"({cut_list.total_segments_removed} cuts)")

        # Step 7: Write manifest.json
        duration = time.time() - start_time
        out_files = [output_path, cuts_path]
        if has_transcript:
            out_files.append(remapped_transcript_path)
        _write_manifest(
            input_file=input_path,
            output_files=out_files,
            duration_seconds=duration,
            status="success",
            exit_code=0,
        )

        print(f"[{config.STEP_NAME}] Completed successfully in {duration:.2f}s")
        sys.exit(0)

    except Exception as e:
        error_msg = f"Silence cutting failed: {e}"
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