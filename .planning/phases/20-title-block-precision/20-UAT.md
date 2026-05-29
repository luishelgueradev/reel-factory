---
status: complete
phase: 20-title-block-precision
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md, 20-04-SUMMARY.md]
started: 2026-05-29T00:00:00Z
updated: 2026-05-29T21:12:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Subtitle Controls Removed
expected: Open the Add/Edit title form in the Studio editor (port 3123). No "Subtitle (optional)" text input, no Subtitle Color picker, no Subtitle Size slider, and no Subtitle Font select should appear anywhere — neither in the form nor in the titles list items.
result: pass

### 2. X/Y Position Inputs Present
expected: In the Add/Edit title form, below Start Time + Duration, there are two side-by-side number inputs labeled "X (px)" and "Y (px)". They should default to X=200, Y=960. The topOffset slider should be gone.
result: pass

### 3. Pixel Positioning Works in Preview
expected: With the Studio running and a title block added, set X=0 and Y=0 — the title block should jump to the top-left corner of the canvas with no centering offset. Set X=540, Y=960 and the block should move to the horizontal/vertical center of the frame (1080×1920).
result: pass

### 4. Border Radius Slider Present and Functional
expected: In the form, there is a "Border Radius" slider (0–50, accent color green #4CAF50) below the Title Size slider. Dragging it to 0 gives sharp corners; dragging to 50 gives a fully rounded pill shape. The live preview should update as you drag.
result: pass

### 5. Title Font Row is Full-Width Single Column
expected: The Title Font family select occupies the full width of the form as a single-column row (no second "Subtitle Font" column next to it).
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Bugs Found and Fixed During UAT

### BUG-1: TitleEditor saved stale deprecated fields on edit
severity: minor
root_cause: handleStartEdit spread `{ ...title.style }` including deprecated fields (subtitleFontSize, subtitleColor, subtitleFontFamily, topOffset) into form state; handleSaveEdit re-saved them unchanged
fix: Rewrote handleStartEdit to do explicit field-by-field pick of only TitleStyleProps-defined fields
file: services/remotion-studio/src/editor/components/TitleEditor.tsx
commit: pending

### BUG-2: GET /api/config and PUT /api/config used divergent file paths
severity: major
root_cause: resolveConfigPath() (used by GET) fell back to services/remotion-studio/pipeline-config.json; PUT always wrote to ACTIVE_PIPELINE_CONFIG_PATH (pipeline/pipeline-config.json). After page reload, users would see stale config and lose all their saved changes.
fix: Updated resolveConfigPath() fallback to return ACTIVE_PIPELINE_CONFIG_PATH when PIPELINE_CONFIG_PATH is not set (and no job-scoped INPUT_PATH)
file: services/remotion-studio/src/server.ts
commit: pending

### BUG-3: Both pipeline-config.json files contained deprecated style fields
severity: minor
root_cause: Config files pre-dated Phase 20 schema migration; no migration was run
fix: Cleaned stale fields (subtitleFontSize, subtitleColor, subtitleFontFamily, topOffset) from both services/remotion-studio/pipeline-config.json and pipeline/pipeline-config.json
commit: pending

## Gaps

[none — all issues found and fixed during UAT]
