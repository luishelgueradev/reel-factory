#!/usr/bin/env bash
# scripts/smoke-test.sh — E2E smoke test for pipeline infrastructure
# Validates all 5 PIPE requirements with pass/fail reporting.
# Adapted for bind-mount ./pipeline/ setup (no docker cp needed).
set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PIPELINE_DIR="$PROJECT_DIR/pipeline"
JOB_ID="smoke-$(date +%s)"

# Counters
PASS=0
FAIL=0
TOTAL=5

# ─── Helpers ──────────────────────────────────────────────────────────────────
pass() { PASS=$((PASS + 1)); echo "  ✅ PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌ FAIL: $1"; }
header() { echo ""; echo "━━━ $1 ━━━"; }

cleanup() {
    header "Cleanup"
    if [ -d "$PIPELINE_DIR/$JOB_ID" ]; then
        rm -rf "$PIPELINE_DIR/$JOB_ID"
        echo "  Removed $PIPELINE_DIR/$JOB_ID"
    fi
    docker compose -f "$PROJECT_DIR/docker-compose.yml" down --remove-orphans 2>/dev/null || true
}
trap cleanup EXIT

# ─── PIPE-01: Shared volume I/O ─────────────────────────────────────────────
# Input file accessible by container, output written to bind mount.
check_pipe_01() {
    header "PIPE-01: Shared volume I/O"
    local input_dir="$PIPELINE_DIR/$JOB_ID/input"
    mkdir -p "$input_dir"

    # Generate a minimal test MP4 using ffmpeg on host (if available),
    # otherwise create a placeholder binary file.
    if command -v ffmpeg &>/dev/null; then
        ffmpeg -y -f lavfi -i "color=c=black:s=320x240:d=1:r=25" \
            -f lavfi -i "sine=frequency=440:duration=1" \
            -c:v libx264 -c:a aac -pix_fmt yuv420p \
            "$input_dir/video.mp4" </dev/null >/dev/null 2>&1
        echo "  Created test video with host ffmpeg"
    else
        # Fallback: minimal binary placeholder
        head -c 1024 /dev/urandom > "$input_dir/video.mp4"
        echo "  Created placeholder input file (no host ffmpeg)"
    fi

    # Verify host can write to bind mount
    if [ -f "$input_dir/video.mp4" ]; then
        pass "Input file created on host at $input_dir/video.mp4"
    else
        fail "Input file NOT found on host at $input_dir/video.mp4"
    fi

    # Verify container can see the same path via Docker run
    local container_check
    container_check=$(docker run --rm \
        -v "$PIPELINE_DIR:/data/pipeline" \
        --entrypoint ls \
        video-pipeline-base-python:latest \
        "/data/pipeline/$JOB_ID/input/video.mp4" 2>/dev/null) || true
    if echo "$container_check" | grep -q "video.mp4"; then
        pass "Container can read input file via bind mount"
    else
        fail "Container cannot read input file via bind mount"
    fi
}

# ─── PIPE-02: Step contract ──────────────────────────────────────────────────
# smoke-test container reads INPUT_PATH, writes OUTPUT_PATH + manifest.json.
check_pipe_02() {
    header "PIPE-02: Step contract"
    local smoke_output_dir="$PIPELINE_DIR/$JOB_ID/smoke-test/output"

    # Run smoke-test container with environment variables set
    PIPELINE_JOB_ID="$JOB_ID" \
    INPUT_PATH="/data/pipeline/$JOB_ID/input/video.mp4" \
    OUTPUT_PATH="/data/pipeline/$JOB_ID/smoke-test/output/video.mp4" \
    docker compose -f "$PROJECT_DIR/docker-compose.yml" run --rm smoke-test 2>&1 || true

    # Check OUTPUT_PATH was written
    if [ -f "$smoke_output_dir/video.mp4" ]; then
        pass "Smoke test output file written at $smoke_output_dir/video.mp4"
    else
        fail "Smoke test output file NOT found at $smoke_output_dir/video.mp4"
    fi

    # Check manifest.json was written
    if [ -f "$smoke_output_dir/manifest.json" ]; then
        pass "Manifest written at $smoke_output_dir/manifest.json"
    else
        fail "Manifest NOT found at $smoke_output_dir/manifest.json"
    fi
}

