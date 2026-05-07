"""Unit tests for ffmpeg finalizer — crop logic, schema, config, and validation.

Follows the silence-cutter/tests/test_silence_cutter.py pattern with pytest.
Tests validate VERT-01/02/03 requirements and D-01/D-02/D-03/D-04/D-06/D-08/D-09/D-10/D-11 decisions.

Referenced requirements:
- VERT-01: Output is 9:16 vertical format (1080x1920)
- VERT-02: Center-crop strategy for wider-than-9:16 inputs
- VERT-03: Safe zone metadata for Phase 5 subtitle positioning
- D-01: Center-crop only (no smart reframing in v1)
- D-02: Pure center crop anchor (geometric center)
- D-03: Conditional crop path (skip crop for 9:16 inputs)
- D-04: Uniform 1080x1920 output regardless of input
- D-06: Safe zone values (top=100, bottom=230, left=54, right=54)
- D-08: H.264 CRF 20
- D-09: Encoding preset medium
- D-10: Loudnorm audio normalization (I=-14, TP=-1, LRA=11)
- D-11: Force 30fps output
"""

import pytest
import sys
import os

# Add parent directory to path for imports (matches whisper/silence-cutter test pattern)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.crop import compute_crop
from src.schema import FinalizerInfo, SafeZone
from src.validate import validate_finalizer_info, validate_crop_logic
from src import config


# ─────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────

@pytest.fixture
def valid_finalizer_info_dict() -> dict:
    """A valid finalizer-info.json dict (16:9 input with center crop applied)."""
    return {
        "input_width": 1920,
        "input_height": 1080,
        "input_aspect_ratio": "16:9",
        "output_width": 1080,
        "output_height": 1920,
        "output_aspect_ratio": "9:16",
        "crop_strategy": "center",
        "crop_applied": True,
        "crop_x": 420,
        "crop_y": 0,
        "crop_width": 1080,
        "crop_height": 1920,
        "h264_crf": 20,
        "h264_preset": "medium",
        "audio_normalization": True,
        "safe_zone": {
            "top": 100,
            "bottom": 230,
            "left": 54,
            "right": 54,
        },
    }


@pytest.fixture
def no_crop_info_dict() -> dict:
    """A valid finalizer-info.json dict for 9:16 input (no crop)."""
    return {
        "input_width": 1080,
        "input_height": 1920,
        "input_aspect_ratio": "9:16",
        "output_width": 1080,
        "output_height": 1920,
        "output_aspect_ratio": "9:16",
        "crop_strategy": "center",
        "crop_applied": False,
        "crop_x": 0,
        "crop_y": 0,
        "crop_width": 1080,
        "crop_height": 1920,
        "h264_crf": 20,
        "h264_preset": "medium",
        "audio_normalization": True,
        "safe_zone": {
            "top": 100,
            "bottom": 230,
            "left": 54,
            "right": 54,
        },
    }


# ─────────────────────────────────────────────────────────
# Test 1: Config constants (D-04, D-06, D-08, D-09, D-10, D-11)
# ─────────────────────────────────────────────────────────

class TestConfig:
    """Verify config constants match CONTEXT.md decisions."""

    def test_output_dimensions(self):
        """VERTICAL_WIDTH=1080, VERTICAL_HEIGHT=1920 (D-04)."""
        assert config.VERTICAL_WIDTH == 1080
        assert config.VERTICAL_HEIGHT == 1920

    def test_safe_zone_values(self):
        """SAFE_ZONE_TOP=100, BOTTOM=230, LEFT=54, RIGHT=54 (D-06)."""
        assert config.SAFE_ZONE_TOP == 100
        assert config.SAFE_ZONE_BOTTOM == 230
        assert config.SAFE_ZONE_LEFT == 54
        assert config.SAFE_ZONE_RIGHT == 54

    def test_encoding_params(self):
        """H264_CRF=20 (D-08), H264_PRESET='medium' (D-09)."""
        assert config.H264_CRF == 20  # D-08
        assert config.H264_PRESET == "medium"  # D-09

    def test_audio_params(self):
        """LOUDNORM_TARGET='-14' (D-10), FPS_OUTPUT=30 (D-11)."""
        assert config.LOUDNORM_TARGET == "-14"  # D-10
        assert config.FPS_OUTPUT == 30  # D-11


# ─────────────────────────────────────────────────────────
# Test 2: Crop computation logic (D-01, D-03, VERT-02)
# ─────────────────────────────────────────────────────────

