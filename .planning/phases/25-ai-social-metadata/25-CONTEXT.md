---
phase: 25-ai-social-metadata
mode: autonomous
generated_by: orchestrator (decisions captured interactively; AI decisions in 25-AI-SPEC.md)
date: 2026-06-04
requirements: [META-01, META-02, META-03, META-04]
ai_spec: 25-AI-SPEC.md
---

# Phase 25 — AI social metadata · Context

## Goal
The "Metadata de redes" column is live — one click generates title/description/hashtags from
the video's transcript (via the local-llms router), editable + copyable, regenerable by tone/platform.

## Success criteria → requirements
1. After a render, "Generar metadata" calls the router with the Whisper transcript → title/description/hashtags. (META-01)
2. Result fills the "Metadata de redes" panel (replaces the Phase 22 placeholder), distinct fields. (META-02)
3. Edit any field inline + copy each field independently. (META-03)
4. Regenerate choosing tone/platform without re-running the pipeline. (META-04)

## Decisions (D-NN) — non-AI (AI/provider/model decisions live in 25-AI-SPEC.md)
- **D-01 — Generation lives in the Studio server** (`POST /api/metadata`). The Studio is the public origin (Phase 23) and has the `./pipeline` bind mount, so it reads `…/{jobId}/whisper/transcript.json` directly and calls the router. No api-server involvement.
- **D-02 — jobId source = the last successful render.** The metadata panel is enabled once a render completes (reuse the jobId from the 23-04 render-success state in PreviewApp). Before any successful render, the panel shows an empty/disabled state ("Generá un render primero").
- **D-03 — Provider/model per 25-AI-SPEC.md:** local-llms router at `host.docker.internal:3210`, OpenAI surface, `response_format: json_object`, default `METADATA_MODEL=big-cloud` (gpt-oss:120b), configurable to `chat-local` (qwen).
- **D-04 — Env wiring on remotion-studio:** add `METADATA_API_URL` (default `http://host.docker.internal:3210`), `METADATA_API_KEY` (= the router `ROUTER_BEARER_TOKEN`, from `.env`), `METADATA_MODEL` (default `big-cloud`), and **`extra_hosts: ["host.docker.internal:host-gateway"]`** (the studio service currently lacks it). Without `METADATA_API_KEY` set, the endpoint returns a clear "router no configurado" error (never crashes).
- **D-05 — Persist generated metadata** to `…/{jobId}/metadata.json` (atomic write, same bind-mount pattern) so it survives a Studio reload; the panel loads it if present. Ephemeral edits live in UI state; an explicit save/regenerate rewrites the file.
- **D-06 — UI replaces the col3 placeholder** (PreviewApp.tsx L887-932) with the live panel: tone + platform selectors, "Generar metadata" / "Regenerar", three fields (title/description/hashtags) with inline edit + per-field copy.
- **D-07 — Failure isolation:** metadata generation is fully decoupled from the render pipeline and the active config; a router/model error shows inline and never aborts a render or touches `pipeline-config.json`.

## Constraints honored
- remotion-studio port ALWAYS 3123.
- UI work → `impeccable` + `frontend-design` non-negotiable (AGENTS.md); see 25-UI-SPEC.md + sketch-findings ("AI metadata column").
- API routes before the `serveSpa` catch-all (T-18-03-01).
- Studio-only phase (server + preview UI); no renderer sync.
- Privacy: default big-cloud sends transcript to Ollama Cloud (documented); chat-local is the on-host private toggle.

## Out of scope
- Posting/publishing to social platforms.
- Multi-language translation (output matches transcript language).
- A/B variant history (single current result; regenerate overwrites).
