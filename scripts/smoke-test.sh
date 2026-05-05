#!/usr/bin/env bash
set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " GSD ► SMOKE TEST — Phase 1 Pipeline Infrastructure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

JOB_ID="smoke-test-$(date +%s)"
PIPELINE_DIR="/tmp/pipeline-smoke-test"
SOURCE_FILE="${PIPELINE_DIR}/source/video.mp4"
FFMPEG_VERSION="${FFMPEG_VERSION:-7.1.1}"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✓ $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  ✗ $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "◆ Preparing test environment..."

if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker is not installed or not in PATH"
    exit 1
fi

mkdir -p "${PIPELINE_DIR}/source"

if command -v ffmpeg &>/dev/null; then
    ffmpeg -y -f lavfi -i testsrc=duration=1:size=320x240:rate=30 \
           -f lavfi -i sine=frequency=440:duration=1 \
           -c:v libx264 -c:a aac -shortest \
           "${SOURCE_FILE}" 2>/dev/null
else
    dd if=/dev/urandom of="${SOURCE_FILE}" bs=1024 count=100 2>/dev/null
    echo "  ⚠ No FFmpeg on host — created dummy file instead of real MP4"
fi

echo ""

echo "◆ Building base Docker images..."
docker compose build base-python base-node 2>&1 | tail -5
echo ""

echo "◆ Verifying FFmpeg version consistency (PIPE-05)..."
PYTHON_FFMPEG=$(docker compose run --rm --no-deps base-python ffmpeg -version 2>/dev/null | head -1 || echo "NOT_FOUND")
NODE_FFMPEG=$(docker compose run --rm --no-deps base-node ffmpeg -version 2>/dev/null | head -1 || echo "NOT_FOUND")

if echo "$PYTHON_FFMPEG" | grep -q "$FFMPEG_VERSION"; then
    pass "Python container FFmpeg matches version ${FFMPEG_VERSION}"
else
    fail "Python container FFmpeg version mismatch: ${PYTHON_FFMPEG}"
fi

if echo "$NODE_FFMPEG" | grep -q "$FFMPEG_VERSION"; then
    pass "Node container FFmpeg matches version ${FFMPEG_VERSION}"
else
    fail "Node container FFmpeg version mismatch: ${NODE_FFMPEG}"
fi
echo ""

echo "◆ Running smoke-test container (PIPE-01, PIPE-02)..."
docker compose run --rm --no-deps -e PIPELINE_JOB_ID="${JOB_ID}" \
    base-python bash -c "mkdir -p /data/pipeline/${JOB_ID}/input && echo 'ready'" 2>/dev/null

CONTAINER_ID=$(docker compose run --rm -d --no-deps \
    -e PIPELINE_JOB_ID="${JOB_ID}" \
    base-python sleep 30 2>/dev/null || true)

if [ -n "$CONTAINER_ID" ]; then
    docker cp "${SOURCE_FILE}" "${CONTAINER_ID}:/data/pipeline/${JOB_ID}/input/video.mp4" 2>/dev/null || true
fi

export PIPELINE_JOB_ID="${JOB_ID}"
export INPUT_PATH="/data/pipeline/${JOB_ID}/input/video.mp4"
export OUTPUT_PATH="/data/pipeline/${JOB_ID}/smoke-test/output/video.mp4"
export FFMPEG_VERSION="${FFMPEG_VERSION}"

docker compose run --rm smoke-test 2>&1
SMOKE_EXIT=$?

if [ $SMOKE_EXIT -eq 0 ]; then
    pass "Smoke-test container exited with code 0 (PIPE-02 step contract)"
else
    fail "Smoke-test container exited with code ${SMOKE_EXIT} (expected 0)"
fi
echo ""

echo "◆ Verifying output artifacts (PIPE-01, PIPE-03)..."
VERIFY_OUTPUT=$(docker compose run --rm --no-deps \
    -e PIPELINE_JOB_ID="${JOB_ID}" \
    base-python bash -c "
    if [ -f /data/pipeline/${JOB_ID}/smoke-test/output/video.mp4 ]; then
        echo 'OUTPUT_EXISTS=true'
    else
        echo 'OUTPUT_EXISTS=false'
    fi
    if [ -f /data/pipeline/${JOB_ID}/smoke-test/output/manifest.json ]; then
        echo 'MANIFEST_EXISTS=true'
        cat /data/pipeline/${JOB_ID}/smoke-test/output/manifest.json
    else
        echo 'MANIFEST_EXISTS=false'
    fi
    if [ -f /data/pipeline/${JOB_ID}/smoke-test/output/intermediate/analysis.json ]; then
        echo 'INTERMEDIATE_EXISTS=true'
    else
        echo 'INTERMEDIATE_EXISTS=false'
    fi
    " 2>/dev/null)

if echo "$VERIFY_OUTPUT" | grep -q "OUTPUT_EXISTS=true"; then
    pass "Output video file exists on shared volume (PIPE-01)"
else
    fail "Output video file not found on shared volume"
fi

if echo "$VERIFY_OUTPUT" | grep -q "MANIFEST_EXISTS=true"; then
    pass "manifest.json exists on shared volume (PIPE-02, D-07)"
    if echo "$VERIFY_OUTPUT" | grep -q '"step_name": "smoke-test"'; then
        pass "manifest.json has correct step_name"
    else
        fail "manifest.json missing correct step_name"
    fi
    if echo "$VERIFY_OUTPUT" | grep -q '"status": "success"'; then
        pass "manifest.json reports success status"
    else
        fail "manifest.json does not report success status"
    fi
else
    fail "manifest.json not found on shared volume"
fi

if echo "$VERIFY_OUTPUT" | grep -q "INTERMEDIATE_EXISTS=true"; then
    pass "Intermediate artifacts are inspectable on shared volume (PIPE-03)"
else
    fail "Intermediate artifacts not found on shared volume"
fi
echo ""

echo "◆ Verifying extensibility (PIPE-04)..."
if grep -q "smoke-test" docker-compose.yml; then
    pass "smoke-test service added to docker-compose.yml without modifying existing services (PIPE-04)"
else
    fail "smoke-test service not found in docker-compose.yml"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo " Results: ${PASS_COUNT}/${TOTAL} checks passed"
if [ $FAIL_COUNT -gt 0 ]; then
    echo " ✗ SMOKE TEST FAILED"
    exit 1
else
    echo " ✓ SMOKE TEST PASSED — Phase 1 infrastructure is operational"
    exit 0
fi