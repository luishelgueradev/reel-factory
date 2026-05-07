"""Remap transcript timestamps to match silence-removed video timeline.

After silences are cut from the video, the original Whisper timestamps no longer
match. This module uses the cumulative_shift from each SilenceCut to remap every
word/segment start and end time from the original timeline to the new timeline.

Formula per D-07 schema: new_time = original_time - cumulative_shift_at_point

Words that fall entirely within a removed silence segment are discarded.
"""

import json
import os
from typing import List

from .schema import SilenceCutList


def remap_transcript(
    transcript_path: str,
    cut_list: SilenceCutList,
    output_path: str,
) -> str:
    """Remap transcript.json timestamps using silence cuts.

    Args:
        transcript_path: Path to original transcript.json from Whisper step.
        cut_list: SilenceCutList with confirmed cuts and cumulative_shift values.
        output_path: Path to write the remapped transcript.json.

    Returns:
        Path to the remapped transcript file.
    """
    with open(transcript_path, "r") as f:
        transcript = json.load(f)

    if not cut_list.cuts:
        with open(output_path, "w") as f:
            json.dump(transcript, f, indent=2, ensure_ascii=False)
        return output_path

    old_words = transcript.get("words", [])
    new_words = _remap_words(old_words, cut_list.cuts)

    old_segments = transcript.get("segments", [])
    new_segments = _remap_segments(old_segments, cut_list.cuts)

    transcript["words"] = new_words
    transcript["segments"] = new_segments
    transcript["duration"] = cut_list.new_duration

    with open(output_path, "w") as f:
        json.dump(transcript, f, indent=2, ensure_ascii=False)

    return output_path


def _find_shift_at_time(time: float, cuts: List) -> float:
    """Find the cumulative shift at a given time in the original timeline.

    Walks through the cuts. If time falls AFTER a cut's original_end,
    that cut's duration is part of the cumulative shift.
    """
    shift = 0.0
    for cut in cuts:
        if time >= cut.original_end:
            shift += cut.duration
        elif time > cut.original_start:
            shift += (time - cut.original_start)
            break
        else:
            break
    return shift


def _is_in_silence(start: float, end: float, cuts: List) -> bool:
    """Check if a word/segment falls entirely within a removed silence region."""
    for cut in cuts:
        if start >= cut.original_start and end <= cut.original_end:
            return True
    return False


def _remap_words(words: List[dict], cuts: List) -> List[dict]:
    """Remap word timestamps and discard words that were in cut regions."""
    remapped = []
    for word in words:
        start = word.get("start", 0)
        end = word.get("end", 0)

        if _is_in_silence(start, end, cuts):
            continue

        shift_start = _find_shift_at_time(start, cuts)
        shift_end = _find_shift_at_time(end, cuts)

        new_word = dict(word)
        new_word["start"] = round(start - shift_start, 3)
        new_word["end"] = round(end - shift_end, 3)
        remapped.append(new_word)

    return remapped


def _remap_segments(segments: List[dict], cuts: List) -> List[dict]:
    """Remap segment timestamps, filtering out segments in silence regions."""
    remapped = []
    for i, seg in enumerate(segments):
        start = seg.get("start", 0)
        end = seg.get("end", 0)

        if _is_in_silence(start, end, cuts):
            continue

        shift_start = _find_shift_at_time(start, cuts)
        shift_end = _find_shift_at_time(end, cuts)

        new_seg = dict(seg)
        new_seg["id"] = len(remapped)
        new_seg["start"] = round(start - shift_start, 3)
        new_seg["end"] = round(end - shift_end, 3)

        if "words" in seg:
            new_seg["words"] = _remap_words(seg["words"], cuts)

        remapped.append(new_seg)

    return remapped