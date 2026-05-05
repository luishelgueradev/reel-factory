# Feature Research

**Domain:** Video processing pipeline for social media (containerized, self-hosted)
**Researched:** 2026-05-05
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **MP4 input acceptance** | The entire product premise starts with "upload a video." No input = no pipeline. | LOW | FFmpeg handles this trivially. Validate format early, reject gracefully. |
| **Automated transcription with timestamps** | Every competitor (OpusClip, Descript, Vizard) does this. It's the foundation for silence detection + subtitles. Without it, the pipeline is just FFmpeg. | MEDIUM | Whisper (openai/whisper) or faster-whisper. Word-level timestamps critical for word-by-word subtitles. Use `word_timestamps=True`. |
| **Silence detection and removal** | The #1 reason creators use pipeline tools: dead air kills engagement on short-form. Every SaaS competitor does this automatically. | MEDIUM | FFmpeg `silencedetect` filter → parse periods → FFmpeg `atrim` + `asetpts` to cut. No transitions (hard cuts per PROJECT.md). |
| **9:16 vertical output** | The entire target market (Reels, TikTok, Shorts) requires vertical format. Horizontal input → vertical output is the core transformation. | MEDIUM | Remotion re-renders at 1080x1920. Subject tracking/reframing is the hard part; simple crop-center is easy but low quality; smart reframing is a differentiator (see below). |
| **Word-by-word animated subtitles** | This IS the differentiator for short-form video. Static subtitles feel dead. Kinetic captions = engagement. OpusClip, CapCut, Vizard all do this. | MEDIUM | Remotion `@remotion/captions` package with `TikTokPage` tokens. Each token has `fromMs`/`toMs`. Highlight active word via `useCurrentFrame()`. Built-in support. |
| **Synchronous REST API (single video)** | API-first product with no UI means the API IS the interface. If you can't submit a video and get a result, there's nothing. | MEDIUM | Express/Fastify endpoint. Input: MP4 file/multipart. Output: processed video URL or stream. Must handle timeouts for long videos. |
| **Intermediate output inspection** | Core design decision in PROJECT.md. Each pipeline step must produce inspectable artifacts. This is what separates a "black box" from a "debuggable pipeline." | LOW | Each container writes to shared volume. Expose artifacts via API or file serving. JSON metadata per step. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but create significant value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Self-hosted / Docker-native** | SaaS competitors (OpusClip $19/mo+, Descript $24/mo+) charge per minute. Self-hosted = no per-minute fees, no data leaving your infrastructure, no vendor lock-in. This is THE differentiator for the product. | LOW | Architecture advantage, not a feature to build. Use Docker Compose for orchestration. |
| **Extensible pipeline steps** | Add new processing steps as containers without refactoring the pipeline. SaaS tools are closed boxes; this is open and programmable. | MEDIUM | Shared volumes + step contracts (JSON schema for inputs/outputs). Orchestrator reads config, launches containers in sequence. |
| **Smart reframing (subject tracking)** | Simple center-crop for 9:16 loses the speaker when they move. AI reframing keeps the talking head centered. OpusClip calls this "ReframeAnything." | HIGH | Requires face/person detection (MediaPipe, YOLO, or similar). Map bounding boxes to crop region. Fallback to center-crop if no subject detected. |
| **Automatic zoom/jump cuts** | Visual dynamism: zoom into speaker on emphasis, jump cuts on silence removal. Makes output feel edited, not just trimmed. OpusClip does this implicitly; Descript has "AutoZoom." | HIGH | Use Whisper confidence + silence boundaries as triggers. Remotion `<Series>` + `<Zoom>` components. Requires timestamp-driven logic. |
| **Batch processing queue (async)** | Process multiple videos without babysitting. Queues are essential for content creators repurposing full podcasts (30+ clips per episode). | MEDIUM | BullMQ or similar Redis-backed queue. POST /batch → job IDs → poll/webhook for results. Rate limit and concurrency management needed. |
| **Intro/outro animated templates** | Brand consistency: every video starts/ends the same way. OpusClip calls this "Brand Templates." Important for agencies and creators with consistent branding. | MEDIUM | Remotion compositions parameterized with brand props (logo, colors, text). Template store with default + custom uploads. |
| **B-roll placeholder overlay system** | Infrastructure for B-roll insertion ready from v1, even if actual clips are placeholders. Allows incremental enhancement without architecture changes. | LOW | Remotion `<Img>` or `<Video>` components with placeholder assets. Overlay timing from metadata JSON. Swap placeholders → real clips later. |
| **SRT/VTT subtitle export** | Not just burned-in subs — export sidecar files for platforms that support them (YouTube, Vimeo). Also enables manual editing in other tools. | LOW | Whisper/faster-whisper already produces segment data. Convert to SRT format with timestamp formatting. Straightforward. |
| **Progress tracking / status API** | Long-running videos (5-30 min input) need progress reporting. Users won't wait blindly. Essential for async/batch processing. | LOW | WebSocket or SSE for real-time. Poll endpoint (`GET /status/{jobId}`) as fallback. Report per-step progress: "Transcribing... 45%", "Removing silence...", etc. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Deliberately NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Web UI / Editor** | "Can't I just see and tweak the video in a browser?" | Massive scope expansion. A web editor is a separate product (see Kapwing, Canva). It requires timeline UI, drag-and-drop, real-time preview — weeks of frontend work that doesn't improve the pipeline. v1 is API-only per PROJECT.md. | API-first with intermediate artifact inspection. Users download artifacts, edit locally, re-upload. Or use Remotion Studio locally for preview. |
| **Smooth transitions on silence cuts** | "Hard cuts feel jarring." | Crossfades/dissolves require decoding overlapping segments, compositing, re-encoding. Adds significant FFmpeg pipeline complexity. Contradicts PROJECT.md explicit scope: "se elimina y junta directo." Hard cuts are the intended style — they're the viral format. | Hard cuts. This is a deliberate creative choice, not a limitation. Jump cuts are the standard in short-form content. |
| **Multi-format output (16:9, 1:1)** | "I need landscape and square too." | Each aspect ratio requires different reframing logic, subtitle positioning, safe zones. Doubles QA and template maintenance. 9:16 is the highest-demand format for the target market (TikTok, Reels, Shorts). | 9:16 only in v1. Add formats as separate pipeline steps when there's demand. The extensible architecture supports adding this later. |
| **Real-time processing** | "I want the result immediately." | Real-time video processing requires streaming architectures (WebRTC, media servers), GPU provisioning, and fundamentally different architecture. The target use case is batch repurposing of pre-recorded content, not live streaming. | Synchronous API for short inputs (< 2 min), async queue for longer. Progress tracking keeps users informed. |
| **AI clip selection / "viral moment" detection** | "OpusClip finds the best clips automatically." | This requires training ML models on engagement data or building complex heuristics. OpusClip spent years on this. It's a full ML problem, not a pipeline feature. Our pipeline processes ALL content — clip selection is orthogonal. | Pipeline processes the full video. User can trim input to desired segments, or future ML step can be added as an extensible pipeline container. |
| **AI voice-over / TTS** | "Generate narration automatically." | TTS is a completely separate domain requiring voice models, prosody, language support. Descript and OpusClip have invested heavily here. Not our pipeline's job. | Accept pre-recorded audio as input. If users need TTS, they can use ElevenLabs/WhisperSpeech separately and feed the result. |
| **Embedded media library (Pexels, Pixabay)** | "Auto-generate B-roll from stock footage." | API dependencies on third-party services. Licensing complexity. Search relevance is an unsolved ML problem. High latency. Per PROJECT.md: "B-roll con biblioteca propia o APIs externas — v1 usa placeholders." | Placeholder overlay system. Swap in real clips manually or via future pipeline step. |
| **Multi-speaker diarization** | "Handle interviews and podcasts with multiple speakers." | Speaker diarization is a hard ML problem. Whisper doesn't do it natively. Requires pyannote-audio or similar. Adds significant complexity for a secondary use case. | Support single-speaker talking-head input (per PROJECT.md constraint). Multi-speaker can be a future pipeline step. |

