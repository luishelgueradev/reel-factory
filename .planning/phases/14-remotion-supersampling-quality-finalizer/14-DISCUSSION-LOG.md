# Phase 14: Remotion Supersampling + quality-finalizer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 14-Remotion Supersampling + quality-finalizer
**Areas discussed:** Render-time gate, Frame format (PNG vs JPEG), Config exposure, quality-finalizer encode details

---

## Render-time gate (RENDER-04)

### Gate policy
| Option | Description | Selected |
|--------|-------------|----------|
| Pause for your review | Benchmark, then STOP for human to pick scale value | |
| Auto with threshold | Define absolute time threshold; executor auto-falls-back to scale:1.5 | |
| Just ship scale:2 | Accept scale:2 cost; fall back only on outright failure | ✓ |

**User's choice:** Just ship scale:2
**Notes:** RENDER-04 benchmark still recorded as a measurement, not a gate that can flip the value.

### Timeouts
| Option | Description | Selected |
|--------|-------------|----------|
| Generous fixed ceiling | Raise renderMedia + orchestrator timeout to ~2-3h | ✓ |
| Disable / unlimited | Remove the cap entirely | |
| You decide | Planner picks based on benchmark + headroom | |

**User's choice:** Generous fixed ceiling
**Notes:** Current renderMedia timeout is 120000ms (render.ts:318) — would kill any scale:2 render.

### Benchmark clip
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 13 UAT clip | Same 60s talking-head clip for comparability | ✓ |
| You decide | Planner picks a representative clip | |

**User's choice:** Reuse Phase 13 UAT clip

---

## Frame format (PNG vs JPEG)

| Option | Description | Selected |
|--------|-------------|----------|
| PNG (honor RENDER-02) | imageFormat:'png', lossless, drop jpegQuality | |
| jpegQuality:95 (research) | Faster, near-identical; would amend RENDER-02 wording | |
| PNG, but make it switchable | Default PNG, fallback to jpegQuality:95 if untenable | ✓ |

**User's choice:** PNG, but make it switchable
**Notes:** Honors RENDER-02 by default; switch ties into the config-exposure decision.

---

## Config exposure (env vars vs constants)

### Approach
| Option | Description | Selected |
|--------|-------------|----------|
| Env vars w/ safe defaults | All render params + imageFormat read from env | ✓ |
| Constants (Phase 13 style) | Hardcode, consistent with Phase 4/13 | |
| Hybrid | Env only scale + imageFormat, rest constants | |

**User's choice:** Env vars with safe defaults
**Notes:** Deliberate divergence from Phase 13's constants-only convention; justified by scale tuning + switchable PNG.

### Defaults
| Option | Description | Selected |
|--------|-------------|----------|
| Safe default scale=1, orchestrator sets =2 | Backward-compatible, no surprise 4K on direct run | ✓ |
| Default scale=2, PNG | Phase 14 quality everywhere | |
| You decide | Planner picks consistent defaults | |

**User's choice:** Safe default scale=1, orchestrator sets =2
**Notes:** quality-finalizer must therefore handle 1080 input gracefully (probe + passthrough).

---

## quality-finalizer encode details

### Downscale target
| Option | Description | Selected |
|--------|-------------|----------|
| Probe + idempotent | ffprobe; downscale only if >1080×1920, else passthrough | ✓ |
| Always downscale to 1080×1920 | Assume 2160 input, always re-encode | |
| You decide | Planner picks | |

**User's choice:** Probe + idempotent

### Encode filters
| Option | Description | Selected |
|--------|-------------|----------|
| Clean downscale only | Lanczos + CRF18 + -c:a copy + faststart + BT.709, no unsharp | ✓ |
| Downscale + mild unsharp | Adds unsharp post-downscale (halo risk on subtitles) | |
| You decide | Planner picks (defaults to clean) | |

**User's choice:** Clean downscale only
**Notes:** No unsharp — subtitles already crisp from scale:2; unsharp belongs upstream in ffmpeg-finalizer (Phase 13).

---

## Claude's Discretion

- Orchestrator wiring mechanics (STEPS insertion point relative to srt-exporter, env-var plumbing, videoUrl repoint).
- quality-finalizer internal module layout, manifest fields, config.py constant names (mirror ffmpeg-finalizer).
- Exact timeout ceiling value (~2-3h with headroom).
- Test fixture names + whether validators extend existing validate.py or add new modules.
- How the scale:2 benchmark is recorded (UAT entry, plan note, or uat/ artifact).

## Deferred Ideas

- Real-ESRGAN AI upscaling (v2, UPSCALE-01/02) — only path that sharpens the video track.
- scale:1.5 middle ground — set aside (ship scale:2, no time-based fallback).
- Per-platform bitrate profiles / -maxrate floor / denoise (v1.2+, carried from Phase 13).
- Unified project-wide "encode tunables" surface reconciling Phase 13 constants vs Phase 14 env vars (v1.2 cleanup).
