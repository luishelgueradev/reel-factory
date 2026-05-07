"""Center-crop and scale video to 9:16 vertical format.

Implements D-03 conditional crop path:
- If input is wider than 9:16: apply full scale+crop filter chain
- If input is already 9:16 (within 0.5% tolerance): scale only, no crop
- If input is narrower than 9:16: scale+crop (same filter works —
  force_original_aspect_ratio=increase scales the smaller dimension,
  crop removes excess)
"""

import subprocess
from typing import Tuple

from . import config


# Tolerance for aspect ratio comparison — inputs within 0.5% of target ratio
# are treated as "already 9:16" and skip the crop filter (D-03).
ASPECT_RATIO_TOLERANCE = 0.005


def probe_video(input_path: str) -> dict:
    """Probe video metadata using ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-show_entries", "stream=width,height,codec_type,codec_name,r_frame_rate",
        "-show_entries", "format=duration",
        "-of", "json",
        input_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")

    import json
    data = json.loads(result.stdout)

    info = {"width": 0, "height": 0, "duration": 0, "has_audio": False, "fps": 30}
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            info["width"] = int(stream.get("width", 0))
            info["height"] = int(stream.get("height", 0))
            fps_str = stream.get("r_frame_rate", "30/1")
            if "/" in fps_str:
                num, den = fps_str.split("/")
                info["fps"] = round(int(num) / int(den)) if int(den) > 0 else 30
            else:
                info["fps"] = int(fps_str)
        elif stream.get("codec_type") == "audio":
            info["has_audio"] = True

    if data.get("format", {}).get("duration"):
        info["duration"] = float(data["format"]["duration"])

    return info


def compute_crop(input_width: int, input_height: int, target_width: int, target_height: int) -> Tuple[int, int, int, int]:
    """Compute crop geometry for center-crop strategy (D-01, D-03).

    Returns (crop_x, crop_y, crop_width, crop_height).

    If input aspect ratio is within ASPECT_RATIO_TOLERANCE of the target ratio
    (D-03: input already 9:16), returns (0, 0, input_width, input_height) to
    signal "no crop needed" with zero offsets.
    """
    input_ratio = input_width / input_height
    target_ratio = target_width / target_height

    # D-03: If already 9:16 (within 0.5% tolerance), no crop needed
    if abs(input_ratio - target_ratio) / target_ratio <= ASPECT_RATIO_TOLERANCE:
        return 0, 0, input_width, input_height

    if input_ratio > target_ratio:
        # Input is wider than target — crop sides
        crop_height = input_height
        crop_width = round(input_height * target_ratio)
        crop_width = crop_width - (crop_width % 2)
    else:
        # Input is taller/narrower than target — crop top/bottom
        crop_width = input_width
        crop_height = round(input_width / target_ratio)
        crop_height = crop_height - (crop_height % 2)

    crop_x = (input_width - crop_width) // 2
    crop_y = (input_height - crop_height) // 2

    return crop_x, crop_y, crop_width, crop_height


def apply_finalizer(input_path: str, output_path: str, target_width: int, target_height: int, probe_info: dict) -> dict:
    """Apply scale, crop (conditional per D-03), and encoding to produce 9:16 output.

    Returns crop metadata dict including crop_applied boolean.
    """
    input_w = probe_info["width"]
    input_h = probe_info["height"]

    crop_x, crop_y, crop_w, crop_h = compute_crop(input_w, input_h, target_width, target_height)

    input_ratio = f"{input_w}:{input_h}"
    from math import gcd
    g = gcd(input_w, input_h)
    input_ratio_str = f"{input_w // g}:{input_h // g}"

    # D-03: Conditional crop path based on input aspect ratio
    input_ratio_val = input_w / input_h
    target_ratio_val = target_width / target_height
    crop_applied = abs(input_ratio_val - target_ratio_val) / target_ratio_val > ASPECT_RATIO_TOLERANCE

    if crop_applied:
        # Input is not 9:16 — apply full scale+crop filter chain
        filter_chain = (
            f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
            f"crop={target_width}:{target_height},"
            f"setsar=1"
        )
    else:
        # D-03: Input is already 9:16 — scale only, no crop
        filter_chain = f"scale={target_width}:{target_height},setsar=1"

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vf", filter_chain,
        "-c:v", "libx264",
        "-crf", str(config.H264_CRF),
        "-preset", config.H264_PRESET,
        "-profile:v", config.H264_PROFILE,
        "-pix_fmt", "yuv420p",
        "-r", str(config.FPS_OUTPUT),
        "-c:a", "aac",
        "-b:a", config.AUDIO_BITRATE,
        "-ar", str(config.AUDIO_SAMPLE_RATE),
        "-af", f"loudnorm=I={config.LOUDNORM_TARGET}:TP={config.LOUDNORM_TP}:LRA={config.LOUDNORM_LRA}",
        "-movflags", "+faststart",
        "-map_metadata", "-1",
    ]

    if not probe_info["has_audio"]:
        cmd.extend(["-map", "0:v:0"])
    else:
        cmd.extend(["-map", "0:v:0", "-map", "0:a:0"])

    cmd.append(output_path)

    print(f"[{config.STEP_NAME}] Running FFmpeg finalizer")
    print(f"  Input: {input_w}x{input_h} ({input_ratio_str})")
    print(f"  Crop applied: {crop_applied}")
    print(f"  Filter: {filter_chain}")
    print(f"  Output: {target_width}x{target_height} (9:16)")

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg finalizer failed: {result.stderr}")

    output_ratio_g = gcd(target_width, target_height)

    return {
        "input_width": input_w,
        "input_height": input_h,
        "input_aspect_ratio": input_ratio_str,
        "output_width": target_width,
        "output_height": target_height,
        "output_aspect_ratio": f"{target_width // output_ratio_g}:{target_height // output_ratio_g}",
        "crop_strategy": config.CROP_STRATEGY,
        "crop_applied": crop_applied,
        "crop_x": crop_x,
        "crop_y": crop_y,
        "crop_width": crop_w,
        "crop_height": crop_h,
        "h264_crf": config.H264_CRF,
        "h264_preset": config.H264_PRESET,
        "audio_normalization": probe_info["has_audio"],
        "safe_zone": {
            "top": config.SAFE_ZONE_TOP,
            "bottom": config.SAFE_ZONE_BOTTOM,
            "left": config.SAFE_ZONE_LEFT,
            "right": config.SAFE_ZONE_RIGHT,
        },
    }