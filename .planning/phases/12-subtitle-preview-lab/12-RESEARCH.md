# Phase 12: Subtitle Preview Lab - Research

**Researched:** 2026-05-17
**Domain:** Interactive web preview, Remotion Player integration, React SPA routing
**Confidence:** HIGH

## Summary

This phase adds an interactive `/preview` page to the existing `remotion-studio` service that provides pixel-accurate subtitle style previews using `@remotion/player`. The `<Player>` component renders the same `SubtitledVideo` composition used in production, ensuring WYSIWYG matching between preview and final render. The key technical challenges are: (1) integrating `@remotion/player` into a Vite+React SPA that currently uses no router, (2) properly importing cross-service shared code (pipeline-config, fonts, compositions) into the preview page, (3) scaling a 1080×1920 composition viewport to fit a desktop browser panel, and (4) feeding the Remotion Player with synthetic caption data from textarea input by converting arbitrary text to `TikTokPage[]` format.

The existing codebase provides strong foundations: `StyleControls.tsx` and `LayoutSelector.tsx` are reusable shared components, `fonts.ts` already handles all 18 Google Fonts with `loadFont()`, and `captions.ts` has `transcriptToCaptionPages()` that can be leveraged for text-to-captions conversion. The main new dependency is `@remotion/player@4.0.457` (matches Remotion ecosystem version).

**Primary recommendation:** Use `@remotion/player` with the exact `SubtitledVideo` composition, scale the 1080×1920 output via CSS `transform: scale()` + `aspect-ratio`, add React Router for `/editor` and `/preview` routes within the existing SPA, and extend `StyleControls` with `lineHeight` and `pastWordOpacity` controls.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: `/preview` page served by existing `remotion-studio` Express server — no new Docker container
- D-02: Single SPA with routing (`/editor` and `/preview` coexist). One bundle, one build step. Shared component library.
- D-03: Preview focuses on SubtitleConfig parameters only — no visual effects or title overlays
- D-04: Use `@remotion/player` (`<Player>` component) to render exact same `SubtitledVideo` composition
- D-05: Remotion Player renders at native 1080×1920 composition size; CSS `transform: scale()` scales viewport down
- D-06: Sample video MP4 bundled in container's `public/` directory, loaded via `staticFile()`
- D-07: Add `pastWordOpacity` field to `SubtitleConfig` (default 0.4). All 4 layout components apply opacity to was-active (past) words.
- D-08: Layout: 9:16 preview viewport on left, collapsible control panels on right (mirrors `/editor` pattern)
- D-09: Reuse `StyleControls.tsx`, extend with `lineHeight` and `pastWordOpacity`
- D-10: Word-by-word subtitle cycling uses Remotion Player playback controls (play/pause/scrub)
- D-11: Sample text from editable textarea with hardcoded Spanish default. Text converted to `TikTokPage[]` at runtime.
- D-12: Font grid view at `/preview/fonts` showing all 18 fonts. Click font → return to main preview.
- D-13: Font grid uses CSS font rendering with `@remotion/google-fonts` `loadFont()`. Each cell is plain HTML/CSS, not a Remotion composition.

### the agent's Discretion
- Exact default Spanish paragraph content for the textarea
- Sample video selection (what MP4 to bundle, how long)
- CSS scale-down implementation details (transform-origin, responsive sizing)
- Layout of control panels (section grouping, collapse behavior)
- Color picker vs color input implementation
- Font grid cell size and layout (3 columns? 4? responsive?)
- How textarea text converts to TikTokPage[] for the player
- Whether lineHeight and letterSpacing sliders have specific min/max/step values
- React Router vs conditional rendering for SPA routing
- `@remotion/player` import and bundle integration details

