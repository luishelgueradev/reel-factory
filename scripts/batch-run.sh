#!/usr/bin/env bash
set -euo pipefail

# Batch pipeline runner — processes all MP4 files in videos/ directory
# Usage: ./scripts/batch-run.sh

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose"
VIDEOS_DIR="$PROJECT_DIR/videos"
ENV_FILE="$PROJECT_DIR/.env"
BACKUP_ENV="$PROJECT_DIR/.env.batch-backup"
UID=$(id -u)
GID=$(id -g)

echo "=== Batch Pipeline Run ==="
echo "Project dir: $PROJECT_DIR"
echo "UID:GID = $UID:$GID"
echo ""

# Backup original .env
cp "$ENV_FILE" "$BACKUP_ENV"

# Find all MP4 files
mapfile -t VIDEOS < <(find "$VIDEOS_DIR" -maxdepth 1 -name '*.mp4' -type f | sort)
echo "Found ${#VIDEOS[@]} videos to process"
for v in "${VIDEOS[@]}"; do echo "  - $(basename "$v") ($(du -h "$v" | cut -f1))"; done
echo ""

SUCCESS=0
FAIL=0
FAILED=()

for video_path in "${VIDEOS[@]}"; do
  video_name=$(basename "$video_path" .mp4)
  job_id="batch-${video_name}"
  job_dir="$PROJECT_DIR/pipeline/$job_id"

  echo "============================================================"
  echo "[$job_id] Starting pipeline for $video_name"
  echo "============================================================"

  # Update .env with current job ID
  cat > "$ENV_FILE" <<EOF
PIPELINE_JOB_ID=$job_id
EOF

  # Clean previous run and create job directory (as current user, not root)
  rm -rf "$job_dir" 2>/dev/null || true
  docker run --rm \
    --user "$UID:$GID" \
    -v "$PROJECT_DIR/pipeline:/data/pipeline" \
    video-pipeline-base-python:latest \
    bash -c "rm -rf /data/pipeline/$job_id && mkdir -p /data/pipeline/$job_id/input"
  echo "[$job_id] Job directory cleaned"

  # Copy video into pipeline volume (as current user to avoid root ownership)
  docker run --rm \
    --user "$UID:$GID" \
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

  # Step 2: Silence cutter (with transcript for better cuts)
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

  # Step 4: Remotion renderer (subtitles)
  echo "[$job_id] Step 4/5: Remotion renderer..."
  if ! $COMPOSE run --rm remotion-renderer 2>&1 | tail -10; then
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

  # Get output file size
  output_size=$(du -h "$job_dir/remotion-renderer/output.mp4" | cut -f1)
  echo "[$job_id] COMPLETE — output.mp4 size: $output_size"
  SUCCESS=$((SUCCESS + 1))
  echo ""
done

# Restore original .env
mv "$BACKUP_ENV" "$ENV_FILE"

echo "============================================================"
echo "=== Batch Complete ==="
echo "============================================================"
echo "Success: $SUCCESS / ${#VIDEOS[@]}"
echo "Failed:  $FAIL / ${#VIDEOS[@]}"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "Failed videos:"
  for f in "${FAILED[@]}"; do echo "  - $f"; done
fi