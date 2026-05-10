# Requirements: Video Pipeline Docker

**Defined:** 2026-05-05
**Core Value:** Transformar un video crudo de una persona hablando en un video dinámico para redes sociales con un solo comando API, eliminando silencios y agregando subtítulos automáticamente.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Pipeline Infrastructure

- [x] **PIPE-01**: Pipeline accepts MP4 video as input via shared Docker volume
- [x] **PIPE-02**: Each processing step runs in isolated Docker container with INPUT_PATH/OUTPUT_PATH contract
- [x] **PIPE-03**: Each step produces inspectable intermediate artifacts on shared named volume
- [x] **PIPE-04**: New processing steps can be added as Docker containers without refactoring existing pipeline
- [x] **PIPE-05**: FFmpeg version is pinned consistently across all containers

### Transcription

- [ ] **TRAN-01**: Pipeline extracts audio from input MP4 and transcribes with Whisper (evaluate whisperx for better word-level alignment)
- [ ] **TRAN-02**: Transcription produces word-level timestamps for subtitle synchronization
- [ ] **TRAN-03**: Whisper hallucination filter is applied (hallucination_silence_threshold) to prevent phantom text
- [ ] **TRAN-04**: Spanish language is explicitly configured (language="es", no .en models)

### Silence Processing

- [ ] **SILC-01**: Pipeline detects silent sections using FFmpeg silencedetect cross-referenced with Whisper no_speech data
- [ ] **SILC-02**: Silent sections are removed with hard cuts (no transitions)
- [ ] **SILC-03**: Audio-video sync is preserved after cuts (reset_timestamps + setpts=PTS-STARTPTS)
- [ ] **SILC-04**: Cut list is exported as inspectable JSON artifact

### Vertical Output

- [ ] **VERT-01**: Output video is rendered at 9:16 (1080x1920) for social media
- [ ] **VERT-02**: Center-crop is used as default reframing strategy
- [ ] **VERT-03**: Subtitles and overlays are positioned correctly within 9:16 safe zones

### Animated Subtitles

- [x] **SUBT-01**: Word-by-word animated subtitles are burned into output video using Remotion @remotion/captions
- [x] **SUBT-02**: Active word is highlighted TikTok-style (current word stands out visually)
- [x] **SUBT-03**: Subtitle timing is synchronized with audio (word-level timestamp alignment)

### Visual Enhancements

- [x] **VISU-01**: Animated intro template is rendered at video start (parameterized with brand props)
- [x] **VISU-02**: Animated outro template is rendered at video end (parameterized with brand props)
- [ ] **VISU-03**: Automatic zoom-in on speaker during emphasis moments (triggered by Whisper confidence/silence boundaries)
- [ ] **VISU-04**: Jump cuts have visual transitions (zoom or crop shift) to make cuts feel intentional

### SRT Export

- [ ] **SRTE-01**: Pipeline exports SRT/VTT subtitle sidecar files alongside burned-in video

### API - Synchronous

- [ ] **APIS-01**: POST /process endpoint accepts MP4 via multipart upload and returns processed video
- [ ] **APIS-02**: API returns URLs to all intermediate artifacts for inspection
- [ ] **APIS-03**: API handles timeouts for long videos gracefully

### API - Async Batch

- [ ] **APIA-01**: POST /batch endpoint accepts multiple videos and returns job IDs
- [ ] **APIA-02**: BullMQ + Redis job queue manages concurrent processing with rate limiting
- [ ] **APIA-03**: Pipeline orchestrator executes step sequence per job, managing container lifecycle

### Progress Tracking

- [ ] **PROG-01**: GET /status/{jobId} returns per-step progress (transcribing, removing silence, rendering, etc.)
- [ ] **PROG-02**: Progress includes current step name and completion percentage where available

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Smart Reframing

- **SMRT-01**: Subject tracking reframing replaces center-crop when speaker moves (face detection with MediaPipe/YOLO)
- **SMRT-02**: Fallback to center-crop when no subject detected

### Multi-Format Output

- **MFMT-01**: 16:9 horizontal output for YouTube/LinkedIn
- **MFMT-02**: 1:1 square output for Instagram Feed/Facebook

### Enhanced B-Roll

- **BROL-01**: B-roll placeholder overlay system with swap-in real clips later
- **BROL-02**: Integration with stock media APIs (Pexels/Pixabay)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI / editor | Separate product category; API-first in v1 |
| Smooth transitions on silence cuts | Deliberate creative choice per PROJECT.md — hard cuts are the viral format |
| AI clip selection / viral moment detection | Full ML problem orthogonal to pipeline processing |
| AI voice-over / TTS | Separate domain (ElevenLabs, WhisperSpeech) |
| Real-time processing | Fundamentally different architecture; batch and on-demand are sufficient |
| Multi-speaker diarization | Hard ML problem; single talking-head input per PROJECT.md |
| Embedded stock media library | Third-party API dependency + licensing complexity; B-roll uses placeholders |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 1 | Complete |
| PIPE-02 | Phase 1 | Complete |
| PIPE-03 | Phase 1 | Complete |
| PIPE-04 | Phase 1 | Complete |
| PIPE-05 | Phase 1 | Complete |
| TRAN-01 | Phase 2 | Pending |
| TRAN-02 | Phase 2 | Pending |
| TRAN-03 | Phase 2 | Pending |
| TRAN-04 | Phase 2 | Pending |
| SILC-01 | Phase 3 | Pending |
| SILC-02 | Phase 3 | Pending |
| SILC-03 | Phase 3 | Pending |
| SILC-04 | Phase 3 | Pending |
| VERT-01 | Phase 4 | Pending |
| VERT-02 | Phase 4 | Pending |
| VERT-03 | Phase 4 | Pending |
| SUBT-01 | Phase 5 | Complete |
| SUBT-02 | Phase 5 | Complete |
| SUBT-03 | Phase 5 | Complete |
| VISU-01 | Phase 6 | Complete |
| VISU-02 | Phase 6 | Complete |
| VISU-03 | Phase 7 | Pending |
| VISU-04 | Phase 7 | Pending |
| SRTE-01 | Phase 8 | Pending |
| APIS-01 | Phase 9 | Pending |
| APIS-02 | Phase 9 | Pending |
| APIS-03 | Phase 9 | Pending |
| APIA-01 | Phase 10 | Pending |
| APIA-02 | Phase 10 | Pending |
| APIA-03 | Phase 10 | Pending |
| PROG-01 | Phase 11 | Pending |
| PROG-02 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-05*
*Last updated: 2026-05-05 after roadmap creation (traceability mapped)*