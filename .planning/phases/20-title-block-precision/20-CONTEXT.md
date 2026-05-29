# Phase 20: Title block precision - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade title blocks with three precision improvements: (1) replace percentage-based `topOffset` with pixel `x/y` coordinates referencing the 1080×1920 render frame; (2) make `borderRadius` a configurable field (currently hardcoded at 12px); (3) remove the `subtitle` field from `TitleConfig` and `TitleStyleProps` entirely — a subtitle is simply a second title block.

**In scope:** `x`/`y` pixel fields in `TitleStyleProps`; remove `topOffset`; add `borderRadius?: number` to `TitleStyleProps`; remove `subtitle`, `subtitleFontSize`, `subtitleColor`, `subtitleFontFamily` from `TitleConfig` + `TitleStyleProps` + `TitleOverlay.tsx`; typed number inputs for x/y in `TitleEditor`; border-radius slider in `TitleEditor`; renderer synced.

**Out of scope:** Drag-to-place on preview (deferred); design-token system (deferred Phase 18 D-07); functional render-video button (still disabled per Phase 18 D-05); PNG overlays (Phase 21).

</domain>

<decisions>
## Implementation Decisions

### Positioning UX (TITLE-01)
- **D-01:** Positioning input is **typed number fields only** — two inputs in `TitleEditor`: `X (px)` and `Y (px)`. No drag-to-place interaction on the preview.
- **D-02:** X input range: **0–1080**. Y input range: **0–1920**. Full frame coverage, no artificial safe-zone constraints.

### Coordinate model (TITLE-01)
- **D-03:** x/y pixel coordinates map to the **1080×1920 render frame** (the actual output resolution). The studio preview scales these proportionally for display — pixel-perfect in renders.
- **D-04:** Anchor point is the **top-left corner** of the title block. x=0, y=0 places the top-left corner of the block at the top-left of the frame. CSS: `left: ${(x/1080)*100}%`, `top: ${(y/1920)*100}%` (no center transform).

### topOffset migration
- **D-05:** **Clean break** — remove `topOffset` from `TitleStyleProps`; add `x?: number` and `y?: number` instead. No backward-compat dual-path. Existing saved configs that have `topOffset` will lose their positioning (defaults apply on load).
- **D-06:** Default values for new title blocks: **x: 200, y: 960** (horizontally inset, vertically centered).

### Subtitle removal (TITLE-03)
- **D-07:** **Full schema removal** — remove `subtitle?: string` from `TitleConfig`; remove subtitle rendering from `TitleOverlay.tsx`; remove the subtitle input from `TitleEditor`. No migration. Existing saved configs with a `subtitle` value silently lose it.
- **D-08:** Also remove the subtitle-only styling fields from `TitleStyleProps`: `subtitleFontSize`, `subtitleColor`, `subtitleFontFamily` — they have no purpose once subtitle is gone. Remove corresponding controls from `TitleEditor`.

### Border-radius (TITLE-02)
- **D-09:** Add `borderRadius?: number` to `TitleStyleProps`. The currently hardcoded value of `12` becomes the default. Slider range and control layout decided under `impeccable` + `frontend-design` guidance at plan time.

### Claude's Discretion
- Slider range for `borderRadius` input (suggested: 0–50px, with 12 as default matching current hardcoded value).
- Whether to label the inputs "X" / "Y" or "Left offset" / "Top offset" for clarity.
- Visual layout of the two coordinate inputs in `TitleEditor` (side by side vs stacked).
- Default values for `borderRadius` if not present in an existing config (12px recommended to match prior hardcoded behavior).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 20: Title block precision" — goal + 3 success criteria (TITLE-01, TITLE-02, TITLE-03)
- `.planning/REQUIREMENTS.md` — TITLE-01 (pixel-coordinate positioning), TITLE-02 (configurable border-radius), TITLE-03 (no subtitle field; subtitle = separate title block)

### Prior phase decisions (building on)
- `.planning/phases/18-studio-ui-redesign/18-CONTEXT.md` — D-08 (Titles tab built for extension), D-09 (in-memory live edit + manual Save), D-05 (render-video button stays disabled)
- `.planning/phases/19-typography-text-effects/19-CONTEXT.md` — D-10 (renderer-sync rules); existing `TitleStyleProps` schema after Phase 19

