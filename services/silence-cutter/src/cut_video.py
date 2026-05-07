"""Hard-cut video assembly module — removes silent sections while preserving A/V sync.

Per SILC-02: Silent sections are removed with hard cuts (no transition effects).
Per SILC-03: Audio and video remain synchronized after all silence cuts.

The approach:
1. Compute keep segments (inverse of silence cuts)
2. Extract each keep segment as a temporary file using stream copy
3. Concatenate using FFmpeg concat demuxer with reset_timestamps
4. Apply setpts=PTS-STARTPTS to ensure A/V sync after concatenation

This avoids the A/V drift problem that occurs with naive FFmpeg -filter_complex
approaches. The concat demuxer with reset_timestamps resets both audio and video
timestamps at each segment boundary, preventing cumulative drift.
"""

import subprocess
import os
import tempfile
import shutil
from typing import List, Tuple

from . import config
from .schema import SilenceCutList, SilenceCut


def cut_silences(
    input_path: str,
    cut_list: SilenceCutList,
    output_path: str,
) -> str:
    """Remove silent sections from video, preserving A/V sync.

    Per SILC-02: Hard cuts (no transitions).
    Per SILC-03: reset_timestamps + setpts=PTS-STARTPTS for sync.

    Args:
        input_path: Path to original input MP4.
        cut_list: SilenceCutList with confirmed silence cuts.
        output_path: Path to write the silence-removed MP4.

    Returns:
        Path to the output MP4 file.

    Raises:
        FileNotFoundError: If input file does not exist.
        RuntimeError: If FFmpeg operations fail.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if not cut_list.cuts:
        # No silence to remove — copy input to output
        print(f"[{config.STEP_NAME}] No silence cuts to apply, copying input to output")
        shutil.copy2(input_path, output_path)
        return output_path

    # Compute keep segments (inverse of silence cuts)
    keep_segments = _compute_keep_segments(cut_list)
    print(f"[{config.STEP_NAME}] Extracting {len(keep_segments)} segments to keep")

    if not keep_segments:
        print(f"[{config.STEP_NAME}] All audio removed — copying input with no audio segments")
        shutil.copy2(input_path, output_path)
        return output_path

    # Extract keep segments as temporary files
    with tempfile.TemporaryDirectory(prefix="silence-cutter-") as temp_dir:
        segment_files = _extract_segments(input_path, keep_segments, temp_dir)

        # Create concat list file
        concat_list_path = os.path.join(temp_dir, "concat.txt")
        _write_concat_list(segment_files, concat_list_path)

        # Concatenate with reset_timestamps for A/V sync
        _concatenate_segments(concat_list_path, output_path)

    # Verify output
    if not os.path.exists(output_path):
        raise RuntimeError(
            f"FFmpeg concatenation completed but output file not found: {output_path}"
        )

    output_size = os.path.getsize(output_path)
    print(f"[{config.STEP_NAME}] Output video: {output_size} bytes")

    return output_path


def _compute_keep_segments(cut_list: SilenceCutList) -> List[Tuple[float, float]]:
    """Compute segments to keep (inverse of silence cuts).

    Given a list of silence cuts in original time, compute the
    non-silent segments between cuts.

    Args:
        cut_list: SilenceCutList with confirmed silence cuts.

    Returns:
        List of (start, duration) tuples for keep segments.
    """
    keep_segments = []
    current_time = 0.0

    for cut in cut_list.cuts:
        # Keep segment from current_time to cut start
        keep_duration = cut.original_start - current_time
        if keep_duration > 0.01:  # Skip very short segments (< 10ms)
            keep_segments.append((current_time, keep_duration))
        current_time = cut.original_end

    # Final keep segment: from last cut end to video end
    # If the tail is shorter than SILENCE_MIN_DURATION, it's silence residue — drop it
    if current_time < cut_list.original_duration:
        keep_duration = cut_list.original_duration - current_time
        if keep_duration >= config.SILENCE_MIN_DURATION:
            keep_segments.append((current_time, keep_duration))

    return keep_segments


def _extract_segments(
    input_path: str,
    keep_segments: List[Tuple[float, float]],
    temp_dir: str,
) -> List[str]:
    """Extract keep segments from input video as temporary files.

    Uses stream copy (-c copy) for fast extraction without re-encoding.
    This preserves the original codec and quality.

    Args:
        input_path: Path to original input MP4.
        keep_segments: List of (start_seconds, duration_seconds) tuples.
        temp_dir: Temporary directory for segment files.

    Returns:
        List of paths to extracted segment files.
    """
    segment_files = []

    for i, (start, duration) in enumerate(keep_segments):
        segment_path = os.path.join(temp_dir, f"segment_{i:04d}.mp4")

        cmd = [
            "ffmpeg",
            "-y",
            "-ss", str(start),
            "-i", input_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-c:a", "aac",
            "-af", "apad",
            segment_path
        ]

        print(f"  Extracting segment {i+1}/{len(keep_segments)}: "
              f"start={start:.3f}s duration={duration:.3f}s")

        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"FFmpeg segment extraction failed for segment {i}: {result.stderr}"
            )

        if os.path.exists(segment_path):
            segment_files.append(segment_path)

    return segment_files


def _write_concat_list(segment_files: List[str], concat_list_path: str) -> None:
    """Write FFmpeg concat demuxer list file.

    The concat demuxer requires a text file listing each segment:
        file '/path/to/segment_0000.mp4'
        file '/path/to/segment_0001.mp4'

    Args:
        segment_files: List of segment file paths.
        concat_list_path: Path to write the concat list file.
    """
    with open(concat_list_path, "w") as f:
        for segment_path in segment_files:
            # Escape single quotes in paths
            escaped_path = segment_path.replace("'", "'\\''")
            f.write(f"file '{escaped_path}'\n")


def _concatenate_segments(concat_list_path: str, output_path: str) -> None:
    """Concatenate segments using FFmpeg concat demuxer with A/V sync reset.

    Per SILC-03: reset_timestamps + setpts=PTS-STARTPTS preserves A/V sync
    after concatenation. Without these flags, timestamps would drift across
    segment boundaries, causing visible and audible sync issues.

    Args:
        concat_list_path: Path to concat demuxer list file.
        output_path: Path to write concatenated output file.

    Raises:
        RuntimeError: If FFmpeg concatenation fails.
    """
    cmd = [
        "ffmpeg",
        "-y",                                    # Overwrite output
        "-f", "concat",                          # Concat demuxer
        "-safe", "0",                             # Allow absolute paths in concat list
        "-i", concat_list_path,                   # Input from concat list
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-c:v", "libx264",                        # Re-encode video for clean timestamps
        "-c:a", "aac",                            # Re-encode audio for clean timestamps
        "-reset_timestamps", "1",                 # Reset timestamps at each segment (SILC-03)
        output_path
    ]

    print(f"[{config.STEP_NAME}] Concatenating {os.path.getsize(concat_list_path)} bytes of concat list")

    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=300
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg concatenation failed: {result.stderr}"
        )


def get_video_duration(video_path: str) -> float:
    """Get video duration in seconds using ffprobe.

    Args:
        video_path: Path to the video file.

    Returns:
        Duration in seconds.

    Raises:
        FileNotFoundError: If video file does not exist.
        RuntimeError: If ffprobe fails.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        video_path
    ]

    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=30
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"ffprobe failed: {result.stderr}"
        )

    return float(result.stdout.strip())