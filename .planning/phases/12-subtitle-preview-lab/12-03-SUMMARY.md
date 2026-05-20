---
phase: 12-subtitle-preview-lab
plan: 03
subsystem: ui, fonts, preview
tags: [remotion, fonts, css-font-family, title-overlay, preview-player, bug-fix, hot-fix]

# Dependency graph
requires:
  - phase: 12
    plan: 02
    provides: PreviewPlayer, TitleOverlay, SubtitledVideo, fonts.ts, TitleEditor
provides:
  - Font CSS family name resolution via getFontFamilyCSS()
  - TitleOverlay with resolved CSS font family names (titleFontCSS, subtitleFontCSS)
  - SubtitledVideo with resolved config (fontFamily replaced with CSS family name)
  - Fixed variable declaration order bug in TitleOverlay (temporal dead zone)
  - Player control visibility fix (white text on dark background)
  - Player aspect ratio fix (JS-measured container dimensions)
  - resolveConfigPath fallback for local development
  - Word highlight overlap fix (strict < instead of <=)
  - Smooth word highlight fade transition (HIGHLIGHT_FADE_MS = 80ms)
  - Fixed fontWeight layout shift (variable 600/700/800 → fixed 700)
  - Title style persistence (GET /api/config on mount)
  - TitleEditor with 6 new style controls (font size, color, font family, position)
  - 8 new Google Fonts added to font infrastructure (Sora, DancingScript, etc.)
  - TitleOverlay dual-font loading with delayRender/continueRender
