"""Whisper container configuration constants.

Each constant is tied to a decision from the Phase 2 context (02-CONTEXT.md)
to maintain traceability between configuration and rationale.
"""

# D-02: medium model for Spanish — best balance of accuracy (~5GB) and speed.
# Not .en variant since Spanish is multilingual (D-10).
WHISPER_MODEL = "medium"

# D-10: Explicit Spanish language — no auto-detection step.
# Spanish is assumed per TRAN-04 requirement.
WHISPER_LANGUAGE = "es"

# D-03: GPU required. No CPU fallback path in v1.
WHISPER_DEVICE = "cuda"

# GPU compute type — float16 for CUDA (int8 would be for CPU fallback, but D-03: no CPU path).
WHISPER_COMPUTE_TYPE = "float16"

# D-05: 16kHz mono audio extraction.
# Explicit resampling instead of relying on Whisper's internal resampler
# to avoid quality loss and ensure deterministic audio properties.
AUDIO_SAMPLE_RATE = 16000
AUDIO_CHANNELS = 1

# D-11: Hallucination and silence thresholds per TRAN-03.
# Segments with silence duration above this threshold (seconds) are filtered.
HALLUCINATION_SILENCE_THRESHOLD = 2.0

# Whisper's no_speech_prob threshold — words/segments above this are likely silence.
NO_SPEECH_THRESHOLD = 0.6

# Step name matching shared/constants.ts STEP_NAMES.whisper
STEP_NAME = "whisper"