# Phase 15: Whisper externalization - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 4 (1 new dir, 2 edits, 1 delete)
**Analogs found:** 4 / 4

## Recommendation up front: the new step is PYTHON

Every existing pipeline-step container (`whisper`, `silence-cutter`, `ffmpeg-finalizer`,
`quality-finalizer`) is **Python on `video-pipeline-base-python:latest`**. The new
`whisper-http-step` MUST do two things both of which are already first-class in those
Python steps: (1) **ffprobe duration probing** (D-2/D-6) — the exact `subprocess.run(["ffprobe", ...])`
idiom already exists in `quality-finalizer/src/downscale.py:30` and `whisper/src/audio_extraction.py:36`;
(2) **read INPUT_PATH/OUTPUT_PATH/PIPELINE_JOB_ID + write manifest.json + exit code**, which is
identical boilerplate across every Python `main.py`.

The base-python image already ships ffmpeg/ffprobe (CLAUDE.md: "FFmpeg 7.1.1 from base-python").
For HTTP, the project has **NO existing HTTP-client code in either language** (grep found zero
`requests`/`httpx`/`urllib` in Python and zero `axios`/`fetch` in service `.ts`). Python stdlib
`urllib.request` can do the multipart POST with no new dependency, but the cleanest path is to add
`requests` (or `httpx`) to `requirements.txt` — it handles multipart file upload, `Retry-After`,
and JSON cleanly. **Recommend `requests` (sync; simplest for a one-shot step that blocks until done).**

Choosing Python keeps the step on the same base image, reuses the manifest/exit-code contract
verbatim, and lets the planner copy `quality-finalizer` almost line-for-line.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/whisper-http-step/main.py` | step entry | request-response (HTTP) + file-I/O | `services/quality-finalizer/main.py` | exact (boilerplate) |
| `services/whisper-http-step/src/transcribe_http.py` | core logic | request-response | `services/quality-finalizer/src/downscale.py` (subprocess shape) + NEW http | role-match |
| `services/whisper-http-step/src/config.py` | config | n/a | `services/whisper/src/config.py` | exact |
| `services/whisper-http-step/src/schema.py` | model | n/a | `services/whisper/src/schema.py` (Transcript) | exact |
| `services/whisper-http-step/Dockerfile` | config | n/a | `services/quality-finalizer/Dockerfile` | exact |
| `services/whisper-http-step/requirements.txt` | config | n/a | `services/quality-finalizer/requirements.txt` | role-match |
| `services/whisper-http-step/tests/test_transcribe_http.py` | test | n/a | `services/whisper/tests/test_transcription.py` + `quality-finalizer/tests/test_downscale.py` | role-match |
| `services/api-server/src/orchestrator.ts` (EDIT) | orchestrator | n/a | self (STEPS[0] entry) | exact |
| `docker-compose.yml` (EDIT) | config | n/a | self (whisper service block) | exact |
| `services/whisper/` (DELETE) | — | — | — | n/a |

## Pattern Assignments

### `services/whisper-http-step/main.py` (step entry, request-response + file-I/O)

**Analog:** `services/quality-finalizer/main.py` — copy the whole skeleton; only the
"middle" (probe + downscale) is replaced by (probe + HTTP transcribe).

**Env-var read + validation** (`quality-finalizer/main.py:34-50`) — copy verbatim:
```python
input_path = os.environ.get("INPUT_PATH")
output_path = os.environ.get("OUTPUT_PATH")
job_id = os.environ.get("PIPELINE_JOB_ID")

if not input_path:
    print("ERROR: INPUT_PATH environment variable is not set", file=sys.stderr)
    sys.exit(1)