class TestComputeCrop:
    """Verify crop computation logic per D-01, D-03, VERT-02."""

    def test_no_crop_for_9_16_input(self):
        """1080x1920 input → (0, 0, 1080, 1920), no crop needed (D-03)."""
        crop_x, crop_y, crop_w, crop_h = compute_crop(1080, 1920, 1080, 1920)
        assert crop_x == 0
        assert crop_y == 0
        assert crop_w == 1080
        assert crop_h == 1920

    def test_no_crop_for_near_9_16_input(self):
        """1079x1920 (within 0.5% tolerance) → no crop (D-03)."""
        crop_x, crop_y, crop_w, crop_h = compute_crop(1079, 1920, 1080, 1920)
        # Within tolerance — should return zero-offset with input dimensions
        assert crop_x == 0
        assert crop_y == 0

    def test_crop_wide_16_9_input(self):
        """1920x1080 input → center crop to 1080 width (D-01, VERT-02)."""
        crop_x, crop_y, crop_w, crop_h = compute_crop(1920, 1080, 1080, 1920)
        # Input is wider — crop sides, keep height, reduce width
        assert crop_y == 0  # No vertical crop
        assert crop_h == 1080  # Full height preserved
        # Crop width should be approximately input_height * (9/16) = 607.5 → 608
        # crop_x should center: (1920 - 608) // 2 = 656
        assert crop_x > 0  # Horizontal crop applied
        assert crop_w < 1920  # Width reduced

    def test_crop_4_3_input(self):
        """1440x1080 input → center crop appropriately."""
        crop_x, crop_y, crop_w, crop_h = compute_crop(1440, 1080, 1080, 1920)
        # Input 4:3 is wider than 9:16 — crop sides
        assert crop_x > 0  # Center offset
        assert crop_w < 1440  # Width reduced

    def test_crop_extremely_wide_input(self):
        """3840x1080 → crop to narrow width."""
        crop_x, crop_y, crop_w, crop_h = compute_crop(3840, 1080, 1080, 1920)
        # Extremely wide input — significant horizontal crop
        assert crop_x > 0
        assert crop_w < 3840

    def test_input_taller_than_9_16(self):
        """720x1280 (narrow/tall input) → crop handled correctly."""
        crop_x, crop_y, crop_w, crop_h = compute_crop(720, 1280, 1080, 1920)
        # Input 9:16 aspect ratio (720/1280 = 0.5625, 1080/1920 = 0.5625)
        # Should be within tolerance — no crop needed
        assert crop_x == 0
        assert crop_y == 0

    def test_even_dimensions(self):
        """All crop values are even (FFmpeg requirement)."""
        # Test with various odd-dimension inputs
        for in_w, in_h in [(1921, 1081), (1441, 1081), (3841, 1081)]:
            crop_x, crop_y, crop_w, crop_h = compute_crop(in_w, in_h, 1080, 1920)
            # crop_width and crop_height must be even
            assert crop_w % 2 == 0, f"crop_width {crop_w} not even for {in_w}x{in_h}"
            assert crop_h % 2 == 0, f"crop_height {crop_h} not even for {in_w}x{in_h}"


# ─────────────────────────────────────────────────────────
# Test 3: Schema validation (D-03, D-06)
# ─────────────────────────────────────────────────────────

class TestSchema:
    """Verify FinalizerInfo and SafeZone schemas per D-03, D-06."""

    def test_finalizer_info_with_crop(self):
        """Create FinalizerInfo with crop_applied=True."""
        info = FinalizerInfo(
            input_width=1920,
            input_height=1080,
            input_aspect_ratio="16:9",
            output_width=1080,
            output_height=1920,
            output_aspect_ratio="9:16",
            crop_strategy="center",
            crop_applied=True,
            crop_x=420,
            crop_y=0,
            crop_width=1080,
            crop_height=1920,
            h264_crf=20,
            h264_preset="medium",
            audio_normalization=True,
            safe_zone=SafeZone(top=100, bottom=230, left=54, right=54),
        )
        assert info.crop_applied is True
        assert info.crop_x == 420

    def test_finalizer_info_without_crop(self):
        """Create FinalizerInfo with crop_applied=False (D-03)."""
        info = FinalizerInfo(
            input_width=1080,
            input_height=1920,
            input_aspect_ratio="9:16",
            output_width=1080,
            output_height=1920,
            output_aspect_ratio="9:16",
            crop_strategy="center",
            crop_applied=False,
            crop_x=0,
            crop_y=0,
            crop_width=1080,
            crop_height=1920,
            h264_crf=20,
            h264_preset="medium",
            audio_normalization=True,
            safe_zone=SafeZone(top=100, bottom=230, left=54, right=54),
        )
        assert info.crop_applied is False
        assert info.crop_x == 0
        assert info.crop_y == 0

    def test_safe_zone_values(self):
        """SafeZone model with correct values (D-06)."""
        zone = SafeZone(top=100, bottom=230, left=54, right=54)
        assert zone.top == 100
        assert zone.bottom == 230
        assert zone.left == 54
        assert zone.right == 54

    def test_crop_applied_field_exists(self):
        """crop_applied is a required bool field (D-03)."""
        # FinalizerInfo should require crop_applied
        with pytest.raises(Exception):
            FinalizerInfo(
                input_width=1920,
                input_height=1080,
                input_aspect_ratio="16:9",
                output_width=1080,
                output_height=1920,
                output_aspect_ratio="9:16",
                crop_strategy="center",
                # Missing crop_applied
                crop_x=0,
                crop_y=0,
                crop_width=1080,
                crop_height=1920,
                h264_crf=20,
                h264_preset="medium",
                audio_normalization=True,
                safe_zone=SafeZone(top=100, bottom=230, left=54, right=54),
            )


