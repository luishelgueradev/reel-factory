---
phase: 21-png-overlays
plan: 03
status: complete
completed: 2026-05-30
requirements:
  - OVERLAY-01
  - OVERLAY-02
  - OVERLAY-03
---

# Plan 21-03 Summary — Studio UI for PNG overlays

## What was built

The final user-facing piece of the PNG overlay feature: the Studio UI to upload,
position, size, and preview transparent PNG overlays live in the Remotion Player.

- **`OverlayEditor.tsx`** (new) — list + add/edit/delete form for PNG overlays,
  mirroring `TitleEditor` structure and dark-theme inline-style tokens (D-07):
  - Hidden `<input type="file" accept="image/png">` driven by a styled upload zone.
  - Client-side **5 MB gate** (`file.size > 5 * 1024 * 1024`) before `FileReader`
    (D-09 / T-21-09) and **`image/png` MIME check** (T-21-08), with inline error copy.
  - `FileReader.readAsDataURL` → base64 data URL stored in draft `imageData`; 120px
    thumbnail + filename + "Change" link after selection; "Loading..." during read.
  - X (0-1080) / Y (0-1920) numeric inputs, Width (10-1080) input, Opacity slider
    (0-1, step 0.05, `accentColor #4CAF50`).
  - **Hard cap at 3 overlays** (D-02) — "+ Add Overlay" trigger disabled with `#555`
    background past the cap.
  - Primary CTA disabled (`#555`) when no PNG selected; delete is immediate (no
    confirmation, consistent with TitleEditor).
  - **Live preview** via `onPreviewChange` on every draft field change (D-11).
  - Full UI-SPEC copywriting / color / spacing contract honored.
- **`PreviewApp.tsx`** — added "Overlays" tab between Titles and Subtitles (D-08),
  `overlays`/`liveOverlays` state, load of `data.overlays` from `GET /api/config` on
  mount (shape-validated), `overlays` included in the `PUT /api/config` save payload,
  and `OverlayEditor` rendered in the Overlays tab wired to live preview.

## Deviations

- **`PreviewPlayer.tsx` also modified** (not in the plan's 2-file `files_modified`
  list). Reason: `inputProps` for the Player is built INSIDE `PreviewPlayer`, not in
  `PreviewApp`. Added an `overlays?: PngOverlayConfig[]` prop, included
  `overlays: overlays ?? []` in `inputProps`, and added `overlays` to the `useMemo`
  deps so the live preview updates on every draft change. Without this the Overlays
  tab would not drive the Player. Necessary to satisfy plan task 2 step 9.

## Cross-plan regression fixed during this phase

During the post-merge gate after wave 2 (plan 21-02), the bulk `cp src/compositions/*`
renderer-sync clobbered the renderer's `typography.test.ts` with a stale studio copy,
reverting the Phase 20 `titleFontSize` TYPO-02 fix. Restored `titleFontSize` in both
copies (commit before this plan); all 293 renderer tests pass.

## Verification

- `npm run build:editor` exits 0 (served bundle `index-Di-MNQy0.js`).
- All plan automated acceptance greps pass (FileReader, 5MB gate, hard-cap 3,
  onPreviewChange ≥2, image/png, "Discard Changes", "Add Overlay" ≥2, #b71c1c, #4CAF50,
  tab order Titles→Overlays→Subtitles, data.overlays load, liveOverlays wiring).
- **Human-verify checkpoint APPROVED** by the user (all 8 UAT steps): tab order,
  empty state, upload + live preview, hard cap, 5 MB gate, delete, edit, transparency.

## Follow-ups captured (todos, non-blocking)

Three enhancement todos captured during UAT (commit `7ac8870`):
1. Move sample-text input into the Subtitles tab (remove standalone "Text" tab).
2. Define overlay layering/z-order model (overlays likely BELOW titles/subtitles).
3. Add auto-position buttons (top/bottom/left/right/center-x/center-y) to x/y controls
   in TitleEditor and OverlayEditor.

## UI tooling

`impeccable` skill + `frontend-design` plugin invoked at the start per AGENTS.md
non-negotiable rule. Design authority was the established design system
(`TitleEditor` + `21-UI-SPEC.md` locked tokens); craft = exact consistency with the
existing dark-theme control panel.

## Key files

- created: `services/remotion-studio/src/editor/components/OverlayEditor.tsx`
- modified: `services/remotion-studio/src/preview/PreviewApp.tsx`
- modified: `services/remotion-studio/src/preview/PreviewPlayer.tsx` (deviation)

## Self-Check: PASSED
