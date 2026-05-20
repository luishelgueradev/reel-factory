"""Unit tests for silence cutter — schema, silencedetect parsing, cross-reference, and validation.

Follows the whisper/tests/test_transcription.py pattern with pytest.
Tests validate SILC-01/02/03/04 requirements and D-01/D-03/D-07 decisions.
Phase 13 extensions cover ENC-01 (stream-copy concat validation) and D-01 / D-14 (-c copy edge cases).

Referenced requirements:
- SILC-01: Cross-referenced silence detection (FFmpeg + Whisper)
- SILC-02: Hard cuts (no transitions)
- SILC-03: A/V sync preservation
- SILC-04: JSON cut list artifact
- D-01: Intersection approach (both sources)
- D-03: ANY-word threshold for Whisper confirmation
- D-07: Detailed schema with cumulative_shift
- ENC-01: Stream-copy in silence-cutter concat (Phase 13)
- D-14: -c copy edge cases — variable keyframe spacing and audio-shorter-than-video (Phase 13)
"""

import pytest
import json
import subprocess
import shutil
import sys
import os

# Add parent directory to path for imports (matches whisper test pattern)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.schema import SilenceCut, SilenceCutList, SilenceSource
from src.silencedetect import _parse_silencedetect_output, SilenceSegment
from src.cross_reference import _check_silence
from src.cut_video import _compute_keep_segments
from src.validate import validate_silence_cuts, validate_cross_reference_logic, validate_concat_mode
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

    def test_no_words_confirms_both(self):
        """No words in silence region → pure silence → BOTH."""
        result = _check_silence(1.0, 3.0, [], 30.0)
        assert result is not None
        assert result[2] == SilenceSource.BOTH

    def test_high_no_speech_prob_confirms_both(self):
        """D-03: ANY word with no_speech_prob > threshold confirms → BOTH."""
        words = [
            {"start": 1.0, "end": 1.5, "no_speech_prob": 0.8},
        ]
        result = _check_silence(1.0, 2.0, words, 30.0)
        assert result is not None
        assert result[2] == SilenceSource.BOTH

    def test_dense_speech_rejected(self):
        """Words covering >50% of silence region → rejected (returns None)."""
        words = [
            {"start": 1.0, "end": 2.5, "no_speech_prob": 0.05},
        ]
        result = _check_silence(1.0, 3.0, words, 30.0)
        assert result is None

    def test_edge_overlap_ffmpeg_source(self):
        """Sparse edge overlap (<50% speech) → FFMPEG source."""
        words = [
            {"start": 1.0, "end": 1.3, "no_speech_prob": 0.05},
        ]
        result = _check_silence(1.0, 3.0, words, 30.0)
        assert result is not None
        assert result[2] == SilenceSource.FFMPEG

    def test_any_word_threshold(self):
        """D-03: Only ONE word needs high no_speech_prob to confirm."""
        words = [
            {"start": 1.0, "end": 1.5, "no_speech_prob": 0.2},
            {"start": 1.5, "end": 2.0, "no_speech_prob": 0.9},
            {"start": 2.0, "end": 2.5, "no_speech_prob": 0.1},
        ]
        result = _check_silence(1.0, 2.5, words, 30.0)
        assert result is not None
        assert result[2] == SilenceSource.BOTH

    def test_no_overlapping_words_confirms_both(self):
        """No words overlapping silence region → BOTH (pure silence)."""
        words = [
            {"start": 5.0, "end": 6.0, "no_speech_prob": 0.9},
        ]
        result = _check_silence(1.0, 2.0, words, 30.0)
        assert result is not None
        assert result[2] == SilenceSource.BOTH

    def test_low_no_speech_prob_sparse_speech(self):
        """Low no_speech_prob with sparse speech (<50%) → FFMPEG source."""
        words = [
            {"start": 1.0, "end": 1.2, "no_speech_prob": 0.2},
        ]
        result = _check_silence(1.0, 3.0, words, 30.0)
        assert result is not None
        assert result[2] == SilenceSource.FFMPEG

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


# ─────────────────────────────────────────────────────────
# Module-level helpers (used by TestConcatMode and TestConcatEdgeCases)
# ─────────────────────────────────────────────────────────

