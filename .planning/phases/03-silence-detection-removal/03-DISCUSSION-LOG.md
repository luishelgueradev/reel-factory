# Phase 3: Silence Detection & Removal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 3-Silence Detection & Removal
**Areas discussed:** Cross-reference strategy, Minimum silence duration, Cut boundary padding, Cut list detail level

---

## Cross-Reference Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Intersection | Silence confirmed only when BOTH FFmpeg and Whisper agree. Fewer false positives. | ✓ |
| Union | Silence flagged if EITHER source detects it. More aggressive, more false positives. | |
| Hybrid scoring | Weighted scoring — silence confirmed when combined score exceeds threshold. More nuanced but harder to tune. | |

**User's choice:** Intersection (Recommended)
**Notes:** Intersection avoids false positives from background noise/music that FFmpeg might flag while Whisper recognizes speech.

---

| Option | Description | Selected |
|--------|-------------|----------|
| FFmpeg first, Whisper confirms | FFmpeg finds silence segments, Whisper validates via no_speech_prob. Simple, logically clear. | ✓ |
| Whisper first, FFmpeg validates | Whisper identifies silent zones, FFmpeg validates. Better for catching silence Whisper missed, but more complex. | |

**User's choice:** FFmpeg first, Whisper confirms (Recommended)
**Notes:** FFmpeg produces clear segment boundaries while Whisper provides per-word probabilities. Running silencedetect first gives clean candidates to validate.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Any word exceeds threshold | If ANY word in the silence segment has no_speech_prob > 0.6, confirm silence. Safer than majority. | ✓ |
| Majority of words exceed threshold | Majority of overlapping words must exceed threshold. More conservative, may miss silences with mixed words. | |

**User's choice:** Any word exceeds threshold
**Notes:** Even one high-probability word indicates Whisper detected silence there. Safer to cut confirmed silences than risk leaving dead air.

---

## Minimum Silence Duration

| Option | Description | Selected |
|--------|-------------|----------|
| 0.3s — Very aggressive | Catches almost all silence including breath pauses. May make speech feel rushed. | |
| 0.5s — Moderate | Removes noticeable silence while keeping brief breath pauses. Good for social media. | ✓ |
| 1.0s — conservative | Only cuts longer silences. More natural feel, leaves more dead air. | |

**User's choice:** 0.5s — Moderate (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed constant | Hardcoded like NO_SPEECH_THRESHOLD. Changed by redeploying. | |
| Configurable via env var | SILENCE_MIN_DURATION env var with 0.5s default. Flexible for different content types. | ✓ |

**User's choice:** Configurable via env var
**Notes:** Allows tuning for different content types (e.g., 0.3s for fast-paced social clips, 1.0s for presentations) without rebuilding.

---

## Cut Boundary Padding

| Option | Description | Selected |
|--------|-------------|----------|
| Zero padding — hard edge | Hard cuts right at silence boundaries. Simplest but risks clipping words. | |
| ~50ms margin | Small padding before/after speech to prevent clipping. Still a hard cut, just offset. | ✓ |
| Adaptive padding | Variable padding based on audio energy at edges. More natural but much more complex. | |

**User's choice:** ~50ms margin (Recommended)
**Notes:** 50ms prevents timestamp imprecision from clipping word starts/ends. Whisper timestamps can be off by 20-50ms.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed offset | 50ms is a fixed constant in config. Simple to reason about and debug. | ✓ |
| Configurable via env var | 50ms default but can be changed. Overkill for v1. | |

**User's choice:** Fixed offset (Recommended)

---

## Cut List Detail Level

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — timestamps only | Just start/end timestamps and duration. Downstream phases recompute what they need. | |
| Detailed | Start/end, duration, original timestamp mapping, and which source confirmed each silence. | |

**User's choice:** Detailed (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| As described — full detail | original_start, original_end, new_start, new_end, duration, source. | |
| Full detail + cumulative shift | Same fields plus cumulative_shift tracking total time removed up to each cut. Makes Phase 8 SRT remapping trivial. | ✓ |

**User's choice:** Full detail + cumulative shift
**Notes:** cumulative_shift is specifically valuable for Phase 8 SRT/VTT generation — any original timestamp just needs `original_time - cumulative_shift_at_point` to get the post-cut timestamp.

---

## the agent's Discretion

- FFmpeg silencedetect noise threshold (dB level)
- Exact silence-cuts.json Pydantic schema field names and types
- Container implementation structure (follow whisper/main.py pattern)
- Audio re-extraction approach (inside container vs shared path)
- FFmpeg video assembly filter chain specifics
- Test video sample selection

## Deferred Ideas

None — discussion stayed within phase scope.