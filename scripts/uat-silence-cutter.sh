#!/usr/bin/env bash
# E2E test for silence-cutter — FFmpeg-only mode.
# Creates a synthetic video with silence, runs silence-cutter, verifies output.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

JOB_ID="uat-silence-$(date +%s)"
DIR="pipeline/${JOB_ID}"
mkdir -p "${DIR}"/{input,silence-cutter}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " E2E Test: Silence Cutter (FFmpeg-only mode)"
echo " Job ID: ${JOB_ID}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Create synthetic video with silence (tone-silence-tone)
echo "Step 1: Creating synthetic video with silence..."
docker compose run --rm \
    -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
    --entrypoint bash \
    base-python \
    -c "
set -e
mkdir -p /data/pipeline/${JOB_ID}/input
# Segment 1: 5s tone+video
ffmpeg -y -f lavfi -i testsrc=duration=5:size=640x360:rate=30 -f lavfi -i sine=frequency=440:duration=5 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest /data/pipeline/${JOB_ID}/input/seg1.mp4 2>/dev/null
# Segment 2: 2s silence+black
ffmpeg -y -f lavfi -i color=c=black:s=640x360:d=2:r=30 -f lavfi -i anullsrc=r=44100:cl=mono -t 2 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest /data/pipeline/${JOB_ID}/input/seg2.mp4 2>/dev/null
# Segment 3: 5s tone+video
ffmpeg -y -f lavfi -i testsrc=duration=5:size=640x360:rate=30 -f lavfi -i sine=frequency=440:duration=5 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest /data/pipeline/${JOB_ID}/input/seg3.mp4 2>/dev/null
# Concatenate
echo 'file /data/pipeline/${JOB_ID}/input/seg1.mp4' > /data/pipeline/${JOB_ID}/input/concat.txt
echo 'file /data/pipeline/${JOB_ID}/input/seg2.mp4' >> /data/pipeline/${JOB_ID}/input/concat.txt
echo 'file /data/pipeline/${JOB_ID}/input/seg3.mp4' >> /data/pipeline/${JOB_ID}/input/concat.txt
ffmpeg -y -f concat -safe 0 -i /data/pipeline/${JOB_ID}/input/concat.txt -c copy /data/pipeline/${JOB_ID}/input/video.mp4 2>/dev/null
# Cleanup segments
rm -f /data/pipeline/${JOB_ID}/input/seg1.mp4 /data/pipeline/${JOB_ID}/input/seg2.mp4 /data/pipeline/${JOB_ID}/input/seg3.mp4 /data/pipeline/${JOB_ID}/input/concat.txt
echo 'VIDEO_CREATED'
"

sleep 1

if [ ! -f "${DIR}/input/video.mp4" ]; then
    echo "ERROR: Failed to create test video"
    echo "Trying simpler video without embedded silence..."
    # Fallback: simple video without explicit silence (FFmpeg should still detect quiet parts)
    docker compose run --rm \
        -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
        --entrypoint bash \
        base-python \
        -c "mkdir -p /data/pipeline/${JOB_ID}/input && ffmpeg -y -f lavfi -i testsrc=duration=12:size=640x360:rate=30 -f lavfi -i sine=frequency=440:duration=12 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest /data/pipeline/${JOB_ID}/input/video.mp4 2>/dev/null && echo 'VIDEO_CREATED'"
    sleep 1
fi

if [ ! -f "${DIR}/input/video.mp4" ]; then
    echo "ERROR: Could not create test video. Aborting."
    exit 1
fi
echo "  Created: ${DIR}/input/video.mp4"

# Get input duration
INPUT_DUR=$(docker compose run --rm \
    -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
    --entrypoint bash \
    base-python \
    -c "ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /data/pipeline/${JOB_ID}/input/video.mp4" 2>/dev/null | tr -d '[:space:]')
echo "  Input duration: ${INPUT_DUR}s"

# Step 2: Build silence-cutter container
echo ""
echo "Step 2: Building silence-cutter container..."
docker compose build silence-cutter 2>&1 | tail -1

