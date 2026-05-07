"""FFmpeg finalizer validation — checks output against VERT requirements and D-XX decisions.

Per the silence-cutter/validate.py pattern: validate functions return a list of
error strings referencing specific requirement IDs (VERT-XX) and decision
IDs (D-XX) for traceability. Empty list means all checks passed.
"""

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

    # D-08: H264 CRF must be 20
    if "h264_crf" not in info_data:
        errors.append("D-08: Missing 'h264_crf' field")
    elif info_data["h264_crf"] != 20:
        errors.append(f"D-08: h264_crf is {info_data['h264_crf']}, expected 20")

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