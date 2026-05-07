#!/usr/bin/env bash
set -euo pipefail

# Process a video through the pipeline (silence-cutter → whisper)
# Silence is cut first so Whisper timestamps match the output video directly.
# Usage: ./process.sh video.mp4 [video2.mp4 ...]
# Output goes to pipeline/<name>/output/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

for VIDEO in "$@"; do
    if [ ! -f "$VIDEO" ]; then
        echo "File not found: $VIDEO"
        exit 1
    fi

    NAME="$(basename "${VIDEO%.*}")"
    JOB_DIR="pipeline/$NAME"
    INPUT_DIR="$JOB_DIR/input"
    OUTPUT_DIR="$JOB_DIR/output"

    mkdir -p "$INPUT_DIR"
    cp "$VIDEO" "$INPUT_DIR/video.mp4"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " Processing: $NAME"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    export PIPELINE_JOB_ID="$NAME"

    echo ""
    echo "  Step 1/2: Silence cutter (FFmpeg-only, no transcript needed)..."
    export INPUT_PATH="/data/pipeline/$NAME/input/video.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/silence-cutter/output.mp4"

    docker compose run --rm \
        -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH \
        silence-cutter 2>&1 | grep -E '\[silence-cutter\]|Completed|ERROR' || true

    echo ""
    echo "  Step 2/2: Whisper (on silence-cut video)..."
    # Transcribe the silence-cut video, not the original
    export INPUT_PATH="/data/pipeline/$NAME/silence-cutter/output.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/whisper/transcript.json"

    docker compose run --rm -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH \
        whisper 2>&1 | grep -E '\[whisper\]|Completed|ERROR' || true

    # Copy output to a convenient location
    mkdir -p "$OUTPUT_DIR"
    cp "$JOB_DIR/silence-cutter/output.mp4" "$OUTPUT_DIR/reel.mp4" 2>/dev/null || true
    cp "$JOB_DIR/whisper/transcript.json" "$OUTPUT_DIR/transcript.json" 2>/dev/null || true
    cp "$JOB_DIR/silence-cutter/silence-cuts.json" "$OUTPUT_DIR/cuts.json" 2>/dev/null || true

    echo ""
    echo "  Output: $OUTPUT_DIR/"
    echo "    reel.mp4          - video sin silencios"
    echo "    transcript.json    - transcripcion (timestamps del video final)"
    echo "    cuts.json          - detalle de cortes"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
done