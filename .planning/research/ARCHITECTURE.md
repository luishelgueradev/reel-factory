# Architecture Research

**Domain:** Docker-based video processing pipeline (MP4 → optimized 9:16 social video)
**Researched:** 2026-05-05
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  REST API         │  │  Job Queue       │  │  Status/Progress │   │
│  │  (Express/Fastify)│  │  (BullMQ+Redis)  │  │  Webhook/WS      │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
├───────────┴──────────────────────┴─────────────────────┴────────────┤
│                     Pipeline Orchestrator                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Step Runner: reads step config → invokes containers        │   │
│  │  in sequence, persists artifacts to shared volume            │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
├───────────────────────────────┴─────────────────────────────────────┤
│                     Processing Containers                            │
│  ┌─────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ Whisper │  │ Silence      │  │ Remotion    │  │ FFmpeg       │  │
│  │ (Python)│→ │ Cutter       │→ │ Renderer    │→ │ Finalizer    │  │
│  │         │  │ (Python)     │  │ (Node.js)   │  │ (Python/Node)│  │
│  └────┬────┘  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘  │
│       │              │                 │                │           │
├───────┴──────────────┴─────────────────┴────────────────┴──────────┤
│                     Shared Artifact Storage                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Docker Named Volume: /pipeline/artifacts/{jobId}/           │   │
│  │  ├── 01_transcription.json     (Whisper output)              │   │
│  │  ├── 02_silence_markers.json  (Silence detection output)     │   │
│  │  ├── 03_cut_video.mp4         (After silence removal)        │   │
│  │  ├── 04_subtitled_video.mp4   (After Remotion render)       │   │
│  │  ├── 05_final_9_16.mp4        (Final output)                 │   │
│  │  └── input.mp4                (Original upload)              │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                     Infrastructure                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐                       │
│  │ Docker    │  │ Redis    │  │ Shared Vol   │                       │
│  │ Engine    │  │ (queue+  │  │ (artifacts)  │                       │
│  │           │  │  state)  │  │              │                       │
│  └──────────┘  └──────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **API Gateway** | Accept uploads, validate input, return job status, serve processing results | Express.js or Fastify REST server |
| **Job Queue** | Decouple API from processing, manage concurrency, handle retries | BullMQ backed by Redis |
| **Pipeline Orchestrator** | Execute step sequence, manage container lifecycle, track progress per-step | Node.js service that invokes Docker containers in order |
| **Whisper Container** | Transcribe audio → JSON with word-level timestamps | faster-whisper Python service, reads MP4 audio track |
| **Silence Cutter Container** | Detect silence segments, generate cut list, remove silent sections | Python service using FFmpeg `silencedetect` + `silenceremove` |
| **Remotion Renderer Container** | Render dynamic subtitles, intros/outros, zooms as video overlay | Node.js container with Chrome headless, @remotion/renderer |
| **FFmpeg Finalizer Container** | Crop to 9:16, encode final H.264, normalize audio | FFmpeg CLI or ffmpeg-python for format conversion |
| **Shared Volume** | Persist intermediate artifacts between container steps | Docker named volume mounted at `/pipeline/artifacts/{jobId}/` |
| **Redis** | Job queue state, pipeline progress tracking, job metadata | BullMQ requires Redis; also stores step completion status |

## Recommended Project Structure

