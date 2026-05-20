"""FFmpeg finalizer validation — checks output against VERT, ENC-02/ENC-03/ENC-05 requirements and D-XX decisions.

Per the silence-cutter/validate.py pattern: validate functions return a list of
error strings referencing specific requirement IDs (VERT-XX, ENC-XX) and decision
IDs (D-XX) for traceability. Empty list means all checks passed.

Phase 13 extensions: ENC-02 (CRF 18 enforcement), ENC-03 (BT.709 color tag
validation), ENC-05 (duration parity ±33ms). New validators: validate_color_tags,
validate_bitrate_range, validate_duration_parity.
"""

import subprocess
import json
from typing import List


def validate_finalizer_info(info_data: dict) -> List[str]:
    """Validate a finalizer-info.json dict against VERT requirements.

    Checks VERT-01/02/03 and D-XX decisions for output correctness.

    Args:
        info_data: Parsed finalizer-info.json as a dict.

    Returns:
        List of error strings referencing VERT-XX/D-XX requirements.
        Empty list means all checks passed.
    """
    errors = []

    # VERT-01: Output must be 9:16 (1080x1920)
    if "output_width" not in info_data:
        errors.append("VERT-01: Missing 'output_width' field")
    elif info_data["output_width"] != 1080:
        errors.append(f"VERT-01: output_width is {info_data['output_width']}, expected 1080")

    if "output_height" not in info_data:
        errors.append("VERT-01: Missing 'output_height' field")
    elif info_data["output_height"] != 1920:
        errors.append(f"VERT-01: output_height is {info_data['output_height']}, expected 1920")

    # VERT-02: Crop strategy must be "center" (D-01)
    if "crop_strategy" not in info_data:
        errors.append("VERT-02: Missing 'crop_strategy' field")
    elif info_data["crop_strategy"] != "center":
        errors.append(
            f"VERT-02: crop_strategy is '{info_data['crop_strategy']}', expected 'center' (D-01)"
        )

    # VERT-03: safe_zone field must exist with integer top/bottom/left/right
    if "safe_zone" not in info_data:
        errors.append("VERT-03: Missing 'safe_zone' field")
    else:
        safe_zone = info_data["safe_zone"]
        if not isinstance(safe_zone, dict):
            errors.append("VERT-03: 'safe_zone' must be a dict with top/bottom/left/right")
        else:
            for field in ["top", "bottom", "left", "right"]:
                if field not in safe_zone:
                    errors.append(f"VERT-03: safe_zone missing '{field}' field")
                elif not isinstance(safe_zone[field], int):
                    errors.append(
                        f"VERT-03: safe_zone.{field} must be an integer, got {type(safe_zone[field]).__name__}"
                    )

    # D-03: crop_applied field must exist and be boolean
    if "crop_applied" not in info_data:
        errors.append("D-03: Missing 'crop_applied' field")
    elif not isinstance(info_data["crop_applied"], bool):
        errors.append(
            f"D-03: crop_applied must be boolean, got {type(info_data['crop_applied']).__name__}"
        )

    # D-04: Output dimensions must be 1080x1920 (uniform output size)
    # (Duplicated check with VERT-01, but logged under D-04 for traceability)
    if "output_width" in info_data and info_data["output_width"] != 1080:
        errors.append("D-04: output_width must be 1080 for uniform output size")
    if "output_height" in info_data and info_data["output_height"] != 1920:
        errors.append("D-04: output_height must be 1920 for uniform output size")

    # D-06: Safe zone values must match config constants
    if "safe_zone" in info_data and isinstance(info_data["safe_zone"], dict):
        safe_zone = info_data["safe_zone"]
        if "top" in safe_zone and safe_zone["top"] != 100:
            errors.append(f"D-06: safe_zone.top is {safe_zone['top']}, expected 100")
        if "bottom" in safe_zone and safe_zone["bottom"] != 230:
            errors.append(f"D-06: safe_zone.bottom is {safe_zone['bottom']}, expected 230")
        if "left" in safe_zone and safe_zone["left"] != 54:
            errors.append(f"D-06: safe_zone.left is {safe_zone['left']}, expected 54")
        if "right" in safe_zone and safe_zone["right"] != 54:
            errors.append(f"D-06: safe_zone.right is {safe_zone['right']}, expected 54")

    # ENC-02 / D-03: H264 CRF must be 18 (Phase 4 D-08 superseded; tightened for sharper output)
    if "h264_crf" not in info_data:
        errors.append("ENC-02: Missing 'h264_crf' field")
    elif info_data["h264_crf"] != 18:
        errors.append(f"ENC-02: h264_crf is {info_data['h264_crf']}, expected 18 (D-03)")

    # D-10: Audio normalization present (when audio exists)
    if "audio_normalization" not in info_data:
        errors.append("D-10: Missing 'audio_normalization' field")
    elif not isinstance(info_data["audio_normalization"], bool):
        errors.append(
            f"D-10: audio_normalization must be boolean, got {type(info_data['audio_normalization']).__name__}"
        )

    return errors


