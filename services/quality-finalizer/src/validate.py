"""Quality-finalizer output validators — RENDER-03 checks on the downscaled MP4.

Mirrors ffmpeg-finalizer/validate.py's pattern: validators return a list of
error strings prefixed 'RENDER-03:' (the requirement this step satisfies).
Empty list means all checks passed.

Functions:
- validate_color_tags(output_mp4_path)               — D-11 BT.709 carry-through
- validate_duration_parity(input, output, tol_ms=33) — D-10 A/V parity (±1 frame at 30fps)
- validate_dimensions(output_mp4_path, w=1080, h=1920) — D-08 output dims
"""

import json
import subprocess
from typing import List


def validate_color_tags(output_mp4_path: str) -> List[str]:
    """Validate BT.709 color tags on the quality-finalizer output (D-11).

    Invokes ffprobe to check color_space, color_primaries, and color_transfer
    are all 'bt709' on the first video stream. Returns [] when all three
    fields equal 'bt709'; otherwise returns error strings prefixed
    'RENDER-03:'. On ffprobe failure, returns a single error string rather
    than raising.

    Args:
        output_mp4_path: Path to the quality-finalizer output MP4.

    Returns:
        List of error strings (RENDER-03: ...) or empty list if all tags are correct.
    """
    errors: List[str] = []
    cmd = [
        "ffprobe", "-v", "quiet",
        "-select_streams", "v:0",
        "-show_entries", "stream=color_space,color_primaries,color_transfer",
        "-of", "json",
        output_mp4_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception as exc:
        errors.append(f"RENDER-03: ffprobe failed: {exc}")
        return errors

    if result.returncode != 0:
        errors.append(f"RENDER-03: ffprobe failed: {result.stderr.strip()}")
        return errors

    try:
        data = json.loads(result.stdout)
    except (json.JSONDecodeError, ValueError) as exc:
        errors.append(f"RENDER-03: ffprobe output could not be parsed as JSON: {exc}")
        return errors

    streams = data.get("streams", [])
    if not streams:
        errors.append("RENDER-03: ffprobe returned no video streams (D-11)")
        return errors

    stream = streams[0]
    for field in ["color_space", "color_primaries", "color_transfer"]:
        actual = stream.get(field)
        if actual != "bt709":
            errors.append(f"RENDER-03: {field} is '{actual}', expected 'bt709' (D-11)")

    return errors


def validate_duration_parity(
    input_path: str,
    output_path: str,
    tolerance_ms: int = 33,
) -> List[str]:
    """Validate that input and output have matching duration within tolerance (D-10).

    Invokes ffprobe on both files and checks abs(d1 - d2) * 1000 <= tolerance_ms.
    Default tolerance is 33ms (one frame at 30fps). Returns [] when within
    tolerance; otherwise returns an error string prefixed 'RENDER-03:'. On
    ffprobe failure for either file, returns a single error.

    Args:
        input_path: Path to the quality-finalizer input MP4 (remotion-renderer output).
        output_path: Path to the quality-finalizer output MP4 (downscaled).
        tolerance_ms: Maximum acceptable duration delta in milliseconds (default 33ms).

    Returns:
        List of error strings (RENDER-03: ...) or empty list if duration parity holds.
    """
    errors: List[str] = []

    def _get_duration(path: str):
        """Return (float seconds, None) on success or (None, error_str) on failure."""
        cmd = [
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            path,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        except Exception as exc:
            return None, f"RENDER-03: ffprobe failed on {path}: {exc}"
        if result.returncode != 0:
            return None, f"RENDER-03: ffprobe failed on {path}: {result.stderr.strip()}"
        try:
            return float(result.stdout.strip()), None
        except (ValueError, TypeError):
            return None, f"RENDER-03: could not parse duration from ffprobe output for {path}"

    d1, err1 = _get_duration(input_path)
    if err1:
        errors.append(err1)
        return errors

    d2, err2 = _get_duration(output_path)
    if err2:
        errors.append(err2)
        return errors

    delta_ms = abs(d1 - d2) * 1000
    if delta_ms > tolerance_ms:
        errors.append(
            f"RENDER-03: duration delta {delta_ms:.1f}ms exceeds tolerance {tolerance_ms}ms (D-10)"
        )

    return errors


def validate_dimensions(
    output_mp4_path: str,
    expected_width: int = 1080,
    expected_height: int = 1920,
) -> List[str]:
    """Validate that the quality-finalizer output is exactly 1080x1920 (D-08).

    Invokes ffprobe to read width/height from the first video stream. Returns
    [] when both dimensions match the expected values; otherwise returns error
    strings prefixed 'RENDER-03:'. On ffprobe failure, returns a single error
    string rather than raising.

    Args:
        output_mp4_path: Path to the quality-finalizer output MP4.
        expected_width: Required output width (default 1080).
        expected_height: Required output height (default 1920).

    Returns:
        List of error strings (RENDER-03: ...) or empty list if dimensions match.
    """
    errors: List[str] = []
    cmd = [
        "ffprobe", "-v", "quiet",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        output_mp4_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception as exc:
        errors.append(f"RENDER-03: ffprobe failed: {exc}")
        return errors

    if result.returncode != 0:
        errors.append(f"RENDER-03: ffprobe failed: {result.stderr.strip()}")
        return errors

    try:
        data = json.loads(result.stdout)
    except (json.JSONDecodeError, ValueError) as exc:
        errors.append(f"RENDER-03: ffprobe output could not be parsed as JSON: {exc}")
        return errors

    streams = data.get("streams", [])
    if not streams:
        errors.append("RENDER-03: ffprobe returned no video streams (D-08)")
        return errors

    stream = streams[0]
    actual_w = stream.get("width")
    actual_h = stream.get("height")
    if actual_w != expected_width:
        errors.append(
            f"RENDER-03: width is {actual_w}, expected {expected_width} (D-08)"
        )
    if actual_h != expected_height:
        errors.append(
            f"RENDER-03: height is {actual_h}, expected {expected_height} (D-08)"
        )

    return errors
