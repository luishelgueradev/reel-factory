# Phase 14: Remotion Supersampling + quality-finalizer - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Make subtitles and overlays render visibly sharper by supersampling the Remotion render at `scale: 2` (output 2160×3840), then add a **new `quality-finalizer` Docker container** that Lanczos-downscales back to the deliverable 1080×1920 in a single final encode. The user-facing output resolution does not change (still 9:16 1080×1920); only per-pixel subtitle/overlay sharpness and color correctness improve.

**In scope (Phase 14):**
- `services/remotion-renderer/src/render.ts` — add `scale`, `crf`, `x264Preset`, `colorSpace`, `jpegQuality`, `imageFormat` to the `renderMedia()` call, read from env vars with safe defaults (RENDER-01, RENDER-02).
- New `services/quality-finalizer/` Docker container (Python + FFmpeg, inherits the same base image as `ffmpeg-finalizer`): Dockerfile, `main.py`, `src/config.py`, `src/downscale.py` (RENDER-03).
- `services/api-server/src/orchestrator.ts` — insert `quality-finalizer` into the STEPS array after `remotion-renderer`; set `REMOTION_SCALE=2` (+ PNG) env for the remotion-renderer step; point the final `videoUrl` at `quality-finalizer/output.mp4` (RENDER-03).
- Raise render timeouts (renderMedia + orchestrator per-step) to accommodate scale:2 (RENDER-04).
- Benchmark + document scale:2 render-time impact on the Phase 13 UAT clip (RENDER-04).
- A/V parity verification on quality-finalizer output (success criterion #5).

**Out of scope (deferred):**
- Real-ESRGAN / Path B / GPU AI upscaling — explicitly v2 (UPSCALE-01, UPSCALE-02 in REQUIREMENTS.md). This phase does NOT improve the background video track sharpness (see A-2 below).
- Any change to `silence-cutter`, `ffmpeg-finalizer`, or `whisper` — those were finalized in Phase 13. quality-finalizer is purely additive.
- Per-platform bitrate profiles, `-maxrate`/`-bufsize` floors, denoise — deferred per Phase 13 CONTEXT.

**Boundary discipline:** Adds exactly one new container and parameter changes to two existing files (`render.ts`, `orchestrator.ts`). No structural refactor of existing steps. `scale: 2` + `quality-finalizer` are co-dependent and must ship together — enabling `scale: 2` without the downscale step produces an undeliverable 4K file.

**Critical truth (A-2, do not misframe):** `scale: 2` sharpens only React-rendered content — subtitles and SVG/overlay graphics re-rasterize at 2x deviceScaleFactor. It does **NOT** sharpen the background `<OffthreadVideo>` track, which decodes at the source's native resolution regardless of scale. Phase 14 success criterion #1 ("subtitle text visibly sharper") is correct; do not expect or claim video-track definition gains from this phase.

</domain>

<decisions>
## Implementation Decisions

### Render-time gate & scale value (RENDER-04)
- **D-01:** Ship `scale: 2`. The user accepts the render-time cost (research estimate ~2,800s / ~47min vs ~693s at scale:1 on a representative clip). There is **no automatic fallback** to scale:1.5 — fall back only if a scale:2 render fails outright (crash/OOM), not on a time threshold.
- **D-02:** RENDER-04's benchmark is still mandatory as a **record-keeping measurement**, not a gate that can flip the scale value. Measure and document the scale:2 render time (and the scale:1 baseline for comparison) in the plan/UAT. **Reuse the Phase 13 UAT 60s talking-head clip** (`.planning/phases/13-encode-quality/uat/`) so results are comparable to the encode-quality baseline.
- **D-03:** Render timeouts must be raised to a **generous fixed ceiling (~2–3 hours)** — `renderMedia({ timeoutInMilliseconds })` is currently `120000` (2 min) at `render.ts:318` and would kill any scale:2 render. Also raise any orchestrator per-step timeout. The chosen ceiling value must be documented inline.

### Frame capture format (RENDER-01, RENDER-02)
- **D-04:** Default to lossless PNG frame capture (`imageFormat: 'png'`), honoring RENDER-02's "captura de frames sin pérdida (PNG)" wording exactly — eliminates intermediate JPEG DCT artifacts at high-contrast subtitle edges.
- **D-05:** PNG is **switchable** to `jpegQuality: 95` via config (env var, see D-07) if PNG render time/disk proves untenable. `jpegQuality` is set but inert when `imageFormat: 'png'`; it becomes the active knob only when switched to JPEG. RENDER-02 stays satisfied by the PNG default.

### Config exposure (deliberate divergence from Phase 13)
- **D-06:** Phase 14 render params are exposed as **env vars with safe baked-in defaults** — `REMOTION_SCALE`, `REMOTION_CRF`, `REMOTION_X264_PRESET`, `REMOTION_COLOR_SPACE`, `REMOTION_JPEG_QUALITY`, `REMOTION_IMAGE_FORMAT`. This is a **deliberate divergence** from Phase 13's constants-only convention (Phase 4 D-XX). Rationale: RENDER-04 anticipates scale tuning and D-05 requires a runtime PNG/JPEG switch — env exposure makes both config-only, no code edit. The planner should note this divergence in the implementation and keep the env-var names self-documenting.
- **D-07:** Safe defaults in `render.ts` are **scale=1 + JPEG** (current behavior — backward-compatible, fast, no surprise 4K output when someone runs `render.ts` directly outside the orchestrator). The **orchestrator explicitly sets `REMOTION_SCALE=2` + PNG** for the pipeline's remotion-renderer step. Consequence: `quality-finalizer` must handle a 1080×1920 input gracefully (see D-08), because the renderer's default path can legitimately emit 1080.

### quality-finalizer behavior (RENDER-03, success criterion #5)
- **D-08:** **Probe + idempotent downscale.** `quality-finalizer` runs `ffprobe` on its input: if larger than 1080×1920 (the scale:2 / 2160×3840 case) it Lanczos-downscales to 1080×1920; if already 1080×1920 (the default/direct-run case) it passes through via stream-copy (no needless re-encode). Robust to either scale value, no surprise double-encode.
- **D-09:** **Clean downscale only.** The encode is `scale=1080:1920:flags=lanczos` + `CRF 18` + `-c:a copy` (audio untouched → A/V duration & sync parity per success criterion #5) + `-movflags +faststart`, carrying through the BT.709 color tags. **No unsharp filter** — Remotion already rendered subtitles crisp at 2x density, and sharpening the downscale would risk halos on the burnt-in subtitle text. This matches the research recommendation.
- **D-10:** A/V parity (success criterion #5) verified the Phase 13 way: ffprobe duration delta between quality-finalizer input and output within ±33ms (one frame at 30fps); audio stream-copied so it is bit-identical.

### Color pipeline (RENDER-01, completes the BT.709 story)
- **D-11:** Remotion's `colorSpace: 'bt709'` performs the actual sRGB→YUV BT.709 conversion at the Chromium boundary (Chromium renders sRGB). This is the more important half of the BT.709 work; Phase 13's finalizer only added metadata tags. quality-finalizer carries the BT.709 tags through the downscale (no re-interpretation). Verify with `ffprobe -show_streams` showing `color_space=bt709` on the final 1080×1920 output.

### Claude's Discretion
- Exact orchestrator wiring mechanics: where `quality-finalizer` slots relative to `srt-exporter` (srt-exporter consumes the transcript, not the rendered video, so ordering between them is free), env-var plumbing into the remotion-renderer step, and the `videoUrl` repoint to `quality-finalizer/output.mp4`. Follow the existing STEPS step-contract pattern (INPUT_PATH/OUTPUT_PATH/manifest.json).
- quality-finalizer internal module layout, manifest.json fields, and `config.py` constant names — mirror `ffmpeg-finalizer`'s structure.
- The exact generous timeout ceiling value (anywhere ~2–3h with headroom over the measured scale:2 time).
- Test fixture names and whether new validators extend existing `validate.py` patterns or add new test modules.
- How the scale:2 render-time benchmark is recorded (UAT.md entry, plan note, or a small artifact under the phase's `uat/`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & Requirements
- `.planning/REQUIREMENTS.md` — RENDER-01..RENDER-04 with explicit acceptance language (canonical requirement text); note RENDER-02 mandates PNG (resolved by D-04). UPSCALE-01/02 confirm AI upscaling is v2.
- `.planning/ROADMAP.md` §"Phase 14: Remotion Supersampling + quality-finalizer" — Goal + 5 success criteria + dependency on Phase 13.
- `.planning/PROJECT.md` — Core value, constraints, v1.1 milestone framing.
- `.planning/STATE.md` — Current milestone position.

### Research (v1.1 — required reading for Phase 14)
- `.planning/research/SUMMARY.md` §"Phase 2: Remotion Supersampling + quality-finalizer Step" — the exact files, params, and the mandatory-companion-step architecture; pre-answers most of the technical "how".
- `.planning/research/SUMMARY.md` §"Risks & Mitigations" — A-2 (scale:2 does NOT sharpen video track), A-6 (BT.709 metadata vs conversion), and the scale:2 render-time / timeout warnings.
- `.planning/research/PITFALLS.md` — A-2 (supersampling scope), the mandatory downscale step, the silence-cutter `-c copy` × `-reset_timestamps 1` interaction note.
- `.planning/research/FEATURES.md` — confirms scale:2 (P1, most visible defect), jpegQuality:95, crf:16, imageFormat:'png' tradeoff.
- `.planning/research/STACK.md` — Remotion 4.0.457 supports scale/crf/x264Preset/colorSpace/jpegQuality/imageFormat natively; FFmpeg 7.1.1 has Lanczos; no new deps.
- https://www.remotion.dev/docs/quality — bt709 colorspace, PNG vs JPEG, CRF guidance (external).

### Prior Phase Context (extend, don't rebuild)
- `.planning/phases/13-encode-quality/13-CONTEXT.md` — the "Out of scope (belongs to Phase 14)" block that pre-defined this phase's param set; the BT.709 finalizer-metadata half (D-09/D-10 there); the constants-only convention that Phase 14 deliberately diverges from (see D-06 here); and the Phase 13 UAT clip reused for benchmarking.
- `.planning/phases/04-9-16-vertical-output/04-CONTEXT.md` — 1080×1920 invariant (D-04), 30fps invariant (D-11) — quality-finalizer output must honor both.
- `.planning/phases/03-silence-detection-removal/03-CONTEXT.md` — A/V sync invariant rationale for the parity check (D-10).

### Existing Codebase (files Phase 14 touches or templates from)
- `services/remotion-renderer/src/render.ts` — the `renderMedia()` call (~line 307) gains scale/crf/x264Preset/colorSpace/jpegQuality/imageFormat from env; `timeoutInMilliseconds` at `render.ts:318` (currently 120000) must be raised.
- `services/ffmpeg-finalizer/` — the structural template for the new `services/quality-finalizer/` (Python + FFmpeg, same base image, same manifest/step contract).
- `services/api-server/src/orchestrator.ts` — STEPS array (~line 56) + `videoUrl` (~line 331); insert quality-finalizer after remotion-renderer, set REMOTION_SCALE=2 env, repoint videoUrl.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/ffmpeg-finalizer/` is a near-exact template for `quality-finalizer`: same base-python image, FFmpeg invocation pattern, `config.py` constants + `_ENV` naming, manifest.json artifact, and ffprobe-based validators. The new container is "ffmpeg-finalizer minus crop/unsharp, plus probe-gated Lanczos downscale".
- `render.ts:getVideoDimensions` already shells `ffprobe` for width/height — the same idiom can seed quality-finalizer's probe logic (D-08).
- Existing finalizer ffprobe assertions (color tags, dimensions, duration delta) extend directly to quality-finalizer's A/V parity + BT.709 checks (D-10, D-11).

### Established Patterns
- **Step contract:** every step reads INPUT_PATH → writes OUTPUT_PATH + manifest.json; new steps slot into orchestrator STEPS without modifying existing steps. quality-finalizer follows this exactly.
- **Pipeline order is FIXED and additive:** Whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → [NEW] quality-finalizer → srt-exporter.
- **Phase 13 used constants; Phase 14 uses env vars** — a conscious, documented divergence (D-06), not a violation. Keep defaults safe so direct/non-orchestrated runs stay backward-compatible (D-07).

### Integration Points
- `remotion-renderer` output → `quality-finalizer` input: contract becomes "an MP4 that may be 2160×3840 (scale:2) or 1080×1920 (scale:1); finalizer probes and normalizes to 1080×1920".
- `quality-finalizer` output → final `videoUrl`: orchestrator repoints the user-facing artifact from `remotion-renderer/output.mp4` to `quality-finalizer/output.mp4`.
- `srt-exporter` is independent of the rendered video (consumes transcript), so its ordering relative to quality-finalizer is free.

</code_context>

<specifics>
## Specific Ideas

- The param set `scale:2 / crf:16 / x264Preset:'slow' / colorSpace:'bt709' / jpegQuality:95 / imageFormat:'png'` comes verbatim from `.planning/research/SUMMARY.md` §Phase 2 and was pre-reserved by Phase 13's CONTEXT. PNG (D-04) overrides the research's jpegQuality:95 default to honor RENDER-02, with jpegQuality:95 kept as the switchable fallback (D-05).
- quality-finalizer downscale = `scale=1080:1920:flags=lanczos`, CRF 18, `-c:a copy`, `+faststart` (research §Phase 2 build target), with the probe-gated idempotency added on top (D-08) to handle the scale=1 default path.
- "No unsharp on the downscale" (D-09) is deliberate: unsharp belongs upstream on the talking-head frames in ffmpeg-finalizer (Phase 13 D-05/D-06, applied before subtitle burn-in); applying it again post-subtitle would halo the text.

</specifics>

<deferred>
## Deferred Ideas

- **Real-ESRGAN AI upscaling of the background video track** — v2 (UPSCALE-01/02). This is the only path that improves video-track sharpness (scale:2 cannot, per A-2). Gated on GPU passthrough verification in WSL2 + an A/B showing Phase 13+14 leave a remaining gap.
- **scale:1.5 as a render-time middle ground** — considered and set aside (D-01: ship scale:2, no time-based fallback). Revisit only if scale:2 proves operationally painful in real batch use.
- **Per-platform bitrate profiles / `-maxrate` floor / denoise** — carried over from Phase 13's deferred list; still v1.2+.
- **Unified "encode tunables" surface across all services** — Phase 14 introduces env vars for the renderer only; a project-wide tunables convention (reconciling Phase 13 constants vs Phase 14 env vars) could be a v1.2 cleanup.

None of these block Phase 14.

</deferred>

---

*Phase: 14-Remotion Supersampling + quality-finalizer*
*Context gathered: 2026-05-21*
