"""Hallucination filter — removes phantom text from Whisper transcription output.

Per D-11 and TRAN-03: Hallucinated text is filtered out so no phantom words
appear in silent sections. Whisper commonly generates repetitive text, low-confidence
segments, and text with high no_speech probability during silence.

Per PITFALLS.md Pitfall 1: "Always set hallucination_silence_threshold (~2.0 seconds)
and no_speech_threshold (0.6). After transcription, post-process segments: flag any
segment where the text repeats or the confidence (logprob) is unusually low."

This module applies five post-processing filters:
1. Repetition filter — removes segments with >80% word overlap with previous segment
2. Low confidence filter — removes segments with average word confidence < 0.3
3. High no_speech filter — removes words with no_speech_prob > threshold (0.6 per D-11)
4. Empty segment filter — removes segments with empty/whitespace text
5. Duration anomaly filter — removes segments >30s with <5 words (stretched silence)
"""

from . import config
from .schema import Transcript, TranscriptWord, TranscriptSegment


def filter_hallucinations(transcript: Transcript) -> Transcript:
    """Apply hallucination filters to a raw transcript.

    Takes a Transcript object and returns a new filtered Transcript with
    hallucinated content removed. The original Transcript is NOT modified.

    Filtering pipeline (applied sequentially):
    1. Empty segment filter — remove segments with empty text
    2. Repetition filter — remove segments repeating previous segment text
    3. Low confidence filter — remove segments with avg confidence < 0.3
    4. Duration anomaly filter — remove segments >30s with <5 words
    5. High no_speech filter — remove words with no_speech_prob > threshold

    After filtering, segment IDs are re-sequenced (0, 1, 2, ...) to avoid gaps.

    Args:
        transcript: Raw Transcript from Whisper transcription.

    Returns:
        Filtered Transcript with hallucinated content removed.
    """
    original_count = len(transcript.segments)
    original_word_count = len(transcript.words)

    segments = list(transcript.segments)

    # Step 1: Empty segment filter — remove segments with empty/whitespace text
    segments = _filter_empty_segments(segments)
    removed_empty = original_count - len(segments)

    # Step 2: Repetition filter — remove segments repeating previous segment
    segments = _filter_repetition(segments)

    # Step 3: Low confidence filter — remove segments with avg confidence < 0.3
    segments = _filter_low_confidence(segments)

    # Step 4: Duration anomaly filter — remove segments >30s with <5 words
    segments = _filter_duration_anomaly(segments)

    # Step 5: High no_speech filter — remove words with no_speech_prob > threshold
    # Applied per-word within remaining segments. This can cause segments to lose
    # words but the segment is preserved if it still has content.
    segments, words = _filter_high_no_speech(segments)

    # Re-sequence segment IDs to avoid gaps (0, 1, 2, ...)
    segments = _resequence_segments(segments)

    final_count = len(segments)
    final_word_count = len(words)

    print(f"[hallucination_filter] Filters applied:")
    print(f"  Empty segments removed: {removed_empty}")
    print(f"  Total segments: {original_count} → {final_count} (removed {original_count - final_count})")
    print(f"  Total words: {original_word_count} → {final_word_count} (removed {original_word_count - final_word_count})")

    return Transcript(
        language=transcript.language,
        model=transcript.model,
        segments=segments,
        words=words,
        duration=transcript.duration,
    )


def _filter_empty_segments(segments: list[TranscriptSegment]) -> list[TranscriptSegment]:
    """Remove segments where text is empty or contains only whitespace.

    Whisper can produce empty segments during silence or at the start/end
    of audio files. These contribute nothing and should be removed.
    """
    return [s for s in segments if s.text.strip()]


def _filter_repetition(segments: list[TranscriptSegment]) -> list[TranscriptSegment]:
    """Remove segments that repeat the previous segment's text.

    Whisper commonly generates repetitive text during silence:
    "Thank you. Thank you. Thank you." — each is a separate segment
    with identical or near-identical text.

    A segment is marked as hallucinated if:
    - It exactly matches the previous segment's text, OR
    - It has >80% word overlap with the previous segment (near-duplicate)

    The first occurrence is preserved; subsequent repetitions are removed.
    """
    if not segments:
        return segments

    filtered = [segments[0]]

    for segment in segments[1:]:
        prev_text = filtered[-1].text.strip().lower()
        curr_text = segment.text.strip().lower()

        # Exact match — hallucination
        if curr_text == prev_text:
            continue

        # Near-duplicate: >80% word overlap
        prev_words = set(prev_text.split())
        curr_words = set(curr_text.split())

        if prev_words and curr_words:
            overlap = len(prev_words & curr_words)
            union = len(prev_words | curr_words)

            if union > 0 and overlap / union > 0.8:
                continue  # Near-duplicate — likely hallucination

        filtered.append(segment)

    return filtered


