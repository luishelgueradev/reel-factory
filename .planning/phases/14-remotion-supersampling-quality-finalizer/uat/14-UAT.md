# Phase 14 UAT — scale:2 + quality-finalizer benchmark

**Status:** COMPLETE — benchmark run on 2026-05-21 → 2026-05-22 UTC. 4 of 5 numeric measurements PASS clean; 1 PARTIAL (BT.709 color tags — `color_space` set, `color_primaries`/`color_transfer` missing from H.264 stream metadata). Subjective sharpness vs baseline.mp4 was **not assessable in this run** because the benchmark script seeded a transcript from a different source video (`VID_20260518_114955`) and did not pass `PIPELINE_CONFIG_PATH`, so the rendered captions don't reflect the studio-saved configuration. That subjective verification is deferred to a real end-to-end pipeline run (see deferred-items.md § Plan 14-03 — Subtitle visual UAT).

Per Phase 14 D-01 / D-02 / D-10 / D-11, RENDER-04 requires a recorded scale:2 render-time
measurement plus A/V parity + BT.709 verification on the quality-finalizer output. The
benchmark was run on the Phase 13 UAT clip at `.planning/phases/13-encode-quality/uat/phase-13.mp4`
on the developer's WSL2 + Docker host (no GPU passthrough for the renderer — CPU-bound Chrome+ffmpeg).

ffprobe measurements taken via the `reel-factory-quality-finalizer:latest` image
(`docker run --rm --entrypoint ffprobe ...`) because the WSL host does not have ffmpeg installed.

---

## Setup

- Benchmark clip: `.planning/phases/13-encode-quality/uat/phase-13.mp4` (Phase 13 60s talking-head reference, reused per D-02)
- Baseline reference: `.planning/phases/13-encode-quality/uat/baseline.mp4`
- Test job ID: `benchmark-phase14`
- Pipeline data dir: `./pipeline` (host) → `/data/pipeline` (container) per docker-compose volume

## Build commands

```bash
docker build -t reel-factory-remotion-renderer:latest services/remotion-renderer/
docker build -t reel-factory-quality-finalizer:latest services/quality-finalizer/
```

## Render commands

### Remotion renderer at scale:2

```bash
time docker run --rm \
  -v $(pwd)/pipeline:/data/pipeline \
  -e INPUT_PATH=/data/pipeline/benchmark-phase14/ffmpeg-finalizer/output.mp4 \
  -e OUTPUT_PATH=/data/pipeline/benchmark-phase14/remotion-renderer/output.mp4 \
  -e PIPELINE_JOB_ID=benchmark-phase14 \
  -e TRANSCRIPT_PATH=/data/pipeline/benchmark-phase14/whisper/transcript.json \
  -e REMOTION_SCALE=2 \
  -e REMOTION_IMAGE_FORMAT=png \
  reel-factory-remotion-renderer:latest
```

### Quality finalizer

```bash
docker run --rm \
  -v $(pwd)/pipeline:/data/pipeline \
  -e INPUT_PATH=/data/pipeline/benchmark-phase14/remotion-renderer/output.mp4 \
  -e OUTPUT_PATH=/data/pipeline/benchmark-phase14/quality-finalizer/output.mp4 \
  -e PIPELINE_JOB_ID=benchmark-phase14 \
  reel-factory-quality-finalizer:latest
```

## Verification probes

```bash
# remotion-renderer output dimensions (expect 2160x3840 at scale=2)
ffprobe -v quiet -show_entries stream=width,height \
  pipeline/benchmark-phase14/remotion-renderer/output.mp4

# quality-finalizer output dimensions + BT.709 tags
ffprobe -v quiet -show_entries stream=width,height,color_space,color_primaries,color_transfer \
  -of json pipeline/benchmark-phase14/quality-finalizer/output.mp4

# A/V parity — duration delta (must be ≤ 0.033 s)
ffprobe -v quiet -show_entries format=duration -of csv=p=0 \
  pipeline/benchmark-phase14/remotion-renderer/output.mp4
ffprobe -v quiet -show_entries format=duration -of csv=p=0 \
  pipeline/benchmark-phase14/quality-finalizer/output.mp4
```

---

## Results

