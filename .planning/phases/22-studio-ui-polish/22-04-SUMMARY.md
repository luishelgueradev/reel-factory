---
phase: 22-studio-ui-polish
plan: "04"
subsystem: overlay-layering
tags: [overlay, layering, paint-order, d-03, d-04, renderer-sync]
dependency_graph:
  requires: [22-01-layer-schema]
  provides: [5-layer-paint-order, back-front-band-split, preview-dim-studio-only]
  affects: [22-03-overlay-editor, render-output]
tech_stack:
  added: []
  patterns: [filter-based band split with nullish default, preview-only dim via wrapper div]
key_files:
  created: []
  modified:
    - services/remotion-studio/src/SubtitledVideo.tsx
    - services/remotion-renderer/src/Root.tsx
decisions:
  - "D-03 back-band wraps PngOverlay in a <div> with opacity:0.85/filter:saturate(0.8) — studio Player path only; no prop change to PngOverlay itself"
  - "D-04 renderer Root.tsx edited by hand; no cp run (clobber-hazard avoided)"
  - "Missing layer field treated as 'back' via (o.layer ?? 'back') === 'back' predicate — same in both services"
metrics:
  duration: "280s"
  completed_date: "2026-06-03"
  tasks_completed: 2
  files_changed: 2
---

# Phase 22 Plan 04: Overlay Layering (D-03/D-04) Summary

**One-liner:** Implemented D-03/D-04 back/front overlay band split in both studio SubtitledVideo.tsx and renderer Root.tsx, producing identical 5-layer paint order with a studio-only legibility dim on the back band.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Split overlays into back/front bands in studio SubtitledVideo.tsx with preview-only dim | c4fc866 | services/remotion-studio/src/SubtitledVideo.tsx |
| 2 | Mirror the band split in renderer Root.tsx, re-run renderer vitest (no cp) | 1159251 | services/remotion-renderer/src/Root.tsx |

## What Was Built

### 5-Layer Paint Order (bottom → top)

Both the studio `SubtitledVideo.tsx` (Player path) and the renderer's inline `SubtitledVideo` (in `Root.tsx`) now implement the identical paint order:

1. `ZoomContainer` / `OffthreadVideo` — video background
2. `PngOverlay` where `(layer ?? "back") === "back"` — back band (under text, new default)
3. `SubtitleLayoutRenderer` — captions
4. `TitleOverlay` sequences — title blocks
5. `PngOverlay` where `layer === "front"` — front band (over titles, opt-in promotion)

### Studio Path (SubtitledVideo.tsx)

The single `overlays.map()` was replaced with two filtered passes:
- **Back band**: wrapped in a `<div style={{ position: "absolute", inset: 0, opacity: 0.85, filter: "saturate(0.8)" }}>` for the preview-only legibility dim — this wrapper is the unmistakable studio-path marker (no prop changes to PngOverlay)
- **Front band**: plain `<PngOverlay>` with `rawImageSrc={ov.imageData}` for the Player/browser data-URL path

Keys: `overlay-back-N` / `overlay-front-N` (stable, distinct from the old `overlay-N`).

### Renderer Path (Root.tsx)

The renderer's inline `SubtitledVideo` was edited by hand (no `cp` run). Same two filtered passes, with renderer divergences preserved:
- **No `rawImageSrc`** on either pass — renderer resolves via `staticFile(_resolvedFile)`
- **`const fps = 30`** kept at L117 — renderer does not use `useVideoConfig()`
- **No preview dim** — back-band overlays paint at full opacity/saturation in the exported video

## Acceptance Criteria Results

### Task 1 (Studio)
- `grep -c 'layer ?? "back"\|=== "back"' SubtitledVideo.tsx` → 1 PASS
- `grep -c '=== "front"' SubtitledVideo.tsx` → 1 PASS
- Back-band at line 103 < `<SubtitleLayoutRenderer` at line 109 PASS
- Front-band at line 127 > title `.map(` at line 110 PASS
- `saturate(0.8)` + `0.85` present in studio file, on back band PASS
- `npm run build:editor` exits 0 PASS

### Task 2 (Renderer)
- `grep -c '=== "front"' Root.tsx` → 1 PASS
- `grep -c 'layer ?? "back"\|=== "back"' Root.tsx` → 1 PASS
- Back-band at line 111 < `<SubtitleLayoutRenderer` at line 114 PASS
- Front-band at line 135 > title `.map(` at line 116 PASS
- `const fps = 30` preserved at L117 PASS
- No `rawImageSrc` on overlay passes PASS
- `grep -c 'saturate(0.8)' Root.tsx` → 0 PASS
- `git diff --name-only HEAD` (renderer commit) lists only `Root.tsx` — no compositions synced PASS
- `npm test` (renderer) → 298/298 tests pass PASS

## Deviations from Plan

None — plan executed exactly as written.

The preview-only dim was implemented as a wrapping `<div>` in the studio path (rather than a prop on PngOverlay), which is explicitly what the plan called for ("a wrapping `<div>` with that style"). No deviation.

## Known Stubs

None — both services now produce the complete 5-layer paint order. No placeholder data or deferred wiring.

## Threat Flags

- **T-22-07 (Tampering, layer-driven render order):** Mitigated. `(o.layer ?? "back")` default means a missing/undefined layer safely falls to the back band — no crash, no undefined behavior.
- **T-22-08 (Information disclosure, preview dim style):** Mitigated. `grep -c 'saturate(0.8)' services/remotion-renderer/src/Root.tsx` returns 0 — the dim cannot reach exported video.

No new threat surface introduced (composition-only edit, no new endpoints or data paths).

## Self-Check: PASSED

- services/remotion-studio/src/SubtitledVideo.tsx — back/front band split present FOUND
- services/remotion-renderer/src/Root.tsx — mirrored band split present FOUND
- Commit c4fc866 exists FOUND
- Commit 1159251 exists FOUND
- `saturate(0.8)` absent from Root.tsx CONFIRMED (grep returns 0)
- Renderer vitest 298/298 PASSED
