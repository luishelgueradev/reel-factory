#!/usr/bin/env bash
# E2E Docker test script for ffmpeg-finalizer step contract
# Tests: VERT-01 (1080x1920 output), VERT-02 (center crop strategy),
#        VERT-03 (safe zone metadata), D-03 (conditional crop path)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

PIPELINE_JOB_ID="test-finalizer-$(date +%s)"
PIPELINE_DIR="pipeline/${PIPELINE_JOB_ID}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " E2E Test: FFmpeg Finalizer Docker Pipeline"
echo " Job ID: ${PIPELINE_JOB_ID}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Cleanup on exit ────────────────────────────────────────
# Only clean up the 9:16 test dir; the main test dir cleanup is also conditional
cleanup() {
    echo ""
    echo "Cleaning up test directories..."
    rm -rf "${PIPELINE_DIR}" 2>/dev/null || true
    rm -rf "pipeline/${PIPELINE_JOB_ID}-916" 2>/dev/null || true
    echo "Done."
}
trap cleanup EXIT

# ── Create test directories ──────────────────────────────
echo "Step 1: Creating test directories..."
mkdir -p "${PIPELINE_DIR}"/{input,ffmpeg-finalizer}

# ── Helper: create test video using Docker ─────────────────
create_test_video() {
    local HOST_DIR="$1"
    local CONTAINER_PATH="$2"
    local WIDTH="$3"
    local HEIGHT="$4"
    # Use base-python image which has FFmpeg installed
    # Mount the host pipeline directory explicitly (base-python doesn't use pipeline-common)
    docker compose run --rm \
        -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
        --entrypoint bash \
        base-python \
        -c "mkdir -p $(dirname ${CONTAINER_PATH}) && ffmpeg -y -f lavfi -i testsrc=duration=5:size=${WIDTH}x${HEIGHT}:rate=30 -f lavfi -i sine=frequency=440:duration=5 -c:v libx264 -pix_fmt yuv420p -c:a aac ${CONTAINER_PATH}" \
        > /dev/null 2>&1
    # Wait for file to appear on host (Docker volume sync)
    sleep 1
}

# ── Create synthetic 16:9 test video (wider than 9:16) ─────
echo "Step 2: Creating synthetic 1920x1080 test video (16:9, wider than 9:16)..."
# Try host ffmpeg first, fall back to Docker-based creation
if command -v ffmpeg &>/dev/null; then
    ffmpeg -y -f lavfi -i testsrc=duration=5:size=1920x1080:rate=30 \
        -f lavfi -i sine=frequency=440:duration=5 \
        -c:v libx264 -pix_fmt yuv420p -c:a aac \
        "${PIPELINE_DIR}/input/video.mp4" \
        > /dev/null 2>&1
else
    echo "  ffmpeg not on host, using Docker to create test video..."
    create_test_video "${PIPELINE_DIR}/input" "/data/pipeline/${PIPELINE_JOB_ID}/input/video.mp4" 1920 1080
fi

if [ ! -f "${PIPELINE_DIR}/input/video.mp4" ]; then
    echo "FAIL: Could not create test video"
    exit 1
fi
echo "  Created: ${PIPELINE_DIR}/input/video.mp4"

# ── Build Docker container ─────────────────────────────────
echo ""
echo "Step 3: Building ffmpeg-finalizer Docker container..."
docker compose build ffmpeg-finalizer 2>&1 | tail -1

# ── Run ffmpeg-finalizer for wide video ─────────────────────
echo ""
echo "Step 4: Running ffmpeg-finalizer container (1920x1080 input)..."
docker compose run --rm \
    -e PIPELINE_JOB_ID="${PIPELINE_JOB_ID}" \
    -e INPUT_PATH="/data/pipeline/${PIPELINE_JOB_ID}/input/video.mp4" \
    -e OUTPUT_PATH="/data/pipeline/${PIPELINE_JOB_ID}/ffmpeg-finalizer/output.mp4" \
    -e VERTICAL_WIDTH=1080 \
    -e VERTICAL_HEIGHT=1920 \
    -e CROP_STRATEGY=center \
    ffmpeg-finalizer

# ── Verify outputs ─────────────────────────────────────────
echo ""
echo "Step 5: Verifying outputs for wide (16:9) input..."
echo ""

FAILED=0

# Check output file exists
OUTPUT_FILE="${PIPELINE_DIR}/ffmpeg-finalizer/output.mp4"
MANIFEST_FILE="${PIPELINE_DIR}/ffmpeg-finalizer/manifest.json"
INFO_FILE="${PIPELINE_DIR}/ffmpeg-finalizer/finalizer-info.json"

