# Phase 19: Typography & text effects - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 19-typography-text-effects
**Areas discussed:** Glow effect design, Bold / italic scope, Font size ceiling, Plus Jakarta Sans as default

---

## Glow Effect Design

### Schema approach

| Option | Description | Selected |
|--------|-------------|----------|
| New OuterGlow field | Separate `outerGlow: { enabled, color, intensity, softness }` in SubtitleConfig and TitleStyleProps | ✓ |
| Extend existing TextShadow | Reuse textShadow with 0 offset + add intensity count field | |
| Both can coexist | Keep textShadow for directional shadows, add outerGlow for no-offset glow | |

**User's choice:** New OuterGlow field (clean separation from directional text-shadow)

### Intensity model

| Option | Description | Selected |
|--------|-------------|----------|
| Blur radius only | Single `blur` field — intensity is just a larger blur value | |
| Stacked layers | `intensity` = repetition count (1–5 stacked shadows), `softness` = per-layer blur | |
| Opacity-based | `intensity` = alpha (0–1) applied to glow color; `softness` = blur radius | ✓ |

**User's choice:** Opacity-based — intensity controls rgba alpha of the glow color

### Glow scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both subtitles and titles | outerGlow in SubtitleConfig AND TitleStyleProps | ✓ |
| Subtitles only | Add to SubtitleConfig only | |
| Titles only | Add to TitleStyleProps only | |

**User's choice:** Both

---

## Bold / Italic Scope

### fontWeight control type

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle (400 / 700) | Checkbox/switch: off = regular, on = bold | ✓ |
| Weight slider (100–900) | Granular slider — most Google Fonts only ship 400/700 | |

**User's choice:** Toggle (400/700)

### Bold/italic coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Both subtitles and titles | fontWeight + fontStyle in SubtitleConfig AND TitleStyleProps | ✓ |
| Subtitles only | Only SubtitleConfig | |
| Titles only | Only TitleStyleProps | |

**User's choice:** Both

---

## Font Size Ceiling

### New upper bound

| Option | Description | Selected |
|--------|-------------|----------|
| 200px | Doubles current ceiling (120px) | ✓ |
| 300px | Extreme close-up caption style | |
| No enforced cap | Free number input, any value | |

**User's choice:** 200px

### Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Both subtitles and titles | Extend slider for both StyleControls and TitleEditor | ✓ |
| Subtitles only | Only StyleControls range extended | |
| Titles only | Only TitleEditor range extended | |

**User's choice:** Both

---

## Plus Jakarta Sans as Default

| Option | Description | Selected |
|--------|-------------|----------|
| Add to list + make new default | Import, add to AVAILABLE_FONTS, set as DEFAULT_SUBTITLE_CONFIG fontFamily | ✓ |
| Add to list only | Import and add, keep Inter as default | |
| Add as featured first entry | Position 0 in AVAILABLE_FONTS, don't change runtime default | |

**User's choice:** Add to list + make it the new default (replaces Inter)

---

## Claude's Discretion

- Exact UI control layout for bold/italic toggles, glow color picker, and softness/intensity sliders within Subtitles and Titles tabs — to be decided under `impeccable` + `frontend-design` guidance
- Whether `outerGlow` renders as a single CSS `text-shadow` layer or multiple stacked layers at high intensity
- Default values for `outerGlow` (suggested: enabled=false, color="#ffffff", intensity=0.8, softness=20)

## Deferred Ideas

None — discussion stayed within Phase 19 scope.
