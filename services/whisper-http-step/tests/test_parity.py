"""Fixture-based unit tests for the old-vs-new transcript parity comparator.

Exercises src/parity.compare_transcripts over two fixtures:
  - fixtures/old_path_transcript.json — a REAL old-path transcript.json produced
    by the legacy embedded whisper step (model="medium", no timeline marker).
  - fixtures/new_path_transcript.json — a synthetic new-path body for the SAME
    clip (model="whisperx-large-v3", timeline="original", every word shifted
    +0.05 s within tolerance, one trailing token dropped → count delta 1).

These run offline (no live whisper-api). Task 2's e2e run invokes
compare_transcripts for real against the live run's transcript.json.
"""

import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.parity import (  # noqa: E402
    DEFAULT_TIME_TOLERANCE_S,
    assert_no_audio_is_non_parity,
    compare_transcripts,
)

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _load(name):
    with open(os.path.join(FIXTURES, name)) as fh:
        return json.load(fh)


def test_parity_passes_within_tolerance():
    """Old vs new for the same clip: within tolerance → parity holds."""
    old = _load("old_path_transcript.json")
    new = _load("new_path_transcript.json")
    result = compare_transcripts(old, new)
    assert result.passed, result.summary()
    # model is allowed to differ — and does — without failing parity.
    assert result.old_model == "medium"
    assert result.new_model == "whisperx-large-v3"
    # count delta within tolerance (one trailing token dropped by alignment).
    assert result.word_count_delta <= 2
    # every new word carries no_speech_prob (REQUIRED).
    assert result.missing_no_speech_prob_new == 0
    # all aligned words within the time tolerance.
    assert result.max_time_delta_s <= DEFAULT_TIME_TOLERANCE_S


def test_parity_fails_on_word_count_blowout():
    """A large word-count divergence fails parity."""
    old = _load("old_path_transcript.json")
    new = _load("new_path_transcript.json")
    new = json.loads(json.dumps(new))
    new["words"] = new["words"][:5]  # drop most words → delta 26
    result = compare_transcripts(old, new)
    assert not result.passed
    assert any("word count delta" in f for f in result.failures)


def test_parity_fails_on_timing_drift():
    """Per-word timestamps beyond tolerance fail parity."""
    old = _load("old_path_transcript.json")
    new = json.loads(json.dumps(old))
    new["model"] = "whisperx-large-v3"
    for w in new["words"]:
        w["start"] += 1.0  # 1s drift >> 0.15s tolerance
        w["end"] += 1.0
    result = compare_transcripts(old, new)
    assert not result.passed
    assert any("exceed" in f for f in result.failures)
    assert result.max_time_delta_s >= 1.0


def test_parity_fails_when_no_speech_prob_missing():
    """A new-path word missing no_speech_prob fails parity (REQUIRED field)."""
    old = _load("old_path_transcript.json")
    new = json.loads(json.dumps(old))
    new["model"] = "whisperx-large-v3"
    for w in new["words"]:
        w.pop("no_speech_prob", None)
    result = compare_transcripts(old, new)
    assert not result.passed
    assert result.missing_no_speech_prob_new == len(new["words"])
    assert any("no_speech_prob" in f for f in result.failures)


def test_model_difference_alone_does_not_fail_parity():
    """A differing model value, with everything else identical, still passes."""
    old = _load("old_path_transcript.json")
    new = json.loads(json.dumps(old))
    new["model"] = "whisperx-large-v3"
    new["timeline"] = "original"
    result = compare_transcripts(old, new)
    assert result.passed, result.summary()
    assert result.old_model != result.new_model


def test_no_audio_case_is_excluded_from_parity():
    """The NO_AUDIO_STREAM behaviour change is intentionally non-parity (15-01)."""
    # No exception — documents the exclusion; the fail-step behaviour is asserted
    # elsewhere (exit code / manifest), not via the comparator.
    assert assert_no_audio_is_non_parity() is None
