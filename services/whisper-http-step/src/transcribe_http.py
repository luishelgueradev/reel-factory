"""HTTP transcription client for the standalone whisper-api.

This module replaces the embedded GPU Whisper engine with a thin HTTP client.
It probes input duration (ffprobe), routes to the sync (/transcribe) or async
(/jobs + poll) endpoint per D-2, and returns the BARE profile=reels JSON body
verbatim (no re-shaping) so main.py can write it straight to transcript.json.

DECISION (NO_AUDIO_STREAM fail-step):
    The legacy services/whisper/main.py wrote an EMPTY transcript and exited 0
    when the input had no audio stream. The new contract returns
    400 NO_AUDIO_STREAM for that case (whisper-service-integration.md §4). We
    adopt the contract's FAIL-THE-STEP semantics — it surfaces bad input to the
    user instead of silently producing an empty transcript — and do NOT
    replicate the legacy lenient path. This is a deliberate behavior change;
    15-03's parity test must account for it.

Security:
    T-15-01 — ffprobe is invoked with a LIST argv (never a shell string), so the
              orchestrator-supplied INPUT_PATH cannot be shell-interpolated.
    T-15-02 — the API key is read from config (env) and never logged; error
              messages reference the variable name, not its value.
    T-15-03 — the sync call has SYNC_TIMEOUT_S; the async poll loop is bounded
              by POLL_TIMEOUT_S wall-clock; 503 retries are capped at
              MAX_QUEUE_RETRIES.
"""

import json
import subprocess
import time
from typing import Any, Dict

import requests

from . import config