def _synth_clip(path, duration=2, seed=0):
    """Synthesize a small audio+video lavfi clip for concat testing.

    Uses 320x240 to keep tests fast. Includes an audio stream (sine wave)
    so the concat demuxer can map both video and audio streams.
    """
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"testsrc=duration={duration}:size=320x240:rate=30:decimals=2",
            "-f", "lavfi", "-i", f"sine=frequency={440 + seed * 55}:duration={duration}",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, f"ffmpeg clip synthesis failed: {result.stderr}"


def _synth_clip_with_gop(path, duration=3, gop=30, seed=0):
    """Synthesize a lavfi clip with an explicit keyframe interval (GOP size).

    Used by TestConcatEdgeCases to produce clips with deliberately mismatched
    keyframe intervals (e.g. `-g 15` vs `-g 60`) for the variable-keyframe D-14 test.
    """
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"testsrc=duration={duration}:size=320x240:rate=30",
            "-f", "lavfi", "-i", f"sine=frequency={440 + seed * 55}:duration={duration}",
            "-c:v", "libx264",
            "-g", str(gop),
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, f"ffmpeg GOP clip synthesis failed: {result.stderr}"


def _synth_clip_audio_short(path, video_duration=5, audio_duration=4, seed=0):
    """Synthesize a clip where audio is shorter than video.

    Emulates a Whisper-cut-silent-tail clip shape. The `-shortest 0` flag disables
    the default "stop at shortest stream" behaviour so the video stream runs its full
    duration even after the audio stream ends.
    """
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"testsrc=duration={video_duration}:size=320x240:rate=30",
            "-f", "lavfi", "-i", f"sine=frequency={440 + seed * 55}:duration={audio_duration}",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-shortest", "0",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, f"ffmpeg audio-short clip synthesis failed: {result.stderr}"