if [ ! -f "$OUTPUT_FILE" ]; then
    echo "FAIL: output.mp4 not found at ${OUTPUT_FILE}"
    FAILED=$((FAILED + 1))
else
    echo "  ✅ output.mp4 exists"
fi

if [ ! -f "$MANIFEST_FILE" ]; then
    echo "FAIL: manifest.json not found at ${MANIFEST_FILE}"
    FAILED=$((FAILED + 1))
else
    echo "  ✅ manifest.json exists"
    # Verify manifest status
    MANIFEST_STATUS=$(python3 -c "import json; print(json.load(open('${MANIFEST_FILE}'))['status'])")
    if [ "$MANIFEST_STATUS" = "success" ]; then
        echo "  ✅ manifest.json status=success"
    else
        echo "FAIL: manifest.json status='${MANIFEST_STATUS}' (expected 'success')"
        FAILED=$((FAILED + 1))
    fi
fi

if [ ! -f "$INFO_FILE" ]; then
    echo "FAIL: finalizer-info.json not found at ${INFO_FILE}"
    FAILED=$((FAILED + 1))
else
    echo "  ✅ finalizer-info.json exists"
fi

# VERT-01: Output video is 1080x1920
echo ""
echo "── VERT-01: Output video dimensions ──"
# Use ffprobe via Docker if not available on host
if command -v ffprobe &>/dev/null; then
    DIMENSIONS=$(ffprobe -v quiet -show_entries stream=width,height -of csv=p=0 "$OUTPUT_FILE" 2>/dev/null | head -1)
else
    DIMENSIONS=$(docker compose run --rm \
        -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
        --entrypoint bash \
        base-python \
        -c "ffprobe -v quiet -show_entries stream=width,height -of csv=p=0 /data/pipeline/${PIPELINE_JOB_ID}/ffmpeg-finalizer/output.mp4 2>/dev/null | head -1" \
        2>/dev/null | tr -d '\r' | head -1)
fi
echo "  Dimensions: ${DIMENSIONS}"
if [ "$DIMENSIONS" = "1080,1920" ]; then
    echo "  ✅ VERT-01 PASSED: Output video is 1080x1920"
else
    echo "FAIL: VERT-01: Expected 1080,1920, got ${DIMENSIONS}"
    FAILED=$((FAILED + 1))
fi

# VERT-02: Crop strategy is "center"
echo ""
echo "── VERT-02: Crop strategy ──"
CROP_STRATEGY=$(python3 -c "import json; print(json.load(open('${INFO_FILE}'))['crop_strategy'])")
echo "  Crop strategy: ${CROP_STRATEGY}"
if [ "$CROP_STRATEGY" = "center" ]; then
    echo "  ✅ VERT-02 PASSED: Crop strategy is 'center'"
else
    echo "FAIL: VERT-02: Expected 'center', got '${CROP_STRATEGY}'"
    FAILED=$((FAILED + 1))
fi

# VERT-03: Safe zone metadata present
echo ""
echo "── VERT-03: Safe zone metadata ──"
SAFE_ZONE_TOP=$(python3 -c "import json; print(json.load(open('${INFO_FILE}'))['safe_zone']['top'])")
SAFE_ZONE_BOTTOM=$(python3 -c "import json; print(json.load(open('${INFO_FILE}'))['safe_zone']['bottom'])")
SAFE_ZONE_LEFT=$(python3 -c "import json; print(json.load(open('${INFO_FILE}'))['safe_zone']['left'])")
SAFE_ZONE_RIGHT=$(python3 -c "import json; print(json.load(open('${INFO_FILE}'))['safe_zone']['right'])")
echo "  Safe zone: top=${SAFE_ZONE_TOP}, bottom=${SAFE_ZONE_BOTTOM}, left=${SAFE_ZONE_LEFT}, right=${SAFE_ZONE_RIGHT}"
if [ "$SAFE_ZONE_TOP" = "100" ] && [ "$SAFE_ZONE_BOTTOM" = "230" ] && [ "$SAFE_ZONE_LEFT" = "54" ] && [ "$SAFE_ZONE_RIGHT" = "54" ]; then
    echo "  ✅ VERT-03 PASSED: Safe zone values match D-06 specification"
else
    echo "FAIL: VERT-03: Safe zone values don't match (expected top=100, bottom=230, left=54, right=54)"
    FAILED=$((FAILED + 1))
fi

# ── Test D-03: 9:16 input (no crop should be applied) ──────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Testing D-03: Already-9:16 input (conditional crop path)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PIPELINE_JOB_ID_916="${PIPELINE_JOB_ID}-916"
PIPELINE_DIR_916="pipeline/${PIPELINE_JOB_ID_916}"
mkdir -p "${PIPELINE_DIR_916}"/{input,ffmpeg-finalizer}

