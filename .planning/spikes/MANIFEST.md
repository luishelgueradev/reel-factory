# Spike Manifest

## Idea
Make reel-factory's rendered fonts and Remotion elements (subtitles, titles, overlays) as crisp as professional reels (CapCut/internet). Phase 14 bet on scale:2 supersampling; the user perceives no real gain. Find empirically what actually drives text crispness.

## Requirements
Design decisions emerging from spikes (non-negotiable for the real build):

- Subtitle crispness is bounded by the 1080×1920 delivery resolution; supersampling above 1× gives no perceptible benefit for bold high-contrast white captions (Spike 001).
- The real crispness lever is **styling weight** (bigger/bolder/thicker stroke), not render resolution or H.264 CRF.
- Colored elements (titles, green highlight) benefit from yuv444p over yuv420p — modestly.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | font-rendering-sharpness | comparison | What makes subtitle/title text as crisp as pro reels — resolution, encode, or styling? | VALIDATED | remotion, rendering, encoding, subtitles, supersampling, phase-14 |