```
video-pipeline/
├── docker-compose.yml              # All services + shared volumes
├── services/
│   ├── api/                        # API Gateway
│   │   ├── src/
│   │   │   ├── routes/             # REST endpoints
│   │   │   ├── queue/             # BullMQ job producers
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── orchestrator/               # Pipeline Step Runner
│   │   ├── src/
│   │   │   ├── steps/             # Step definitions (config per container)
│   │   │   ├── runner.ts          # Container invocation logic
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── whisper/                    # Transcription step
│   │   ├── src/
│   │   │   ├── transcribe.py      # faster-whisper logic
│   │   │   └── main.py            # Entry: reads input, writes JSON
│   │   ├── Dockerfile              # Python + faster-whisper + CUDA
│   │   └── requirements.txt
│   ├── silence-cutter/             # Silence detection + cut step
│   │   ├── src/
│   │   │   ├── detect.py          # FFmpeg silencedetect analysis
│   │   │   ├── cut.py            # Apply silence removal
│   │   │   └── main.py
│   │   ├── Dockerfile              # Python + ffmpeg-python
│   │   └── requirements.txt
│   ├── remotion-renderer/          # Subtitle/overlay rendering step
│   │   ├── src/
│   │   │   ├── compositions/      # Remotion React components
│   │   │   │   ├── Subtitles.tsx  # Word-by-word subtitle comp
│   │   │   │   ├── IntroOutro.tsx # Intro/outro templates
│   │   │   │   └── ZoomCut.tsx    # Zoom/jump-cut comp
│   │   │   ├── Root.tsx           # Remotion root with <Composition>
│   │   │   ├── render.ts          # SSR render script
│   │   │   └── index.ts
│   │   ├── Dockerfile              # Node + Chrome + Remotion (Debian)
│   │   └── package.json
│   └── ffmpeg-finalizer/           # 9:16 crop + final encode
│       ├── src/
│       │   ├── finalize.py        # Crop, encode, normalize
│       │   └── main.py
│       ├── Dockerfile              # Python + ffmpeg-python
│       └── requirements.txt
├── shared/
│   ├── types/                      # Shared TypeScript/JSON schemas
│   │   ├── transcript.ts          # Transcription output schema
│   │   ├── silence-markers.ts     # Silence detection output schema
│   │   └── pipeline.ts            # Job/step status types
│   └── constants.ts                # Volume paths, container names
├── tests/
│   ├── integration/               # End-to-end pipeline tests
│   └── fixtures/                   # Sample MP4 files
└── docs/
    └── pipeline-steps.md           # Step contract documentation
```

### Structure Rationale

- **`services/`**: Each pipeline step is a fully self-contained Docker service with its own Dockerfile, deps, and entry point. This matches the project requirement that "any new step can be added as a Docker container in the sequence."
- **`shared/types/`**: Step contracts (input/output schemas) live outside any single service. Each container reads/writes JSON per a shared contract, enabling independent evolution.
- **`orchestrator/` as a separate service**: Decouples pipeline execution from the API. The orchestrator only knows the step sequence and how to invoke containers — it doesn't know what they do internally.
- **`remotion-renderer/src/compositions/`**: Remotion requires a specific project structure with `Root.tsx` and `<Composition>` components per official docs. This follows the documented pattern.

## Architectural Patterns

### Pattern 1: Sequential Step Pipeline with Shared Volume

**What:** Each processing step runs inside its own Docker container. Steps execute in sequence. They communicate exclusively through files on a shared Docker volume — never via network calls between containers. Each step reads an input artifact from a well-known path and writes an output artifact to the next well-known path.

**When to use:** This is the core pattern for the entire pipeline. Use it for every step.

**Trade-offs:**
- ✅ Full isolation: each step has its own runtime (Python vs Node.js), dependencies, and failure domain
- ✅ Inspectability: intermediate artifacts are files you can download/view between steps
- ✅ Extensibility: a new step just needs a container + a contract for its input/output files
- ❌ Latency: each container startup adds overhead (~2-5s per step)
- ❌ Storage: intermediate artifacts consume disk; needs cleanup strategy

**Example:**
```yaml
# docker-compose.yml — step container pattern
services:
  whisper:
    build: ./services/whisper
    volumes:
      - pipeline-artifacts:/pipeline/artifacts
    # Step reads: /pipeline/artifacts/{jobId}/input.mp4
    # Step writes: /pipeline/artifacts/{jobId}/01_transcription.json
    environment:
      - JOB_ID=${JOB_ID}
      - INPUT_PATH=/pipeline/artifacts/${JOB_ID}/input.mp4
      - OUTPUT_PATH=/pipeline/artifacts/${JOB_ID}/01_transcription.json
```

