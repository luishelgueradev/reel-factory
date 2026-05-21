"""Probe-gated Lanczos downscale to 1080x1920 (D-08, D-09, D-11).

Implements the quality-finalizer step contract:
- probe_video(input_path)  -> dict (width, height, has_audio, duration)
- needs_downscale(probe_info) -> bool: True iff input > 1080x1920 (D-08)
- apply_downscale(input_path, output_path, probe_info) -> dict (metadata)

D-08: Idempotent — if input is already 1080x1920 (default render path,
scale=1), stream-copy via `ffmpeg -c copy`. If input is larger (the
scale=2 / 2160x3840 supersampled case), run Lanczos downscale.

D-09: Lanczos encode uses `scale=1080:1920:flags=lanczos,setsar=1` + CRF 18
+ -c:a copy + -movflags +faststart with BT.709 metadata tags carried
through. No sharpening filter is applied — Remotion already rendered crisp
subtitles at 2x density; sharpening after downscale would risk halos on
the burnt-in text.

D-11: BT.709 metadata tags are carried through. The colorspace conversion
itself is done upstream by Remotion (colorSpace: 'bt709'); here we only
tag the encoded output so ffprobe reports color_space=bt709.
"""

import json
import subprocess
from typing import Any, Dict

from . import config


def probe_video(input_path: str) -> Dict[str, Any]:
    """Probe video metadata using ffprobe.

    Returns a dict with width, height, has_audio, and duration. Used by both
    needs_downscale (the D-08 probe gate) and apply_downscale (to decide
    whether to map an audio stream).
    """
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

    data = json.loads(result.stdout)

    info: Dict[str, Any] = {"width": 0, "height": 0, "duration": 0.0, "has_audio": False}
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            info["width"] = int(stream.get("width", 0))
            info["height"] = int(stream.get("height", 0))
        elif stream.get("codec_type") == "audio":
            info["has_audio"] = True

    if data.get("format", {}).get("duration"):
        info["duration"] = float(data["format"]["duration"])

    return info


def needs_downscale(
    probe_info: Dict[str, Any],
    target_width: int = config.TARGET_WIDTH,
    target_height: int = config.TARGET_HEIGHT,
) -> bool:
    """D-08: probe-gated idempotency.

    True if the input is larger than the deliverable target in either
    dimension — triggers the Lanczos encode path. False if the input is
    already at (or smaller than) the target — triggers the stream-copy path.
    """
    return probe_info["width"] > target_width or probe_info["height"] > target_height


def apply_downscale(
    input_path: str,
    output_path: str,
    probe_info: Dict[str, Any],
) -> Dict[str, Any]:
    """D-08/D-09/D-11: branch on needs_downscale().

    Lanczos path (input > target): re-encode to 1080x1920 with CRF 18,
    medium preset, BT.709 metadata, +faststart, audio stream-copied.

    Stream-copy path (input already target): `ffmpeg -c copy` — no decode,
    no re-encode, output is bit-identical to the input (idempotent).

    Returns a dict matching DownscaleInfo fields. The lanczos_scaling and
    color_* fields are populated either way so downstream consumers
    (downscale-info.json, validators) see a consistent shape.
    """
    input_w = probe_info["width"]
    input_h = probe_info["height"]

    if needs_downscale(probe_info):
        # D-09: Lanczos downscale to 1080x1920. No sharpening filter (D-09).
        # The filter chain is built as a separate string passed to -vf;
        # subprocess.run is invoked with a list argv (no shell interpolation)
        # to prevent injection from the INPUT_PATH/OUTPUT_PATH env vars.
        filter_chain = "scale=1080:1920:flags=lanczos,setsar=1"
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-vf", filter_chain,
            "-c:v", "libx264",
            "-crf", str(config.H264_CRF),
            "-preset", config.H264_PRESET,
            "-pix_fmt", "yuv420p",
            # D-11: BT.709 metadata tags carried through the downscale.
            "-colorspace", "bt709",
            "-color_primaries", "bt709",
            "-color_trc", "bt709",
            "-movflags", "+faststart",
            "-map_metadata", "-1",
            "-map", "0:v:0",
        ]
        # D-09: audio stream-copied bit-identically for A/V parity (D-10).
        if probe_info["has_audio"]:
            cmd.extend(["-map", "0:a:0", "-c:a", "copy"])
        else:
            cmd.append("-an")
        cmd.append(output_path)
        downscale_applied = True
        lanczos_scaling = True
        print(f"[{config.STEP_NAME}] Lanczos downscale: {input_w}x{input_h} -> 1080x1920")
        print(f"  Filter: {filter_chain}")
    else:
        # D-08: Input already at target — stream-copy, no re-encode.
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-c", "copy",
            output_path,
        ]
        downscale_applied = False
        lanczos_scaling = False
        print(f"[{config.STEP_NAME}] Stream-copy: input already at 1080x1920")

    # D-09: 600s (10 minute) timeout — well above expected 60s clip runtime;
    # distinct from the 3h Remotion render timeout (D-03).
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg downscale failed: {result.stderr}")

    return {
        "input_width": input_w,
        "input_height": input_h,
        "output_width": config.TARGET_WIDTH,
        "output_height": config.TARGET_HEIGHT,
        "downscale_applied": downscale_applied,
        "h264_crf": config.H264_CRF,
        "h264_preset": config.H264_PRESET,
        "lanczos_scaling": lanczos_scaling,
        # D-11: BT.709 carry-through tags reported in metadata. The stream-copy
        # path preserves whatever tags the input had; if the upstream Remotion
        # render set BT.709 (as it does in the pipeline), these report correctly.
        "color_space": "bt709",
        "color_primaries": "bt709",
        "color_transfer": "bt709",
    }
