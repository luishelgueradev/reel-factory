"""Transcript.json contract schema — Pydantic models for the reels body.

Ported from services/whisper/src/schema.py (D-5: preserve the old schema as the
contract reference). This step writes the whisper-api response body VERBATIM to
transcript.json and does NOT round-trip through these models at runtime — they
are kept here as the contract-test / response-validation target per
.planning/contracts/whisper-service-integration.md §6 (field-for-field parity
test in 15-03).

Per the contract §2, the profile=reels bare body is:
  { language, model, duration, segments: [...], words: [...] }
where each word carries {word, start, end, confidence, no_speech_prob}.
"""

from pydantic import BaseModel
from typing import List


class TranscriptWord(BaseModel):
    """A single word with timing information.

    The atomic unit that Remotion @remotion/captions consumes downstream,
    mapping word.start -> fromMs and word.end -> toMs.

    Attributes:
        word: The transcribed word text.
        start: Start time in seconds (relative to audio start).
        end: End time in seconds (relative to audio start).
        confidence: Whisper confidence score (0-1). Higher = more confident.
        no_speech_prob: Whisper no_speech probability (0-1). High values
            indicate the word likely corresponds to silence; the silence step
            cross-references this with FFmpeg silencedetect.
    """

    word: str
    start: float
    end: float
    confidence: float
    no_speech_prob: float


class TranscriptSegment(BaseModel):
    """A segment of continuous speech.

    Groups consecutive words into segments matching Whisper's natural segment
    boundaries. The flat word list (Transcript.words) is the primary data
    structure consumed by downstream steps.

    Attributes:
        id: Segment index.
        start: Segment start time in seconds.
        end: Segment end time in seconds.
        text: Full segment text (words joined with spaces).
        words: Word-level data.
    """

    id: int
    start: float
    end: float
    text: str
    words: List[TranscriptWord]


class Transcript(BaseModel):
    """Top-level reels transcript body (profile=reels).

    This is the single artifact that feeds the silence step (uses
    no_speech_prob per word) and the Remotion subtitle step (uses word.start /
    word.end for timing).

    Attributes:
        language: Set language ("es").
        model: Model used by the whisper-api.
        segments: Segment-level transcript data.
        words: Flat word list for simple downstream iteration.
        duration: Total audio duration in seconds.
        timeline: Which audio timeline the timestamps are on. The transcription
            runs on the ORIGINAL (uncut) audio, so this is "original" and the
            renderer applies the silence remap. Optional in the bare body.
    """

    language: str
    model: str
    segments: List[TranscriptSegment]
    words: List[TranscriptWord]
    duration: float
    timeline: str = "original"
