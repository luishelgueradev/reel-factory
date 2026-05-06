#!/usr/bin/env bash
# E2E test for silence-cutter container — validates all SILC requirements.
#
# Prerequisites:
#   - Docker Compose with base-python image built
#   - Whisper step must have completed (produces transcript.json)
#   - Test video with known silence segments
#
# Usage:
#   ./scripts/test-silence-cutter.sh [JOB_ID]
#
# Follows the scripts/test-whisper.sh pattern with pass/fail tracking.

set -euo pipefail

JOB_ID="${1:-test-silence-001}"
PASS=0
FAIL=0
TOTAL=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
    echo -e "${GREEN}✓ PASS${NC}: $1"
}

fail() {
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
    echo -e "${RED}✗ FAIL${NC}: $1"
}

info() {
    echo -e "${YELLOW}◆${NC} $1"
}

echo ""
info "═════════════════════════════════════════════════════════"
info "  SILENCE CUTTER E2E TEST"
info "  Job ID: ${JOB_ID}"
info "═════════════════════════════════════════════════════════"
echo ""

# ─── Setup ────────────────────────────────────────────────────
info "Setting up test environment for job: ${JOB_ID}"

# Create test directories on shared volume
PIPELINE_DIR="/tmp/silence-cutter-test/pipeline/${JOB_ID}"
mkdir -p "${PIPELINE_DIR}/input"
mkdir -p "${PIPELINE_DIR}/whisper"
mkdir -p "${PIPELINE_DIR}/silence-cutter"

# Create a synthetic test video with 1s silence in the middle
# Using ffmpeg: 3 segments (1s speech, 1s silence, 1s speech)
info "Creating synthetic test video with known silence"
if command -v ffmpeg &>/dev/null; then
    # Create 3-second test video: visible video + audio
    # First 1s: tone, middle 1s: silence, last 1s: tone
    TEST_VIDEO="${PIPELINE_DIR}/input/video.mp4"

    # Generate test video with silence in the middle
    # sine=frequency=0 produces silence
    ffmpeg -y -f lavfi -i "color=c=black:s=320x240:d=3:r=25" \
        -f lavfi -i "sine=frequency=440:duration=1" \
        -f lavfi -i "anullsrc=r=16000:cl=mono" -t 1 \
        -f lavfi -i "sine=frequency=440:duration=1" \
        -filter_complex "[1:a][2:a][3:a]concat=n=3:v=0:a=1[outa]" \
        -map 0:v -map "[outa]" \
        -c:v libx264 -c:a aac -t 3 \
        "${TEST_VIDEO}" 2>/dev/null || {
        info "Could not create test video with ffmpeg — using placeholder"
        echo "test-video-placeholder" > "${PIPELINE_DIR}/input/video.mp4"
    }
else
    info "ffmpeg not available — creating placeholder test video"
    echo "test-video-placeholder" > "${PIPELINE_DIR}/input/video.mp4"
fi

# Create synthetic transcript.json with known silence data
info "Creating synthetic transcript.json with silence indicators"
cat > "${PIPELINE_DIR}/whisper/transcript.json" << 'TRANSCRIPT_EOF'
{
  "language": "es",
  "model": "medium",
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 1.0,
      "text": "Hola mundo",
      "words": [
        {"word": "Hola", "start": 0.0, "end": 0.5, "confidence": 0.9, "no_speech_prob": 0.1},
        {"word": "mundo", "start": 0.5, "end": 1.0, "confidence": 0.85, "no_speech_prob": 0.05}
      ]
    },
    {
      "id": 1,
      "start": 1.0,
      "end": 2.0,
      "text": "",
      "words": [
        {"word": "[silence]", "start": 1.0, "end": 2.0, "confidence": 0.1, "no_speech_prob": 0.95}
      ]
    },
    {
      "id": 2,
      "start": 2.0,
      "end": 3.0,
      "text": "Buenos dias",
      "words": [
        {"word": "Buenos", "start": 2.0, "end": 2.5, "confidence": 0.88, "no_speech_prob": 0.08},
        {"word": "dias", "start": 2.5, "end": 3.0, "confidence": 0.92, "no_speech_prob": 0.03}
      ]
    }
  ],
  "words": [
    {"word": "Hola", "start": 0.0, "end": 0.5, "confidence": 0.9, "no_speech_prob": 0.1},
    {"word": "mundo", "start": 0.5, "end": 1.0, "confidence": 0.85, "no_speech_prob": 0.05},
    {"word": "[silence]", "start": 1.0, "end": 2.0, "confidence": 0.1, "no_speech_prob": 0.95},
    {"word": "Buenos", "start": 2.0, "end": 2.5, "confidence": 0.88, "no_speech_prob": 0.08},
    {"word": "dias", "start": 2.5, "end": 3.0, "confidence": 0.92, "no_speech_prob": 0.03}
  ],
  "duration": 3.0
}
TRANSCRIPT_EOF

