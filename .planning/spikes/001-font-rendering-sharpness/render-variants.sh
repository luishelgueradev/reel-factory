#!/usr/bin/env bash
# Spike 001 — render variants A (scale:1) and B (scale:1.333) for the sharpness comparison.
# Reuses the e2e-phase14 ffmpeg-finalizer output as the renderer input (same source for all
# variants — only REMOTION_SCALE differs). Variant C (scale:2) already exists from the e2e run.
#
# A: REMOTION_SCALE=1     -> 1080x1920 direct (no downscale; already target)
# B: REMOTION_SCALE=1.333 -> 1440x2560 -> Lanczos downscale -> 1080x1920
#
# Run from repo root. ~10min (A) + ~18min (B).

set -uo pipefail
cd "$(cd "$(dirname "$0")/../../.." && pwd)"

PIPE=/data/pipeline
HOSTPIPE="$(pwd)/pipeline"
NET=reel-factory_pipeline-net
SRC_JOB=e2e-phase14   # source of the shared ffmpeg-finalizer input + transcript + config
SPIKE_DIR=.planning/spikes/001-font-rendering-sharpness
LOG="$SPIKE_DIR/render-variants.log"
: > "$LOG"

stamp(){ date -u +"%Y-%m-%dT%H:%M:%SZ"; }

render_variant() {
  local name="$1" scale="$2" job="spike001-$1"
  echo "[$(stamp)] === variant $name (REMOTION_SCALE=$scale) ===" | tee -a "$LOG"
  rm -rf "pipeline/$job"
  mkdir -p "pipeline/$job/remotion-renderer" "pipeline/$job/quality-finalizer"
  # Reuse shared inputs from the e2e job
  cp "pipeline/$SRC_JOB/ffmpeg-finalizer/output.mp4" "pipeline/$job/" 2>/dev/null
  mkdir -p "pipeline/$job/ffmpeg-finalizer" "pipeline/$job/whisper" "pipeline/$job/silence-cutter"
  cp "pipeline/$SRC_JOB/ffmpeg-finalizer/output.mp4"  "pipeline/$job/ffmpeg-finalizer/"  2>/dev/null
  cp "pipeline/$SRC_JOB/ffmpeg-finalizer/finalizer-info.json" "pipeline/$job/ffmpeg-finalizer/" 2>/dev/null
  cp "pipeline/$SRC_JOB/whisper/transcript.json"      "pipeline/$job/whisper/"            2>/dev/null
  cp "pipeline/$SRC_JOB/silence-cutter/silence-cuts.json" "pipeline/$job/silence-cutter/" 2>/dev/null
  cp "pipeline/$SRC_JOB/remotion-renderer/pipeline-config.json" "pipeline/$job/remotion-renderer/" 2>/dev/null

  local t0 t1
  t0=$(date +%s)
  docker run --rm -v "$HOSTPIPE:$PIPE" --network "$NET" \
    -e INPUT_PATH=$PIPE/$job/ffmpeg-finalizer/output.mp4 \
    -e OUTPUT_PATH=$PIPE/$job/remotion-renderer/output.mp4 \
    -e PIPELINE_JOB_ID=$job \
    -e TRANSCRIPT_PATH=$PIPE/$job/whisper/transcript.json \
    -e SILENCE_CUTS_PATH=$PIPE/$job/silence-cutter/silence-cuts.json \
    -e FINALIZER_INFO_PATH=$PIPE/$job/ffmpeg-finalizer/finalizer-info.json \
    -e PIPELINE_CONFIG_PATH=$PIPE/$job/remotion-renderer/pipeline-config.json \
    -e ACTIVE_COLOR='#FFFF00' -e INACTIVE_COLOR='#FFFFFF' -e FONT_SIZE=58 \
    -e REMOTION_SCALE=$scale -e REMOTION_IMAGE_FORMAT=png \
    reel-factory-remotion-renderer:latest >>"$LOG" 2>&1
  local rrc=$?
  t1=$(date +%s)
  echo "[$(stamp)] $name render rc=$rrc in $((t1-t0))s" | tee -a "$LOG"
  [ $rrc -ne 0 ] && return 1

  # Downscale to 1080x1920 via quality-finalizer (idempotent: stream-copies if already 1080)
  docker run --rm -v "$HOSTPIPE:$PIPE" --network "$NET" \
    -e INPUT_PATH=$PIPE/$job/remotion-renderer/output.mp4 \
    -e OUTPUT_PATH=$PIPE/$job/quality-finalizer/output.mp4 \
    -e PIPELINE_JOB_ID=$job \
    reel-factory-quality-finalizer:latest >>"$LOG" 2>&1
  echo "[$(stamp)] $name finalize rc=$? " | tee -a "$LOG"
}

echo "[$(stamp)] Spike 001 variant renders starting" | tee -a "$LOG"
render_variant A 1
render_variant B 1.333
echo "[$(stamp)] DONE — variant outputs:" | tee -a "$LOG"
echo "  A: pipeline/spike001-A/quality-finalizer/output.mp4" | tee -a "$LOG"
echo "  B: pipeline/spike001-B/quality-finalizer/output.mp4" | tee -a "$LOG"
