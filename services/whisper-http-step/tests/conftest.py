"""Shared pytest fixtures for whisper-http-step.

The HTTP-layer unit tests pass fake/invalid input files and mock the `requests`
layer; per the module docstring they MUST NOT invoke real ffmpeg/ffprobe
("subprocess is monkeypatched, matching test_downscale.py"). `transcribe_via_http`
calls `_extract_audio()` (which shells out to ffmpeg) before the HTTP POST, so
without mocking it real ffmpeg fails on the garbage bytes ("Invalid data found")
and the tests never reach the mocked HTTP error-handling they actually verify.

This autouse fixture restores that documented contract: `_extract_audio` returns a
tiny real temp file (so the subsequent `open(audio_path)` for the multipart upload
works) without invoking ffmpeg. Tests that probe duration set their own
`subprocess.run` mock and don't call `_extract_audio`, so they're unaffected.
"""

import pytest


@pytest.fixture(autouse=True)
def _mock_extract_audio(monkeypatch, tmp_path):
    wav = tmp_path / "whisper-audio-mock.wav"
    # Minimal RIFF/WAVE header bytes — enough for the multipart upload open()/read().
    wav.write_bytes(
        b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
        b"\x80\x3e\x00\x00\x00\x7d\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    )

    def _fake_extract(_input_path):
        return str(wav)

    monkeypatch.setattr(
        "src.transcribe_http._extract_audio", _fake_extract, raising=False
    )
