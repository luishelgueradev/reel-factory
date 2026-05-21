---
phase: 13-encode-quality
plan: "04"
subsystem: verification
tags: [visual-ab, ffmpeg, ffprobe, encode-quality, human-verify, bitrate-gate]
dependency_graph:
  requires: [13-01, 13-02]
  provides: [visual-ab-phase-13.sh, uat/baseline.mp4, uat/phase-13.mp4, uat/README.md, 13-UAT.md]
  affects: [ENC-02, ENC-03, ENC-04, ENC-05]
tech_stack:
  added: []
  patterns:
    - Checked-in repeatable A/B render driver (no git checkout dance — explicit v1.0 vs Phase 13 argv in one script)
    - ffprobe + awk programmatic bitrate-band hard gate
    - human-verify checkpoint for the perceptual claim ffprobe cannot prove
key_files:
  created:
    - scripts/visual-ab-phase-13.sh
    - .planning/phases/13-encode-quality/uat/baseline.mp4
    - .planning/phases/13-encode-quality/uat/phase-13.mp4
    - .planning/phases/13-encode-quality/uat/README.md
    - .planning/phases/13-encode-quality/13-UAT.md
  modified: []
decisions:
  - "A/B input is the silence-cutter output (pipeline/VID_20260518_114955/silence-cutter/output.mp4), NOT a raw camera clip — it is the actual input the ffmpeg-finalizer consumes in the real pipeline, so the bitrate hard gate and perceptual judgment reflect real behavior"
  - "BT.709 color-tag contrast could NOT be isolated with this fixture: the source already carried bt709 tags and libx264 propagates them, so baseline.mp4 also reports bt709. ENC-03 requirement ('Phase 13 output carries BT.709 metadata') is still satisfied"
  - "Initial A/B run used a raw camera clip and failed the bitrate hard gate (17,802 kbps vs [5000-8000]); re-ran against the silence-cutter output → 6,559 kbps PASS"
metrics:
  completed_date: "2026-05-21T00:00:00Z"
  tasks_completed: 5
  files_changed: 5
---

# Phase 13 Plan 04: Visual A/B Verification Summary

The perceptual gate for Phase 13. ffprobe and pytest prove the mechanical invariants (CRF=18, BT.709 tags, duration parity, stream-copy concat); this plan produced the side-by-side A/B render that supplies the perceptual evidence ffprobe cannot, ran the production bitrate hard gate, and resolved the ENC-04 "sin halos" human-verify checkpoint.

## One-liner

Repeatable `visual-ab-phase-13.sh` driver renders baseline (v1.0) and phase-13 MP4s from the same silence-cutter output; phase-13.mp4 passes the 5000-8000 kbps hard gate at 6,559 kbps; human reviewer confirmed no halos/artifacts (ENC-04 PASS).

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 1 | Write scripts/visual-ab-phase-13.sh — repeatable A/B render driver | 3fdade9 (merged c334684) |
| 2 | Human supplies input clip (checkpoint) | resolved — silence-cutter output chosen |
| 3 | Run A/B render + ffprobe report + production bitrate hard gate | 388fc2d |
| 4 | Create 13-UAT.md with 6 test entries | ac50c3f |
| 5 | Human visual A/B verification — ENC-04 "sin halos" gate (checkpoint) | resolved — approved |

## A/B Input

`pipeline/VID_20260518_114955/silence-cutter/output.mp4` (~7.7 MB, ~16.5 s) — the actual input the ffmpeg-finalizer consumes in the real pipeline. An earlier attempt used a raw camera clip but failed the bitrate hard gate (17,802 kbps); the silence-cutter output is the representative production input and lands cleanly in band.

## ffprobe Comparison