# ... same guard for OUTPUT_PATH and PIPELINE_JOB_ID
```

**Input-exists check + output dir + try/except/manifest** (`quality-finalizer/main.py:57-123`) —
this is the exact error-mapping contract the orchestrator reads. The HTTP step maps any
`PipelineStepError`/HTTP failure into the SAME `_write_manifest(status="error", exit_code=1, error_message=...)`
+ `sys.exit(1)` shape:
```python
if not os.path.exists(input_path):
    error_msg = f"Input file not found at {input_path}"
    _write_manifest(input_file=input_path, output_files=[], duration_seconds=time.time()-start_time,
                    status="error", exit_code=1, error_message=error_msg)
    sys.exit(1)

output_dir = os.path.dirname(output_path)
os.makedirs(output_dir, exist_ok=True)

try:
    # >>> REPLACE quality-finalizer body with:
    #   1. duration = probe_duration(input_path)            (ffprobe — see downscale.py:30)
    #   2. body = transcribe_via_http(input_path, duration) (sync /transcribe or /jobs+poll)
    #   3. write body verbatim to output_path                (it IS the reels transcript.json)
    with open(output_path, "w") as f:
        json.dump(body, f, indent=2)
    _write_manifest(input_file=input_path, output_files=[output_path],
                    duration_seconds=time.time()-start_time, status="success", exit_code=0)
    sys.exit(0)
except Exception as e:
    error_msg = f"Whisper HTTP step failed: {e}"
    print(f"ERROR: {error_msg}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    _write_manifest(input_file=input_path, output_files=[], duration_seconds=time.time()-start_time,
                    status="error", exit_code=1, error_message=error_msg)
    sys.exit(1)
```

**`_write_manifest` helper** (`quality-finalizer/main.py:126-164`) — copy VERBATIM. This is the
exact `PipelineManifest` shape the orchestrator parses (`orchestrator.ts:286-301` reads
`manifest.status`, `manifest.exit_code`, `manifest.error_message`). Manifest dir is derived from
`OUTPUT_PATH`, written to `<output_dir>/manifest.json`. The orchestrator healthcheck/contract waits
on `manifest.json` existing — DO NOT rename it.

> NOTE on the "no audio" branch: the old `whisper/main.py:79-103` writes an EMPTY transcript and
> exits 0 when there's no audio stream. The new step's whisper-api returns `400 NO_AUDIO_STREAM`
> for that case (CONTEXT line 26). Per the error table (contract §4), `NO_AUDIO_STREAM` → fail the
> step. Planner: decide whether to preserve the legacy "empty transcript, exit 0" behavior
> (pre-probe for audio stream like `audio_extraction.py:36-60` and short-circuit) or adopt the new
> fail-step semantics. The contract says fail; legacy was lenient. Flag for the plan.

### `services/whisper-http-step/src/transcribe_http.py` (core logic, request-response)

**Analog for the ffprobe duration probe:** `services/quality-finalizer/src/downscale.py:30-61`
(`probe_video`) and `services/whisper/src/audio_extraction.py:36-60`. The duration field is already
extracted at `downscale.py:58-59`:
```python
cmd = ["ffprobe", "-v", "quiet",
       "-show_entries", "format=duration", "-of", "json", input_path]
result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
if result.returncode != 0:
    raise RuntimeError(f"ffprobe failed: {result.stderr}")
data = json.loads(result.stdout)
duration = float(data.get("format", {}).get("duration", 0.0))
```
For the D-6 pre-validation: if `duration > config.MAX_DURATION_S` raise a friendly error BEFORE
sending (the try/except in main.py turns it into a manifest error). Note the `subprocess.run` list-argv
(no shell) injection-safety comment at `downscale.py:100-102` — keep that convention.

**HTTP client — NO existing analog (grep confirmed zero HTTP code in repo).** This is greenfield;
use `requests`. Shape it from the contract (CONTEXT lines 18, 24-26; contract §3 lines 90-108):
```python
import requests

