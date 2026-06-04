# AI-SPEC — Phase 25: AI social metadata

> Design contract locked before planning. Provider/integration verified live against the
> user's `local-llms` router (commit-time smoke: `big-cloud`/gpt-oss:120b → HTTP 200, valid
> Spanish JSON, `X-Model-Backend: ollama-cloud`, ~3.8s).

## 1. System Classification

**System Type:** Content Generation (single-shot structured generation from a transcript).

A Studio-triggered feature: after a render completes, the user clicks "Generar metadata" and
the Studio sends the video's Whisper transcript to the `local-llms` router, which returns a
**title, description, and hashtag list** as structured JSON. The user edits any field inline,
copies each independently, and regenerates choosing a **tone** and **target platform**. "Good"
= catchy-but-faithful copy in the transcript's language, correctly structured, within each
platform's conventions.

### Critical behaviors (cannot go wrong)
1. **Faithful to the transcript** — no invented facts, products, names, prices, or claims not supported by the spoken content.
2. **Language match** — output language follows the transcript language (es transcript → es metadata).
3. **Structurally valid** — always returns the agreed JSON shape (title:string, description:string, hashtags:string[]); never breaks the UI.
4. **Never blocks the pipeline** — metadata is post-render and optional; a model/router failure shows a clear error, never aborts a render or corrupts the active config.
5. **Bounded** — respects per-platform length/hashtag limits; no emoji-spam, no banned/duplicate hashtags.

## 1b. Domain Context

**Industry Vertical:** Short-form social video marketing (vertical 9:16 reels — TikTok / Instagram Reels / YouTube Shorts).
**User Population:** Solo creator/operator producing reels in the Studio; non-marketer, wants a strong first draft to edit, not final copy.
**Stakes Level:** Medium — public-facing marketing copy, but always human-edited before posting and trivially regenerated. Worst case = a weak/misleading draft the user fixes; no irreversible or safety-critical action.
**Output Consequence:** The title/description/hashtags are copied by the user into a social platform post.

### What domain experts (social media managers) evaluate against
| Dimension | Good (accepted) | Bad (flagged) | Stakes | Source |
|-----------|-----------------|---------------|--------|--------|
| Hook strength | Title creates curiosity/benefit in the first ~5 words | Generic ("Mira este video"), no hook | Medium | SMM practice |
| Faithfulness | Every claim traceable to the transcript | Invented numbers/claims/brands | High | Brand trust |
| Platform fit | Length + hashtag style match the chosen platform | TikTok-style wall of hashtags on a YT Shorts desc | Medium | Platform norms |
| Hashtag relevance | 3–8 specific, on-topic, deduped, valid `#word` | Irrelevant/banned/spam/duplicate tags | Medium | Reach/penalty |
| Language & register | Transcript language; natural, on-brand register | Wrong language, machine-translated feel | Medium | Audience |

### Known failure modes in this domain
- **Hallucinated specifics** (a price, a stat, a product name never said) — most damaging; mitigate with a transcript-grounded prompt + "only use what's in the transcript" instruction + eval.
- **Generic clickbait** disconnected from content.
- **Hashtag spam / wrong format** (spaces, accents-as-separate-tag, >N tags).
- **Language drift** (English output on a Spanish transcript).
- **Platform mismatch** (description far too long/short for the target).

### Regulatory / compliance context
None hard. Soft constraints: platform ToS (no misleading claims), and the project's privacy posture — using the **local Qwen** keeps transcripts on-host; **cloud gpt-oss** sends transcript text to Ollama Cloud (acceptable per user choice, documented).

### Domain expert roles for evaluation
| Role | Eval contribution |
|------|-------------------|
| The operator (user) | Inline acceptance/edit = implicit production rubric; sampling regenerations across tones/platforms |

## 2. Framework Decision