## Feature Dependencies

```
MP4 Input
    └──requires──> Pipeline Orchestrator (API entry point)
                        └──requires──> REST API (synchronous)

Whisper Transcription
    └──requires──> MP4 Input (audio extraction)
    └──enables──> Silence Detection (timestamps + no_speech threshold)
    └──enables──> Word-by-Word Subtitles (word_token timestamps)

Silence Detection & Removal
    └──requires──> Whisper Transcription (or standalone FFmpeg silencedetect)
    └──enables──> Clean Output Video (trimmed segments)

9:16 Vertical Output
    └──requires──> Silence-removed Video (or original if no silence)
    └──requires──> Smart Reframing (or falls back to center-crop)

Word-by-Word Subtitles
    └──requires──> Whisper Transcription (word-level timestamps)
    └──requires──> Remotion Rendering Pipeline
    └──enhances──> 9:16 Output (burned-in captions)

Batch Processing Queue
    └──requires──> REST API (single video processing)
    └──requires──> Progress Tracking

Smart Reframing
    └──enhances──> 9:16 Output (better subject centering)
    └──conflicts─── Simple center-crop (replaces fallback)

Intro/Outro Templates
    └──requires──> Remotion Rendering Pipeline
    └──requires──> Brand template data (logo, colors, font)

B-roll Placeholders
    └──requires──> Remotion Rendering Pipeline
    └──requires──> Overlay timing metadata

Progress Tracking
    └──requires──> Pipeline Orchestrator (step status reporting)
```

