# Phase 6: Subtitle Enhancements, Titles & Web Config - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 06-animated-intros-outros (repurposed to: Subtitle Enhancements, Titles & Web Config)
**Areas discussed:** render approach, config source, layout modes, web UI tech, title timing/style, studio container, subtitle styling, timeline, fonts

---

## Phase Repurposing

| Option | Description | Selected |
|--------|-------------|----------|
| Repurpose Phase 6 | Replace intros/outros with subtitle formatting + titles + web config | ✓ |
| Skip & add new phase | Leave Phase 6, create a new phase for subtitle enhancements | |
| Split into two phases | Phase 6 for subtitles/titles, separate phase for web config | |

**User's choice:** Repurpose Phase 6 — the user doesn't want intros/outros, prefers advancing on subtitle formatting and web configuration.
**Notes:** The original "Animated Intros & Outros" scope (VISU-01, VISU-02) is replaced. Requirements will need updating in ROADMAP.md.

---

## Render Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Single config-driven composition | One composition receives full config as props, renders everything in one pass | ✓ |
| Multiple compositions per style | Separate compositions per layout mode, selected at render time | |

**User's choice:** Single config-driven composition
**Notes:** Cleaner architecture — one composition reads pipeline-config.json and renders appropriate components. Matches Remotion's inputProps pattern.

---

## Config Source

| Option | Description | Selected |
|--------|-------------|----------|
| JSON file per job | pipeline-config.json in job directory — web UI writes it, renderer reads it | ✓ |
| Environment variables only | Current approach, limited for web UI config | |

**User's choice:** JSON file per job (pipeline-config.json)
**Notes:** Clean separation between web UI and renderer. Backward compatible — env vars are fallback defaults.

---

## Layout Modes

| Option | Description | Selected |
|--------|-------------|----------|
| 4 core layout modes | TikTok, Sentence, Bar, Karaoke — full set from v1 | ✓ |
| 2 core modes, expand later | Start with TikTok + Karaoke, add more later | |

**User's choice:** 4 core layout modes
**Notes:** All four modes share TikTokPage[] data, only the rendering component changes.

---

## Web UI Tech

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated React app | Separate frontend app talking to pipeline API | ✓ |
| Embedded in Express | Page served by existing API server | |

**User's choice:** Dedicated React app (Recommended)
**Notes:** Full freedom for live preview integration with Remotion Studio. The Express API serves the config, the React app renders the UI.

---

## Title Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Manual config timestamps | Titles defined in config JSON with explicit startTime/duration | ✓ |
| Auto-generated from transcript | Heuristic keyword detection with manual override | |

**User's choice:** Manual config timestamps
**Notes:** Simpler for v1, full control. Auto-generation could be a future enhancement.

---

## Title Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| Centered bar with entrance animation | Semi-transparent background bar, slide-up or fade-in | ✓ |
| Full-screen title card | Solid/blurred background covering entire frame | |

**User's choice:** Centered bar with entrance animation
**Notes:** Matches social video aesthetics — less intrusive than full-screen cards.

---

## Studio Deployment

| Option | Description | Selected |
|--------|-------------|----------|
| Separate studio container | remotion-studio for interactive preview + config, remotion-renderer for production | ✓ |
| Mode toggle in renderer | Same container toggles between studio and render modes | |

**User's choice:** Separate studio container
**Notes:** Clean separation of concerns. Production renderer stays lightweight; studio container adds preview capabilities.

---

## Preview Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Remotion Studio integration | Use official Remotion Studio for live preview with timeline scrubbing | ✓ |
| Custom single-frame preview | Build a custom preview component — simpler but limited | |

**User's choice:** Remotion Studio integration
**Notes:** Leverages existing Remotion infrastructure. Config changes propagate via inputProps. No need to build a custom timeline.

---

## Subtitle Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed preset per mode | Each layout mode has its own fixed style | |
| Configurable style per mode | Layout defines arrangement, colors/fonts/outlines configurable independently | ✓ |
| Named theme presets | Bundles of layout + style together | |

**User's choice:** Configurable style per mode (Recommended)
**Notes:** Maximum flexibility without the complexity of full theme presets. User picks a layout mode, then customizes colors, fonts, etc.

---

## Font Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Curated font set | 3-5 fonts bundled with the container | ✓ |
| Custom font upload | User provides font files via shared volume | |

**User's choice:** Curated font set (Recommended)
**Notes:** Inter, Roboto, Montserrat, Oswald, system monospace fallback. Custom upload deferred to future phase.

---

## Subtitle Styling Details

| Option | Description | Selected |
|--------|-------------|----------|
| Background highlight effects | Colored rectangle behind words, text shadow, letter spacing | ✓ |
| Position presets | Bottom-center, top-center, center-screen with safe zone awareness | ✓ |

**User's choice:** Both — background highlight effects AND position presets
**Notes:** Background highlight especially for "bar" mode. Position presets derive bottom-center from safe zones, others from calculated offsets.

---

## Timeline Editor

| Option | Description | Selected |
|--------|-------------|----------|
| Remotion Studio timeline | Leverage built-in timeline with config-driven compositions | ✓ |
| Custom draggable timeline | Build a custom drag-to-position title editor | |
| Form-based title editor | Simple list of title entries editable in a form | |

**User's choice:** Leverage Remotion Studio timeline (Recommended)
**Notes:** Titles appear as Sequences in Remotion Studio's timeline — natural placement and timing. Config editor provides the form for title text and style.

---

## the agent's Discretion

- Exact TypeScript implementation per layout mode component
- Default style values per mode when config fields are omitted
- Spring animation parameters for each layout mode
- Font loading mechanism in Docker (bundled vs. staticFile vs. @remotion/google-fonts)
- React component structure for config editor SPA
- Error handling for missing pipeline-config.json
- Whether studio renders internally or triggers the renderer container
- Title entrance animation keyframes
- Web UI component architecture

---

## Deferred Ideas

- **Auto-generated titles from transcript heuristics** — v1 uses manual timestamps; future could add keyword detection
- **Named theme presets** — convenience layer on top of per-mode configuration, future phase
- **Custom font upload via web UI** — v1 uses curated font set only
- **B-roll animation placeholders** — already out of scope in PROJECT.md