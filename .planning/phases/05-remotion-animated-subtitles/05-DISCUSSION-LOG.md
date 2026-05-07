# Phase 5: Remotion + Animated Subtitles - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 05-remotion-animated-subtitles
**Areas discussed:** Transcript → captions mapping, Render pipeline & subtitle positioning

---

## Transcript → captions mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Remap in render.ts | Remotion renderer reads transcript.json + silence-cuts.json, remaps timestamps before creating TikTokPages. Logic stays in one place. | ✓ |
| Separate remap step | Add a new pipeline step that produces a remapped-transcript.json. Clean separation but more artifacts. | |
| Defer and validate first | Skip remapping, validate timing end-to-end, then add it if needed. | |

**User's choice:** Remap in render.ts
**Notes:** Keeps the pipeline simple — same container does both mapping and rendering.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Read both files in render.ts | Load transcript.json + silence-cuts.json, add SILENCE_CUTS_PATH env var to docker-compose | ✓ |
| Skip and validate first | Don't add the env var yet, validate first | |

**User's choice:** Read both files in render.ts
**Notes:** Explicit approach — render.ts reads both files and remaps when silence-cuts.json exists.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Process anyway (original timestamps) | If silence-cuts.json missing, use original timestamps. No error. | ✓ |
| Fail fast with error | Missing cuts file = error, no manifest. | |

**User's choice:** Process anyway (original timestamps)
**Notes:** Allows debugging with just whisper → remotion-renderer without silence-cutter.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Subtract cumulative_shift per-word | For each word, find preceding cut, subtract shift. Simple linear scan. | |
| Full timeline remap function | Build a remap function for any timestamp → cropped timeline. More flexible for future needs. | ✓ |

**User's choice:** Full timeline remap function
**Notes:** More flexible — works for word timestamps and any future timestamp needs (grouping, etc.).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Add remap step before createTikTokStyleCaptions | Remap timestamps first, then pass remapped data to createTikTokStyleCaptions. Existing function unchanged. | ✓ |
| Custom page grouper with inline remapping | Custom grouper that applies cumulative_shift during grouping. More control, more maintenance. | |

**User's choice:** Add remap step before createTikTokStyleCaptions
**Notes:** Keeps @remotion/captions library function intact. Remapping is a pre-processing step.

---

## Render pipeline & subtitle positioning

| Option | Description | Selected |
|--------|-------------|----------|
| 9:16 video from ffmpeg-finalizer | Remotion overlays subtitles on the already-cropped 9:16 video. Simple composition, always 1080x1920. | ✓ |
| Original aspect video + Remotion crops | Remotion handles both cropping and subtitles. More flexible but two responsibilities in one step. | |

**User's choice:** 9:16 video from ffmpeg-finalizer
**Notes:** Single responsibility — Remotion only overlays subtitles on the 9:16 video.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Read from finalizer-info.json | Remotion reads SafeZone values from Phase 4's metadata. Single source of truth. | ✓ |
| Hardcoded in composition | bottomOffset=250 already in Subtitles.tsx. Simpler but diverges from Phase 4 values. | |

**User's choice:** Read from finalizer-info.json
**Notes:** Keeps Phase 4 as single source of truth for safe zones. New FINALIZER_INFO_PATH env var.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Refine existing TikTok style | Keep existing Subtitles.tsx animations (yellow active word, white inactive, scale, spring fade). Already meets SUBT-01/SUBT-02. | ✓ |
| Redesign subtitle style | Start fresh with different animations, background boxes, gradients. | |

**User's choice:** Refine existing TikTok style
**Notes:** Existing implementation already works. Just needs dynamic safe zone positioning and timestamp remapping.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Finalizer → Remotion | Pipeline: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer. Remotion is last video step. | ✓ |
| Remotion → Finalizer | Remotion crops and overlays, then finalizer re-encodes. More complexity. | |

**User's choice:** Finalizer → Remotion
**Notes:** Pipeline order changes in docker-compose.yml. Remotion depends_on ffmpeg-finalizer.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Current render config + angle-egl flag | Keep existing H.264/30fps/multi-process, add --gl=angle-egl for Docker stability. | ✓ |
| Enhanced render pipeline with more config options | Add frame-level rendering, more render options. | |

**User's choice:** Current render config + angle-egl flag
**Notes:** Addresses the angle renderer memory leak for renders >3 minutes noted in STATE.md.

---

## the agent's Discretion

- Exact implementation of `remapTimestamps()` function
- Unit test vs E2E-only testing for the remap function
- Spring animation timing parameters in Subtitles.tsx
- Logging format and verbosity
- Whether to validate input video aspect ratio (defensive check for non-9:16)
- Error handling for edge cases (empty transcript, zero caption pages)

## Deferred Ideas

None — discussion stayed within phase scope.