### Dependency Notes

- **Whisper Transcription enables everything:** It's the foundational step. Silence detection uses `no_speech_threshold` from Whisper. Subtitles use `word_timestamps`. The entire pipeline quality depends on transcription accuracy.
- **Silence Detection can be independent:** FFmpeg `silencedetect` works without Whisper, but Whisper's `no_speech_threshold` gives more intelligent silence detection (distinguishes pauses from ambient noise). Recommended: use both, Whisper as primary.
- **9:16 Output requires rendering pipeline:** Simply cropping FFmpeg output creates low-quality crops (loses speaker, misaligns subtitles). Remotion re-renders the full composition with proper layout, ensuring subtitles and overlays are positioned correctly in vertical format.
- **Smart Reframing conflicts with center-crop:** These are alternative strategies for the same step. Smart reframing replaces center-crop where a subject is detected. Center-crop is the safe fallback. Must implement fallback before implementing smart reframing.
- **Batch Processing requires stable single-video API:** Can't build a batch queue on top of an unreliable single-video endpoint. The synchronous API must be rock-solid first.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate "upload MP4 → get processed 9:16 video via API."

- [x] **MP4 input acceptance** — No pipeline without input. Basic validation, reject non-MP4 early.
- [x] **Whisper transcription with word-level timestamps** — Foundation for subtitles and silence detection. Use faster-whisper for speed.
- [x] **Silence detection and removal (hard cuts)** — Core value proposition. FFmpeg silencedetect → trim. No transitions.
- [x] **9:16 vertical output with center-crop** — Minimum viable reframing. Loses subject if off-center, but works for talking-head centered content.
- [x] **Word-by-word animated subtitles (burned-in)** — The killer feature for short-form. Remotion `@remotion/captions` with token highlighting.
- [x] **Synchronous REST API (single video)** — `POST /process` with multipart upload → wait → get video. The core interface.
- [x] **Intermediate artifact inspection** — `GET /artifacts/{jobId}/{step}` to download Whisper JSON, trimmed video, subtitle data. Core to pipeline transparency.

### Add After Validation (v1.x)

Features to add once the core pipeline works end-to-end and users validate the concept.

- [ ] **Progress tracking API** — Trigger: first user complaint about long waits with no feedback. `GET /status/{jobId}` returning step-level progress.
- [ ] **Batch processing queue (async)** — Trigger: users want to process multiple videos. `POST /batch` → job IDs → webhook/poll results. Requires BullMQ + Redis.
- [ ] **Smart reframing (subject tracking)** — Trigger: center-crop loses the speaker in common input videos. MediaPipe or YOLO for face detection → dynamic crop region.
- [ ] **SRT/VTT subtitle export** — Trigger: users want subtitles for YouTube upload or manual editing. Straightforward format conversion from Whisper data.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Automatic zoom/jump cuts** — Requires careful timing logic and may disorient viewers if poorly tuned. Validate basic pipeline first.
- [ ] **Intro/outro animated templates** — Requires template management, brand data storage. Nice-to-have but not essential for "process a video."
- [ ] **B-roll placeholder overlay system** — Infrastructure is easy; content isn't. Defer until core pipeline is validated and people are asking "how do I add B-roll?"
- [ ] **Multi-format output (16:9, 1:1)** — Each format doubles QA surface. Add when specific platform demand is validated (e.g., YouTube thumbnails need 16:9).
- [ ] **Webhook notifications** — Trigger: batch users need push notifications instead of polling. Low effort but depends on batch processing existing.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| MP4 input acceptance | HIGH | LOW | P1 |
| Whisper transcription + word timestamps | HIGH | MEDIUM | P1 |
| Silence detection & removal | HIGH | MEDIUM | P1 |
| 9:16 vertical output (center-crop) | HIGH | MEDIUM | P1 |
| Word-by-word animated subtitles | HIGH | MEDIUM | P1 |
| Synchronous REST API | HIGH | MEDIUM | P1 |
| Intermediate artifact inspection | MEDIUM | LOW | P1 |
| Progress tracking API | MEDIUM | LOW | P2 |
| Batch processing queue | HIGH | MEDIUM | P2 |
| Smart reframing (subject tracking) | HIGH | HIGH | P2 |
| SRT/VTT subtitle export | LOW | LOW | P2 |
| Automatic zoom/jump cuts | MEDIUM | HIGH | P3 |
| Intro/outro templates | MEDIUM | MEDIUM | P3 |
| B-roll placeholder system | LOW | LOW | P3 |
| Multi-format output | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch — the pipeline is non-functional without these
- P2: Should have, add after v1 validation — significant value but not required for first working version
- P3: Nice to have, future consideration — incremental value, high effort, or needs validated demand

