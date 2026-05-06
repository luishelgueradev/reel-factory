"""Audio extraction module — converts input MP4 to 16kHz mono WAV for Whisper.

Per D-05: Explicit 16kHz mono resampling instead of relying on Whisper's
internal resampler. This avoids quality loss and gives deterministic audio
properties for transcription.

Per D-06: Audio extraction happens inside the Whisper container, not as a
separate pipeline step. The container uses the FFmpeg binary from the
base-python image.
"""
import subprocess
import os
import sys


def extract_audio(input_path: str, output_path: str) -> str:
    """Extract audio from video file as 16kHz mono WAV.

    Args:
        input_path: Path to input MP4 file (from INPUT_PATH env var)
        output_path: Path to write WAV audio file (in Whisper output directory)

    Returns:
        Path to extracted WAV file

    Raises:
        FileNotFoundError: If input file does not exist
        RuntimeError: If FFmpeg extraction fails
    """
    # Validate input exists
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # FFmpeg: extract audio, resample to 16kHz mono WAV
    # -ar 16000: sample rate 16kHz (D-05)
    # -ac 1: mono channel (D-05)
    # -f wav: PCM WAV format (Whisper expects WAV input)
    # -vn: discard video stream
    # -y: overwrite output without prompting
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-vn",                   # No video
        "-ar", "16000",          # 16kHz sample rate (D-05)
        "-ac", "1",               # Mono (D-05)
        "-f", "wav",              # PCM WAV format
        "-y",                     # Overwrite output
        output_path
    ]

    print(f"Extracting audio: {input_path} -> {output_path}")
    print(f"  Command: {' '.join(cmd)}")

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg audio extraction failed (exit {result.returncode}): {result.stderr}"
        )

    # Verify output was created
    if not os.path.exists(output_path):
        raise RuntimeError(
            f"FFmpeg completed but output file not found: {output_path}"
        )

    output_size = os.path.getsize(output_path)
    print(f"  Audio extracted successfully: {output_size} bytes")

    return output_path