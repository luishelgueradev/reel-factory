# Phase 13: Encode Quality - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Config-only encode tuning across the two existing FFmpeg-based containers (`silence-cutter` and `ffmpeg-finalizer`) to close the upstream generation-loss and color-tagging gaps that are currently degrading the v1.0 output before Remotion ever composites subtitles.

**In scope (Phase 13):**
- `silence-cutter._concatenate_segments` switches from `libx264 + aac` re-encode to `-c copy` (stream-copy) — eliminates one full lossy H.264 pass (ENC-01).
- `ffmpeg-finalizer/src/config.py` — `H264_CRF` from 20 → 18 (ENC-02).
- `ffmpeg-finalizer/src/crop.py` filter chain — add `flags=lanczos` to `scale=`, append `unsharp=5:5:0.5:5:5:0.3` after `scale+crop` and before encode flags (ENC-04).
- `ffmpeg-finalizer/src/crop.py` encode flags — add `-colorspace bt709 -color_primaries bt709 -color_trc bt709` metadata tags after `-pix_fmt yuv420p` (ENC-03).
- A/V sync + duration parity preserved across the silence-cutter change (ENC-05).
- ffprobe-based assertions in tests + a visual A/B reference render checked into `.planning/phases/13-encode-quality/uat/` for human side-by-side review.

**Out of scope (belongs to Phase 14):**
- Remotion `scale: 2`, `crf: 16`, `x264Preset: 'slow'`, `colorSpace: 'bt709'`, `jpegQuality: 95` in `services/remotion-renderer/src/render.ts` — Phase 14.
- New `quality-finalizer` Docker container (Lanczos downscale 2160×3840 → 1080×1920) — Phase 14.
- Orchestrator STEPS array changes — Phase 14 inserts `quality-finalizer` after `remotion-renderer`.
- Real-ESRGAN / Path B / GPU upscaling — explicitly deferred to v2 (see REQUIREMENTS.md "v2 Requirements").

**Boundary discipline:** This phase touches only constants and filter strings in two existing files. No new containers, no Docker Compose changes, no new dependencies, no env-var surface added (constants stay constants, per Phase 4 convention).

</domain>

<decisions>
## Implementation Decisions

### Stream-copy in silence-cutter concat (ENC-01)
- **D-01:** `services/silence-cutter/src/cut_video.py::_concatenate_segments` switches `-c:v libx264 -c:a aac` to `-c copy` (both video and audio stream-copy). `-reset_timestamps 1` stays. No env-var fallback or `SILENCE_CUTTER_CONCAT_MODE` escape hatch — drift risk is mitigated by Phase 13 E2E tests covering varied clip profiles (short/long/variable keyframe density/no-audio).
- **D-02:** Inline docstring/comment on `_concatenate_segments` updated to reflect that this step no longer re-encodes — generation loss is eliminated here and the finalizer becomes the only pre-Remotion lossy encode.

### CRF target & finalizer encode flags (ENC-02)
- **D-03:** `services/ffmpeg-finalizer/src/config.py` — `H264_CRF = 18` (was 20). Hardcoded constant, no env-var exposure, traceable to ENC-02 in the inline comment. Matches Phase 4 convention (constants tied to phase decisions).
- **D-04:** `H264_PRESET = "medium"` stays. No change to preset; only the CRF moves. Slow preset is a Phase 14 concern on the Remotion encode, not the finalizer.

### Unsharp filter — strength & placement (ENC-04)
- **D-05:** Unsharp parameters: `unsharp=5:5:0.5:5:5:0.3` (luma matrix 5×5, luma_amount 0.5; chroma matrix 5×5, chroma_amount 0.3). Mild — research-validated safe ceiling that lifts perceived texture on faces without producing halos that survive Instagram re-compression.
- **D-06:** Placement: **after** `scale+crop` and `setsar=1`, **before** the encode flags. Concretely: `scale=…:flags=lanczos , crop=… , setsar=1 , unsharp=5:5:0.5:5:5:0.3`. Sharpens the final 1080×1920 pixels that get encoded, not the source frame. Halo risk minimized by the mild amount.
- **D-07:** Unsharp is unconditional — applied on every finalizer run regardless of input. No env var. If a future regression requires conditional sharpening (e.g., for non-talking-head inputs), it becomes a gap-closure plan, not a Phase 13 knob.

