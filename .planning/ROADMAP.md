# Roadmap: Video Pipeline Docker

## Overview

Build a self-hosted Docker pipeline that transforms talking-head MP4 videos into 9:16 vertical social clips with animated subtitles and silence removal. The journey starts with infrastructure (shared volumes, step contracts), then builds processing containers simplest-first (Whisper → Silence Cutter → 9:16 Finalizer), adds the visual rendering layer (Remotion subtitles → intros → zooms), and wraps everything in REST APIs (synchronous → async batch → progress tracking). Each phase delivers a coherent, verifiable capability that accumulates toward the full product.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Pipeline Infrastructure** - Docker Compose foundation with shared volumes and step contracts (completed 2026-05-05)
- [ ] **Phase 2: Whisper Transcription** - Audio extraction and Spanish transcription with word-level timestamps
- [ ] **Phase 3: Silence Detection & Removal** - Cross-referenced silence detection and hard-cut removal preserving A/V sync
- [ ] **Phase 4: 9:16 Vertical Output** - FFmpeg finalizer that crops and encodes vertical social video
- [ ] **Phase 5: Remotion + Animated Subtitles** - Word-by-word TikTok-style subtitles burned into video
- [ ] **Phase 6: Animated Intros & Outros** - Parameterized Remotion template sequences at video start/end
- [ ] **Phase 7: Visual Cuts & Zooms** - Automatic zoom on emphasis and visual jump-cut transitions
- [ ] **Phase 8: SRT/VTT Subtitle Export** - Sidecar subtitle files generated alongside burned-in video
- [ ] **Phase 9: Synchronous API** - POST /process endpoint for single-video on-demand processing
- [ ] **Phase 10: Async Batch + Orchestrator** - BullMQ queue, Redis, and pipeline orchestrator for batch jobs
- [ ] **Phase 11: Progress Tracking** - Per-step progress reporting via GET /status/{jobId}

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
  5. FFmpeg --version returns the same pinned version across all containers in the pipeline
**Plans**: 4 plans

Plans:
- [x] 01-01: Docker Compose project scaffolding with shared volumes, env vars, and directory conventions
- [x] 01-02: Step contract schema — env vars, exit codes, manifest.json artifact, and documentation
- [x] 01-03: Base Docker images with pinned FFmpeg + pipeline service chain in Compose
- [x] 01-04: Smoke test — validate full step contract end-to-end with no-op container

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
- [ ] 02-01-PLAN.md — Whisper container infrastructure + audio extraction (TRAN-01)
- [ ] 02-02-PLAN.md — Transcription engine + hallucination filter + transcript.json schema (TRAN-02, TRAN-03)
- [ ] 02-03-PLAN.md — Spanish language config + validation + E2E Docker test (TRAN-04)

### Phase 3: Silence Detection & Removal
**Goal**: Silent sections are detected and removed with hard cuts — A/V sync is preserved after every cut
**Depends on**: Phase 1, Phase 2 (cross-references Whisper no_speech data)
**Requirements**: SILC-01, SILC-02, SILC-03, SILC-04
**Success Criteria** (what must be TRUE):
  1. Pipeline identifies silent sections by cross-referencing FFmpeg silencedetect with Whisper no_speech data — no silence is missed or false-positive detected
  2. Silent sections are removed with hard cuts (no transition effects between remaining segments)
  3. Audio and video remain perfectly synchronized after all silence cuts — no visible or audible drift
  4. A JSON cut list artifact is produced documenting every silence removal with timestamps and durations
**Plans**: 5 plans

Plans:
- [ ] 03-01: FFmpeg silencedetect container implementation
- [ ] 03-02: Cross-reference logic — merge FFmpeg silence data with Whisper no_speech segments
- [ ] 03-03: Hard-cut video assembly with A/V sync preservation (reset_timestamps + setpts=PTS-STARTPTS)
- [ ] 03-04: Cut list JSON artifact generation
- [ ] 03-05: End-to-end validation — input MP4 → silence-removed MP4 with sync verification

