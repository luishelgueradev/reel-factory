# Phase 13: Encode Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 13-Encode Quality
**Areas discussed:** Unsharp config (strength & placement), CRF target & configurability, Stream-copy safety net, Verification protocol

---

## Unsharp strength

| Option | Description | Selected |
|--------|-------------|----------|
| Mild (luma 0.5, chroma 0.3) — Recommended | Research default: `unsharp=5:5:0.5:5:5:0.3`. Visible texture lift on faces with no halos in side-by-side tests. Survives Instagram re-encode cleanly. Safe ceiling for talking-head content. | ✓ |
| Very mild (luma 0.3, chroma 0.2) | Conservative: `unsharp=5:5:0.3:5:5:0.2`. Less perceived sharpness, near-zero risk of halos even on edge cases. | |
| Skip unsharp — rely on CRF + Lanczos only | No unsharp filter. Documented in REQUIREMENTS as "unsharp suave" but not strictly mandatory if Lanczos alone is enough. | |
| Expose strength as env var, default mild | `UNSHARP_LUMA` / `UNSHARP_CHROMA` env vars with safe defaults. Lets A/B-tune from docker-compose.yml without rebuilds. | |

**User's choice:** Mild (luma 0.5, chroma 0.3) — Recommended
**Notes:** Locks the research-validated safe ceiling. ENC-04 ("sin halos perceptibles") satisfied; visible texture lift on faces with no halo risk on subtitle text or skin gradients.

---

## Unsharp placement

| Option | Description | Selected |
|--------|-------------|----------|
| After scale+crop, before encode — Recommended | Filter chain: `scale=…:flags=lanczos , crop=… , setsar=1 , unsharp=…`. Sharpens the final 1080×1920 pixels that get encoded. | ✓ |
| Before scale (sharpen at source resolution) | `unsharp` first, then scale+crop. Lanczos downscale slightly softens the result. Lower halo risk but Lanczos undoes part of the sharpening. | |

**User's choice:** After scale+crop, before encode — Recommended
**Notes:** Sharpens the actual delivered pixels. Halo risk minimized by the mild amount choice above.

---

## CRF target value & configurability

| Option | Description | Selected |
|--------|-------------|----------|
| Lock CRF = 18 (hardcoded constant) — Recommended | Replace `H264_CRF = 20` with `H264_CRF = 18` in `services/ffmpeg-finalizer/src/config.py`. Matches Phase 4 convention. Lands in the 5,000–8,000 kbps target band. | ✓ |
| Lock CRF = 17 (slightly higher quality) | Pushes bitrate to the high end of the band. More headroom against Instagram's re-encode, but bigger files and slower encode. | |
| Expose `H264_CRF` as env var (default 18) | `H264_CRF_ENV` reads env var, falls back to 18. Lets tune CRF per-job or per-environment via docker-compose without rebuild. | |

**User's choice:** Lock CRF = 18 (hardcoded constant) — Recommended
**Notes:** Sticks with Phase 4's constant-over-env-var convention. Traceable to ENC-02; revertable as a single-line change.

---

## Stream-copy safety net

| Option | Description | Selected |
|--------|-------------|----------|
| Pure stream-copy, no fallback — verify via tests, then commit — Recommended | Replace `-c:v libx264 / -c:a aac` with `-c copy`. Drift risk mitigated by Phase 13 tests covering multiple clip profiles. Fix in gap-closure if a regression appears later. | ✓ |
| Stream-copy with env-var escape hatch (`SILENCE_CUTTER_CONCAT_MODE`) | Default `copy`; env var falls back to `reencode`. Lets production operators flip the switch without code change. More config surface. | |
| Two-step: stream-copy then validate — abort if duration delta > 33ms | After concat with `-c copy`, run ffprobe duration check; abort on >33ms drift. Structural drift detection. | |

**User's choice:** Pure stream-copy, no fallback — verify via tests, then commit — Recommended
**Notes:** Lowest complexity. The duration-parity check still happens in the verification step (D-11/D-14 in CONTEXT.md) — just not as a structural pipeline abort, only as an assertion in the test suite.

---

## Verification protocol

| Option | Description | Selected |
|--------|-------------|----------|
| ffprobe assertions + visual A/B side-by-side — Recommended | Test-suite ffprobe assertions (color tags, bitrate range, duration parity) plus a reference clip processed through v1.0 baseline vs Phase 13 finalizer, both stored under `.planning/phases/13-encode-quality/uat/` for human review. Closes the ENC-04 "no halos" loop. | ✓ |
| ffprobe assertions only | Trust the research-grade defaults to land in the safe zone. Defer visual validation to Phase 14. Faster but ENC-04 halo check becomes implicit. | |
| Full UAT — visual A/B + recorded screen capture against an Instagram reference | Same as A/B plus upload to a test Instagram account, compare against a reference Reel. Highest confidence but doesn't belong in Phase 13 (it's the v1.1 milestone gate, not the phase gate). | |

**User's choice:** ffprobe assertions + visual A/B side-by-side — Recommended
**Notes:** A/B is a hard gate before marking the phase done. Reviewer compares two MP4s in `uat/`. Instagram-upload validation is deferred to the milestone-level UAT, consistent with how prior phases handled platform-level checks.

---

## Claude's Discretion

- Exact test fixture names and how the visual-A/B baseline clip is captured (snapshot, worktree, env-var feature flag in the test harness, etc.) — planner picks.
- Whether the existing `validate.py` modules grow new validators or new test files are added.
- Inline comment style for the new flags (matching Phase 4 D-XX convention or simpler).
- How the visual A/B is presented to a human reviewer (filenames, README, or a tiny static HTML page under `uat/`).

## Deferred Ideas

- Env-var exposure for encode params (`H264_CRF`, `UNSHARP_LUMA`, `SILENCE_CUTTER_CONCAT_MODE`) — revisit in v1.2 if A/B-tuning becomes a recurring need.
- Mild `hqdn3d=1.5:1.5:6:6` denoise — research SUMMARY "Should have after P1 validation (v1.1.x)".
- Per-platform bitrate profile config — research SUMMARY "Defer to v1.2+".
- `-maxrate` / `-bufsize` bitrate floor — research FEATURES.md table-stakes but not in v1.1 REQUIREMENTS.md.
- Real-ESRGAN AI upscaling — v2, gated on WSL2 GPU passthrough verification.
- Phase 14 items (Remotion `scale: 2`, `crf: 16`, `x264Preset: 'slow'`, `colorSpace: 'bt709'`, `jpegQuality: 95`, new `quality-finalizer` container) — explicitly kept out of Phase 13 to preserve atomic-commit hygiene.