## Competitor Feature Analysis

| Feature | OpusClip (SaaS) | Descript (SaaS/Desktop) | Vizard (SaaS) | Our Approach |
|---------|------------------|------------------------|---------------|--------------|
| **Transcription** | Automatic, multi-language | Automatic, "industry-leading accuracy" | Automatic, multi-language | Whisper/faster-whisper, self-hosted, word-level timestamps |
| **Silence removal** | Implicit in clip selection | "Edit for clarity" AI feature | Implicit in AI clipping | Explicit step with FFmpeg silencedetect + Whisper no_speech_threshold. Hard cuts, no transitions. |
| **Animated subtitles** | Built-in, multiple styles | Built-in, click-to-add | Built-in, auto-captioned | Remotion @remotion/captions with token highlighting. Fully programmable React styles. |
| **9:16 output** | Automatic + "ReframeAnything" | Manual or AI-assisted | AI reframing | Center-crop (v1) → Smart reframing with face tracking (v1.x). Extensible step. |
| **API** | REST API (paid plans) | API early access | API available | REST API first-class. Synchronous + async batch. |
| **Self-hosted** | No (cloud only) | No (desktop + cloud) | No (cloud only) | Docker-native, fully self-hosted. Zero per-minute fees. |
| **Extensibility** | Closed platform | Plugin ecosystem (limited) | Closed platform | Pipeline steps as Docker containers. Add any step without refactoring. |
| **B-roll** | "AI B-Roll" from stock library | "Generate media" AI images | Limited | Placeholder overlay system (v1) → real clip integration later |
| **Clip selection** | AI-powered "ClipAnything" | Manual + AI suggestions | AI-powered clipping | Not our job — pipeline processes full input. Clip selection is orthogonal. |
| **Pricing** | $9.99-29.99/mo + per-minute | $24-40/mo | $20-32/mo | Free (self-hosted) + compute costs only. Remotion Company License required if >3 employees. |

### Competitor Pattern Analysis

**What SaaS competitors have that we deliberately skip:**
- Clip selection / "viral moment detection" — ML-heavy, orthogonal to pipeline processing
- Web editor / timeline UI — Separate product category
- AI voice-over / TTS — Separate domain
- Stock media library — Third-party API dependency, licensing complexity
- Real-time processing — Fundamentally different architecture

**What we have that SaaS competitors can't offer:**
- Self-hosted = no data leaves your infrastructure
- No per-minute pricing = process 1,000 videos for the cost of compute
- Extensible pipeline = add any processing step as a Docker container
- Intermediate inspection = every step's output is visible and debuggable
- Full programmatic control = Remotion React components, not drag-and-drop

## Sources

- **Context7 (HIGH confidence):** OpenAI Whisper docs (/openai/whisper) — word-level timestamps API confirmed
- **Context7 (HIGH confidence):** faster-whisper docs (/systran/faster-whisper) — batched inference, VAD filter, word timestamps
- **Context7 (HIGH confidence):** Remotion docs (/remotion-dev/remotion) — SSR rendering, @remotion/captions with TikTokPage tokens
- **Context7 (HIGH confidence):** ffmpeg-python docs (/kkroening/ffmpeg-python) — atrim, asetpts filters for silence removal
- **Official site (HIGH confidence):** OpusClip (opus.pro) — feature list analyzed: ClipAnything, ReframeAnything, AI B-Roll, brand templates, API
- **Official site (HIGH confidence):** Descript (descript.com) — feature list analyzed: transcription, captions, edit for clarity, eye contact, API
- **Official site (MEDIUM confidence):** Vizard (vizard.ai) — JS-rendered, feature extraction from landing page only
- **Official GitHub (HIGH confidence):** Remotion license (github.com/remotion-dev/remotion) — Free for ≤3 employees, Company License otherwise

---
*Feature research for: Video Pipeline Docker (self-hosted video processing pipeline for social media)*
*Researched: 2026-05-05*