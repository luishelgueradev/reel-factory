---
phase: 22-studio-ui-polish
reviewed: 2026-06-03T11:14:19Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - services/remotion-renderer/src/Root.tsx
  - services/remotion-renderer/src/pipeline-config.ts
  - services/remotion-renderer/src/pipeline-config.test.ts
  - services/remotion-studio/src/SubtitledVideo.tsx
  - services/remotion-studio/src/pipeline-config.ts
  - services/remotion-studio/src/preview/PreviewApp.tsx
  - services/remotion-studio/src/preview/TextareaInput.tsx
  - services/remotion-studio/src/editor/components/PositionPresets.tsx
  - services/remotion-studio/src/editor/components/PositionPresets.test.ts
  - services/remotion-studio/src/editor/components/StyleControls.tsx
  - services/remotion-studio/src/editor/components/TitleEditor.tsx
  - services/remotion-studio/src/editor/components/OverlayEditor.tsx
  - services/remotion-studio/src/editor/index.html
  - services/remotion-studio/vitest.config.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: resolved
resolution:
  resolved: 2026-06-03
  fixed: [CR-01, WR-01, WR-02, WR-03, WR-04]
  deferred: [WR-05]
  untouched_info: [3 Info findings — out of --fix scope]
  note: "CR-01/WR-01..04 fixed in commits 3dc5bf3, 4523384, f2a3823, f9d01cd, 3a427cd. WR-05 (preview-dim opacity undershoot) skipped — intentional studio-only legibility behavior; a fix would change product behavior. Post-fix: renderer 304/304, studio 135/135, build exit 0."
---

# Phase 22: Code Review Report

**Reviewed:** 2026-06-03T11:14:19Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the Studio UI polish phase with focus on the overlay back/front layering parity (studio `SubtitledVideo.tsx` vs renderer `Root.tsx`), the `PngOverlayConfig.layer` validator, size-aware `PositionPresets` math, the subtitle enum-mode migration, React state/prop correctness, and the single-green / blue-selection color law.

**Good news:** The core deliverables are mostly sound. The back/front paint order is correctly mirrored between both compositions (back → subtitles → titles → front). The `layer` validator correctly rejects out-of-enum strings *and* wrong types (tests 12/13). The subtitle enum-mode migration writes through the existing `onChange({ position })` path with no regression, and `computePresetXY` math is correct and integer-rounded. State handling for the title/overlay edit-while-delete index shift is correct in both editors.

