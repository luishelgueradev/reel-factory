"""Unit tests for Whisper transcription schema, hallucination filter, and validation.

Tests the Python logic layer without requiring GPU or Whisper model downloads.
All test data is constructed in-memory, following the TDD principle of testing
behavior against known inputs/outputs.

Referenced requirements:
- TRAN-02: Word-level timestamps with start/end
- TRAN-03: Hallucination filter removes phantom text
- TRAN-04: Spanish language explicitly configured (language='es', non-.en model)
- D-07: transcript.json word list + segments structure
- D-08: Single output file (transcript.json)
- D-09: no_speech_prob per word
- D-10: Language explicitly set to 'es'
- D-11: Hallucination thresholds (silence_threshold, no_speech_threshold)
"""

import json
import pytest

from src.schema import TranscriptWord, TranscriptSegment, Transcript
from src.hallucination_filter import filter_hallucinations
from src.validate import validate_transcript
from src import config


# ─────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────

@pytest.fixture
def sample_word() -> TranscriptWord:
    """A single valid Spanish transcript word."""
    return TranscriptWord(
        word="hola",
        start=0.0,
        end=0.5,
        confidence=0.95,
        no_speech_prob=0.02,
    )


@pytest.fixture
def sample_word_2() -> TranscriptWord:
    """A second valid Spanish transcript word."""
    return TranscriptWord(
        word="mundo",
        start=0.5,
        end=1.0,
        confidence=0.90,
        no_speech_prob=0.01,
    )


@pytest.fixture
def sample_segment(sample_word, sample_word_2) -> TranscriptSegment:
    """A valid transcript segment with two words."""
    return TranscriptSegment(
        id=0,
        start=0.0,
        end=1.0,
        text="hola mundo",
        words=[sample_word, sample_word_2],
    )


@pytest.fixture
def sample_transcript(sample_segment, sample_word, sample_word_2) -> Transcript:
    """A valid Spanish transcript matching D-07, TRAN-04."""
    return Transcript(
        language="es",
        model="medium",
        segments=[sample_segment],
        words=[sample_word, sample_word_2],
        duration=1.0,
    )


@pytest.fixture
def valid_transcript_dict() -> dict:
    """A valid transcript.json dict for validate_transcript testing."""
    return {
        "language": "es",
        "model": "medium",
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 1.0,
                "text": "hola mundo",
                "words": [
                    {"word": "hola", "start": 0.0, "end": 0.5, "confidence": 0.95, "no_speech_prob": 0.02},
                    {"word": "mundo", "start": 0.5, "end": 1.0, "confidence": 0.90, "no_speech_prob": 0.01},
                ],
            }
        ],
        "words": [
            {"word": "hola", "start": 0.0, "end": 0.5, "confidence": 0.95, "no_speech_prob": 0.02},
            {"word": "mundo", "start": 0.5, "end": 1.0, "confidence": 0.90, "no_speech_prob": 0.01},
        ],
        "duration": 1.0,
    }


# ─────────────────────────────────────────────────────────
# Test 1: TranscriptWord schema validates with all required fields (TRAN-02, D-09)
# ─────────────────────────────────────────────────────────

class TestTranscriptWordSchema:
    """Test TranscriptWord construction and validation per TRAN-02, D-07, D-09."""

    def test_word_with_all_fields(self, sample_word):
        """TranscriptWord accepts all required fields per D-07."""
        assert sample_word.word == "hola"
        assert sample_word.start == 0.0
        assert sample_word.end == 0.5
        assert sample_word.confidence == 0.95
        assert sample_word.no_speech_prob == 0.02

    def test_word_missing_field_raises(self):
        """TranscriptWord with missing required field raises ValidationError per D-07."""
        with pytest.raises(Exception):
            TranscriptWord(word="hola", start=0.0, end=0.5)

    def test_word_serializes_to_json(self, sample_word):
        """TranscriptWord serializes to valid JSON with all TRAN-02/D-09 fields."""
        data = json.loads(sample_word.model_dump_json())
        assert "word" in data
        assert "start" in data
        assert "end" in data
        assert "confidence" in data
        assert "no_speech_prob" in data

    def test_word_timestamps_are_float(self, sample_word):
        """Word start/end timestamps are numeric (TRAN-02)."""
        assert isinstance(sample_word.start, float)
        assert isinstance(sample_word.end, float)


