"""Transcript.json output schema — Pydantic models for the Whisper step output.

Per D-07: transcript.json uses a word list + segments structure: flat list of
{word, start, end, confidence, no_speech_prob} objects grouped under segment-level
entries. This directly maps to Remotion @remotion/captions TikTokPage tokens
(Phase 5) while providing no_speech_prob for Phase 3 silence cross-referencing.

Per D-08: Single output file — transcript.json is the only transcription artifact.
Extracted audio is not preserved as a separate file.

Per D-09: no_speech probability is included per-word. Phase 3 cross-references
these probabilities with FFmpeg silencedetect output.
"""

from pydantic import BaseModel
from typing import List


class TranscriptWord(BaseModel):
    """A single word with timing information per D-07, D-09.

    This is the atomic unit that Remotion @remotion/captions will consume
    in Phase 5, mapping word.start → fromMs and word.end → toMs.

    Attributes:
        word: The transcribed word text.
        start: Start time in seconds (relative to audio start).
        end: End time in seconds (relative to audio start).
        confidence: Whisper confidence score (0-1). Higher = more confident.
        no_speech_prob: Whisper no_speech probability (0-1) per D-09.
            Values above NO_SPEECH_THRESHOLD (0.6, D-11) indicate the word
            likely corresponds to silence rather than speech. Phase 3 uses
            this field for silence cross-referencing with FFmpeg silencedetect.
    """

    word: str
    start: float
    end: float
    confidence: float
    no_speech_prob: float


class TranscriptSegment(BaseModel):
    """A segment of continuous speech per D-07.

    Groups consecutive words into segments matching Whisper's natural
    segment boundaries. Segments are useful for display and editing
    but the flat word list (Transcript.words) is the primary data
    structure consumed by downstream phases.

    Attributes:
        id: Segment index (sequential after hallucination filtering).
        start: Segment start time in seconds.
        end: Segment end time in seconds.
        text: Full segment text (words joined with spaces).
        words: Word-level data per D-07.
    """

    id: int
    start: float
    end: float
    text: str
    words: List[TranscriptWord]


class Transcript(BaseModel):
    """Top-level transcript output per D-08 (single file).

    This is the single artifact that feeds:
    - Phase 3 (silence detection): uses no_speech_prob per word (D-09)
    - Phase 5 (Remotion subtitles): uses word.start and word.end for timing

    Attributes:
        language: Detected/set language per D-10 ("es").
        model: Model used per D-02 ("medium").
        segments: Segment-level transcript data per D-07.
        words: Flat word list for easy Phase 5 consumption.
            This is the same data as segments[*].words but flattened into
            a single list for simpler iteration by downstream consumers.
        duration: Total audio duration in seconds.
        timeline: Which audio timeline the word timestamps are on. This step
            runs on the ORIGINAL (uncut) audio, so timestamps are always
            "original" and the renderer applies the silence remap. Declaring it
            explicitly lets the renderer skip its fragile maxWordEnd heuristic
            (which mis-fires on mid-speech cuts → highlight drift). See
            .planning/contracts/whisper-service-integration.md.
    """

    language: str
    model: str
    segments: List[TranscriptSegment]
    words: List[TranscriptWord]
    duration: float
    timeline: str = "original"