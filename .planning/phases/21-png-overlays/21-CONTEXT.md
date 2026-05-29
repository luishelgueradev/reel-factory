# Phase 21: PNG overlays - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add transparent PNG overlay support to the rendered video. Users upload a PNG in the Studio UI, configure position (x/y in pixels on the 1080×1920 frame), display width, and opacity. The overlay appears in the live Remotion Player preview (data URL as `src`) and in the final render (base64 decoded to `public/overlay-N.png` before `bundle()`). The `PngOverlay` Remotion composition renders via `<Img>` + `staticFile()`. `OverlayEditor` UI mirrors `TitleEditor` in structure and style.

**In scope:** `overlays?: PngOverlayConfig[]` schema field in `pipeline-config.ts`; `PngOverlay.tsx` Remotion composition; `OverlayEditor.tsx` studio UI; "Overlays" tab added to `PreviewApp.tsx` after "Titles"; `render.ts` base64 decode + upscale warning; Express JSON body limit raised to 10 MB.

**Out of scope:** Animated fade-in/out for overlays (static opacity only, v1); overlay ordering/z-index controls beyond natural array order; drag-to-place preview interaction (typed x/y inputs, same as Phase 20 title positioning).

</domain>

<decisions>
## Implementation Decisions

### Schema / Multi-overlay (OVERLAY-01)
- **D-01:** Schema uses an **array**: `overlays?: PngOverlayConfig[]`. Symmetric with `titles[]`. Supports stacking a logo + watermark simultaneously.
- **D-02:** **Hard cap of 3 overlays.** The "Add Overlay" button is disabled (background `#555`, cursor `not-allowed`) when `overlays.length >= 3`. No error, just silently disabled.
- **D-03:** `PngOverlayConfig` shape:
  ```typescript
  export interface PngOverlayConfig {
    imageData: string;       // base64 data URL: "data:image/png;base64,..."
    x: number;               // pixel x from left edge of 1080px frame
    y: number;               // pixel y from top edge of 1920px frame
    displayWidth: number;    // CSS display width in pixels (triggers downscale)
    opacity?: number;        // 0–1, default 1
    _resolvedFile?: string;  // runtime-only, set by render.ts, NOT persisted
  }
  ```
  `_resolvedFile` is typed optional on the single interface (not a separate type). `validatePipelineConfig` ignores it (mirrors the `_meta` pattern already in the codebase).

### Downscale / OVERLAY-02
- **D-04:** "Code-side supersampled downscale" means: **supply a large PNG, set CSS `displayWidth` → Chromium's built-in bilinear downsampling handles the rest.** No canvas pre-processing. No `imageRendering: pixelated` toggle. `imageRendering: "auto"` (Chromium default) in the `<Img>` style.
- **D-05:** `render.ts` logs a **`console.warn`** when a decoded PNG's natural width (read via `sizeOf` or estimated from file size) is smaller than `displayWidth` — i.e., the PNG would be upscaled, not downscaled. No error, no block. This is advisory only.
  - **Implementation note:** If reading image dimensions at render time is complex, a simpler heuristic is acceptable: warn when `Buffer.byteLength(base64) < displayWidth * displayWidth * 0.5` (rough size check). Claude's discretion on the exact warning implementation.

### Opacity (OVERLAY-03)
- **D-06:** **Static opacity only for v1.** Opacity slider 0–1 in `OverlayEditor`, no animation. The overlay renders at the configured opacity for the entire video duration. No `enterFrame`/`exitFrame` fields.

### UI / OverlayEditor
- **D-07:** `OverlayEditor.tsx` mirrors `TitleEditor.tsx` exactly in structure, dark-theme inline style palette, and form control patterns.
- **D-08:** Tab placement: `TABS = [{ id: "titles" }, { id: "overlays" }, { id: "subtitles" }, { id: "text" }]` — "Overlays" inserted after "Titles".
- **D-09:** Client-side 5 MB gate: `if (file.size > 5 * 1024 * 1024)` → show inline error before `FileReader` call.
- **D-10:** Express JSON body limit raised to `"10mb"` in `server.ts`.

### Live Preview
- **D-11:** In `PreviewApp.tsx`, the Remotion `<Player>` receives `overlays` as part of `inputProps`. `SubtitledVideo` renders `<PngOverlay>` components for each overlay using the `imageData` (data URL) directly as `src` in the Player context. No `staticFile()` needed in browser preview — `staticFile()` is used only in the render context.

### Claude's Discretion
- Exact warning heuristic in `render.ts` for the upscale check (D-05). A simple `console.warn` with the overlay index and filename is sufficient.
- Visual layout of x/y inputs in `OverlayEditor` (side by side vs. stacked — side by side preferred, matches TitleEditor x/y row from Phase 20).
- Default values for new overlays: `x: 40, y: 40, displayWidth: 200, opacity: 1` (top-left corner, 200px wide, fully opaque). Planner adjusts if needed.
- Whether `imageData` field in the overlay list item shows as "Overlay 1", "Overlay 2", etc. (no filename preserved) or extracts the filename from the file picker. Claude can use "Overlay N" for simplicity.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 21: PNG overlays" — goal + 3 success criteria
- `.planning/REQUIREMENTS.md` §OVERLAY-01 (add PNG overlay), OVERLAY-02 (crisp downscale), OVERLAY-03 (position and size)

