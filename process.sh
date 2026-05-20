#!/usr/bin/env bash
set -euo pipefail

# Process a video through the pipeline
# Per D-05: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → srt-exporter
# 1. Whisper (on original video — timestamps on original timeline, remapped later)
# 2. Silence cutter (detect and remove silence, produce cut video + silence-cuts.json)
# 3. FFmpeg finalizer (9:16 vertical output + safe zone metadata)
# 4. Remotion renderer (animated subtitles on 9:16 video, with timestamp remapping)
# 5. SRT exporter (SRT/VTT sidecar files, with timestamp remapping)
# Usage: ./process.sh video.mp4 [video2.mp4 ...]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Run one pipeline step. Captures the container's REAL exit code (not grep's)
# and fails fast if the container errored or did not write a success manifest —
# so a broken step never silently feeds garbage to the next one.
#   $1 = step display name   $2 = grep filter for log output
#   $3 = host path to the step's manifest.json   $4.. = docker compose run args
run_step() {
    local name="$1" pattern="$2" manifest="$3"; shift 3

    set +e
    docker compose run --rm "$@" 2>&1 | grep -E "$pattern"
    local rc=${PIPESTATUS[0]}
    set -e

    if [ "$rc" -ne 0 ]; then
        echo "  ERROR: step '$name' failed (container exit $rc)"
        exit 1
    fi
    if [ ! -f "$manifest" ]; then
        echo "  ERROR: step '$name' produced no manifest ($manifest) — treating as failure"
        exit 1
    fi
    if command -v python3 >/dev/null 2>&1; then
        local status
        status="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('status',''))" "$manifest" 2>/dev/null || echo "")"
        if [ "$status" != "success" ]; then
            echo "  ERROR: step '$name' manifest status='$status' (expected 'success')"
            exit 1
        fi
    fi
}

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
    echo "  Step 1/5: Whisper (on original video)..."
    export INPUT_PATH="/data/pipeline/$NAME/input/video.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/whisper/transcript.json"
    run_step "whisper" '\[whisper\]|Completed|ERROR' "$JOB_DIR/whisper/manifest.json" \
        -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH whisper

    echo ""
    echo "  Step 2/5: Silence cutter..."
    export INPUT_PATH="/data/pipeline/$NAME/input/video.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/silence-cutter/output.mp4"
    export TRANSCRIPT_PATH="/data/pipeline/$NAME/whisper/transcript.json"
    run_step "silence-cutter" '\[silence-cutter\]|Confirmed|Completed|ERROR' "$JOB_DIR/silence-cutter/manifest.json" \
        -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH -e TRANSCRIPT_PATH silence-cutter

    echo ""
    echo "  Step 3/5: FFmpeg finalizer (9:16 vertical)..."
    export INPUT_PATH="/data/pipeline/$NAME/silence-cutter/output.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/ffmpeg-finalizer/output.mp4"
    run_step "ffmpeg-finalizer" '\[ffmpeg-finalizer\]|Completed|ERROR|Output:' "$JOB_DIR/ffmpeg-finalizer/manifest.json" \
        -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH ffmpeg-finalizer

    echo ""
    echo "  Step 4/5: Remotion renderer (animated subtitles on 9:16 video)..."
    export INPUT_PATH="/data/pipeline/$NAME/ffmpeg-finalizer/output.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/remotion-renderer/output.mp4"
    export TRANSCRIPT_PATH="/data/pipeline/$NAME/whisper/transcript.json"
    export SILENCE_CUTS_PATH="/data/pipeline/$NAME/silence-cutter/silence-cuts.json"
    export FINALIZER_INFO_PATH="/data/pipeline/$NAME/ffmpeg-finalizer/finalizer-info.json"

    # Copy pipeline config from remotion-studio to renderer job dir
    STUDIO_CONFIG="$SCRIPT_DIR/services/remotion-studio/pipeline-config.json"
    if [ -f "$STUDIO_CONFIG" ]; then
        mkdir -p "$JOB_DIR/remotion-renderer"
        cp "$STUDIO_CONFIG" "$JOB_DIR/remotion-renderer/pipeline-config.json"
        export PIPELINE_CONFIG_PATH="/data/pipeline/$NAME/remotion-renderer/pipeline-config.json"
        echo "  Using config from remotion-studio"
    else
        unset PIPELINE_CONFIG_PATH || true
    fi

    # Whisper ran on the ORIGINAL video (Step 1), so transcript timestamps are on
    # the original timeline and MUST be remapped against silence-cuts.json. Pass
    # SILENCE_CUTS_PATH so the renderer remaps (matches api-server orchestrator).
    run_step "remotion-renderer" '\[remotion-renderer\]|Completed|ERROR|Render:' "$JOB_DIR/remotion-renderer/manifest.json" \
        -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH -e TRANSCRIPT_PATH \
        -e SILENCE_CUTS_PATH -e FINALIZER_INFO_PATH -e PIPELINE_CONFIG_PATH remotion-renderer

    echo ""
    echo "  Step 5/5: SRT exporter (SRT/VTT sidecars)..."
    export INPUT_PATH="/data/pipeline/$NAME/input/video.mp4"
    export OUTPUT_PATH="/data/pipeline/$NAME/srt-exporter/output.vtt"
    export TRANSCRIPT_PATH="/data/pipeline/$NAME/whisper/transcript.json"
    export SILENCE_CUTS_PATH="/data/pipeline/$NAME/silence-cutter/silence-cuts.json"
    run_step "srt-exporter" '\[srt-exporter\]|Completed|ERROR' "$JOB_DIR/srt-exporter/manifest.json" \
        -e PIPELINE_JOB_ID -e INPUT_PATH -e OUTPUT_PATH -e TRANSCRIPT_PATH -e SILENCE_CUTS_PATH srt-exporter

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
    cp "$JOB_DIR/srt-exporter/output.srt" "$OUTPUT_DIR/output.srt" 2>/dev/null || true
    cp "$JOB_DIR/srt-exporter/output.vtt" "$OUTPUT_DIR/output.vtt" 2>/dev/null || true

    echo ""
    echo "  Output: $OUTPUT_DIR/"
    echo "    reel_no_subs.mp4    - video sin silencios (original aspect)"
    echo "    reel_with_subs.mp4  - video 9:16 con subtitulos animados (1080x1920)"
    echo "    reel_9x16_finalizer.mp4 - video vertical 9:16 sin subtitulos (1080x1920)"
    echo "    transcript.json      - transcripcion"
    echo "    cuts.json            - detalle de cortes de silencio"
    echo "    caption-pages.json   - paginas de subtitulos generadas"
    echo "    finalizer-info.json  - info del crop vertical"
    echo "    output.srt / output.vtt - subtitulos sidecar"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
done
