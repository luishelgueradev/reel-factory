"""Unit tests for whisper-http-step's HTTP transcription client.

These tests run against a MOCKED whisper-api — they do NOT require the live
service (that is 15-03's job) and they do NOT invoke real ffprobe (subprocess
is monkeypatched, matching test_downscale.py's "do NOT invoke ffmpeg/ffprobe"
convention).

The HTTP layer is mocked with stdlib unittest.mock (no requests-mock runtime
dependency). We patch src.transcribe_http.requests.post / .get and assert on
routing (sync vs async by duration), verbatim body pass-through, error mapping,
503 backoff, and the oversize pre-reject.
"""

import os
import sys
from unittest import mock

# Ensure the whisper-http-step package root is importable when running pytest
# from the service directory (mirrors quality-finalizer's test_downscale.py shim).
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest  # noqa: E402

from src import config  # noqa: E402
from src.transcribe_http import transcribe_via_http, probe_duration  # noqa: E402


# --------------------------------------------------------------------------- #
# Fixtures / helpers
# --------------------------------------------------------------------------- #

REELS_BODY = {
    "language": "es",
    "model": "large-v3",
    "duration": 30.0,
    "segments": [
        {
            "id": 0,
            "start": 0.0,
            "end": 1.5,
            "text": "hola mundo",
            "words": [
                {"word": "hola", "start": 0.0, "end": 0.5,
                 "confidence": 0.99, "no_speech_prob": 0.01},
                {"word": "mundo", "start": 0.6, "end": 1.5,
                 "confidence": 0.97, "no_speech_prob": 0.02},
            ],
        }
    ],
    "words": [
        {"word": "hola", "start": 0.0, "end": 0.5,
         "confidence": 0.99, "no_speech_prob": 0.01},
        {"word": "mundo", "start": 0.6, "end": 1.5,
         "confidence": 0.97, "no_speech_prob": 0.02},
    ],
    "timeline": "original",
}


def _make_resp(status_code, json_body=None, headers=None, text=""):
    """Build a mock requests.Response-like object."""
    resp = mock.Mock()
    resp.status_code = status_code
    resp.headers = headers or {}
    resp.text = text
    if json_body is not None:
        resp.json.return_value = json_body
    else:
        resp.json.side_effect = ValueError("no json")
    return resp


@pytest.fixture
def fake_input(tmp_path):
    """A real (tiny) file so `open(input_path, "rb")` succeeds in the sync path."""
    p = tmp_path / "video.mp4"
    p.write_bytes(b"\x00\x00\x00\x18ftypmp42fakebytes")
    return str(p)


# --------------------------------------------------------------------------- #
# probe_duration
# --------------------------------------------------------------------------- #

def test_probe_duration_parses_ffprobe_json(monkeypatch, fake_input):
    """probe_duration reads format.duration from ffprobe JSON (no real ffprobe)."""
    completed = mock.Mock(returncode=0,
                          stdout='{"format": {"duration": "42.5"}}',
                          stderr="")
    run = mock.Mock(return_value=completed)
    monkeypatch.setattr("src.transcribe_http.subprocess.run", run)

    assert probe_duration(fake_input) == pytest.approx(42.5)
    # Injection-safe: ffprobe invoked with a LIST argv, never a shell string.
    called_cmd = run.call_args[0][0]
    assert isinstance(called_cmd, list)
    assert called_cmd[0] == "ffprobe"
    assert fake_input in called_cmd


def test_probe_duration_raises_on_ffprobe_failure(monkeypatch, fake_input):
    completed = mock.Mock(returncode=1, stdout="", stderr="boom")
    monkeypatch.setattr("src.transcribe_http.subprocess.run",
                        mock.Mock(return_value=completed))
    with pytest.raises(RuntimeError):
        probe_duration(fake_input)


# --------------------------------------------------------------------------- #
# Routing: sync vs async (D-2)
# --------------------------------------------------------------------------- #

def test_sync_path_for_short_duration(monkeypatch, fake_input):
    """duration <= SYNC_THRESHOLD_S hits POST /transcribe and NOT /jobs; the
    200 bare body is returned verbatim."""
    post = mock.Mock(return_value=_make_resp(200, json_body=REELS_BODY))
    get = mock.Mock()
    monkeypatch.setattr("src.transcribe_http.requests.post", post)
    monkeypatch.setattr("src.transcribe_http.requests.get", get)

    body = transcribe_via_http(fake_input, duration=30.0)

    assert body == REELS_BODY
    assert body["language"] == "es"
    assert body["words"] is REELS_BODY["words"]  # verbatim, no re-shaping
    post.assert_called_once()
    assert post.call_args[0][0].endswith("/transcribe")
    get.assert_not_called()
    # X-API-Key header sent; language/profile in the multipart data.
    kwargs = post.call_args.kwargs
    assert kwargs["headers"]["X-API-Key"] == config.WHISPER_API_KEY
    assert kwargs["data"]["language"] == config.WHISPER_LANGUAGE
    assert kwargs["data"]["profile"] == config.WHISPER_PROFILE


def test_async_path_for_long_duration(monkeypatch, fake_input):
    """duration > SYNC_THRESHOLD_S hits POST /jobs then polls GET /jobs/{id};
    queued -> done returns result."""
    post = mock.Mock(return_value=_make_resp(
        202, json_body={"job_id": "abc123", "status": "queued"}))
    get = mock.Mock(side_effect=[
        _make_resp(200, json_body={"status": "queued"}),
        _make_resp(200, json_body={"status": "running"}),
        _make_resp(200, json_body={"status": "done", "result": REELS_BODY}),
    ])
    monkeypatch.setattr("src.transcribe_http.requests.post", post)
    monkeypatch.setattr("src.transcribe_http.requests.get", get)
    monkeypatch.setattr("src.transcribe_http.time.sleep", lambda *_: None)

    body = transcribe_via_http(fake_input, duration=300.0)

    assert body == REELS_BODY
    assert post.call_args[0][0].endswith("/jobs")
    assert get.call_count == 3
    assert get.call_args[0][0].endswith("/jobs/abc123")


