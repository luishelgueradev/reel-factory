# Whisper Service Integration Contract

**Status:** spec (review before implementing)
**Date:** 2026-05-22
**Scope:** Replace reel-factory's embedded `whisper` container step with the standalone HTTP service at `/home/luis/proyectos/whisper` (`whisper-api`), shared across apps (reel-factory + WhatsApp→Chatwoot).

---

## 1. Executive summary

The standalone service was **designed as a drop-in replacement** for reel-factory's internal Whisper output (its `profile=reels` response). Verified field-by-field against real samples:

| | reel-factory `transcript.json` (old) | whisper-api `profile=reels` (new) |
|---|---|---|
| top-level keys | `language, model, segments, words, duration` | `language, model, segments, words, duration` ✅ identical |
| word object | `word, start, end, confidence, no_speech_prob` | `word, start, end, confidence, no_speech_prob` ✅ identical |
| segment object | `id, start, end, text, words` | `id, start, end, text, words` ✅ identical |
| `model` value | `"medium"` | `"whisperx-large-v3"` |
| timeline | original audio (seconds) | original audio (seconds) ✅ same |
| `no_speech_prob` | per-word | per-word ✅ |

**The data contract is already satisfied.** The `model` value differs but **nothing in reel-factory validates it** — `model` is typed as a plain `string` in every consumer (`captions.ts:62`, `srt-exporter/src/types.ts:45`), and test fixtures already use `"large-v3"`. No consumer strict-validates the transcript schema or rejects extra fields.

**Therefore the only integration work is the DELIVERY MECHANISM:** today reel-factory runs `whisper` as a Docker container that writes `transcript.json` to a file (`OUTPUT_PATH`); the new service is an HTTP API. The pipeline step changes from "run container" to "HTTP call → write response to `transcript.json`". Everything downstream (silence-cutter, renderer, srt-exporter) is untouched.

---

## 2. The transcript.json contract (the interface — both sides MUST honor)

This is the canonical shape the new service MUST keep emitting (`profile=reels`) and that reel-factory's pipeline writes to `pipeline/{jobId}/whisper/transcript.json`:

```jsonc
{
  "language": "es",                  // always "es" (service rejects other langs with 400 INVALID_LANGUAGE)
  "model": "<string>",               // informational only; any string accepted downstream
  "duration": 31.355,                // total audio duration, seconds (float)
  "segments": [
    {
      "id": 0,                       // int, sequential 0..N AFTER hallucination filtering
      "start": 0.28,                 // float seconds, ORIGINAL audio timeline
      "end": 1.86,
      "text": "Hola chicas, ¿cómo están?",
      "words": [ /* TranscriptWord[] */ ]
    }
  ],
  "words": [                         // flat union of all segment words (PRIMARY structure consumers use)
    {
      "word": "Hola",               // string
      "start": 0.28,                // float seconds, ORIGINAL timeline
      "end": 0.746,
      "confidence": 0.704,          // float [0,1]
      "no_speech_prob": 0.0324      // float [0,1] — REQUIRED: silence-cutter cross-references it
    }
  ]
}
```

### Hard requirements (break these → pipeline breaks)
1. **Word-level timestamps via WhisperX forced alignment** — NOT raw faster-whisper word_timestamps. Forced alignment is what makes the word→highlight sync usable. (The service already does this for `profile=reels`: it runs faster-whisper raw to keep `no_speech_prob`, then `whisperx.align()`.)
2. **Timestamps on the ORIGINAL (uncut) audio timeline**, in seconds. Do NOT pre-remap for silence. reel-factory's silence-cutter + renderer own the silence remap. Pre-remapping = double-remap = drift. (See §5 and the sync bug in `captions.ts`.)
3. **`no_speech_prob` present per word.** silence-cutter Phase 3 reads `word.get("no_speech_prob", 0)` to cross-reference FFmpeg silence detection. Missing/zeroed degrades silence detection.
4. **`words` (flat) populated** — it's the primary array consumers iterate; `segments[].words` is secondary.
5. **Spanish only**, `language: "es"`. Service must not translate (es→es).
6. **Hallucination filtering applied** (5-stage, matching reel-factory parity: empty / repetition / low-confidence<0.3 / duration-anomaly / no_speech_prob>0.6). The service already replicates these thresholds.

