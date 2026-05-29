# Roadmap: Video Pipeline Docker

## Overview

Build a self-hosted Docker pipeline that transforms talking-head MP4 videos into 9:16 vertical social clips with animated subtitles and silence removal. The journey starts with infrastructure (shared volumes, step contracts), then builds processing containers simplest-first (Whisper → Silence Cutter → 9:16 Finalizer), adds the visual rendering layer (Remotion subtitles → intros → zooms), and wraps everything in REST APIs (synchronous → async batch → progress tracking). Each phase delivers a coherent, verifiable capability that accumulates toward the full product.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### Milestone v1.0 — Pipeline completo

- [x] **Phase 1: Pipeline Infrastructure** - Docker Compose foundation with shared volumes and step contracts (completed 2026-05-05)
- [x] **Phase 2: Whisper Transcription** - Audio extraction and Spanish transcription with word-level timestamps (completed 2026-05-06)
- [x] **Phase 3: Silence Detection & Removal** - Cross-referenced silence detection and hard-cut removal preserving A/V sync (completed 2026-05-11)
- [x] **Phase 4: 9:16 Vertical Output** - FFmpeg finalizer that crops and encodes vertical social video (completed 2026-05-11)
- [x] **Phase 5: Remotion + Animated Subtitles** - Word-by-word TikTok-style subtitles burned into video (completed 2026-05-11)
- [x] **Phase 6: Animated Intros & Outros** - Parameterized Remotion template sequences at video start/end (completed 2026-05-10)
- [x] **Phase 7: Visual Cuts & Zooms** - Automatic zoom on emphasis and visual jump-cut transitions (completed 2026-05-12)
- [x] **Phase 8: SRT/VTT Subtitle Export** - Sidecar subtitle files generated alongside burned-in video (completed 2026-05-12)
- [x] **Phase 9: Synchronous API** - POST /process endpoint for single-video on-demand processing (completed 2026-05-13)
- [x] **Phase 10: Async Batch + Orchestrator** - BullMQ queue, Redis, and pipeline orchestrator for batch jobs (completed 2026-05-13)
- [x] **Phase 11: Progress Tracking** - Per-step progress reporting via GET /status/{jobId} (completed 2026-05-13)
- [x] **Phase 12: Subtitle Preview Lab** - Interactive web UI for live subtitle style preview with all tunable parameters (completed 2026-05-18)

### Milestone v1.1 — Calidad de video — ✅ ARCHIVED 2026-05-22