**Concerns:** One BLOCKER — the renderer passes a non-existent `subtitle` prop to `TitleOverlay`, which is both a type error and a real studio/renderer parity divergence. Five warnings cover an un-clamped off-frame coordinate path, a color-law violation in the font cards, a misleading-and-incomplete test for the enum-mode migration, a preview-dim asymmetry, and a missing renderer-side test for the new layer split. (Note: several findings are pre-existing but live in files this phase rewrote and that the phase's own color-law / parity goals were meant to enforce.)

## Critical Issues

### CR-01: Renderer passes non-existent `subtitle` prop to `TitleOverlay` — type error + studio/renderer parity break

**File:** `services/remotion-renderer/src/Root.tsx:123`
**Issue:** The renderer's `SubtitledVideo` renders:
```tsx
<TitleOverlay
  text={title.text}
  subtitle={title.subtitle}   // ← line 123
  style={title.style}
  durationMs={title.durationMs}
  fontFamily={config.fontFamily}
/>
```
But:
- `TitleConfig` (renderer `pipeline-config.ts:90-95`) has **no** `subtitle` field — so `title.subtitle` is `undefined` and a TS error (`Property 'subtitle' does not exist on type 'TitleConfig'`).
- `TitleOverlayProps` (`compositions/TitleOverlay.tsx:19-23`) declares only `text`, `style`, `durationMs`, `fontFamily` — there is **no** `subtitle` prop, so this is a second TS error (`Property 'subtitle' does not exist on type ... IntrinsicAttributes & TitleOverlayProps`).
- The studio `SubtitledVideo.tsx:114-120` correctly does **not** pass `subtitle`.

This is precisely the studio↔renderer mirror divergence the phase is supposed to guard. It is pre-existing (introduced in commit 6c0c5d6, predating Phase 20's `subtitle` removal noted in the `TitleOverlay` header "subtitle removal (D-07)"), but it now contradicts both the type contract and the studio composition. If the renderer is type-checked in CI it fails the build; if it is rendered via Babel/SWC without typecheck it silently passes a dead prop. Either way the two compositions are no longer identical.
**Fix:** Remove the dead prop so the renderer mirrors the studio:
```tsx
<TitleOverlay
  text={title.text}
  style={title.style}
  durationMs={title.durationMs}
  fontFamily={config.fontFamily}
/>
```

## Warnings

### WR-01: `computePresetXY` produces off-frame negative coordinates for large titles — no clamping

**File:** `services/remotion-studio/src/editor/components/PositionPresets.tsx:53-76`; consumer `services/remotion-studio/src/editor/components/TitleEditor.tsx:394-398`
**Issue:** `computePresetXY` computes `right/bottom = round(frame - element)` with no lower clamp. TitleEditor estimates the element box as
`elementWidth = titleFontSize * 6 + padding * 2`. With the slider maxima (`titleFontSize=200`, `padding=100`) that is `1200 + 200 = 1400 > 1080`. A right/bottom preset click then writes `x = 1080 - 1400 = -320` (and similarly negative `y`) straight into `style.x`/`style.y` via `onApply` — bypassing the number input's `min={0}`. Downstream, `validatePipelineConfig` rejects `style.x < 0` (`pipeline-config.ts:418`), so a user who positions a large title with a preset then hits Save gets a validation failure with no clear cause; in the live preview the title is pushed partially off-frame. The width estimate (`*6` chars) is also a heuristic that diverges from the real rendered box, compounding the drift.
**Fix:** Clamp in the math helper so a preset can never produce an off-frame anchor:
```ts
const x = Math.max(0, anchorX === "left" ? 0
  : anchorX === "center" ? Math.round((frameWidth - elementWidth) / 2)
  : Math.round(frameWidth - elementWidth));
const y = Math.max(0, anchorY === "top" ? 0
  : anchorY === "center" ? Math.round((frameHeight - elementHeight) / 2)
  : Math.round(frameHeight - elementHeight));
```
(Overlays are safe: `elementWidth = displayWidth ≤ 1080`, so `1080 - displayWidth ≥ 0`. Only the title estimate overflows.)

### WR-02: Color-law violation — font cards use green for hover (selections must be blue, green is the single Render CTA)

**File:** `services/remotion-studio/src/preview/PreviewApp.tsx:132,138`
**Issue:** The phase's locked color law is "single green action (Render Video); all selection/hover affordances blue." `FontCard` hover uses green:
```tsx
background: hovered ? "rgba(76, 175, 80, 0.08)" : "#1e1e2e",   // green tint
border: isSelected ? "2px solid #90caf9"
  : hovered ? "1px solid #4CAF50"   // green border on hover
  : "1px solid #333",
```
Selection is correctly blue (`#90caf9`), but the green hover state is a second non-action green surface in the Subtítulos tab — exactly what the color-law pass was meant to eliminate. The values are also hardcoded hex (`#4CAF50`, `#90caf9`, `#333`) instead of the `--action`/`--accent`/`--border` tokens used everywhere else in this phase. Pre-existing, but it lives in the tab this phase reorganized and slipped through the color-law sweep.
**Fix:** Replace the green hover with the blue accent tokens and tokenize:
```tsx
background: hovered ? "var(--accent-tint-2, rgba(144,202,249,0.06))" : "var(--surface, #1e1e2e)",
border: isSelected ? "2px solid var(--accent, #90caf9)"
  : hovered ? "1px solid var(--accent-strong, #6ba8e0)"
  : "1px solid var(--border, #333)",
```

### WR-03: PositionPresets test claims enum-mode coverage but only tests the pure math helper

**File:** `services/remotion-studio/src/editor/components/PositionPresets.test.ts:2-3,10-41`
**Issue:** The file header asserts "Pure math helper **and enum-mode click mapping**," but the suite contains only `computePresetXY` math assertions. There is **no** test for: (a) enum-mode `anchorToValue` → `onApplyAnchor(value)` mapping, (b) enum-mode disabled cells (the 6 unmapped cells), (c) the active-cell selection in enum vs px mode, or (d) the off-frame negative-coordinate case from WR-01. The subtitle position selector was migrated to this exact enum mode this phase ("no regression" is a stated goal), yet the migration path is entirely untested. The header comment is therefore both misleading and a coverage gap.
**Fix:** Either correct the header to "Pure math helper only," or — preferred — add enum-mode tests. Example for the mapping (extract the click logic or render with a testing-library, whichever the suite supports):
```ts
it("enum mode: clicking the center-bottom cell emits bottom-center", () => {
  const onApplyAnchor = vi.fn();
  // render <PositionPresets mode="enum" anchorToValue={{ "center-bottom": "bottom-center" }} onApplyAnchor={...}/>
  // click the "Posición abajo-centro" button → expect onApplyAnchor("bottom-center")
});
it("computePresetXY does not return negative coords for oversized elements", () => {
  expect(computePresetXY("right", "bottom", 1400, 2200).x).toBeGreaterThanOrEqual(0);
});
```

### WR-04: Renderer has no test for the new back/front overlay split (layer banding)

**File:** `services/remotion-renderer/src/Root.tsx:95-96,110-112,134-136` (no covering test)
**Issue:** This phase's central renderer change is the `back`/`front` filter (`overlays.filter(o => (o.layer ?? "back") === "back")` / `=== "front"`) and the paint order. `pipeline-config.test.ts` validates the `layer` *field* schema, but nothing asserts the *banding behavior*: that a `layer: undefined` overlay is treated as back, that back overlays paint before `SubtitleLayoutRenderer` and front after `TitleOverlay`, or that the two compositions agree. Per the project memory ("renderer-sync-clobber-hazard": always re-run renderer vitest after a sync; bulk `cp` can silently revert renderer-only fixes), an untested renderer-only paint-order change is exactly the kind of thing a future sync can clobber undetected. CR-01 is itself a live example of renderer/studio drift that no test caught.
**Fix:** Add a pure helper (e.g. `splitOverlaysByLayer(overlays): { back, front }`) exported from a shared module, mirror it into the renderer, and unit-test it in both services' vitest suites (default → back; explicit front; mixed order preserved). This makes the parity machine-checkable instead of comment-enforced.

### WR-05: Preview dim is applied to back overlays only — silent preview/export divergence

**File:** `services/remotion-studio/src/SubtitledVideo.tsx:100-108`
**Issue:** Studio wraps **back** overlays in `<div style={{ position:"absolute", inset:0, opacity:0.85, filter:"saturate(0.8)" }}>` for legibility, while **front** overlays (lines 126-128) and the renderer (Root.tsx, no dim at all) render at full opacity/saturation. The wrapper `opacity:0.85` also *multiplies* with each overlay's own `opacity`, so a back overlay configured at `opacity:1` previews at `0.85` but exports at `1.0`. This is documented as intentional ("studio Player path ONLY, never exported"), so it is not a correctness bug — but it is an undocumented-to-the-user WYSIWYG break: a creator tuning a back-overlay's opacity against the preview will systematically under-shoot the exported value, and back vs front overlays look inconsistent in the same preview.
**Fix:** If the dim must stay, prefer a non-opacity legibility treatment that does not compound with the overlay's own opacity (e.g. a subtle scrim layer behind text, or dim the *subtitle backdrop* instead of the overlay), or surface a "preview dim active" hint in the Overlays tab so the opacity slider's preview value is understood to be non-final. At minimum, apply the same treatment (or none) to front overlays so the two bands are visually consistent.

## Info

### IN-01: `parseInt`/`parseFloat` early-return on NaN blocks clearing numeric inputs

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:366-368,381-383`; `OverlayEditor.tsx:382-384,397-399,489-491`
**Issue:** `const val = parseInt(e.target.value); if (isNaN(val)) return;` means clearing a number field (empty string → NaN) is a no-op, so the user cannot blank the field to retype — the old value sticks until a digit is typed. Minor UX friction; not incorrect. `parseInt` is also called without an explicit radix.
**Fix:** Allow an empty intermediate state (store the raw string or coerce empty → a sentinel), and pass radix 10: `parseInt(e.target.value, 10)`.

### IN-02: Inconsistent live-preview emission between TitleEditor and OverlayEditor on delete

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:192-200`
**Issue:** `OverlayEditor.handleRemove` calls `onPreviewChange?.(updated)` (line 209-210); `TitleEditor.handleRemove` does not. Both self-heal because `PreviewApp` re-syncs `liveTitles`/`liveOverlays` from the committed list via `useEffect([titles])` / `useEffect([overlays])` (PreviewApp.tsx:290-297), so there is no visible bug — but the two editors implement the same operation differently, which invites a regression if the syncing effect is ever removed.
**Fix:** Make the two editors symmetric — either add `onPreviewChange?.(updated)` to `TitleEditor.handleRemove`, or drop it from `OverlayEditor.handleRemove` and rely on the effect in both.

### IN-03: Eager font load mismatches default subtitle font

**File:** `services/remotion-studio/src/preview/PreviewApp.tsx:236-240`
**Issue:** On mount, `loadFont("Inter")` is eagerly loaded, but `INITIAL_SUBTITLE_CONFIG` resolves `fontFamily` to `DEFAULT_SUBTITLE_CONFIG.fontFamily = "PlusJakartaSans"` (pipeline-config.ts:183). The default subtitle font is therefore not the one pre-warmed; the correct font loads lazily via the composition's `delayRender` effect. Harmless (first paint may flash a fallback) but the eager load targets the wrong family.
**Fix:** Eager-load the actual default: `loadFont(INITIAL_SUBTITLE_CONFIG.fontFamily ?? "Inter")`.

---

_Reviewed: 2026-06-03T11:14:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
