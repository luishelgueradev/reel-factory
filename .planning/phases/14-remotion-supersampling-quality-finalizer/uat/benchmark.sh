#!/usr/bin/env bash
# Phase 14 benchmark — scale:2 render + A/V parity verification.
# Total wall-clock: ~47 min (mostly the Remotion render step).
# All measurements land in benchmark-result.txt at the end.
#
# Usage:  bash .planning/phases/14-remotion-supersampling-quality-finalizer/uat/benchmark.sh
# Run from the repo root.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$REPO_ROOT"

JOBID=benchmark-phase14
RESULT=".planning/phases/14-remotion-supersampling-quality-finalizer/uat/benchmark-result.txt"
LOG=".planning/phases/14-remotion-supersampling-quality-finalizer/uat/benchmark.log"

mkdir -p "pipeline/$JOBID/ffmpeg-finalizer" \
         "pipeline/$JOBID/whisper" \
         "pipeline/$JOBID/remotion-renderer" \
         "pipeline/$JOBID/quality-finalizer"

# Seed inputs: phase-13 baseline clip + reuse a known-good transcript.
cp -f .planning/phases/13-encode-quality/uat/phase-13.mp4 "pipeline/$JOBID/ffmpeg-finalizer/output.mp4"
cp -f pipeline/VID_20260518_114955/whisper/transcript.json "pipeline/$JOBID/whisper/transcript.json"

: > "$RESULT"
: > "$LOG"

stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

echo "=========================================" | tee -a "$RESULT"
echo "Phase 14 Benchmark — started $(stamp)"     | tee -a "$RESULT"
echo "=========================================" | tee -a "$RESULT"

echo
echo "[1/6] Building remotion-renderer image (may take a few min)..." | tee -a "$LOG"
if ! docker build -t reel-factory-remotion-renderer:latest services/remotion-renderer/ >>"$LOG" 2>&1; then
  echo "FAIL: remotion-renderer build failed — see $LOG" | tee -a "$RESULT"
  exit 1
fi

echo "[2/6] Building quality-finalizer image..." | tee -a "$LOG"
if ! docker build -t reel-factory-quality-finalizer:latest services/quality-finalizer/ >>"$LOG" 2>&1; then
  echo "FAIL: quality-finalizer build failed — see $LOG" | tee -a "$RESULT"
  exit 1
fi

echo
echo "[3/6] Running scale:2 Remotion render — THIS IS THE ~47 MIN STEP." | tee -a "$LOG"
echo "      Started: $(stamp)"                                            | tee -a "$LOG"

T0=$(date +%s)
docker run --rm \
  -v "$(pwd)/pipeline:/data/pipeline" \
  -e INPUT_PATH=/data/pipeline/$JOBID/ffmpeg-finalizer/output.mp4 \
  -e OUTPUT_PATH=/data/pipeline/$JOBID/remotion-renderer/output.mp4 \
  -e PIPELINE_JOB_ID=$JOBID \
  -e TRANSCRIPT_PATH=/data/pipeline/$JOBID/whisper/transcript.json \
  -e REMOTION_SCALE=2 \
  -e REMOTION_IMAGE_FORMAT=png \
  reel-factory-remotion-renderer:latest >>"$LOG" 2>&1
RENDER_EXIT=$?
T1=$(date +%s)
RENDER_SECONDS=$((T1 - T0))
RENDER_HMS=$(printf "%02d:%02d:%02d" $((RENDER_SECONDS/3600)) $(((RENDER_SECONDS%3600)/60)) $((RENDER_SECONDS%60)))

echo "--- Measurement 1: scale:2 render wall-clock ---" | tee -a "$RESULT"
echo "render_seconds: $RENDER_SECONDS"                   | tee -a "$RESULT"
echo "render_hh_mm_ss: $RENDER_HMS"                      | tee -a "$RESULT"
echo "render_exit_code: $RENDER_EXIT"                    | tee -a "$RESULT"
echo                                                     | tee -a "$RESULT"