def probe_duration(input_path: str) -> float:
    """Return the input media duration in seconds via ffprobe.

    Copied from the quality-finalizer downscale.py:37-61 ffprobe idiom but
    requesting only format=duration. INJECTION-SAFE: subprocess.run is invoked
    with a list argv (no shell), so INPUT_PATH is never shell-interpolated
    (T-15-01). Raises RuntimeError on a non-zero ffprobe returncode.
    """
    cmd = [
        "ffprobe", "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "json",
        input_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")
    data = json.loads(result.stdout)
    return float(data.get("format", {}).get("duration", 0.0) or 0.0)


def _error_detail(resp) -> "tuple[str, str]":
    """Extract (code, message) from the uniform whisper-api error JSON.

    Error JSON shape: {status:"error", code, message}. Falls back to the raw
    response text when the body is not JSON.
    """
    try:
        body = resp.json()
        code = body.get("code", "UNKNOWN")
        message = body.get("message", "")
    except (ValueError, AttributeError):
        code = "UNKNOWN"
        message = (resp.text or "").strip()
    return code, message


def _raise_http_error(resp) -> None:
    """Raise a RuntimeError for a non-2xx whisper-api response.

    The message carries both the HTTP status and the service's error code so
    the manifest error_message (and 15-03's parity test) can key on it.
    """
    code, message = _error_detail(resp)
    raise RuntimeError(f"whisper-api {resp.status_code} {code}: {message}")


def _retry_after_seconds(resp) -> float:
    """Read the Retry-After header (seconds); default to POLL_INTERVAL_S."""
    raw = resp.headers.get("Retry-After")
    if raw is None:
        return float(config.POLL_INTERVAL_S)
    try:
        return float(raw)
    except (TypeError, ValueError):
        # HTTP-date form (or garbage) — fall back to a small fixed backoff.
        return float(config.POLL_INTERVAL_S)


def _post_with_queue_retry(url: str, headers: dict, input_path: str, data: dict):
    """POST the multipart payload, retrying on 503 QUEUE_FULL (D-2).

    Honors the Retry-After header, sleeps, and retries up to MAX_QUEUE_RETRIES
    times. After the cap is exhausted the last 503 is raised. The file handle is
    reopened per attempt so a retried upload re-reads from the start.
    """
    attempts = config.MAX_QUEUE_RETRIES + 1  # initial attempt + retries
    last_resp = None
    for attempt in range(attempts):
        with open(input_path, "rb") as fh:
            resp = requests.post(
                url,
                headers=headers,
                files={"file": fh},
                data=data,
                timeout=config.SYNC_TIMEOUT_S,
            )
        if resp.status_code != 503:
            return resp
        last_resp = resp
        if attempt < attempts - 1:
            time.sleep(_retry_after_seconds(resp))
    # Exhausted the retry budget — surface the persistent 503.
    _raise_http_error(last_resp)


def _poll_job(job_id: str, headers: dict) -> Dict[str, Any]:
    """Poll GET /jobs/{job_id} until done/failed or POLL_TIMEOUT_S elapses.

    Returns the result body on status=="done"; raises on status=="failed",
    on a non-2xx poll response, or when the wall-clock budget is exceeded
    (T-15-03).
    """
    url = f"{config.WHISPER_API_URL}/jobs/{job_id}"
    deadline = time.time() + config.POLL_TIMEOUT_S
    while time.time() < deadline:
        resp = requests.get(url, headers=headers, timeout=config.SYNC_TIMEOUT_S)
        if not (200 <= resp.status_code < 300):
            _raise_http_error(resp)
        body = resp.json()
        status = body.get("status")
        if status == "done":
            return body["result"]
        if status == "failed":
            code = body.get("code", "JOB_FAILED")
            message = body.get("message", "")
            raise RuntimeError(f"whisper-api job {job_id} failed {code}: {message}")
        # queued / running -> keep polling
        time.sleep(config.POLL_INTERVAL_S)
    raise RuntimeError(
        f"whisper-api job {job_id} did not finish within "
        f"{config.POLL_TIMEOUT_S}s poll budget"
    )


def transcribe_via_http(input_path: str, duration: float) -> Dict[str, Any]:
    """Transcribe input_path via the whisper-api; return the bare reels body.

    D-6: pre-reject duration > MAX_DURATION_S with NO HTTP call.
    D-2: duration <= SYNC_THRESHOLD_S -> sync POST /transcribe;
         duration  > SYNC_THRESHOLD_S -> async POST /jobs + poll GET /jobs/{id}.

    On success returns resp.json() (sync) or body["result"] (async) VERBATIM —
    it IS the profile=reels transcript.json. Every terminal HTTP error
    (401/400/413/500/job-failed/persistent-503) raises RuntimeError, which
    main.py turns into an error manifest + non-zero exit.
    """
    # D-6: pre-validate before any network call.
    if duration > config.MAX_DURATION_S:
        raise RuntimeError(
            f"Input duration {duration:.0f}s exceeds whisper-api limit "
            f"{config.MAX_DURATION_S}s — raise MAX_DURATION_S on the whisper-api side"
        )

    # T-15-02: key read from config (env), never logged.
    headers = {"X-API-Key": config.WHISPER_API_KEY}
    data = {"language": config.WHISPER_LANGUAGE, "profile": config.WHISPER_PROFILE}

    if duration <= config.SYNC_THRESHOLD_S:
        # Sync path: single POST /transcribe, 200 -> bare body verbatim.
        with open(input_path, "rb") as fh:
            resp = requests.post(
                f"{config.WHISPER_API_URL}/transcribe",
                headers=headers,
                files={"file": fh},
                data=data,
                timeout=config.SYNC_TIMEOUT_S,
            )
        if not (200 <= resp.status_code < 300):
            _raise_http_error(resp)
        return resp.json()

    # Async path: POST /jobs (503-aware) -> 202 {job_id} -> poll to done.
    resp = _post_with_queue_retry(
        f"{config.WHISPER_API_URL}/jobs", headers, input_path, data
    )
    if not (200 <= resp.status_code < 300):
        _raise_http_error(resp)
    job_id = resp.json()["job_id"]
    return _poll_job(job_id, headers)
