"""Silence-cuts validation — checks output against SILC requirements and D-XX decisions.

Per the whisper/validate.py pattern: validate functions return a list of
error strings referencing specific requirement IDs (SILC-XX) and decision
IDs (D-XX) for traceability.
"""

from typing import List


def validate_silence_cuts(cut_list_data: dict) -> List[str]:
    """Validate silence-cuts.json against SILC requirements.

    Args:
        cut_list_data: Parsed silence-cuts.json as a dict.

    Returns:
        List of error strings referencing SILC-XX/D-XX requirements.
        Empty list means all checks passed.
    """
    errors = []

    # SILC-04: Cut list is exported as inspectable JSON artifact
    if "cuts" not in cut_list_data:
        errors.append("SILC-04: Missing 'cuts' field in silence-cuts.json")
        return errors  # Can't continue without cuts

    if not isinstance(cut_list_data["cuts"], list):
        errors.append("SILC-04: 'cuts' must be a list")
        return errors

    # Check summary fields (D-07)
    for field in ["total_segments_removed", "total_silence_removed",
                   "original_duration", "new_duration"]:
        if field not in cut_list_data:
            errors.append(f"D-07: Missing '{field}' in silence-cuts.json")

    # Track cumulative shift for monotonicity check
    prev_cumulative_shift = None

    # Validate each cut entry (D-07 detailed schema)
    for i, cut in enumerate(cut_list_data["cuts"]):
        # Required fields per D-07
        required_fields = [
            "original_start", "original_end",
            "new_start", "new_end",
            "duration", "source", "cumulative_shift"
        ]
        for field in required_fields:
            if field not in cut:
                errors.append(
                    f"D-07: Cut {i} missing '{field}' field"
                )

        # Validate source is one of the enum values (D-01)
        if "source" in cut:
            valid_sources = ["both", "ffmpeg", "whisper"]
            if cut["source"] not in valid_sources:
                errors.append(
                    f"D-01: Cut {i} has invalid source '{cut['source']}', "
                    f"must be one of {valid_sources}"
                )

        # Validate cumulative_shift increases monotonically
        if "cumulative_shift" in cut:
            current_shift = cut["cumulative_shift"]
            if prev_cumulative_shift is not None:
                if current_shift < prev_cumulative_shift:
                    errors.append(
                        f"D-07: Cut {i} cumulative_shift ({current_shift}) "
                        f"decreases from previous ({prev_cumulative_shift})"
                    )
            prev_cumulative_shift = current_shift

        # SILC-01: Confirmed silences should have source "both" (D-01 intersection)
        # Non-BOTH sources are valid but indicate FFmpeg-only detection
        # This is informational — not a hard error

    # Validate total counts match cuts list
    if "total_segments_removed" in cut_list_data:
        expected = len(cut_list_data["cuts"])
        actual = cut_list_data["total_segments_removed"]
        if actual != expected:
            errors.append(
                f"SILC-04: total_segments_removed ({actual}) doesn't match "
                f"cuts list length ({expected})"
            )

    # Validate duration consistency
    if "total_silence_removed" in cut_list_data and cut_list_data["cuts"]:
        total_from_cuts = sum(
            c.get("duration", 0) for c in cut_list_data["cuts"]
        )
        reported = cut_list_data["total_silence_removed"]
        if abs(total_from_cuts - reported) > 0.01:
            errors.append(
                f"SILC-04: total_silence_removed ({reported}) doesn't match "
                f"sum of cut durations ({total_from_cuts:.4f})"
            )

    # Validate new_duration consistency (SILC-03: sync depends on correct durations)
    if all(f in cut_list_data for f in ["original_duration", "new_duration", "total_silence_removed"]):
        expected_new = cut_list_data["original_duration"] - cut_list_data["total_silence_removed"]
        actual_new = cut_list_data["new_duration"]
        if abs(expected_new - actual_new) > 0.01:
            errors.append(
                f"SILC-03: new_duration ({actual_new}) doesn't match "
                f"original_duration - total_silence_removed ({expected_new:.4f})"
            )

    return errors


def validate_cross_reference_logic(
    silence_candidates: list,
    words: list,
    confirmed_source: str,
) -> List[str]:
    """Validate cross-reference logic outputs per D-01, D-03.

    Args:
        silence_candidates: List of FFmpeg silence candidate dicts.
        words: List of word dicts with no_speech_prob.
        confirmed_source: Source field from the resulting SilenceCut.

    Returns:
        List of error strings.
    """
    errors = []

    # D-03: ANY word with no_speech_prob > threshold should confirm
    threshold = 0.6  # config.NO_SPEECH_THRESHOLD
    has_confirming_word = any(
        w.get("no_speech_prob", 0) > threshold for w in words
    )

    if has_confirming_word and confirmed_source != "both":
        errors.append(
            "D-03: Silence not confirmed despite word with no_speech_prob > "
            f"{threshold} overlapping the candidate"
        )

    if not has_confirming_word and confirmed_source == "both":
        errors.append(
            "D-03: Silence confirmed as 'both' but no word has "
            f"no_speech_prob > {threshold}"
        )

    return errors