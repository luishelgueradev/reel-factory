"""Silence-cuts.json output schema — Pydantic models for the Silence Cutter step output.

Per D-07: silence-cuts.json uses a detailed schema with cumulative time shift.
Each entry includes: original_start, original_end, new_start, new_end, duration,
source (ffmpeg/whisper/both), and cumulative_shift.

Per D-08: Output files are output.mp4 (silence-removed video) and
silence-cuts.json (cut list artifact), plus manifest.json.

The cumulative_shift field enables Phase 8 SRT timestamp remapping:
    new_time = original_time - cumulative_shift_at_point
"""

from pydantic import BaseModel
from typing import List
from enum import Enum


class SilenceSource(str, Enum):
    """Source of the silence detection per D-01 intersection approach.

    BOTH = confirmed by both FFmpeg and Whisper (the standard case)
    FFMPEG = FFmpeg-only detection (edge case, should be rare)
    WHISPER = Whisper-only detection (should not happen — FFmpeg drives)
    """
    BOTH = "both"
    FFMPEG = "ffmpeg"
    WHISPER = "whisper"


class SilenceCut(BaseModel):
    """A single silence removal entry per D-07.

    This is the atomic unit that downstream phases consume:
    - Phase 4 (9:16 output): uses new_start/new_end for timeline alignment
    - Phase 5 (Remotion subtitles): uses cumulative_shift for caption timing
    - Phase 8 (SRT export): uses cumulative_shift for timestamp remapping

    Attributes:
        original_start: Start time of silence in the original video (seconds).
        original_end: End time of silence in the original video (seconds).
        new_start: Start time of this segment in the silence-removed video (seconds).
        new_end: End time of this segment in the silence-removed video (seconds).
        duration: Duration of the removed silence segment (seconds).
        source: Which detector(s) confirmed this silence per D-01.
        cumulative_shift: Total time removed up to this cut point (seconds).
            Phase 8 uses this: new_ts = original_ts - cumulative_shift
    """
    original_start: float
    original_end: float
    new_start: float
    new_end: float
    duration: float
    source: SilenceSource
    cumulative_shift: float


class SilenceCutList(BaseModel):
    """Top-level silence cuts output per D-07, D-08.

    This is the single artifact (other than output.mp4) that feeds:
    - Phase 5 (subtitle timestamp remapping via cumulative_shift)
    - Phase 8 (SRT/VTT timestamp remapping via cumulative_shift)

    Attributes:
        total_segments_removed: Count of silence segments removed.
        total_silence_removed: Total duration of silence removed (seconds).
        original_duration: Duration of the original input video (seconds).
        new_duration: Duration of the silence-removed video (seconds).
        cuts: Ordered list of silence cut entries.
    """
    total_segments_removed: int
    total_silence_removed: float
    original_duration: float
    new_duration: float
    cuts: List[SilenceCut]