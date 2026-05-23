"""whisper-http-step container configuration constants.

This step replaces the embedded GPU Whisper container with a thin HTTP client
to the standalone whisper-api. Each constant is tied to a locked decision from
the Phase 15 context (15-CONTEXT.md / contract whisper-service-integration.md)
to maintain traceability between configuration and rationale.
"""

import os

# CRITICAL STEP_NAME decision (15-PATTERNS.md "CRITICAL STEP_NAME decision").
# MUST stay "whisper": downstream steps (silence-cutter, remotion-renderer,
# srt-exporter) read TRANSCRIPT_PATH=/data/pipeline/{jobId}/whisper/transcript.json,
# and the orchestrator finds the manifest at pipeline/{jobId}/<step.name>/. The
# OUTPUT_PATH dir + manifest dir + STEP_NAME must all remain "whisper" so the
# file-based step contract stays zero-downstream-change. Do NOT rename.
STEP_NAME = "whisper"

# D-3: shared whisper-api base URL. Default targets the external stack via the
# Docker host gateway on WSL2/Docker Desktop (host.docker.internal).
WHISPER_API_URL = os.environ.get("WHISPER_API_URL", "http://host.docker.internal:8000")

# D-3: API key for the X-API-Key header. Empty default; main.py validates it is
# set before any work (a missing key would otherwise only surface as a 401).
WHISPER_API_KEY = os.environ.get("WHISPER_API_KEY", "")

# Contract: the service rejects non-es input with 400 INVALID_LANGUAGE.
WHISPER_LANGUAGE = "es"

# profile=reels — the service returns the BARE reels body, written verbatim to
# transcript.json (no re-shaping).
WHISPER_PROFILE = "reels"

# D-2: <=120s -> POST /transcribe (sync); else POST /jobs + poll GET /jobs/{id}.
SYNC_THRESHOLD_S = 120

# D-6: pre-validate input duration before sending (service caps at 600s). The
# step raises a friendly error if duration exceeds this, with NO HTTP call made.
MAX_DURATION_S = 600

# D-2: poll GET /jobs/{id} ~every 2 seconds on the async path.
POLL_INTERVAL_S = 2

# D-2: 503 QUEUE_FULL backoff cap — retry at most this many times before raising.
MAX_QUEUE_RETRIES = 2

# HTTP read timeout for the synchronous /transcribe call (T-15-03: bound the call).
SYNC_TIMEOUT_S = 300

# Total wall-clock budget for the async poll loop before giving up (T-15-03:
# prevents an unbounded poll against a wedged job).
POLL_TIMEOUT_S = 1800
