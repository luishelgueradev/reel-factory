# Phase 21: PNG overlays - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 21-png-overlays
**Areas discussed:** Multi vs. single overlay, Downscale crispness (OVERLAY-02), Opacity: static or animated

---

## Multi vs. single overlay

**Question 1:** How many PNG overlays should the system support per video?

| Option | Description | Selected |
|--------|-------------|----------|
| Array from day 1 | `overlays?: PngOverlayConfig[]`. List UI (add/edit/delete), mirrors TitleEditor. Supports stacking logo + watermark. | ✓ |
| Single overlay only | `overlay?: PngOverlayConfig` (not array). One upload slot — replace, not add. Simpler. | |
| Single now, array-ready schema | Array schema, but UI exposes only one slot. Backend-ready, UI-simple. | |

**User's choice:** Array from day 1
**Notes:** None

---

**Question 2:** Should there be a cap on number of overlays per video?

| Option | Description | Selected |
|--------|-------------|----------|
| No cap | Renderer handles however many are in the array. | |
| Cap at 3 | "Add Overlay" button disabled after 3. Keeps UI clean, prevents oversized config. | ✓ |
| Cap at 5 | Generous but bounded. Same disable-button approach. | |

**User's choice:** Cap at 3
**Notes:** None

---

## Downscale crispness (OVERLAY-02)

**Question 1:** What does "code-side supersampled downscale" mean for PNG overlays?

| Option | Description | Selected |
|--------|-------------|----------|
| CSS displayWidth + Chromium bilinear | Supply large PNG, set CSS displayWidth → Chromium bilinear does the rest. No canvas. | ✓ |
| Canvas pre-processing | Draw PNG to canvas at display size before Remotion. More code, more control. | |
| User sharpness mode toggle | imageRendering field: 'auto' (bilinear) vs 'pixelated' (hard edges). | |

**User's choice:** CSS displayWidth constraint + Chromium bilinear
**Notes:** Confirmed this is the correct interpretation of OVERLAY-02. Phase 14 scale:2 was for the whole render canvas; this is per-image CSS downscaling.

---

**Question 2:** Should render.ts warn when a PNG is smaller than its displayWidth?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — log a warning | console.warn with overlay index + filename. Non-blocking. | ✓ |
| No warning — silently upscale | User's responsibility to supply a large enough PNG. | |
| You decide | Claude picks the approach. | |

**User's choice:** Yes — log a warning
**Notes:** Non-blocking advisory only.

---

## Opacity: static or animated

**Question 1:** Should PNG overlay opacity be static or animated?

| Option | Description | Selected |
|--------|-------------|----------|
| Static opacity only | 0–1 slider, no animation. Overlay at that opacity for entire video. | ✓ |
| Animated fade-in/out like TitleOverlay | enterFrame/exitFrame-based fade. For overlays that appear/disappear during video. | |
| Static now, fields reserved for animation | Static v1 + optional enterFrame/exitFrame fields unused. Schema-forward. | |

**User's choice:** Static opacity only
**Notes:** OVERLAY-03 says "positioned and sized" — no animation in requirement. Simple and correct for v1 logos/watermarks.

---

## Claude's Discretion

- Exact upscale warning heuristic in `render.ts` (D-05) — a simple `console.warn` with overlay index and filename is sufficient
- Visual layout of x/y inputs in `OverlayEditor` (side by side preferred, matching TitleEditor x/y row pattern from Phase 20)
- Default values for new overlays: `x: 40, y: 40, displayWidth: 200, opacity: 1`
- Whether overlay list items show as "Overlay 1" / "Overlay 2" or preserve the uploaded filename

## Deferred Ideas

- **Animated overlay** (fade-in/out, timed appearance): static opacity chosen for v1
- **imageRendering mode toggle** (`pixelated` vs `auto`): not in v1, Chromium bilinear is sufficient
- **Drag-to-place** on preview: same rationale as Phase 20 title positioning