### Schema source of truth
- `services/remotion-studio/src/pipeline-config.ts` — `TitleStyleProps`, `TitleConfig`, `DEFAULT_SUBTITLE_CONFIG`; Phase 20 removes `topOffset`, `subtitle`, `subtitleFontSize`, `subtitleColor`, `subtitleFontFamily`; adds `x`, `y`, `borderRadius`

### UI files (where controls land)
- `services/remotion-studio/src/editor/components/TitleEditor.tsx` — remove subtitle input + subtitle style controls; replace topOffset slider with x/y number inputs; add borderRadius slider

### Renderer composition files (where fields are consumed)
- `services/remotion-studio/src/compositions/TitleOverlay.tsx` — remove subtitle rendering; replace `top: ${topOffset}%` + center transform with `left: ${(x/1080)*100}%`, `top: ${(y/1920)*100}%`; replace hardcoded `borderRadius: "12px"` with config-driven value
- Sync target: `services/remotion-renderer/src/compositions/TitleOverlay.tsx` (must be copied after studio changes)

### Project conventions (non-negotiable)
- `AGENTS.md` §"UI/frontend work — REQUIRED tooling" — `impeccable` + `frontend-design` must be invoked at start of plan/execute
- `AGENTS.md` §"Development Conventions" — renderer-sync pattern; studio port 3123

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`TitleEditor.tsx` input pattern** — existing `topOffset` slider, `titleFontSize` inputs follow the dark-theme inline style pattern (`#1a1a2e` bg, `#bbb` labels); x/y number inputs should match this exactly.
- **`DEFAULT_TITLE_STYLE` in `TitleEditor.tsx`** — currently sets `topOffset: 50`; replace with `x: 200, y: 960`.
- **`TitleStyleProps` in `pipeline-config.ts`** — currently has `topOffset?: number` (line ~82); Phase 20 removes it and adds `x?: number`, `y?: number`, `borderRadius?: number`.

### Established Patterns
- **In-memory live edit + manual PUT save** — new x/y and borderRadius controls follow this: change fires `onChange(partial)`, persists only on Save (Phase 18 D-09).
- **Coordinate conversion for preview** — `left: ${(x/1080)*100}%`, `top: ${(y/1920)*100}%` converts pixel coordinates to CSS percentages relative to the AbsoluteFill container (which is always the video resolution in both studio and renderer).
- **`AbsoluteFill` in `TitleOverlay.tsx`** — the wrapper is already absolute-positioned to fill the frame; child `div` with `position: "absolute"` + `left/top` percentages is the existing pattern.

### Integration Points
- `TitleConfig.subtitle` field: currently referenced in `TitleOverlay.tsx` (props, style derivation, render), `TitleEditor.tsx` (form inputs, add/edit handlers, list display), and `pipeline-config.ts` (schema). All three must be updated atomically.
- `topOffset` field: referenced in `TitleOverlay.tsx` (line ~71: `const topOffset = ...`; line ~202: `top: \`${topOffset}%\``), `TitleEditor.tsx` (DEFAULT_TITLE_STYLE, slider), and `pipeline-config.ts` (TitleStyleProps). All three must be updated atomically.
- After `TitleOverlay.tsx` is updated in remotion-studio, copy to remotion-renderer per AGENTS.md renderer-sync rules.

</code_context>

<specifics>
## Specific Ideas

- "Pixel positioning" is a precision feature — the x/y inputs should show the current value clearly (not just a slider). Number inputs with step=1 and the px unit visible in the label are preferred over sliders for this use case.
- The subtitle removal is a clean break by design: the concept "subtitle = separate title block" means users achieve the same result by adding a second entry in the titles array with its own position/style. No migration needed.

</specifics>

<deferred>
## Deferred Ideas

- **Drag-to-place on preview** — placing title blocks by dragging them on the video preview. Came up as an option during Positioning UX discussion; user chose typed inputs for now. Could be a future enhancement.

</deferred>

---

*Phase: 20-title-block-precision*
*Context gathered: 2026-05-29*