# Sync path: duration <= SYNC_THRESHOLD_S (D-2 default 120s)
resp = requests.post(
    f"{config.WHISPER_API_URL}/transcribe",
    headers={"X-API-Key": config.WHISPER_API_KEY},
    files={"file": open(input_path, "rb")},
    data={"language": "es", "profile": "reels"},
    timeout=config.SYNC_TIMEOUT_S,
)
# 200 -> resp.json() is the BARE reels body -> return it (write verbatim to transcript.json)

# Async path: POST /jobs -> 202 {job_id, status:"queued"}; poll GET /jobs/{job_id} ~2s
#   until status in {"done","failed"}. done -> resp["result"]; failed -> raise PipelineStepError.
#   503 QUEUE_FULL -> honor Retry-After header, backoff, max 2 retries (CONTEXT line 18).
```
**Error mapping** (contract §4, lines 122-131): map HTTP status → raised exception that the main.py
try/except turns into a manifest error:
| whisper-api response | step action |
|---|---|
| 200 / job `done` | return `body` / `result`, write transcript.json, exit 0 |
| 400 INVALID_LANGUAGE / NO_AUDIO_STREAM | raise → fail (bad input) |
| 401 UNAUTHORIZED | raise → fail (config: WHISPER_API_KEY) |
| 413 FILE_TOO_LARGE | raise → fail (or pre-validate via ffprobe duration + file size) |
| 503 QUEUE_FULL (Retry-After) | backoff + retry, max 2, then raise |
| 500 MODEL_ERROR / job `failed` | raise with `{code,message}` |

The error JSON shape from whisper-api is uniform: `{status:"error", code, message}` (CONTEXT line 26).

### `services/whisper-http-step/src/config.py` (config)

**Analog:** `services/whisper/src/config.py:1-35` (the comment-per-constant + traceability style)
and `quality-finalizer/src/config.py` (the `*_ENV` override-name pattern at lines 25-33).
New constants needed (D-2/D-3/D-6 locked):
```python
STEP_NAME = "whisper"   # MUST stay "whisper" — orchestrator + downstream paths key on it
                        # (transcript.json lives at pipeline/{jobId}/whisper/). See note below.
