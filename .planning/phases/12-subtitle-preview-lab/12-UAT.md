---
status: complete
phase: 12-subtitle-preview-lab
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md
started: 2026-05-18T13:00:00Z
updated: 2026-05-18T17:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Server starts and serves /api/health, /editor, /preview, /preview/fonts. All routes return valid content.
result: pass

### 2. pastWordOpacity Config Default
expected: When pastWordOpacity is not explicitly set in config, all 4 layout components (TikTok, Sentence, Bar, Karaoke) render wasActive words at 0.4 opacity — visually dimmer than the current active word but still readable.
result: pass

### 3. pastWordOpacity Slider in StyleControls
expected: The StyleControls panel includes a pastWordOpacity slider (range 0–1). Dragging it updates the subtitle preview in real-time: setting to 0 makes past words invisible, setting to 1 makes past words fully opaque like the active word.
result: pass

### 4. lineHeight Slider in StyleControls
expected: The StyleControls panel includes a lineHeight slider (range 0.8–3.0). Adjusting it changes the vertical spacing between subtitle lines in real-time within the preview.
result: pass

### 5. bottomOffset Slider in StyleControls
expected: The StyleControls panel includes a bottomOffset slider (range 0–960px). Adjusting it moves the subtitle block higher or lower within the 9:16 viewport in real-time.
result: pass

### 6. /preview Route Renders 9:16 Viewport
expected: Navigating to /preview shows a page with a 9:16 aspect-ratio viewport on the left displaying the subtitle video (or black background if no sample video), and a collapsible controls panel on the right.
result: pass

### 7. PreviewPlayer Renders SubtitledVideo
expected: The @remotion/player renders the SubtitledVideo composition inside the 9:16 viewport. If sample video is present, subtitles overlay on top of the video. Without sample video, subtitles render on a black background without errors.
result: pass

### 8. TextareaInput with Spanish Default
expected: The /preview page shows a textarea pre-filled with Spanish default text. Editing the text updates the subtitle caption pages in real-time within the preview.
result: pass

### 9. Real-Time Parameter Updates (No Reload)
expected: Changing any subtitle parameter (font, size, colors, lineHeight, pastWordOpacity, bottomOffset, layout mode) in StyleControls updates the @remotion/player preview instantly — no page reload or re-render required.
result: pass

### 10. /preview/fonts Route Shows Font Grid
expected: Navigating to /preview/fonts shows all 18+1 fonts displayed simultaneously in a responsive grid. Each font renders its name in its own typeface (not system fallback), allowing direct visual comparison.
result: pass

### 11. Font Selection from Grid
expected: Clicking a font in the font grid (or using ?font=FontName URL param) selects that font and either navigates to /preview with that font applied or updates the preview to use the selected font.
result: pass

### 12. /editor Route Still Works
expected: Navigating to /editor loads the existing Remotion Studio editor page — no regressions from the SPA routing changes. Existing editor functionality (composition selection, preview, controls) works as before.
result: pass

### 13. All 4 Layout Modes in Preview
expected: Switching between TikTok, Sentence, Bar, and Karaoke layout modes in StyleControls changes the subtitle rendering style in the preview — each layout has a distinct visual appearance.
result: pass

### 14. Font CSS Family Name Resolution
expected: Selecting any font (including names with spaces: DancingScript, SourceSans3, etc.) in the TitleEditor updates the preview to render in that font's typeface. The CSS fontFamily property uses the actual font family name (e.g., "Dancing Script", "Source Sans Three"), not the module name.
result: pass

### 15. Title Style Persistence Across Reload
expected: After editing title overlay styles (font size, color, font family) and saving, reloading the page preserves all title data including style properties.
result: pass

### 16. Player Controls Visibility on Dark Background
expected: Remotion Player controls (play/pause, progress bar) are visible on the dark preview background.
result: pass

### 17. Word Highlight Transition Smoothness
expected: Word highlight transitions are smooth with no 1-frame flash between adjacent words. Past words fade to 80% of their previous opacity over 80ms.
result: pass

### 18. fontWeight Stability During Highlight
expected: No layout shift or jitter when a word transitions to active/highlighted state. All text uses fontWeight 700 consistently.
result: pass

### 19. Title Style Editor Controls
expected: TitleEditor includes titleFontSize slider (24-120), subtitleFontSize slider (16-80), titleColor picker, subtitleColor picker, titleFontFamily dropdown (26 fonts), subtitleFontFamily dropdown (26 fonts), and topOffset slider (10-90).
result: pass

### 20. Config Save/Load with Local Fallback
expected: Clicking "Save Config" persists configuration via PUT /api/config. Reloading the page restores config via GET /api/config. When PIPELINE_CONFIG_PATH env var is not set, falls back to process.cwd()/pipeline-config.json.
result: pass

### 21. All 26 Fonts Render Correctly
expected: All 26 fonts in the AVAILABLE_FONTS list (including DancingScript, SourceSans3, BebasNeue, TitanOne, etc.) render with their correct typeface in the preview, not falling back to system default.
result: pass

## Summary

total: 21
passed: 21
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]

## Post-Phase Bug Fix Details (2026-05-19)

### Critical Bug: Font Module Name vs CSS Family Name Mismatch
**Impact:** 10 of 26 fonts were broken — selecting them in the editor would show system default font instead of the chosen font.
**Root Cause:** `@remotion/google-fonts` module names (e.g., `DancingScript`) don't match CSS `fontFamily` strings (e.g., `Dancing Script`). Code was using module names directly as CSS values.
**Fix:** Added `getFontFamilyCSS()` function in `fonts.ts` that resolves module names to CSS family names via `FONT_LOADERS[moduleName].fontFamily`. Applied in `SubtitledVideo.tsx` and `TitleOverlay.tsx`.

### Critical Bug: TitleOverlay Temporal Dead Zone
**Impact:** Remotion Player showed ⚠️ error symbol instead of content after adding font loading to TitleOverlay.
**Root Cause:** `const titleFont = titleFontFamily` was declared before `titleFontFamily` was computed — JS temporal dead zone made both `undefined`.
**Fix:** Moved all style-merge declarations before the `useEffect` that references them.

### Bug: Player Controls Invisible on Dark Background
**Fix:** Added `.preview-player-override` CSS with `color: white !important`.

### Bug: Player Container Collapsed (aspect-ratio 0x0)
**Fix:** Replaced CSS `aspect-ratio` with JS-measured container dimensions using `useRef`/`useState`/`getBoundingClientRect()`.

### Bug: Word Highlight 1-Frame Overlap
**Fix:** Changed `frame <= toFrame` to `frame < toFrame` in all 4 layout components.

### Bug: fontWeight Layout Shift
**Fix:** Changed variable fontWeight (600/700/800) to fixed 700 in all layouts and TitleOverlay.

### Bug: Config Not Persisting Across Reload
**Fix:** Added `GET /api/config` fetch in `PreviewApp.tsx` on mount.

### Bug: "PIPELINE_CONFIG_PATH not configured" on Save
**Fix:** Added `resolveConfigPath()` local fallback in `server.ts`.