def test_async_job_failed_raises(monkeypatch, fake_input):
    post = mock.Mock(return_value=_make_resp(
        202, json_body={"job_id": "j1", "status": "queued"}))
    get = mock.Mock(return_value=_make_resp(
        200, json_body={"status": "failed", "code": "MODEL_ERROR",
                        "message": "decode blew up"}))
    monkeypatch.setattr("src.transcribe_http.requests.post", post)
    monkeypatch.setattr("src.transcribe_http.requests.get", get)
    monkeypatch.setattr("src.transcribe_http.time.sleep", lambda *_: None)

    with pytest.raises(RuntimeError) as ei:
        transcribe_via_http(fake_input, duration=300.0)
    assert "MODEL_ERROR" in str(ei.value)


# --------------------------------------------------------------------------- #
# 503 QUEUE_FULL backoff (D-2)
# --------------------------------------------------------------------------- #

def test_queue_full_retries_then_succeeds(monkeypatch, fake_input):
    """503 twice (within MAX_QUEUE_RETRIES) honoring Retry-After, then 202 ->
    poll done -> success."""
    post = mock.Mock(side_effect=[
        _make_resp(503, json_body={"status": "error", "code": "QUEUE_FULL",
                                   "message": "full"}, headers={"Retry-After": "1"}),
        _make_resp(503, json_body={"status": "error", "code": "QUEUE_FULL",
                                   "message": "full"}, headers={"Retry-After": "1"}),
        _make_resp(202, json_body={"job_id": "jq", "status": "queued"}),
    ])
    get = mock.Mock(return_value=_make_resp(
        200, json_body={"status": "done", "result": REELS_BODY}))
    sleeps = []
    monkeypatch.setattr("src.transcribe_http.requests.post", post)
    monkeypatch.setattr("src.transcribe_http.requests.get", get)
    monkeypatch.setattr("src.transcribe_http.time.sleep", lambda s: sleeps.append(s))

    body = transcribe_via_http(fake_input, duration=300.0)

    assert body == REELS_BODY
    assert post.call_count == 3  # two 503s + one 202
    assert 1 in sleeps  # Retry-After honored


def test_queue_full_beyond_cap_raises(monkeypatch, fake_input):
    """503 persisting beyond MAX_QUEUE_RETRIES raises."""
    post = mock.Mock(return_value=_make_resp(
        503, json_body={"status": "error", "code": "QUEUE_FULL", "message": "full"},
        headers={"Retry-After": "1"}))
    monkeypatch.setattr("src.transcribe_http.requests.post", post)
    monkeypatch.setattr("src.transcribe_http.requests.get", mock.Mock())
    monkeypatch.setattr("src.transcribe_http.time.sleep", lambda *_: None)

    with pytest.raises(RuntimeError) as ei:
        transcribe_via_http(fake_input, duration=300.0)
    assert "QUEUE_FULL" in str(ei.value)
    # initial attempt + MAX_QUEUE_RETRIES retries
    assert post.call_count == config.MAX_QUEUE_RETRIES + 1


# --------------------------------------------------------------------------- #
# Error mapping (each terminal error raises with its code)
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("status_code,code", [
    (401, "UNAUTHORIZED"),
    (400, "NO_AUDIO_STREAM"),
    (400, "INVALID_LANGUAGE"),
    (413, "FILE_TOO_LARGE"),
    (500, "MODEL_ERROR"),
])
def test_sync_error_codes_raise(monkeypatch, fake_input, status_code, code):
    """Every terminal HTTP error on the sync path raises, message carries code."""
    post = mock.Mock(return_value=_make_resp(
        status_code, json_body={"status": "error", "code": code, "message": "x"}))
    monkeypatch.setattr("src.transcribe_http.requests.post", post)
    monkeypatch.setattr("src.transcribe_http.requests.get", mock.Mock())

    with pytest.raises(RuntimeError) as ei:
        transcribe_via_http(fake_input, duration=30.0)
    assert code in str(ei.value)
    assert str(status_code) in str(ei.value)


def test_no_audio_stream_fails_step(monkeypatch, fake_input):
    """DECISION: NO_AUDIO_STREAM FAILS the step (no legacy empty-transcript /
    exit-0 path). This raise is what main.py turns into an error manifest."""
    post = mock.Mock(return_value=_make_resp(
        400, json_body={"status": "error", "code": "NO_AUDIO_STREAM",
                        "message": "no audio track"}))
    monkeypatch.setattr("src.transcribe_http.requests.post", post)
    with pytest.raises(RuntimeError) as ei:
        transcribe_via_http(fake_input, duration=30.0)
    assert "NO_AUDIO_STREAM" in str(ei.value)


# --------------------------------------------------------------------------- #
# Oversize pre-reject (D-6) — NO HTTP call
# --------------------------------------------------------------------------- #

def test_oversize_duration_rejected_without_http(monkeypatch, fake_input):
    post = mock.Mock()
    get = mock.Mock()
    monkeypatch.setattr("src.transcribe_http.requests.post", post)
    monkeypatch.setattr("src.transcribe_http.requests.get", get)

    with pytest.raises(RuntimeError) as ei:
        transcribe_via_http(fake_input, duration=999.0)

    assert str(config.MAX_DURATION_S) in str(ei.value)
    post.assert_not_called()
    get.assert_not_called()