WHISPER_API_URL = os.environ.get("WHISPER_API_URL", "http://host.docker.internal:8000")  # D-3
WHISPER_API_KEY = os.environ.get("WHISPER_API_KEY", "")                                   # D-3
WHISPER_LANGUAGE = "es"          # contract: service rejects non-es with 400
WHISPER_PROFILE = "reels"        # bare body — written verbatim to transcript.json
SYNC_THRESHOLD_S = 120           # D-2: <=120s -> /transcribe sync; else /jobs async
MAX_DURATION_S = 600             # D-6: pre-validate before send (service cap)
POLL_INTERVAL_S = 2              # D-2: poll GET /jobs/{id} ~every 2s
MAX_QUEUE_RETRIES = 2            # D-2: 503 QUEUE_FULL backoff cap
```
> CRITICAL `STEP_NAME` decision: downstream steps (silence-cutter, remotion-renderer, srt-exporter)
> read `TRANSCRIPT_PATH=/data/pipeline/{jobId}/whisper/transcript.json` (orchestrator.ts:74,98,136;
> docker-compose.yml:112,261). The orchestrator finds the manifest at `pipeline/{jobId}/<step.name>/`
> (orchestrator.ts:279-284). So the new step's OUTPUT_PATH dir + manifest dir + STEP_NAME must all
> remain `whisper` to keep zero downstream change (this is the whole point of the file-based contract,
> contract §1 line 24). Plan 15-02 keeps the orchestrator STEP `name: "whisper"` and only swaps `image`.

### `services/whisper-http-step/src/schema.py` (model — optional, for response validation)

**Analog:** `services/whisper/src/schema.py` (`Transcript`, `TranscriptSegment`, `TranscriptWord`
pydantic models). The whisper-api already returns the exact reels shape `{language, model, segments,
words, duration}` (contract §2). Writing the body verbatim needs no schema, but the validation plan
(contract §6 line 149) wants a field-for-field contract test — reuse the old `Transcript` pydantic
model here as the assertion target. Keep `services/whisper/src/schema.py` + `validate.py` content as
the reference contract before deleting the dir (CONTEXT D-5 / contract D-5 line 115).

### `services/whisper-http-step/Dockerfile` (config)

**Analog:** `services/quality-finalizer/Dockerfile:1-11` — copy VERBATIM. base-python ships
ffmpeg/ffprobe; NO GPU stanza (the external service owns the GPU now, D-4):
```dockerfile
FROM video-pipeline-base-python:latest
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
COPY src/ src/
CMD ["python", "main.py"]
```

### `services/whisper-http-step/requirements.txt` (config)

**Analog:** `services/quality-finalizer/requirements.txt` (just `pydantic>=2.0.0`). The new step
DROPS the heavy whisper deps (`faster-whisper`, `whisperx`, `torch`, `ctranslate2`, `numpy` —
`services/whisper/requirements.txt`) and adds an HTTP client:
```
pydantic>=2.0.0
requests>=2.31.0
```

### `services/whisper-http-step/tests/test_transcribe_http.py` (test)

**Analogs:** `services/whisper/tests/test_transcription.py:1-60` (pytest in-memory fixtures, no GPU)
and `services/quality-finalizer/tests/test_downscale.py:1-33` (the `sys.path.insert` shim + pure-logic
tests that DON'T invoke subprocess). The `sys.path` shim (`test_downscale.py:10-14`) is the project
convention for importing the service `src/` under pytest:
```python
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.transcribe_http import transcribe_via_http  # noqa: E402
```
Test against a **mock whisper-api** (CONTEXT 15-01): use `requests-mock` or `monkeypatch`/`unittest.mock`
on `requests.post`/`requests.get` to assert:
- sync path chosen for duration <= 120s, async path for > 120s (D-2)
- 200 bare body returned verbatim
- 401/400/413/500 → raise (error mapping)
- 503 + Retry-After → retries then raises after MAX_QUEUE_RETRIES
- duration > MAX_DURATION_S → pre-send rejection (no HTTP call)
Add `requests-mock` (or rely on `unittest.mock`) to a dev-deps note. ffprobe in tests should be
monkeypatched, matching `test_downscale.py`'s "do NOT invoke ffmpeg/ffprobe" convention.

### `services/api-server/src/orchestrator.ts` (EDIT — STEP swap, Plan 15-02)

**Analog:** itself. The STEPS array entry to change is `STEPS[0]` (`orchestrator.ts:57-66`).
Current:
```ts
{
  name: "whisper",
  image: "reel-factory-whisper",
  envVars: {
    INPUT_PATH: "/data/pipeline/{jobId}/input/video.mp4",
    OUTPUT_PATH: "/data/pipeline/{jobId}/whisper/transcript.json",
    PIPELINE_JOB_ID: "{jobId}",
    HF_HOME: "/data/pipeline/.cache/huggingface",
  },
},
```
Target (15-02): keep `name: "whisper"` (downstream + manifest path depend on it), swap `image`,
drop `HF_HOME`, add the two new envs:
```ts
{
  name: "whisper",
  image: "reel-factory-whisper-http-step",
  envVars: {
    INPUT_PATH: "/data/pipeline/{jobId}/input/video.mp4",
    OUTPUT_PATH: "/data/pipeline/{jobId}/whisper/transcript.json",
    PIPELINE_JOB_ID: "{jobId}",
    WHISPER_API_URL: process.env.WHISPER_API_URL || "http://host.docker.internal:8000",
    WHISPER_API_KEY: process.env.WHISPER_API_KEY || "",
  },
},
```
**Also remove the GPU device request** at `orchestrator.ts:243-253` — the `if (step.name === "whisper")`
NVIDIA `DeviceRequests` block is no longer needed (D-4: service owns the GPU). The step now needs
`host.docker.internal` reachability instead. `{jobId}` templating is handled by `resolveEnvVars`
(`orchestrator.ts:168-174`) — only `{jobId}` is substituted; `process.env`-sourced values resolve at
module load. `createContainer` binds `NetworkMode: PIPELINE_NETWORK` (`orchestrator.ts:236`); on Docker
Desktop/WSL2 `host.docker.internal` resolves from the bridge network out of the box (D-3) — no extra
network config needed, but verify in 15-02.

**Tests to update:** `services/api-server/src/orchestrator.test.ts:48-55` asserts
`image === "reel-factory-whisper"` and `HF_HOME === "/data/pipeline/.cache/huggingface"`, and line 235
asserts `firstCall.Image === "reel-factory-whisper"`. These break on the swap — update them in 15-02
to the new image + new env assertions (WHISPER_API_URL / WHISPER_API_KEY present, HF_HOME absent).

### `docker-compose.yml` (EDIT — Plan 15-02)

**Analog:** the existing `whisper:` service block (`docker-compose.yml:42-71`) and any
non-GPU step (`quality-finalizer`/`silence-cutter:75-95` for the clean `<<: *pipeline-common`
+ healthcheck shape). Replace the GPU whisper block with an HTTP-step block: drop the
`deploy.resources.reservations.devices` GPU stanza (lines 59-65) and the `HF_HOME` env (line 58),
swap `build.context` to `./services/whisper-http-step`, add `WHISPER_API_URL` / `WHISPER_API_KEY`
env, and add `host.docker.internal` reachability:
```yaml
  whisper:
    <<: *pipeline-common
    image: reel-factory-whisper-http-step:latest
    build:
      context: ./services/whisper-http-step
    depends_on:
      base-python:
        condition: service_completed_successfully
    environment:
      - INPUT_PATH=/data/pipeline/${PIPELINE_JOB_ID}/input/video.mp4
      - OUTPUT_PATH=/data/pipeline/${PIPELINE_JOB_ID}/whisper/transcript.json
      - PIPELINE_JOB_ID=${PIPELINE_JOB_ID}
      - WHISPER_API_URL=${WHISPER_API_URL:-http://host.docker.internal:8000}
      - WHISPER_API_KEY=${WHISPER_API_KEY:-}
    extra_hosts:
      - "host.docker.internal:host-gateway"   # D-3: reach the external whisper-api stack
    healthcheck:
      test: ["CMD", "test", "-f", "/data/pipeline/${PIPELINE_JOB_ID}/whisper/manifest.json"]
      interval: 5s
      timeout: 10s
      retries: 3
      start_period: 15s
```
Note: keep the compose service KEY as `whisper` and the `OUTPUT_PATH` dir as `whisper/` so
`srt-exporter.depends_on.whisper` (lines 253-254) and all `TRANSCRIPT_PATH` references (lines 112, 261)
keep resolving. The `whisper` healthcheck `start_period` can drop from 30s → 15s (no model load).

### `services/whisper/` (DELETE — Plan 15-03, after parity + e2e pass)

**Files to remove** (full tree, all referenced ONLY by the old whisper service):
```
services/whisper/Dockerfile, main.py, requirements.txt
services/whisper/src/{__init__,audio_extraction,config,hallucination_filter,schema,transcribe,validate}.py
services/whisper/tests/{__init__,test_transcription}.py
services/whisper/.pytest_cache/   (cruft)
```
**Retirement is clean — verified by grep.** The only external references to the old service are:
- `image: reel-factory-whisper` — `orchestrator.ts:59`, `docker-compose.yml:47-49` (build.context
  `./services/whisper`) → both handled by the 15-02 swap above.
- `orchestrator.test.ts:48,235` GPU/image asserts → updated in 15-02.
- The `whisper` STEP NAME and `pipeline/{jobId}/whisper/transcript.json` path are NOT tied to the
  `services/whisper/` directory — they survive the swap (the new step keeps the name).
**Preserve as contract reference (D-5):** before deletion, copy `services/whisper/src/schema.py` +
`validate.py` into the new step's `schema.py` / a contract test, OR keep them in
`.planning/contracts/`. CONTEXT D-5 (line 19) says the contract is already captured so deletion is OK;
the validation plan (contract §6) still wants a field-for-field schema assertion — port it before
deleting.

## Shared Patterns

### Step contract (env-in / file-out / manifest / exit-code)
**Source:** `services/quality-finalizer/main.py:34-164` (cleanest, most recent embodiment).
**Apply to:** the new `whisper-http-step/main.py`.
- Read `INPUT_PATH`, `OUTPUT_PATH`, `PIPELINE_JOB_ID`; guard each → `sys.exit(1)`.
- `os.makedirs(os.path.dirname(output_path), exist_ok=True)`.
- Wrap work in try/except; on success `_write_manifest(status="success", exit_code=0)` + `sys.exit(0)`;
  on failure `_write_manifest(status="error", exit_code=1, error_message=...)` + `sys.exit(1)`.
- `manifest.json` written next to the output, shape:
  `{step_name, input_file, output_files[], duration_seconds, timestamp, status, exit_code, error_message?}`.

### Manifest → orchestrator error mapping
**Source:** `services/api-server/src/orchestrator.ts:286-309` + `PipelineStepError` (lines 35-47).
**Apply to:** the new step's failure paths.
The orchestrator reads `pipeline/{jobId}/<step.name>/manifest.json`; `status==="error"` →
`PipelineStepError(step.name, manifest.exit_code, manifest.error_message)`. Non-zero container exit
without manifest → same error. So ALL HTTP failures (401/400/413/500/persistent-503) must surface as
a non-zero exit + error manifest — exactly what the try/except in main.py produces.

### ffprobe subprocess idiom (injection-safe list argv)
**Source:** `services/quality-finalizer/src/downscale.py:37-61` and `whisper/src/audio_extraction.py:36-60`.
**Apply to:** the duration probe in `transcribe_http.py`.
`subprocess.run([... list argv ...], capture_output=True, text=True, timeout=30)`; check `returncode`;
`json.loads(result.stdout)`; read `format.duration`. Never shell-interpolate `INPUT_PATH`.

### Dockerfile / base image
**Source:** `services/quality-finalizer/Dockerfile`. **Apply to:** new step Dockerfile.
`FROM video-pipeline-base-python:latest` (ships Python 3.12 + ffmpeg 7.1.1); no GPU.

### pytest import shim
**Source:** `services/quality-finalizer/tests/test_downscale.py:10-14`. **Apply to:** new step tests.
`sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))` then `from src...`.

## No Analog Found

| File / concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| HTTP client (multipart POST, poll, Retry-After backoff) | core logic | request-response | **No existing HTTP-client code in the repo** (grep: zero `requests`/`httpx`/`urllib` in Python, zero `axios`/`fetch` in service `.ts`). Greenfield — build from the contract (§3 lines 90-108, §4 lines 122-131) + CONTEXT D-2 (line 18). Use `requests` (sync). RESEARCH/STACK lists `httpx` as an alt if async is wanted, but a one-shot blocking step favors `requests`. |

## Metadata

**Analog search scope:** `services/` (all step containers), `services/api-server/src/`, `docker-compose.yml`, `shared/`
**Files scanned:** quality-finalizer (main.py, config.py, downscale.py, schema.py, Dockerfile, requirements.txt, test_downscale.py), whisper (main.py, config.py, audio_extraction.py, Dockerfile, requirements.txt, test_transcription.py), orchestrator.ts (full STEPS + run loop), docker-compose.yml (whisper + neighbors + networks)
**Pattern extraction date:** 2026-05-22