affects: [remotion-studio, remotion-renderer, title-overlay, subtitle-layouts, preview-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [css-font-family-resolution, temporal-dead-zone-avoidance, js-measured-container, config-local-fallback]

key-files:
  created: []
  modified:
    - services/remotion-studio/src/fonts.ts
    - services/remotion-studio/src/compositions/TitleOverlay.tsx
    - services/remotion-studio/src/SubtitledVideo.tsx
    - services/remotion-studio/src/preview/PreviewPlayer.tsx
    - services/remotion-studio/src/preview/PreviewApp.tsx
    - services/remotion-studio/src/editor/components/TitleEditor.tsx
    - services/remotion-studio/src/pipeline-config.ts
    - services/remotion-studio/src/server.ts
    - services/remotion-studio/src/compositions/TikTokLayout.tsx
    - services/remotion-studio/src/compositions/BarLayout.tsx
    - services/remotion-studio/src/compositions/KaraokeLayout.tsx
    - services/remotion-studio/src/compositions/SentenceLayout.tsx
    - services/remotion-studio/src/compositions/shared-styles.ts

key-decisions:
  - "Added getFontFamilyCSS() to resolve module names to CSS font family strings (e.g., DancingScript → Dancing Script)"
  - "TitleOverlay resolves font names via getFontFamilyCSS() before applying them as CSS fontFamily"
  - "SubtitledVideo builds resolvedConfig with fontFamily replaced by CSS family name before passing to layouts"
  - "Moved all style-merge declarations before useEffect in TitleOverlay to avoid temporal dead zone"
  - "Replaced CSS aspect-ratio with JS-measured container dimensions for reliable player sizing"
  - "Added resolveConfigPath() local fallback for development without Docker env vars"
  - "Fixed word highlight overlap by changing frame <= toFrame to frame < toFrame (strict less-than)"
  - "Added HIGHLIGHT_FADE_MS = 80ms smooth fade transition for word highlight opacity"
  - "Fixed fontWeight layout shift by replacing variable weights (600/700/800) with fixed 700"
  - "TitleEditor gains 6 new controls: titleFontSize, subtitleFontSize, titleColor, subtitleColor, titleFontFamily, subtitleFontFamily, topOffset"
  - "Title style defaults: topOffset 50%, titleFontSize 72, subtitleFontSize 42, titleColor #FFFFFF, subtitleColor #FFFFFF"
  - "titles state loaded from GET /api/config on PreviewApp mount and persisted via TitleEditor onChange"
  - "Added 8 new Google Fonts: Sora, DancingScript, CormorantGaramond, DMSans, JosefinSans, Righteous, TitanOne + monospace fallback"

patterns-established:
  - "Font module name → CSS family name resolution: always use getFontFamilyCSS(moduleName) before setting CSS fontFamily"
  - "Component variable order: all derived state must be declared before useEffect/useCallback that references them"
  - "Container sizing: use JS useReadCurrentFrame/ResizeObserver for Remotion Player containers instead of CSS aspect-ratio"
  - "Word highlight timing: use strict < for toFrame comparison to prevent 1-frame overlap between adjacent words"
  - "Config persistence: load on mount via GET /api/config, save on change via PUT /api/config with local file fallback"

requirements-completed: [PREV-02, PREV-03]

# Metrics
duration: extended (post-phase hot-fix session)
completed: 2026-05-19
---

# Phase 12 Plan 03: Post-Phase Bug Fixes and Title Style Enhancements Summary

**Critical font resolution bug fixed (module name vs CSS family name), player rendering bugs resolved, word highlight timing improved, title overlay editor enhanced with 6 new style controls, 8 new fonts added**

## Bug Fixes

### BF-01: Font CSS Family Name Mismatch (Critical)
**Problem:** When selecting a font like "DancingScript" in the TitleEditor, the preview did not render the font correctly. The browser fell back to the default font because `fontFamily: "DancingScript"` in CSS doesn't match the actual registered font family name `"Dancing Script"` (with space).

**Root Cause:** `@remotion/google-fonts` module names (e.g., `DancingScript`, `SourceSans3`, `BebasNeue`) are NOT the same as the CSS `fontFamily` strings those fonts register (e.g., `"Dancing Script"`, `"Source Sans Three"`, `"Bebas Neue"`). The code was using module names directly as CSS `fontFamily` values.

**Affected Fonts (with module name → CSS family name):**
| Module Name | CSS fontFamily | Space? |
|-------------|---------------|--------|
| DancingScript | Dancing Script | Yes |
| CormorantGaramond | Cormorant Garamond | Yes |
| DMSans | DM Sans | Yes |
| JosefinSans | Josefin Sans | Yes |
| BebasNeue | Bebas Neue | Yes |
| SpaceGrotesk | Space Grotesk | Yes |
| PlayfairDisplay | Playfair Display | Yes |
| LexendDeca | Lexend Deca | Yes |
| SourceSans3 | Source Sans Three | Yes |
| TitanOne | Titan One | Yes |
| Sora | Sora | No |
| Righteous | Righteous | No |
| Inter | Inter | No |

**Fix:** Added `getFontFamilyCSS()` function to `fonts.ts` that looks up the actual CSS family name from `FONT_LOADERS[moduleName].fontFamily`. Applied in two places:
1. `SubtitledVideo.tsx` — builds `resolvedConfig` with `fontFamily: getFontFamilyCSS(fontFamily)` before passing to layouts
2. `TitleOverlay.tsx` — computes `titleFontCSS = getFontFamilyCSS(titleFontFamily)` and `subtitleFontCSS = getFontFamilyCSS(subtitleFontFamily)` for CSS styles

**Verification:** Tested with DancingScript → `"Dancing Script"`, SourceSans3 → `"Source Sans Three"`, TitanOne → `"Titan One"`, BebasNeue → `"Bebas Neue"`, PlayfairDisplay → `"Playfair Display"`, SpaceGrotesk → `"Space Grotesk"`, CormorantGaramond → `"Cormorant Garamond"`. All render correctly in browser.

### BF-02: TitleOverlay Variable Declaration Order (Temporal Dead Zone)
**Problem:** The Remotion Player showed ⚠️ (error) instead of rendering content. No visible error message, no console errors.

**Root Cause:** In `TitleOverlay.tsx`, `const titleFont = titleFontFamily` and `const subtitleFont = subtitleFontFamily` were declared at line 58-59, but `titleFontFamily` and `subtitleFontFamily` were not computed until line 97-98. In JavaScript, `const` declarations are in the temporal dead zone before their initialization point. The `useEffect` that loaded fonts used `titleFont`/`subtitleFont` which were `undefined`, causing `loadFont(undefined)` to fail silently — and the `fontLoaded` state was never set to `true`, preventing the component from rendering.

**Fix:** Moved all style-merge declarations (`titleFontFamily`, `subtitleFontFamily`, `titleFontSize`, `subtitleFontSize`, `titleColor`, `subtitleColor`, `topOffset`, `entranceAnimation`, `backgroundColor`) before the `useEffect` that uses them. Removed duplicate declarations that appeared later in the function.

### BF-03: Remotion Player Controls Invisible (Black on Dark Background)
**Problem:** The Remotion Player's play/pause/progress controls were invisible because they rendered as dark gray/black on a dark `#1a1a2e` background.

**Fix:** Added CSS override in `PreviewPlayer.tsx`:
```css
.preview-player-override * {
  color: white !important;
}
.preview-player-override button {
  color: white !important;
}
```

### BF-04: Player Container Collapsed (aspect-ratio: 1080/1920 = 0 in Flex Layout)
**Problem:** The Remotion Player container had `aspect-ratio: 1080/1920` but in a flex layout this resulted in a 0x0 pixel computed size, causing the player to collapse.

**Fix:** Replaced CSS `aspect-ratio` with JS-measured container dimensions using `useRef` and `useState`. The component measures its container with `getBoundingClientRect()` on mount and resize, then passes exact pixel dimensions to the Remotion Player.

### BF-05: "PIPELINE_CONFIG_PATH not configured" Error on Save
**Problem:** Clicking "Save Config" in the preview page threw a 500 error because `PIPELINE_CONFIG_PATH` env var wasn't set in local development.

**Fix:** Added `resolveConfigPath()` in `server.ts` that falls back to `path.join(process.cwd(), "pipeline-config.json")` when the `PIPELINE_CONFIG_PATH` env var is not set.

### BF-06: Word Highlight Overlap (1-Frame Inverse Flash)
**Problem:** At the boundary between two adjacent words, both words were highlighted for 1 frame, creating a brief inverse-color flash. This was caused by using `frame <= toFrame` for the "was active" condition — meaning word A's highlight ended at the same frame word B's highlight started.

**Fix:** Changed all 4 layout components (TikTokLayout, BarLayout, KaraokeLayout, SentenceLayout) from `frame <= toFrame` to `frame < toFrame` (strict less-than) for the "was active" condition. This ensures word A is no longer highlighted on the exact frame word B becomes active.

### BF-07: fontWeight Layout Shift During Word Highlight
**Problem:** When a word became active (highlighted), its `fontWeight` changed from 600 → 800 (or similar), causing the word's bounding box to shift and the surrounding words to reflow. This created a visible jitter/pulse effect.

**Fix:** Changed `fontWeight` in all 4 layout components and `TitleOverlay` to use fixed `700` for all text states, eliminating the layout shift. Previously: inactive=600, active=700/800. Now: all states use 700.

### BF-08: Title Styles Not Persisting on Reload
**Problem:** After editing title overlay styles (font size, color, font family) and saving, reloading the page lost all title data — the titles array was empty.

**Fix:** In `PreviewApp.tsx`, added `useEffect` to fetch config from `GET /api/config` on mount and populate the `titles` state with the server's persisted data. The `TitleEditor` component now receives `titles` and `onChange={setTitles}` props to keep the state synchronized.

## Feature Enhancements

### FE-01: Title Style Editor — 6 New Controls
Added 6 new style properties to `TitleStyleProps` in `pipeline-config.ts`:
- `titleFontSize` (default: 72) — controls main title font size
- `subtitleFontSize` (default: 42) — controls subtitle font size
- `titleColor` (default: #FFFFFF) — title text color, independent of `textColor`
- `subtitleColor` (default: #FFFFFF) — subtitle text color, independent of `textColor`
- `titleFontFamily` (default: "Inter") — font for title text
- `subtitleFontFamily` (default: "Inter") — font for subtitle text
- `topOffset` (default: 50) — vertical position as percentage (10-90)

`TitleEditor.tsx` now includes:
- Font size sliders (title: 24-120, subtitle: 16-80)
- Color pickers for title and subtitle text
- Font family dropdowns (26 fonts) for title and subtitle
- Vertical position slider (10%-90%)

### FE-02: 8 New Google Fonts
Added 8 new fonts to the `fonts.ts` infrastructure:
- Sora (geometric sans-serif)
- DancingScript (casual script)
- CormorantGaramond (elegant serif)
- DMSans (geometric sans-serif)
- JosefinSans (geometric sans-serif)
- Righteous (display sans-serif)
- TitanOne (bold display)
- Plus `monospace` as a system fallback

All imported as ESM sub-modules from `@remotion/google-fonts/X` (not separate npm packages).

### FE-03: TitleOverlay Dual Font Loading
`TitleOverlay.tsx` now loads two fonts (title + subtitle) independently with `delayRender`/`continueRender`:
- Deduplicates fonts when title and subtitle use the same family
- Falls back gracefully if a font fails to load
- Sets `fontLoaded` state only when all pending fonts resolve

### FE-04: Smooth Word Highlight Fade Transition
Added `HIGHLIGHT_FADE_MS = 80` constant in `shared-styles.ts`:
- Words transitioning from "active" to "was active" opacity get an 80ms fade-out interpolation
- Uses Remotion's `interpolate()` function with `extrapolateLeft: "clamp"` for the transition
- Past words settle at `config.pastWordOpacity` (default 0.4) instead of jumping abruptly

## Files Modified

### services/remotion-studio/src/fonts.ts
- Added `getFontFamilyCSS()` function that maps module names to CSS family names using `FONT_LOADERS[moduleName].fontFamily`
- Added 8 new font entries: Sora, DancingScript, CormorantGaramond, DMSans, JosefinSans, Righteous, TitanOne
- Updated `AVAILABLE_FONTS` array with all 26 fonts + monospace

### services/remotion-studio/src/compositions/TitleOverlay.tsx
- Imported `getFontFamilyCSS` from `fonts.ts`
- Moved all style-merge declarations before `useEffect` (BF-02 temporal dead zone fix)
- Added `titleFontCSS = getFontFamilyCSS(titleFontFamily)` and `subtitleFontCSS = getFontFamilyCSS(subtitleFontFamily)` for correct CSS font family resolution
- Changed CSS `fontFamily` properties from `titleFontFamily`/`subtitleFontFamily` to `titleFontCSS`/`subtitleFontCSS`
- Added dual-font `delayRender`/`continueRender` with deduplication (FE-03)
- Added 6 new style props: titleFontSize, subtitleFontSize, titleColor, subtitleColor, titleFontFamily, subtitleFontFamily, topOffset

### services/remotion-studio/src/SubtitledVideo.tsx
- Imported `getFontFamilyCSS` from `fonts.ts`
- Added `fontFamilyCSS = getFontFamilyCSS(fontFamily)` to resolve subtitle font module name
- Built `resolvedConfig` with `fontFamily: fontFamilyCSS` for layout components
- Passed `resolvedConfig` (instead of raw `config`) to `SubtitleLayoutRenderer`

### services/remotion-studio/src/preview/PreviewPlayer.tsx
- Replaced CSS `aspect-ratio` with JS-measured container dimensions using `useRef`/`useState` (BF-04)
- Added `.preview-player-override` CSS class with white color overrides for player controls (BF-03)

### services/remotion-studio/src/preview/PreviewApp.tsx
- Added `useEffect` to fetch config from `GET /api/config` on mount and populate `titles` state (BF-08)
- Added `<TitleEditor>` component integration with `titles` state and `onChange={setTitles}`

### services/remotion-studio/src/editor/components/TitleEditor.tsx
- Added 6 new style controls: titleFontSize slider, subtitleFontSize slider, titleColor color picker, subtitleColor color picker, titleFontFamily dropdown, subtitleFontFamily dropdown, topOffset slider (FE-01)
- Updated `FONT_OPTIONS` array to include all 26 fonts
- Updated `DEFAULT_TITLE_STYLE` with new fields and values

### services/remotion-studio/src/pipeline-config.ts
- Extended `TitleStyleProps` interface with 7 new optional fields
- Added validation for `titleFontSize` (24-120), `subtitleFontSize` (16-80), `topOffset` (10-90)

### services/remotion-studio/src/server.ts
- Added `resolveConfigPath()` function with local fallback to `process.cwd()/pipeline-config.json` (BF-05)

### services/remotion-studio/src/compositions/TikTokLayout.tsx
- Fixed word highlight overlap: `frame <= toFrame` → `frame < toFrame` (BF-06)
- Fixed fontWeight layout shift: changed from variable 600/700/800 to fixed 700 (BF-07)
- Added `HIGHLIGHT_FADE_MS` fade transition for past-word opacity (FE-04)

### services/remotion-studio/src/compositions/BarLayout.tsx
- Same fixes as TikTokLayout: strict `< toFrame`, fontWeight 700, HIGHLIGHT_FADE_MS

### services/remotion-studio/src/compositions/KaraokeLayout.tsx
- Same fixes as TikTokLayout: strict `< toFrame`, fontWeight 700 for both layers, HIGHLIGHT_FADE_MS

### services/remotion-studio/src/compositions/SentenceLayout.tsx
- Same fixes as TikTokLayout: strict `< toFrame`, fontWeight 700, HIGHLIGHT_FADE_MS
- Added `pageFromFrame` prop for sentence-level timing

### services/remotion-studio/src/compositions/shared-styles.ts
- Added `HIGHLIGHT_FADE_MS = 80` constant

### Synced files (remotion-studio → remotion-renderer)
All composition files and `pipeline-config.ts`, `fonts.ts`, `SubtitledVideo.tsx`, `TitleOverlay.tsx` were copied from `services/remotion-studio/src/` to `services/remotion-renderer/src/` after each change.

## Decisions Made

1. **Font resolution pattern:** Established `getFontFamilyCSS()` as the canonical way to convert font module names to CSS family names. All components that set `fontFamily` in CSS must resolve through this function.

2. **Variable declaration order:** All derived state variables in React components must be declared before any `useEffect` or `useCallback` that references them. The temporal dead zone for `const` declarations is a real footgun.

3. **Container sizing:** Use JS-measured container dimensions (`useRef` + `useState` + `getBoundingClientRect()`) for Remotion Player containers instead of CSS `aspect-ratio`, which computes to 0 in flex contexts.

4. **Word highlight timing:** Use strict `<` (less-than) for `toFrame` comparisons to prevent 1-frame highlight overlap between adjacent words.

5. **fontWeight consistency:** All layout text uses `fontWeight: 700` to prevent layout shift during highlight transitions.

6. **Config persistence:** Load on mount via `GET /api/config`, save via `PUT /api/config`. Local fallback: `process.cwd()/pipeline-config.json` when env vars aren't set.

7. **Font import pattern:** All new fonts are imported as ESM sub-modules from `@remotion/google-fonts/X` (e.g., `@remotion/google-fonts/DancingScript`), NOT as separate npm packages.

## Deviations from Plan

These changes are a post-phase hot-fix session beyond the original Phase 12 plans. No plan existed for these fixes — they were discovered during manual testing and browser-agent verification.

## Issues Encountered

1. **Font module name ≠ CSS family name:** Discovered during browser testing. Fonts with spaces (e.g., "Dancing Script") were not rendering because the code used "DancingScript" as the CSS `fontFamily`. This is a systemic issue that affects 10 of 26 fonts.

2. **Temporal dead zone crash:** Discovered when Remotion Player showed ⚠️ instead of content. No JS error was thrown because the `useEffect` with `undefined` font names silently resolved via the `.catch()` handler — but `fontLoaded` was never set to `true`, causing the component to render nothing.

3. **CSS aspect-ratio in flex layout:** Discovered when the player viewport collapsed to 0x0. CSS `aspect-ratio: 1080/1920` in a flex child doesn't work because flex layout overrides the computed size.

4. **Server crash on config path:** `PIPELINE_CONFIG_PATH` env var is Docker-specific. Local development needs a fallback path.

## Verification

All fixes verified via browser agent:
- DancingScript renders as `"Dancing Script"` ✅
- SourceSans3 renders as `"Source Sans Three"` ✅
- CormorantGaramond renders as `"Cormorant Garamond"` ✅
- TitanOne renders as `"Titan One"` ✅
- BebasNeue renders as `"Bebas Neue"` ✅
- PlayfairDisplay renders as `"Playfair Display"` ✅
- SpaceGrotesk renders as `"Space Grotesk"` ✅
- DMSans renders as `"DM Sans"` ✅
- JosefinSans renders as `"Josefin Sans"` ✅
- Inter renders as `"Inter"` ✅ (no change, already correct)
- Title styles persist across page reload ✅
- Player controls visible on dark background ✅
- Word highlight transition is smooth (no flash, no jitter) ✅

---
*Phase: 12-subtitle-preview-lab*
*Completed: 2026-05-19*