def validate_crop_logic(info_data: dict) -> List[str]:
    """Validate the crop logic correctness against VERT requirements and D-XX decisions.

    Args:
        info_data: Parsed finalizer-info.json as a dict with crop and input fields.

    Returns:
        List of error strings referencing VERT-XX/D-XX requirements.
        Empty list means all checks passed.
    """
    errors = []

    # VERT-01: If crop is applied, verify crop dimensions are positive
    crop_applied = info_data.get("crop_applied")
    if crop_applied is True:
        crop_width = info_data.get("crop_width", 0)
        crop_height = info_data.get("crop_height", 0)
        if crop_width < 0:
            errors.append(f"VERT-01: crop_width is {crop_width}, must be >= 0 when crop applied")
        if crop_height < 0:
            errors.append(f"VERT-01: crop_height is {crop_height}, must be >= 0 when crop applied")

    # D-03: If input aspect ratio is 9:16 (within 0.5% tolerance), crop_applied should be False
    input_w = info_data.get("input_width")
    input_h = info_data.get("input_height")
    if input_w and input_h:
        input_ratio = input_w / input_h
        target_ratio = 1080 / 1920  # 9:16
        tolerance = 0.005
        if abs(input_ratio - target_ratio) / target_ratio <= tolerance:
            # Input is already 9:16 — crop should not be applied
            if crop_applied is True:
                errors.append(
                    f"D-03: crop_applied is True for {input_w}x{input_h} input with "
                    f"9:16 aspect ratio (within {tolerance*100}% tolerance), expected False"
                )
            crop_x = info_data.get("crop_x")
            crop_y = info_data.get("crop_y")
            if crop_x != 0:
                errors.append(
                    f"D-03: crop_x is {crop_x} for 9:16 input, expected 0 (no offset)"
                )
            if crop_y != 0:
                errors.append(
                    f"D-03: crop_y is {crop_y} for 9:16 input, expected 0 (no offset)"
                )

    # D-02: If crop is applied, crop_x should center the crop horizontally
    if crop_applied is True and input_w and input_h:
        crop_width = info_data.get("crop_width", 0)
        crop_x = info_data.get("crop_x", 0)
        expected_crop_x = (input_w - crop_width) // 2
        # Allow 1px tolerance for odd-number rounding
        if abs(crop_x - expected_crop_x) > 1:
            errors.append(
                f"D-02: crop_x is {crop_x}, expected {expected_crop_x} for center-crop "
                f"(input_width={input_w}, crop_width={crop_width})"
            )

    # D-01: Crop must not exceed input boundaries
    if input_w and input_h:
        crop_x = info_data.get("crop_x", 0)
        crop_y = info_data.get("crop_y", 0)
        crop_width = info_data.get("crop_width", 0)
        crop_height = info_data.get("crop_height", 0)
        if crop_x + crop_width > input_w:
            errors.append(
                f"D-01: crop_x ({crop_x}) + crop_width ({crop_width}) = {crop_x + crop_width} "
                f"exceeds input_width ({input_w})"
            )
        if crop_y + crop_height > input_h:
            errors.append(
                f"D-01: crop_y ({crop_y}) + crop_height ({crop_height}) = {crop_y + crop_height} "
                f"exceeds input_height ({input_h})"
            )

    return errors