**Selected:** the user's **`local-llms` router** (self-hosted OpenAI/Anthropic-compatible gateway), called over its **OpenAI surface** (`POST /v1/chat/completions`) with `response_format` JSON. **No agent framework** — this is a single-shot structured generation, not RAG/multi-agent.
**Version:** local-llms v0.12.0 (router on `http://host.docker.internal:3210`).
**Model (default):** `big-cloud` → **gpt-oss:120b-cloud** (user choice — best Spanish title/hook quality). **Configurable** via `METADATA_MODEL`; documented alternative `chat-local` (qwen2.5:7b, free/private/local-first→cloud-fallback, also `chat-json-strict`).
**Rationale:** reuses existing infra (same `host.docker.internal` pattern as the Whisper sidecar at :8000), a **stable alias** so models swap with zero reel-factory code change (the router's whole purpose), **JSON-mode firme** (AJV validate + single-shot repair) ideal for structured metadata, built-in cost telemetry + circuit breaker. Verified working live.
**Vendor lock-in:** No — OpenAI-compatible; reel-factory talks to a generic `/v1/chat/completions`, repointable to any compatible endpoint.

## 3. Framework Quick Reference

### Connection (from reel-factory containers)
- URL: `${METADATA_API_URL:-http://host.docker.internal:3210}/v1/chat/completions`
- Auth: `Authorization: Bearer ${METADATA_API_KEY}` (= local-llms `ROUTER_BEARER_TOKEN`).
- Requires `extra_hosts: ["host.docker.internal:host-gateway"]` (already present for whisper).
- Model: `${METADATA_MODEL:-big-cloud}`.

### Entry point pattern (Node 22, plain fetch — no SDK dependency needed)
```ts
const r = await fetch(`${METADATA_API_URL}/v1/chat/completions`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${METADATA_API_KEY}` },
  body: JSON.stringify({
    model: METADATA_MODEL,                 // "big-cloud" (gpt-oss:120b) | "chat-local" (qwen)
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: transcriptText }],
    response_format: { type: "json_object" }, // router validates + single-shot repairs
    temperature: 0.7,
    max_tokens: 500,
  }),
  signal: AbortSignal.timeout(90_000),       // cloud cold-load can be slow on first call
});
const data = await r.json();
const metadata = JSON.parse(data.choices[0].message.content); // then zod-validate
```

### Key abstractions
- **Stable alias vs raw model:** call the alias (`big-cloud`/`chat-local`), never a quant string.
- **`response_format: json_object`:** router enforces valid JSON + repairs once; still validate shape client-side (zod).
- **`X-Model-Backend` / `X-Cost-Cents` response headers:** which backend served + cost; log them.

### Common pitfalls
- **Cloud health shows `unknown` until first probe** — it works (verified); don't gate UI on `/v1/models` health for cloud aliases.
- **Cold-load latency** on the first cloud call (router has a 180s undici budget) — use a generous client timeout (~90s) and a "generando…" UI state.
- **Don't stream** for this (we want one JSON blob); avoid the SSE path.
- **Transcript can be long** — join `segments[].text`, truncate to a token budget before sending.

## 4. Implementation Guidance

**Model params:** `temperature: 0.7` (some creativity, bounded), `max_tokens: ~500`, `response_format: json_object`. Default model `big-cloud`; env-configurable.
**Primary pattern:** Studio server endpoint `POST /api/metadata` (Studio is already the public origin, Phase 23; has `/data/pipeline` bind mount → reads `…/{jobId}/whisper/transcript.json`). Body: `{ jobId, platform, tone }`. It builds the prompt, calls the router, validates JSON (zod), returns `{ title, description, hashtags, _meta: { backend, model } }`.
**Tools/integrations:** none beyond the router HTTP call. Transcript source = the job's `whisper/transcript.json` (join `segments[].text`).
**State:** generated metadata is ephemeral UI state (editable); optionally persisted into the job dir (`…/{jobId}/metadata.json`) so it survives reloads — decide in planning. Not part of the active pipeline-config.
**Context management:** join segment texts; truncate to ~6k tokens (keep head+tail) if a transcript is very long; metadata only needs the gist.

## 4b. AI Systems Best Practices

### Structured outputs (zod on the Node side)
```ts
const Metadata = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2200),
  hashtags: z.array(z.string().regex(/^#[\p{L}0-9_]+$/u)).min(1).max(12),
});
```
Validate the model's JSON with this; on failure, one retry with a corrective instruction, else a friendly error (the router already does a JSON repair pass, so client-side failures should be rare).

### Prompt engineering discipline
- **System prompt:** role ("editor de redes para reels verticales"), HARD rules (only facts from the transcript; output language = transcript language; return JSON only matching the schema), platform spec (length + hashtag style for TikTok/IG/Shorts), tone spec (Cercano/Profesional/Llamativo).
- **User prompt:** the transcript text only.
- Keep platform/tone in the SYSTEM prompt so they're swappable per regeneration (META-04) without re-sending boilerplate.

### Cost & latency budget
- gpt-oss:120b-cloud: ~$0.50/$1.50 per 1M tok; a reel transcript ≈ 1–3k in + ~300 out → **~US$0.002 per generation**. Negligible.
- qwen2.5:7b local: $0, ~1–2s, private. Latency cloud ≈ 3–6s warm.
- No caching needed (regeneration is intentional); log `X-Cost-Cents`.

## 5. Evaluation Strategy

### Dimensions
| Dimension | Rubric (pass) | Method |
|-----------|---------------|--------|
| Schema validity | Parses + matches zod (title/description/hashtags) | Automated (zod) — unit + live |
| Language match | Output language == transcript `language` field | Automated heuristic + spot-check |
| Faithfulness | No claim absent from the transcript | Human spot-check on a 5-transcript reference set; optional LLM-judge later |
| Platform fit | Length within platform bounds; hashtag style correct | Automated bounds check |
| Hashtag hygiene | 3–8, deduped, `#word` format, no spaces | Automated |
| Hook quality | Title has a hook in first ~5 words | Human review |