### Soft / informational (safe to differ)
- `model` value (e.g. `"whisperx-large-v3"` vs `"medium"`) — informational, not validated.
- Exact `confidence` scale — consumers don't threshold on it except the hallucination filter, which runs inside the service.

---

## 3. Integration delta — what changes in reel-factory

### Current (embedded container)
`orchestrator.ts` STEP `whisper`:
```ts
{ name: "whisper", image: "reel-factory-whisper",
  envVars: { INPUT_PATH: ".../input/video.mp4", OUTPUT_PATH: ".../whisper/transcript.json",
             PIPELINE_JOB_ID: "{jobId}", HF_HOME: "..." } }
```
Runs the container; container writes `transcript.json`.

### Target (HTTP call to shared service)
Replace the container step with an **HTTP transcription step** that:
1. POSTs the original video to the whisper-api and
2. writes the JSON response to the same `pipeline/{jobId}/whisper/transcript.json` path.

So every downstream step (which reads that file path) is **unchanged**.

**Sync path (clips ≤ service `MAX_DURATION_S`, default 600 s):**
```
POST http://<whisper-host>:8000/transcribe
  Header: X-API-Key: <key>
  multipart/form-data:
    file=@input/video.mp4
    language=es
    profile=reels
→ 200, BARE JSON body (no envelope) → write verbatim to transcript.json
```

**Async path (long files, or to avoid holding an HTTP connection for minutes):**
```
POST /jobs (same multipart) → 202 { job_id, status:"queued", status_url }
poll GET /jobs/{job_id} until status=="done"
  → result field holds the same bare reels body → write to transcript.json
  status=="failed" → error {code,message} → fail the pipeline step
503 QUEUE_FULL (Retry-After header) → backoff + retry
```

