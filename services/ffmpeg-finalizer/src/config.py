"""FFmpeg finalizer container configuration constants.

Each constant is tied to a decision from the Phase 4 context (04-CONTEXT.md)
to maintain traceability between configuration and rationale.
"""

# D-04: Always output 1080x1920 regardless of input resolution.
# Uniform output size for all downstream steps (subtitle rendering, social platform specs).
# Vertical inputs at other resolutions (e.g. 720x1280) are scaled up to 1080x1920.
VERTICAL_WIDTH = 1080

# D-04: Vertical height always 1920.
VERTICAL_HEIGHT = 1920

VERTICAL_WIDTH_ENV = "VERTICAL_WIDTH"
VERTICAL_HEIGHT_ENV = "VERTICAL_HEIGHT"

# D-01: Center-crop only for v1 — no face detection or speech-aware reframing.
# Smart reframing deferred to future phase (SMRT-01/SMRT-02 in v2 REQUIREMENTS.md).
CROP_STRATEGY = "center"

CROP_STRATEGY_ENV = "CROP_STRATEGY"

# D-08: H.264 CRF 20 for quality/filesize balance.
# Good visual quality for 1080x1920 talking-head social content without excessive file sizes.
H264_CRF = 20

# D-09: Encoding preset `medium` — good balance of encoding speed vs compression
# efficiency for pipeline processing. ~2x realtime on modern CPUs.
H264_PRESET = "medium"

# H.264 profile `high` — broad social media compatibility.
H264_PROFILE = "high"

# Standard audio bitrate for social content.
AUDIO_BITRATE = "128k"

# Standard audio sample rate.
AUDIO_SAMPLE_RATE = 44100

# D-10: Loudnorm audio normalization (I=-14 LUFS, TP=-1, LRA=11).
# I=-14 aligns with broadcast loudness standards (EBU R128) and is commonly used
# for social media content consistency. Consistent volume across all outputs.
LOUDNORM_TARGET = "-14"

# D-10: True peak -1 dB.
LOUDNORM_TP = "-1"

# D-10: Loudness range 11.
LOUDNORM_LRA = "11"

# D-11: Force 30fps output. Consistent frame rate for all downstream steps
# (subtitle timing, Remotion rendering). Inputs at 24/60fps are converted,
# 30fps inputs pass through unchanged.
FPS_OUTPUT = 30

# D-06: Safe zone values at 1080x1920 — appropriate for TikTok/Instagram Reels
# overlay avoidance zones. Bottom is larger (230px) because those platforms
# place UI elements (username, description, sound info) in the bottom portion.
SAFE_ZONE_TOP = 100

# D-06: Bottom safe zone 230px (larger for TikTok/Reels UI overlays).
SAFE_ZONE_BOTTOM = 230

# D-06: Left safe zone 54px (~5% of 1080px) — accounts for side buttons.
SAFE_ZONE_LEFT = 54

# D-06: Right safe zone 54px — accounts for progress bars on mobile platforms.
SAFE_ZONE_RIGHT = 54

# D-05: Safe zone bounds are NOT configurable via environment variables.
# They are hardcoded constants, written into finalizer-info.json as metadata
# for Phase 5 to consume. This decision ensures consistent safe zone data
# across all pipeline runs.
SAFE_ZONE_TOP_ENV = "SAFE_ZONE_TOP"

# Step name matching shared/constants.ts STEP_NAMES.ffmpegFinalizer
STEP_NAME = "ffmpeg-finalizer"