### Lanczos scaling (ENC-04)
- **D-08:** Add `flags=lanczos` to every `scale=` invocation in `services/ffmpeg-finalizer/src/crop.py`. Both filter-chain branches (crop-applied and no-crop) get the flag. Lanczos vs default bicubic ≈ +10% VMAF on downscale per research SUMMARY sources.

### BT.709 color tags (ENC-03)
- **D-09:** Add `-colorspace bt709 -color_primaries bt709 -color_trc bt709` to the ffmpeg command in `crop.py`, placed after `-pix_fmt yuv420p`. **Metadata tags only**, not the `colorspace` filter — the source frames are already YUV from `silence-cutter` (which is upstream of finalizer) and the existing pipeline never recorded a transform-out-of-sRGB step. Adding the `colorspace` filter would re-interpret luminance and risk a global brightness/saturation shift across all v1.0 fixtures. Metadata tagging is the safe, correct fix for the "Instagram lavado de color" symptom.
- **D-10:** Verification via `ffprobe -show_streams` must report `color_space=bt709`, `color_primaries=bt709`, `color_transfer=bt709` on the finalizer output. This is success criterion #2 and is enforced as a hard assertion in the Phase 13 test suite.

### Verification protocol (ENC-05 + cross-cutting)
- **D-11:** Phase 13 ships with two verification artifacts: (a) **ffprobe assertions** baked into the test suite — color tags present, bitrate in 5,000–8,000 kbps band for the 60s fixture, duration delta vs silence-cutter output within ±33ms (one frame at 30fps), no new encode timestamp at the silence-cutter concat output. (b) **Visual A/B render** — the same source clip processed twice (v1.0 baseline encode flags vs Phase 13 flags) with both outputs stored under `.planning/phases/13-encode-quality/uat/` for human side-by-side review. The A/B is a hard gate before marking the phase done; ENC-04 "sin halos perceptibles" cannot be proven by ffprobe alone.
- **D-12:** The A/B baseline is generated by temporarily reverting the Phase 13 changes on a worktree (or by snapshotting a current pre-Phase-13 finalizer output) — the planner picks the cleanest mechanism. Both A and B must use the same input clip and the same pipeline order so the only variable is the finalizer's encode config.
- **D-13:** No-audio path (`-an` branch in finalizer) inherits the same Lanczos + unsharp + BT.709 changes. Existing no-audio test fixture exercises this path; assertions must run against it too.

### A/V sync invariant (ENC-05)
- **D-14:** The Phase 13 test suite includes a clip with variable keyframe spacing and a clip with audio-shorter-than-video (Whisper-cut silent tail) to exercise `-c copy` edge cases. Duration parity between `silence-cutter` output and `ffmpeg-finalizer` output stays within ±33ms — verified by ffprobe.

