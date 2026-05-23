"""Old-vs-new transcript parity comparator (contract §6 item 3).

Compares a transcript.json produced by the OLD embedded whisper step against one
produced by the NEW externalized whisper-http-step (the live whisper-api) for the
SAME clip, and reports whether they are equivalent within tolerance.

What parity asserts (contract §6 item 3 + §2 hard requirements):
  - identical word count within a small absolute tolerance (alignment engines can
    split/merge a token or two — WhisperX forced alignment vs the legacy path);
  - per-word start/end within a time tolerance (default ±0.15 s);
  - ``no_speech_prob`` present on every word (REQUIRED — silence-cutter reads it);
  - the ``model`` value is ALLOWED to differ ("medium" vs "whisperx-large-v3") —
    it is informational only and not validated downstream.

What parity does NOT cover (intentional, documented non-parity):
  - The NO_AUDIO_STREAM behaviour change (15-01-SUMMARY): a no-audio clip used to
    yield an empty transcript + exit 0 on the old path; the new path FAILS the
    step (400 NO_AUDIO_STREAM → error manifest + exit 1). There is no new-path
    transcript.json to compare in that case, so it is excluded from parity by
    construction — assert the fail-step behaviour separately (exit code / manifest),
    not via this comparator. ``assert_no_audio_is_non_parity`` documents this.

This module imports nothing from services/whisper/ so it survives that tree's
retirement in Task 3 (D-5).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List

# Default tolerances (contract §6 item 3 suggests ±0.15 s; word count tolerance
# absorbs minor alignment split/merge differences between engines).
DEFAULT_TIME_TOLERANCE_S = 0.15
DEFAULT_WORD_COUNT_TOLERANCE = 2

REQUIRED_WORD_KEYS = {"word", "start", "end", "confidence", "no_speech_prob"}


@dataclass
class ParityResult:
    """Outcome of an old-vs-new transcript comparison."""

    passed: bool
    old_word_count: int
    new_word_count: int
    word_count_delta: int
    max_time_delta_s: float
    words_out_of_tolerance: int
    missing_no_speech_prob_new: int
    old_model: str
    new_model: str
    failures: List[str] = field(default_factory=list)

    def summary(self) -> str:
        status = "PASS" if self.passed else "FAIL"
        lines = [
            f"parity: {status}",
            f"  word count: old={self.old_word_count} new={self.new_word_count} "
            f"(delta={self.word_count_delta}, tol allowed)",
            f"  max per-word time delta: {self.max_time_delta_s:.3f}s "
            f"(words out of tolerance: {self.words_out_of_tolerance})",
            f"  no_speech_prob missing on new path: {self.missing_no_speech_prob_new}",
            f"  model: old={self.old_model!r} new={self.new_model!r} (allowed to differ)",
        ]
        if self.failures:
            lines.append("  failures:")
            lines.extend(f"    - {f}" for f in self.failures)
        return "\n".join(lines)


def compare_transcripts(
    old: Dict[str, Any],
    new: Dict[str, Any],
    *,
    time_tolerance_s: float = DEFAULT_TIME_TOLERANCE_S,
    word_count_tolerance: int = DEFAULT_WORD_COUNT_TOLERANCE,
) -> ParityResult:
    """Compare two reels transcript bodies (old path vs new path).

    Args:
        old: parsed transcript.json from the OLD embedded whisper step.
        new: parsed transcript.json from the NEW whisper-http-step (whisper-api).
        time_tolerance_s: allowed absolute per-word start/end delta in seconds.
        word_count_tolerance: allowed absolute difference in flat word count.

    Returns:
        A ParityResult. ``passed`` is True iff word counts are within tolerance,
        every aligned word pair is within the time tolerance, and every new-path
        word carries ``no_speech_prob``. The ``model`` value difference never
        fails parity.
    """
    failures: List[str] = []

    old_words: List[Dict[str, Any]] = old.get("words", []) or []
    new_words: List[Dict[str, Any]] = new.get("words", []) or []
    old_count, new_count = len(old_words), len(new_words)
    count_delta = abs(old_count - new_count)

    if count_delta > word_count_tolerance:
        failures.append(
            f"word count delta {count_delta} exceeds tolerance {word_count_tolerance} "
            f"(old={old_count}, new={new_count})"
        )

    # no_speech_prob REQUIRED on every new-path word (contract §2 hard req 3).
    missing_nsp = sum(
        1 for w in new_words if w.get("no_speech_prob") is None
    )
    if missing_nsp:
        failures.append(
            f"{missing_nsp} new-path words missing no_speech_prob (REQUIRED)"
        )

    # Per-word timing comparison over the overlapping prefix (alignment may add
    # or drop a trailing token within the count tolerance; compare what aligns).
    pairs = min(old_count, new_count)
    max_delta = 0.0
    out_of_tol = 0
    for i in range(pairs):
        ow, nw = old_words[i], new_words[i]
        d_start = abs(float(ow.get("start", 0.0)) - float(nw.get("start", 0.0)))
        d_end = abs(float(ow.get("end", 0.0)) - float(nw.get("end", 0.0)))
        worst = max(d_start, d_end)
        max_delta = max(max_delta, worst)
        if worst > time_tolerance_s:
            out_of_tol += 1
    if out_of_tol:
        failures.append(
            f"{out_of_tol}/{pairs} aligned words exceed ±{time_tolerance_s}s "
            f"(max delta {max_delta:.3f}s)"
        )

    return ParityResult(
        passed=not failures,
        old_word_count=old_count,
        new_word_count=new_count,
        word_count_delta=count_delta,
        max_time_delta_s=max_delta,
        words_out_of_tolerance=out_of_tol,
        missing_no_speech_prob_new=missing_nsp,
        old_model=str(old.get("model", "")),
        new_model=str(new.get("model", "")),
        failures=failures,
    )


def assert_no_audio_is_non_parity() -> None:
    """Document that the no-audio case is intentionally excluded from parity.

    Old path: empty transcript + exit 0. New path: 400 NO_AUDIO_STREAM → fail
    step + exit 1 (15-01-SUMMARY behaviour change). There is no new-path
    transcript.json to compare, so this comparator is never invoked for that
    case — the fail-step behaviour is asserted via exit code / manifest instead.
    """
    # Intentionally a no-op marker; see module docstring + 15-01-SUMMARY.
    return None
