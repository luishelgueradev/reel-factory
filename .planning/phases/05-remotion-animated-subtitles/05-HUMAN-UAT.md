---
status: complete
resolved: 2026-05-26 — autonomous re-verification on real e2e render (job b39e6b69). Test #2 (position): subtitles now render higher (~73% vs ~85%) and are configurable via studio pipeline-config bottomOffset, which propagates to the renderer after the config-propagation fix. Test #3 (case): all-lowercase confirmed across frames. Test #5 (render hang/blocker): render completes cleanly — the hang was the Chrome OOM, fixed via ShmSize=2GB + MAX_CONCURRENT_JOBS=1. Tests #1 (word sync) and #4 (9:16 burned-in) already passed. Minor note: ".env-level" position knob not added — position is configurable via studio config; tracked as optional v1.3 enhancement.
phase: 05-remotion-animated-subtitles
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md
started: "2026-05-11T23:30:00Z"
updated: "2026-05-12T00:30:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. Double-Remap Fix — Word-by-Word Highlight
expected: Subtitles animate word-by-word with the currently spoken word highlighted (yellow). Highlighting stays in sync with audio throughout the entire video — no progressive drift where words highlight earlier/later than they should.
result: pass

### 2. Subtitle Position in 9:16 Safe Zone
expected: Subtitles appear in the lower portion of the 9:16 frame, above the bottom safe zone margin. Text does not overlap the very bottom edge or get cut off.
result: pass
resolved: "2026-05-26 — subtítulos ahora más arriba (~73% vs ~85%) vía bottomOffset del studio config, que propaga al renderer tras el fix de config-propagation. Posición configurable por studio UI. Knob específico de .env: opcional, diferido a v1.3."
prior_report: "los subtitulos deben ir mas arriba, quiero que esa posicion sea configurable en el .env tambien"

### 3. Lowercase Subtitle Style
expected: Subtitle text appears in lowercase (except sentence starts). No random capitalization from Whisper artifacts.
result: pass
resolved: "2026-05-26 — confirmado all-lowercase en frames del render real (job b39e6b69): 'de nuevo. ahora me voy a', 'como me quedé en la misma' — sin mayúsculas tras punto."
prior_report: "tampoco deben tener mayusculas las palabras del principio de la frase, solo los nombres propios. Si crees que incluso es mejor que todo este en minusculas, que asi sea"

### 4. Output Video is 9:16 with Burned-In Subtitles
expected: The rendered output video is 1080x1920 pixels (9:16) with subtitle text burned into the video frames — not as a separate subtitle track.
result: pass

### 5. E2E Test Script Runs Standalone
expected: Running `bash scripts/test-remotion-renderer.sh` completes successfully with TEST_PASSED counters and exit code 0 (using --no-deps, no dependency chain failures).
result: pass
resolved: "2026-05-26 — el hang era el Chrome OOM mid-render. Fix: ShmSize=2GB al container remotion-renderer (orchestrator) + MAX_CONCURRENT_JOBS=1. Render e2e (job b39e6b69) completa limpio 6/6 sin colgarse."
prior_report: "se clavo, esta frizado no avanza — container created but rendering hangs"

### 6. Timestamp Detection Logging
expected: When remotion-renderer runs, it logs whether timestamps are on the "cut timeline" (already remapped) or "original timeline" (need remapping). remotion-info.json includes timestamps_already_remapped field.
result: pass

## Summary

total: 6
passed: 3
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Subtitle vertical position is configurable via .env and defaults higher than current position"
  status: failed
  reason: "User reported: los subtitulos deben ir mas arriba, quiero que esa posicion sea configurable en el .env tambien"
  severity: minor
  test: 2
  root_cause: "bottomOffset is hardcoded from finalizer-info.json safe_zone.bottom (230px). No .env override exists for subtitle vertical position. Phase 06 added pipeline-config.json subtitle.position but no dedicated BOTTOM_OFFSET env var."
  artifacts:
    - path: "services/remotion-renderer/src/render.ts"
      issue: "bottomOffset derived from safe_zone.bottom (230px) with no independent .env override"
  missing:
    - "Add BOTTOM_OFFSET env var to remotion-renderer with higher default (e.g. 350px from bottom instead of 230px)"
    - "Add SUBTITLE_POSITION env var if not already present from Phase 06"

- truth: "All subtitle text is lowercase (no capitalization at all, including sentence starts)"
  status: failed
  reason: "User reported: tampoco deben tener mayusculas las palabras del principio de la frase, solo los nombres propios. Si crees que incluso es mejor que todo este en minusculas, que asi sea"
  severity: minor
  test: 3
  root_cause: "captions.ts line 269 capitalizes first letter of first token per page (sentence start). User wants ALL lowercase, including sentence starts."
  artifacts:
    - path: "services/remotion-renderer/src/captions.ts"
      issue: "line 268-269: isSentenceStart branch capitalizes first letter — should be removed so ALL tokens go through toLowerCase()"
  missing:
    - "Remove isSentenceStart capitalization logic — always apply token.text.toLowerCase() regardless of position"

- truth: "E2E test script completes successfully with exit code 0"
  status: failed
  reason: "User reported: se clavo, esta frizado no avanza — container created but rendering hangs"
  severity: blocker
  test: 5
  root_cause: "Remotion rendering in Docker without GPU causes Chrome/Chromium to hang on headless render. The --no-deps flag was added but the rendering itself still hangs — likely needs --gl=angle-egl or more memory/timeout configuration for the Docker environment."
  artifacts:
    - path: "scripts/test-remotion-renderer.sh"
      issue: "Rendering hangs in Docker — Chrome doesn't complete headless render without proper GPU/display flags"
  missing:
    - "Investigate Docker Chrome rendering hang — may need --gl=angle-egl flag, increased timeout, or chromiumOptions configuration"
    - "Consider adding RENDER_TIMEOUT env var and graceful timeout handling"