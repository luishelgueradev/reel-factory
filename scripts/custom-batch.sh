#!/usr/bin/env bash
set -euo pipefail

# Custom batch runner — 18 sentence-layout variants with unique activeColor per video
# Video 1: Poppins + yellow, Video 2: font + #84e634, Video 3: font + #cff56a, rest: unique fonts + unique colors
# Usage: ./scripts/custom-batch.sh

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose"
VIDEOS_DIR="$PROJECT_DIR/videos"
ENV_FILE="$PROJECT_DIR/.env"
BACKUP_ENV="$PROJECT_DIR/.env.custom-backup"
CUR_UID=$(id -u)
CUR_GID=$(id -g)

# 18 variants: all sentence layout, fontSize=45, letterSpacing=-1, lineHeight=1.4
# Format: FONT|ACTIVE_COLOR
VARIANTS=(
  "Poppins|#FFFF00"
  "Montserrat|#84e634"
  "Inter|#cff56a"
  "Roboto|#FF6B6B"
  "Oswald|#4ECDC4"
  "BebasNeue|#FF8C42"
  "Antonio|#A855F7"
  "Raleway|#38BDF8"
  "Ubuntu|#F472B6"
  "Nunito|#34D399"
  "SpaceGrotesk|#FB923C"
  "Rubik|#818CF8"
  "SourceSans3|#FBBF24"
  "Outfit|#2DD4BF"
  "PlayfairDisplay|#E879F9"
  "LexendDeca|#60A5FA"
  "Signika|#F87171"
  "Lato|#4ADE80"
)

echo "=== Custom Batch Pipeline Run — 18 Sentence Variants ==="
echo ""