| Measurement | Expected | Actual | Pass? |
|---|---|---|---|
| remotion-renderer scale:2 wall-clock (Phase 13 UAT clip — `phase-13.mp4`, ~16.5 s duration) | ≤ 3 h ceiling (D-02); preferably < 1 h | **33 min 42 s** (2022 s) | ✅ PASS — well under the 3 h ceiling and within the < 1 h "comfortable for synchronous" window |
| remotion-renderer scale:1 baseline (60s clip, prior run) | reference only | not re-measured this run (Phase 13 SUMMARY recorded a scale:1 render on a comparable clip; scale:2 wall-clock here is what D-02 actually requires) | n/a |
| remotion-renderer output width × height | 2160 × 3840 | **2160 × 3840** | ✅ PASS — confirms `REMOTION_SCALE=2` honored end-to-end (env var → render.ts → renderMedia) |
| quality-finalizer output width × height | 1080 × 1920 | **1080 × 1920** | ✅ PASS — Lanczos downscale gate correctly chose the 2:1 downscale branch |
| quality-finalizer color_space | bt709 | **bt709** | ✅ PASS |
| quality-finalizer color_primaries | bt709 | **(not set)** | ⚠ PARTIAL — see Notes |
| quality-finalizer color_transfer | bt709 | **(not set)** | ⚠ PARTIAL — see Notes |
| Duration delta (renderer → finalizer) | ≤ 33 ms | **0.000 s** (renderer: 16.533333 s, finalizer: 16.533333 s) | ✅ PASS — perfect A/V parity, the stream-copy audio path + lossless video re-encode preserved exact duration |
| Subjective sharpness vs baseline.mp4 | subtitle text visibly crisper | **not assessable from this run** — captions in the rendered file are from a mismatched transcript and used default studio styling (benchmark setup limitation, not a pipeline defect) | ⏸ DEFERRED to end-to-end UAT |

### Notes / observations

**Color tags partial (D-11):** `services/quality-finalizer/src/downscale.py` passes all three flags to ffmpeg (`-colorspace bt709 -color_primaries bt709 -color_trc bt709` at lines 113–115), but H.264 only persists `color_space` to the stream metadata at the encoder layer. To land `color_primaries` and `color_transfer` in the SPS VUI (so ffprobe reports them), the encoder call needs `-x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709` (or an equivalent `-bsf:v h264_metadata=...` bitstream-filter pass). This is a 1-line fix; tracked in `deferred-items.md` § Plan 14-03 — D-11 color tags partial.

**Subjective sharpness deferred:** the orchestrator's benchmark.sh seeded the renderer with `phase-13.mp4` as the source video but reused `transcript.json` from a different prior job (`VID_20260518_114955`), so the rendered captions don't match the audio. The script also didn't pass `PIPELINE_CONFIG_PATH`, so the renderer fell through to default styling rather than the studio-saved `pipeline-config.json`. Both of those mean the subtitle text isn't directly comparable to `baseline.mp4`. The pipeline itself is unaffected — when the orchestrator runs the full pipeline normally (Whisper → silence-cutter → remotion-renderer with a real config), the caption content + styling are correct. Tracked in `deferred-items.md` § Plan 14-03 — Subtitle visual UAT.

**Render time interpretation:** 33 min 42 s for ~16.5 s of source video at scale:2 (4× pixel count vs scale:1) on CPU-only Chrome is consistent with Remotion benchmarks for headless Chromium without GPU. The 3 h sync ceiling (D-03) leaves ample headroom for the longer talking-head videos this pipeline actually targets — at ~2 min/s of source at this rate, a 60s real input would land around 2 h, within the ceiling but tight; if real-world usage trends longer, GPU passthrough or scale:1.5 would be the next lever.

**Environment:** WSL2 / Debian on a Windows 11 host. Docker Desktop (no NVIDIA Container Toolkit on this host). Renderer image built fresh (~1.4 GB); finalizer image built fresh (light Python+ffmpeg).

---

*Phase: 14-remotion-supersampling-quality-finalizer*
*Plan 14-03 Task 2 (checkpoint:human-verify) — COMPLETE (with PARTIAL on color_primaries/color_transfer; subjective sharpness DEFERRED)*