Closed at 14 phases / 56 plans / 9 requirements complete. Phases 13–14 delivered encode-quality and supersampling+quality-finalizer; Spike 001 settled the scale decision (production defaults to scale:1). Full archive: [.planning/milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · requirements: [.planning/milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

### Milestone v1.2 — Infrastructure / shared services — ✅ SHIPPED 2026-05-26

Closed at 2 phases / 6 plans. Whisper externalized to the standalone HTTP service; render config-propagation + flicker bugs fixed; public exposure (Cloudflare tunnel + auth) and single-job concurrency hardening. Full archive: [.planning/milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · summary: [.planning/MILESTONES.md](MILESTONES.md)

- [x] **Phase 15: Whisper externalization** - Replace embedded `services/whisper` container with HTTP calls to the standalone whisper-api at `/home/luis/proyectos/whisper`. Contract is drop-in (`profile=reels` bare body identical). See `.planning/contracts/whisper-service-integration.md`. **Plans:** 3 plans in 3 waves (planned 2026-05-22). (completed 2026-05-23)

- [x] **Phase 16: Render config + flicker fixes** (completed 2026-05-26) - Two pre-existing render-path bugs surfaced during the Phase 15 e2e run (NOT whisper regressions): (A) studio pipeline-config.json never reaches the renderer in production because ACTIVE_PIPELINE_CONFIG_PATH is never populated (v1.1 wired the consumer, not the producer) — fix: studio PUT /api/config also writes the active config; (B) subtitle flicker from inter-page fade gaps. See .planning/phases/16-render-config-flicker/16-CONTEXT.md.

### Milestone v1.3 — Studio redesign + visual capabilities

Unify the studio into a single 2-column interface and expand render visual/typography capabilities, with config that survives Docker rebuilds. **Frontend tooling non-negotiable:** every studio-facing phase invokes `impeccable` + `frontend-design` (AGENTS.md).

- [x] **Phase 17: Config persistence** - Studio config (subtitle styles + title blocks) survives `docker compose build`/rebuild and container recreate, stored as inspectable JSON in a persistent location. Requirements: PERSIST-01, PERSIST-02. (completed 2026-05-27)
- [x] **Phase 18: Studio UI redesign** - Single 2-column interface (left: preview, right: controls in tabs); consolidate the duplicated editor/preview screens. Foundational UI for the new control surface. Requirements: STUDIO-01, STUDIO-02, STUDIO-03. **(UI hint: yes)** (completed 2026-05-27)
- [x] **Phase 19: Typography & text effects** - Plus Jakarta Sans, larger font sizes, bold/italic variants, outer glow (color/intensity/softness) — controls in the new UI + renderer. Requirements: TYPO-01, TYPO-02, TYPO-03, TYPO-04. **(UI hint: yes)** (completed 2026-05-29)
- [ ] **Phase 20: Title block precision** - Pixel-coordinate positioning, configurable border-radius, remove the subtitle field (subtitle = separate title block). Requirements: TITLE-01, TITLE-02, TITLE-03. **(UI hint: yes)**
- [ ] **Phase 21: PNG overlays** - Transparent PNG overlay with code-side supersampled downscale for crisp logos/watermarks, with positioning/sizing. Requirements: OVERLAY-01, OVERLAY-02, OVERLAY-03. **(UI hint: yes)**

## Phase Details

### Phase 1: Pipeline Infrastructure

**Goal**: Pipeline foundation with Docker step contracts is operational — containers communicate via shared volumes
**Depends on**: Nothing (first phase)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05
**Success Criteria** (what must be TRUE):

  1. An MP4 file placed in the shared Docker volume is accessible by a processing container via INPUT_PATH environment variable
  2. A container can process a file and write output artifacts to OUTPUT_PATH on the shared named volume
  3. Intermediate artifacts from any step are inspectable as files on the shared volume
  4. A new container step can be added to docker-compose.yml and the pipeline sequence without modifying existing step container configurations
  5. FFmpeg --version returns 7.1.1 (the pinned version) across all containers in the pipeline

**Plans**: 6 plans

Plans:

- [x] 01-01: Docker Compose project scaffolding with shared volumes, env vars, and directory conventions
- [x] 01-02: Step contract schema — env vars, exit codes, manifest.json artifact, and documentation
- [x] 01-03: Base Docker images with pinned FFmpeg + pipeline service chain in Compose
- [x] 01-04: Smoke test — validate full step contract end-to-end with no-op container
- [x] 01-05: [GAP CLOSURE] Pin FFmpeg 7.1.1 in Dockerfiles + restore smoke-test.sh (PIPE-05, PIPE-01–04)
- [x] 01-06: [GAP CLOSURE] Compile FFmpeg 7.1.1 from source in both base Dockerfiles (PIPE-05)

### Phase 2: Whisper Transcription

**Goal**: Audio is extracted from MP4 and transcribed with word-level Spanish timestamps — the data foundation for all downstream steps
**Depends on**: Phase 1
**Requirements**: TRAN-01, TRAN-02, TRAN-03, TRAN-04
**Success Criteria** (what must be TRUE):

  1. An MP4 input produces a JSON transcript file with word-level timestamps (start/end per word)
  2. Timestamps correctly map each spoken word to its time position in the audio
  3. Phantom text from Whisper hallucinations is filtered out — no spurious words appear during silent sections
  4. Transcription is configured for Spanish language explicitly (language="es", non-.en model used)

**Plans:** 3 plans

Plans:

- [x] 02-01-PLAN.md — Whisper container infrastructure + audio extraction (TRAN-01)
- [x] 02-02-PLAN.md — Transcription engine + hallucination filter + transcript.json schema (TRAN-02, TRAN-03)
- [x] 02-03-PLAN.md — Spanish language config + validation + E2E Docker test (TRAN-04)

### Phase 3: Silence Detection & Removal

**Goal**: Silent sections are detected and removed with hard cuts — A/V sync is preserved after every cut
**Depends on**: Phase 1, Phase 2 (cross-references Whisper no_speech data)
**Requirements**: SILC-01, SILC-02, SILC-03, SILC-04
**Success Criteria** (what must be TRUE):

  1. Pipeline identifies silent sections by cross-referencing FFmpeg silencedetect with Whisper no_speech data — no silence is missed or false-positive detected
  2. Silent sections are removed with hard cuts (no transition effects between remaining segments)
  3. Audio and video remain perfectly synchronized after all silence cuts — no visible or audible drift
  4. A JSON cut list artifact is produced documenting every silence removal with timestamps and durations

**Plans**: 4 plans

Plans:

- [x] 03-01-PLAN.md — Container infrastructure + silencedetect module + cross-reference engine + silence-cuts schema (SILC-01, SILC-04)
- [x] 03-02-PLAN.md — Hard-cut video assembly with A/V sync + main.py pipeline entry point (SILC-02, SILC-03)
- [x] 03-03-PLAN.md — Validation module + unit tests + E2E Docker test (SILC-01, SILC-02, SILC-03, SILC-04)
- [x] 03-06-PLAN.md — [GAP CLOSURE] Fix unit test import errors

### Phase 4: 9:16 Vertical Output

**Goal**: Video output is rendered in 9:16 vertical format with center-crop reframing optimized for social media
**Depends on**: Phase 1, Phase 3 (operates on silence-removed video)
**Requirements**: VERT-01, VERT-02, VERT-03
**Success Criteria** (what must be TRUE):

  1. Final output video file is 1080x1920 pixels (9:16 aspect ratio)
  2. Center-crop strategy is applied by default — the speaker's face remains centered in frame
  3. The 9:16 frame preserves safe zone boundaries — no critical content is clipped at edges where subtitles/overlays will be placed

**Plans**: 3 plans

Plans:

- [x] 04-01-PLAN.md — Conditional crop logic + config refactor + schema update (VERT-01, VERT-02)
- [x] 04-02-PLAN.md — Validation module + unit tests (VERT-01, VERT-02, VERT-03)
- [x] 04-03-PLAN.md — E2E Docker test + health check + human verification (VERT-01, VERT-02, VERT-03)

### Phase 5: Remotion + Animated Subtitles

**Goal**: Word-by-word animated subtitles are burned into the 9:16 video — the killer feature for short-form content
**Depends on**: Phase 1, Phase 2 (transcript JSON), Phase 3 (cut video), Phase 4 (9:16 framing)
**Requirements**: SUBT-01, SUBT-02, SUBT-03
**Success Criteria** (what must be TRUE):

  1. Output video has subtitles that animate word-by-word, appearing in sync with the speaker's voice
  2. The currently spoken word is visually highlighted TikTok-style (stands out from surrounding words)
  3. Subtitle timing matches audio with no visible lag — words highlight precisely when spoken

**Plans**: 6 plans

Plans:

- [x] 05-01-PLAN.md — Docker infrastructure + pipeline reordering (D-05, D-07, D-12, SUBT-01, SUBT-03)
- [x] 05-02-PLAN.md — Timestamp remapping + safe zone positioning + render integration (D-01-D-04, D-08, D-10, D-11, SUBT-01, SUBT-02, SUBT-03)
- [x] 05-03-PLAN.md — Validation module + E2E Docker test (SUBT-01, SUBT-02, SUBT-03)
- [x] 05-04-PLAN.md — [GAP CLOSURE] Fix double-remap bug: detection logic + auto-skip in transcriptToCaptionPages (SUBT-02, SUBT-03)
- [x] 05-05-PLAN.md — [GAP CLOSURE] Pipeline config fix + E2E test standalone + defensive validation (SUBT-02, SUBT-03)
- [x] 05-06-PLAN.md — [GAP CLOSURE] Remove SILENCE_CUTS_PATH from remotion-renderer

### Phase 6: Subtitle Enhancements, Titles & Web Config

**Goal**: Configurable subtitle styles (4 layout modes), timed title overlays, and a web-based Remotion Studio for live preview and configuration — all driven by pipeline-config.json
**Depends on**: Phase 5 (Remotion container and rendering pipeline working)
**Requirements**: VISU-01, VISU-02
**Success Criteria** (what must be TRUE):

  1. Video starts with an animated intro title card when pipeline-config has titles with startTimeMs=0 (VISU-01)
  2. Video ends with an animated outro title card when pipeline-config has titles near video end (VISU-02)
  3. Intro and outro templates accept configurable brand parameters (text, colors, entrance animation)
  4. Users can select subtitle layout mode (TikTok, Sentence, Bar, Karaoke) via pipeline-config.json
  5. Config editor web UI allows live preview and configuration of subtitles and titles

**Plans**: 5 plans

Plans:

- [x] 06-01-PLAN.md — Pipeline config schema & config-driven composition architecture (D-01, D-02, D-03, D-05, D-12, D-17)
- [x] 06-02-PLAN.md — Subtitle layout modes: TikTok, Sentence, Bar, Karaoke + LayoutDispatcher (D-04, D-06, D-08, D-09)
- [x] 06-03-PLAN.md — Title overlays with entrance animations & curated font infrastructure (D-07, D-10, D-11, D-13, VISU-01, VISU-02)
- [x] 06-04-PLAN.md — Remotion Studio Docker container + Docker Compose integration (D-14, D-15, D-18, D-19)
- [x] 06-05-PLAN.md — Config editor SPA + validation module + E2E test (D-16, D-20, VISU-01, VISU-02)

### Phase 7: Visual Cuts & Zooms

**Goal**: Jump cuts feel intentional and emphasis moments get visual zoom treatment — cuts are visually polished
**Depends on**: Phase 5 (Remotion rendering), Phase 2 (Whisper confidence data)
**Requirements**: VISU-03, VISU-04
**Success Criteria** (what must be TRUE):

  1. During emphasis moments (triggered by Whisper confidence dips and silence boundaries), the video automatically zooms in on the speaker
  2. Jump cuts have visible zoom or crop-shift transitions — cuts appear intentional rather than raw splices
  3. Zoom and transition effects are timed to audio cues derived from transcript/silence data

**Plans:** 7 plans

Plans:

- [x] 07-01: Zoom trigger logic from Whisper confidence scores and silence boundaries
- [x] 07-02: Remotion zoom composition (smooth scale animation on speaker)
- [x] 07-03: Jump cut transition composition (zoom or crop shift between cut segments)
- [x] 07-04: Integration — zoom/transition overlays composed with subtitle + intro/outro layers
- [x] 07-05: End-to-end validation — emphasis-driven zooms and polished jump cuts in final output
- [x] 07-06: [GAP CLOSURE] Fix invisible jump-cut transitions — combine zoom+transition scale on ZoomContainer (VISU-04)
- [x] 07-07: [GAP CLOSURE] Fix Signal 2 break bug and merge mutability in zoom-detection.ts

### Phase 8: SRT/VTT Subtitle Export

**Goal**: SRT and VTT sidecar subtitle files are generated alongside the burned-in video for platform upload
**Depends on**: Phase 2 (transcript data), Phase 3 (silence-removed timestamps)
**Requirements**: SRTE-01
**Success Criteria** (what must be TRUE):

  1. An SRT subtitle file is generated alongside the processed video output
  2. A VTT subtitle file is generated alongside the processed video output
  3. Sidecar timestamps are aligned with the silence-processed video (not the original input timestamps)

**Plans**: 2 plans

Plans:

- [x] 08-01-PLAN.md — SRT/VTT format generation service with timestamp remapping (SRTE-01)
- [x] 08-02-PLAN.md — Docker Compose integration and E2E validation (SRTE-01)

### Phase 9: Synchronous API

**Goal**: Users can submit a single video via REST API and receive a fully processed result synchronously
**Depends on**: Phases 1-8 (all processing steps working)
**Requirements**: APIS-01, APIS-02, APIS-03
**Success Criteria** (what must be TRUE):

  1. POST /process accepts an MP4 via multipart upload and returns the processed video in the response
  2. API response includes URLs to all intermediate artifacts (transcript, cut list, intermediate videos) for inspection
  3. Long videos complete without timeout — timeout handling returns a meaningful status rather than hanging

**Plans:** 3 plans

Plans:

- [x] 09-01-PLAN.md — API server scaffolding, Zod schemas, Multer upload, artifact serving (APIS-01, APIS-02)
- [x] 09-02-PLAN.md — Pipeline orchestration via Dockerode, POST /process handler, timeout handling (APIS-01, APIS-02, APIS-03)
- [x] 09-03-PLAN.md — Docker integration, health endpoint, E2E validation (APIS-01, APIS-02, APIS-03)

### Phase 10: Async Batch + Orchestrator

**Goal**: Users can submit multiple videos for queued batch processing with concurrent execution and rate limiting
**Depends on**: Phase 9 (stable single-video synchronous endpoint)
**Requirements**: APIA-01, APIA-02, APIA-03
**Success Criteria** (what must be TRUE):

  1. POST /batch accepts multiple video files and returns unique job IDs for each
  2. BullMQ + Redis job queue manages concurrent processing with configurable rate limiting — no resource contention crashes
  3. Pipeline orchestrator executes the full step sequence per job, starting and stopping containers in order

**Plans:** 4/4 plans complete

Plans:

- [x] 10-01-PLAN.md — Redis + BullMQ queue infrastructure and batch schemas
- [x] 10-02-PLAN.md — POST /batch endpoint and GET /batch/{batchId} status
- [x] 10-03-PLAN.md — BullMQ worker with progress tracking and retry handling
- [x] 10-04-PLAN.md — Concurrency configuration and E2E batch validation

### Phase 11: Progress Tracking

**Goal**: Users can check real-time progress of processing jobs per pipeline step
**Depends on**: Phase 10 (job queue and orchestrator tracking progress)
**Requirements**: PROG-01, PROG-02
**Success Criteria** (what must be TRUE):

  1. GET /status/{jobId} returns which pipeline step is currently executing (transcribing, removing silence, rendering, etc.)
  2. Progress response includes current step name and completion percentage where available
  3. Status updates reflect actual step transitions — not stuck on a stale step name

**Plans:** 3/3 plans complete

Plans:

- [x] 11-01-PLAN.md — Progress data layer: extend progress.ts with completed steps, progress %, stepInfo, and status Zod schema (PROG-01, PROG-02)
- [x] 11-02-PLAN.md — Status endpoint: GET /status/:jobId route, POST /process progress extension, router mounting (PROG-01, PROG-02)
- [x] 11-03-PLAN.md — E2E validation: comprehensive status endpoint tests and progress flow simulation (PROG-01, PROG-02)

### Phase 12: Subtitle Preview Lab

**Goal**: Interactive web page for live subtitle style preview with all tunable parameters, rendering fonts exactly as they appear in the final video output over a sample background
**Depends on**: Phase 5 (Remotion rendering), Phase 6 (config editor infrastructure)
**Requirements**: PREV-01, PREV-02, PREV-03
**Success Criteria** (what must be TRUE):

  1. A web page at `/preview` shows a 9:16 viewport with a sample video/image background and subtitle text rendered on top
  2. All 18 available fonts render with the same engine used in production (Remotion's font loading), so preview exactly matches final output
  3. Every subtitle parameter is adjustable in real-time: layout mode, fontFamily, fontSize, activeColor, inactiveColor, letterSpacing, lineHeight, backgroundHighlight, outlineColor, outlineWidth, position, bottomOffset, pastWordOpacity
  4. A sample Spanish paragraph cycles through word-by-word highlighting with configurable timing speed, so the user can see how active/past/future words look during playback
  5. Font grid view shows all 18 fonts simultaneously in a single page with the same sample text, allowing direct visual comparison before selecting one
  6. Changes to any parameter update the preview instantly without page reload or re-render

### Phase 12 Details

Plans:

- [x] 12-01-PLAN.md — Add pastWordOpacity to SubtitleConfig and all 4 layout components, extend StyleControls with lineHeight + pastWordOpacity sliders (PREV-03)
- [x] 12-02-PLAN.md — Build /preview SPA with @remotion/player, React Router, textToCaptionPages, font grid, Express routing (PREV-01, PREV-02, PREV-03)
- [x] 12-03-SUMMARY.md — Post-phase hot-fixes: font CSS family name resolution (BF-01), TitleOverlay temporal dead zone (BF-02), player visibility (BF-03), aspect-ratio fix (BF-04), word highlight overlap (BF-06), fontWeight shift (BF-07), config persistence (BF-08). Feature enhancements: title style editor (FE-01), 8 new fonts (FE-02), dual font loading (FE-03), smooth highlight fade (FE-04).

### Phase 15: Whisper externalization

**Goal**: The embedded GPU Whisper container is replaced by HTTP calls to the standalone whisper-api; the transcript.json contract is preserved drop-in and the highlight-sync drift fix is validated end-to-end on a real mid-speech-cut clip
**Depends on**: Phases 1-14 (full pipeline); external whisper-api standalone (Phase 5 complete, live)
**Requirements**: none formal (v1.2 single infra phase — must_haves derived from contract §6 + ROADMAP goal + locked decisions D-2/D-3/D-5/D-6)
**Success Criteria** (what must be TRUE):

  1. The pipeline's whisper step calls the external whisper-api and writes the bare reels body verbatim to pipeline/{jobId}/whisper/transcript.json (zero downstream change)
  2. Sync/async routing, auth, limits, and error mapping honor the locked decisions; all error codes fail the step via the manifest contract
  3. The external whisper-api emits timeline="original" and the renderer's deterministic remap fires (legacy heuristic retired to fallback)
  4. Highlight-vs-audio sync holds on the back half of a mid-speech-cut clip (Spike 001 drift repro closed)
  5. The embedded services/whisper container is retired after parity + e2e pass

**Plans**: 3 plans

Plans:

- [x] 15-01-PLAN.md — New services/whisper-http-step/ container: ffprobe duration gate + sync/async HTTP client + error mapping + mock-api unit tests
- [x] 15-02-PLAN.md — Orchestrator STEP swap (drop GPU/HF_HOME, add WHISPER_API_URL/KEY) + orchestrator tests + docker-compose wiring (host.docker.internal)
- [x] 15-03-PLAN.md — timeline marker on external whisper-api + e2e drift repro (human-verify) + parity test + retire services/whisper/

---

### Phase 16: Render config + flicker fixes

**Goal**: A `/process` render uses the style configured in the remotion-studio UI (layout, fonts, title overlays) instead of falling back to env defaults, AND subtitle flicker is eliminated on a correct-layout render — both pre-existing render-path bugs surfaced during the Phase 15 e2e run are closed
**Depends on**: Phases 1-15 (full pipeline + externalized whisper); both bugs are pre-existing render-path defects, not whisper regressions
**Requirements**: none formal (v1.2 infra/bugfix phase — must_haves derived from CONTEXT.md Issue A locked fix + Issue B candidate fixes + ROADMAP goal)
**Success Criteria** (what must be TRUE):

  1. Saving a config in remotion-studio writes the clean config (no `_meta`) to the active path (`/data/pipeline/pipeline-config.json`), so a subsequent `/process` job seeds it into the per-job renderer config
  2. A `/process` render reports `pipeline_config: {loaded: true, source: <studio config>}` with the user's layout, fonts, and title overlays applied — NOT the env-default tiktok fallback
  3. Issue B (subtitle flicker) is RE-MEASURED on a correct `bar`-layout render after Issue A is fixed, and the inter-page fade-gap blink is eliminated (pages hold visible until the next page starts; no fade-out-to-empty between contiguous pages)
  4. Shared `src/*.ts` + `compositions/*` edits are synced studio↔renderer per the CLAUDE.md renderer-sync convention
  5. A real render on a short clip with the studio config validates both fixes end-to-end

**Plans**: 3 plans in 2 waves

Plans:

**Wave 1**

- [x] 16-01-PLAN.md — Issue A fix: add ACTIVE_PIPELINE_CONFIG_PATH write to PUT /api/config (server.ts + docker-compose.yml)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 16-02-PLAN.md — Human checkpoint: run real /process render, verify pipeline_config.loaded=true + observe flicker on bar layout
- [ ] 16-03-PLAN.md — Issue B fix: isLastPage duration formula in BarLayout.tsx + TikTokLayout.tsx, renderer sync, unit tests, e2e validate

---

### Phase 17: Config persistence

**Goal**: Studio-saved configuration (subtitle styles + title blocks) survives Docker rebuilds and container recreates — the user never loses their styling work
**Depends on**: Phases 1-16 (studio + config plumbing)
**Requirements**: PERSIST-01, PERSIST-02
**Success Criteria** (what must be TRUE):

  1. After editing styles in the studio, running `docker compose build` + recreate, the saved config is still present and applied
  2. The active config lives as inspectable JSON in a persistent location (bind mount or named volume), not the ephemeral image layer
  3. A render after a rebuild uses the persisted config (pipeline_config.loaded=true with the user's values)

**Plans**: 2 plans in 2 waves

Plans:

**Wave 1**

- [x] 17-01-PLAN.md — Persistence plumbing: default template, server.ts single-write fix, startup seed hook, docker-compose.yml alignment (PERSIST-01, PERSIST-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-02-PLAN.md — Human verify: rebuild + render proof that config survives docker compose build + recreate (PERSIST-01, PERSIST-02)

### Phase 18: Studio UI redesign

**Goal**: The studio is a single two-column interface (left: preview, right: tabbed controls) with the duplicated editor/preview screens consolidated
**Depends on**: Phase 17 (persistence in place so redesigned UI saves durably)
**Requirements**: STUDIO-01, STUDIO-02, STUDIO-03
**UI hint**: yes — invoke `impeccable` + `frontend-design` at plan/execute start
**Success Criteria** (what must be TRUE):

  1. The studio renders one screen split vertically: video preview on the left, all controls on the right
  2. Controls are organized into tabs in the right panel
  3. The previously separate editor and preview screens (and their duplicated components) are unified — no redundant copies
  4. Live preview reflects control changes without a separate screen

**Plans**: 3 plans in 2 waves

Plans:

**Wave 1**

- [x] 18-01-PLAN.md — TitleEditor simplification: remove onPreviewChange/onSave props (D-10, STUDIO-02, STUDIO-03)

**Wave 2** *(parallel — no shared files)*

- [x] 18-02-PLAN.md — PreviewApp.tsx unified StudioApp: TabBar + tabs + Font Grid inline + delete ConfigPreview/FontGridPage (STUDIO-01, STUDIO-02, STUDIO-03)
- [x] 18-03-PLAN.md — App.tsx single route + delete EditorApp + server.ts root serving + human-verify checkpoint (STUDIO-01, STUDIO-03)

### Phase 19: Typography & text effects

**Goal**: Users can style subtitle/title text with Plus Jakarta Sans, larger sizes, bold/italic, and an outer glow — controls in the redesigned UI, applied at render
**Depends on**: Phase 18 (controls land in the new UI surface)
**Requirements**: TYPO-01, TYPO-02, TYPO-03, TYPO-04
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. Plus Jakarta Sans is selectable and renders for subtitles and titles
  2. Font sizes can be set beyond the current maximum and render correctly
  3. Bold and italic variants apply and render
  4. An outer glow with configurable color, intensity, and softness renders on text

**Plans**: 4 plans in 4 waves

Plans:
**Wave 1**

- [x] 19-01-PLAN.md — Schema + fonts.ts (OuterGlow, fontWeight/fontStyle fields, PlusJakartaSans, validation, tests)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-02-PLAN.md — Compositions (getOuterGlowStyle, de-hardcode fontWeight in 4 layouts + TitleOverlay, renderer sync)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-03-PLAN.md — UI controls (StyleControls + TitleEditor: size sliders, Bold/Italic toggles, Outer Glow card, build)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 19-04-PLAN.md — Human visual verify (studio at port 3123, all 4 requirements)

### Phase 20: Title block precision

**Goal**: Title blocks are positioned by pixel coordinates with configurable border-radius, and the subtitle field is removed (a subtitle is a separate title block)
**Depends on**: Phase 18 (title controls in the new UI)
**Requirements**: TITLE-01, TITLE-02, TITLE-03
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. A title block can be positioned by pixel x/y coordinates (not percentages) and renders at that position
  2. Title block containers have a configurable border-radius that renders
  3. The title component no longer has a subtitle field; adding a subtitle is done via a separate title block

**Plans**: 4 plans in 3 waves

Plans:

**Wave 1**

- [x] 20-01-PLAN.md — Schema migration (pipeline-config.ts) + Phase 20 test cases (pipeline-config.test.ts): remove topOffset/subtitle/subtitleFontSize/subtitleColor/subtitleFontFamily; add x/y/borderRadius; validation (TITLE-01, TITLE-02, TITLE-03)

**Wave 2** *(parallel — no shared files)*

- [x] 20-02-PLAN.md — TitleOverlay.tsx: pixel-coordinate positioning, config-driven borderRadius, subtitle rendering removed (TITLE-01, TITLE-02, TITLE-03)
- [x] 20-03-PLAN.md — TitleEditor.tsx: X/Y number inputs, borderRadius slider, all subtitle controls removed (TITLE-01, TITLE-02, TITLE-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 20-04-PLAN.md — Renderer sync (cp TitleOverlay + pipeline-config to renderer), full vitest suite, build verify, human visual check (TITLE-01, TITLE-02, TITLE-03)

### Phase 21: PNG overlays

**Goal**: Users can place a transparent PNG overlay on the video, with a code-side supersampled downscale for crisp logos/watermarks
**Depends on**: Phase 18 (overlay controls in the new UI)
**Requirements**: OVERLAY-01, OVERLAY-02, OVERLAY-03
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. A transparent PNG can be added as an overlay and appears in the rendered video
  2. A PNG larger than the frame is downscaled by code at render time and stays crisp (no blur/aliasing)
  3. The overlay can be positioned and sized by the user

**Plans**: TBD (plan-phase)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Pipeline Infrastructure | 6/6 | Complete    | 2026-05-05 |
| 2. Whisper Transcription | 3/3 | Complete | 2026-05-06 |
| 3. Silence Detection & Removal | 4/4 | Complete | 2026-05-11 |
| 4. 9:16 Vertical Output | 3/3 | Complete | 2026-05-11 |
| 5. Remotion + Animated Subtitles | 5/5 | Complete | 2026-05-11 |
| 6. Animated Intros & Outros | 5/5 | Complete    | 2026-05-10 |
| 7. Visual Cuts & Zooms | 7/7 | Complete | 2026-05-12 |
| 8. SRT/VTT Subtitle Export | 2/2 | Complete | 2026-05-12 |
| 9. Synchronous API | 3/3 | Complete | 2026-05-13 |
| 10. Async Batch + Orchestrator | 4/4 | Complete    | 2026-05-13 |
| 11. Progress Tracking | 3/3 | Complete   | 2026-05-13 |
| 12. Subtitle Preview Lab | 2/2 + hot-fixes | Complete   | 2026-05-18 |
| 13. Encode Quality | 4/4 | Complete   | 2026-05-21 |
| 14. Remotion Supersampling + quality-finalizer | 3/3 | Complete   | 2026-05-22 |
| 15. Whisper externalization | 3/3 | Complete   | 2026-05-23 |
| 16. Render config + flicker fixes | 3/3 | Complete   | 2026-05-26 |
| 17. Config persistence | 2/2 | Complete    | 2026-05-27 |
