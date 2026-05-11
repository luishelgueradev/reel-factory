#!/usr/bin/env bash
# Visual test for ffmpeg-finalizer — keeps output files for manual inspection
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

JOB_ID="uat-visual-$(date +%s)"
DIR="pipeline/${JOB_ID}"
mkdir -p "${DIR}"/{input,ffmpeg-finalizer}

echo "Job ID: ${JOB_ID}"
echo "Output dir: ${DIR}"
echo ""

# Create synthetic 16:9 test video using Docker (same method as E2E script)
echo "Creating 1920x1080 test video..."
docker compose run --rm \
    -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
    --entrypoint bash \
    base-python \
    -c "mkdir -p /data/pipeline/${JOB_ID}/input && ffmpeg -y -f lavfi -i testsrc=duration=5:size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:duration=5 -c:v libx264 -pix_fmt yuv420p -c:a aac /data/pipeline/${JOB_ID}/input/video.mp4"

sleep 1

if [ ! -f "${DIR}/input/video.mp4" ]; then
  echo "ERROR: Failed to create test video"
  exit 1
fi
echo "Created: ${DIR}/input/video.mp4"

# Run ffmpeg-finalizer container
echo ""
echo "Running ffmpeg-finalizer..."
docker compose run --rm \
  -e PIPELINE_JOB_ID="${JOB_ID}" \
  -e INPUT_PATH="/data/pipeline/${JOB_ID}/input/video.mp4" \
  -e OUTPUT_PATH="/data/pipeline/${JOB_ID}/ffmpeg-finalizer/output.mp4" \
  ffmpeg-finalizer

echo ""
echo "============================================="
echo " Output files (NOT auto-deleted):"
echo ""
echo "   Video:      ${DIR}/ffmpeg-finalizer/output.mp4"
echo "   Info JSON:  ${DIR}/ffmpeg-finalizer/finalizer-info.json"
echo "   Manifest:   ${DIR}/ffmpeg-finalizer/manifest.json"
echo ""
echo " Inspect video with:  mpv ${DIR}/ffmpeg-finalizer/output.mp4"
echo " Or:                  vlc ${DIR}/ffmpeg-finalizer/output.mp4"
echo "============================================="
echo ""
echo " Clean up when done:  rm -rf ${DIR}"