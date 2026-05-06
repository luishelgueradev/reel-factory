#!/usr/bin/env bash
set -euo pipefail

# WARNING: This test requires:
# 1. NVIDIA GPU with CUDA support (D-03)
# 2. NVIDIA Container Toolkit installed
# 3. Base Docker images built first (docker compose build base-python)
#
# For actual Spanish transcription testing, provide a real Spanish MP4
# in the input directory. The synthetic test video has no speech content.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " GSD ► E2E TEST — Whisper Transcription Container"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

JOB_ID="test-whisper-001"
PIPELINE_DIR="/data/pipeline"
JOB_DIR="${PIPELINE_DIR}/${JOB_ID}"
INPUT_DIR="${JOB_DIR}/input"
WHISPER_DIR="${JOB_DIR}/whisper"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✓ $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  ✗ $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "◆ Checking prerequisites..."

if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker is not installed or not in PATH"
    exit 1
fi

if ! docker compose version &>/dev/null; then
    echo "ERROR: Docker Compose v2 is not available"
    exit 1
fi

echo ""

echo "◆ Preparing test environment..."

# Create test directory structure on shared volume via a one-off container
docker compose run --rm --no-deps base-python bash -c "
    mkdir -p ${INPUT_DIR}
    mkdir -p ${WHISPER_DIR}
    echo 'Directories created'
" 2>/dev/null

# Generate synthetic test video (NO REAL SPEECH — for pipeline contract validation only)
# For actual Spanish transcription, replace with a real Spanish MP4 file.
echo "  Generating synthetic test video (no speech content)..."

# Use a running container to create the test MP4 on the shared volume
CONTAINER_ID=$(docker compose run --rm -d --no-deps base-python sleep 30 2>/dev/null || true)

if [ -n "$CONTAINER_ID" ]; then
    # Generate a short test video with FFmpeg inside the container
    # This produces a video with silence (anullsrc) — no real speech
    docker exec "$CONTAINER_ID" bash -c "
        ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 5 \
               -f lavfi -i color=c=black:s=640x360:d=5 \
               -c:v libx264 -c:a aac -shortest \
               ${INPUT_DIR}/video.mp4 -y 2>/dev/null && \
        echo 'VIDEO_CREATED=true' || echo 'VIDEO_CREATED=false'
    " 2>/dev/null || true
    docker stop "$CONTAINER_ID" 2>/dev/null || true
fi

echo ""

echo "◆ Building Whisper container..."
docker compose build whisper 2>&1 | tail -5
echo ""

echo "◆ Running Whisper container (PIPELINE_JOB_ID=${JOB_ID})..."
export PIPELINE_JOB_ID="${JOB_ID}"
export INPUT_PATH="${INPUT_DIR}/video.mp4"
export OUTPUT_PATH="${WHISPER_DIR}/transcript.json"

docker compose up whisper 2>&1
WHISPER_EXIT=$?

echo ""

echo "◆ Validating outputs..."

