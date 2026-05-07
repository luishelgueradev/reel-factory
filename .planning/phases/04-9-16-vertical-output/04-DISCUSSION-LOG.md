# Phase 4: 9:16 Vertical Output - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 4-9:16-vertical-output
**Areas discussed:** Crop strategy, Safe zone bounds, Encoding params, Test coverage

---

## Crop Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Center-crop only (Recommended) | Center-crop only for v1. No face detection. Smart reframing deferred to future phase (SMRT-01/SMRT-02). | ✓ |
| Center-crop + face-detect fallback | Center-crop as default with face-detect strategy that falls back to center when no face found. More complex. | |
| Center-crop now, smart reframing later | face-detect as separate future step/container. Keeps container simple. | |

**User's choice:** Center-crop only
**Notes:** Smart reframing is already in v2 REQUIREMENTS (SMRT-01/SMRT-02), explicitly deferred.

| Option | Description | Selected |
|--------|-------------|----------|
| Speech-aware anchor | Compute crop center using speech segment bounding box from transcript data. Not face detection, but speech-aware. | |
| Pure center (no shift) | Always use geometric center of the frame. Simple and correct for talking-head content where speaker is centered. | ✓ |

**User's choice:** Pure center (no shift)
**Notes:** Talking-head videos typically have the speaker centered; geometric center is sufficient.

| Option | Description | Selected |
|--------|-------------|----------|
| Crop only when needed (Recommended) | Only crop when input is wider than 9:16. If already 9:16 or taller, just scale/re-encode without cropping. Prevents unnecessary data loss. | ✓ |
| Always apply crop filter | Run full crop filter chain regardless of input aspect ratio. Consistent but wasteful for already-vertical inputs. | |

**User's choice:** Crop only when needed
**Notes:** Conditional path — skip crop filter for 9:16/taller inputs, only scale and re-encode.

| Option | Description | Selected |
|--------|-------------|----------|
| Always 1080x1920 (Recommended) | Scale to exactly 1080x1920 regardless of input resolution. Uniform output size for downstream steps. | ✓ |
| 1080 wide, variable height | Scale to 1080 width but preserve aspect ratio height. More flexible but complicates Phase 5 subtitle positioning. | |

**User's choice:** Always 1080x1920
**Notes:** Uniform output size simplifies all downstream processing.

---

## Safe Zone Bounds

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded metadata (Recommended) | Safe zone values hardcoded in code, written to finalizer-info.json. Phase 5 reads the JSON. Simple, no extra config. | ✓ |
| Configurable via env vars | Make safe zone configurable via SAFE_ZONE_TOP etc. Flexible for different platforms but adds complexity now. | |

**User's choice:** Hardcoded metadata
**Notes:** v1 targets TikTok/Instagram Reels only; hardcoded values are sufficient.

| Option | Description | Selected |
|--------|-------------|----------|
| Values look good (Recommended) | top:100, bottom:230, left/right:54 at 1080x1920 are reasonable for TikTok/Reels overlay zones. | ✓ |
| Adjust the values | Values need adjustment for specific platform requirements. | |

**User's choice:** Values look good
**Notes:** Bottom 230px accounts for TikTok description area; left/right 54px ≈ 5% for side buttons.

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata only (Recommended) | Safe zone data as metadata in finalizer-info.json. No validation step. Phase 5 reads values for subtitle positioning. | ✓ |
| Metadata + validation check | Add verification that output video respects safe zone boundaries. More complex with limited v1 benefit. | |

**User's choice:** Metadata only
**Notes:** No runtime validation of safe zones — the values are static and trusted.

---

## Encoding Params

| Option | Description | Selected |
|--------|-------------|----------|
| CRF 20 (Recommended) | Good quality at reasonable file size for 1080x1920 talking-head content. | ✓ |
| CRF 23 (smaller files) | Smaller files but may show artifacts on text overlays. | |
| CRF 18 (higher quality) | Maximum quality, larger files. Overkill for social media recompression. | |

**User's choice:** CRF 20
**Notes:** Matches existing code in config.py.

| Option | Description | Selected |
|--------|-------------|----------|
| Preset medium (Recommended) | Good balance of encoding speed vs compression efficiency. ~2x realtime on modern CPUs. | ✓ |
| Preset fast (speed) | Faster encoding, slightly larger files. | |
| Preset slow (compression) | Better compression at same quality. 2-3x slower. | |

**User's choice:** Preset medium
**Notes:** Matches existing code. Good tradeoff for pipeline processing.

| Option | Description | Selected |
|--------|-------------|----------|
| Pass-through audio | Keep audio as-is. Simpler but inconsistent loudness. | |
| Loudnorm normalization (Recommended) | Keep loudnorm (I=-14, TP=-1, LRA=11). Consistent loudness across outputs. Best practice for social content. | ✓ |
| Simple AAC normalization | Just set bitrate/sample rate without loudnorm. Less processing but inconsistent volume. | |

**User's choice:** Loudnorm normalization
**Notes:** Social content benefits from consistent loudness. Matches existing code.

| Option | Description | Selected |
|--------|-------------|----------|
| Force 30fps (Recommended) | Uniform 30fps output for all downstream steps. Subtitle timing and Remotion rendering assume constant fps. | ✓ |
| Pass-through frame rate | Preserve original fps. Flexible but inconsistent outputs. | |
| Force 30fps, conditional | Force 30fps only when input differs. No-op for 30fps inputs. | |

**User's choice:** Force 30fps
**Notes:** Simplifies all downstream processing — subtitle timing and Remotion rendering can assume 30fps.

---

## Test Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Unit + integration (Recommended) | Unit tests for compute_crop (various aspect ratios) + integration tests running FFmpeg on a small test video. Runs inside Docker like other containers. | ✓ |
| Unit tests only | Cheaper to run, no FFmpeg dependency in CI, but doesn't validate actual video output. | |
| Full E2E Docker test | Most thorough but slowest. Processes test MP4 through entire container. | |

**User's choice:** Unit + integration
**Notes:** Unit tests for crop math, integration tests for FFmpeg output validation.

| Option | Description | Selected |
|--------|-------------|----------|
| Shared test video (Recommended) | Small synthetic 1-second video shared across pipeline containers. Consistent test data. | ✓ |
| Generate fixtures per test | Each container generates its own test fixture via FFmpeg. No shared files but adds overhead. | |

**User's choice:** Shared test video
**Notes:** Consistent test data across whisper, silence-cutter, and finalizer containers.

| Option | Description | Selected |
|--------|-------------|----------|
| Dimension + codec + metadata (Recommended) | Verify 1080x1920 output, H.264 codec, AAC audio, safe zone metadata in finalizer-info.json, valid manifest.json. Matches ROADMAP success criteria. | ✓ |
| Plus audio loudness validation | Also verify loudnorm target is met. More thorough but requires loudness measurement. | |
| Plus safe zone visual validation | Also verify subtitle positioning respects safe zones. | |

**User's choice:** Dimension + codec + metadata
**Notes:** Validates the three ROADMAP success criteria directly.

---

## Agent's Discretion

- Exact FFmpeg filter chain ordering for conditional crop path (scale+crop vs scale-only)
- Whether to use two-pass loudnorm (requires initial FFmpeg pass) or single-pass approximation
- Specific test fixture video creation approach
- Logging verbosity and format
- Error handling for edge cases (no audio track, corrupted input)

## Deferred Ideas

None — discussion stayed within phase scope.