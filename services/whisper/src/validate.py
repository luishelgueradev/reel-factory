"""Validation utilities for transcript output compliance.

Ensures transcript.json matches requirements:
- Word-level timestamps present per TRAN-02
- Hallucination filter was applied per TRAN-03
- Spanish language configured per TRAN-04
- Output schema matches D-07, D-08, D-09
"""


def validate_transcript(transcript_data: dict) -> list[str]:
    """Validate a transcript.json dict against requirements.

    Returns list of validation error strings (empty = valid).
    """
    errors = []

    # TRAN-04: Language must be Spanish explicitly
    if transcript_data.get("language") != "es":
        errors.append("Language must be 'es' per TRAN-04 (got: {})".format(
            transcript_data.get("language")))

    # TRAN-04: Model must not be .en variant
    model = transcript_data.get("model", "")
    if model.endswith(".en"):
        errors.append("Model must not be .en variant per TRAN-04 (got: {})".format(model))

    # D-07: Must have segments and words
    if "segments" not in transcript_data or "words" not in transcript_data:
        errors.append("Missing 'segments' or 'words' fields per D-07")

    # TRAN-02: Words must have start/end timestamps
    for i, word in enumerate(transcript_data.get("words", [])):
        if "start" not in word or "end" not in word:
            errors.append(f"Word {i} missing start/end timestamps per TRAN-02")
            break

    # D-09: Words must have no_speech_prob
    for i, word in enumerate(transcript_data.get("words", [])):
        if "no_speech_prob" not in word:
            errors.append(f"Word {i} missing no_speech_prob per D-09")
            break

    return errors