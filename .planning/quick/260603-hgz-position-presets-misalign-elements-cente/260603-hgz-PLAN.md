---
quick_id: 260603-hgz
type: quick
slug: position-presets-misalign-elements-cente
description: "Position presets misalign elements — center/right/bottom use an ESTIMATED element size; measure the REAL rendered size instead"
files_modified:
  - services/remotion-studio/src/editor/components/PositionPresets.tsx
  - services/remotion-studio/src/editor/components/TitleEditor.tsx
  - services/remotion-studio/src/editor/components/OverlayEditor.tsx
  - services/remotion-studio/src/editor/components/PositionPresets.test.ts
---

<objective>
Fix the 9-point position presets so elements land where the arrow says. Root
cause (confirmed): `computePresetXY` is correct, but the consumers feed it a
WRONG element size, so every size-dependent anchor (center, right, bottom) is
off while the size-independent anchors (left=0, top=0) work.

- TitleEditor estimates `width = titleFontSize*6 + padding*2` (a fixed "6 chars"
  guess that rarely matches the real text) and a similar height guess.
- OverlayEditor passes `elementHeight = displayWidth` (uses width as height —
  wrong for any non-square PNG).

The chosen fix (user-locked): **measure the REAL rendered size** and feed that
to `computePresetXY`. Coordinate contract is already correct — both
`TitleOverlay` and `PngOverlay` position by top-left: `left:(x/1080)*100%`,
`top:(y/1920)*100%`, so the saved x/y must be the element's true top-left, which
requires the element's true width/height in 1080×1920 frame space.
</objective>

<diagnosis_evidence>
- services/remotion-studio/src/compositions/PngOverlay.tsx:62-66 — `left:(x/1080)%`, `top:(y/1920)%`, `width: displayWidth`, `height:"auto"`.
- services/remotion-studio/src/compositions/TitleOverlay.tsx:209-236 — `left:(x/1080)%`, `top:(y/1920)%`, flex-centered text box, `width:auto`.
- PositionPresets.tsx:53-76 — `computePresetXY` math is correct (left/top=0, center=(frame-el)/2, right/bottom=frame-el). KEEP IT.
- TitleEditor.tsx:394-396 — bad width/height estimate.
- OverlayEditor.tsx:410-412 — `elementHeight={draft.displayWidth}` bug.
</diagnosis_evidence>

<tasks>

<task type="auto">
  <name>Task 1: Overlays — real height from the PNG aspect ratio</name>
  <files>
    - services/remotion-studio/src/editor/components/PositionPresets.tsx (add pure helper)
    - services/remotion-studio/src/editor/components/OverlayEditor.tsx (use real natural dims)
    - services/remotion-studio/src/editor/components/PositionPresets.test.ts (test pure helper)
  </files>
  <read_first>
    - services/remotion-studio/src/editor/components/OverlayEditor.tsx (how the overlay draft + imageData are held; where displayWidth lives; the DEFAULT_OVERLAY)
    - services/remotion-studio/src/compositions/PngOverlay.tsx (confirm rendered width = displayWidth, height = auto → real height = displayWidth * naturalH/naturalW)
  </read_first>
  <action>
    1. In PositionPresets.tsx export a pure helper:
       `export function computeOverlayElementHeight(displayWidth: number, naturalWidth: number, naturalHeight: number): number` →
       returns `displayWidth * (naturalHeight / naturalWidth)` rounded to integer; if naturalWidth is 0/NaN/undefined, fall back to `displayWidth` (square) so behavior never throws.
    2. In OverlayEditor.tsx, obtain each overlay's natural pixel dimensions from its `imageData` base64 (create an `Image()`, read `naturalWidth`/`naturalHeight`; cache the aspect on the draft as a runtime-only field, e.g. `_naturalWidth`/`_naturalHeight`, NOT persisted to config — mirror the existing `_resolvedFile` runtime-only convention in pipeline-config). Load lazily (on add / on edit-open) and store in component state keyed to the draft.
    3. Replace `elementHeight={draft.displayWidth}` with `elementHeight={computeOverlayElementHeight(draft.displayWidth, natW, natH)}`. Keep `elementWidth={draft.displayWidth}` (already exact). If natural dims not yet loaded, fall back to displayWidth (current behavior) until the image resolves.
    4. Do NOT persist `_naturalWidth`/`_naturalHeight` to pipeline-config.json (runtime-only).
  </action>
  <verify>
    <automated>cd services/remotion-studio && npx vitest run PositionPresets</automated>
  </verify>
  <acceptance_criteria>
    - `computeOverlayElementHeight(200, 100, 50)` returns 100; `(200, 400, 200)` returns 100; `(200, 0, 0)` falls back to 200.
    - OverlayEditor passes a real aspect-ratio height (not `=displayWidth`) once the image natural size is known.
    - No `_naturalWidth`/`_naturalHeight` written to the saved config (grep the PUT/serialize path).
    - Studio vitest green.
  </acceptance_criteria>
  <done>Overlay presets compute the top-left from the real PNG aspect ratio; helper unit-tested.</done>
