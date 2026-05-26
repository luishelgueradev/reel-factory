# Milestones

## v1.2 Infrastructure / shared services (Shipped: 2026-05-26)

**Scope:** Phases 15–16 (6 plans). Externalize Whisper to a standalone HTTP
service and fix the render-path config/flicker bugs surfaced by that work,
plus public-exposure and reliability hardening done during close-out.

**Key accomplishments:**

- **Whisper externalization (Phase 15):** Replaced the embedded GPU `services/whisper`
  container with a thin Python HTTP-client step that calls the standalone whisper-api
  (`host.docker.internal:8000`), routing sync `/transcribe` (≤120s) vs async `/jobs`+poll.
  Drop-in: STEP name `whisper` + `whisper/transcript.json` path unchanged, so every
  downstream step is untouched. GPU plumbing removed; parity proven (76=76 words, 0.000s
  max delta); deferred Spike 001 drift repro closed; `services/whisper/` retired.
- **Render config propagation (Phase 16 + close-out):** Studio `PUT /api/config` now
  dual-writes the active config; and `runPipeline` seeds the per-job renderer config in
  BOTH the `/process` and `/batch` paths (previously only `/process` did, so async jobs
  silently fell back to tiktok layout + env defaults).
- **Subtitle flicker fix (Phase 16):** `isLastPage`-conditional `durationInFrames` replaces
  the gap-formula that caused fade-out/in flicker between caption pages.
- **Public exposure + hardening (close-out):** Cloudflare tunnel publishing remotion-studio
  with HTTP Basic Auth (loopback-bypass healthcheck via node), single-job concurrency
  (`MAX_CONCURRENT_JOBS=1`) + 2GB shm to stop Chrome OOM/hang, latin-only font subsets,
  audio-only Whisper upload, `-accurate_seek` cuts.

**Verification:** All outstanding gaps closed via an autonomous e2e run on real video
(orchestrator jobs 3b577ed9 + b39e6b69): Phase 03 A/V sync (24ms delta, no drift), Phase 10
async worker/Redis/BullMQ, Phase 14 subtitle sharpness (config applied), Phase 05 HUMAN-UAT
(position/case/render-hang). Close-out audit: 0 open items.

**Prior work:** v1.0 (Phases 1–12, full pipeline) and v1.1 (Phases 13–14, encode quality +
supersampling) shipped earlier. v1.1 is archived under `milestones/v1.1-*`. The aggregate
project total across all milestones is 14 phases / 54 plans.
