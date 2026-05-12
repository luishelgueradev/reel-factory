# Phase 8: SRT/VTT Subtitle Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 08-srt-vtt-subtitle-export
**Areas discussed:** Container architecture, Cue segmentation, VTT styling features

---

## Container Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| New srt-exporter container | New Docker service following INPUT_PATH/OUTPUT_PATH contract. Clean separation. | ✓ |
| Embed in remotion-renderer | Add SRT/VTT gen after render completes. No new container. | |
| Add to whisper container | Add SRT/VTT gen to existing Python service. | |

**User's choice:** New srt-exporter container
**Notes:** Consistent with pipeline architecture (D-04 Phase 1). Each processing step is an isolated container.

| Option | Description | Selected |
|--------|-------------|----------|
| Node.js (reuse remap logic) | Same runtime as Remotion. Can import remapTimestamps() from captions.ts directly. | ✓ |
| Python (whisper pattern) | Matches Whisper/silence-cutter containers. Pydantic models exist. Must reimplement remap logic. | |

**User's choice:** Node.js (reuse remap logic)
**Notes:** Key advantage is reusing the proven binary search remap logic in captions.ts.

| Option | Description | Selected |
|--------|-------------|----------|
| Import from remotion-renderer | Direct import via file path. Pragmatic for one function. | ✓ |
| Extract to shared/ npm package | Both services import from shared package. Clean but over-engineered for one function. | |

**User's choice:** Import from remotion-renderer
**Notes:** Creating a shared npm package for a single remap function is over-engineering. Can extract later if more sharing is needed.

---

## Cue Segmentation

| Option | Description | Selected |
|--------|-------------|----------|
| Natural grouping (5-8 words) | Group words into short cues at natural boundaries. TikTok-style cadence. | |
| Sentence-per-cue | One sentence per cue using Whisper segments. Clean, readable. | ✓ |
| Fixed-duration cues | Fixed time intervals (3-5s). Simple but splits mid-phrase. | |

**User's choice:** Sentence-per-cue
**Notes:** Aligns with Whisper segment boundaries which already group words into natural sentences.

| Option | Description | Selected |
|--------|-------------|----------|
| Use Whisper segments directly | Use transcript.segments[] boundaries. Simple, reliable. | ✓ |
| Re-segment from words[] | Heuristic grouping from flat word list. More control but reimplements Whisper. | |

**User's choice:** Whisper segments directly

| Option | Description | Selected |
|--------|-------------|----------|
| Split long segments at punctuation | Segments >10 words split at commas/periods. Prevents screen-filling cues. | ✓ |
| No splitting — keep as-is | Simpler code, but may produce unwieldy subtitles. | |

**User's choice:** Split long segments at punctuation

---

## VTT Styling Features

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal VTT — no styling tags | Plain WEBVTT header, no positioning/color. SRT and VTT both plain text. | ✓ |
| Styled VTT — position + color tags | Include alignment and color matching burned-in subtitles. | |

**User's choice:** Minimal VTT — no styling tags
**Notes:** Platforms strip custom styling anyway. Both formats serve platform upload needs.

| Option | Description | Selected |
|--------|-------------|----------|
| Same text, both formats | Identical content in SRT and VTT. Different format syntax only. | ✓ |
| VTT filtered to post-silence text only | VTT skips text from removed silences. More complex. | |

**User's choice:** Same text, both formats
**Notes:** Both formats serve different platforms (SRT for YouTube/editors, VTT for web players). Content is identical.

---

## the agent's Discretion

- Exact max word threshold for long segment splitting (10 words is a starting point)
- Whether to use areTimestampsAlreadyRemapped() detection from captions.ts
- TypeScript module import strategy for sharing remapTimestamps()
- Error handling for missing/empty files
- Whether to validate SRT/VTT output format
- Test fixture selection for E2E validation

## Deferred Ideas

- ASS/SSG subtitle format — future phase, SRT/VTT covers platform upload needs
- Configurable subtitle styling in SRT/VTT — platforms strip styling, minimal was chosen
- Per-word highlighting in VTT — burned-in Remotion subtitles already provide this
- Segmented VTT for HLS — not needed for v1 batch processing