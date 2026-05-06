"""Whisper transcription module — whisperx primary + faster-whisper fallback.

Per D-01: whisperx is the primary transcription engine, using forced alignment
for word-level timestamps. If whisperx proves unreliable or alignment quality
is worse than faster-whisper word timestamps, fallback to faster-whisper with
its built-in word_timestamps=True.

whisperx advantage: forced alignment gives better word-level timestamps than
raw faster-whisper word_timestamps. The align step refines word boundaries
using a phoneme-level alignment model.

faster-whisper fallback: If whisperx fails (import error, alignment failure,
CUDA error), this module falls back to faster-whisper with word_timestamps=True
and built-in hallucination threshold parameters.

Per D-10: Language is explicitly set to "es" — no language detection step.
Per D-11: hallucination_silence_threshold and no_speech_threshold are passed
to faster-whisper's transcribe() method for built-in VAD filtering.
"""

import time
from typing import Optional

from . import config
from .schema import Transcript, TranscriptWord, TranscriptSegment


def transcribe(
    audio_path: str,
    model: Optional[str] = None,
    language: Optional[str] = None,
    device: Optional[str] = None,
    compute_type: Optional[str] = None,
) -> Transcript:
    """Transcribe audio file with word-level timestamps.

    Tries whisperx first (D-01: forced alignment for better word timestamps).
    Falls back to faster-whisper if whisperx fails.

    Args:
        audio_path: Path to WAV audio file (16kHz mono, from audio_extraction).
        model: Whisper model size (default: config.WHISPER_MODEL, "medium").
        language: Language code (default: config.WHISPER_LANGUAGE, "es").
        device: Compute device (default: config.WHISPER_DEVICE, "cuda").
        compute_type: Computation type (default: config.WHISPER_COMPUTE_TYPE, "float16").

    Returns:
        Transcript object with word-level timestamps per D-07, D-09.

    Raises:
        RuntimeError: If both whisperx and faster-whisper fail.
    """
    model_name = model or config.WHISPER_MODEL
    lang = language or config.WHISPER_LANGUAGE
    dev = device or config.WHISPER_DEVICE
    comp_type = compute_type or config.WHISPER_COMPUTE_TYPE

    print(f"[transcribe] Starting transcription")
    print(f"  Audio: {audio_path}")
    print(f"  Model: {model_name}")
    print(f"  Language: {lang} (D-10: explicit, no detection)")
    print(f"  Device: {dev}")
    print(f"  Compute type: {comp_type}")

    start_time = time.time()

    # Try whisperx first (D-01: primary engine)
    try:
        result = _transcribe_whisperx(audio_path, model_name, lang, dev, comp_type)
        elapsed = time.time() - start_time
        print(f"[transcribe] whisperx transcription completed in {elapsed:.2f}s")
        return result
    except Exception as e:
        print(f"[transcribe] whisperx failed: {e}")
        print(f"[transcribe] Falling back to faster-whisper (D-01)")

    # Fallback: faster-whisper (D-01)
    try:
        result = _transcribe_faster_whisper(audio_path, model_name, lang, dev, comp_type)
        elapsed = time.time() - start_time
        print(f"[transcribe] faster-whisper transcription completed in {elapsed:.2f}s")
        return result
    except Exception as e:
        elapsed = time.time() - start_time
        raise RuntimeError(
            f"Both whisperx and faster-whisper failed. "
            f"whisperx error was logged above. faster-whisper error: {e}"
        ) from e


def _transcribe_whisperx(
    audio_path: str,
    model_name: str,
    language: str,
    device: str,
    compute_type: str,
) -> Transcript:
    """Transcribe using whisperx with forced alignment (D-01 primary engine).

    whisperx provides better word-level timestamps through its alignment step,
    which refines word boundaries using a phoneme-level alignment model.

    Note: whisperx may not provide no_speech_prob in its output. When missing,
    it is set to 0.0. Phase 3 (silence detection) will primarily use
    faster-whisper's no_speech_prob for silence cross-referencing with
    FFmpeg silencedetect. If whisperx is the engine used, Phase 3 may need
    to rely more heavily on FFmpeg silencedetect output alone.
    """
    import whisperx

    print("[transcribe] Using whisperx (primary engine per D-01)")

    # Load whisperx model
    whisperx_model = whisperx.load_model(model_name, device=device, compute_type=compute_type)

    # Transcribe with language set explicitly per D-10
    result = whisperx_model.transcribe(audio_path, language=language)

    # Align for word-level timestamps (whisperx key advantage per D-01)
    print("[transcribe] Running whisperx forced alignment...")
    model_a, metadata = whisperx.load_align_model(language_code=language, device=device)
    result = whisperx.align(
        result["segments"], model_a, metadata, audio_path, device=device
    )

    # Convert to Transcript schema
    return _convert_whisperx_result(result, model_name, language)