# ─────────────────────────────────────────────────────────
# Test 2: Transcript schema serializes to valid JSON matching D-07 format
# ─────────────────────────────────────────────────────────

class TestTranscriptSchema:
    """Test Transcript construction and JSON serialization per D-07, D-08."""

    def test_transcript_with_all_fields(self, sample_transcript):
        """Transcript accepts all D-07 required fields."""
        assert sample_transcript.language == "es"
        assert sample_transcript.model == "medium"
        assert len(sample_transcript.segments) == 1
        assert len(sample_transcript.words) == 2
        assert sample_transcript.duration == 1.0

    def test_transcript_missing_field_raises(self):
        """Transcript with missing required field raises ValidationError per D-07."""
        with pytest.raises(Exception):
            Transcript(language="es", model="medium")

    def test_transcript_serializes_to_json(self, sample_transcript):
        """Transcript serializes to valid JSON matching D-07 format."""
        data = json.loads(sample_transcript.model_dump_json())
        assert data["language"] == "es"
        assert data["model"] == "medium"
        assert "segments" in data
        assert "words" in data

    def test_transcript_roundtrip(self, sample_transcript):
        """Full roundtrip: Transcript → JSON → dict → validate proves D-07 compliance."""
        json_str = sample_transcript.model_dump_json()
        data = json.loads(json_str)
        errors = validate_transcript(data)
        assert len(errors) == 0, f"Valid transcript has errors: {errors}"

    def test_transcript_words_are_flat_list(self, sample_transcript):
        """Transcript.words is a flat list per D-07 (not nested in segments)."""
        assert isinstance(sample_transcript.words, list)
        assert len(sample_transcript.words) == 2
        assert sample_transcript.words[0].word == "hola"
        assert sample_transcript.words[1].word == "mundo"


# ─────────────────────────────────────────────────────────
# Test 3: Hallucination filter removes repeated segments (repetition filter)
# ─────────────────────────────────────────────────────────

class TestHallucinationRepetitionFilter:
    """Test repetition filter in filter_hallucinations per TRAN-03, D-11."""

    def test_exact_repetition_removed(self):
        """Exact repeated segments are removed per TRAN-03."""
        word_a = TranscriptWord(word="gracias", start=0.0, end=0.5, confidence=0.9, no_speech_prob=0.01)
        word_b = TranscriptWord(word="gracias", start=1.0, end=1.5, confidence=0.9, no_speech_prob=0.01)
        word_c = TranscriptWord(word="gracias", start=2.0, end=2.5, confidence=0.9, no_speech_prob=0.01)

        transcript = Transcript(
            language="es",
            model="medium",
            segments=[
                TranscriptSegment(id=0, start=0.0, end=0.5, text="gracias", words=[word_a]),
                TranscriptSegment(id=1, start=1.0, end=1.5, text="gracias", words=[word_b]),
                TranscriptSegment(id=2, start=2.0, end=2.5, text="gracias", words=[word_c]),
            ],
            words=[word_a, word_b, word_c],
            duration=3.0,
        )

        result = filter_hallucinations(transcript)
        # First occurrence kept, subsequent repetitions removed
        assert len(result.segments) == 1
        assert result.segments[0].text == "gracias"

    def test_near_duplicate_removed(self):
        """Near-duplicate segments (>80% word overlap) are removed per TRAN-03."""
        w1 = TranscriptWord(word="muchas", start=0.0, end=0.3, confidence=0.9, no_speech_prob=0.01)
        w2 = TranscriptWord(word="gracias", start=0.3, end=0.6, confidence=0.9, no_speech_prob=0.01)
        w3 = TranscriptWord(word="muchas", start=1.0, end=1.3, confidence=0.85, no_speech_prob=0.02)
        w4 = TranscriptWord(word="gracias", start=1.3, end=1.6, confidence=0.85, no_speech_prob=0.02)

        transcript = Transcript(
            language="es",
            model="medium",
            segments=[
                TranscriptSegment(id=0, start=0.0, end=0.6, text="muchas gracias", words=[w1, w2]),
                TranscriptSegment(id=1, start=1.0, end=1.6, text="muchas gracias", words=[w3, w4]),
            ],
            words=[w1, w2, w3, w4],
            duration=2.0,
        )

        result = filter_hallucinations(transcript)
        assert len(result.segments) == 1