echo "Step 6: Creating synthetic 1080x1920 test video (already 9:16)..."
if command -v ffmpeg &>/dev/null; then
    ffmpeg -y -f lavfi -i testsrc=duration=5:size=1080x1920:rate=30 \
        -f lavfi -i sine=frequency=440:duration=5 \
        -c:v libx264 -pix_fmt yuv420p -c:a aac \
        "${PIPELINE_DIR_916}/input/video_9_16.mp4" \
        > /dev/null 2>&1
else
    echo "  ffmpeg not on host, using Docker to create 9:16 test video..."
    create_test_video "${PIPELINE_DIR_916}/input" "/data/pipeline/${PIPELINE_JOB_ID_916}/input/video_9_16.mp4" 1080 1920
fi

if [ ! -f "${PIPELINE_DIR_916}/input/video_9_16.mp4" ]; then
    echo "FAIL: Could not create 9:16 test video"
    FAILED=$((FAILED + 1))
else
    echo "  Created: ${PIPELINE_DIR_916}/input/video_9_16.mp4"
fi

echo ""
echo "Step 7: Running ffmpeg-finalizer container (1080x1920 input)..."
docker compose run --rm \
    -e PIPELINE_JOB_ID="${PIPELINE_JOB_ID_916}" \
    -e INPUT_PATH="/data/pipeline/${PIPELINE_JOB_ID_916}/input/video_9_16.mp4" \
    -e OUTPUT_PATH="/data/pipeline/${PIPELINE_JOB_ID_916}/ffmpeg-finalizer/output.mp4" \
    -e VERTICAL_WIDTH=1080 \
    -e VERTICAL_HEIGHT=1920 \
    -e CROP_STRATEGY=center \
    ffmpeg-finalizer

# D-03: Verify crop_applied=false for 9:16 input
echo ""
echo "── D-03: Conditional crop path ──"
INFO_FILE_916="${PIPELINE_DIR_916}/ffmpeg-finalizer/finalizer-info.json"
if [ ! -f "$INFO_FILE_916" ]; then
    echo "FAIL: finalizer-info.json not found for 9:16 test"
    FAILED=$((FAILED + 1))
else
    CROP_APPLIED=$(python3 -c "import json; print(json.load(open('${INFO_FILE_916}'))['crop_applied'])")
    echo "  crop_applied: ${CROP_APPLIED}"
    if [ "$CROP_APPLIED" = "False" ]; then
        echo "  ✅ D-03 PASSED: 9:16 input gets crop_applied=False (scale-only path)"
    else
        echo "FAIL: D-03: Expected crop_applied=False for 9:16 input, got '${CROP_APPLIED}'"
        FAILED=$((FAILED + 1))
    fi
fi

# Also verify 9:16 output dimensions are still 1080x1920
OUTPUT_FILE_916="${PIPELINE_DIR_916}/ffmpeg-finalizer/output.mp4"
if [ -f "$OUTPUT_FILE_916" ]; then
    if command -v ffprobe &>/dev/null; then
        DIMENSIONS_916=$(ffprobe -v quiet -show_entries stream=width,height -of csv=p=0 "$OUTPUT_FILE_916" 2>/dev/null | head -1)
    else
        DIMENSIONS_916=$(docker compose run --rm \
            -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
            --entrypoint bash \
            base-python \
            -c "ffprobe -v quiet -show_entries stream=width,height -of csv=p=0 /data/pipeline/${PIPELINE_JOB_ID_916}/ffmpeg-finalizer/output.mp4 2>/dev/null | head -1" \
            2>/dev/null | tr -d '\r' | head -1)
    fi
    echo "  9:16 output dimensions: ${DIMENSIONS_916}"
    if [ "$DIMENSIONS_916" = "1080,1920" ]; then
        echo "  ✅ 9:16 output also 1080x1920"
    else
        echo "FAIL: 9:16 output dimensions expected 1080,1920, got ${DIMENSIONS_916}"
        FAILED=$((FAILED + 1))
    fi
fi

# ── Summary ────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAILED" -eq 0 ]; then
    echo "  ✅ VERT-01: Output video is 1080x1920"
    echo "  ✅ VERT-02: Crop strategy is 'center'"
    echo "  ✅ VERT-03: Safe zone metadata present (top=100, bottom=230, left=54, right=54)"
    echo "  ✅ D-03: 9:16 input gets crop_applied=false"
    echo "  ✅ Step contract: manifest.json, finalizer-info.json, output.mp4 present"
    echo "  ✅ manifest.json status=success"
    echo ""
    echo "ALL TESTS PASSED"
    exit 0
else
    echo "  ${FAILED} test(s) FAILED"
    echo ""
    echo "SOME TESTS FAILED"
    exit 1
fi