### Pattern 2: Job Queue + Async Processing for Batch

**What:** The API Gateway enqueues processing jobs via BullMQ. The orchestrator dequeues and runs them. Progress updates are written to Redis, queryable via the API.

**When to use:** For batch/multi-video processing. Single-video synchronous processing can skip the queue and run the pipeline directly.

**Trade-offs:**
- ✅ Backpressure: prevents GPU/CPU overload when many requests arrive
- ✅ Resilience: failed jobs can be retried from the last completed step
- ✅ Observability: job state is queryable at any point
- ❌ Complexity: adds Redis, BullMQ, job state management
- ❌ Eventual consistency: status queries may lag reality slightly

**Example:**
```typescript
// API Gateway — enqueue a job
import { Queue } from 'bullmq';
const pipelineQueue = new Queue('video-pipeline', { connection: redis });

app.post('/api/process', upload.single('video'), async (req, res) => {
  const jobId = crypto.randomUUID();
  // Save uploaded file to shared volume
  await saveUpload(req.file, `/pipeline/artifacts/${jobId}/input.mp4`);
  // Enqueue
  await pipelineQueue.add('process', { jobId, steps: defaultSteps });
  res.json({ jobId, status: 'queued' });
});

// Orchestrator — dequeue and run
worker.on('completed', async (job) => {
  await updateJobStatus(job.id, 'completed');
});
```

### Pattern 3: Step Contract Interface

**What:** Each step container adheres to a uniform interface: it reads input from `INPUT_PATH` env var, writes output to `OUTPUT_PATH` env var, and exits with code 0 on success or non-zero on failure. The orchestrator doesn't need to know the internal language or logic of the step.

**When to use:** For every pipeline step container. This is the extensibility contract.

**Trade-offs:**
- ✅ Language-agnostic: Whisper can be Python, Remotion can be Node.js
- ✅ Replaceable: swap whisper step with a different ASR with zero orchestrator changes
- ✅ Testable: test a step in isolation by mounting test data and running the container
- ❌ File-format coupling: step contracts must define exact JSON schemas for artifacts
- ❌ No streaming: data passes through files, not pipes — limits real-time processing

**Example:**
```python
# services/whisper/src/main.py — Step Contract Implementation
import os, json
from faster_whisper import WhisperModel

input_path = os.environ["INPUT_PATH"]    # MP4 file
output_path = os.environ["OUTPUT_PATH"]   # Where to write JSON

model = WhisperModel("large-v3", device="cuda", compute_type="float16")
segments, info = model.transcribe(input_path, word_timestamps=True)

result = {
    "language": info.language,
    "duration": info.duration,
    "segments": [
        {
            "start": seg.start,
            "end": seg.end,
            "text": seg.text,
            "words": [
                {"start": w.start, "end": w.end, "word": w.word, "probability": w.probability}
                for w in seg.words
            ]
        }
        for seg in segments
    ]
}

with open(output_path, "w") as f:
    json.dump(result, f, indent=2)
# Exit 0 = success. Orchestrator reads next step's input from this file.
```

### Pattern 4: Remotion Compositions as Overlay Templates

**What:** Remotion uses React components as video compositions. Each visual effect (subtitles, intro, zoom) is a `<Composition>` that receives `inputProps` with transcript/marker data. The render script bundles the project once, then renders each composition with different props.

**When to use:** For any visual overlay on the video — subtitles, intros, outros, zoom indicators, B-roll placeholders.

**Trade-offs:**
- ✅ Full programmatic control over visual effects via React
- ✅ Remotion Studio for live preview during development
- ✅ Reusable compositions with different props for different videos
- ❌ Chrome headless required in Docker (large image: ~1.5GB with dependencies)
- ❌ Render speed bound by Chrome; 1min video ~ 30-60s render time
- ❌ Must use Debian-based Docker image (Alpine causes >10s Rust launch delays per Remotion docs)

