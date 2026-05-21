# Phase 14 UAT — scale:2 + quality-finalizer benchmark

**Status:** PENDING — awaiting human-run benchmark per Plan 14-03 `checkpoint:human-verify` (Task 2).

Per Phase 14 D-01 / D-02 / D-10 / D-11, RENDER-04 requires a recorded scale:2 render-time
measurement plus A/V parity + BT.709 verification on the quality-finalizer output. The
benchmark cannot be fabricated; it must be measured on a real Docker build of both images
on a representative clip (the Phase 13 UAT clip at
`.planning/phases/13-encode-quality/uat/phase-13.mp4`).

This file is the canonical destination for those measurements. The continuation agent
(spawned by the orchestrator after the human runs the benchmark) will fill the table below
from the values reported on the `approved` signal.

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

> **Pending checkpoint resume.** Fill in the table below from the `approved` signal
> reported by the human after running the benchmark commands above.

| Measurement | Expected | Actual | Pass? |
|---|---|---|---|
| remotion-renderer scale:2 wall-clock (60s clip) | ≤ 3 h ceiling | _pending_ | _pending_ |
| remotion-renderer scale:1 baseline (60s clip, prior run) | reference only | _pending_ | _pending_ |
| remotion-renderer output width × height | 2160 × 3840 | _pending_ | _pending_ |
| quality-finalizer output width × height | 1080 × 1920 | _pending_ | _pending_ |
| quality-finalizer color_space | bt709 | _pending_ | _pending_ |
| quality-finalizer color_primaries | bt709 | _pending_ | _pending_ |
| quality-finalizer color_transfer | bt709 | _pending_ | _pending_ |
| Duration delta (renderer → finalizer) | ≤ 33 ms | _pending_ | _pending_ |
| Subjective sharpness vs baseline.mp4 | subtitle text visibly crisper | _pending_ | _pending_ |

### Notes / observations

_pending checkpoint resume_

---

*Phase: 14-remotion-supersampling-quality-finalizer*
*Plan 14-03 Task 2 (checkpoint:human-verify) — awaiting measurement*
