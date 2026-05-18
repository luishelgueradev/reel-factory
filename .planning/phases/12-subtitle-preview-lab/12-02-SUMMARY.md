---
phase: 12-subtitle-preview-lab
plan: 02
subsystem: ui
tags: [remotion, player, preview, spa, routing, fonts, captions]

# Dependency graph
requires:
  - phase: 11
    provides: PipelineConfig, SubtitleConfig, layout components, StyleControls, Root.tsx
  - phase: 12
    plan: 01
    provides: pastWordOpacity config, SubtitledVideo export, rawVideoSrc prop, StyleControls sliders
provides:
  - /preview SPA page with @remotion/player rendering SubtitledVideo
  - /preview/fonts grid showing all 18+1 fonts
  - React Router SPA with /editor and /preview routes
  - Express /preview route serving same SPA as /editor
  - textToCaptionPages() utility for textarea-to-captions conversion
  - PreviewPlayer component with 1080x1920 aspect-ratio rendering
  - FontGridPage with CSS font rendering and selection callback
  - TextareaInput with editable Spanish default text
affects: [remotion-studio, preview-page]

# Tech tracking
tech-stack:
  added: [@remotion/player@4.0.457, react-router-dom@^7.15.1]
  patterns: [remotion-player-integration, spa-routing, text-to-captions-conversion, css-aspect-ratio-viewport]

key-files:
  created:
    - services/remotion-studio/src/preview/PreviewApp.tsx
    - services/remotion-studio/src/preview/PreviewPlayer.tsx
    - services/remotion-studio/src/preview/TextareaInput.tsx
    - services/remotion-studio/src/preview/textToCaptions.ts
    - services/remotion-studio/src/preview/FontGridPage.tsx
    - services/remotion-studio/src/editor/EditorApp.tsx
    - services/remotion-studio/public/.gitkeep
  modified:
    - services/remotion-studio/package.json
    - services/remotion-studio/src/editor/App.tsx
    - services/remotion-studio/src/editor/index.html
    - services/remotion-studio/src/server.ts
    - services/remotion-studio/vite.config.ts
    - services/remotion-studio/Dockerfile

key-decisions:
  - "Used React Router BrowserRouter for SPA routing with /editor, /preview, /preview/fonts routes"
  - "Extracted editor content into EditorApp.tsx component; App.tsx is now just the Router shell"
  - "rawVideoSrc='/sample-video.mp4' bypasses staticFile() for browser Player context (Plan 01 addition)"
  - "textToCaptionPages() uses createTikTokStyleCaptions with synthetic timestamps at 3 words/second"
  - "PreviewPlayer uses aspect-ratio CSS container (1080/1920) instead of manual transform:scale()"
  - "FontGridPage uses plain CSS font rendering per D-13, not a separate Remotion Player per font"
  - "Sample video placeholder is .gitkeep in public/ directory; .mp4 files are gitignored"

patterns-established:
  - "React Router SPA with shared components between /editor and /preview"
  - "Player inputProps pattern: rawVideoSrc for browser, videoSrc for production staticFile()"
  - "textToCaptionPages() with deriveTotalDurationMs() for Player duration calculation"
  - "Font selection via URL search params (?font=FontName)"

requirements-completed: [PREV-01, PREV-02, PREV-03]

# Metrics
duration: 8min
completed: 2026-05-18
---

# Phase 12 Plan 02: Subtitle Preview Lab Summary

**SPA with /preview and /preview/fonts routes, @remotion/player rendering SubtitledVideo at 1080x1920, real-time StyleControls, textToCaptionPages conversion, and font grid with all 18 fonts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-18T12:47:30Z
- **Completed:** 2026-05-18T12:55:41Z
- **Tasks:** 2 auto tasks completed, 1 checkpoint pending
- **Files modified:** 12

