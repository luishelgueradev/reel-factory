"""Unit tests for quality-finalizer's probe-gated downscale logic (D-08).

These tests exercise needs_downscale() with mock probe-info dicts; they do
NOT invoke ffmpeg or ffprobe and they do not require a real video file.
"""

import os
import sys

# Ensure the quality-finalizer package root is importable when running pytest
# from the service directory (mirrors ffmpeg-finalizer test conftest pattern).
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.downscale import needs_downscale  # noqa: E402


def test_needs_downscale_scale2_input():
    """D-08: A 2x supersampled input (2160x3840) MUST trigger the Lanczos path."""
    probe_info = {"width": 2160, "height": 3840, "has_audio": True, "duration": 60.0}
    assert needs_downscale(probe_info) is True


def test_needs_downscale_already_target():
    """D-08: An input already at the 1080x1920 deliverable MUST be stream-copied."""
    probe_info = {"width": 1080, "height": 1920, "has_audio": True, "duration": 60.0}
    assert needs_downscale(probe_info) is False


def test_needs_downscale_partial_larger():
    """D-08: If only width exceeds the target, the Lanczos path still triggers."""
    probe_info = {"width": 2160, "height": 1920, "has_audio": True, "duration": 60.0}
    assert needs_downscale(probe_info) is True
