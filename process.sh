#!/usr/bin/env bash
set -euo pipefail

# Process a video through the pipeline
# Per D-05: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer
# 1. Whisper (on original video — timestamps on original timeline, remap later)
# 2. Silence cutter (detect and remove silence, produce cut video + silence-cuts.json)
# 3. FFmpeg finalizer (9:16 vertical output + safe zone metadata)
# 4. Remotion renderer (animated subtitles on 9:16 video, with timestamp remapping)
# Usage: ./process.sh video.mp4 [video2.mp4 ...]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

for VIDEO in "$@"; do
    if [ ! -f "$VIDEO" ]; then
        echo "File not found: $VIDEO"
        exit 1
    fi

    NAME="$(basename "${VIDEO%.*}")"
    JOB_DIR="pipeline/$NAME"
    OUTPUT_DIR="$JOB_DIR/output"

    mkdir -p "$JOB_DIR/input"
    cp "$VIDEO" "$JOB_DIR/input/video.mp4"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " Processing: $NAME"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    export PIPELINE_JOB_ID="$NAME"

    echo ""
    echo "  Step 1/4: Whisper (on original video)..."
    export INPUT_PATH="/data/pipeline/$NAME/input/video.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/whisper/transcript.json"

    docker compose run --rm -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH \
        whisper 2>&1 | grep -E '\[whisper\]|Completed|ERROR' || true

    echo ""
    echo "  Step 2/4: Silence cutter..."
    export INPUT_PATH="/data/pipeline/$NAME/input/video.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/silence-cutter/output.mp4"
    export TRANSCRIPT_PATH="/data/pipeline/$NAME/whisper/transcript.json"

    docker compose run --rm \
        -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH -e TRANSCRIPT_PATH \
        silence-cutter 2>&1 | grep -E '\[silence-cutter\]|Confirmed|Completed|ERROR' || true

    echo ""
    echo "  Step 3/4: FFmpeg finalizer (9:16 vertical)..."
    export INPUT_PATH="/data/pipeline/$NAME/silence-cutter/output.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/ffmpeg-finalizer/output.mp4"

    docker compose run --rm \
        -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH \
        ffmpeg-finalizer 2>&1 | grep -E '\[ffmpeg-finalizer\]|Completed|ERROR|Output:' || true

    echo ""
    echo "  Step 4/4: Remotion renderer (animated subtitles on 9:16 video)..."
    export INPUT_PATH="/data/pipeline/$NAME/ffmpeg-finalizer/output.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/remotion-renderer/output.mp4"
    export TRANSCRIPT_PATH="/data/pipeline/$NAME/whisper/transcript.json"
    export FINALIZER_INFO_PATH="/data/pipeline/$NAME/ffmpeg-finalizer/finalizer-info.json"

    # NOTE: SILENCE_CUTS_PATH intentionally not passed — Whisper runs on the cut video
    # so transcript timestamps are already on the silence-removed timeline.
    # The detection logic in areTimestampsAlreadyRemapped handles this automatically.
    docker compose run --rm \
        -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH -e TRANSCRIPT_PATH \
        -e FINALIZER_INFO_PATH \
        remotion-renderer 2>&1 | grep -E '\[remotion-renderer\]|Completed|ERROR|Render:' || true

    # Copy output
    mkdir -p "$OUTPUT_DIR"
    cp "$JOB_DIR/silence-cutter/output.mp4" "$OUTPUT_DIR/reel_no_subs.mp4" 2>/dev/null || true
    cp "$JOB_DIR/remotion-renderer/output.mp4" "$OUTPUT_DIR/reel_with_subs.mp4" 2>/dev/null || true
    cp "$JOB_DIR/ffmpeg-finalizer/output.mp4" "$OUTPUT_DIR/reel_9x16_finalizer.mp4" 2>/dev/null || true
    cp "$JOB_DIR/whisper/transcript.json" "$OUTPUT_DIR/transcript.json" 2>/dev/null || true
    cp "$JOB_DIR/silence-cutter/silence-cuts.json" "$OUTPUT_DIR/cuts.json" 2>/dev/null || true
    cp "$JOB_DIR/remotion-renderer/caption-pages.json" "$OUTPUT_DIR/caption-pages.json" 2>/dev/null || true
    cp "$JOB_DIR/remotion-renderer/remotion-info.json" "$OUTPUT_DIR/remotion-info.json" 2>/dev/null || true
    cp "$JOB_DIR/ffmpeg-finalizer/finalizer-info.json" "$OUTPUT_DIR/finalizer-info.json" 2>/dev/null || true

    echo ""
    echo "  Output: $OUTPUT_DIR/"
    echo "    reel_no_subs.mp4    - video sin silencios (original aspect)"
    echo "    reel_with_subs.mp4  - video 9:16 con subtitulos animados (1080x1920)"
    echo "    reel_9x16_finalizer.mp4 - video vertical 9:16 sin subtitulos (1080x1920)"
    echo "    transcript.json      - transcripcion"
    echo "    cuts.json            - detalle de cortes de silencio"
    echo "    caption-pages.json   - paginas de subtitulos generadas"
    echo "    finalizer-info.json  - info del crop vertical"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
done