### Deferred Ideas (OUT OF SCOPE)
- Visual effects preview (zooms, transitions)
- Title overlay preview (stays in /editor)
- Custom video upload
- Export/apply config to pipeline
- Responsive multi-device preview (9:16 only in v1)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PREV-01 | Web page at `/preview` renders a 9:16 viewport with sample video/image background and subtitle text overlay, using Remotion's rendering engine for pixel-accurate preview | @remotion/player `<Player>` component renders SubtitledVideo at 1080×1920, CSS scale-down to viewport. staticFile() loads sample MP4 from `public/`. |
| PREV-02 | All 18 available fonts render with the same Remotion font loading pipeline used in production renders — preview matches final output exactly | fonts.ts `loadFont()` + `fontFamily` string from @remotion/google-fonts used for both Player and font grid. Same fonts.ts shared from remotion-renderer. |
| PREV-03 | Real-time parameter controls for all SubtitleConfig fields (layout, fontFamily, fontSize, activeColor, inactiveColor, letterSpacing, lineHeight, backgroundHighlight, outlineColor, outlineWidth, position, bottomOffset, pastWordOpacity) — changes reflect in preview without page reload | React local state drives `inputProps` on `<Player>`. StyleControls extended with lineHeight + pastWordOpacity. No server round-trip for preview updates. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Subtitle rendering preview | Browser / Client | — | Remotion `<Player>` runs entirely in-browser, rendering React components to canvas |
| Parameter controls UI | Browser / Client | — | React local state drives Player inputProps — no server roundtrip |
| Font loading | Browser / Client | — | @remotion/google-fonts loadFont() is client-side, fetches from Google Fonts CDN |
| Config persistence (Save) | API / Backend | — | PUT /api/config writes to disk, same as editor |
| Static video serving | CDN / Static | — | Sample MP4 served from `public/` via Remotion's staticFile() mechanism |
| Text-to-captions conversion | Browser / Client | — | Synthetic timestamp generation runs in-browser, no API needed |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@remotion/player` | 4.0.457 | React component for interactive Remotion preview in browser | Official Remotion Player — renders compositions in-browser without server rendering. Required version matches remotion ecosystem. [VERIFIED: npm registry] |
| `react-router-dom` | 7.15.1 | SPA routing for /editor and /preview | Industry-standard React router. v7 supports data router patterns but simple BrowserRouter suffices here. [VERIFIED: npm registry] |
| `remotion` | 4.0.457 | Core Remotion SDK (already in remotion-studio) | Must match @remotion/player version exactly. Already a dependency. [VERIFIED: npm registry] |
| `@remotion/captions` | 4.0.457 | `createTikTokStyleCaptions()` and `TikTokPage` type (already in remotion-studio) | Used to convert textarea text to caption pages. Already a dependency. [VERIFIED: npm registry] |
| `@remotion/google-fonts` | 4.0.457 | Font loading for all 18 fonts (already in remotion-studio) | Same `loadFont()` function used in production renders. Already a dependency. [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express` | ^5.2.1 | Express server for API + static serving (already in remotion-studio) | Serving the SPA and API routes. Already a dependency. |
| `vite` | ^5.4.0 | Build tool for SPA (already in remotion-studio devDependencies) | Building the preview and editor SPA. Already configured. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Router | Conditional rendering (if/else in App.tsx) | Conditional rendering avoids a new dependency but breaks URL-based navigation and makes font grid routing awkward. React Router is the right tool for two distinct pages sharing components. |
| @remotion/player | Remotion Studio (`npx remotion studio`) | Studio is a dev tool for debugging compositions, not embeddable in a custom SPA. Player gives full control over UI, controls, and inputProps. |

**Installation:**
```bash
cd services/remotion-studio
npm install @remotion/player@4.0.457 react-router-dom@^7.15.1
```

**Version verification:**
```bash
npm view @remotion/player@4.0.457 version    # 4.0.457 ✓
npm view react-router-dom version             # 7.15.1
npm view remotion version                    # 4.0.457 (matches)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @remotion/player@4.0.457 | npm | 4+ years | 500K+/wk | github.com/remotion-dev/remotion | N/A (slopcheck unavailable) | Approved — official Remotion package, same monorepo as remotion core |
| react-router-dom@7.15.1 | npm | 10+ years | 25M+/wk | github.com/remix-run/react-router | N/A (slopcheck unavailable) | Approved — industry standard, massive ecosystem |

*Both packages are `[ASSUMED]` for legitimacy since slopcheck was unavailable, but both are extremely well-known, official packages with massive adoption. @remotion/player is the same monorepo as Remotion (remotion-dev/remotion on GitHub). react-router-dom is from Remix Software (remix-run/react-router). No realistic concern about package legitimacy.*

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Browser (Single SPA)
┌─────────────────────────────────────────────────────────────────┐
│                          React Router                            │
│  ┌──────────────────┐              ┌──────────────────────────┐ │
│  │  /editor Route   │              │  /preview Route          │ │
│  │                  │              │                          │ │
│  │  ┌────────────┐  │              │  ┌────────────────────┐  │ │
│  │  │ LayoutSelector │◄──── shared ──►│ LayoutSelector     │  │ │
│  │  │ StyleControls  │◄──── shared ──►│ StyleControls      │  │ │
│  │  │ TitleEditor   │              │  │ (extended)         │  │ │
│  │  │ ConfigPreview │              │  │ TextareaInput      │  │ │
│  │  └────────────┘  │              │  └────────────────────┘  │ │
│  │                  │              │                          │ │
│  │  PUT /api/config │              │  ┌────────────────────┐  │ │
│  │  (save pipeline  │              │  │ @remotion/player   │  │ │
│  │   config)        │              │  │ <Player>            │  │ │
│  │                  │              │  │  component=         │  │ │
│  └──────────────────┘              │  │   SubtitledVideo   │  │ │
│                                     │  │  compositionWidth=  │  │ │
│                                     │  │   1080             │  │ │
│                                     │  │  compositionHeight= │  │ │
│                                     │  │   1920             │  │ │
│                                     │  │  inputProps=        │  │ │
│                                     │  │   {subtitleConfig,  │  │ │
│                                     │  │    captionPages,    │  │ │
│                                     │  │    videoSrc}        │  │ │
│                                     │  └────────────────────┘  │ │
│                                     │                          │ │
│                                     │  /preview/fonts Route   │ │
│                                     │  ┌────────────────────┐  │ │
│                                     │  │ Font Grid (CSS)    │  │ │
│                                     │  │ 18 font cards       │  │ │
│                                     │  └────────────────────┘  │ │
│                                     └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

                    │
                    │ Express API
                    ▼
┌──────────────────────────────┐
│  remotion-studio server.ts   │
│  GET/PUT /api/config         │
│  GET /editor (SPA static)    │
│  GET /preview (SPA static)   │
└──────────────────────────────┘
```

