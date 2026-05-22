#!/usr/bin/env bash
# Phase 14 — real end-to-end pipeline run for the subjective subtitle-sharpness UAT.
#
# Runs the FULL production step sequence via Docker (matching api-server/src/orchestrator.ts
# env vars EXACTLY), with two deliberate, documented deviations:
#   1. whisper is SKIPPED — this host has no GPU and the whisper container has no CPU fallback
#      (WHISPER_DEVICE="cuda", "No CPU fallback path in v1"). We reuse the EXISTING valid
#      transcript for VID_20260518_114955, which genuinely matches that video's audio.
#   2. PIPELINE_CONFIG_PATH is threaded into the renderer step so the captions reflect the
#      studio-saved pipeline-config.json (layout "bar", Inter, green highlight, "Inboxer" title).
#      The stock orchestrator does NOT thread this — see GAP note in the orchestrator-config-gap
#      finding. Without it the renderer would fall back to inline env defaults (yellow/white/font58).
#
# Steps run here:  [whisper:SKIPPED] -> silence-cutter -> ffmpeg-finalizer ->
#                  remotion-renderer (scale:2 + PNG + studio config) -> quality-finalizer -> srt-exporter
#
# Total wall-clock: ~35 min (dominated by the scale:2 Remotion render, ~33 min on CPU).
#
# Usage:  bash .planning/phases/14-remotion-supersampling-quality-finalizer/uat/e2e-run.sh
# Run from the repo root.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$REPO_ROOT"

JOBID="e2e-phase14"
SRC_VIDEO="videos/VID_20260518_114955.mp4"
SRC_TRANSCRIPT="pipeline/VID_20260518_114955/whisper/transcript.json"
STUDIO_CONFIG="services/remotion-studio/pipeline-config.json"
NETWORK="reel-factory_pipeline-net"
PIPE="/data/pipeline"          # in-container mount
HOSTPIPE="$(pwd)/pipeline"     # host bind source

UAT_DIR=".planning/phases/14-remotion-supersampling-quality-finalizer/uat"
RESULT="$UAT_DIR/e2e-result.txt"
LOG="$UAT_DIR/e2e-run.log"

stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
say() { echo "$*" | tee -a "$RESULT"; }

# ---- Preflight ------------------------------------------------------------
: > "$RESULT"
: > "$LOG"

say "========================================="
say "Phase 14 — real end-to-end run (jobId=$JOBID)"
say "started: $(stamp)"
say "========================================="

for f in "$SRC_VIDEO" "$SRC_TRANSCRIPT" "$STUDIO_CONFIG"; do
  if [ ! -f "$f" ]; then say "FATAL: missing required file: $f"; exit 1; fi
done

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  say "WARN: docker network '$NETWORK' not found — creating it"
  docker network create "$NETWORK" >>"$LOG" 2>&1 || { say "FATAL: cannot create network"; exit 1; }
fi

# Clean any previous run of this jobId
rm -rf "pipeline/$JOBID"
mkdir -p "pipeline/$JOBID/input" \
         "pipeline/$JOBID/whisper" \
         "pipeline/$JOBID/silence-cutter" \
         "pipeline/$JOBID/ffmpeg-finalizer" \
         "pipeline/$JOBID/remotion-renderer" \
         "pipeline/$JOBID/quality-finalizer" \
         "pipeline/$JOBID/srt-exporter"

cp "$SRC_VIDEO" "pipeline/$JOBID/input/video.mp4"
cp "$SRC_TRANSCRIPT" "pipeline/$JOBID/whisper/transcript.json"
# Thread the studio config to the renderer's job dir (consumed via PIPELINE_CONFIG_PATH below).
cp "$STUDIO_CONFIG" "pipeline/$JOBID/remotion-renderer/pipeline-config.json"

say ""
say "Input video:   $SRC_VIDEO"
say "Transcript:    $SRC_TRANSCRIPT (reused — matches this video's audio)"
say "Studio config: $STUDIO_CONFIG (layout=bar, Inter, green highlight, 'Inboxer' title)"
say "whisper:       SKIPPED (no GPU; transcript reused)"
say ""

# ---- Helper to run one pipeline step --------------------------------------
# run_step <name> <image> <env KEY=VALUE> ...
run_step() {
  local name="$1"; shift
  local image="$1"; shift
  local -a envflags=()
  for kv in "$@"; do envflags+=( -e "$kv" ); done

  echo "[$(stamp)] >>> step: $name" | tee -a "$LOG"
  local t0 t1
  t0=$(date +%s)
  docker run --rm \
    -v "$HOSTPIPE:$PIPE" \
    --network "$NETWORK" \
    "${envflags[@]}" \
    "$image:latest" >>"$LOG" 2>&1
  local rc=$?
  t1=$(date +%s)
  local secs=$((t1 - t0))
  if [ $rc -ne 0 ]; then
    say "FAIL: step '$name' exited $rc after ${secs}s — see $LOG"
    exit 1
  fi
  say "ok: $name (${secs}s)"
  return 0
}

# ---- Steps (env vars copied verbatim from orchestrator.ts STEPS) ----------

run_step silence-cutter reel-factory-silence-cutter \
  "INPUT_PATH=$PIPE/$JOBID/input/video.mp4" \
  "OUTPUT_PATH=$PIPE/$JOBID/silence-cutter/output.mp4" \
  "PIPELINE_JOB_ID=$JOBID" \
  "TRANSCRIPT_PATH=$PIPE/$JOBID/whisper/transcript.json" \
  "SILENCE_MIN_DURATION=0.5" \
  "SILENCE_CUT_SHRINK=0.4"