### Claude's Discretion
- Exact test fixture names and how the visual-A/B baseline is captured (snapshot, worktree, env-var feature flag in the test harness, etc.) — planner picks.
- Whether the existing `validate.py` modules in both services grow new validators or new test files are added.
- Inline comment style for the new flags (matching the Phase 4 D-XX convention or simpler).
- How the visual A/B is presented to a human reviewer (filenames, README, or a tiny static HTML page under `uat/`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & Requirements
- `.planning/PROJECT.md` — Core value, constraints, v1.1 milestone framing
- `.planning/REQUIREMENTS.md` — ENC-01 through ENC-05 with explicit acceptance language (the canonical requirement text)
- `.planning/ROADMAP.md` §"Phase 13: Encode Quality" — Goal + 5 success criteria + dependency on Phase 12
- `.planning/STATE.md` — Current milestone position

### Research (v1.1 — required reading for Phase 13)
- `.planning/research/SUMMARY.md` §"Phase 1: Encode Quality Wins (Config-Only)" — The exact files, lines, and ffmpeg flags this phase implements; pre-answers the macro-architecture question
- `.planning/research/PITFALLS.md` §"PATH A — Lightweight Encode-Settings Pitfalls" — A-1 (triple re-encode), A-3 (CRF too high), A-6 (BT.709 metadata vs filter distinction)
- `.planning/research/FEATURES.md` §"Table Stakes" — confirms the parameter set and §"Anti-Features" — confirms unsharp luma > 0.8 produces halos
- `.planning/research/STACK.md` — FFmpeg 7.1.1 has Lanczos, unsharp, `-c copy`, BT.709 tags natively; no new deps

### Prior Phase Context (Foundation — extend, don't rebuild)
- `.planning/phases/03-silence-detection-removal/03-CONTEXT.md` — SILC-03 A/V sync rationale + `-reset_timestamps 1` invariant that must survive the `-c copy` change
- `.planning/phases/04-9-16-vertical-output/04-CONTEXT.md` — D-08 (CRF 20 rationale being replaced), D-09 (preset medium, kept), D-04 (1080×1920 invariant), D-11 (30fps invariant), D-10 (loudnorm flow stays untouched)

### Existing Codebase (the only files Phase 13 modifies)
- `services/silence-cutter/src/cut_video.py::_concatenate_segments` — single function, change `-c:v libx264 / -c:a aac` to `-c copy`; keep `-reset_timestamps 1`
- `services/ffmpeg-finalizer/src/config.py` — `H264_CRF = 18` (was 20); update inline comment to point to ENC-02
- `services/ffmpeg-finalizer/src/crop.py` — both `filter_chain` branches gain `flags=lanczos` on `scale=` and `,unsharp=5:5:0.5:5:5:0.3` appended after `setsar=1`; the cmd list gains `-colorspace bt709 -color_primaries bt709 -color_trc bt709` after `-pix_fmt yuv420p`
- `services/ffmpeg-finalizer/src/validate.py` — extend with ffprobe-based color-tag and bitrate-range assertions (or add a new test module — planner's call)
- `services/silence-cutter/src/validate.py` — extend with concat-mode assertion (no new encode timestamp on concat output) if a structural test is appropriate

### Pipeline Order Invariant (do NOT change)
- Phase 5 + Phase 6 + Phase 12 — Pipeline order: Whisper → Silence-cutter → ffmpeg-finalizer → remotion-renderer is FIXED. Unsharp lands on the talking-head frames *before* subtitle burn-in, which is the correct order to avoid haloing subtitle text.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/silence-cutter/src/cut_video.py::_concatenate_segments` — single 30-line function; change is ~2 lines (codec args). Surrounding `_extract_segments` already uses stream-copy per the docstring.
- `services/ffmpeg-finalizer/src/config.py` — already pattern-matches Phase 4's "constant + ENV name + traceability comment" convention; CRF lives on one line.
- `services/ffmpeg-finalizer/src/crop.py` — filter chain is built as a Python f-string with two branches (`crop_applied` vs not). Both branches are short — adding `:flags=lanczos` to `scale=` and `,unsharp=...` after `setsar=1` is mechanical.
- Existing finalizer test infrastructure (Phase 4) includes ffprobe-based assertions for output dimensions; the same pattern extends to color-tag and bitrate-range checks.

### Established Patterns
- **Phase 4 convention — constants over env vars:** Encode params live as hardcoded constants in `config.py` with `_ENV` suffix names documented for future-proofing but largely unused in code. Phase 13 follows this — no new env vars.
- **Stream-copy already in use for segment extraction:** `_extract_segments` docstring confirms it uses `-c copy`. Extending stream-copy to `_concatenate_segments` is a natural symmetric change, not a new pattern.
- **Phase artifacts under `.planning/phases/<padded>/...`:** Visual A/B output lands under `.planning/phases/13-encode-quality/uat/` matching the project's existing UAT artifact convention (see Phase 12's `12-UAT.md`).
- **Validation modules per service:** Both `silence-cutter/src/validate.py` and `ffmpeg-finalizer/src/validate.py` exist with prior phase validators. Extend, don't add new top-level modules.

### Integration Points
- `silence-cutter` output → `ffmpeg-finalizer` input — the contract is "an MP4 readable by FFmpeg with frame-accurate cuts". Stream-copy does not change this contract.
- `ffmpeg-finalizer` output → `remotion-renderer` input — the contract is "a 1080×1920 H.264 MP4 with valid color tags". BT.709 tags + Lanczos + CRF 18 + unsharp do not change the size/codec contract, only the per-pixel quality and the color metadata. Phase 14 will then add `colorSpace: 'bt709'` to Remotion's own encode, which closes the color-tagging story end-to-end.
- Pipeline orchestrator (`services/api-server/src/orchestrator.ts`) — not touched in Phase 13. STEPS array is identical pre/post.

</code_context>

<specifics>
## Specific Ideas

- The unsharp values come from `.planning/research/SUMMARY.md` (`unsharp=5:5:0.5:5:5:0.3`) and are cross-confirmed against `FEATURES.md` "Anti-Features" where luma > 0.8 is explicitly flagged as halo-producing on subtitle text and skin. The 0.5 ceiling is intentional — it's the highest mild value that survives Instagram re-compression cleanly per the research sources.
- CRF 18 lands in the 5,000–8,000 kbps target band for a 60s talking-head fixture (verified target in ROADMAP success criterion #3). CRF 17 was an explicit alternative considered and rejected — pushes bitrate too high, slower encode, marginal perceptual gain on Phase 13's pre-Remotion pass given that Remotion will re-encode again in Phase 14 with its own CRF.
- BT.709 implementation is deliberately metadata-only on the finalizer. PITFALLS.md A-6 distinguishes metadata tags (`-colorspace bt709`) from the `colorspace` filter — the latter performs actual pixel conversion and is needed only when the source is in a different color space (e.g., sRGB from Chromium). Finalizer's input is YUV from silence-cutter (which inherits from the user's source MP4); metadata tagging is the correct fix. Remotion's `colorSpace: 'bt709'` in Phase 14 handles the sRGB-to-YUV conversion at the Chromium boundary.
- Visual A/B gate exists because the ENC-04 success criterion "sin halos perceptibles" is fundamentally a perceptual claim — ffprobe can't see halos. The reviewer (the user) compares two MP4s in the UAT directory and signs off.

</specifics>

<deferred>
## Deferred Ideas

- **Env-var exposure for encode params (`H264_CRF`, `UNSHARP_LUMA`, `SILENCE_CUTTER_CONCAT_MODE`)** — Considered and rejected for Phase 13 (sticks with Phase 4's constant convention). If A/B-tuning becomes a recurring need, revisit in a v1.2 phase as a unified "encode tunables" surface across all services.
- **`hqdn3d=1.5:1.5:6:6` mild denoise in ffmpeg-finalizer** — Research SUMMARY's "Should have after P1 validation (v1.1.x)" tier. Belongs to a v1.1.x or v1.2 phase once Phase 13 + 14 visual A/B confirms whether denoise is actually needed on talking-head footage at the chosen CRF.
- **Per-platform bitrate profile config (Instagram CRF 17 + 8 Mbps floor, TikTok CRF 16 + 12 Mbps floor, archive CRF 14)** — Research SUMMARY "Defer to v1.2+". Out of scope for v1.1.
- **`-maxrate`/`-bufsize` bitrate floor on the finalizer encode** — Research FEATURES.md "Table Stakes" lists upload-bitrate floor via `-maxrate`. Not in REQUIREMENTS.md for v1.1 (only ENC-01..05 are). Deferred to v1.2 unless the visual A/B shows CRF alone produces bitrate variance that platform re-compression can't survive.
- **Real-ESRGAN AI upscaling** — Already marked v2 in `.planning/REQUIREMENTS.md` (UPSCALE-01, UPSCALE-02). Gated on GPU passthrough verification in WSL2 + A/B demonstrating Phase 13 + 14 leave a remaining gap.
- **Phase 14 items intentionally NOT pulled into Phase 13** — Remotion `scale: 2`, `crf: 16`, `x264Preset: 'slow'`, `colorSpace: 'bt709'`, `jpegQuality: 95`, new `quality-finalizer` container. These have their own phase; pulling them forward would violate the phase boundary and create a giant atomic commit instead of the small, traceable, revertable changes Phase 13 is designed to be.

</deferred>

---

*Phase: 13-Encode Quality*
*Context gathered: 2026-05-20*
