# Phase 13 — Visual A/B Reference

Side-by-side reference for the perceptual ENC-04 (sin halos) success criterion and visual cross-check for ENC-02 (bitrate band), ENC-03 (color tagging), ENC-05 (duration parity). Both files were produced from the same input clip using `scripts/visual-ab-phase-13.sh` — the only variable between them is the ffmpeg encode configuration (Phase 4 v1.0 flags vs Phase 13 flags). ffprobe and pytest prove the mechanical invariants; this A/B supplies the perceptual evidence that ffprobe cannot.

## Files

| File | Description | Source clip |
|------|-------------|-------------|
| `baseline.mp4` | v1.0 encode flags: CRF 20, no Lanczos, no unsharp, no explicit BT.709 args | `pipeline/VID_20260518_114955/silence-cutter/output.mp4` |
| `phase-13.mp4` | Phase 13 flags: CRF 18, Lanczos, unsharp 5:5:0.5:5:5:0.3, BT.709 metadata | `pipeline/VID_20260518_114955/silence-cutter/output.mp4` |

The source clip is the silence-cutter output (~7.7 MB, ~16.5 s) — the actual input the ffmpeg-finalizer service consumes in the real pipeline. Using this representative production input ensures the bitrate hard gate and perceptual judgment reflect real pipeline behavior.

## How to view

### Option A: mpv side-by-side

Open two terminal panes from the repo root and run:

```bash
mpv --geometry=50%x100%+0+0   .planning/phases/13-encode-quality/uat/baseline.mp4 &
mpv --geometry=50%x100%+50%+0 .planning/phases/13-encode-quality/uat/phase-13.mp4 &
```

Arrange the two mpv windows left and right so they play simultaneously.

### Option B: VLC

Open both files in two separate VLC windows. Use Media > Open File for each. Play both at the same time by pressing Space in each window.

## What to look for

1. **Sharpness of facial detail** — skin texture, eye highlights, hair strands. phase-13 should look perceptibly sharper than baseline. If they look identical, the unsharp filter is not applying. If phase-13 looks overly crunchy or artificial, the luma strength (0.5) may need tuning.

2. **Halo check** — examine high-contrast edges: eyeglass frames, jaw lines against background, any text visible in the frame. There must be **no** visible bright rim around dark edges nor dark rim around bright edges in phase-13. The research-backed luma strength of 0.5 is below the halo threshold for typical talking-head content, but this perceptual check is the gate (ENC-04).

3. **Color correctness** — phase-13's skin tones and background colors should look natural on your monitor. The source clip already carries bt709 tags (see note below), so both files may display similarly in color. If your player defaults BT.601 for the baseline and BT.709 for phase-13 you may see a slight green tint or wash on the baseline; report the observation.

4. **Duration / sync** — when played simultaneously both videos should stay frame-aligned throughout. Any visible drift is an ENC-05 regression.

### BT.709 isolation note

The silence-cutter source (`pipeline/VID_20260518_114955/silence-cutter/output.mp4`) already carries bt709 color tags. Because libx264 propagates stream-level side-data from the input, `baseline.mp4` also received bt709 tags in the encoded output, even though no explicit `-colorspace`/`-color_primaries`/`-color_trc` arguments were passed. Therefore the baseline-vs-phase-13 **color-tag contrast** cannot be isolated with this fixture.

What this means for ENC-03: the requirement states "the Phase 13 output carries BT.709 metadata" — that is satisfied (phase-13.mp4 reports `color_space=bt709`, `color_primaries=bt709`, `color_transfer=bt709`). The intent of the explicit flag set is to guarantee BT.709 tags even when the source lacks them; that guarantee cannot be demonstrated here because the source already provides them. A raw unprocessed camera clip (pre-silence-cutter) would isolate the delta, but the chosen fixture is the appropriate production input for the bitrate hard gate.

## Quantitative deltas

| File | Size (bytes) | Size (MB) | Bitrate (kbps) | Duration (s) | color_space | color_primaries | color_transfer | Production band (5000–8000 kbps) |
|------|-------------|-----------|---------------|-------------|-------------|-----------------|----------------|----------------------------------|
| baseline.mp4 | 10,624,254 | ~10.1 MB | 5,151 | 16.500 | bt709* | bt709* | bt709* | PASS |
| phase-13.mp4 | 13,526,921 | ~12.9 MB | 6,559 | 16.500 | bt709 | bt709 | bt709 | PASS |

*BT.709 tags on baseline are inherited from the source clip, not from explicit encode flags (see isolation note above).

**Delta:** phase-13 is ~27% larger (+2.9 MB) at ~27% higher bitrate (+1,408 kbps), with identical duration (parity confirmed — ENC-05 satisfied).

**Hard gate result:** `ffprobe ... | awk '{kbps=$1/1000; exit !(kbps>=5000 && kbps<=8000)}'` against phase-13.mp4 exits 0 (measured 6,559 kbps). ROADMAP success criterion #3 is satisfied.

## Mechanism

Both files were produced by:

```bash
./scripts/visual-ab-phase-13.sh pipeline/VID_20260518_114955/silence-cutter/output.mp4
```

The script invokes ffmpeg twice against the same input. The encode-config delta is the only variable:

| Parameter | baseline.mp4 (v1.0) | phase-13.mp4 (Phase 13) |
|-----------|---------------------|-------------------------|
| CRF | 20 | 18 |
| Scale filter | `scale=1080:1920:force_original_aspect_ratio=increase` | `scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos` |
| Sharpening | none | `unsharp=5:5:0.5:5:5:0.3` |
| BT.709 metadata | none (source tags inherited) | `-colorspace bt709 -color_primaries bt709 -color_trc bt709` |

Everything else — input clip, audio path, container format, output resolution — is held constant.

To regenerate, re-run the script with the same input path. The script requires ffmpeg (host or Docker via `video-pipeline-base-python:latest`).
