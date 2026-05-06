"""Unit tests for silence cutter — schema, silencedetect parsing, cross-reference, and validation.

Follows the whisper/tests/test_transcription.py pattern with pytest.
Tests validate SILC-01/02/03/04 requirements and D-01/D-03/D-07 decisions.

Referenced requirements:
- SILC-01: Cross-referenced silence detection (FFmpeg + Whisper)
- SILC-02: Hard cuts (no transitions)
- SILC-03: A/V sync preservation
- SILC-04: JSON cut list artifact
- D-01: Intersection approach (both sources)
- D-03: ANY-word threshold for Whisper confirmation
- D-07: Detailed schema with cumulative_shift
"""

import pytest
import json
import sys
import os

# Add parent directory to path for imports (matches whisper test pattern)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.schema import SilenceCut, SilenceCutList, SilenceSource
from src.silencedetect import _parse_silencedetect_output, SilenceSegment
from src.cross_reference import _check_whisper_confirmation, _times_overlap
from src.cut_video import _compute_keep_segments
from src.validate import validate_silence_cuts, validate_cross_reference_logic
from src import config


# ─────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────

@pytest.fixture
def sample_cut() -> SilenceCut:
    """A single valid silence cut entry."""
    return SilenceCut(
        original_start=1.0,
        original_end=3.0,
        new_start=0.0,
        new_end=2.0,
        duration=2.0,
        source=SilenceSource.BOTH,
        cumulative_shift=0.0,
    )


@pytest.fixture
def sample_cut_list(sample_cut) -> SilenceCutList:
    """A valid SilenceCutList with one cut."""
    return SilenceCutList(
        total_segments_removed=1,
        total_silence_removed=2.0,
        original_duration=10.0,
        new_duration=8.0,
        cuts=[sample_cut],
    )


@pytest.fixture
def valid_cut_list_dict() -> dict:
    """A valid silence-cuts.json dict for validation testing."""
    return {
        "total_segments_removed": 1,
        "total_silence_removed": 2.0,
        "original_duration": 10.0,
        "new_duration": 8.0,
        "cuts": [{
            "original_start": 1.0,
            "original_end": 3.0,
            "new_start": 0.0,
            "new_end": 2.0,
            "duration": 2.0,
            "source": "both",
            "cumulative_shift": 0.0,
        }],
    }


# ─────────────────────────────────────────────────────────
# Test 1: SilenceCut schema validates with all required fields (D-07)
# ─────────────────────────────────────────────────────────

class TestSilenceCutSchema:
    """Test SilenceCut and SilenceCutList Pydantic models per D-07."""

    def test_silence_cut_creation(self, sample_cut):
        """SilenceCut accepts all required fields per D-07."""
        assert sample_cut.original_start == 1.0
        assert sample_cut.source == SilenceSource.BOTH
        assert sample_cut.cumulative_shift == 0.0

    def test_silence_cut_serialization(self, sample_cut):
        """SilenceCut serializes to JSON with source as string per D-07."""
        data = json.loads(sample_cut.model_dump_json())
        assert data["source"] == "both"
        assert data["cumulative_shift"] == 0.0

    def test_silence_source_enum(self):
        """SilenceSource enum values match D-01 intersection approach."""
        assert SilenceSource.BOTH.value == "both"
        assert SilenceSource.FFMPEG.value == "ffmpeg"
        assert SilenceSource.WHISPER.value == "whisper"

    def test_silence_cut_list_creation(self, sample_cut_list):
        """SilenceCutList accepts all D-07 required fields."""
        assert sample_cut_list.total_segments_removed == 1
        assert len(sample_cut_list.cuts) == 1

    def test_empty_cut_list(self):
        """Empty cut list represents no silence detected."""
        cut_list = SilenceCutList(
            total_segments_removed=0,
            total_silence_removed=0.0,
            original_duration=10.0,
            new_duration=10.0,
            cuts=[],
        )
        assert cut_list.total_segments_removed == 0
        assert cut_list.new_duration == 10.0

    def test_silence_cut_list_serialization(self, sample_cut_list):
        """SilenceCutList serializes to valid JSON per SILC-04."""
        data = json.loads(sample_cut_list.model_dump_json())
        assert "cuts" in data
        assert data["total_segments_removed"] == 1
        assert data["total_silence_removed"] == 2.0
        assert data["cuts"][0]["source"] == "both"


# ─────────────────────────────────────────────────────────
# Test 2: FFmpeg silencedetect parser (SILC-01)
# ─────────────────────────────────────────────────────────