# ─── PIPE-03: Intermediate artifacts inspectable ─────────────────────────────
# analysis.json exists on host filesystem after step runs.
check_pipe_03() {
    header "PIPE-03: Intermediate artifacts inspectable"
    local intermediate_file="$PIPELINE_DIR/$JOB_ID/smoke-test/output/intermediate/analysis.json"

    if [ -f "$intermediate_file" ]; then
        pass "Intermediate artifact exists at $intermediate_file"
        # Verify it's valid JSON
        if python3 -c "import json; json.load(open('$intermediate_file'))" 2>/dev/null; then
            pass "analysis.json contains valid JSON"
        elif jq empty "$intermediate_file" 2>/dev/null; then
            pass "analysis.json contains valid JSON (jq)"
        else
            # Try a simple heuristic
            if grep -q '"step"' "$intermediate_file" 2>/dev/null; then
                pass "analysis.json contains step metadata"
            else
                fail "analysis.json does not appear to contain valid JSON"
            fi
        fi
    else
        fail "Intermediate artifact NOT found at $intermediate_file"
    fi
}

# ─── PIPE-04: Pipeline extensibility ─────────────────────────────────────────
# smoke-test service exists in docker-compose.yml.
check_pipe_04() {
    header "PIPE-04: Pipeline extensibility"
    local compose_file="$PROJECT_DIR/docker-compose.yml"

    if grep -q "smoke-test:" "$compose_file"; then
        pass "smoke-test service defined in docker-compose.yml"
    else
        fail "smoke-test service NOT found in docker-compose.yml"
    fi

    # Verify the compose file is valid
    if docker compose -f "$compose_file" config --services 2>/dev/null | grep -q "smoke-test"; then
        pass "smoke-test service validated by docker compose config"
    else
        fail "smoke-test service NOT validated by docker compose config"
    fi
}

# ─── PIPE-05: FFmpeg version consistency ──────────────────────────────────────
# Both containers report the same FFmpeg version, pinned to 7.1.1.
check_pipe_05() {
    header "PIPE-05: FFmpeg version consistency"
    local EXPECTED_VERSION="7.1.1"

    # Check base-python container
    local python_ffmpeg
    python_ffmpeg=$(docker run --rm video-pipeline-base-python:latest ffmpeg -version 2>&1 | head -1) || true
    local python_version
    python_version=$(echo "$python_ffmpeg" | sed -n 's/ffmpeg version \([^ ]*\).*/\1/p')

    # Check base-node container
    local node_ffmpeg
    node_ffmpeg=$(docker run --rm video-pipeline-base-node:latest ffmpeg -version 2>&1 | head -1) || true
    local node_version
    node_version=$(echo "$node_ffmpeg" | sed -n 's/ffmpeg version \([^ ]*\).*/\1/p')

    if [ -z "$python_version" ]; then
        fail "Could not detect FFmpeg version in base-python: $python_ffmpeg"
    else
        pass "base-python has FFmpeg $python_version"
    fi

    if [ -z "$node_version" ]; then
        fail "Could not detect FFmpeg version in base-node: $node_ffmpeg"
    else
        pass "base-node has FFmpeg $node_version"
    fi

    # Both must match (consistency)
    if [ -n "$python_version" ] && [ -n "$node_version" ]; then
        if [ "$python_version" = "$node_version" ]; then
            pass "FFmpeg version consistent across containers ($python_version)"
        else
            fail "FFmpeg version mismatch: base-python=$python_version vs base-node=$node_version"
        fi
    fi

    # Version must be pinned to expected version (not a nightly build)
    if [ -n "$python_version" ]; then
        if echo "$python_version" | grep -q "$EXPECTED_VERSION"; then
            pass "FFmpeg version is pinned to $EXPECTED_VERSION (base-python: $python_version)"
        else
            fail "FFmpeg version not pinned to $EXPECTED_VERSION — got '$python_version' in base-python"
        fi
    fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    echo "════════════════════════════════════════════════════════════════"
    echo "  Pipeline Infrastructure Smoke Test"
    echo "  Job ID: $JOB_ID"
    echo "════════════════════════════════════════════════════════════════"

    # Build images first (ensures latest Dockerfiles are used)
    echo ""
    echo "Building base images..."
    docker compose -f "$PROJECT_DIR/docker-compose.yml" build base-python base-node 2>&1 | tail -3

    check_pipe_01
    check_pipe_02
    check_pipe_03
    check_pipe_04
    check_pipe_05

    # ─── Summary ─────────────────────────────────────────────────────────────
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Results: $PASS passed, $FAIL failed (out of $TOTAL checks)"
    echo "════════════════════════════════════════════════════════════════"

    if [ "$FAIL" -gt 0 ]; then
        echo "  ❌ SMOKE TEST FAILED"
        exit 1
    else
        echo "  ✅ ALL CHECKS PASSED"
        exit 0
    fi
}

main "$@"