mapfile -t ALL_VIDEOS < <(find "$VIDEOS_DIR" -maxdepth 1 -name '*.mp4' -type f | sort)
VIDEO_COUNT=${#ALL_VIDEOS[@]}
VARIANT_COUNT=${#VARIANTS[@]}

if [ "$VIDEO_COUNT" -ne "$VARIANT_COUNT" ]; then
  echo "ERROR: Found $VIDEO_COUNT videos but have $VARIANT_COUNT variants"
  exit 1
fi

for idx in "${!ALL_VIDEOS[@]}"; do
  IFS='|' read -r FONT ACTIVE_COLOR <<< "${VARIANTS[$idx]}"
  echo "  Video $((idx+1)): $(basename "${ALL_VIDEOS[$idx]}") → layout=sentence font=$FONT color=$ACTIVE_COLOR"
done
echo ""

cp "$ENV_FILE" "$BACKUP_ENV"
# Always restore the user's .env on exit (incl. Ctrl-C / errors).
trap 'mv -f "$BACKUP_ENV" "$ENV_FILE" 2>/dev/null || true' EXIT INT TERM

SUCCESS=0
FAIL=0
FAILED=()

for idx in "${!ALL_VIDEOS[@]}"; do
  video_path="${ALL_VIDEOS[$idx]}"
  video_name=$(basename "$video_path" .mp4)
  job_id="custom-${video_name}"
  job_dir="$PROJECT_DIR/pipeline/$job_id"

  IFS='|' read -r FONT ACTIVE_COLOR <<< "${VARIANTS[$idx]}"

  echo "============================================================"
  echo "[$job_id] Starting pipeline (video $((idx+1)) of ${#ALL_VIDEOS[@]})"
  echo "  Layout=sentence  Font=$FONT  Size=45  LetterSp=-1  LineH=1.4  ActiveColor=$ACTIVE_COLOR"
  echo "============================================================"

  cat > "$ENV_FILE" <<EOF
PIPELINE_JOB_ID=$job_id
EOF

  rm -rf "$job_dir" 2>/dev/null || true
  docker run --rm \
    --user "$CUR_UID:$CUR_GID" \
    -v "$PROJECT_DIR/pipeline:/data/pipeline" \
    video-pipeline-base-python:latest \
    bash -c "rm -rf /data/pipeline/$job_id && mkdir -p /data/pipeline/$job_id/input"
  echo "[$job_id] Job directory cleaned"

  docker run --rm \
    --user "$CUR_UID:$CUR_GID" \
    -v "$PROJECT_DIR/pipeline:/data/pipeline" \
    -v "$video_path:/src/video.mp4:ro" \
    video-pipeline-base-python:latest \
    bash -c "cp /src/video.mp4 /data/pipeline/$job_id/input/video.mp4"
  echo "[$job_id] Input video copied ($(du -h "$video_path" | cut -f1))"

  # Step 1: Whisper transcription
  echo "[$job_id] Step 1/5: Whisper transcription..."
  if ! $COMPOSE run --rm whisper 2>&1 | tail -5; then
    echo "[$job_id] FAILED at Step 1 (Whisper)"
    FAIL=$((FAIL + 1))
    FAILED+=("$video_name (Whisper)")
    continue
  fi
  if [ ! -f "$job_dir/whisper/manifest.json" ]; then
    echo "[$job_id] FAILED: Whisper did not produce manifest.json"
    FAIL=$((FAIL + 1))
    FAILED+=("$video_name (Whisper manifest)")
    continue
  fi
  echo "[$job_id] Step 1/5: Whisper done"

  # Step 2: Silence cutter
  echo "[$job_id] Step 2/5: Silence cutting..."
  if ! $COMPOSE run --rm -e TRANSCRIPT_PATH="/data/pipeline/$job_id/whisper/transcript.json" silence-cutter 2>&1 | tail -5; then
    echo "[$job_id] FAILED at Step 2 (Silence cutter)"
    FAIL=$((FAIL + 1))
    FAILED+=("$video_name (Silence cutter)")
    continue
  fi
  if [ ! -f "$job_dir/silence-cutter/manifest.json" ]; then
    echo "[$job_id] FAILED: Silence cutter did not produce manifest.json"
    FAIL=$((FAIL + 1))
    FAILED+=("$video_name (Silence cutter manifest)")
    continue
  fi
  echo "[$job_id] Step 2/5: Silence cutter done"

  # Step 3: FFmpeg finalizer (9:16 crop)
  echo "[$job_id] Step 3/5: FFmpeg finalizer..."
  if ! $COMPOSE run --rm -e FINALIZER_INPUT_PATH="/data/pipeline/$job_id/silence-cutter/output.mp4" ffmpeg-finalizer 2>&1 | tail -5; then
    echo "[$job_id] FAILED at Step 3 (FFmpeg finalizer)"
    FAIL=$((FAIL + 1))
    FAILED+=("$video_name (FFmpeg finalizer)")
    continue
  fi
  if [ ! -f "$job_dir/ffmpeg-finalizer/manifest.json" ]; then
    echo "[$job_id] FAILED: FFmpeg finalizer did not produce manifest.json"
    FAIL=$((FAIL + 1))
    FAILED+=("$video_name (FFmpeg finalizer manifest)")
    continue
  fi
  echo "[$job_id] Step 3/5: FFmpeg finalizer done"

  # Write pipeline-config.json before remotion-renderer step
  mkdir -p "$job_dir/remotion-renderer"
  CONFIG_JSON=$(cat <<EOJ
{"subtitle":{"layout":"sentence","fontFamily":"$FONT","fontSize":45,"letterSpacing":-1,"lineHeight":1.4,"activeColor":"$ACTIVE_COLOR","backgroundHighlight":{"enabled":true,"color":"rgba(0, 0, 0, 0.6)","padding":8,"borderRadius":8}}}
EOJ
)
  echo "[$job_id] Config: layout=sentence font=$FONT size=45 activeColor=$ACTIVE_COLOR bg=dark-semi"
  echo "$CONFIG_JSON" > "$job_dir/remotion-renderer/pipeline-config.json"

  # Step 4: Remotion renderer (subtitles) with pipeline-config.json
  echo "[$job_id] Step 4/5: Remotion renderer..."
  export PIPELINE_CONFIG_PATH="/data/pipeline/$job_id/remotion-renderer/pipeline-config.json"
  if ! $COMPOSE run --rm -e PIPELINE_CONFIG_PATH remotion-renderer 2>&1 | tail -10; then
    echo "[$job_id] FAILED at Step 4 (Remotion renderer)"
    FAIL=$((FAIL + 1))
    FAILED+=("$video_name (Remotion renderer)")
    continue
  fi
  if [ ! -f "$job_dir/remotion-renderer/manifest.json" ]; then
    echo "[$job_id] FAILED: Remotion renderer did not produce manifest.json"
    FAIL=$((FAIL + 1))
    FAILED+=("$video_name (Remotion renderer manifest)")
    continue
  fi
  echo "[$job_id] Step 4/5: Remotion renderer done"

  # Step 5: SRT/VTT exporter
  echo "[$job_id] Step 5/5: SRT/VTT export..."
  if ! $COMPOSE run --rm srt-exporter 2>&1 | tail -3; then
    echo "[$job_id] FAILED at Step 5 (SRT exporter)"
    FAIL=$((FAIL + 1))
    FAILED+=("$video_name (SRT exporter)")
    continue
  fi
  if [ ! -f "$job_dir/srt-exporter/manifest.json" ]; then
    echo "[$job_id] FAILED: SRT exporter did not produce manifest.json"
    FAIL=$((FAIL + 1))
    FAILED+=("$video_name (SRT exporter manifest)")
    continue
  fi
  echo "[$job_id] Step 5/5: SRT/VTT export done"

  output_size=$(du -h "$job_dir/remotion-renderer/output.mp4" | cut -f1)
  echo "[$job_id] COMPLETE - output.mp4 size: $output_size"
  SUCCESS=$((SUCCESS + 1))
  echo ""
done

mv "$BACKUP_ENV" "$ENV_FILE"

echo "============================================================"
echo "=== Custom Batch Complete ==="
echo "============================================================"
echo "Success: $SUCCESS / ${#ALL_VIDEOS[@]}"
echo "Failed:  $FAIL / ${#ALL_VIDEOS[@]}"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "Failed videos:"
  for f in "${FAILED[@]}"; do echo "  - $f"; done
fi