# ─────────────────────────────────────────────────────────
# Test 4: Validation functions (VERT-01/02/03, D-02, D-03)
# ─────────────────────────────────────────────────────────

class TestValidation:
    """Verify validate functions per VERT-XX/D-XX requirements."""

    def test_validate_valid_info(self, valid_finalizer_info_dict):
        """Valid FinalizerInfo dict passes all checks."""
        errors = validate_finalizer_info(valid_finalizer_info_dict)
        assert len(errors) == 0

    def test_validate_wrong_dimensions(self):
        """Output not 1080x1920 fails VERT-01."""
        data = {
            "output_width": 720,
            "output_height": 1280,
            "crop_strategy": "center",
            "crop_applied": False,
            "h264_crf": 20,
            "audio_normalization": True,
            "safe_zone": {"top": 100, "bottom": 230, "left": 54, "right": 54},
        }
        errors = validate_finalizer_info(data)
        assert any("VERT-01" in e for e in errors)

    def test_validate_crop_not_center(self):
        """crop_strategy != 'center' fails VERT-02."""
        data = {
            "output_width": 1080,
            "output_height": 1920,
            "crop_strategy": "smart",
            "crop_applied": False,
            "h264_crf": 20,
            "audio_normalization": True,
            "safe_zone": {"top": 100, "bottom": 230, "left": 54, "right": 54},
        }
        errors = validate_finalizer_info(data)
        assert any("VERT-02" in e for e in errors)

    def test_validate_missing_safe_zone(self):
        """Missing safe_zone fails VERT-03."""
        data = {
            "output_width": 1080,
            "output_height": 1920,
            "crop_strategy": "center",
            "crop_applied": False,
            "h264_crf": 20,
            "audio_normalization": True,
        }
        errors = validate_finalizer_info(data)
        assert any("VERT-03" in e for e in errors)

    def test_validate_crop_logic_no_crop_for_9_16(self):
        """9:16 input with crop_applied=True fails D-03."""
        data = {
            "input_width": 1080,
            "input_height": 1920,
            "crop_applied": True,
            "crop_x": 0,
            "crop_y": 0,
            "crop_width": 1080,
            "crop_height": 1920,
        }
        errors = validate_crop_logic(data)
        assert any("D-03" in e for e in errors)

    def test_validate_crop_centers_horizontally(self, valid_finalizer_info_dict):
        """crop_x matches center calculation (D-02)."""
        # valid data has crop_x=420 for 1920x1080 input with crop_width=1080
        # expected: (1920 - 1080) // 2 = 420
        errors = validate_crop_logic(valid_finalizer_info_dict)
        # No D-02 errors expected — crop is centered
        assert not any("D-02" in e for e in errors)

    def test_validate_crop_off_center(self):
        """Off-center crop_x fails D-02."""
        data = {
            "input_width": 1920,
            "input_height": 1080,
            "crop_applied": True,
            "crop_x": 100,  # Should be 420 for center crop
            "crop_y": 0,
            "crop_width": 1080,
            "crop_height": 1080,
        }
        errors = validate_crop_logic(data)
        assert any("D-02" in e for e in errors)

    def test_validate_crop_exceeds_bounds(self):
        """Crop region exceeding input boundaries fails D-01."""
        data = {
            "input_width": 1920,
            "input_height": 1080,
            "crop_applied": True,
            "crop_x": 1000,
            "crop_y": 0,
            "crop_width": 1080,  # 1000 + 1080 = 2080 > 1920
            "crop_height": 1080,
        }
        errors = validate_crop_logic(data)
        assert any("D-01" in e for e in errors)