### Recommended Project Structure
```
services/remotion-studio/
├── src/
│   ├── server.ts                    # Express server (add /preview route)
│   ├── index.ts                     # Server entry point (unchanged)
│   ├── pipeline-config.ts           # Shared (copied from renderer at build)
│   ├── fonts.ts                     # Shared (copied from renderer at build)
│   ├── captions.ts                  # Shared (copied from renderer at build)
│   ├── compositions/                # Shared (copied from renderer at build)
│   │   ├── LayoutDispatcher.tsx
│   │   ├── TikTokLayout.tsx
│   │   ├── SentenceLayout.tsx
│   │   ├── BarLayout.tsx
│   │   ├── KaraokeLayout.tsx
│   │   ├── shared-styles.ts
│   │   ├── TitleOverlay.tsx
│   │   └── ZoomContainer.tsx
│   │   └── JumpCutTransition.tsx
│   ├── Root.tsx                      # Shared (copied from renderer at build)
│   ├── editor/                      # EXISTING editor SPA
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── App.tsx                  # MODIFIED: wrap with React Router
│   │   └── components/
│   │       ├── ConfigPreview.tsx
│   │       ├── LayoutSelector.tsx    # SHARED: reused by preview
│   │       ├── StyleControls.tsx     # EXTENDED: add lineHeight, pastWordOpacity
│   │       └── TitleEditor.tsx
│   └── preview/                      # NEW: preview SPA pages
│       ├── PreviewApp.tsx            # Main preview page (Player + controls)
│       ├── FontGridPage.tsx          # /preview/fonts route
│       ├── PreviewPlayer.tsx         # Wrapper for @remotion/player
│       ├── TextareaInput.tsx         # Editable sample text
│       └── textToCaptions.ts         # text → TikTokPage[] conversion
├── public/                           # NEW: sample video for staticFile()
│   └── sample-video.mp4             # 5-10 second talking-head clip
├── vite.config.ts                    # MODIFIED: add preview entry point
├── Dockerfile                        # MODIFIED: COPY sample video
└── package.json                      # MODIFIED: add @remotion/player, react-router-dom
```

### Pattern 1: Remotion Player Integration (PRIMARY PATTERN)

**What:** Embed Remotion compositions in a React SPA using `@remotion/player`
**When to use:** This is the core pattern for the preview page

```tsx
// Source: Official Remotion docs https://www.remotion.dev/docs/player/player
import { Player } from '@remotion/player';
import { SubtitledVideo } from '../compositions/Root'; // The same composition used in production

function PreviewPlayer({ subtitleConfig, captionPages, videoSrc }) {
  return (
    <Player
      component={SubtitledVideo}           // Direct component reference, NOT <Composition>
      durationInFrames={150}                // 5 seconds at 30fps
      compositionWidth={1080}               // Native 9:16 width
      compositionHeight={1920}             // Native 9:16 height
      fps={30}
      controls={true}                       // Play/pause/scrub controls
      inputProps={{
        videoSrc,
        captionPages,
        subtitleConfig,
        subtitleLayout: subtitleConfig.layout,
        titles: [],
        zoomEvents: [],
        transitionEvents: [],
        totalDurationMs: 5000,
      }}
      style={{ width: '100%' }}             // Scale via aspect-ratio container
      loop={true}
    />
  );
}
```

**Critical:** `<Player>` takes `component` directly — do **NOT** wrap in `<Composition>`. The `<Composition>` component is only for `registerRoot()` and server rendering.

