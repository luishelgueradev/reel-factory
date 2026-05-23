---
plan: "16-02"
phase: "16-render-config-flicker"
status: complete
completed: 2026-05-23
---

# Plan 16-02: Human Checkpoint — Config Load Verification

## What was done

Task 1 (automated): Verified Plan 16-01 artifacts in place, started the studio locally on port 3123,
PUT bar-layout config to ACTIVE_PIPELINE_CONFIG_PATH. Confirmed pipeline/pipeline-config.json
created with "layout": "bar" and no "_meta" key.

Task 2 (checkpoint): Ran a real /process render and confirmed the studio config threaded through
end-to-end into the renderer.

## Job used

`6b555e18-323b-4542-81ba-c91fc1f7fee7`

## remotion-info.json pipeline_config section (verbatim)

```json
"pipeline_config": {
    "loaded": true,
    "source": "/data/pipeline/6b555e18-323b-4542-81ba-c91fc1f7fee7/remotion-renderer/pipeline-config.json",
    "subtitle_layout": "bar",
    "subtitle_position": "bottom-center",
    "titles_count": 0
}
```

## Flicker observation

**Flicker present** — highlighted (active) words blink very fast between caption page transitions.
Blank inter-page gaps visible on the bar layout. Issue B confirmed present and requires the
durationInFrames fix in Plan 16-03.

## Resume signal

`approved: loaded=true, flicker=present`

## Key findings

- Issue A fix (Plan 16-01) is confirmed working end-to-end: the seeding path
  ACTIVE_PIPELINE_CONFIG_PATH → process.ts copyFileSync → remotion-renderer → loaded=true
- Issue B (subtitle flicker) is confirmed present on the correct bar layout
- Style note: the rendered config matches what was PUTted in Task 1 (activeColor:#FFFFFF,
  inactiveColor:#888888); user may want to reconfigure studio style after Phase 16

## Self-Check: PASSED