### Phase 4: 9:16 Vertical Output
**Goal**: Video output is rendered in 9:16 vertical format with center-crop reframing optimized for social media
**Depends on**: Phase 1, Phase 3 (operates on silence-removed video)
**Requirements**: VERT-01, VERT-02, VERT-03
**Success Criteria** (what must be TRUE):
  1. Final output video file is 1080x1920 pixels (9:16 aspect ratio)
  2. Center-crop strategy is applied by default — the speaker's face remains centered in frame
  3. The 9:16 frame preserves safe zone boundaries — no critical content is clipped at edges where subtitles/overlays will be placed
**Plans**: 5 plans

Plans:
- [ ] 04-01: FFmpeg finalizer container setup
- [ ] 04-02: Center-crop video filter (scale + crop to 1080x1920)
- [ ] 04-03: 9:16 safe zone calculation and validation
- [ ] 04-04: H.264 encoding and audio normalization for social media
- [ ] 04-05: End-to-end pipeline validation — MP4 in → 9:16 MP4 out (without subtitles yet)

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
- [ ] 05-01: Remotion container setup (Node 22 bookworm-slim, Chrome headless, all dependencies)
- [ ] 05-02: Remotion project scaffolding with 9:16 composition configuration
- [ ] 05-03: Faster Whisper JSON → Remotion @remotion/captions TikTokPage token format mapping
- [ ] 05-04: Word-by-word animated subtitle composition with @remotion/captions
- [ ] 05-05: Active word highlight styling (TikTok-style current word emphasis)
- [ ] 05-06: End-to-end render — cut video + transcript → 9:16 video with burned-in animated subtitles

### Phase 6: Animated Intros & Outros
**Goal**: Videos open and close with branded animated templates rendered via Remotion
**Depends on**: Phase 5 (Remotion container and rendering pipeline working)
**Requirements**: VISU-01, VISU-02
**Success Criteria** (what must be TRUE):
  1. Video starts with an animated intro sequence rendered via Remotion template
  2. Video ends with an animated outro sequence rendered via Remotion template
  3. Intro and outro templates accept configurable brand parameters (text, colors, logo placement)
**Plans**: 5 plans

Plans:
- [ ] 06-01: Intro Remotion composition with parameterized template props
- [ ] 06-02: Outro Remotion composition with parameterized template props
- [ ] 06-03: Brand props schema (title, subtitle, colors, logo source)
- [ ] 06-04: Concatenation pipeline — intro + content + outro merged into single output
- [ ] 06-05: End-to-end validation with custom brand parameters

### Phase 7: Visual Cuts & Zooms
**Goal**: Jump cuts feel intentional and emphasis moments get visual zoom treatment — cuts are visually polished
**Depends on**: Phase 5 (Remotion rendering), Phase 2 (Whisper confidence data)
**Requirements**: VISU-03, VISU-04
**Success Criteria** (what must be TRUE):
  1. During emphasis moments (triggered by Whisper confidence dips and silence boundaries), the video automatically zooms in on the speaker
  2. Jump cuts have visible zoom or crop-shift transitions — cuts appear intentional rather than raw splices
  3. Zoom and transition effects are timed to audio cues derived from transcript/silence data
**Plans**: 5 plans

Plans:
- [ ] 07-01: Zoom trigger logic from Whisper confidence scores and silence boundaries
- [ ] 07-02: Remotion zoom composition (smooth scale animation on speaker)
- [ ] 07-03: Jump cut transition composition (zoom or crop shift between cut segments)
- [ ] 07-04: Integration — zoom/transition overlays composed with subtitle + intro/outro layers
- [ ] 07-05: End-to-end validation — emphasis-driven zooms and polished jump cuts in final output

### Phase 8: SRT/VTT Subtitle Export
**Goal**: SRT and VTT sidecar subtitle files are generated alongside the burned-in video for platform upload
**Depends on**: Phase 2 (transcript data), Phase 3 (silence-removed timestamps)
**Requirements**: SRTE-01
**Success Criteria** (what must be TRUE):
  1. An SRT subtitle file is generated alongside the processed video output
  2. A VTT subtitle file is generated alongside the processed video output
  3. Sidecar timestamps are aligned with the silence-processed video (not the original input timestamps)
**Plans**: 3 plans

