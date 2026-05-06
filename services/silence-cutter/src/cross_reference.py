"""Cross-reference engine — confirms FFmpeg silence candidates against Whisper data.

Per D-01: Intersection approach — a silence segment is confirmed as real only
when BOTH FFmpeg silencedetect AND Whisper no_speech_prob agree.

Per D-02: FFmpeg drives the cross-reference. FFmpeg produces candidate segments,
then Whisper no_speech_prob confirms each candidate.

Per D-03: Whisper confirmation uses an ANY-word threshold. If ANY word overlapping
a candidate FFmpeg silence segment has no_speech_prob > NO_SPEECH_THRESHOLD (0.6),
the silence is confirmed.
"""

import json
import os
from typing import List, Optional

from . import config
from .silencedetect import SilenceSegment
from .schema import SilenceCut, SilenceCutList, SilenceSource


# Import Whisper transcript types for cross-referencing.
# We import the schema definition — the transcript.json file is read at runtime.
try:
    # Import from the installed package if available (same container)
    from services.whisper.src.schema import Transcript, TranscriptWord
except ImportError:
    # Fall back: define types inline for standalone parsing
    # In Docker, transcript.json is read from TRANSCRIPT_PATH env var
    pass


def cross_reference_silence(
    silence_candidates: List[SilenceSegment],
    transcript_path: str,
    original_duration: float,
) -> SilenceCutList:
    """Cross-reference FFmpeg silence candidates with Whisper no_speech data.

    Per D-01: Only segments confirmed by BOTH sources are kept.
    Per D-02: FFmpeg candidates are checked against Whisper data.
    Per D-03: ANY word overlapping a candidate with no_speech_prob > threshold confirms.

    Args:
        silence_candidates: FFmpeg silencedetect candidates.
        transcript_path: Path to transcript.json from Whisper step.
        original_duration: Duration of the original video in seconds.

    Returns:
        SilenceCutList with confirmed cuts and cumulative_shift values.
    """
    # Load transcript.json
    transcript_data = _load_transcript(transcript_path)

    # Extract words with no_speech_prob
    words = _extract_words(transcript_data)

    confirmed_cuts = []
    cumulative_shift = 0.0

    for candidate in silence_candidates:
        # Apply padding per D-06: expand cut region by 50ms each side
        padded_start = max(0, candidate.start - config.SILENCE_CUT_PADDING)
        padded_end = candidate.end + config.SILENCE_CUT_PADDING if candidate.end > 0 else candidate.end

        # Check if any word overlaps this candidate with high no_speech_prob
        source = _check_whisper_confirmation(
            padded_start, padded_end, words
        )

        if source == SilenceSource.BOTH:
            # Confirmed silence — compute cut positions with padding
            new_start = padded_start - cumulative_shift
            new_end = padded_end - cumulative_shift

            # Handle edge case: silence extends to end of file
            actual_end = padded_end if padded_end > 0 else original_duration
            actual_duration = actual_end - padded_start

            confirmed_cuts.append(SilenceCut(
                original_start=padded_start,
                original_end=actual_end,
                new_start=max(0, new_start),
                new_end=max(0, new_end),
                duration=actual_duration,
                source=source,
                cumulative_shift=cumulative_shift,
            ))

            # Update cumulative shift
            cumulative_shift += actual_duration

    # Build cut list
    total_silence_removed = sum(cut.duration for cut in confirmed_cuts)
    new_duration = original_duration - total_silence_removed

    return SilenceCutList(
        total_segments_removed=len(confirmed_cuts),
        total_silence_removed=round(total_silence_removed, 4),
        original_duration=original_duration,
        new_duration=round(new_duration, 4),
        cuts=confirmed_cuts,
    )


def _check_whisper_confirmation(
    silence_start: float,
    silence_end: float,
    words: List[dict],
) -> SilenceSource:
    """Check if Whisper confirms a silence candidate per D-03.

    Per D-03: If ANY word overlapping the candidate silence segment has
    no_speech_prob > NO_SPEECH_THRESHOLD, the silence is confirmed.

    Args:
        silence_start: Start time of candidate silence.
        silence_end: End time of candidate silence (0 if unknown).
        words: List of word dicts with start, end, no_speech_prob fields.

    Returns:
        SilenceSource.BOTH if Whisper confirms, SilenceSource.FFMPEG otherwise.
    """
    for word in words:
        word_start = word.get("start", 0)
        word_end = word.get("end", 0)
        no_speech_prob = word.get("no_speech_prob", 0)

        # Check if this word overlaps with the silence candidate
        overlap = _times_overlap(
            word_start, word_end,
            silence_start, silence_end
        )

        if overlap and no_speech_prob > config.NO_SPEECH_THRESHOLD:
            return SilenceSource.BOTH

    # No Whisper confirmation — FFmpeg-only detection
    return SilenceSource.FFMPEG


def _times_overlap(
    start1: float, end1: float,
    start2: float, end2: float
) -> bool:
    """Check if two time ranges overlap.

    Handles edge case where end1 or end2 is 0 (unknown end time).
    """
    if end1 <= 0 or end2 <= 0:
        # If one range has unknown end, check if starts overlap
        return start1 <= start2 if end2 <= 0 else start2 <= start1
    return start1 < end2 and start2 < end1


def _load_transcript(transcript_path: str) -> dict:
    """Load and parse transcript.json from Whisper step.

    Args:
        transcript_path: Path to the transcript.json file.

    Returns:
        Parsed JSON as a dict.

    Raises:
        FileNotFoundError: If transcript.json does not exist.
    """
    if not os.path.exists(transcript_path):
        raise FileNotFoundError(
            f"Transcript file not found: {transcript_path}"
        )

    with open(transcript_path, "r") as f:
        return json.load(f)


def _extract_words(transcript_data: dict) -> List[dict]:
    """Extract the flat word list from transcript.json.

    The Whisper transcript.json has both segments[*].words and a flat
    words array (per D-07 in Phase 2 context). We prefer the flat words
    list for simpler iteration.

    Args:
        transcript_data: Parsed transcript.json dict.

    Returns:
        List of word dicts with start, end, no_speech_prob fields.
    """
    # Prefer flat words list (top-level "words" key)
    if "words" in transcript_data and transcript_data["words"]:
        return transcript_data["words"]

    # Fall back to extracting from segments
    words = []
    for segment in transcript_data.get("segments", []):
        words.extend(segment.get("words", []))

    return words