### Decisions to make (gray areas)
- **D-1 Where the HTTP step lives:** (a) a tiny new reel-factory container/script that does the POST and writes the file (keeps the "step writes transcript.json" contract, minimal orchestrator change), or (b) the api-server orchestrator calls the service directly in-process and writes the file. → Recommend (a): preserves the file-based step contract, swappable, testable.
- **D-2 Sync vs async selection:** probe input duration (ffprobe) and use `/jobs` above a threshold (e.g. > 120 s) else `/transcribe`. Or always `/jobs` for uniformity.
- **D-3 Service URL + auth:** new env on reel-factory side: `WHISPER_API_URL`, `WHISPER_API_KEY`. Network reachability between stacks (shared Docker network or host:port).
- **D-4 GPU ownership:** the service owns the GPU now (CUDA, no CPU fallback in the reels path is fine since it's a dedicated stack). reel-factory no longer needs the whisper image / NVIDIA toolkit.
- **D-5 Retire the old service:** delete `services/whisper/` (container + Dockerfile) and its orchestrator step once the HTTP step is verified. Keep `services/whisper/src/schema.py`/`validate.py` as a reference for the contract, or move them into a shared contract test.
- **D-6 Limits:** service caps file ≤200 MB and duration ≤600 s. reel-factory inputs must fit, or the service limits must be raised (env `MAX_FILE_MB`, `MAX_DURATION_S`).

---

## 4. Error & failure mapping

| Service response | reel-factory step should |
|---|---|
| 200 / job done | write `transcript.json`, continue pipeline |
| 400 INVALID_LANGUAGE / NO_AUDIO_STREAM | fail step (bad input) — surface to user |
| 401 UNAUTHORIZED | fail step (config error — wrong/missing API key) |
| 413 FILE_TOO_LARGE | fail step or pre-validate before sending |
| 503 QUEUE_FULL (Retry-After) | backoff + retry, then fail if persistent |
| 500 MODEL_ERROR / job failed | fail step, propagate `{code,message}` |

reel-factory's existing `PipelineStepError` model already carries `{stepName, exitCode, errorMessage}` — map HTTP failures into it.

---

## 5. Tie-in with the highlight-sync fix (deliverable b)

The infra change is the **ideal moment** to harden the timeline contract, because the sync bug lives exactly at this boundary:

- `captions.ts:areTimestampsAlreadyRemapped()` infers whether to apply the silence remap from a fragile heuristic (`maxWordEnd <= new_duration + tol`). On videos with **mid-speech** cuts where the last word ends before `new_duration`, it wrongly skips the remap → progressive highlight drift on the back half.
- **Recommendation (part of this contract):** make the timeline EXPLICIT instead of inferred. Add to the transcript contract a top-level marker, e.g. `"timeline": "original"` (the service always emits `"original"`), and/or have silence-cutter stamp the cut timeline. The renderer then decides remap deterministically (`timeline === "original" → remap`) and the heuristic is deleted.
- This is backward-compatible: absent `timeline` → fall back to current behavior; present → authoritative.

The new service should add `"timeline": "original"` to its `profile=reels` body to support this (cheap, additive — consumers ignore unknown fields).

---

## 6. Validation plan (deliverable c)

1. **Contract test (cross-project):** assert the new service's `profile=reels` body matches this schema field-for-field (a JSON-schema or pydantic/zod check). Seed it with `whisper/sync.json` + a reel-factory fixture.
2. **Drift repro for the sync bug:** run a clip WITH mid-speech pauses through the full pipeline (needs GPU for whisper now that it's external — the service has it) and measure highlight-vs-audio offset on the back half, before and after the timeline-marker fix. The current test clips only cut at the end, so they cannot reproduce the drift.
3. **Parity test:** transcribe the same clip via old embedded whisper vs new service; diff the two transcript.json (allowing the `model` value + minor alignment deltas). Confirm word counts, timings within tolerance, and `no_speech_prob` present.
4. **End-to-end:** run the pipeline with the HTTP step and confirm captions render + sync (visual UAT) and srt-exporter output is correct.

---

## 7. Decisions & open questions

**Resolved (2026-05-22):**
- ✅ **Timeline marker: YES.** `transcript.timeline` ("original" | "silence-removed") added to the contract. Implemented renderer-side (`captions.ts:shouldSkipSilenceRemap`, deterministic, heuristic fallback) and producer-side in the old whisper (`schema.py` default `"original"`). **The external whisper-api MUST emit `"timeline": "original"` in its `profile=reels` body** (additive, one field). The maxWordEnd heuristic is now legacy fallback only.
- ✅ **HTTP step shape: small container/script writing `transcript.json`** (D-1 option a). Preserves the file-based step contract → zero downstream change.

**Phase 4 (LLM post-processing) impact assessment (2026-05-22):** Reviewed the whisper
project's Phase 4 spec (`.planning/phases/04-llm-post-processing/04-CONTEXT.md` + ROADMAP).
**Verdict: ZERO impact on the reels contract or this relocation plan.** Phase 4 adds Ollama
LLM spelling correction + `.srt` ONLY to the text envelope (`whatsapp`/`quality` profiles):
new fields `text`, `text_raw`, `postprocessed`, `srt` live in the envelope, never in the
reels bare body. The reels invariant (no LLM rewrite — would desync word timestamps) is an
explicit, tested, protected contract (SC4 / REEL-04 / D-01 / D-03), and the reels bare body
`{language, model, segments, words, duration}` is untouched (CONTEXT line 101). The
`postprocess` request param going `Optional[bool]=None` is backward-compatible (reels forced
OFF regardless). No need to finish Phase 4 before proceeding here; the two are orthogonal.
**Opportunistic:** Phase 4 touches `build_result_body` (per-profile response assembly) — the
ideal place to also add `"timeline": "original"` to the reels branch, making the external
service contract-complete for reel-factory in the same pass.

**Still open (decide when wiring the actual extraction):**
- D-2: sync-vs-async threshold (probe duration; suggest `/jobs` above ~120 s).
- D-3: `WHISPER_API_URL` + `WHISPER_API_KEY` + network reachability between stacks.
- D-5: retire `services/whisper/` + its orchestrator step after the HTTP step is verified.
- D-6: confirm the 600 s / 200 MB service limits cover reel-factory inputs (raise via `MAX_DURATION_S` / `MAX_FILE_MB` if not).
- Add `"timeline": "original"` to the external whisper-api output (separate change in `/home/luis/proyectos/whisper`).