def _transcribe_faster_whisper(
    audio_path: str,
    model_name: str,
    language: str,
    device: str,
    compute_type: str,
) -> Transcript:
    """Transcribe using faster-whisper with word timestamps (D-01 fallback).

    faster-whisper provides built-in word_timestamps=True and VAD filtering
    via hallucination_silence_threshold and no_speech_threshold parameters.
    Per D-11: these thresholds are applied at transcription time.
    """
    from faster_whisper import WhisperModel

    print("[transcribe] Using faster-whisper (fallback engine per D-01)")

    # Load faster-whisper model
    model = WhisperModel(model_name, device=device, compute_type=compute_type)

    # Transcribe with word-level timestamps and built-in VAD (D-11)
    segments_generator, info = model.transcribe(
        audio_path,
        language=language,
        word_timestamps=True,  # D-01: word-level timestamps
        hallucination_silence_threshold=config.HALLUCINATION_SILENCE_THRESHOLD,  # D-11
        no_speech_threshold=config.NO_SPEECH_THRESHOLD,  # D-11
    )

    # Materialize the generator (faster-whisper returns a generator)
    segments_list = list(segments_generator)

    # Convert to Transcript schema
    return _convert_faster_whisper_result(segments_list, info, model_name, language)


def _convert_whisperx_result(
    result: dict,
    model_name: str,
    language: str,
) -> Transcript:
    """Convert whisperx aligned result to Transcript schema.

    whisperx aligned result format:
    {
        "segments": [
            {
                "start": float,
                "end": float,
                "text": str,
                "words": [
                    {
                        "word": str,
                        "start": float,
                        "end": float,
                        "score": float,  # alignment confidence
                    }
                ]
            }
        ]
    }

    Note: whisperx may not provide no_speech_prob. When absent,
    it defaults to 0.0 per the docstring contract.
    """
    all_words: list[TranscriptWord] = []
    transcript_segments: list[TranscriptSegment] = []

    for seg_idx, segment in enumerate(result.get("segments", [])):
        seg_words: list[TranscriptWord] = []

        for word_data in segment.get("words", []):
            # whisperx word fields: word, start, end, score
            # no_speech_prob is typically NOT in whisperx output — default to 0.0
            confidence = word_data.get("score", 0.0)
            no_speech_prob = word_data.get("no_speech_prob", 0.0)

            tw = TranscriptWord(
                word=word_data.get("word", "").strip(),
                start=word_data.get("start", 0.0),
                end=word_data.get("end", 0.0),
                confidence=confidence,
                no_speech_prob=no_speech_prob,
            )
            seg_words.append(tw)

        # Compute segment text and timing from words if available
        if seg_words:
            seg_text = " ".join(w.word for w in seg_words)
            seg_start = seg_words[0].start
            seg_end = seg_words[-1].end
        else:
            seg_text = segment.get("text", "").strip()
            seg_start = segment.get("start", 0.0)
            seg_end = segment.get("end", 0.0)

        ts = TranscriptSegment(
            id=seg_idx,
            start=seg_start,
            end=seg_end,
            text=seg_text,
            words=seg_words,
        )
        transcript_segments.append(ts)
        all_words.extend(seg_words)

    # Total duration from segments (last segment end time)
    duration = (
        max((s.end for s in transcript_segments), default=0.0)
        if transcript_segments
        else 0.0
    )

    return Transcript(
        language=language,
        model=model_name,
        segments=transcript_segments,
        words=all_words,
        duration=duration,
    )


def _convert_faster_whisper_result(
    segments_list: list,
    info,
    model_name: str,
    language: str,
) -> Transcript:
    """Convert faster-whisper segments to Transcript schema.

    faster-whisper segment format (each is a Segment object):
    - segment.start: float — segment start time
    - segment.end: float — segment end time
    - segment.text: str — segment text
    - segment.words: list of Word objects with:
        - word.start: float
        - word.end: float
        - word.word: str
        - word.probability: float (confidence)
        - word.no_speech_prob: float (D-09)

    info object has:
    - info.language: str
    - info.language_probability: float
    - info.duration: float (total audio duration in seconds)
    """
    all_words: list[TranscriptWord] = []
    transcript_segments: list[TranscriptSegment] = []

    for seg_idx, segment in enumerate(segments_list):
        seg_words: list[TranscriptWord] = []

        # Each segment has a .words attribute when word_timestamps=True
        for word_obj in getattr(segment, "words", []) or []:
            tw = TranscriptWord(
                word=word_obj.word.strip(),
                start=word_obj.start,
                end=word_obj.end,
                confidence=word_obj.probability,
                no_speech_prob=getattr(word_obj, "no_speech_prob", 0.0),
            )
            seg_words.append(tw)

        # Compute segment text from words or fall back to segment text
        if seg_words:
            seg_text = " ".join(w.word for w in seg_words)
            seg_start = seg_words[0].start
            seg_end = seg_words[-1].end
        else:
            seg_text = getattr(segment, "text", "").strip()
            seg_start = getattr(segment, "start", 0.0)
            seg_end = getattr(segment, "end", 0.0)

        ts = TranscriptSegment(
            id=seg_idx,
            start=seg_start,
            end=seg_end,
            text=seg_text,
            words=seg_words,
        )
        transcript_segments.append(ts)
        all_words.extend(seg_words)

    # Use info.duration for total duration if available
    duration = getattr(info, "duration", None) or (
        max((s.end for s in transcript_segments), default=0.0)
        if transcript_segments
        else 0.0
    )

    return Transcript(
        language=language,
        model=model_name,
        segments=transcript_segments,
        words=all_words,
        duration=duration,
    )