</task>

<task type="auto">
  <name>Task 2: Titles — measure the real text box instead of estimating</name>
  <files>
    - services/remotion-studio/src/editor/components/PositionPresets.tsx (or a new measureTitleBox helper module)
    - services/remotion-studio/src/editor/components/TitleEditor.tsx (use measured size)
  </files>
  <read_first>
    - services/remotion-studio/src/compositions/TitleOverlay.tsx (the EXACT box model to replicate: fontFamily source, fontSize=titleFontSize px, fontWeight when bold, fontStyle italic, padding, line-height, textAlign, any maxWidth/white-space/wrapping — the measuring node MUST match this so offsetWidth/offsetHeight equal the real rendered box in 1080-frame px)
    - services/remotion-studio/src/editor/components/TitleEditor.tsx (where titleFontSize, padding, font, bold/italic, and the title text live; where PositionPresets is rendered L394-396)
    - services/remotion-studio/src/fonts.ts (font family names, to set fontFamily on the measuring node)
  </read_first>
  <action>
    1. Add a DOM measurement helper, e.g. `measureTitleBox(opts: { text: string; fontFamily: string; fontSize: number; fontWeight: number; fontStyle: string; padding: number; /* + any maxWidth/lineHeight needed to match TitleOverlay */ }): { width: number; height: number }`.
       Implementation: create a detached element styled to MATCH TitleOverlay's text box exactly (same fontFamily/fontSize px/fontWeight/fontStyle/padding/line-height/text-align/white-space/maxWidth), `position:absolute; visibility:hidden; left:-99999px; top:-99999px`, set its textContent to the title text, append to document.body, read `offsetWidth`/`offsetHeight`, then remove. Because fontSize/padding are ABSOLUTE px identical to the composition, the measured box is already in 1080×1920 frame space — no scaling needed.
       Guard for SSR/no-DOM: if `typeof document === "undefined"`, fall back to the old estimate.
       Font readiness: call `document.fonts?.ready` (or await before measuring) so web-font metrics are correct, not fallback-font metrics. Re-measure when text/fontSize/padding/font/weight/style change.
    2. In TitleEditor, compute `elementWidth`/`elementHeight` from `measureTitleBox(...)` of the CURRENT title draft and pass those to `<PositionPresets>` instead of the `fontSize*6` estimate. Measure on demand (e.g. in a useMemo/useEffect keyed on the relevant style fields, or at click time inside an onApply wrapper) — pick the lowest-risk hook that yields a correct measurement at the moment a preset is clicked.
    3. Remove the now-dead `fontSize*6 / fontSize*1.5` estimate and its comment.
  </action>
  <verify>
    <automated>cd services/remotion-studio && npm run build:editor</automated>
    <manual>In the live Studio (port 3123, Chrome), click each of the 9 title presets and confirm the title lands at the named corner/edge/center fully on-frame, for both a short ("Hola") and a long title.</manual>
  </verify>
  <acceptance_criteria>
    - The `titleFontSize*6` / `*1.5` estimate is gone; TitleEditor feeds PositionPresets a measured width/height.
    - The measuring node replicates TitleOverlay's box (verified by reading both): same fontFamily/fontSize/fontWeight/fontStyle/padding.
    - `npm run build:editor` exits 0.
    - (Manual) center centers, right/bottom sit flush and fully on-frame, top/bottom exact — for short AND long titles.
  </acceptance_criteria>
  <done>Title presets compute the top-left from the measured real text box; estimate removed; build green.</done>
</task>

</tasks>

<constraints>
- EDITOR-ONLY change (studio). Do NOT modify the compositions (TitleOverlay.tsx / PngOverlay.tsx) — their rendering contract is already correct. Therefore NO renderer-sync is needed and the renderer code is untouched.
- Keep `computePresetXY` and its `Math.max(0,...)` clamp as-is (clamp is a harmless safety net; with real sizes it should rarely trigger).
- Pure-correctness fix: do NOT change any visible styling, colors, or layout of the editors or the grid. (If any visible affordance would change, stop and flag — UI changes require the impeccable pass per CLAUDE.md; this task should not need one.)
- Runtime-only fields (`_naturalWidth`/`_naturalHeight`) must never be persisted to pipeline-config.json.
- Commit each task atomically: `fix(260603-hgz): <task>`.
</constraints>

<success_criteria>
- Overlay presets place the PNG using its real aspect ratio (right/bottom flush, on-frame).
- Title presets place the title using its measured text box (center centers; right/bottom flush; works for short and long titles).
- Studio vitest green; `npm run build:editor` exits 0.
- No renderer/composition changes; no runtime-only fields leak into saved config.
</success_criteria>

<output>
Create `.planning/quick/260603-hgz-position-presets-misalign-elements-cente/260603-hgz-SUMMARY.md` when done.
</output>