**Example:**
```tsx
// services/remotion-renderer/src/compositions/Subtitles.tsx
import {useCurrentFrame, useVideoConfig, AbsoluteFill} from 'remotion';

export const Subtitles: React.FC<{words: Word[], videoSrc: string}> = ({words, videoSrc}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentTime = frame / fps;

  // Find the currently spoken word
  const activeWord = words.find(w => currentTime >= w.start && currentTime < w.end);

  return (
    <AbsoluteFill>
      <video src={videoSrc} />
      {activeWord && (
        <div style={{
          position: 'absolute',
          bottom: 80,
          textAlign: 'center',
          fontSize: 48,
          fontWeight: 800,
          color: 'white',
          textShadow: '2px 2px 4px black',
        }}>
          {activeWord.word}
        </div>
      )}
    </AbsoluteFill>
  );
};
```

## Data Flow

### Request Flow (Synchronous Single Video)

```
[Client POST /api/process with MP4]
    ↓
[API Gateway] → Save file to shared volume → Run pipeline directly
    ↓
[Orchestrator] → Step 1: docker run whisper --env JOB_ID,INPUT_PATH,OUTPUT_PATH
    ↓                 reads input.mp4 → writes 01_transcription.json
[Orchestrator] → Step 2: docker run silence-cutter --env ...
    ↓                 reads 01_transcription.json + input.mp4 → writes 02_silence_markers.json + 03_cut_video.mp4
[Orchestrator] → Step 3: docker run remotion-renderer --env ...
    ↓                 reads 01_transcription.json + 03_cut_video.mp4 → writes 04_subtitled_video.mp4
[Orchestrator] → Step 4: docker run ffmpeg-finalizer --env ...
    ↓                 reads 04_subtitled_video.mp4 → writes 05_final_9_16.mp4
[API Gateway] ← Return {jobId, outputUrl, artifacts: [...]}
```

### Request Flow (Async Batch)

```
[Client POST /api/batch with MP4s]
    ↓
[API Gateway] → Save files → Enqueue jobs to BullMQ → Return {jobIds}
    ↓
[Orchestrator Worker] → Dequeue job → Run pipeline steps sequentially
    ↓                                    (same as above)
[Redis] ← Progress updated after each step completes
    ↓
[Client GET /api/status/{jobId}] → Read from Redis → Return step-level progress
    ↓
[Webhook/WS] → Notify on completion
```

### State Management

```
[Redis]
    ├── bull:video-pipeline:{jobId}   — BullMQ job data
    ├── pipeline:{jobId}:status       — Current step, % complete
    ├── pipeline:{jobId}:artifacts    — List of artifact file paths
    └── pipeline:{jobId}:errors       — Step failures with stack traces
```

### Key Data Flows

1. **Video file flow:** `input.mp4 → [Whisper extracts audio internally] → 01_transcription.json → [Silence Cutter re-encodes] → 03_cut_video.mp4 → [Remotion overlays] → 04_subtitled_video.mp4 → [FFmpeg crops] → 05_final_9_16.mp4`. The full video file only moves between silence-cutter, remotion-renderer, and ffmpeg-finalizer. Whisper only needs the audio track (it extracts it internally via PyAV).

2. **Metadata flow:** `Whisper produces transcript JSON → Silence cutter reads transcript + detects silence → produces silence_markers.json → Remotion reads transcript JSON + silence markers (for zoom/cut animations) → produces final render with props`. Metadata flows forward through the pipeline via JSON files on the shared volume.