## Accomplishments
- Installed @remotion/player@4.0.457 and react-router-dom@^7.15.1
- Created React Router SPA with /editor, /preview, and /preview/fonts routes
- Extracted existing editor into EditorApp.tsx; App.tsx is now Router shell
- Created PreviewPlayer component rendering SubtitledVideo via @remotion/player at 1080x1920
- Created PreviewApp with 9:16 viewport (left) + collapsible controls (right) layout
- Created TextareaInput with Spanish default text and onChange callback
- Created textToCaptionPages() utility using createTikTokStyleCaptions with synthetic timestamps
- Created FontGridPage showing all 18+1 fonts in responsive CSS grid
- Added Express /preview and /preview/{*splat} SPA fallback routes
- Added Express static serving from public/ directory for sample video
- Configured vite.config.ts publicDir for static asset serving in dev

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, SPA routing, Express /preview route, textToCaptionPages utility** - `9b27f8e` (feat)
2. **Task 2: Create PreviewApp, PreviewPlayer, TextareaInput, and FontGridPage components** - `74c8590` (feat)

## Files Created/Modified
- `services/remotion-studio/package.json` - Added @remotion/player@4.0.457 and react-router-dom@^7.15.1 dependencies
- `services/remotion-studio/src/editor/App.tsx` - Replaced with BrowserRouter Router shell with /editor, /preview, /preview/fonts routes
- `services/remotion-studio/src/editor/EditorApp.tsx` - New file: extracted editor page from old App.tsx
- `services/remotion-studio/src/editor/index.html` - Updated title to "Remotion Studio"
- `services/remotion-studio/src/server.ts` - Added /preview SPA routes and public/ static serving
- `services/remotion-studio/src/preview/PreviewApp.tsx` - New file: main preview page with 9:16 viewport + controls
- `services/remotion-studio/src/preview/PreviewPlayer.tsx` - New file: @remotion/player wrapper for SubtitledVideo
- `services/remotion-studio/src/preview/TextareaInput.tsx` - New file: editable textarea with Spanish default
- `services/remotion-studio/src/preview/textToCaptions.ts` - New file: text-to-captions conversion utility
- `services/remotion-studio/src/preview/FontGridPage.tsx` - New file: responsive font grid with CSS rendering
- `services/remotion-studio/vite.config.ts` - Added publicDir for static asset serving
- `services/remotion-studio/Dockerfile` - Added COPY public/ for sample video in Docker builds

## Decisions Made
- Used React Router BrowserRouter instead of conditional rendering for SPA routing (per D-02 and RESEARCH anti-patterns)
- rawVideoSrc="/sample-video.mp4" in PreviewPlayer bypasses staticFile() context mismatch (Plan 01 addition)
- textToCaptionPages() at 3 words/second synthetic pacing matches natural Spanish speech rate
- Font grid uses CSS rendering with loadFont() — not separate Remotion Players per font (per D-13)
- Sample video is represented by .gitkeep placeholder since .mp4 files are in .gitignore
- Derived totalDurationMs from last TikTokPage token's toMs for Remotion Player duration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The TikTokPage token structure uses `fromMs/toMs` (not `startMs/endMs`). Fixed deriveTotalDurationMs() to use the correct property names.

## User Setup Required

⚠️ **Sample Video Required:** The preview page needs a real MP4 video file for the subtitle overlay background. Place a short (5-10 second) Spanish talking-head MP4 at:
- **Local dev:** `services/remotion-studio/public/sample-video.mp4`
- **Docker:** The Dockerfile copies `public/` into the container

The preview will render subtitles over a black background if no video file is provided.

## Next Phase Readiness
- /preview and /preview/fonts routes are implemented and served by Express
- @remotion/player renders SubtitledVideo with real-time SubtitleConfig controls
- All 18+1 fonts load correctly in font grid via @remotion/google-fonts loadFont()
- textToCaptionPages() converts arbitrary text to TikTokPage[] for Player playback
- Ready for human verification of the preview lab functionality (Task 3 checkpoint)

## Known Stubs
- `public/sample-video.mp4` is a placeholder (0-byte .gitkeep). A real sample video must be provided by the user for full functionality. Without it, the Remotion Player will show subtitles on a black background.

---
*Phase: 12-subtitle-preview-lab*
*Completed: 2026-05-18*