def validate_color_tags(output_mp4_path: str) -> List[str]:
    """Validate BT.709 color tags on the finalizer output (ENC-03 / D-10).

    Invokes ffprobe to check that color_space, color_primaries, and color_transfer
    are all 'bt709' on the first video stream. Returns an empty list when all three
    fields equal 'bt709', otherwise returns error strings prefixed 'ENC-03:'.
    On ffprobe failure, returns a single error string rather than raising an exception.

    Args:
        output_mp4_path: Path to the ffmpeg-finalizer output MP4.

    Returns:
        List of error strings (ENC-03: ...) or empty list if all tags are correct.
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
        errors.append(f"ENC-03: ffprobe failed: {exc}")
        return errors

    if result.returncode != 0:
        errors.append(f"ENC-03: ffprobe failed: {result.stderr.strip()}")
        return errors

    try:
        data = json.loads(result.stdout)
    except (json.JSONDecodeError, ValueError) as exc:
        errors.append(f"ENC-03: ffprobe output could not be parsed as JSON: {exc}")
        return errors

    streams = data.get("streams", [])
    if not streams:
        errors.append("ENC-03: ffprobe returned no video streams (D-10)")
        return errors

    stream = streams[0]
    for field in ["color_space", "color_primaries", "color_transfer"]:
        actual = stream.get(field)
        if actual != "bt709":
            errors.append(f"ENC-03: {field} is '{actual}', expected 'bt709' (D-10)")

    return errors


def validate_bitrate_range(output_mp4_path: str, min_kbps: int = 5000, max_kbps: int = 8000) -> List[str]:
    """Validate that the finalizer output bitrate is within the expected band (ENC-02 / D-11).

    Invokes ffprobe to check that format.bit_rate / 1000 is in [min_kbps, max_kbps].
    Returns an empty list when the bitrate is in range, otherwise returns an error
    string prefixed 'ENC-02:'. On ffprobe failure, returns a single error string.

    Args:
        output_mp4_path: Path to the ffmpeg-finalizer output MP4.
        min_kbps: Minimum acceptable bitrate in kbps (default 5000).
        max_kbps: Maximum acceptable bitrate in kbps (default 8000).

    Returns:
        List of error strings (ENC-02: ...) or empty list if bitrate is in range.
    """
    errors: List[str] = []
    cmd = [
        "ffprobe", "-v", "quiet",
        "-show_entries", "format=bit_rate",
        "-of", "json",
        output_mp4_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception as exc:
        errors.append(f"ENC-02: ffprobe failed: {exc}")
        return errors

    if result.returncode != 0:
        errors.append(f"ENC-02: ffprobe failed: {result.stderr.strip()}")
        return errors

    try:
        data = json.loads(result.stdout)
    except (json.JSONDecodeError, ValueError) as exc:
        errors.append(f"ENC-02: ffprobe output could not be parsed as JSON: {exc}")
        return errors

    bit_rate_str = data.get("format", {}).get("bit_rate")
    if bit_rate_str is None:
        errors.append("ENC-02: ffprobe did not report format.bit_rate")
        return errors

    try:
        kbps = int(bit_rate_str) // 1000
    except (ValueError, TypeError):
        errors.append(f"ENC-02: format.bit_rate value '{bit_rate_str}' is not an integer")
        return errors

    if not (min_kbps <= kbps <= max_kbps):
        errors.append(
            f"ENC-02: bitrate is {kbps} kbps, expected [{min_kbps}, {max_kbps}] (D-11)"
        )

    return errors


def validate_duration_parity(silence_cutter_output: str, finalizer_output: str, tolerance_ms: int = 33) -> List[str]:
    """Validate that silence-cutter and finalizer outputs have matching duration (ENC-05 / D-11, D-14).

    Invokes ffprobe on both files and checks that abs(d1 - d2) * 1000 <= tolerance_ms.
    Returns an empty list when within tolerance, otherwise returns an error string
    prefixed 'ENC-05:'. On ffprobe failure for either file, returns a single error.

    Args:
        silence_cutter_output: Path to the silence-cutter output MP4.
        finalizer_output: Path to the ffmpeg-finalizer output MP4.
        tolerance_ms: Maximum acceptable duration delta in milliseconds (default 33ms).

    Returns:
        List of error strings (ENC-05: ...) or empty list if duration parity holds.
    """
    errors: List[str] = []

    def _get_duration(path: str):
        """Return duration as float seconds, or an error string on failure."""
        cmd = [
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            path,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        except Exception as exc:
            return None, f"ENC-05: ffprobe failed on {path}: {exc}"
        if result.returncode != 0:
            return None, f"ENC-05: ffprobe failed on {path}: {result.stderr.strip()}"
        try:
            return float(result.stdout.strip()), None
        except (ValueError, TypeError):
            return None, f"ENC-05: could not parse duration from ffprobe output for {path}"

    d1, err1 = _get_duration(silence_cutter_output)
    if err1:
        errors.append(err1)
        return errors

    d2, err2 = _get_duration(finalizer_output)
    if err2:
        errors.append(err2)
        return errors

    delta_ms = abs(d1 - d2) * 1000
    if delta_ms > tolerance_ms:
        errors.append(
            f"ENC-05: duration delta {delta_ms:.1f}ms exceeds tolerance {tolerance_ms}ms (D-11, D-14)"
        )

    return errors