# Verify outputs inside a container (shared volume)
VERIFY_OUTPUT=$(docker compose run --rm --no-deps \
    -e PIPELINE_JOB_ID="${JOB_ID}" \
    base-python bash -c "
    set -e
    # Check transcript.json exists
    if [ -f ${WHISPER_DIR}/transcript.json ]; then
        echo 'TRANSCRIPT_EXISTS=true'
    else
        echo 'TRANSCRIPT_EXISTS=false'
    fi

    # Check manifest.json exists
    if [ -f ${WHISPER_DIR}/manifest.json ]; then
        echo 'MANIFEST_EXISTS=true'
        cat ${WHISPER_DIR}/manifest.json
    else
        echo 'MANIFEST_EXISTS=false'
    fi

    # Validate transcript.json content (TRAN-04, D-07)
    if [ -f ${WHISPER_DIR}/transcript.json ]; then
        cat ${WHISPER_DIR}/transcript.json
    fi
    " 2>/dev/null)

# Check transcript.json exists
if echo "$VERIFY_OUTPUT" | grep -q "TRANSCRIPT_EXISTS=true"; then
    pass "transcript.json exists on shared volume (D-08)"
else
    fail "transcript.json not found at ${WHISPER_DIR}/transcript.json"
fi

# Check manifest.json exists
if echo "$VERIFY_OUTPUT" | grep -q "MANIFEST_EXISTS=true"; then
    pass "manifest.json exists on shared volume (D-05, D-07)"

    # Validate manifest status
    if echo "$VERIFY_OUTPUT" | grep -q '"status": "success"'; then
        pass "manifest.json reports success status (step contract)"
    else
        fail "manifest.json does not report success status"
    fi

    # Validate manifest exit_code
    if echo "$VERIFY_OUTPUT" | grep -q '"exit_code": 0'; then
        pass "manifest.json reports exit_code 0 (step contract)"
    else
        fail "manifest.json does not report exit_code 0"
    fi

    # Validate manifest step_name
    if echo "$VERIFY_OUTPUT" | grep -q '"step_name": "whisper"'; then
        pass "manifest.json has correct step_name 'whisper'"
    else
        fail "manifest.json missing correct step_name"
    fi
else
    fail "manifest.json not found at ${WHISPER_DIR}/manifest.json"
fi

echo ""

echo "◆ Validating transcript.json content (TRAN-04, D-07)..."
# Extract transcript.json content from VERIFY_OUTPUT (it was cat'd after the checks)
TRANSCRIPT_CONTENT=$(echo "$VERIFY_OUTPUT" | sed -n '/^{$/,$p' | head -n -1)

# Use Python to validate transcript.json structure
VALIDATION_OUTPUT=$(docker compose run --rm --no-deps \
    -e PIPELINE_JOB_ID="${JOB_ID}" \
    base-python python3 -c "
import json, sys
try:
    with open('${WHISPER_DIR}/transcript.json') as f:
        data = json.load(f)

    errors = []

    # TRAN-04: Language must be 'es'
    if data.get('language') != 'es':
        errors.append('Language must be es per TRAN-04 (got: {})'.format(data.get('language')))

    # TRAN-04: Model must not end with .en
    model = data.get('model', '')
    if model.endswith('.en'):
        errors.append('Model must not be .en variant per TRAN-04 (got: {})'.format(model))

    # D-07: Must have segments and words
    if 'segments' not in data or 'words' not in data:
        errors.append('Missing segments or words fields per D-07')

    # TRAN-02: Words must have timestamps
    for i, word in enumerate(data.get('words', [])):
        if 'start' not in word or 'end' not in word:
            errors.append('Word {} missing start/end timestamps per TRAN-02'.format(i))
            break

    # D-09: Words must have no_speech_prob
    for i, word in enumerate(data.get('words', [])):
        if 'no_speech_prob' not in word:
            errors.append('Word {} missing no_speech_prob per D-09'.format(i))
            break

    if errors:
        for e in errors:
            print('ERROR: {}'.format(e))
        sys.exit(1)
    else:
        print('TRANSCRIPT_VALID=true')
        print('language={}'.format(data.get('language', 'N/A')))
        print('model={}'.format(data.get('model', 'N/A')))
        print('segments_count={}'.format(len(data.get('segments', []))))
        print('words_count={}'.format(len(data.get('words', []))))
except FileNotFoundError:
    print('TRANSCRIPT_INVALID=file_not_found')
    sys.exit(1)
except json.JSONDecodeError as e:
    print('TRANSCRIPT_INVALID=json_error: {}'.format(e))
    sys.exit(1)
except Exception as e:
    print('TRANSCRIPT_INVALID=error: {}'.format(e))
    sys.exit(1)
" 2>/dev/null) || true

if echo "$VALIDATION_OUTPUT" | grep -q "TRANSCRIPT_VALID=true"; then
    pass "transcript.json validates against TRAN-04, D-07, D-09"

    # Check language = es (TRAN-04)
    if echo "$VALIDATION_OUTPUT" | grep -q "language=es"; then
        pass "transcript.json language is 'es' (TRAN-04)"
    else
        lang=$(echo "$VALIDATION_OUTPUT" | grep "^language=" | cut -d= -f2)
        fail "transcript.json language is '${lang}' (expected 'es' per TRAN-04)"
    fi

    # Check model is not .en (TRAN-04)
    if echo "$VALIDATION_OUTPUT" | grep -qP "^model=(?!.*\.en)"; then
        pass "transcript.json model is not .en variant (TRAN-04)"
    else
        model_val=$(echo "$VALIDATION_OUTPUT" | grep "^model=" | cut -d= -f2)
        if [[ "$model_val" != *".en" ]]; then
            pass "transcript.json model '${model_val}' is not .en variant (TRAN-04)"
        else
            fail "transcript.json model '${model_val}' is .en variant ( violates TRAN-04)"
        fi
    fi
else
    fail "transcript.json validation failed"
    echo "$VALIDATION_OUTPUT" | grep "ERROR:" | while read -r line; do
        echo "    $line"
    done
fi

echo ""

echo "◆ Cleaning up test artifacts..."
# Remove test data from shared volume
docker compose run --rm --no-deps base-python bash -c "
    rm -rf ${JOB_DIR}
    echo 'Cleanup complete'
" 2>/dev/null

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo " Results: ${PASS_COUNT}/${TOTAL} checks passed"
if [ $FAIL_COUNT -gt 0 ]; then
    echo " ✗ E2E TEST FAILED"
    exit 1
else
    echo " ✓ E2E TEST PASSED — Whisper container step contract is valid"
    exit 0
fi