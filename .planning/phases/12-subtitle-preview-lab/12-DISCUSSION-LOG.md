# Phase 12: Subtitle Preview Lab - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 12-subtitle-preview-lab
**Areas discussed:** Architecture & service placement, Preview rendering approach, Parameters & controls UX, Sample content & font grid

---

## Architecture & service placement

| Option | Description | Selected |
|--------|-------------|----------|
| Extend remotion-studio | Add /preview route to existing Express server. Reuse infrastructure, share imports. Single container, two SPAs. | ✓ |
| New preview-service container | Separate Docker container with own Express + Vite. Full isolation but duplicates code. | |
| Agent discretion | Pick the best approach | |

**User's choice:** Extend remotion-studio
**Notes:** User chose to reuse existing infrastructure rather than creating a new container.

| Option | Description | Selected |
|--------|-------------|----------|
| Single SPA with routing | Same Vite build, React Router switches between /editor and /preview. Single bundle. | ✓ |
| Two separate Vite builds | Two entry points, shared component library dir. Built independently. | |

**User's choice:** Single SPA with routing
**Notes:** User preferred the simplicity of a single build.

| Option | Description | Selected |
|--------|-------------|----------|
| Subtitle-only | Only SubtitleConfig parameters in preview. No visual effects or titles. | ✓ |
| Full pipeline config | Include zooms, transitions, and title overlays. | |

**User's choice:** Subtitle-only
**Notes:** Keeps preview focused on PREV-01/02/03 scope. Visual effects and titles stay in /editor.

---

## Preview rendering approach

| Option | Description | Selected |
|--------|-------------|----------|
| Remotion Player | Use @remotion/player `<Player>` component. Same composition as production. Pixel-accurate by definition. | ✓ |
| Standalone React components | Rebuild layout components without Remotion. Faster load but risk of visual divergence. | |

**User's choice:** Remotion Player
**Notes:** Guarantees pixel-identical rendering since it uses the exact same SubtitledVideo composition.

| Option | Description | Selected |
|--------|-------------|----------|
| Native 1080x1920 with CSS scale-down | Composition renders at production size, CSS transform scales viewport. Pixel-perfect. | ✓ |
| Smaller composition size | 360x640 for faster playback. Fonts/spacing may differ from production. | |

**User's choice:** Native 1080x1920 with CSS scale-down
**Notes:** Production-accurate rendering preferred over performance optimization.

| Option | Description | Selected |
|--------|-------------|----------|
| Sample video background | Bundled sample MP4 in public/. Shows subtitles over real video. | ✓ |
| Static image/gradient background | Lightweight, no video. Clean subtitle rendering. | |
| Both with toggle | Default static + option to upload. More complex. | |

**User's choice:** Sample video background
**Notes:** Closer to real output appearance.

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled sample video | Short 5-10s MP4 inside the container. Always available. | ✓ |
| User uploadable video | Upload via UI. More flexible but more complex. | |
| Default + volume path override | Bundled default + specify path on shared volume. | |

**User's choice:** Bundled sample video
**Notes:** Simplest approach, always available, no upload handling needed.

---

## Parameters & controls UX

| Option | Description | Selected |
|--------|-------------|----------|
| Add to production SubtitleConfig | Add pastWordOpacity to PipelineConfig, defaults, validation, and all layout components. Preview and production match. | ✓ |
| Preview-only parameter | Only in preview local state. Doesn't affect production rendering. | |

**User's choice:** Add to production SubtitleConfig
**Notes:** Makes preview and production identical. pastWordOpacity becomes a real production feature.

| Option | Description | Selected |
|--------|-------------|----------|
| Preview left, controls right | 9:16 viewport on left, collapsible control panels on right. Mirrors /editor. | ✓ |
| Preview top, controls below | Viewport centered top, scrollable controls below. | |

**User's choice:** Preview left, controls right
**Notes:** Consistent with existing /editor layout pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing StyleControls | Import from /editor, extend with lineHeight and pastWordOpacity. Consistent UX. | ✓ |
| New purpose-built controls | Build from scratch for preview-appropriate patterns. | |

**User's choice:** Reuse existing StyleControls
**Notes:** Shared component library between /editor and /preview. Consistent UX.

| Option | Description | Selected |
|--------|-------------|----------|
| Standard Remotion playback controls | Play/pause/scrub via timeline. User controls pace. | ✓ |
| Autoplay with speed slider | Always cycling, configurable speed. No manual control. | |
| Autoplay + manual toggle | Autoplay default with pause + scrub when paused. | |

**User's choice:** Standard Remotion playback controls
**Notes:** User has full control to scrub to any moment and see word states.

---

## Sample content & font grid

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded Spanish paragraph | Always available, no dependencies. | |
| From transcription of sample video | Most realistic but creates transcript dependency. | |
| Editable textarea | User can type/paste custom text. Flexible. | ✓ |

**User's choice:** Editable textarea
**Notes:** User wants the flexibility to modify text.

| Option | Description | Selected |
|--------|-------------|----------|
| Default text + editable | Pre-filled Spanish default, user can modify. | ✓ |
| Empty textarea only | Pure blank canvas, requires user action. | |

**User's choice:** Default text + editable
**Notes:** Always starts with meaningful content, user can change it.

| Option | Description | Selected |
|--------|-------------|----------|
| Separate route/tab (/preview/fonts) | Clean separation, click to select and return. | ✓ |
| Collapsible section inline | Expand/collapse within preview page. Takes screen space. | |

**User's choice:** Separate route/tab
**Notes:** Clean UX separation. Grid gets its own space.

| Option | Description | Selected |
|--------|-------------|----------|
| CSS font rendering with Google Fonts | Lightweight, fast, font-family strings match production. | ✓ |
| Remotion Player per cell | Pixel-accurate but resource-intensive (18 compositions). | |

**User's choice:** CSS font rendering with Google Fonts
**Notes:** Uses same loadFont() pipeline, font-family strings match production. Practically identical for font selection.

---

## the agent's Discretion

- Exact default Spanish paragraph content for textarea
- Sample video selection (source, length)
- CSS scale-down implementation details
- Layout of control panels (grouping, collapse behavior)
- Color picker vs color input implementation
- Font grid cell size and layout (responsive)
- Textarea-to-TikTokPage conversion strategy
- lineHeight/letterSpacing slider min/max/step values
- React Router vs conditional rendering for SPA routing
- @remotion/player import and bundle integration details

## Deferred Ideas

- Visual effects preview (zooms, transitions) — beyond PREV scope, future phase
- Title overlay preview — /editor handles title config already
- Custom video upload — natural extension but not in scope
- Export/apply config to pipeline — editor API already exists
- Responsive multi-device preview — v1 is 9:16 only per PROJECT.md