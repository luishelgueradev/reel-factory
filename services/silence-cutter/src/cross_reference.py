"""Cross-reference engine — confirms FFmpeg silence candidates against Whisper data.

FFmpeg defines the silence BOUNDARIES (where volume drops below threshold).
Whisper confirms whether the silence is REAL (no speech content vs just low volume).

Confirmation logic:
1. No Whisper words in the region → pure silence → confirmed as BOTH.
2. Whisper no_speech_prob high for overlapping words → Whisper agrees it's silence.
3. Words at edges with low no_speech_prob → FFmpeg boundaries still win.
   Whisper timestamps are imprecise (words get stretched into silence).
   If FFmpeg detected silence here, we trust it — but mark source as FFMPEG.
4. The majority of the silence region is covered by dense speech → not silence,
   reject. This prevents cutting mid-sentence pauses where someone is speaking.

The key principle: FFmpeg's volume-based detection is more reliable for CUT BOUNDARIES.
Whisper is used to REJECT false positives (e.g., quiet speech that isn't silence),
not to trim the cut region.
"""

import json
import os
from typing import List, Tuple

from . import config
from .silencedetect import SilenceSegment
from .schema import SilenceCut, SilenceCutList, SilenceSource


def cross_reference_silence(
    silence_candidates: List[SilenceSegment],
    transcript_path: str,
    original_duration: float,
) -> SilenceCutList:
    """Cross-reference FFmpeg silence candidates with Whisper data.

    Args:
        silence_candidates: FFmpeg silencedetect candidates.
        transcript_path: Path to transcript.json from Whisper step.
        original_duration: Duration of the original video in seconds.

    Returns:
        SilenceCutList with confirmed cuts and cumulative_shift values.
    """
    transcript_data = _load_transcript(transcript_path)
    words = _extract_words(transcript_data)

    confirmed_cuts = []
    cumulative_shift = 0.0

    for i, candidate in enumerate(silence_candidates):
        padded_start = max(0, candidate.start - config.SILENCE_CUT_PADDING)
        padded_end = candidate.end + config.SILENCE_CUT_PADDING if candidate.end > 0 else candidate.end

        result = _check_silence(padded_start, padded_end, words, original_duration)

        if result is None:
            continue

        cut_start, cut_end, source = result

        shrink = config.SILENCE_CUT_SHRINK
        actual_start = max(0, cut_start + shrink)
        actual_end = min(cut_end - shrink, original_duration)
        actual_duration = actual_end - actual_start

        if actual_duration < 0.01:
            continue

        confirmed_cuts.append(SilenceCut(
            original_start=actual_start,
            original_end=actual_end,
            new_start=max(0, actual_start - cumulative_shift),
            new_end=max(0, min(actual_end - cumulative_shift, actual_end - cumulative_shift)),
            duration=actual_duration,
            source=source,
            cumulative_shift=cumulative_shift,
        ))

        cumulative_shift += actual_duration

    # If the tail after the last cut is shorter than SILENCE_MIN_DURATION,
    # extend the last cut to eat it — avoids a dangling fragment.
    if confirmed_cuts:
        last_cut = confirmed_cuts[-1]
        tail = original_duration - last_cut.original_end
        if 0 < tail < config.SILENCE_MIN_DURATION:
            extra = tail
            confirmed_cuts[-1] = SilenceCut(
                original_start=last_cut.original_start,
                original_end=last_cut.original_end + extra,
                new_start=last_cut.new_start,
                new_end=last_cut.new_end + extra,
                duration=last_cut.duration + extra,
                source=last_cut.source,
                cumulative_shift=last_cut.cumulative_shift,
            )

    total_silence_removed = sum(cut.duration for cut in confirmed_cuts)
    new_duration = original_duration - total_silence_removed

    return SilenceCutList(
        total_segments_removed=len(confirmed_cuts),
        total_silence_removed=round(total_silence_removed, 4),
        original_duration=original_duration,
        new_duration=round(new_duration, 4),
        cuts=confirmed_cuts,
    )


def _check_silence(
    silence_start: float,
    silence_end: float,
    words: List[dict],
    original_duration: float,
) -> tuple or None:
    """Check if a silence candidate is confirmed.

    Returns (cut_start, cut_end, source) or None if rejected.
    """
    overlapping = []
    for word in words:
        w_start = word.get("start", 0)
        w_end = word.get("end", 0)
        if w_end > silence_start and w_start < silence_end:
            overlapping.append((w_start, w_end, word.get("no_speech_prob", 0)))

    # Case 1: No words at all → pure silence, fully confirmed
    if not overlapping:
        return (silence_start, silence_end, SilenceSource.BOTH)

    # Case 2: High no_speech_prob → Whisper agrees it's silence
    for w_start, w_end, nsp in overlapping:
        if nsp > config.NO_SPEECH_THRESHOLD:
            return (silence_start, silence_end, SilenceSource.BOTH)

    # Case 3: Words overlap — check if this is real speech or just
    # Whisper timestamp inaccuracy.
    # Whisper often stretches the last word of a segment into the silence.
    # We check: does the speech DENSITY justify rejecting the silence?
    # If words cover less than 50% of the silence region, it's mostly silent.
    speech_duration = sum(
        min(w_end, silence_end) - max(w_start, silence_start)
        for w_start, w_end, nsp in overlapping
        if w_end > silence_start and w_start < silence_end
    )
    silence_duration = silence_end - silence_start
    speech_ratio = speech_duration / silence_duration if silence_duration > 0 else 1.0

    if speech_ratio > 0.5:
        # More than half the region is covered by speech → likely a
        # mid-sentence pause, not silence. Reject.
        return None

    # Less than half is speech → the speech is just edge overlap.
    # FFmpeg's boundary is more reliable → trust it.
    return (silence_start, silence_end, SilenceSource.FFMPEG)


def _load_transcript(transcript_path: str) -> dict:
    """Load and parse transcript.json from Whisper step."""
    if not os.path.exists(transcript_path):
        raise FileNotFoundError(f"Transcript file not found: {transcript_path}")
    with open(transcript_path, "r") as f:
        return json.load(f)


def _extract_words(transcript_data: dict) -> List[dict]:
    """Extract the flat word list from transcript.json."""
    if "words" in transcript_data and transcript_data["words"]:
        return transcript_data["words"]
    words = []
    for segment in transcript_data.get("segments", []):
        words.extend(segment.get("words", []))
    return words