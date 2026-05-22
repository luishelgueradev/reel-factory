---
spike: 001
name: font-rendering-sharpness
type: comparison
validates: "Given the bar-layout subtitles + Remotion title overlays, when rendered at different scales/encodes, then which combination makes text as crisp as professional reels (CapCut)?"
verdict: VALIDATED
related: []
tags: [remotion, rendering, encoding, subtitles, supersampling, phase-14]
---

# Spike 001: Font / Element Rendering Sharpness

## What This Validates
The user perceives that **rendered fonts and Remotion elements** (subtitles, titles, overlays) look soft compared to professional reels (CapCut), independent of the video footage. Phase 14's scale:2 supersampling didn't visibly help. This spike finds — empirically — what actually drives text crispness, and whether the supersampling is worth its ~36-min render cost.

Source clip for all variants: `VID_20260518_114955` (~16.5s talking-head), same studio config (bar layout, Inter, fontSize 60, outlineWidth 5, green highlight, "Inboxer"/"WhatsApp" titles). Compared ONLY the subtitle/title text — not the video footage.

## Variants tested

| Variant | Render | Encode | Notes |
|---------|--------|--------|-------|
| A | scale:1 → 1080×1920 direct | CRF18 yuv420p | render ~6.3 min |
| B | scale:1.333 → 1440 → 1080 | — | **FAILED**: Remotion requires integer frame dims; 1.333×1920=2559.36 non-integer. Use scale:1.5 (1620×2880) instead. |
| C | scale:2 → 2160×3840 → Lanczos 1080 | CRF18 yuv420p | the Phase 14 production path. render ~36 min |
| D | C's 2160 render → Lanczos 1080 + light unsharp | CRF18 yuv420p | re-encode only |
| E | C's 2160 render → Lanczos 1080 | **CRF12** yuv420p | high-quality encode |
| F | C's 2160 render → Lanczos 1080 | CRF14 **yuv444p** | no chroma subsampling |

## Research / code investigation (the user's suspicion: not Remotion, but styling+encode)

**1. CSS / styling — GOOD already. NOT the bottleneck.** `BarLayout.tsx` BarWord:
- `fontWeight: 700` (bold ✓ — matches "use Inter Bold")
- NO `text-shadow` (uses a dark background bar for contrast instead — no blur ✓)
- NO CSS `transform` / fractional scale ✓
- `letterSpacing: -0.02em` default (config=0) — not wide tracking ✓
- `WebkitTextStroke` + `paintOrder: "stroke fill"` (stroke under fill — correct, edges stay crisp ✓)
The user's styling recommendations (bold, not thin, not wide-tracked, soft dark stroke, no heavy shadow) are essentially already implemented.

**2. Chromium flags — a real (minor) bug.** `render.ts:337-340` passes:
```ts
chromiumOptions: { enableMultiProcessOnLinux: true, args: ['--gl=angle-egl', '--disable-gpu'] }
```
`args` is NOT a valid Remotion `ChromiumOptions` field (it's the source of a known TS error). So those GL flags are **silently ignored** — Remotion uses its default GL backend. Not the sharpness driver, but should be fixed to `gl: 'angle-egl'` for correctness/determinism.

**3. Encode — double H.264 (renderer CRF18 yuv420p @2160, then finalizer CRF18 yuv420p @1080).** Hypothesis was that CRF/chroma softens text. Tested below.

## Results — head-to-head (native-resolution subtitle crops)

**WHITE subtitle text ("de prueba de 10") — the headline finding:**

| Comparison | Result |
|------------|--------|
| A (scale:1) vs C (scale:2) | **Identical.** Supersampling gives ZERO perceptible benefit for the white subtitle. scale:1 = 6 min, scale:2 = 36 min for the same result. |
| C (CRF18) vs E (CRF12) | Identical. CRF doesn't matter for high-contrast white text. |
| C (yuv420) vs F (yuv444) | Identical for white text. |
| C vs D (unsharp) | D marginally punchier (mostly on the video/midtones), slight halo risk. Minor. |

→ **White, high-contrast, bold text on a dark bar is already near-optimal at 1080.** It's max-luma, so chroma subsampling can't touch it, and the contrast survives H.264 CRF18. This is exactly why the user felt "no se está haciendo ningún trabajo" — for the subtitles, the supersampling literally does nothing visible.

**COLORED text (yellow "WhatsApp" title) — where chroma DOES matter:**

| Comparison | Result |
|------------|--------|
| C (yuv420) vs F (yuv444) | F's colored-text edges are **marginally cleaner**. yuv420 chroma subsampling softens saturated-color edges (yellow titles, green #4dff00 highlight) — real but modest at this size/weight. |

## Conclusion — why his text looks softer than CapCut

It is **NOT** resolution (scale:1 = scale:2), **NOT** the H.264 CRF (12 = 18 for text), and **NOT** the CSS (already bold/clean). The text is genuinely crisp at 1080.

The gap vs CapCut is almost certainly **styling aggressiveness** + a minor chroma effect:
1. **Pro reels are visually "fatter"** — bigger text relative to frame, thicker/higher-contrast strokes, sometimes glow. The current fontSize 60 + 5px stroke is more *conservative* than CapCut defaults. The user's own intuition ("exageradamente gordos") is the real lever.
2. **Colored elements** (yellow/red titles, green highlight) lose a little edge crispness to yuv420 — fixable with yuv444 on the final encode.

## Recommendations (cost vs benefit, ordered)

1. **Drop scale:2 for subtitles → scale:1 (or 1.5 max).** ~30 min/render saved for zero white-text loss. The single biggest win. Keep scale:1.5 only if motion-aliasing on thin/animated graphics proves to matter (untested here — stills can't show motion shimmer).
2. **Styling pass in studio (the real crispness lever):** bigger fontSize, thicker stroke, optional subtle glow/shadow — make it "fatter" like CapCut. This is what will actually close the gap.
3. **Final encode → yuv444p** (or yuv422p) if the delivery target allows — marginally crisper colored titles/highlights. Caveat: Instagram/TikTok re-encode to yuv420p anyway, so the gain may not survive upload.
4. **Optional light unsharp** (`unsharp=5:5:0.4`) on the final encode for overall punch — modest, watch for halos.
5. **Fix `chromiumOptions`** — replace the ignored `args:[...]` with `gl: 'angle-egl'`. Housekeeping.

**Bottom line:** Phase 14's supersampling is the wrong lever for crisp subtitles. The deliverable is 1080-bounded and bold white text is already optimal there. Spend the effort on **styling weight** + **yuv444 colored text**, not render resolution.

## Artifacts
- Variant outputs: `outputs/{D-sharpen,E-crf12,F-yuv444}.mp4`; A = `pipeline/spike001-A/quality-finalizer/output.mp4`; C = `pipeline/e2e-phase14/quality-finalizer/output.mp4`
- Comparison crops: `frames/T-{A,C,D,E,F}-*.jpg` (white subtitle), `frames/Y-{C,F}-*.jpg` (yellow title)
- Scripts: `render-variants.sh`

## Investigation Trail
- Read render.ts chromium block → found `args` silently ignored.
- Read BarLayout.tsx + confirmed CSS is already sharpness-friendly (bold, no shadow/transform).
- Extracted native-res crops; discovered white text is encode/scale-invariant.
- Isolated chroma effect on colored title (yuv420 vs yuv444): real but modest.
- Variant B (1.333x) failed on non-integer dims → documented; scale:1.5 is the clean alternative.