# ─────────────────────────────────────────────────────────
# Test 4: Hallucination filter removes segments with high no_speech_prob
# ─────────────────────────────────────────────────────────

class TestHallucinationNoSpeechFilter:
    """Test high no_speech_prob word removal per TRAN-03, D-11."""

    def test_high_no_speech_words_removed(self):
        """Words with no_speech_prob > 0.6 are removed per D-11, TRAN-03."""
        good_word = TranscriptWord(word="habla", start=0.0, end=0.5, confidence=0.9, no_speech_prob=0.1)
        silent_word = TranscriptWord(word="um", start=0.5, end=1.0, confidence=0.2, no_speech_prob=0.8)

        transcript = Transcript(
            language="es",
            model="medium",
            segments=[
                TranscriptSegment(id=0, start=0.0, end=1.0, text="habla um", words=[good_word, silent_word]),
            ],
            words=[good_word, silent_word],
            duration=1.0,
        )

        result = filter_hallucinations(transcript)
        # Silent word removed, only good word remains
        assert len(result.words) == 1
        assert result.words[0].word == "habla"

    def test_segment_all_silent_removed(self):
        """Segments where ALL words have high no_speech_prob are removed entirely."""
        silent_word = TranscriptWord(word="...", start=0.0, end=2.0, confidence=0.1, no_speech_prob=0.9)

        transcript = Transcript(
            language="es",
            model="medium",
            segments=[
                TranscriptSegment(id=0, start=0.0, end=2.0, text="...", words=[silent_word]),
            ],
            words=[silent_word],
            duration=3.0,
        )

        result = filter_hallucinations(transcript)
        assert len(result.segments) == 0
        assert len(result.words) == 0


# ─────────────────────────────────────────────────────────
# Test 5: Spanish language is "es", model is not ".en" variant (TRAN-04)
# ─────────────────────────────────────────────────────────

class TestSpanishConfig:
    """Test Spanish language configuration per TRAN-04."""

    def test_language_is_es(self):
        """WHISPER_LANGUAGE is 'es' per D-10, TRAN-04."""
        assert config.WHISPER_LANGUAGE == "es"

    def test_model_is_not_en_variant(self):
        """WHISPER_MODEL does not end with '.en' per TRAN-04."""
        assert not config.WHISPER_MODEL.endswith(".en")

    def test_model_is_multilingual(self):
        """WHISPER_MODEL is a multilingual variant (medium, not medium.en) per D-02."""
        assert config.WHISPER_MODEL == "medium"


# ─────────────────────────────────────────────────────────
# Test 6: validate_transcript function correctly verifies transcript structure
# ─────────────────────────────────────────────────────────

class TestValidateTranscript:
    """Test validate_transcript function per TRAN-04, D-07, D-09."""

    def test_valid_transcript_no_errors(self, valid_transcript_dict):
        """Valid Spanish transcript produces no errors."""
        errors = validate_transcript(valid_transcript_dict)
        assert len(errors) == 0

    def test_invalid_language_error(self, valid_transcript_dict):
        """Non-Spanish language produces TRAN-04 error."""
        valid_transcript_dict["language"] = "en"
        errors = validate_transcript(valid_transcript_dict)
        assert any("TRAN-04" in e for e in errors)

    def test_en_model_variant_error(self, valid_transcript_dict):
        """Model ending in '.en' produces TRAN-04 error."""
        valid_transcript_dict["model"] = "medium.en"
        errors = validate_transcript(valid_transcript_dict)
        assert any("TRAN-04" in e for e in errors)

    def test_missing_segments_error(self, valid_transcript_dict):
        """Missing 'segments' field produces D-07 error."""
        del valid_transcript_dict["segments"]
        errors = validate_transcript(valid_transcript_dict)
        assert any("D-07" in e for e in errors)

    def test_missing_words_error(self, valid_transcript_dict):
        """Missing 'words' field produces D-07 error."""
        del valid_transcript_dict["words"]
        errors = validate_transcript(valid_transcript_dict)
        assert any("D-07" in e for e in errors)

    def test_word_missing_timestamps(self, valid_transcript_dict):
        """Word missing start/end timestamps produces TRAN-02 error."""
        valid_transcript_dict["words"][0].pop("start")
        valid_transcript_dict["words"][0].pop("end")
        errors = validate_transcript(valid_transcript_dict)
        assert any("TRAN-02" in e for e in errors)

    def test_word_missing_no_speech_prob(self, valid_transcript_dict):
        """Word missing no_speech_prob produces D-09 error."""
        del valid_transcript_dict["words"][0]["no_speech_prob"]
        errors = validate_transcript(valid_transcript_dict)
        assert any("D-09" in e for e in errors)

    def test_multiple_errors(self, valid_transcript_dict):
        """Multiple issues produce multiple errors."""
        valid_transcript_dict["language"] = "fr"
        valid_transcript_dict["model"] = "small.en"
        errors = validate_transcript(valid_transcript_dict)
        assert len(errors) >= 2


