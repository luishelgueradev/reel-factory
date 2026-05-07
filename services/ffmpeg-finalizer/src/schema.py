"""Output schema for ffmpeg-finalizer step."""

from pydantic import BaseModel
from typing import Optional


class SafeZone(BaseModel):
    top: int
    bottom: int
    left: int
    right: int


class FinalizerInfo(BaseModel):
    input_width: int
    input_height: int
    input_aspect_ratio: str
    output_width: int
    output_height: int
    output_aspect_ratio: str
    crop_strategy: str
    crop_applied: bool
    crop_x: int
    crop_y: int
    crop_width: int
    crop_height: int
    h264_crf: int
    h264_preset: str
    audio_normalization: bool
    safe_zone: SafeZone