"""End-to-end ffprobe-based encode-quality tests for ffmpeg-finalizer.

Exercises the post-Plan-02 source changes end-to-end with a synthetic NO-AUDIO lavfi
fixture — intentionally exercising the -an branch (D-13) so the "no-audio inheritance"
claim has a real test backing it instead of just a code-path-shared assertion.

Referenced requirements:
- ENC-02: CRF 18 enforcement (Phase 13)
- ENC-03: BT.709 color tag validation (Phase 13)
- ENC-04: Lanczos scaling + unsharp filter (Phase 13)
- ENC-05: Duration parity ±33ms (Phase 13)

Decisions enforced:
- D-03 (Phase 13): H.264 CRF 18
- D-05: Unsharp filter applied post-scale (ENC-04)
- D-06: Safe zone metadata present in manifest
- D-08: Lanczos scaling flag
- D-09: Encoding preset medium
- D-10: BT.709 metadata tags (ENC-03)
- D-11: Duration parity from ffprobe-based validators (ENC-05)
- D-13: No-audio branch inherits all Phase 13 changes (Lanczos, unsharp, BT.709, CRF 18)
- D-14: Duration parity exercises the no-audio branch (ENC-05)
"""

import pytest
import subprocess
import shutil
import sys
import os

# Add parent directory to path for imports (matches test_finalizer.py pattern)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.crop import apply_finalizer, probe_video
from src.validate import validate_color_tags, validate_bitrate_range, validate_duration_parity, validate_finalizer_info
from src import config


# ─────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def synth_source_mp4(tmp_path_factory):
    """Synthesize a NO-AUDIO 5-second lavfi clip.

    The `-an` flag and absence of any audio input ensure probe_video reports
    has_audio=False, routing apply_finalizer through the `-an` branch (D-13).
    This sidesteps the loudnorm/audio-bitrate config constants entirely — those
    are exercised by integration tests in scripts/test-ffmpeg-finalizer.sh, not here.
    """
    if shutil.which("ffmpeg") is None:
        pytest.skip("ffmpeg not on PATH")

    path = tmp_path_factory.mktemp("encode-quality") / "source.mp4"
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "testsrc=duration=5:size=1920x1080:rate=30",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-an",  # Explicit no-audio — intentionally routes through D-13 branch
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"ffmpeg failed to synthesize lavfi clip: {result.stderr}"
    )
    yield str(path)


@pytest.fixture
def finalizer_output(synth_source_mp4, tmp_path):
    """Run apply_finalizer on the NO-AUDIO lavfi fixture.

    Sanity-asserts has_audio=False before running so that the D-13 branch
    path is guaranteed: the test fails immediately if the fixture accidentally
    acquired an audio stream rather than silently exercising the wrong branch.
    """
    if shutil.which("ffprobe") is None:
        pytest.skip("ffprobe not on PATH")

    probe_info = probe_video(synth_source_mp4)
    assert probe_info["has_audio"] is False, (
        "Fixture must be no-audio to exercise D-13 — "
        "the -an branch of apply_finalizer must be exercised here."
    )

    output_path = str(tmp_path / "finalized.mp4")
    result = apply_finalizer(
        synth_source_mp4,
        output_path,
        config.VERTICAL_WIDTH,
        config.VERTICAL_HEIGHT,
        probe_info,
    )
    yield (output_path, result)


# ─────────────────────────────────────────────────────────
# Test class: TestEncodeQuality
# ─────────────────────────────────────────────────────────

class TestEncodeQuality:
    """End-to-end ffprobe-based encode-quality assertions on a NO-AUDIO lavfi fixture."""

    def test_finalizer_color_tags_are_bt709(self, finalizer_output):
        """ENC-03 / D-10 / D-13: ffprobe confirms color_space, color_primaries, color_transfer
        all equal bt709 even on the no-audio branch."""
        output_path, _ = finalizer_output
        errors = validate_color_tags(output_path)
        assert errors == [], errors

    def test_finalizer_bitrate_in_band(self, finalizer_output):
        """ENC-02 / D-11: synthetic-fixture bitrate falls in a relaxed band (2000-15000 kbps).

        The production 5000-8000 kbps band is exercised in Plan 04 Task 3 against a real
        talking-head clip. The synthetic 5s lavfi testsrc has different content statistics
        than a real talking-head, so this test uses a wider band that still catches badly
        misconfigured encodes (e.g. <500 kbps or >50000 kbps).
        """
        output_path, _ = finalizer_output
        errors = validate_bitrate_range(output_path, min_kbps=2000, max_kbps=15000)
        assert errors == [], errors

    def test_finalizer_unsharp_and_lanczos_in_manifest(self, finalizer_output):
        """ENC-04 / D-05, D-06, D-08, D-13: manifest fields confirm Lanczos + unsharp +
        BT.709 were applied on the no-audio branch."""
        _, result = finalizer_output
        assert result["lanczos_scaling"] is True
        assert result["unsharp_filter"] == "5:5:0.5:5:5:0.3"
        assert result["color_space"] == "bt709"
        assert result["color_primaries"] == "bt709"
        assert result["color_transfer"] == "bt709"

    def test_finalizer_crf_is_18(self, finalizer_output):
        """ENC-02 / D-03: manifest reports CRF 18 (was 20 in Phase 4)."""
        _, result = finalizer_output
        assert result["h264_crf"] == 18

    def test_duration_parity_after_finalizer(self, synth_source_mp4, finalizer_output):
        """ENC-05 / D-11, D-14: source-to-finalizer duration delta within tolerance
        on the no-audio branch.

        Uses a relaxed tolerance of 100ms (instead of the production 33ms) because lavfi
        testsrc duration rounding can differ by a few frames vs the production 33ms gate.
        The production ±33ms gate is exercised in Plan 04 against the real talking-head clip.
        """
        output_path, _ = finalizer_output
        errors = validate_duration_parity(synth_source_mp4, output_path, tolerance_ms=100)
        assert errors == [], errors

    def test_finalizer_no_audio_branch_executed(self, finalizer_output):
        """D-13: ffprobe confirms the output has NO audio stream, proving the `-an` branch
        executed and that all Phase 13 changes (Lanczos, unsharp, BT.709, CRF 18) apply
        equally to no-audio inputs."""
        output_path, _ = finalizer_output
        probe_cmd = [
            "ffprobe", "-v", "quiet",
            "-select_streams", "a",
            "-show_entries", "stream=codec_type",
            "-of", "csv=p=0",
            output_path,
        ]
        r = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
        assert r.stdout.strip() == "", (
            f"Expected no audio stream in finalizer output (D-13 -an branch), "
            f"got: {r.stdout!r}"
        )