### Pattern 2: CSS Scale-Down for 9:16 Viewport

**What:** Render at 1080×1920 internally but display at a smaller browser size
**When to use:** The preview viewport must match production dimensions exactly

```tsx
// The Player component natively handles scaling via its style prop and aspect-ratio
// Per Remotion docs (scaling page), the preferred approach is:
function PreviewViewport() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        margin: 'auto',
        aspectRatio: '1080 / 1920',  // 9:16 aspect ratio
        maxHeight: '100%',
        maxWidth: '100%',
      }}>
        <Player
          component={SubtitledVideo}
          compositionWidth={1080}
          compositionHeight={1920}
          // ... other props
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
```

The `<Player>` component automatically scales the internal rendering to fit the specified `style.width`. Using `aspectRatio: '1080/1920'` on the container ensures the preview maintains the correct 9:16 proportions at any viewport size. No manual `transform: scale()` is needed — Remotion Player handles this internally.

### Pattern 3: Text-to-TikTokPage Conversion

**What:** Convert arbitrary text from textarea into `TikTokPage[]` format for the Player
**When to use:** Preview needs caption data but doesn't have a real Whisper transcript

```typescript
// Approach: Leverage transcriptToCaptionPages() with a synthetic WhisperTranscript
import { createTikTokStyleCaptions } from '@remotion/captions';
import type { TikTokPage, Caption } from '@remotion/captions';

interface SyntheticWord {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
  confidence: number;
}

function textToCaptionPages(
  text: string,
  options: { wordsPerSecond?: number } = {}
): TikTokPage[] {
  const { wordsPerSecond = 3 } = options;
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [];

  const wordDuration = 1 / wordsPerSecond; // seconds per word
  const syntheticWords: SyntheticWord[] = words.map((word, i) => ({
    word,
    start: i * wordDuration,
    end: (i + 1) * wordDuration,
    confidence: 0.95,
  }));

  const captions: Caption[] = syntheticWords.map((w, i) => ({
    text: i === 0 ? w.word : ` ${w.word}`,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
    confidence: w.confidence,
  }));

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: 1500,
  });

  return pages;
}
```

This uses `@remotion/captions.createTikTokStyleCaptions()` directly — the same function used in production `captions.ts` — ensuring the page-breaking algorithm is identical. The synthetic timestamps are evenly distributed at ~3 words/second, a natural Spanish speech pace.

### Pattern 4: pastWordOpacity in Layout Components

**What:** Apply configurable opacity to words that were active (already spoken) but are no longer the active word
**When to use:** All 4 layout components need this

```tsx
// In CaptionWord (TikTokLayout.tsx) — current behavior:
const isActive = i === currentTokenIdx;
const wasActive = i < currentTokenIdx;
// Current: color = isActive ? activeColor : inactiveColor
// New: add opacity for past words
const pastOpacity = config.pastWordOpacity ?? DEFAULT_SUBTITLE_CONFIG.pastWordOpacity;
// Apply:
// - isActive: full opacity, activeColor
// - wasActive: pastOpacity, inactiveColor  
// - future (neither): full opacity, inactiveColor
```

Currently `TikTokLayout` does NOT apply opacity to past words — it only changes color. `SentenceLayout` already has `const PAST_OPACITY = 0.5` hardcoded. The implementation:

- TikTokLayout: Add `opacity` prop to `CaptionWord`, apply `pastWordOpacity` for `wasActive` words
- SentenceLayout: Replace hardcoded `PAST_OPACITY = 0.5` with `config.pastWordOpacity ?? 0.4`
- BarLayout: Add opacity for `wasActive` words (currently color-only)
- KaraokeLayout: Apply `pastWordOpacity` to baseline (inactive) layer for `wasActive` words

### Pattern 5: React Router in Existing SPA

**What:** Add client-side routing to the existing Vite React SPA
**When to use:** The SPA currently has no router — App.tsx renders the editor directly