| File | Size (MB) | Bitrate (kbps) | Duration (s) | color_space | color_primaries | color_transfer | Production band (5000–8000) |
|------|-----------|---------------|-------------|-------------|-----------------|----------------|------------------------------|
| baseline.mp4 | ~10.1 | 5,151 | 16.500 | bt709* | bt709* | bt709* | PASS |
| phase-13.mp4 | ~12.9 | 6,559 | 16.500 | bt709 | bt709 | bt709 | PASS |

*BT.709 tags on baseline are inherited from the source clip, not from explicit encode flags.

**Delta:** phase-13 is ~27% larger (+1,408 kbps) at identical duration (ENC-05 parity confirmed).

## Production Bitrate Hard Gate (ROADMAP success criterion #3)

```
ffprobe -v quiet -show_entries format=bit_rate -of default=nw=1:nk=1 \
  .planning/phases/13-encode-quality/uat/phase-13.mp4 \
  | awk '{kbps=$1/1000; exit !(kbps>=5000 && kbps<=8000)}'
```

**Exit code: 0** (measured 6,559 kbps, in [5000, 8000]). Hard gate PASSED.

## Human Verdict — Entry 5 (ENC-04 perceptual)

**APPROVED.** Reviewer (2026-05-21) reported no visible difference between the two clips beyond the slightly larger file size — i.e., **no halos and no artifacts** introduced by the `unsharp` filter. That is exactly the ENC-04 gate ("sin halos perceptibles") → PASS.

No perceptible sharpness *gain* was observed either. This is expected and by design: Phase 13 is upstream anti-degradation (stream-copy concat, CRF headroom, color correctness) on already-decent footage, not a visible enhancement. The visible sharpness win — crisp subtitle/overlay edges via higher render resolution — is the scope of Phase 14 (Remotion supersampling), which `depends_on` this phase's clean encode foundation.

Cross-checks: colors correct (c), no frame drift (d).

## 13-UAT.md Final State

- `status: complete`
- Summary: `total: 6`, `passed: 6`, `pending: 0`, `issues: 0`, `skipped: 0`, `blocked: 0`
- Gaps: `[none]`

## BT.709 Isolation Caveat (documented, not a gap)

The chosen fixture cannot demonstrate the BT.709 *tagging guarantee* because the source already carried bt709 tags (propagated by libx264 to the baseline too). ENC-03 is still satisfied — phase-13.mp4 explicitly carries all three bt709 tags. Isolating the delta would require a raw pre-silence-cutter clip, but that clip fails the bitrate hard gate; the production-representative input was the correct trade-off. Fully documented in `uat/README.md`.

## ENC Requirement Coverage (final)

| Requirement | Verified by | Verdict |
|-------------|-------------|---------|
| ENC-01 | pytest (TestConcatMode/TestConcatEdgeCases) — Plan 03 | PASS |
| ENC-02 | pytest (CRF=18, band) + Task 3 awk hard gate @ 6,559 kbps | PASS |
| ENC-03 | ffprobe bt709 tags on phase-13.mp4 | PASS (isolation caveat documented) |
| ENC-04 | mechanical: manifest fields (Plan 03) + perceptual: human verdict "no halos" | PASS |
| ENC-05 | pytest duration parity + A/B identical duration (16.500 s) | PASS |

## Deviations from Plan

- Task 2 input choice deviated from the suggested raw talking-head fixture: the first raw-clip run failed the production bitrate hard gate (17,802 kbps), so the input was switched to the silence-cutter output — the real finalizer input. This is the correct fixture for the gate and was an explicit user decision after the failure was surfaced.

## Self-Check: PASSED

- `scripts/visual-ab-phase-13.sh` — FOUND (executable, syntactically valid)
- `uat/baseline.mp4` (10,624,254 bytes) + `uat/phase-13.mp4` (13,526,921 bytes) — FOUND
- `uat/README.md` — FOUND (viewing instructions, ffprobe table, isolation note)
- `13-UAT.md` — `status: complete`, 6/6 passed
- Production bitrate hard gate — exit 0 @ 6,559 kbps
- Human verdict on ENC-04 — recorded (approved / no halos)