class TestSilencedetectParser:
    """Test FFmpeg silencedetect stderr parsing per SILC-01."""

    def test_parse_single_silence(self):
        """Single silence_start/end pair produces one segment."""
        stderr = (
            "[silencedetect @ 0x1234] silence_start: 1.500\n"
            "[silencedetect @ 0x5678] silence_end: 3.200 | silence_duration: 1.700\n"
        )
        segments = _parse_silencedetect_output(stderr)
        assert len(segments) == 1
        assert segments[0].start == 1.5
        assert segments[0].end == 3.2
        assert segments[0].duration == 1.7

    def test_parse_multiple_silences(self):
        """Multiple silence_start/end pairs produce multiple segments."""
        stderr = (
            "[silencedetect @ 0x1234] silence_start: 2.0\n"
            "[silencedetect @ 0x5678] silence_end: 4.0 | silence_duration: 2.0\n"
            "[silencedetect @ 0x1234] silence_start: 10.0\n"
            "[silencedetect @ 0x5678] silence_end: 12.5 | silence_duration: 2.5\n"
        )
        segments = _parse_silencedetect_output(stderr)
        assert len(segments) == 2
        assert segments[0].start == 2.0
        assert segments[1].start == 10.0

    def test_parse_trailing_silence_no_end(self):
        """Trailing silence with no end marker sets end=start, duration=0."""
        stderr = "[silencedetect @ 0x1234] silence_start: 45.0\n"
        segments = _parse_silencedetect_output(stderr)
        assert len(segments) == 1
        assert segments[0].start == 45.0
        assert segments[0].end == 45.0  # Unknown end
        assert segments[0].duration == 0.0

    def test_parse_empty_output(self):
        """Empty stderr produces no segments."""
        segments = _parse_silencedetect_output("")
        assert len(segments) == 0

    def test_parse_no_silence_detected(self):
        """FFmpeg stderr without silencedetect lines produces no segments."""
        stderr = "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'video.mp4'"
        segments = _parse_silencedetect_output(stderr)
        assert len(segments) == 0


# ─────────────────────────────────────────────────────────
# Test 3: Cross-reference logic (D-01, D-03)
# ─────────────────────────────────────────────────────────

class TestCrossReference:
    """Test cross-reference logic per D-01, D-03."""

    def test_whisper_confirms_silence(self):
        """D-03: ANY word with no_speech_prob > threshold confirms."""
        words = [
            {"start": 1.0, "end": 1.5, "no_speech_prob": 0.8},
        ]
        source = _check_whisper_confirmation(1.0, 2.0, words)
        assert source == SilenceSource.BOTH

    def test_whisper_rejects_non_silence(self):
        """Words with low no_speech_prob don't confirm silence."""
        words = [
            {"start": 1.0, "end": 1.5, "no_speech_prob": 0.2},
        ]
        source = _check_whisper_confirmation(1.0, 2.0, words)
        assert source == SilenceSource.FFMPEG

    def test_any_word_threshold(self):
        """D-03: Only ONE word needs high no_speech_prob to confirm."""
        words = [
            {"start": 1.0, "end": 1.5, "no_speech_prob": 0.2},
            {"start": 1.5, "end": 2.0, "no_speech_prob": 0.9},
            {"start": 2.0, "end": 2.5, "no_speech_prob": 0.1},
        ]
        source = _check_whisper_confirmation(1.0, 2.5, words)
        assert source == SilenceSource.BOTH

    def test_no_overlapping_words(self):
        """No words overlapping silence region → FFmpeg-only."""
        words = [
            {"start": 5.0, "end": 6.0, "no_speech_prob": 0.9},
        ]
        source = _check_whisper_confirmation(1.0, 2.0, words)
        assert source == SilenceSource.FFMPEG

    def test_times_overlapping(self):
        """Overlapping time ranges detected correctly."""
        assert _times_overlap(1.0, 3.0, 2.0, 4.0) is True

    def test_times_non_overlapping(self):
        """Non-overlapping time ranges return False."""
        assert _times_overlap(1.0, 2.0, 3.0, 4.0) is False

    def test_times_overlap_edge(self):
        """Touching edges are NOT overlap."""
        assert _times_overlap(1.0, 2.0, 2.0, 3.0) is False

    def test_times_overlap_unknown_end(self):
        """One range has 0 end (unknown) — overlap detected."""
        assert _times_overlap(1.0, 0, 0.5, 2.0) is True

    def test_config_no_speech_threshold(self):
        """Config NO_SPEECH_THRESHOLD matches whisper container (D-03)."""
        assert config.NO_SPEECH_THRESHOLD == 0.6


# ─────────────────────────────────────────────────────────
# Test 4: Keep segment computation (SILC-02, SILC-03)
# ─────────────────────────────────────────────────────────

