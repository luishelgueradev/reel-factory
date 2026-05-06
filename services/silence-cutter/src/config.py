"""Silence cutter container configuration constants.

Each constant is tied to a decision from the Phase 3 context (03-CONTEXT.md)
to maintain traceability between configuration and rationale.
"""

# D-04: Default minimum silence duration (0.5s) — removes noticeable silence
# while keeping brief breath pauses. Good for social media talking-head content.
SILENCE_MIN_DURATION = 0.5

# D-05: Configurable via SILENCE_MIN_DURATION env var override.
# Allows tuning for different content types without redeploying.
SILENCE_MIN_DURATION_ENV = "SILENCE_MIN_DURATION"

# D-02: FFmpeg silencedetect noise tolerance in dB.
# -30dB is a common default: sounds below ~-30dB relative to the video's
# peak are treated as silence by FFmpeg. This is FFmpeg's own convention.
SILENCE_NOISE_TOLERANCE_DB = -30

# D-03: Whisper no_speech_threshold for confirming silence.
# Matches NO_SPEECH_THRESHOLD from whisper/src/config.py (0.6 per D-11 in Phase 2).
NO_SPEECH_THRESHOLD = 0.6

# D-06: 50ms padding before and after speech at cut boundaries.
# Prevents clipping word starts/ends due to timestamp imprecision.
# Fixed constant — NOT configurable via env var.
SILENCE_CUT_PADDING = 0.05

# Step name matching shared/constants.ts STEP_NAMES.silenceCutter
STEP_NAME = "silence-cutter"

# FFmpeg silencedetect output parsing fields
SILENCEDETECT_START_KEY = "silence_start"
SILENCEDETECT_END_KEY = "silence_end"
SILENCEDETECT_DURATION_KEY = "silence_duration"