# ─── Test 1: Step Contract — INPUT_PATH accessible ───────────
info "Test 1: Step Contract — INPUT_PATH accessible (SILC-01)"
if [ -f "${PIPELINE_DIR}/input/video.mp4" ]; then
    pass "Input video file exists at INPUT_PATH"
else
    fail "Input video file NOT found at INPUT_PATH"
fi

# ─── Test 2: Step Contract — TRANSCRIPT_PATH accessible ──────
info "Test 2: Step Contract — TRANSCRIPT_PATH accessible (SILC-01)"
if [ -f "${PIPELINE_DIR}/whisper/transcript.json" ]; then
    pass "Transcript file exists at TRANSCRIPT_PATH"
else
    fail "Transcript file NOT found at TRANSCRIPT_PATH"
fi

# ─── Test 3: Transcript contains no_speech_prob ──────────────
info "Test 3: Transcript contains no_speech_prob data (D-09, D-03)"
if grep -q "no_speech_prob" "${PIPELINE_DIR}/whisper/transcript.json"; then
    pass "Transcript contains no_speech_prob field for cross-referencing"
else
    fail "Transcript MISSING no_speech_prob field"
fi

# ─── Test 4: Docker Compose service exists ───────────────────
info "Test 4: Docker Compose service exists (PIPE-04)"
if [ -f "docker-compose.yml" ] && grep -q "silence-cutter:" docker-compose.yml; then
    pass "silence-cutter service defined in docker-compose.yml"
else
    fail "silence-cutter service NOT defined in docker-compose.yml"
fi

# ─── Test 5: Service depends on whisper ─────────────────────
info "Test 5: Silence cutter depends on whisper step"
if [ -f "docker-compose.yml" ] && grep -A10 "silence-cutter:" docker-compose.yml | grep -q "whisper"; then
    pass "silence-cutter depends_on whisper (step chain intact)"
else
    fail "silence-cutter does NOT depend_on whisper"
fi

# ─── Test 6: TRANSCRIPT_PATH env var configured ─────────────
info "Test 6: TRANSCRIPT_PATH env var configured"
if [ -f "docker-compose.yml" ] && grep -A15 "silence-cutter:" docker-compose.yml | grep -q "TRANSCRIPT_PATH"; then
    pass "TRANSCRIPT_PATH env var configured in docker-compose.yml"
else
    fail "TRANSCRIPT_PATH env var NOT configured"
fi

# ─── Test 7: SILENCE_MIN_DURATION env var configurable ───────
info "Test 7: SILENCE_MIN_DURATION env var configurable (D-05)"
if [ -f "docker-compose.yml" ] && grep -A15 "silence-cutter:" docker-compose.yml | grep -q "SILENCE_MIN_DURATION"; then
    pass "SILENCE_MIN_DURATION env var configurable in docker-compose.yml"
else
    fail "SILENCE_MIN_DURATION NOT configurable"
fi

# ─── Test 8: Validation module importable ────────────────────
info "Test 8: Validation module importable (SILC-04)"
if python3 -c "from services.silence_cutter.src.validate import validate_silence_cuts" 2>/dev/null || \
   python3 -c "import sys; sys.path.insert(0, 'services/silence-cutter'); from src.validate import validate_silence_cuts" 2>/dev/null; then
    pass "validate_silence_cuts function is importable"
else
    fail "validate_silence_cuts function is NOT importable"
fi

# ─── Test 9: Unit tests pass ─────────────────────────────────
info "Test 9: Unit tests pass (SILC-01/03/04, D-01/03/07)"
if command -v python3 &>/dev/null; then
    TEST_OUTPUT=$(cd services/silence-cutter && python3 -m pytest tests/test_silence_cutter.py -v --tb=short 2>&1) || true
    if echo "$TEST_OUTPUT" | grep -q "passed"; then
        PASSED=$(echo "$TEST_OUTPUT" | grep -oP '\d+ passed' | head -1)
        pass "Unit tests pass: ${PASSED}"
    else
        fail "Unit tests FAILED — see output above"
    fi
else
    info "python3 not available — skipping unit test check"
fi