### Reference dataset
The real transcripts already on disk under `pipeline/*/whisper/transcript.json` (≥3 available) — use as the fixed eval set for prompt iteration and regression. Store 2–3 as a committed fixture for tests (sanitized/trimmed).

### Eval tooling
Lightweight, fits a single-host tool: (1) **zod + bounds checks** in unit/integration tests (automated gates), (2) a small **offline eval script** that runs the prompt over the reference transcripts and prints the JSON for human faithfulness/hook review, (3) the **router's own cost/latency telemetry** (Prometheus/Grafana in local-llms) — no separate tracing stack added. (Heavy eval frameworks like RAGAS are overkill here.)

## 6. Guardrails
- **Schema gate:** zod-validate every response; one corrective retry; else return a typed error → UI shows "No se pudo generar la metadata" (never crashes, never blocks render).
- **Language gate:** pass the transcript `language` to the prompt and assert output language; flag/regenerate on mismatch.
- **Length/hashtag caps:** enforce per-platform caps client-side (truncate description, cap hashtags at 8, dedupe, drop malformed).
- **Faithfulness instruction:** system prompt forbids inventing facts; emphasize "si no está en el transcript, no lo inventes".
- **Failure isolation:** metadata generation is fully decoupled from the render pipeline and the active config; router unreachable → clear inline error + retry, nothing else affected.
- **Privacy note:** default `big-cloud` sends transcript text to Ollama Cloud; document it; `chat-local` (qwen) is the on-host private option (one config change).

## 7. Production Monitoring
- Rely on **local-llms observability** (router `request_log`, `X-Cost-Cents`, Prometheus `/metrics`, Grafana) for cost/latency/error-rate per bearer — reel-factory logs each generation's `X-Model-Backend` + status + jobId for correlation.
- reel-factory-side: structured log line per generation (jobId, platform, tone, backend, ok/fail, latency). No separate tracing stack (Phoenix) — the router already provides it for this single-host setup.

---

## Checklist
- [x] System classified (Content Generation, single-shot structured)
- [x] Critical behaviors enumerated (faithfulness, language, schema, non-blocking, bounded)
- [x] Domain context + expert rubric ingredients (SMM)
- [x] Framework/provider decided (local-llms router, OpenAI surface, JSON mode) + verified live
- [x] Model decided (big-cloud default, METADATA_MODEL configurable; chat-local alternative)
- [x] Implementation pattern (Studio POST /api/metadata, transcript→prompt→router→zod)
- [x] Structured output (zod) + prompt discipline + cost budget
- [x] Eval dimensions + reference dataset (on-disk transcripts) + lightweight tooling
- [x] Guardrails (schema/language/length/faithfulness/failure-isolation/privacy)
- [x] Monitoring via local-llms telemetry