if [ "$RENDER_EXIT" -ne 0 ]; then
  echo "FAIL: renderer exited non-zero — see $LOG" | tee -a "$RESULT"
  exit 1
fi

echo "[4/6] Probing renderer output dimensions..." | tee -a "$LOG"
RENDERER_DIMS=$(ffprobe -v quiet -show_entries stream=width,height \
                  -of csv=p=0:s=x "pipeline/$JOBID/remotion-renderer/output.mp4" | head -1)
echo "--- Measurement 2: renderer dimensions (expect 2160x3840) ---" | tee -a "$RESULT"
echo "renderer_dims: $RENDERER_DIMS"                                   | tee -a "$RESULT"
echo                                                                    | tee -a "$RESULT"

echo "[5/6] Running quality-finalizer (Lanczos downscale, fast)..." | tee -a "$LOG"
docker run --rm \
  -v "$(pwd)/pipeline:/data/pipeline" \
  -e INPUT_PATH=/data/pipeline/$JOBID/remotion-renderer/output.mp4 \
  -e OUTPUT_PATH=/data/pipeline/$JOBID/quality-finalizer/output.mp4 \
  -e PIPELINE_JOB_ID=$JOBID \
  reel-factory-quality-finalizer:latest >>"$LOG" 2>&1
FINALIZER_EXIT=$?
echo "finalizer_exit_code: $FINALIZER_EXIT" | tee -a "$RESULT"

if [ "$FINALIZER_EXIT" -ne 0 ]; then
  echo "FAIL: quality-finalizer exited non-zero — see $LOG" | tee -a "$RESULT"
  exit 1
fi

echo "[6/6] Probing finalizer output dimensions + BT.709 tags + A/V parity..." | tee -a "$LOG"

FINALIZER_PROBE=$(ffprobe -v quiet -show_entries stream=width,height,color_space,color_primaries,color_transfer \
                    -of json "pipeline/$JOBID/quality-finalizer/output.mp4")
echo "--- Measurement 3: finalizer dimensions + color tags (expect 1080x1920 + all three bt709) ---" | tee -a "$RESULT"
echo "$FINALIZER_PROBE" | tee -a "$RESULT"
echo                                                                                                   | tee -a "$RESULT"

RENDERER_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "pipeline/$JOBID/remotion-renderer/output.mp4")
FINALIZER_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "pipeline/$JOBID/quality-finalizer/output.mp4")
DELTA=$(awk -v a="$RENDERER_DUR" -v b="$FINALIZER_DUR" 'BEGIN { d=a-b; if (d<0) d=-d; printf "%.6f", d }')

echo "--- Measurement 4: duration delta (expect <= 0.033s) ---" | tee -a "$RESULT"
echo "renderer_duration: $RENDERER_DUR"                          | tee -a "$RESULT"
echo "finalizer_duration: $FINALIZER_DUR"                        | tee -a "$RESULT"
echo "delta_seconds: $DELTA"                                     | tee -a "$RESULT"
echo                                                              | tee -a "$RESULT"

echo "--- Measurement 5: subjective sharpness — manual ---"                                | tee -a "$RESULT"
echo "Compare these two files visually (subtitle text crispness):"                          | tee -a "$RESULT"
echo "  Phase 14 output: pipeline/$JOBID/quality-finalizer/output.mp4"                       | tee -a "$RESULT"
echo "  Phase 13 baseline: .planning/phases/13-encode-quality/uat/baseline.mp4"              | tee -a "$RESULT"
echo "Then add ONE line to this file: 'subjective_sharpness: pass' OR 'fail: <reason>'"     | tee -a "$RESULT"
echo                                                                                          | tee -a "$RESULT"

echo "=========================================" | tee -a "$RESULT"
echo "Benchmark complete — $(stamp)"             | tee -a "$RESULT"
echo "Result file: $RESULT"                      | tee -a "$RESULT"
echo "Full log:    $LOG"                         | tee -a "$RESULT"
echo "=========================================" | tee -a "$RESULT"
