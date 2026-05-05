# Phase 2: Whisper Transcription - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 2-Whisper Transcription
**Areas discussed:** Model size, Audio format, Output schema, whisperx evaluation, GPU handling, Silence data representation, Artifact strategy

---

## Model Size

| Option | Description | Selected |
|--------|-------------|----------|
| medium (recommended) | 5GB RAM, good accuracy, works on CPU & GPU. Best balance for Spanish | ✓ |
| large-v3 | ~10GB VRAM, best accuracy but slow. GPU-only | |
| turbo | ~6GB VRAM, very fast, very good accuracy. GPU-only | |
| small | ~2GB, fast, decent accuracy. Good for CPU-only | |

**User's choice:** medium
**Notes:** Best balance for Spanish — verified in STACK.md model guide.

---

## Audio Format

| Option | Description | Selected |
|--------|-------------|----------|
| 16kHz WAV (recommended) | Explicit resampling avoids quality loss from Whisper's internal resampler | ✓ |
| Original format | Extract as-is, let Whisper resample internally — simpler but less control | |

**User's choice:** 16kHz WAV
**Notes:** Explicit resampling gives deterministic audio properties and avoids quality artifacts.

---

## Output Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Word list + segments (recommended) | Flat list of {word, start, end, confidence} plus segment grouping. Direct mapping to Remotion TikTokPage tokens | ✓ |
| Segment-oriented | SRT-like structure with segment number, start/end, text. More standard but requires parsing for word-level data | |

**User's choice:** Word list + segments
**Notes:** Simpler format that directly serves both Phase 3 (no_speech_prob filtering) and Phase 5 (word-level subtitle mapping).

---

## whisperx Evaluation

| Option | Description | Selected |
|--------|-------------|----------|
| Research-only (recommended) | Investigate whisperx vs faster-whisper alignment during planning | |
| Parallel implementation | Both containers, choose winner based on test results | |
| whisperx first | Use whisperx as primary tool, faster-whisper as fallback | ✓ |

**User's choice:** whisperx first
**Notes:** whisperx as primary engine with faster-whisper as fallback plan. If whisperx alignment proves unreliable, switch to faster-whisper.

---

## GPU Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect (recommended) | Use CUDA if available, fall back to CPU with int8 | |
| CPU-only | Simpler, no GPU drivers needed, ~4-10x slower | |
| GPU-required | Fastest but won't run without GPU hardware | ✓ |

**User's choice:** GPU-required
**Notes:** Container assumes CUDA is available, fails fast if not. No CPU fallback path in v1.

---

## Silence Data Representation

| Option | Description | Selected |
|--------|-------------|----------|
| Per-word no_speech prob (recommended) | Include no_speech probability per word in transcript.json. Phase 3 cross-references with FFmpeg | ✓ |
| Dedicated silence segments | Separate silence segments array alongside word/segment data | |

**User's choice:** Per-word no_speech prob
**Notes:** Single source of truth for all Whisper data. Phase 3 can derive silence segments by filtering on probability threshold.

---

## Agent's Discretion

- Exact Python package versions (whisperx, faster-whisper, torch, ctranslate2)
- Container entrypoint script structure and error handling patterns
- Specific hallucination filter implementation details
- Test audio sample selection for validation
- Logging verbosity and format

## Deferred Ideas

None — discussion stayed within phase scope.