3. **Progress flow:** Each step container writes a `_status.json` file to the artifact directory upon completion. The orchestrator reads this to update Redis. The API reads Redis to report progress to clients.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10 concurrent jobs | Single Docker Compose setup, 1 GPU (if available), serial pipeline execution. All containers on one host. |
| 10-100 concurrent jobs | Add BullMQ concurrency limits (e.g., max 3 GPU-bound jobs). Run multiple orchestrator workers. Consider separate GPU and CPU node pools (Whisper + Remotion need GPU; silence-cutter and finalizer are CPU-only). |
| 100+ concurrent jobs | Move to Docker Swarm or Kubernetes. Artifact storage moves from Docker volumes to S3/MinIO. Add horizontal scaling for orchestrator workers. Pre-warm Whisper model containers (model loading takes ~5-10s). |

### Scaling Priorities

1. **First bottleneck — GPU memory:** Both Whisper and Remotion render need GPU. They cannot run concurrently on the same GPU without OOM. **Fix:** Queue GPU-bound steps, serialize Whisper → Remotion on each GPU. Add a second GPU for parallel job processing.
2. **Second bottleneck — Remotion render time:** Chrome-rendered video is ~30-60s per minute of output. **Fix:** Run multiple Remotion containers on separate CPU cores. Use `--concurrency` flag in `renderMedia()` for parallel frame rendering within a single render.

## Anti-Patterns

### Anti-Pattern 1: Containers Talking to Each Other Over HTTP

**What people do:** Each step container exposes an HTTP endpoint, and the orchestrator calls them via REST.
**Why it's wrong:** Couples step lifecycle to network availability. Container startup → HTTP ready is unreliable. Adds authentication, retry, and error handling complexity that file-based contracts avoid entirely.
**Do this instead:** Use the Step Contract pattern — containers exit when done, communicate via files on a shared volume. The orchestrator checks `docker run` exit code.

### Anti-Pattern 2: Processing the Entire Video in Memory

**What people do:** Load the full MP4 into memory, process it, return bytes.
**Why it's wrong:** A 10-minute 1080p video is ~500MB. Multiple concurrent jobs = OOM killers. Also prevents inspectability of intermediate outputs.
**Do this instead:** Stream through files. Each step reads from disk, writes to disk. Shared volume artifacts are the processing interface. Clean up old artifacts with a TTL or post-completion sweep.

### Anti-Pattern 3: Monolithic Docker Image with All Tools

**What people do:** Build one giant Docker image with Whisper, FFmpeg, Remotion, Chrome, Node, Python.
**Why it's wrong:** Image is 5-8GB, rebuilds take 20+ minutes. Can't scale GPU steps separately from CPU steps. Fails the extensibility requirement (new steps require rebuilding the monolith).
**Do this instead:** Separate Dockerfile per service. Whisper image: Python + CUDA + faster-whisper (~3GB). Remotion image: Node + Chrome headless + Debian (~2GB). Silence-cutter / finalizer: Python + FFmpeg (~500MB each). Rebuild only what changes.

### Anti-Pattern 4: Alpine Linux for Remotion Container

**What people do:** Use `node:XX-alpine` for smaller Remotion image size.
**Why it's wrong:** Remotion's official docs explicitly warn against Alpine: Rust parts launch >10s slower per render, and Chrome version pinning is impossible because Alpine doesn't keep old package versions.
**Do this instead:** Use `node:22-bookworm-slim` (Debian-based) per official Remotion Docker guide. It's well-tested and faster for video rendering workloads.

### Anti-Pattern 5: Skipping Word-Level Timestamps in Whisper