Plans:
- [ ] 08-01: SRT format converter from Whisper transcript data (re-mapped to post-silence-removal timestamps)
- [ ] 08-02: VTT format converter from Whisper transcript data
- [ ] 08-03: Sidecar file output alongside final video in job artifact directory

### Phase 9: Synchronous API
**Goal**: Users can submit a single video via REST API and receive a fully processed result synchronously
**Depends on**: Phases 1-8 (all processing steps working)
**Requirements**: APIS-01, APIS-02, APIS-03
**Success Criteria** (what must be TRUE):
  1. POST /process accepts an MP4 via multipart upload and returns the processed video in the response
  2. API response includes URLs to all intermediate artifacts (transcript, cut list, intermediate videos) for inspection
  3. Long videos complete without timeout — timeout handling returns a meaningful status rather than hanging
**Plans**: 5 plans

Plans:
- [ ] 09-01: Express.js API server scaffolding with multipart upload support
- [ ] 09-02: POST /process endpoint — upload → pipeline execution → processed video response
- [ ] 09-03: Artifact serving — static file URLs for all intermediate pipeline outputs
- [ ] 09-04: Timeout handling for long videos (configurable timeout, graceful failure response)
- [ ] 09-05: End-to-end API test — curl upload → processed 9:16 video with all artifacts

### Phase 10: Async Batch + Orchestrator
**Goal**: Users can submit multiple videos for queued batch processing with concurrent execution and rate limiting
**Depends on**: Phase 9 (stable single-video synchronous endpoint)
**Requirements**: APIA-01, APIA-02, APIA-03
**Success Criteria** (what must be TRUE):
  1. POST /batch accepts multiple video files and returns unique job IDs for each
  2. BullMQ + Redis job queue manages concurrent processing with configurable rate limiting — no resource contention crashes
  3. Pipeline orchestrator executes the full step sequence per job, starting and stopping containers in order
**Plans**: 6 plans

Plans:
- [ ] 10-01: Redis container setup and BullMQ queue configuration with ioredis
- [ ] 10-02: POST /batch endpoint — multi-video upload, job creation, job ID responses
- [ ] 10-03: Pipeline orchestrator service — step sequence execution, container lifecycle management
- [ ] 10-04: Concurrency and rate limiting configuration (max concurrent jobs, GPU serialization)
- [ ] 10-05: Job retry and failure handling with BullMQ
- [ ] 10-06: End-to-end batch test — submit 3 videos, verify all process independently

### Phase 11: Progress Tracking
**Goal**: Users can check real-time progress of processing jobs per pipeline step
**Depends on**: Phase 10 (job queue and orchestrator tracking progress)
**Requirements**: PROG-01, PROG-02
**Success Criteria** (what must be TRUE):
  1. GET /status/{jobId} returns which pipeline step is currently executing (transcribing, removing silence, rendering, etc.)
  2. Progress response includes current step name and completion percentage where available
  3. Status updates reflect actual step transitions — not stuck on a stale step name
**Plans**: 4 plans

Plans:
- [ ] 11-01: Progress event schema (step name, percentage, timestamp)
- [ ] 11-02: Orchestrator step-transition progress reporting to Redis
- [ ] 11-03: GET /status/{jobId} endpoint implementation
- [ ] 11-04: End-to-end progress test — submit job, poll status, verify step transitions

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Pipeline Infrastructure | 4/4 | Complete    | 2026-05-05 |
| 2. Whisper Transcription | 0/5 | Not started | - |
| 3. Silence Detection & Removal | 0/5 | Not started | - |
| 4. 9:16 Vertical Output | 0/5 | Not started | - |
| 5. Remotion + Animated Subtitles | 0/6 | Not started | - |
| 6. Animated Intros & Outros | 0/5 | Not started | - |
| 7. Visual Cuts & Zooms | 0/5 | Not started | - |
| 8. SRT/VTT Subtitle Export | 0/3 | Not started | - |
| 9. Synchronous API | 0/5 | Not started | - |
| 10. Async Batch + Orchestrator | 0/6 | Not started | - |
| 11. Progress Tracking | 0/4 | Not started | - |