```tsx
// App.tsx - Modified to use React Router
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { EditorApp } from './EditorApp';
import { PreviewApp } from '../preview/PreviewApp';
import { FontGridPage } from '../preview/FontGridPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/editor" element={<EditorApp />} />
        <Route path="/editor/*" element={<EditorApp />} />
        <Route path="/preview" element={<PreviewApp />} />
        <Route path="/preview/fonts" element={<FontGridPage />} />
        <Route path="/" element={<Navigate to="/editor" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

The server.ts needs to route both `/editor` and `/preview` (and sub-paths like `/preview/fonts`) to the same SPA `index.html` file. This is a standard SPA fallback pattern already used for `/editor`.

### Anti-Patterns to Avoid

- **Don't use `<Composition>` inside `<Player>`**: The Player takes a `component` prop directly, not a `<Composition>` wrapper. Wrapping in `<Composition>` will fail silently.
- **Don't use `transform: scale()` manually**: Remotion Player handles scaling internally when you set `style={{ width: '100%' }}` and use aspect-ratio on the container. Manual CSS transform scaling can cause blurry text or incorrect hit-testing.
- **Don't create a separate Vite build for /preview**: Both routes share one bundle (D-02). React Router handles client-side routing.
- **Don't use conditional rendering instead of React Router**: The font grid requires a distinct URL (`/preview/fonts`) for navigation. Conditional rendering makes this impossible.
- **Don't hardcode `PAST_OPACITY = 0.5` in SentenceLayout then reference it elsewhere**: The value must come from `config.pastWordOpacity` with fallback to `DEFAULT_SUBTITLE_CONFIG.pastWordOpacity` (0.4).
- **Don't serve the sample video from Express static**: Use Remotion's `staticFile()` from the `public/` directory — this matches how production works and ensures the Player can load it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 9:16 video preview with Remotion rendering | Custom iframe/canvas solution | `@remotion/player` `<Player>` component | Pixel-accurate rendering matches production. Custom solutions won't match. |
| Text → caption pages | Custom pagination algorithm | `@remotion/captions.createTikTokStyleCaptions()` | Same algorithm used in production. Ensures page-break behavior matches. |
| Font loading in browser | Custom @font-face declarations | `@remotion/google-fonts` `loadFont()` | Same function used in production renders. Ensures font-family strings match exactly. |
| Router for SPA pages | Hash-based or conditional routing | `react-router-dom` BrowserRouter | Standard solution, supports URL-based navigation, back button works. |
| Scaling 1080×1920 to viewport | Manual CSS `transform: scale()` calculations | Remotion Player `style={{ width: '100%' }}` with `aspect-ratio` container | Player handles internal canvas scaling; aspect-ratio container handles layout. |

**Key insight:** The entire point of this phase is that the preview uses *the exact same rendering pipeline* as production. Any shortcut (CSS font rendering instead of Remotion, custom caption pagination instead of `createTikTokStyleCaptions`) defeats the purpose. The only CSS-rendered component is the font grid cards.

## Common Pitfalls

### Pitfall 1: `<Player>` does NOT use `<Composition>`
**What goes wrong:** Wrapping `SubtitledVideo` in `<Composition>` inside a `<Player>` — the Player ignores it and renders nothing.
**Why it happens:** People assume Player needs the same Composition registration as `registerRoot()`, but Player takes `component` directly.
**How to avoid:** Pass `component={SubtitledVideo}` to `<Player>`, not `<Composition>`. Set `durationInFrames`, `compositionWidth`, `compositionHeight`, `fps`, and `inputProps` as separate props.
**Warning signs:** Blank white canvas with no error in console.

### Pitfall 2: staticFile() requires files in `public/` at build time
**What goes wrong:** Sample video placed in a different directory or referenced by absolute path — Player can't find it.
**Why it happens:** `staticFile()` generates URLs relative to Remotion's static file serving, which only serves files from the `public/` directory alongside `package.json`.
**How to avoid:** Place `sample-video.mp4` in `services/remotion-studio/public/` and reference it as `staticFile('sample-video.mp4')`. Add a Dockerfile COPY step to include it.
**Warning signs:** Video shows as black/missing in Player but works in production renders with a real video.

### Pitfall 3: Font loading in Player requires calling loadFont() before render
**What goes wrong:** Fonts flash or fall back to system default on first render in the Player.
**Why it happens:** `SubtitledVideo` uses `delayRender`/`continueRender` for font loading, which works in server rendering but needs to be handled differently in Player context.
**How to avoid:** Pre-load all fonts before mounting the Player. Call `loadFont()` for the default font in a `useEffect` before rendering. The `SubtitledVideo` component already handles this via `delayRender`, but the preview page should eagerly load all 18 fonts on page load for the font grid.
**Warning signs:** Fonts show correctly after first interaction but wrong on initial load.

### Pitfall 4: React Router and Express SPA fallback mismatch
**What goes wrong:** `/preview/fonts` returns 404 because Express doesn't know about it, or `/editor` loads but `/editor/` doesn't.
**Why it happens:** Express needs a catch-all route for the SPA that serves index.html for any path under both `/editor` and `/preview`.
**How to avoid:** Change Express SPA fallback from `/editor/{*splat}` to serve the same index.html for both routes. Add a `/preview/{*splat}` catch-all that serves the same `index.html`.
**Warning signs:** Direct browser navigation to `/preview/fonts` returns 404, but client-side navigation works.

### Pitfall 5: Importing cross-service code in SPA
**What goes wrong:** Vite build fails because imports like `../../pipeline-config.js` resolve to the renderer's source directory, which isn't available at build time.
**Why it happens:** The Dockerfile copies renderer source files into the studio's `src/` directory. The Vite build in Docker works, but local dev fails.
**How to avoid:** Maintain the same import pattern already established: imports reference `../../pipeline-config.js` which is copied into `src/` at Docker build time. For local dev, the Vite config aliases or the Dockerfile COPY step ensures files are in the right place. Consider adding a `dev:copy` script that copies shared files locally.
**Warning signs:** TypeScript/IDE can't resolve `../../pipeline-config.js` in local dev.

### Pitfall 6: pastWordOpacity not applied in all layouts
**What goes wrong:** TikTokLayout applies the opacity, but SentenceLayout still uses hardcoded 0.5, and BarLayout/KaraokeLayout don't apply it at all.
**Why it happens:** Each layout has its own rendering logic — changes must be applied consistently across all 4.
**How to avoid:** Read `pastWordOpacity` from `SubtitleConfig` in every layout with fallback to `DEFAULT_SUBTITLE_CONFIG.pastWordOpacity` (0.4). Update shared-styles.ts with helper if needed.
**Warning signs:** Karaoke layout shows past words at full opacity; Sentence layout ignores the slider.

## Code Examples

### Example 1: Basic Player Setup (from Remotion official docs)

```tsx
// Source: https://www.remotion.dev/docs/player/player
import { Player } from '@remotion/player';
import { SubtitledVideo } from './compositions/Root';

