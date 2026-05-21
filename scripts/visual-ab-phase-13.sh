#!/usr/bin/env bash
# Phase 13 visual A/B render driver — ENC-02/03/04/05
#
# Usage: ./scripts/visual-ab-phase-13.sh path/to/input.mp4
#
# What this script produces:
#   .planning/phases/13-encode-quality/uat/baseline.mp4
#       — v1.0 encode flags: CRF 20, no Lanczos, no unsharp, no BT.709 tags
#   .planning/phases/13-encode-quality/uat/phase-13.mp4
#       — Phase 13 encode flags: CRF 18, Lanczos, unsharp 5:5:0.5:5:5:0.3, BT.709 metadata
#
# Design note: This script encodes ONLY via direct FFmpeg invocations (no pipeline
# orchestrator, no docker-compose ffmpeg-finalizer service) so the A/B is isolated
# to the encode-config delta documented in 13-CONTEXT.md D-05..D-09.
# The script tries host ffmpeg first; if absent it falls back to the base-python
# Docker image (which ships FFmpeg 7.1.1 per Phase 1), matching the pattern used
# in scripts/test-ffmpeg-finalizer.sh. Both encodes run against the same input
# clip with the same filter-chain shape — only the encode config differs.
# Note on aspect ratio: for simplicity, both encodes always apply the scale+crop
# branch (force_original_aspect_ratio=increase + crop=1080:1920). The no-crop
# branch (for inputs already at 9:16) is handled by the production finalizer but
# omitted here to keep the A/B self-contained and consistent across input formats.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# ── Input validation ─────────────────────────────────────────
if [ $# -lt 1 ]; then
    echo "Usage: $0 path/to/input.mp4" >&2
    exit 1
fi

INPUT="$1"

if [ ! -f "$INPUT" ]; then
    echo "Input not found: $INPUT" >&2
    exit 1
fi

# Resolve to absolute path
INPUT="$(cd "$(dirname "$INPUT")" && pwd)/$(basename "$INPUT")"

# ── ffmpeg / ffprobe availability (host or Docker fallback) ───
USE_DOCKER=0

if command -v ffmpeg >/dev/null 2>&1; then
    USE_DOCKER=0
    echo "[visual-ab] Using host ffmpeg: $(command -v ffmpeg)"
elif docker info >/dev/null 2>&1; then
    USE_DOCKER=1
    echo "[visual-ab] ffmpeg not on PATH; will use Docker (base-python image)."
else
    echo "ffmpeg not on PATH and Docker is not available." >&2
    echo "Install ffmpeg or ensure Docker is running." >&2
    exit 2
fi

# ── Output directory ──────────────────────────────────────────
UAT_DIR="${PROJECT_DIR}/.planning/phases/13-encode-quality/uat"
mkdir -p "$UAT_DIR"

BASELINE_OUT="${UAT_DIR}/baseline.mp4"
PHASE13_OUT="${UAT_DIR}/phase-13.mp4"

BASELINE_LOG="/tmp/visual-ab-baseline.log"
PHASE13_LOG="/tmp/visual-ab-phase13.log"

# ── Helpers ───────────────────────────────────────────────────
# run_ffmpeg ARGS...  — routes through host or Docker
run_ffmpeg() {
    if [ "$USE_DOCKER" -eq 0 ]; then
        ffmpeg "$@"
    else
        # Map the project dir into /project and the pipeline dir if needed
        # The input path may be anywhere; mount its parent into /input
        local input_dir
        input_dir="$(dirname "$INPUT")"
        local input_basename
        input_basename="$(basename "$INPUT")"

        # Replace any occurrence of the real INPUT path with the container path in args
        local container_input="/input/${input_basename}"
        # Build the arg list replacing $INPUT occurrences
        local args=()
        for arg in "$@"; do
            if [ "$arg" = "$INPUT" ]; then
                args+=("$container_input")
            elif [ "$arg" = "$BASELINE_OUT" ]; then
                args+=("/project/.planning/phases/13-encode-quality/uat/baseline.mp4")
            elif [ "$arg" = "$PHASE13_OUT" ]; then
                args+=("/project/.planning/phases/13-encode-quality/uat/phase-13.mp4")
            else
                args+=("$arg")
            fi
        done

        docker compose run --rm \
            -v "${input_dir}:/input:ro" \
            -v "${PROJECT_DIR}:/project" \
            --entrypoint ffmpeg \
            base-python \
            "${args[@]}"
    fi
}

# run_ffprobe ARGS... — routes through host or Docker
run_ffprobe() {
    if command -v ffprobe >/dev/null 2>&1; then
        ffprobe "$@"
    elif [ "$USE_DOCKER" -eq 1 ]; then
        # Replace paths for Docker context
        local args=()
        for arg in "$@"; do
            if [ "$arg" = "$BASELINE_OUT" ]; then
                args+=("/project/.planning/phases/13-encode-quality/uat/baseline.mp4")
            elif [ "$arg" = "$PHASE13_OUT" ]; then
                args+=("/project/.planning/phases/13-encode-quality/uat/phase-13.mp4")
            else
                args+=("$arg")
            fi
        done
        docker compose run --rm \
            -v "${PROJECT_DIR}:/project" \
            --entrypoint ffprobe \
            base-python \
            "${args[@]}"
    else
        echo "ffprobe not available" >&2
        exit 2
    fi
}

# ── [1/2] Baseline encode — Phase 4 / v1.0 flags ─────────────
echo ""
echo "[1/2] Encoding baseline (Phase 4 encode flags: CRF 20, no Lanczos, no unsharp, no BT.709)..."
echo "      Input:  $INPUT"
echo "      Output: $BASELINE_OUT"

run_ffmpeg \
    -y \
    -i "$INPUT" \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1" \
    -c:v libx264 \
    -crf 20 \
    -preset medium \
    -profile:v high \
    -pix_fmt yuv420p \
    -r 30 \
    -movflags +faststart \
    -map_metadata -1 \
    -map 0:v:0 \
    -map "0:a:0?" \
    -c:a aac \
    -b:a 128k \
    -ar 44100 \
    "$BASELINE_OUT" \
    > "$BASELINE_LOG" 2>&1

echo "      Done. Log: $BASELINE_LOG"

# ── [2/2] Phase 13 encode — CRF 18, Lanczos, unsharp=5:5:0.5:5:5:0.3, BT.709 ──
echo ""
echo "[2/2] Encoding phase-13 output (CRF 18, Lanczos, unsharp=5:5:0.5:5:5:0.3, BT.709)..."
echo "      Input:  $INPUT"
echo "      Output: $PHASE13_OUT"

run_ffmpeg \
    -y \
    -i "$INPUT" \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1,unsharp=5:5:0.5:5:5:0.3" \
    -c:v libx264 \
    -crf 18 \
    -preset medium \
    -profile:v high \
    -pix_fmt yuv420p \
    -colorspace bt709 \
    -color_primaries bt709 \
    -color_trc bt709 \
    -r 30 \
    -movflags +faststart \
    -map_metadata -1 \
    -map 0:v:0 \
    -map "0:a:0?" \
    -c:a aac \
    -b:a 128k \
    -ar 44100 \
    "$PHASE13_OUT" \
    > "$PHASE13_LOG" 2>&1

echo "      Done. Log: $PHASE13_LOG"

# ── Verify both outputs exist ─────────────────────────────────
if [ ! -s "$BASELINE_OUT" ]; then
    echo "ERROR: baseline.mp4 was not produced. Check $BASELINE_LOG" >&2
    exit 1
fi
if [ ! -s "$PHASE13_OUT" ]; then
    echo "ERROR: phase-13.mp4 was not produced. Check $PHASE13_LOG" >&2
    exit 1
fi

# ── Comparison table ─────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo " FFPROBE COMPARISON TABLE"
echo "═══════════════════════════════════════════════════════════"

print_probe() {
    local label="$1"
    local file="$2"
    echo ""
    echo "  ${label}:"
    run_ffprobe \
        -v quiet \
        -show_entries "stream=color_space,color_primaries,color_transfer" \
        -show_entries "format=size,bit_rate,duration" \
        -of "default=noprint_wrappers=1" \
        "$file" 2>/dev/null || echo "  (ffprobe failed on $file)"
}

print_probe "BASELINE (Phase 4 / v1.0 flags)" "$BASELINE_OUT"
print_probe "PHASE 13 (CRF 18, Lanczos, unsharp, BT.709)" "$PHASE13_OUT"

echo ""
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "Done. Open both files in mpv or VLC side-by-side:"
echo "  mpv --geometry=50%x100%+0+0   \"$BASELINE_OUT\" &"
echo "  mpv --geometry=50%x100%+50%+0 \"$PHASE13_OUT\" &"
echo ""
echo "Or view the README for detailed instructions:"
echo "  cat \"${UAT_DIR}/README.md\""