def _ffprobe_duration(path) -> float:
    """Return video duration in seconds via ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, f"ffprobe duration failed: {result.stderr}"
    return float(result.stdout.strip())


def _concat_stream_copy(list_path, out_path):
    """Concat clips via the EXACT ffmpeg shape from cut_video.py::_concatenate_segments (post Plan 01).

    Uses `-c copy -reset_timestamps 1` (ENC-01 / D-01 stream-copy shape).
    """
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(list_path),
            "-map", "0:v:0",
            "-map", "0:a:0?",
            "-c", "copy",
            "-reset_timestamps", "1",
            str(out_path),
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, f"ffmpeg stream-copy concat failed: {result.stderr}"


# ─────────────────────────────────────────────────────────
# Test 6: validate_concat_mode — stream-copy vs re-encode (ENC-01 / D-01)
# ─────────────────────────────────────────────────────────

class TestConcatMode:
    """Verify validate_concat_mode against real ffmpeg stream-copy and re-encode outputs (ENC-01 / D-01)."""

    def test_validate_concat_mode_stream_copy(self, tmp_path):
        """ENC-01 / D-01: stream-copied concat output has no fresh libx264/Lavc encoder tag,
        so the validator passes."""
        if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
            pytest.skip("ffmpeg/ffprobe not on PATH")

        clip_a = tmp_path / "a.mp4"
        clip_b = tmp_path / "b.mp4"
        _synth_clip(clip_a, duration=2, seed=0)
        _synth_clip(clip_b, duration=2, seed=1)

        list_file = tmp_path / "list.txt"
        list_file.write_text(
            f"file '{str(clip_a)}'\nfile '{str(clip_b)}'\n"
        )

        out_path = tmp_path / "concat_copy.mp4"
        # Exact ffmpeg argv from cut_video.py::_concatenate_segments (post Plan 01)
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(list_file),
                "-map", "0:v:0",
                "-map", "0:a:0?",
                "-c", "copy",
                "-reset_timestamps", "1",
                str(out_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert result.returncode == 0, f"ffmpeg stream-copy concat failed: {result.stderr}"

        errors = validate_concat_mode(str(out_path))
        assert errors == [], (
            f"validate_concat_mode returned errors for stream-copy concat: {errors}"
        )

    def test_validate_concat_mode_detects_reencode(self, tmp_path):
        """ENC-01: a re-encoded concat output carries a fresh encoder tag,
        so the validator flags it."""
        if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
            pytest.skip("ffmpeg/ffprobe not on PATH")

        clip_a = tmp_path / "a.mp4"
        clip_b = tmp_path / "b.mp4"
        _synth_clip(clip_a, duration=2, seed=0)
        _synth_clip(clip_b, duration=2, seed=1)

        list_file = tmp_path / "list.txt"
        list_file.write_text(
            f"file '{str(clip_a)}'\nfile '{str(clip_b)}'\n"
        )

        out_path = tmp_path / "concat_reencode.mp4"
        # Re-encode with libx264 — the pre-Phase-13 concat shape; validator must flag it
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(list_file),
                "-map", "0:v:0",
                "-map", "0:a:0?",
                "-c:v", "libx264",
                "-c:a", "aac",
                "-reset_timestamps", "1",
                str(out_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert result.returncode == 0, f"ffmpeg re-encode concat failed: {result.stderr}"

        errors = validate_concat_mode(str(out_path))
        assert any("ENC-01" in e for e in errors), (
            f"validate_concat_mode should flag a re-encoded concat but returned: {errors}"
        )


# ─────────────────────────────────────────────────────────
# Test 7: -c copy edge cases (D-14 / ENC-05)
# ─────────────────────────────────────────────────────────

class TestConcatEdgeCases:
    """Verify -c copy concat preserves duration parity on edge cases: variable keyframe spacing
    and audio-shorter-than-video (D-14 / ENC-05)."""

    def test_concat_variable_keyframe_spacing_preserves_duration(self, tmp_path):
        """D-14 / ENC-05: -c copy concat preserves duration even when source clips have different
        GOP/keyframe intervals (`-g 15` vs `-g 60`). Tolerance: ±33ms (one frame at 30fps)."""
        if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
            pytest.skip("ffmpeg/ffprobe not on PATH")

        clip_a = tmp_path / "a.mp4"
        clip_b = tmp_path / "b.mp4"
        _synth_clip_with_gop(clip_a, duration=3, gop=15, seed=0)
        _synth_clip_with_gop(clip_b, duration=3, gop=60, seed=1)

        dur_a = _ffprobe_duration(clip_a)
        dur_b = _ffprobe_duration(clip_b)

        list_file = tmp_path / "list.txt"
        list_file.write_text(
            f"file '{str(clip_a)}'\nfile '{str(clip_b)}'\n"
        )

        out_path = tmp_path / "concat_gop.mp4"
        _concat_stream_copy(list_file, out_path)

        concat_dur = _ffprobe_duration(out_path)
        delta_ms = abs(concat_dur - (dur_a + dur_b)) * 1000
        assert delta_ms <= 33, (
            f"Duration delta {delta_ms:.1f}ms exceeds ±33ms tolerance. "
            f"clip_a={dur_a:.3f}s, clip_b={dur_b:.3f}s, concat={concat_dur:.3f}s, "
            f"expected sum≈{dur_a + dur_b:.3f}s"
        )

    def test_concat_audio_shorter_than_video_preserves_duration(self, tmp_path):
        """D-14 / ENC-05: -c copy concat preserves video duration even when each source clip has
        audio one second shorter than video (the Whisper-cut-silent-tail shape).

        Tolerance: ±100ms — relaxed slightly because mismatched A/V can produce small
        concat-rounding artifacts; the production ±33ms gate runs against the real
        talking-head clip in Plan 04.
        """
        if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
            pytest.skip("ffmpeg/ffprobe not on PATH")

        clip_a = tmp_path / "a.mp4"
        clip_b = tmp_path / "b.mp4"
        _synth_clip_audio_short(clip_a, video_duration=5, audio_duration=4, seed=0)
        _synth_clip_audio_short(clip_b, video_duration=5, audio_duration=4, seed=1)

        dur_a = _ffprobe_duration(clip_a)
        dur_b = _ffprobe_duration(clip_b)

        list_file = tmp_path / "list.txt"
        list_file.write_text(
            f"file '{str(clip_a)}'\nfile '{str(clip_b)}'\n"
        )

        out_path = tmp_path / "concat_ashort.mp4"
        _concat_stream_copy(list_file, out_path)

        concat_dur = _ffprobe_duration(out_path)
        delta_ms = abs(concat_dur - (dur_a + dur_b)) * 1000
        assert delta_ms <= 100, (
            f"Duration delta {delta_ms:.1f}ms exceeds ±100ms tolerance. "
            f"clip_a={dur_a:.3f}s, clip_b={dur_b:.3f}s, concat={concat_dur:.3f}s, "
            f"expected sum≈{dur_a + dur_b:.3f}s"
        )