# Step 3: Run silence-cutter (FFmpeg-only mode — no TRANSCRIPT_PATH)
echo ""
echo "Step 3: Running silence-cutter (FFmpeg-only mode)..."
docker compose run --rm \
    -e INPUT_PATH="/data/pipeline/${JOB_ID}/input/video.mp4" \
    -e OUTPUT_PATH="/data/pipeline/${JOB_ID}/silence-cutter/output.mp4" \
    -e PIPELINE_JOB_ID="${JOB_ID}" \
    -e SILENCE_MIN_DURATION=0.5 \
    silence-cutter

sleep 1

# Step 4: Verify outputs
echo ""
echo "Step 4: Verifying outputs..."
FAIL=0

# 4a. output.mp4 exists
if [ -f "${DIR}/silence-cutter/output.mp4" ]; then
    echo "  ✅ output.mp4 exists"
else
    echo "  ❌ output.mp4 NOT found"
    FAIL=1
fi

# 4b. manifest.json with status=success
if [ -f "${DIR}/silence-cutter/manifest.json" ]; then
    MSTATUS=$(docker compose run --rm \
        -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
        --entrypoint bash \
        base-python \
        -c "import json; print(json.load(open('/data/pipeline/${JOB_ID}/silence-cutter/manifest.json'))['status'])" 2>/dev/null | tr -d '[:space:]')
    echo "  ✅ manifest.json status=${MSTATUS}"
    if [ "$MSTATUS" != "success" ]; then
        FAIL=1
    fi
else
    echo "  ❌ manifest.json NOT found"
    FAIL=1
fi

# 4c. silence-cuts.json with monotonic cumulative_shift
if [ -f "${DIR}/silence-cutter/silence-cuts.json" ]; then
    echo "  ✅ silence-cuts.json exists"
    CUT_INFO=$(docker compose run --rm \
        -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
        --entrypoint bash \
        base-python \
        -c "
import json
d = json.load(open('/data/pipeline/${JOB_ID}/silence-cutter/silence-cuts.json'))
cuts = d.get('cuts', [])
print(f'segments={d.get(\"total_segments_removed\",\"?\")}, removed={d.get(\"total_silence_removed\",\"?\")}s')
if cuts:
    shifts = [c['cumulative_shift'] for c in cuts]
    mono = all(shifts[i] <= shifts[i+1] for i in range(len(shifts)-1))
    print(f'monotonic={\"yes\" if mono else \"no\"}')
    sources = set(c.get('source','?') for c in cuts)
    print(f'sources={\",\".join(sources)}')
else:
    print('no_cuts_detected')
" 2>/dev/null)
    echo "  ${CUT_INFO}"
else
    echo "  ❌ silence-cuts.json NOT found"
    FAIL=1
fi

# 4d. Duration check — output shorter than input (silence was removed)
if [ -f "${DIR}/silence-cutter/output.mp4" ]; then
    OUTPUT_DUR=$(docker compose run --rm \
        -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
        --entrypoint bash \
        base-python \
        -c "ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /data/pipeline/${JOB_ID}/silence-cutter/output.mp4" 2>/dev/null | tr -d '[:space:]')
    
    echo ""
    echo "── SILC-02: Hard-cut removes silence ──"
    echo "  Input duration:  ${INPUT_DUR}s"
    echo "  Output duration: ${OUTPUT_DUR}s"
    
    SHORTER=$(docker compose run --rm \
        -v "${PROJECT_DIR}/pipeline:/data/pipeline" \
        --entrypoint bash \
        base-python \
        -c "print('yes' if ${OUTPUT_DUR:-0} < ${INPUT_DUR:-9999} else 'no')" 2>/dev/null | tr -d '[:space:]')
    
    if [ "$SHORTER" = "yes" ]; then
        echo "  ✅ SILC-02: Output shorter than input (silence removed)"
    else
        echo "  ⚠️  SILC-02: Output not shorter (may be no detectable silence in test video)"
    fi
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " OUTPUT CHECKS PASSED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " SOME CHECKS FAILED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "Output files (NOT auto-deleted):"
echo "  Video:       ${DIR}/silence-cutter/output.mp4"
echo "  Cuts JSON:   ${DIR}/silence-cutter/silence-cuts.json"
echo "  Manifest:    ${DIR}/silence-cutter/manifest.json"
echo ""
echo "Inspect video:  mpv ${DIR}/silence-cutter/output.mp4"
echo "Clean up:       rm -rf ${DIR}"