run_step ffmpeg-finalizer reel-factory-ffmpeg-finalizer \
  "INPUT_PATH=$PIPE/$JOBID/silence-cutter/output.mp4" \
  "OUTPUT_PATH=$PIPE/$JOBID/ffmpeg-finalizer/output.mp4" \
  "PIPELINE_JOB_ID=$JOBID" \
  "VERTICAL_WIDTH=1080" \
  "VERTICAL_HEIGHT=1920" \
  "CROP_STRATEGY=center"

say ""
say ">>> remotion-renderer at scale:2 — THIS IS THE ~33 MIN STEP ($(stamp))"
RENDER_T0=$(date +%s)
run_step remotion-renderer reel-factory-remotion-renderer \
  "INPUT_PATH=$PIPE/$JOBID/ffmpeg-finalizer/output.mp4" \
  "OUTPUT_PATH=$PIPE/$JOBID/remotion-renderer/output.mp4" \
  "PIPELINE_JOB_ID=$JOBID" \
  "TRANSCRIPT_PATH=$PIPE/$JOBID/whisper/transcript.json" \
  "SILENCE_CUTS_PATH=$PIPE/$JOBID/silence-cutter/silence-cuts.json" \
  "FINALIZER_INFO_PATH=$PIPE/$JOBID/ffmpeg-finalizer/finalizer-info.json" \
  "PIPELINE_CONFIG_PATH=$PIPE/$JOBID/remotion-renderer/pipeline-config.json" \
  "ACTIVE_COLOR=#FFFF00" \
  "INACTIVE_COLOR=#FFFFFF" \
  "FONT_SIZE=58" \
  "REMOTION_SCALE=2" \
  "REMOTION_IMAGE_FORMAT=png"
RENDER_T1=$(date +%s)
RENDER_SECS=$((RENDER_T1 - RENDER_T0))
say "scale:2 render wall-clock: ${RENDER_SECS}s ($(printf '%02d:%02d:%02d' $((RENDER_SECS/3600)) $(((RENDER_SECS%3600)/60)) $((RENDER_SECS%60))))"

run_step quality-finalizer reel-factory-quality-finalizer \
  "INPUT_PATH=$PIPE/$JOBID/remotion-renderer/output.mp4" \
  "OUTPUT_PATH=$PIPE/$JOBID/quality-finalizer/output.mp4" \
  "PIPELINE_JOB_ID=$JOBID"

run_step srt-exporter reel-factory-srt-exporter \
  "INPUT_PATH=$PIPE/$JOBID/input/video.mp4" \
  "OUTPUT_PATH=$PIPE/$JOBID/srt-exporter/output.vtt" \
  "PIPELINE_JOB_ID=$JOBID" \
  "TRANSCRIPT_PATH=$PIPE/$JOBID/whisper/transcript.json" \
  "SILENCE_CUTS_PATH=$PIPE/$JOBID/silence-cutter/silence-cuts.json"

# ---- Verification probes (ffprobe via the quality-finalizer image) --------
probe() {
  docker run --rm --entrypoint ffprobe \
    -v "$HOSTPIPE:$PIPE" \
    reel-factory-quality-finalizer:latest "$@" 2>/dev/null
}

say ""
say "--- Output verification ---"
RDIMS=$(probe -v quiet -show_entries stream=width,height -of csv=p=0:s=x "$PIPE/$JOBID/remotion-renderer/output.mp4" | head -1)
FDIMS=$(probe -v quiet -show_entries stream=width,height -of csv=p=0:s=x "$PIPE/$JOBID/quality-finalizer/output.mp4" | head -1)
RDUR=$(probe -v quiet -show_entries format=duration -of csv=p=0 "$PIPE/$JOBID/remotion-renderer/output.mp4")
FDUR=$(probe -v quiet -show_entries format=duration -of csv=p=0 "$PIPE/$JOBID/quality-finalizer/output.mp4")
DELTA=$(awk -v a="$RDUR" -v b="$FDUR" 'BEGIN{d=a-b; if(d<0)d=-d; printf "%.6f", d}')
CSPACE=$(probe -v quiet -show_entries stream=color_space -of csv=p=0 "$PIPE/$JOBID/quality-finalizer/output.mp4" | head -1)

say "renderer output dims:        $RDIMS   (expect 2160x3840)"
say "quality-finalizer dims:      $FDIMS   (expect 1080x1920)"
say "renderer duration:           $RDUR s"
say "finalizer duration:          $FDUR s"
say "A/V duration delta:          $DELTA s  (expect <= 0.033)"
say "finalizer color_space:       $CSPACE  (expect bt709)"

say ""
say "========================================="
say "DONE — $(stamp)"
say ""
say "FINAL DELIVERABLE (compare this for sharpness + studio match):"
say "  $REPO_ROOT/pipeline/$JOBID/quality-finalizer/output.mp4   (Phase 14: scale:2 -> Lanczos 1080x1920)"
say ""
say "COMPARE AGAINST:"
say "  $REPO_ROOT/pipeline/VID_20260518_114955/output/reel_with_subs.mp4   (prior scale:1 run, same video)"
say ""
say "What to check by eye:"
say "  1. Subtitle text edges: crisper / smoother anti-aliasing than the prior scale:1 output?"
say "  2. Captions match the audio words (correct transcript)?"
say "  3. Styling matches your studio design: 'bar' layout, Inter font, green (#4dff00) word highlight,"
say "     white active / gray inactive, 'Inboxer' title with red slide-down background?"
say ""
say "Then record your verdict (pass/fail + notes) and we re-run /gsd-verify-work 14."
say "Result file: $RESULT"
say "Full log:    $LOG"
say "========================================="