def _filter_low_confidence(segments: list[TranscriptSegment]) -> list[TranscriptSegment]:
    """Remove segments with average word confidence below 0.3.

    Segments with very low confidence are likely Whisper inventing
    text during silence. The threshold of 0.3 is conservative —
    legitimate speech typically has confidence > 0.5.
    """
    MIN_CONFIDENCE = 0.3
    filtered = []

    for segment in segments:
        if not segment.words:
            # Segments without word data keep their text-based confidence
            # (no words to evaluate — keep the segment)
            filtered.append(segment)
            continue

        avg_confidence = sum(w.confidence for w in segment.words) / len(segment.words)

        if avg_confidence >= MIN_CONFIDENCE:
            filtered.append(segment)
        else:
            print(f"  [low_confidence] Removed segment {segment.id}: "
                  f"avg_confidence={avg_confidence:.3f} < {MIN_CONFIDENCE}")

    return filtered


def _filter_duration_anomaly(segments: list[TranscriptSegment]) -> list[TranscriptSegment]:
    """Remove segments with duration >30s and <5 words.

    Whisper stretches hallucinated text over long silent gaps.
    A segment covering >30 seconds with fewer than 5 words is
    almost certainly hallucination — real speech is much denser.
    """
    MAX_DURATION = 30.0  # seconds
    MIN_WORDS = 5
    filtered = []

    for segment in segments:
        duration = segment.end - segment.start
        word_count = len(segment.words)

        if duration > MAX_DURATION and word_count < MIN_WORDS:
            print(f"  [duration_anomaly] Removed segment {segment.id}: "
                  f"duration={duration:.1f}s with {word_count} words")
            continue

        filtered.append(segment)

    return filtered


def _filter_high_no_speech(
    segments: list[TranscriptSegment],
) -> tuple[list[TranscriptSegment], list[TranscriptWord]]:
    """Remove words with no_speech_prob above the threshold (0.6 per D-11).

    Words with high no_speech_prob were likely detected during silence
    and should be filtered out per TRAN-03. This removes individual words
    rather than entire segments — a segment may have both real speech words
    and silence-inserted words.

    After filtering words, segments with no remaining words are dropped
    entirely, and segment text/timing is recomputed from the remaining words.

    Returns:
        Tuple of (filtered segments, flat word list) for easy Transcript construction.
    """
    threshold = config.NO_SPEECH_THRESHOLD  # 0.6 per D-11

    filtered_segments = []
    all_words = []

    for segment in segments:
        # Keep words below no_speech threshold
        kept_words = [
            w for w in segment.words
            if w.no_speech_prob <= threshold
        ]

        if not kept_words:
            print(f"  [no_speech] Removed segment {segment.id}: "
                  f"all {len(segment.words)} words above no_speech_prob threshold")
            continue

        # Recompute segment text and timing from kept words
        text = " ".join(w.word for w in kept_words)
        start = kept_words[0].start
        end = kept_words[-1].end

        new_segment = TranscriptSegment(
            id=segment.id,  # Will be re-sequenced later
            start=start,
            end=end,
            text=text,
            words=kept_words,
        )
        filtered_segments.append(new_segment)
        all_words.extend(kept_words)

    return filtered_segments, all_words


def _resequence_segments(segments: list[TranscriptSegment]) -> list[TranscriptSegment]:
    """Re-sequence segment IDs to be sequential (0, 1, 2, ...).

    After filtering, segment IDs may have gaps. Re-sequencing ensures
    clean, sequential numbering for downstream consumers.
    """
    return [
        TranscriptSegment(
            id=i,
            start=s.start,
            end=s.end,
            text=s.text,
            words=s.words,
        )
        for i, s in enumerate(segments)
    ]