export function PreviewPlayer({ subtitleConfig, captionPages, videoSrc }) {
  return (
    <Player
      component={SubtitledVideo}
      durationInFrames={150}
      compositionWidth={1080}
      compositionHeight={1920}
      fps={30}
      controls
      loop
      inputProps={{
        videoSrc,
        captionPages,
        subtitleConfig,
        subtitleLayout: subtitleConfig.layout,
        titles: [],
        zoomEvents: [],
        transitionEvents: [],
        totalDurationMs: 5000,
      }}
      style={{ width: '100%' }}
    />
  );
}
```

### Example 2: Text to TikTokPage with createTikTokStyleCaptions

```tsx
// Uses the same createTikTokStyleCaptions() function as production captions.ts
import { createTikTokStyleCaptions } from '@remotion/captions';
import type { TikTokPage, Caption } from '@remotion/captions';

export function textToCaptionPages(
  text: string,
  wordsPerSecond: number = 3
): TikTokPage[] {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const wordDurationMs = 1000 / wordsPerSecond;

  const captions: Caption[] = words.map((word, i) => ({
    text: i === 0 ? word : ` ${word}`,
    startMs: Math.round(i * wordDurationMs),
    endMs: Math.round((i + 1) * wordDurationMs),
    timestampMs: Math.round((i + 0.5) * wordDurationMs),
    confidence: 0.95,
  }));

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: 1500,
  });

  return pages;
}
```

### Example 3: Player Scaling Container (from Remotion docs)

```tsx
// Source: https://www.remotion.dev/docs/player/scaling
// Remotion Player handles scaling internally when you set width via style
// Use aspect-ratio on the container to maintain correct dimensions

function PreviewContainer({ subtitleConfig, captionPages, videoSrc }) {
  return (
    <div style={{
      width: '100%',
      height: '100vh',
      position: 'relative',
      background: '#000',
    }}>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        margin: 'auto',
        aspectRatio: '1080 / 1920',
        maxHeight: '100%',
        maxWidth: '40%',  // Side panel takes ~60%
      }}>
        <Player
          component={SubtitledVideo}
          compositionWidth={1080}
          compositionHeight={1920}
          durationInFrames={150}
          fps={30}
          controls
          loop
          inputProps={{ videoSrc, captionPages, subtitleConfig }}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
```

### Example 4: Adding pastWordOpacity to SubtitleConfig

```typescript
// In pipeline-config.ts — add to SubtitleConfig interface:
export interface SubtitleConfig {
  layout: SubtitleLayoutMode;
  fontFamily?: string;
  fontSize?: number;
  activeColor?: string;
  inactiveColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  backgroundHighlight?: BackgroundHighlight;
  textShadow?: TextShadow;
  letterSpacing?: number;
  position?: SubtitlePosition;
  lineHeight?: number;
  bottomOffset?: number;
  pastWordOpacity?: number;  // NEW: opacity for was-active words (0-1, default 0.4)
}

