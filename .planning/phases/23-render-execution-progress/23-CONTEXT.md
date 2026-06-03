# Phase 23: Render execution + progress - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the Studio's "Render Video" button actually produce a video. Wire the
header CTA to a real pipeline job: upload an MP4 from the Studio → `POST /process`
(proxied through the Studio server) → watch live step progress via
`GET /status/:jobId` → land an inline "Reel listo" result with preview + download
on success, or an inline failure-with-cause on error. Separately, harden renderer
font loading so a transient gstatic blip can neither abort nor silently degrade a
666-frame render (RENDER-05).

Requirements: RENDER-01..RENDER-05.

**In scope:**
- Studio MP4 upload (drop/picker) that also drives the live preview background.
- `POST /api/render` (today a 501 stub) becomes a real proxy to `api-server:3000/process`.
- Live progress UI: inline on the dimmed preview stage, step name + honest step-based %.
- Inline success result (play + download, proxied) and inline failure (plain + cause line).
- Font-load resilience: offline-bundled fonts (primary) + gstatic retry/timeout (fallback)
  + bundled-sans final fallback + per-font hang guard, applied in the renderer.
- `impeccable` + `frontend-design` pass on every Studio surface touched (non-negotiable, AGENTS.md).

**Out of scope (deferred):**
- The persistent "Resultados" library/history (sketch 038) — needs the rail nav-shell (033), later phase.
- The full-screen results takeover (024-B) — Phase 23 uses the inline result; takeover is Phase 25/26 territory.
- AI social metadata column population (Phase 25); UI convergence pass (Phase 26).
- Batch-queue UI, run-flow soft-pause inspection steps, background/toast notifications (frontier).
- Frame-level render progress (chose the no-backend-change honest bar instead).

</domain>

<decisions>
## Implementation Decisions

### Input video source (RENDER-01)
- **D-01:** Input arrives via **upload in the Studio** (drop or file picker) — the
  Studio becomes self-contained; no curl, no pre-placed server-side file, no job
  binding. On Render, the file is sent as multipart `video` to `POST /process`.