**What people do:** Use segment-level timestamps from Whisper (30s chunks) and try to time subtitles from that.
**Why it's wrong:** Segment timestamps are too coarse for word-by-word subtitle animation. Each segment covers many seconds and multiple sentences.
**Do this instead:** Always use `word_timestamps=True` with faster-whisper. This provides per-word start/end times, which is the data source for Remotion's word-by-word subtitle composition. This is a first-class feature of both openai/whisper and faster-whisper.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| FFmpeg (native) | CLI invocation from Python container | Use `ffmpeg-python` bindings; ensure FFmpeg binary is in container PATH |
| faster-whisper | Python library in container | No FFmpeg needed — PyAV bundles FFmpeg libs. CUDA 12 + cuDNN 9 for GPU |
| Remotion | Node.js SSR APIs: `bundle()` → `selectComposition()` → `renderMedia()` | Requires Chrome Headless Shell. Use `npx remotion browser ensure` to install |
| Docker Engine | Container lifecycle via `docker run` (or Docker API) | Orchestrator invokes steps as `docker run --rm -v ... --env ...` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API ↔ Orchestrator | BullMQ job queue + Redis state | Async: API enqueues, Orchestrator dequeues. Sync: API invokes Runner directly |
| Orchestrator ↔ Step Containers | Docker run (exit code) + shared volume files | Orchestrator reads exit code. Success = 0. Reads artifact files from volume. |
| Whisper ↔ Silence Cutter | JSON file on shared volume | Contract: `01_transcription.json` with word-level timestamps |
| Silence Cutter ↔ Remotion | 2 files: `03_cut_video.mp4` + `02_silence_markers.json` | Remotion reads both — video for source, markers for cut-point animations |
| Remotion ↔ FFmpeg Finalizer | Single MP4 file on shared volume | `04_subtitled_video.mp4` — Remotion output is the finalizer's input |

## Build Order (Dependencies Between Components)

This is the recommended implementation sequence, ordered by what other components depend on:

```
1. Shared Volume + Step Contract Schema
   ↑ (all steps depend on this)
2. FFmpeg Finalizer (simplest step, validates end-to-end with test video)
   ↑ (validates shared volume pattern works)
3. Whisper Container (independent — only needs an MP4)
   ↑ (produces transcript data needed by silence cutter + Remotion)
4. Silence Cutter (depends on transcript + video)
   ↑ (produces cut video needed by Remotion)
5. Remotion Renderer (depends on cut video + transcript)
   ↑ (most complex — Chrome, compositions, SSR rendering)
6. Pipeline Orchestrator (composes steps 2-5 into sequence)
   ↑ (needs all steps working individually first)
7. API Gateway + Job Queue (exposes pipeline to external clients)
   ↑ (needs orchestrator running)
8. Batch Processing + Status (builds on single-job foundation)
```

**Rationale:**
- **Step contracts first** because every container depends on the I/O contract being stable
- **FFmpeg Finalizer before Whisper** because it's the simplest container to build and validates that the Docker+volume pattern works end-to-end
- **Whisper before Silence Cutter** because the cutter needs transcript data
- **Silence Cutter before Remotion** because Remotion needs the cut video as input
- **Remotion last among processing steps** because it's the most complex (Chrome + React + SSR)
- **Orchestrator after all steps** because it composes working containers into a sequence
- **API Gateway last** because it needs the orchestrator running

## Sources

- Remotion Docker documentation: https://remotion.dev/docs/docker (HIGH confidence — official docs, verified 2024+)
- Remotion SSR rendering APIs: Context7 /remotion-dev/remotion — `bundle()`, `selectComposition()`, `renderMedia()` (HIGH confidence)
- faster-whisper word timestamps + Docker GPU requirements: Context7 /systran/faster-whisper + GitHub README (HIGH confidence)
- FFmpeg filter documentation — `silencedetect`, `silenceremove`: Context7 /kkroening/ffmpeg-python + https://ffmpeg.org/ffmpeg-filters.html (HIGH confidence)
- Remotion Linux dependencies (Debian required, Alpine unsupported): https://remotion.dev/docs/miscellaneous/linux-dependencies (HIGH confidence)
- faster-whisper GPU Docker base image: `nvidia/cuda:12.3.2-cudnn9-runtime-ubuntu22.04` (MEDIUM confidence — from GitHub README)

---
*Architecture research for: Docker-based video processing pipeline*
*Researched: 2026-05-05*