// In DEFAULT_SUBTITLE_CONFIG — add default:
export const DEFAULT_SUBTITLE_CONFIG: Required<...> = {
  fontSize: 58,
  activeColor: "#FFFF00",
  inactiveColor: "#FFFFFF",
  outlineColor: "#000000",
  outlineWidth: 3,
  position: "bottom-center",
  lineHeight: 1.3,
  bottomOffset: 250,
  pastWordOpacity: 0.4,  // NEW
};
```

### Example 5: Font Grid Card (CSS-only, no Player needed)

```tsx
// Each font card uses loadFont() from fonts.ts and applies fontFamily via CSS
import { AVAILABLE_FONTS, loadFont } from '../fonts';

function FontCard({ fontName, onSelect }: { fontName: string; onSelect: (font: string) => void }) {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    loadFont(fontName).then(() => setLoaded(true));
  }, [fontName]);

  return (
    <div
      onClick={() => onSelect(fontName)}
      style={{
        fontFamily: loaded ? fontName : 'monospace',
        padding: 16,
        background: '#1e1e2e',
        borderRadius: 8,
        border: '1px solid #333',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{fontName}</div>
      <div style={{ fontSize: 24 }}>Hola mundo ¿Cómo estás?</div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| Manual CSS transform scaling for Remotion preview | `aspect-ratio` CSS + Player `style={{ width }}` | Remotion v3.2.43+ | No manual scale math needed. Player handles canvas sizing. |
| Conditional rendering for SPA pages | React Router v6/v7 with BrowserRouter | React Router v6+ | URL-based navigation, back button support, clean architecture |
| Player with `<Composition>` children | `<Player component={...}>` direct prop | Remotion v3+ | Don't wrap in Composition, pass component directly |
| @remotion/player v3 separate from Remotion v4 | All @remotion/* packages must match v4.0.457 | Remotion v4 | Mismatched versions cause cryptic render failures |

**Deprecated/outdated:**
- `@remotion/player` v3.x: Must match Remotion v4.0.457 ecosystem version. Mixing v3 Player with v4 core causes runtime errors.
- React Router v5 `<Switch>`: v7 uses `<Routes>` and `<Route>` elements. BrowserRouter is still the correct approach.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@remotion/player@4.0.457` works identically to production `@remotion/renderer` for rendering the SubtitledVideo composition | Standard Stack | Player renders the same React component tree — difference would mean preview doesn't match production |
| A2 | The `SubtitledVideo` component in `Root.tsx` can be used as a direct `component` prop to `<Player>` without the `registerRoot` / `<Composition>` wrapper | Architecture Patterns | If true, we need a thin wrapper component; but Remotion docs confirm `component` prop is supported |
| A3 | `staticFile()` works in Player context (browser) the same as in server rendering context | Code Examples | Player docs show `staticFile()` works client-side; if not, we'd need a different asset serving mechanism |
| A4 | `createTikTokStyleCaptions()` works standalone outside of the production pipeline (i.e., without the full WhisperTranscript structure) | Code Examples | We're passing synthetic `Caption[]` directly, not going through `transcriptToCaptionPages()` — should work since `createTikTokStyleCaptions` only needs `Caption[]` |
| A5 | React Router v7 `BrowserRouter` is compatible with Vite SPA builds and Express static serving | Architecture Patterns | Standard pattern — very low risk. v7 BrowserRouter is backward compatible with v6. |
| A6 | The existing `SentenceLayout` `PAST_OPACITY = 0.5` hardcode should be replaced with `config.pastWordOpacity ?? 0.4` to match the new default | Architecture Patterns | If wrong, SentenceLayout would have inconsistent behavior |

## Open Questions (RESOLVED)

1. **Sample video selection** — RESOLVED: D-06 specifies a sample MP4 bundled in `public/`. Plan 02 creates a placeholder and documents user-provided replacement.
   - What we know: D-06 specifies a sample MP4 bundled in `public/`. Must be a talking-head clip for subtitle context.
   - Resolution: Single 5-second placeholder, user provides actual clip. Per D-06.

2. **Player composition duration** — RESOLVED: Calculate `durationInFrames` from the last caption page's `endMs`. When text changes, recalculate and update Player's `durationInFrames` prop. Per CONTEXT.md D-10 (standard Remotion playback controls).
   - Resolution: Dynamic `durationInFrames` computed from TikTokPage end time. Per D-10.

3. **Video source when textarea text differs from sample video audio** — RESOLVED: Player is muted by default with `initiallyMuted={true}`. Subtitles are driven by synthetic timestamps from textarea text — independent of video audio. Per CONTEXT.md D-10. Additionally, the `rawVideoSrc` prop added in Plan 01 allows bypassing `staticFile()` for browser context.
   - Resolution: Initially muted, subtitles independent. `rawVideoSrc` ensures video loads via direct URL in Player context.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build & runtime | ✓ | 22.x | — |
| npm | Package management | ✓ | 10.x | — |
| Docker | Container runtime | ✓ | — | — |
| Chrome/Chromium | Remotion Player rendering | ✓ | (via npx remotion browser ensure) | — |
| Vite | SPA build | ✓ | 5.4.x | — |
| React | SPA framework | ✓ | 19.x | — |
| Remotion 4.0.457 | Player + compositions | ✓ | 4.0.457 | — |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** None needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already in remotion-renderer) |
| Config file | services/remotion-renderer/vitest.config.ts (existing) |
| Quick run command | `cd services/remotion-studio && npx vitest run --reporter=verbose` |
| Full suite command | `cd services/remotion-studio && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PREV-01 | Player renders SubtitledVideo at 1080×1920 | unit (React Testing Library) | `vitest run src/preview/__tests__/PreviewPlayer.test.tsx -x` | ❌ Wave 0 |
| PREV-02 | All 18 fonts load via loadFont() | unit | `vitest run src/__tests__/fonts.test.ts -x` | ❌ Wave 0 |
| PREV-03 | StyleControls updates pastWordOpacity | unit (React Testing Library) | `vitest run src/editor/__tests__/StyleControls.test.tsx -x` | ❌ Wave 0 |
| PREV-03 | textToCaptionPages returns valid TikTokPage[] | unit | `vitest run src/preview/__tests__/textToCaptions.test.ts -x` | ❌ Wave 0 |
| PREV-01 | /preview route renders in SPA | integration (E2E) | manual browser test | ❌ manual |
| PREV-02 | Font grid renders all 18 fonts | visual | manual browser test | ❌ manual |

### Sampling Rate
- **Per task commit:** `vitest run --reporter=verbose`
- **Per wave merge:** `vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/preview/__tests__/PreviewPlayer.test.tsx` — React component test for Player mount
- [ ] `src/preview/__tests__/textToCaptions.test.ts` — Unit tests for text-to-captions conversion
- [ ] `src/editor/__tests__/StyleControls.test.tsx` — Test extended StyleControls with pastWordOpacity and lineHeight
- [ ] `src/__tests__/fonts.test.ts` — Verify all 18 fonts load
- [ ] `src/preview/__tests__/FontGridPage.test.tsx` — Font grid renders all fonts
- [ ] Vite config for test: Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` in remotion-studio devDependencies

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Internal Docker network only (same as /editor) |
| V3 Session Management | no | No sessions (same as /editor) |
| V4 Access Control | no | No auth on preview page (internal tool) |
| V5 Input Validation | yes | Textarea input sanitized before conversion to captions; SubtitleConfig validated |
| V6 Cryptography | no | No crypto needed |

### Known Threat Patterns for React SPA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via textarea input | Tampering | Textarea text goes into TikTokPage tokens — Remotion renders these as text spans, not HTML. No innerHTML. |
| XSS via subtitle config | Tampering | SubtitleConfig values are React props (numbers, strings) — rendered as CSS properties. No HTML injection vector. |
| Path traversal via /preview route | Spoofing | Express serves static files from known dist directory. Standard express.static mitigations apply. |

## Sources

### Primary (HIGH confidence)
- Remotion Player official docs — https://www.remotion.dev/docs/player/player (component API, inputProps, controls, PlayerRef)
- Remotion Player scaling docs — https://www.remotion.dev/docs/player/scaling (aspect-ratio approach, width style prop)
- Remotion staticFile() docs — https://www.remotion.dev/docs/staticfile (public/ directory, asset serving)
- Codebase analysis — services/remotion-renderer/src/ (TikTokLayout, SentenceLayout, BarLayout, KaraokeLayout, LayoutDispatcher, Root.tsx, captions.ts, pipeline-config.ts, fonts.ts, shared-styles.ts)
- Codebase analysis — services/remotion-studio/src/ (server.ts, App.tsx, StyleControls.tsx, LayoutSelector.tsx, vite.config.ts, Dockerfile, package.json)

### Secondary (MEDIUM confidence)
- npm registry verification — @remotion/player@4.0.457 exists, remotion@4.0.457 matches, react-router-dom@7.15.1 available
- Remotion Player examples — https://www.remotion.dev/docs/player/examples (lazyComponent, inputProps patterns)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All packages verified on npm registry, official Remotion docs consulted, existing codebase thoroughly analyzed
- Architecture: HIGH — Pattern is straightforward (Player component in React SPA), existing codebase provides clear patterns for shared components and imports
- Pitfalls: HIGH — Identified 6 specific pitfalls based on Remotion Player API analysis and codebase inspection

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — stable libraries, no fast-moving dependencies)