- **D-02:** The uploaded MP4 **becomes the live preview background** so the user
  styles against their own footage (WYSIWYG). Wire the uploaded file into the
  `@remotion/player` background in the preview.
  - **Constraint/nuance:** the preview cannot show *real synced* subtitles before
    render (no transcript exists until the pipeline's whisper step runs). Preview =
    real video frames + the existing sample/specimen caption timing for styling.
    Real sync happens only in the rendered output. Capture this expectation in UI copy.
- **D-03:** Upload is **proxied through the Studio server**: browser → Studio
  `POST /api/render` (covered by the Studio's existing basic auth) → forwards to
  `http://api-server:3000/process` over `pipeline-net` → relays `jobId` + status
  back. One origin; api-server stays internal (no public exposure / CORS).

### Progress surface (RENDER-02)
- **D-04:** Progress renders **inline on the dimmed preview stage** (no modal) —
  the editor stays in place, controls visible-but-disabled. Canonical per sketches
  010-A / 031-A (inline-first, no wizard).
- **D-05:** Show the **current step NAME prominently** with the **raw step-based %**
  from `GET /status` (6 steps; e.g. Transcribiendo → Cortando silencios →
  Renderizando…). Accept that the bar dwells on the long `remotion-renderer` step;
  add a "este paso toma más tiempo" affordance. **No backend change** — frame-level
  render progress was explicitly NOT chosen.
- **D-06:** Poll `GET /status/:jobId` on a reasonable cadence (planner's call,
  ~1–2s). While a render is active, the Render CTA / controls lock naturally via the
  dimmed-stage state (single-job `MAX_CONCURRENT_JOBS=1` is respected by not
  allowing a second concurrent submit from the Studio).

### Completion & finished-video access (RENDER-03, RENDER-04)
- **D-07:** On success, the dimmed stage **resolves inline to "Reel listo"** — the
  finished 9:16 plays where the preview was, with **Descargar** + **Renderizar de
  nuevo** actions. No full-screen takeover (031 "big takeover only if asked" — not
  built here).
- **D-08:** The finished MP4 (`/artifacts/{jobId}/output/video.mp4` on api-server,
  internal) is reached **proxied through the Studio** (e.g. `/api/result/:jobId`):
  inline `<video>` playback **and** a download. **Download uses accent, not green**
  (green discipline — Render is the only green).
- **D-09:** On failure, surface **inline at the source in low-chroma danger red**
  (sketch 040-A): plain-language reason ("No se pudo generar el reel") + the
  technical cause line (paso + exitCode/signal, e.g. `remotion-renderer · exit 137
  — sin memoria`) in **muted mono** beneath, plus **Reintentar**. OOM
  (signal 9 / exit 137) named honestly (single-job / Chrome RAM). Danger red never
  borrows action-green.

### Font-load resilience (RENDER-05)
- **D-10:** **Offline-bundle fonts INTO the renderer image** (served locally, no
  network at render time) as the **primary** source, with **gstatic + bounded
  retry/backoff** as fallback. A gstatic blip can neither abort nor silently
  degrade a render — deterministic. Also fixes the current silent-monospace bug.
- **D-11:** **Per-font timeout is a hard requirement** (~10s race per load): on
  timeout, fall through to retry/fallback rather than hang. Closes the current
  hang path (today only the 3h process timeout bounds a stuck gstatic fetch).
  This is the literal RENDER-05 guarantee.
- **D-12:** Final fallback (bundle miss + gstatic exhausted) = a **bundled default
  sans** (Plus Jakarta Sans / Inter) — **never monospace**. Worst case still looks
  like a real reel. Aligns with the established font-crispness quality bar.
- **Renderer-sync note:** font/composition changes land in `remotion-renderer`
  (and any shared `fonts.ts`) — re-run renderer vitest after; the renderer-sync
  clobber hazard applies (AGENTS.md).

### Claude's Discretion
- Exact polling cadence, retry count/backoff curve, and per-font timeout value
  (bounded by D-06 / D-10 / D-11).
- Precise placement, motion, and copy of the inline progress / result / failure
  states — within the sketch grammar (inline-first, no modal, green-discipline,
  low-chroma danger) and the `impeccable` + `frontend-design` pass.
- Upload affordance shape (full stage dropzone per sketch 017 vs picker) — design pass decides.
- Proxy route naming (`/api/render`, `/api/status/:jobId`, `/api/result/:jobId`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope / requirements
- `.planning/ROADMAP.md` § "Phase 23: Render execution + progress" — goal + 5 success criteria.
- `.planning/REQUIREMENTS.md` — RENDER-01..RENDER-05 (lines ~14–18).
- `.planning/phases/22-studio-ui-polish/22-CONTEXT.md` — prior 3-column shell + header-CTA decisions this phase builds on.

### UI tooling (NON-NEGOTIABLE per AGENTS.md)
- `AGENTS.md` § "UI/frontend work — REQUIRED tooling" — every frontend task MUST
  invoke the `impeccable` skill + `frontend-design` plugin at start of plan/execute.
- `AGENTS.md` § "Renderer sync pattern" — studio→renderer copy rules; re-run renderer
  vitest after any sync (clobber hazard). Critical for the font work (D-10..D-12).
- `AGENTS.md` § "remotion-studio port" / "Pipeline worker concurrency" — port 3123;
  `MAX_CONCURRENT_JOBS=1` is by design (informs D-06).

### Design grammar (sketch findings — auto-loaded skill)
- `.claude/skills/sketch-findings-reel-factory/SKILL.md` — design direction + green discipline.
- `.claude/skills/sketch-findings-reel-factory/references/render-export-surface.md` — render on dimmed stage (010-A).
- `.claude/skills/sketch-findings-reel-factory/references/render-last-mile.md` — finished-reel landing (024-B; Phase 23 uses the inline subset).
- `.claude/skills/sketch-findings-reel-factory/references/run-flow-spine.md` — inline-first / review-as-pull (031-A).
- `.claude/skills/sketch-findings-reel-factory/references/error-failure-states.md` — inline-at-source, low-chroma red (040-A).
- `.claude/skills/sketch-findings-reel-factory/references/header-action-zone.md` — Render = the only green; state map (013-B).
- `.claude/skills/sketch-findings-reel-factory/references/first-run-empty-workspace.md` — stage dropzone cold start (017-B; informs D-01/D-02).
- `.claude/skills/sketch-findings-reel-factory/sources/themes/default.css` — canonical OKLCH design tokens.

### Key source files (integration points — verified during scout)
- `services/remotion-studio/src/preview/PreviewApp.tsx` (~425) — disabled "▶ Render Video" CTA in the header; the wiring target.
- `services/remotion-studio/src/server.ts` (~207) — `POST /api/render` 501 stub → real proxy (D-03); existing `GET/PUT /api/config`, basic auth, port 3123.
- `services/api-server/src/routes/process.ts` — `POST /process` multipart `video` (≤500MB); seeds `ACTIVE_PIPELINE_CONFIG_PATH` into the job; response/error shapes.
- `services/api-server/src/routes/status.ts` — `GET /status/:jobId` → `{status,currentStep,progress,stepInfo,steps,startedAt,error}` (6-step, step-based %).
- `services/api-server/src/routes/artifacts.ts` — `/artifacts/:jobId/:step/:file`; finished video at `/artifacts/{jobId}/output/video.mp4` (D-08 proxy target).
- `services/remotion-renderer/src/fonts.ts` — `loadFont` via `@remotion/google-fonts`; current try/catch→monospace, no retry/timeout/cache (D-10..D-12 target).
- `services/remotion-renderer/src/Root.tsx` + `compositions/TitleOverlay.tsx` — `delayRender`/`continueRender` font gating (hang path D-11 closes).
- `docker-compose.yml` — `remotion-studio` (3123) + `api-server` (3000) on `pipeline-net`; studio→api-server reachable as `http://api-server:3000`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PUT /api/config` + basic-auth middleware in `server.ts` — same auth/origin model
  to reuse for the new `/api/render` proxy (D-03).
- `@remotion/player` preview in `PreviewApp` — already renders subtitles/titles/overlays
  over a background; D-02 swaps the background source to the uploaded file.
- api-server already returns structured `{step, exitCode, message}` errors — D-09 just
  formats them; no new error contract needed.
- `ACTIVE_PIPELINE_CONFIG_PATH` seeding (Phases 16/17) already feeds the Studio's saved
  config into the renderer — the styled config is honored at render with no extra wiring.

### Established Patterns
- Studio is a single-page app; render is a **foreground job you watch** (per 031), not a
  background notification (those are for queued batch — out of scope).
- Studio/renderer dual maintenance: font + composition changes must land in
  `remotion-renderer` and be re-verified (renderer-sync clobber hazard).

### Integration Points
- New proxy routes in `server.ts`: render submit (multipart passthrough), status poll,
  result fetch — all relaying to `api-server:3000`.
- Font bundling touches the `remotion-renderer` Docker image (vendored font assets) +
  `fonts.ts` load path (local-first, retry, timeout, fallback).

</code_context>

<specifics>
## Specific Ideas

- User's explicit picks (all "recommended"): upload-in-Studio, preview-on-real-video,
  proxy-through-Studio, inline dimmed-stage progress, honest step-based bar, inline
  "Reel listo" with proxied play+download, inline failure with mono/muted cause line,
  offline-bundle+retry fonts, bundled-sans (not monospace) fallback, per-font timeout.
- Failure copy reference (user-approved mock): "✕ No se pudo generar el reel / Falló en:
  Renderizado (signal 9 — sin memoria) / remotion-renderer · exit 137 [mono/muted] / [Reintentar]".
- Result copy reference: "✓ Reel listo / ▶ (plays finished 9:16) / [Descargar] [Renderizar de nuevo]".

</specifics>

<deferred>
## Deferred Ideas

- **Resultados persistent library/history (sketch 038):** browsable gallery of past
  reels grounded in the real `output/` dir. Needs the rail nav-shell (033, not built).
  → later phase (Phase 26 convergence or its own phase).
- **Full-screen results takeover (024-B):** big "done, publish" moment with metadata.
  → Phase 25 (AI metadata) / Phase 26 (convergence).
- **Frame-level render progress:** real Remotion `onProgress` → status plumbing so the
  bar moves during the long render step. Deliberately deferred (chose no-backend honest bar).
- **Background/toast notifications + Cola badge (sketch 035):** matter for queued-batch,
  not the single foreground render. → batch/queue phase.

### Reviewed Todos (not folded)
- `2026-05-30-full-studio-ui-polish-with-impeccable-skill.md` — matched on UI keywords,
  but it's the Phase-22 polish todo already tagged `resolves_phase 26`. Out of Phase 23 scope.

</deferred>

---

*Phase: 23-render-execution-progress*
*Context gathered: 2026-06-03*