class TestKeepSegmentComputation:
    """Test keep segment computation (inverse of silence cuts)."""

    def test_single_silence_at_start(self):
        """Silence at start: keep segment after silence."""
        cut_list = SilenceCutList(
            total_segments_removed=1,
            total_silence_removed=2.0,
            original_duration=10.0,
            new_duration=8.0,
            cuts=[SilenceCut(
                original_start=0.0, original_end=2.0,
                new_start=0.0, new_end=0.0,
                duration=2.0, source=SilenceSource.BOTH,
                cumulative_shift=0.0,
            )],
        )
        keeps = _compute_keep_segments(cut_list)
        assert len(keeps) == 1
        assert keeps[0] == (2.0, 8.0)  # start=2.0, duration=8.0

    def test_middle_silence(self):
        """Silence in middle: two keep segments (before and after)."""
        cut_list = SilenceCutList(
            total_segments_removed=1,
            total_silence_removed=1.0,
            original_duration=10.0,
            new_duration=9.0,
            cuts=[SilenceCut(
                original_start=5.0, original_end=6.0,
                new_start=4.0, new_end=5.0,
                duration=1.0, source=SilenceSource.BOTH,
                cumulative_shift=0.0,
            )],
        )
        keeps = _compute_keep_segments(cut_list)
        assert len(keeps) == 2
        assert keeps[0] == (0.0, 5.0)   # Before silence
        assert keeps[1] == (6.0, 4.0)   # After silence

    def test_multiple_silences(self):
        """Multiple silences: three keep segments."""
        cut_list = SilenceCutList(
            total_segments_removed=2,
            total_silence_removed=3.0,
            original_duration=10.0,
            new_duration=7.0,
            cuts=[
                SilenceCut(
                    original_start=2.0, original_end=3.0,
                    new_start=0.0, new_end=1.0,
                    duration=1.0, source=SilenceSource.BOTH,
                    cumulative_shift=0.0,
                ),
                SilenceCut(
                    original_start=6.0, original_end=8.0,
                    new_start=3.0, new_end=5.0,
                    duration=2.0, source=SilenceSource.BOTH,
                    cumulative_shift=1.0,
                ),
            ],
        )
        keeps = _compute_keep_segments(cut_list)
        assert len(keeps) == 3
        assert keeps[0] == (0.0, 2.0)   # Before first silence
        assert keeps[1] == (3.0, 3.0)    # Between silences
        assert keeps[2] == (8.0, 2.0)   # After second silence

    def test_no_silences(self):
        """No silences: entire video is one keep segment."""
        cut_list = SilenceCutList(
            total_segments_removed=0,
            total_silence_removed=0.0,
            original_duration=10.0,
            new_duration=10.0,
            cuts=[],
        )
        keeps = _compute_keep_segments(cut_list)
        assert len(keeps) == 1
        assert keeps[0] == (0.0, 10.0)  # Entire video is one keep segment


# ─────────────────────────────────────────────────────────
# Test 5: Validation module (SILC-01/03/04, D-01/D-03/D-07)
# ─────────────────────────────────────────────────────────

