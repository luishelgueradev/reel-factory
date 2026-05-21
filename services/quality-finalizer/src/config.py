"""Quality-finalizer container configuration constants.

Each constant is tied to a decision from the Phase 14 context (14-CONTEXT.md)
to maintain traceability between configuration and rationale.
"""

# Step name matching shared/constants.ts STEP_NAMES (to be added in Plan 03 wiring).
STEP_NAME = "quality-finalizer"

# D-08: Deliverable output width — probe gate compares input against this.
# If input width > TARGET_WIDTH (or height > TARGET_HEIGHT) the Lanczos
# downscale path runs; otherwise the input is already at target and is
# stream-copied to avoid a needless re-encode.
TARGET_WIDTH = 1080

# D-08: Deliverable output height — paired with TARGET_WIDTH for the probe gate.
TARGET_HEIGHT = 1920

# D-09: CRF for Lanczos downscale encode. 18 = high quality without bloating.
# Matches Phase 13 ffmpeg-finalizer (ENC-02) so encode quality is consistent
# across the pipeline. The downscale receives a 2x supersampled source, so the
# fidelity budget is generous.
H264_CRF = 18

# Env var name for runtime override if needed (no override loop in main.py per D-06;
# tunable knobs live in render.ts env vars, not the finalizer).
H264_CRF_ENV = "DOWNSCALE_CRF"

# D-09: x264 preset for downscale — medium balances speed and compression.
# Matches ffmpeg-finalizer default for consistency.
H264_PRESET = "medium"

H264_PRESET_ENV = "DOWNSCALE_PRESET"
