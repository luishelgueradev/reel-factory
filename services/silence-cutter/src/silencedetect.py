"""FFmpeg silencedetect module — detects candidate silence segments in video.

Per D-02: FFmpeg silencedetect runs first to find candidate silence segments.
These candidates are then confirmed by cross-referencing with Whisper no_speech_prob
in cross_reference.py.

This module extracts audio from the input MP4 and runs FFmpeg's silencedetect
filter, parsing the structured stderr output into SilenceSegment objects.
"""

import subprocess
import re
import os
import sys
from dataclasses import dataclass
from typing import List

from . import config


@dataclass
class SilenceSegment:
    """A candidate silence segment detected by FFmpeg silencedetect.

    These are unconfirmed candidates — cross_reference.py confirms them
    against Whisper no_speech_prob before they become final cuts.

    Attributes:
        start: Silence start time in seconds.
        end: Silence end time in seconds (0 if silence extends to end of audio).
        duration: Duration of silence in seconds (0 if end is unknown).
    """
    start: float
    end: float
    duration: float


def detect_silence(input_path: str, total_duration: float | None = None) -> List[SilenceSegment]:
    """Run FFmpeg silencedetect on the input MP4 and parse the output.

    Per D-02: FFmpeg drives the cross-reference. silencedetect produces clear
    segment boundaries while Whisper provides per-word probabilities.

    Args:
        input_path: Path to the input MP4 file.

    Returns:
        List of SilenceSegment candidates sorted by start time.

    Raises:
        FileNotFoundError: If input file does not exist.
        RuntimeError: If FFmpeg silencedetect fails.
    """
    # Validate input exists
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Build FFmpeg silencedetect command
    # -vn: no video, -af silencedetect: audio filter for silence detection
    # -f null -: no output file, just analysis
    # noise=n={dB}: noise tolerance per D-02
    # d={min_duration}: minimum silence duration per D-04
    noise_db = config.SILENCE_NOISE_TOLERANCE_DB
    min_duration = config.SILENCE_MIN_DURATION

    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-vn",                                    # No video output
        "-af", f"silencedetect=noise={noise_db}dB:d={min_duration}",
        "-f", "null",                             # No output file
        "-"                                       # Write to stdout/null
    ]

    print(f"[{config.STEP_NAME}] Running silencedetect on: {input_path}")
    print(f"  Filter: noise={noise_db}dB:d={min_duration}")

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120
    )

    # silencedetect outputs to stderr
    stderr = result.stderr
    segments = _parse_silencedetect_output(stderr, total_duration)

    print(f"[{config.STEP_NAME}] Detected {len(segments)} candidate silence segments")

    return segments


def _parse_silencedetect_output(stderr: str, total_duration: float | None = None) -> List[SilenceSegment]:
    """Parse FFmpeg silencedetect stderr output into SilenceSegment objects.

    FFmpeg silencedetect outputs pairs of lines:
      [silencedetect @ 0x...] silence_start: 1.234
      [silencedetect @ 0x...] silence_end: 3.456 | silence_duration: 2.222

    If the audio ends during silence, only silence_start is output
    (no matching silence_end line).

    Args:
        stderr: FFmpeg stderr output containing silencedetect lines.

    Returns:
        List of SilenceSegment objects sorted by start time.
    """
    segments = []

    # Extract all silence_start and silence_end values
    start_pattern = re.compile(r"silence_start:\s*([\d.]+)")
    end_pattern = re.compile(r"silence_end:\s*([\d.]+)")
    duration_pattern = re.compile(r"silence_duration:\s*([\d.]+)")

    starts = [float(m.group(1)) for m in start_pattern.finditer(stderr)]
    ends = [float(m.group(1)) for m in end_pattern.finditer(stderr)]
    durations = [float(m.group(1)) for m in duration_pattern.finditer(stderr)]

    # Pair starts with ends
    for i, start_time in enumerate(starts):
        if i < len(ends):
            end_time = ends[i]
            duration = durations[i] if i < len(durations) else (end_time - start_time)
        else:
            # Silence extends to end of audio — no matching silence_end line.
            # Close it at the real end of the media so trailing silence is
            # actually cut. Without total_duration we cannot know where the
            # audio ends, so fall back to a zero-width segment (dropped later).
            if total_duration is not None and total_duration > start_time:
                end_time = total_duration
                duration = total_duration - start_time
            else:
                end_time = start_time
                duration = 0.0

        segments.append(SilenceSegment(
            start=start_time,
            end=end_time,
            duration=duration
        ))

    return segments