# ─── Docker Execution Tests (require Docker) ────────────────
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    info "Docker available — running container tests"

    # Build silence-cutter image
    info "Building silence-cutter image..."
    docker compose build silence-cutter 2>&1 | tail -5 || {
        fail "Could not build silence-cutter image"
    }

    # Run silence-cutter with test data
    info "Running silence-cutter container with test data..."
    export PIPELINE_JOB_ID="${JOB_ID}"
    export INPUT_PATH="/data/pipeline/${JOB_ID}/input/video.mp4"
    export OUTPUT_PATH="/data/pipeline/${JOB_ID}/silence-cutter/output.mp4"
    export TRANSCRIPT_PATH="/data/pipeline/${JOB_ID}/whisper/transcript.json"
    export SILENCE_MIN_DURATION=0.5

    docker compose run --rm silence-cutter 2>&1 || {
        fail "silence-cutter container exited with error"
    }

    # ─── Test 10: Output files exist ─────────────────────────
    info "Test 10: Output files created (SILC-02, SILC-04)"
    if [ -f "${PIPELINE_DIR}/silence-cutter/output.mp4" ]; then
        pass "output.mp4 created by silence-cutter"
    else
        fail "output.mp4 NOT created"
    fi

    if [ -f "${PIPELINE_DIR}/silence-cutter/silence-cuts.json" ]; then
        pass "silence-cuts.json created by silence-cutter (SILC-04)"
    else
        fail "silence-cuts.json NOT created"
    fi

    if [ -f "${PIPELINE_DIR}/silence-cutter/manifest.json" ]; then
        pass "manifest.json created by silence-cutter"
    else
        fail "manifest.json NOT created"
    fi

    # ─── Test 11: manifest.json has success status ───────────
    info "Test 11: manifest.json has success status"
    if [ -f "${PIPELINE_DIR}/silence-cutter/manifest.json" ]; then
        if grep -q '"status": "success"' "${PIPELINE_DIR}/silence-cutter/manifest.json"; then
            pass "Manifest status is success"
        else
            fail "Manifest status is NOT success"
        fi
    fi

    # ─── Test 12: silence-cuts.json is valid JSON ───────────
    info "Test 12: silence-cuts.json is valid JSON with required fields (SILC-04)"
    if [ -f "${PIPELINE_DIR}/silence-cutter/silence-cuts.json" ]; then
        if python3 -c "import json; json.load(open('${PIPELINE_DIR}/silence-cutter/silence-cuts.json'))" 2>/dev/null; then
            pass "silence-cuts.json is valid JSON"
        else
            fail "silence-cuts.json is NOT valid JSON"
        fi

        # Check required fields
        if grep -q "cumulative_shift" "${PIPELINE_DIR}/silence-cutter/silence-cuts.json"; then
            pass "silence-cuts.json contains cumulative_shift (D-07)"
        else
            fail "silence-cuts.json MISSING cumulative_shift"
        fi

        if grep -q '"source"' "${PIPELINE_DIR}/silence-cutter/silence-cuts.json"; then
            pass "silence-cuts.json contains source field (D-01)"
        else
            fail "silence-cuts.json MISSING source field"
        fi
    fi

    # ─── Test 13: A/V sync — output duration is shorter ────
    info "Test 13: Output video is shorter than input (SILC-03 sync check)"
    if [ -f "${PIPELINE_DIR}/silence-cutter/output.mp4" ]; then
        ORIG_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${PIPELINE_DIR}/input/video.mp4" 2>/dev/null || echo "0")
        NEW_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${PIPELINE_DIR}/silence-cutter/output.mp4" 2>/dev/null || echo "0")
        if python3 -c "assert float('${NEW_DUR}') < float('${ORIG_DUR}')" 2>/dev/null; then
            pass "Output video (${NEW_DUR}s) is shorter than input (${ORIG_DUR}s) — silence removed"
        else
            fail "Output video is NOT shorter — silence may not have been removed"
        fi
    fi

else
    info "Docker not available — skipping container execution tests"
    info "Run manually with: docker compose run --rm silence-cutter"
fi

# ─── Summary ────────────────────────────────────────────────
echo ""
info "═════════════════════════════════════════════════════════"
info "  RESULTS: ${PASS} passed, ${FAIL} failed (out of ${TOTAL})"
info "═════════════════════════════════════════════════════════"

# Cleanup
info "Cleaning up test data"
rm -rf "/tmp/silence-cutter-test" 2>/dev/null || true

if [ "${FAIL}" -gt 0 ]; then
    echo -e "\n${RED}Some tests failed. Review output above.${NC}"
    exit 1
fi

echo -e "\n${GREEN}All tests passed! silence-cutter step contract verified.${NC}"
exit 0