class TestValidation:
    """Test validation module per SILC-XX/D-XX requirements."""

    def test_valid_cut_list_no_errors(self, valid_cut_list_dict):
        """Valid silence-cuts.json produces no validation errors."""
        errors = validate_silence_cuts(valid_cut_list_dict)
        assert len(errors) == 0

    def test_missing_cuts_field(self):
        """Missing 'cuts' field produces SILC-04 error."""
        data = {"total_segments_removed": 0}
        errors = validate_silence_cuts(data)
        assert any("SILC-04" in e for e in errors)

    def test_cuts_not_list(self):
        """'cuts' that is not a list produces SILC-04 error."""
        data = {"cuts": "not a list"}
        errors = validate_silence_cuts(data)
        assert any("SILC-04" in e for e in errors)

    def test_missing_required_fields(self):
        """Missing required summary fields produce D-07 errors."""
        data = {"cuts": [{"original_start": 1.0}]}
        errors = validate_silence_cuts(data)
        assert len(errors) > 0  # Missing many required fields

    def test_missing_cut_fields(self):
        """Cut entry missing required fields produces D-07 errors."""
        data = {
            "total_segments_removed": 1,
            "total_silence_removed": 2.0,
            "original_duration": 10.0,
            "new_duration": 8.0,
            "cuts": [{"original_start": 1.0}],  # Missing many fields
        }
        errors = validate_silence_cuts(data)
        missing_field_errors = [e for e in errors if "D-07" in e and "missing" in e]
        assert len(missing_field_errors) > 0

    def test_invalid_source(self, valid_cut_list_dict):
        """Invalid source value produces D-01 error."""
        valid_cut_list_dict["cuts"][0]["source"] = "invalid_source"
        errors = validate_silence_cuts(valid_cut_list_dict)
        assert any("D-01" in e for e in errors)

    def test_duration_mismatch(self):
        """total_silence_removed doesn't match sum of cut durations → SILC-04 error."""
        data = {
            "total_segments_removed": 1,
            "total_silence_removed": 5.0,  # Wrong: should be 2.0
            "original_duration": 10.0,
            "new_duration": 8.0,
            "cuts": [{
                "original_start": 1.0, "original_end": 3.0,
                "new_start": 0.0, "new_end": 2.0,
                "duration": 2.0, "source": "both",
                "cumulative_shift": 0.0,
            }],
        }
        errors = validate_silence_cuts(data)
        assert any("SILC-04" in e for e in errors)

    def test_new_duration_inconsistency(self):
        """new_duration doesn't match original - total_silence_removed → SILC-03 error."""
        data = {
            "total_segments_removed": 1,
            "total_silence_removed": 2.0,
            "original_duration": 10.0,
            "new_duration": 5.0,  # Wrong: should be 10.0 - 2.0 = 8.0
            "cuts": [{
                "original_start": 1.0, "original_end": 3.0,
                "new_start": 0.0, "new_end": 2.0,
                "duration": 2.0, "source": "both",
                "cumulative_shift": 0.0,
            }],
        }
        errors = validate_silence_cuts(data)
        assert any("SILC-03" in e for e in errors)

    def test_count_mismatch(self):
        """total_segments_removed doesn't match cuts list length → SILC-04 error."""
        data = {
            "total_segments_removed": 3,  # Wrong: actual count is 1
            "total_silence_removed": 2.0,
            "original_duration": 10.0,
            "new_duration": 8.0,
            "cuts": [{
                "original_start": 1.0, "original_end": 3.0,
                "new_start": 0.0, "new_end": 2.0,
                "duration": 2.0, "source": "both",
                "cumulative_shift": 0.0,
            }],
        }
        errors = validate_silence_cuts(data)
        assert any("SILC-04" in e and "total_segments_removed" in e for e in errors)

    def test_cumulative_shift_not_monotonic(self):
        """cumulative_shift decreasing produces D-07 error."""
        data = {
            "total_segments_removed": 2,
            "total_silence_removed": 3.0,
            "original_duration": 10.0,
            "new_duration": 7.0,
            "cuts": [
                {
                    "original_start": 1.0, "original_end": 2.0,
                    "new_start": 0.0, "new_end": 1.0,
                    "duration": 1.0, "source": "both",
                    "cumulative_shift": 1.0,
                },
                {
                    "original_start": 4.0, "original_end": 6.0,
                    "new_start": 2.0, "new_end": 4.0,
                    "duration": 2.0, "source": "both",
                    "cumulative_shift": 0.5,  # Wrong: should be >= 1.0
                },
            ],
        }
        errors = validate_silence_cuts(data)
        assert any("D-07" in e and "cumulative_shift" in e for e in errors)

    def test_cross_reference_logic_valid(self):
        """Valid cross-reference produces no errors."""
        errors = validate_cross_reference_logic(
            silence_candidates=[{"start": 1.0}],
            words=[{"start": 1.0, "end": 1.5, "no_speech_prob": 0.8}],
            confirmed_source="both",
        )
        assert len(errors) == 0

    def test_cross_reference_logic_missing_confirmation(self):
        """D-03: Should have confirmed but didn't."""
        errors = validate_cross_reference_logic(
            silence_candidates=[{"start": 1.0}],
            words=[{"start": 1.0, "end": 1.5, "no_speech_prob": 0.9}],
            confirmed_source="ffmpeg",  # Should be "both"
        )
        assert any("D-03" in e for e in errors)

    def test_cross_reference_logic_false_confirmation(self):
        """D-03: Confirmed as 'both' but no confirming word."""
        errors = validate_cross_reference_logic(
            silence_candidates=[{"start": 1.0}],
            words=[{"start": 1.0, "end": 1.5, "no_speech_prob": 0.2}],
            confirmed_source="both",  # Should be "ffmpeg"
        )
        assert any("D-03" in e for e in errors)

    def test_cross_reference_logic_ffmpeg_only_valid(self):
        """FFmpeg-only source with no confirming words is valid."""
        errors = validate_cross_reference_logic(
            silence_candidates=[{"start": 1.0}],
            words=[{"start": 1.0, "end": 1.5, "no_speech_prob": 0.2}],
            confirmed_source="ffmpeg",
        )
        assert len(errors) == 0