# ─────────────────────────────────────────────────────────
# Test 7: Empty/invalid inputs are handled gracefully
# ─────────────────────────────────────────────────────────

class TestEdgeCases:
    """Test graceful handling of empty/invalid inputs."""

    def test_validate_empty_dict(self):
        """Empty dict produces validation errors (not exception)."""
        errors = validate_transcript({})
        assert len(errors) > 0

    def test_validate_none_language(self):
        """Missing language key is handled gracefully."""
        errors = validate_transcript({"model": "medium", "segments": [], "words": []})
        assert any("TRAN-04" in e for e in errors)

    def test_validate_empty_words_list(self):
        """Empty words list is valid (no words to check)."""
        data = {"language": "es", "model": "medium", "segments": [], "words": [], "duration": 0.0}
        errors = validate_transcript(data)
        assert len(errors) == 0

    def test_filter_empty_transcript(self):
        """Hallucination filter handles empty transcript gracefully."""
        transcript = Transcript(
            language="es",
            model="medium",
            segments=[],
            words=[],
            duration=0.0,
        )
        result = filter_hallucinations(transcript)
        assert len(result.segments) == 0
        assert len(result.words) == 0

    def test_filter_preserves_language_and_model(self, sample_transcript):
        """Hallucination filter preserves language and model metadata."""
        result = filter_hallucinations(sample_transcript)
        assert result.language == "es"
        assert result.model == "medium"

    def test_empty_segment_filtered(self):
        """Empty text segments are removed per filter step 1."""
        word_a = TranscriptWord(word="hola", start=0.0, end=0.5, confidence=0.9, no_speech_prob=0.01)
        transcript = Transcript(
            language="es",
            model="medium",
            segments=[
                TranscriptSegment(id=0, start=0.0, end=0.5, text="hola", words=[word_a]),
                TranscriptSegment(id=1, start=1.0, end=1.5, text="  ", words=[]),
            ],
            words=[word_a],
            duration=2.0,
        )
        result = filter_hallucinations(transcript)
        assert len(result.segments) == 1

    def test_low_confidence_segment_filtered(self):
        """Segments with very low avg confidence (<0.3) are removed."""
        low_word = TranscriptWord(word="xyz", start=0.0, end=0.5, confidence=0.1, no_speech_prob=0.1)
        good_word = TranscriptWord(word="habla", start=1.0, end=1.5, confidence=0.9, no_speech_prob=0.01)

        transcript = Transcript(
            language="es",
            model="medium",
            segments=[
                TranscriptSegment(id=0, start=0.0, end=0.5, text="xyz", words=[low_word]),
                TranscriptSegment(id=1, start=1.0, end=1.5, text="habla", words=[good_word]),
            ],
            words=[low_word, good_word],
            duration=2.0,
        )

        result = filter_hallucinations(transcript)
        assert len(result.segments) == 1
        assert result.segments[0].text == "habla"

    def test_duration_anomaly_segment_filtered(self):
        """Segments >30s with <5 words are removed (stretched silence hallucination)."""
        long_word = TranscriptWord(word="eh", start=0.0, end=35.0, confidence=0.5, no_speech_prob=0.3)
        good_word = TranscriptWord(word="dice", start=36.0, end=36.5, confidence=0.9, no_speech_prob=0.01)

        transcript = Transcript(
            language="es",
            model="medium",
            segments=[
                TranscriptSegment(id=0, start=0.0, end=35.0, text="eh", words=[long_word]),
                TranscriptSegment(id=1, start=36.0, end=36.5, text="dice", words=[good_word]),
            ],
            words=[long_word, good_word],
            duration=40.0,
        )

        result = filter_hallucinations(transcript)
        assert len(result.segments) == 1
        assert result.segments[0].text == "dice"