### Research & design contract
- `.planning/phases/21-png-overlays/21-RESEARCH.md` — full architecture, patterns, pitfalls (HIGH confidence). Read before planning.
- `.planning/phases/21-png-overlays/21-UI-SPEC.md` — UI design contract: OverlayEditor states, spacing, colors, copywriting, upload zone, tab placement, interaction contract. Non-negotiable.

### Prior phase decisions (building on)
- `.planning/phases/20-title-block-precision/20-CONTEXT.md` — D-03/D-04 (x/y pixel coordinate model, top-left anchor, 1080×1920 frame); TitleEditor x/y input pattern this phase mirrors
- `.planning/phases/19-typography-text-effects/19-CONTEXT.md` — D-10 (renderer-sync rules: which files to copy and how)

### Schema source of truth
- `services/remotion-studio/src/pipeline-config.ts` — `TitleStyleProps`, `TitleConfig`, `DEFAULT_SUBTITLE_CONFIG`; Phase 21 adds `PngOverlayConfig` interface and `overlays?: PngOverlayConfig[]` to `PipelineConfig`

### UI component files (where new controls land)
- `services/remotion-studio/src/editor/components/TitleEditor.tsx` — mirror pattern for `OverlayEditor.tsx` (form structure, inline styles, dark-theme palette)
- `services/remotion-studio/src/preview/PreviewApp.tsx` — `TABS` array + `TabBar` component; add "overlays" tab after "titles"

### Renderer files (where overlays are consumed)
- `services/remotion-studio/src/compositions/TitleOverlay.tsx` — `<Img>`-based composition pattern to mirror for `PngOverlay.tsx`
- `services/remotion-renderer/src/render.ts` — lines 250–263: file-copy-before-bundle() pattern; extend to decode base64 overlays to `public/overlay-N.png`
- `services/remotion-renderer/src/Root.tsx` — add `overlays` to `defaultProps` + `SubtitledVideo` call

### Project conventions (non-negotiable)
- `AGENTS.md` §"UI/frontend work — REQUIRED tooling" — `impeccable` + `frontend-design` MUST be invoked at start of plan/execute
- `AGENTS.md` §"Development Conventions" — renderer-sync pattern (cp compositions/ + shared modules)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`TitleEditor.tsx`** — complete mirror template for `OverlayEditor.tsx`: list-of-items UI, add/edit/delete pattern, dark inline styles, x/y number inputs (from Phase 20), form card with green border when active
- **`TitleOverlay.tsx`** — Remotion composition using `<Img>` + `AbsoluteFill` + pixel-coordinate positioning; `PngOverlay.tsx` mirrors this exactly
- **`render.ts` lines 250–263** — copy-file-to-public-before-bundle() pattern; base64 PNG decode is a direct extension
- **`pipeline-config.ts`** — `TitleConfig`/`TitleStyleProps` schema extension pattern; `PngOverlayConfig` follows the same shape

### Established Patterns
- **Pixel coordinate CSS transform:** `left: ${(x / 1080) * 100}%`, `top: ${(y / 1920) * 100}%` for proportional display in the Player (Phase 20 D-04); use same in `PngOverlay` for live preview
- **`<Img>` from `remotion` (NOT `<img>`)** — mandatory inside any Remotion composition; handles `delayRender`/`continueRender` automatically
- **`staticFile("overlay-N.png")`** — used in render context only; in Player context use `imageData` (data URL) directly as `src`
- **Renderer sync after any composition change:** `cp services/remotion-studio/src/compositions/* services/remotion-renderer/src/compositions/` + sync shared modules (Phase 19 D-10)

### Integration Points
- `SubtitledVideo.tsx` (both studio + renderer Root.tsx) — receives `overlays?: PngOverlayConfig[]` prop; renders `{overlays?.map((ov, i) => <PngOverlay key={i} overlay={ov} />)}`
- `PreviewApp.tsx` — new "Overlays" tab renders `<OverlayEditor>`; passes `overlays` state into `<Player inputProps={{ ...existing, overlays }}`
- `server.ts` — JSON body limit must be raised to `"10mb"` (currently default 1 MB); otherwise large base64 payloads are silently rejected by Express

</code_context>

<specifics>
## Specific Ideas

- **OVERLAY-02 "crisp" interpretation confirmed:** user supply a large PNG → CSS `displayWidth` forces Chromium bilinear downscale → output is crisp. No canvas pipeline needed. The "supersampled" quality comes from having more source pixels than the display target (same concept as Phase 14 scale:2, but applied at the individual image level).
- **Upscale warning:** `render.ts` should log a `console.warn` when the decoded PNG is likely being upscaled (smaller than `displayWidth`). Non-blocking.

</specifics>

<deferred>
## Deferred Ideas

- **Animated overlay** (fade-in/out, timed appearance): Static opacity chosen for v1. Add `enterFrame`/`exitFrame` animation in a future phase if needed.
- **User-selectable imageRendering mode** (`pixelated` vs `auto`): Not added in v1. Chromium bilinear (`auto`) is the default and sufficient for logos/watermarks.
- **Overlay drag-to-place** on the preview: Deferred — same rationale as Phase 20 title positioning. Typed x/y inputs only for now.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-png-overlays*
*Context gathered: 2026-05-29*
