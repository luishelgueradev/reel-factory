# Phase 23: Render execution + progress - Research

**Researched:** 2026-06-03
**Domain:** Express upload proxy + live-poll progress UI + Remotion offline font resilience
**Confidence:** HIGH (all integration points read from source; font behavior verified in installed node_modules + Remotion docs)

## Summary

This phase wires the Studio's `▶ Render Video` button to the real pipeline. Three distinct
engineering problems, all verified against the actual source: (1) a **streaming multipart
proxy** in `services/remotion-studio/src/server.ts` (today a 501 stub) that forwards a browser
upload to `api-server:3000/process`, then relays status polls and the finished MP4; (2) an
**inline live-progress UI** on the dimmed preview stage driven by polling `GET /status/:jobId`,
which returns a 6-step, step-based percentage (NOT frame-level — that is deferred); and (3)
**font-load resilience** in `services/remotion-renderer` so a transient `fonts.gstatic.com` blip
neither aborts nor silently degrades a 666-frame render (RENDER-05, the highest-risk item).

Key discoveries from reading the installed code: the 6 pipeline steps are
`whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → quality-finalizer → srt-exporter`
(not the 3 the sketches imply). The `GET /status` percentage is `(completedSteps+1)/6 * 100` —
so the bar jumps in ~17% increments and **dwells on `remotion-renderer`** (D-05's known long step).
The failure contract already exists: `{jobId, error: {step, exitCode, message}}` with HTTP 500
(step failure), 408 (timeout). The font fix is the meaty part: `@remotion/google-fonts` hardcodes
`fonts.gstatic.com` woff2 URLs into each font's meta — there is **no offline mode** in that package.
The project's `fonts.ts` wrapper swallows failures into `monospace` (the silent-degrade bug, D-12).
The clean fix is to **vendor the woff2 files into the renderer image** and load them with
`@remotion/fonts` `loadFont({family, url: staticFile(...)})` (no network), keeping `@remotion/google-fonts`
only as the retry fallback.

**Primary recommendation:** Build a streaming proxy with `multer` memory-passthrough avoided —
forward the raw request stream to `api-server` using `fetch`/`undici` with `duplex: 'half'`, or a
thin `http.request` pipe. Poll `GET /status` every 1.5s. For fonts: vendor woff2 into
`renderer/public/fonts/`, load local-first via `@remotion/fonts`, fall back to a bounded-retry
gstatic load, and final-fallback to a **bundled Plus Jakarta Sans / Inter — never monospace**.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MP4 file ingress (drop/picker) | Browser / Client | — | `File` object + object URL live in the SPA; never persisted client-side |
| Live preview background swap (D-02) | Browser / Client | — | Object URL feeds `@remotion/player` `rawVideoSrc`; pure client wiring |
| Upload forwarding (D-03) | Frontend Server (Studio Express) | — | Studio is the single public origin; api-server stays internal on `pipeline-net` |
| Job submission / orchestration | API / Backend (api-server) | — | Owns `POST /process`, multer, the docker-spawn pipeline, `MAX_CONCURRENT_JOBS=1` |
| Progress state | API / Backend (Redis) | Frontend Server (proxy) | api-server writes `job:{id}` hashes to Redis; Studio only relays the poll |
| Finished MP4 delivery (D-08) | API / Backend (artifacts route) | Frontend Server (proxy) | File lives on the pipeline volume; Studio proxies bytes + Range to the browser |
| Font loading at render | API / Backend (renderer container) | — | Runs in headless Chrome inside the renderer; browser tier never touches render fonts |
| Progress / result / failure UI | Browser / Client | — | Inline dimmed-stage surfaces in `PreviewApp.tsx` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | 5.2.1 (in use) | Studio proxy routes | Already the Studio server; reuse its auth + CORS middleware [VERIFIED: server.ts] |
| `@remotion/fonts` | 4.0.471 latest / pin **4.0.457** | Offline local-font loader for the renderer | Official Remotion package for `loadFont({family,url,weight})` from `staticFile()` — fully offline [CITED: remotion.dev/docs/fonts] |
| `@remotion/google-fonts` | 4.0.457 (in use) | gstatic fallback loader (retained) | Already installed; keep ONLY as the network fallback tier, not primary [VERIFIED: renderer node_modules] |
| `remotion` | 4.0.457 (in use) | `delayRender`/`continueRender`/`staticFile` | Font gating + bundling already in renderer [VERIFIED: Root.tsx, render.ts] |

> **Version pin rule (AGENTS.md "Version Compatibility"):** ALL `@remotion/*` packages MUST be the
> SAME version as `remotion` (4.0.457). `@remotion/fonts` latest is 4.0.471 — **install
> `@remotion/fonts@4.0.457`**, not latest. A mismatched @remotion/* version causes cryptic render
> failures (documented in CLAUDE.md).

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `undici` / global `fetch` (Node 22) | built-in | Stream upload to api-server | Node 22 ships `fetch` + `Request` with `duplex:'half'` for streaming bodies — no extra dep |
| `multer` | 2.x (already in api-server) | NOT needed in Studio | The Studio proxy should **avoid** re-parsing multipart; pass the raw stream through |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vendored woff2 + `@remotion/fonts` | Stay on `@remotion/google-fonts` only with retry | Network-dependent at render; a DNS blip on the FIRST fetch of a 666-frame job still risks a slow/failed start. Vendoring makes the happy path deterministic and offline (D-10). |
| Raw-stream passthrough proxy | `multer` memory/disk buffer then re-POST | Buffering a ≤500 MB file in the Studio process wastes RAM and doubles disk I/O. Streaming passthrough keeps the Studio thin. |
| Polling `GET /status` | SSE / WebSocket push | No backend change is allowed (locked constraint). Polling reuses the existing route; ~1.5s cadence is fine for a step-based bar. |

**Installation (renderer only):**
```bash
cd services/remotion-renderer && npm install @remotion/fonts@4.0.457
# then sync to studio if studio also needs the offline path (it does, for preview parity):
cd services/remotion-studio && npm install @remotion/fonts@4.0.457
```

**Version verification:**
```bash
npm view @remotion/fonts version   # → 4.0.471 latest (DO NOT use; pin 4.0.457 for parity)
```
`@remotion/fonts@4.0.457` exists on npm (the package has been published since v4.0.164). [VERIFIED: npm registry — but pin to match remotion 4.0.457 per CLAUDE.md]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@remotion/fonts` | npm | mature (since v4.0.164, 2024) | high (Remotion org) | github.com/remotion-dev/remotion | not run (network) | Approved — first-party Remotion scoped package, same org as all in-use @remotion/* deps |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

> slopcheck was not run in this session. `@remotion/fonts` is a first-party scoped package under the
> `@remotion` org — the same publisher as the 7 `@remotion/*` packages already in the renderer's
> `package.json`. Risk is minimal; the planner may still gate the install behind the existing
> renderer-build verification (vitest + a render smoke test) rather than a separate human-verify.

## Architecture Patterns

### System Architecture Diagram

```
 Browser (StudioApp SPA, port 3123)
   │  1. user drops MP4  ──► File object ──► URL.createObjectURL() ──► PreviewPlayer rawVideoSrc (D-02, live bg)
   │  2. click ▶ Render Video
   │       POST /api/render  (multipart: video=<File>)   [basic-auth cookie/header already on origin]
   ▼
 Studio Express (server.ts)  ── single public origin ──
   │  STREAM passthrough (no full buffering) ──► POST http://api-server:3000/process  (over pipeline-net)
   │  ◄── { jobId, ... }  relay to browser
   │
   │  3. browser polls every ~1.5s:  GET /api/status/:jobId
   │       └─► proxy ──► GET http://api-server:3000/status/:jobId ──► { status,currentStep,progress,stepInfo,steps,error }
   │
   │  4. on completed:  GET /api/result/:jobId   (inline <video> + download)
   │       └─► proxy w/ Range ──► GET http://api-server:3000/artifacts/{jobId}/quality-finalizer/output.mp4
   ▼
 api-server (3000, internal)
   POST /process ─ multer(disk) ─► runPipeline(jobId) ─► spawns 6 docker step containers, single-job
     │  writes job:{jobId} progress hash to Redis on each onStepStart
     │  steps: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → quality-finalizer → srt-exporter
     ▼
   remotion-renderer container (headless Chrome)
     loadFont(): local woff2 (staticFile) ─fail─► gstatic+retry ─fail─► bundled-sans  (NEVER monospace)
```

> **IMPORTANT finished-file path nuance:** `process.ts` returns `result.videoUrl`. The success
> response is `ArtifactResponseSchema` with `videoUrl` + an `artifacts` map of
> `/artifacts/{jobId}/{step}/{file}` URLs. The CONTEXT.md / D-08 names
> `/artifacts/{jobId}/output/video.mp4` — **but there is no `output` step**. The deliverable is the
> **last step's output**: `quality-finalizer/output.mp4` (the Lanczos-downscaled 1080×1920 final),
> with `remotion-renderer/output.mp4` as the pre-downscale source. **The planner MUST read the
> actual `videoUrl` returned by `POST /process`** rather than hardcode a path — that is the
> authoritative finished-file URL. [VERIFIED: process.ts L170-184, orchestrator.ts STEPS]

### Recommended Project Structure
```
services/remotion-studio/
├── src/server.ts                 # add: POST /api/render proxy, GET /api/status/:id, GET /api/result/:id
└── src/preview/
    ├── PreviewApp.tsx            # render CTA wiring, upload affordance, inline progress/result/failure states
    └── PreviewPlayer.tsx         # D-02: swap rawVideoSrc "/sample-video.mp4" → object URL of uploaded File
services/remotion-renderer/
├── public/fonts/                 # NEW: vendored woff2 files (Plus Jakarta Sans, Inter, + curated set)
├── src/fonts.ts                  # rewrite: local-first → gstatic-retry → bundled-sans fallback + per-font timeout
├── src/compositions/TitleOverlay.tsx   # delayRender gating already present; keep, ensure it can't hang
└── src/Root.tsx                  # subtitle-font delayRender gating already present
```

### Pattern 1: Streaming multipart proxy (no full-file buffering)
**What:** Forward the inbound request stream directly to api-server.
**When to use:** D-03 upload proxy. A ≤500 MB file must not be buffered in the Studio process.
**Example (Node 22 fetch with duplex streaming):**
```typescript
// Source: Node 22 fetch supports streaming request bodies with duplex:'half'
// In server.ts — register BEFORE express.json() limits apply, or scope a raw route.
app.post("/api/render", async (req, res) => {
  try {
    const upstream = await fetch("http://api-server:3000/process", {
      method: "POST",
      headers: {
        // forward the multipart boundary so multer on the other side can parse it
        "content-type": req.headers["content-type"] ?? "",
        "content-length": req.headers["content-length"] ?? "",
      },
      body: req,            // pipe the raw request stream
      duplex: "half",       // REQUIRED in Node 18+/22 when body is a stream
    });
    res.status(upstream.status);
    res.json(await upstream.json());
  } catch (err) {
    res.status(502).json({ error: { step: "proxy", message: String(err) } });
  }
});
```
> **Gotcha:** the global `app.use(express.json({limit:"10mb"}))` at server.ts:85 will NOT consume a
> multipart body (wrong content-type) but verify the `/api/render` route is registered so no body
> parser drains `req` first. If `fetch(body: req)` proves finicky, the robust fallback is a raw
> `http.request` pipe: `req.pipe(http.request({host:'api-server',port:3000,path:'/process',method:'POST',headers:req.headers}, up => up.pipe(res)))`.

### Pattern 2: Status-poll proxy + terminal detection
**What:** Relay `GET /status` and let the client poll.
**When to use:** D-05/D-06 progress.
**Example:**
```typescript
// server.ts
app.get("/api/status/:jobId", async (req, res) => {
  const up = await fetch(`http://api-server:3000/status/${req.params.jobId}`);
  res.status(up.status).json(await up.json());
});
```
Client polls every ~1500 ms. **Terminal states** (stop polling):
- `status === "completed"` → success → fetch `/api/result/:jobId`
- `status === "failed"` → failure → read `error` field for the cause line
- HTTP 404 → job expired (24h TTL) → surface "job no encontrado"
[VERIFIED: status.ts — BullMQ state is authoritative for completed/failed; progress.ts switch]

### Pattern 3: Range-aware result proxy (inline `<video>` + download)
**What:** Proxy the finished MP4 with HTTP Range support so `<video>` can seek and the browser can
download.
**When to use:** D-08.
**Example:**
```typescript
app.get("/api/result/:jobId", async (req, res) => {
  // Use the videoUrl returned by /process, OR re-derive from the last step.
  const url = `http://api-server:3000/artifacts/${req.params.jobId}/quality-finalizer/output.mp4`;
  const up = await fetch(url, { headers: req.headers.range ? { range: req.headers.range } : {} });
  res.status(up.status);
  ["content-type","content-length","accept-ranges","content-range"].forEach(h => {
    const v = up.headers.get(h); if (v) res.setHeader(h, v);
  });
  // download variant: add ?download=1 → res.setHeader("content-disposition", 'attachment; filename="reel.mp4"')
  // @ts-ignore Node stream interop
  Readable.fromWeb(up.body).pipe(res);
});
```
> **Range note:** `artifacts.ts` serves the file via `res.sendFile()`, which **does** honor Range
> requests natively (Express sets `Accept-Ranges` + handles `206 Partial Content`). So inline
> `<video>` seeking works as long as the proxy forwards the `Range`/`Content-Range` headers.
> [VERIFIED: artifacts.ts uses res.sendFile]

### Pattern 4: Offline-first font loading (RENDER-05 core)
**What:** Try local vendored woff2 first; only touch the network as a bounded fallback; never end on
monospace.
**Example (new fonts.ts shape):**
```typescript
// Source: remotion.dev/docs/fonts — @remotion/fonts loadFont with staticFile()
import { loadFont as loadLocal } from "@remotion/fonts";
import { staticFile } from "remotion";

const PER_FONT_TIMEOUT_MS = 10_000;             // D-11 hard requirement
const BUNDLED_SANS = "Plus Jakarta Sans";       // D-12 final fallback — NEVER monospace

function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error("font timeout")), ms))]);
}

export async function loadFontResilient(moduleName: string): Promise<string> {
  const family = getFontFamilyCSS(moduleName);
  // 1) local vendored woff2 (offline, deterministic)
  try {
    await withTimeout(loadLocal({ family, url: staticFile(`fonts/${moduleName}-Regular.woff2`), weight: "400" }), PER_FONT_TIMEOUT_MS);
    await withTimeout(loadLocal({ family, url: staticFile(`fonts/${moduleName}-Bold.woff2`),    weight: "700" }), PER_FONT_TIMEOUT_MS);
    return family;
  } catch { /* fall through */ }
  // 2) gstatic via @remotion/google-fonts with bounded retry (it already retries 2x internally)
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await withTimeout(loadGstatic(moduleName), PER_FONT_TIMEOUT_MS); } catch { /* backoff */ }
  }
  // 3) bundled default sans — NEVER monospace (D-12)
  try {
    await withTimeout(loadLocal({ family: BUNDLED_SANS, url: staticFile("fonts/PlusJakartaSans-Regular.woff2"), weight: "400" }), PER_FONT_TIMEOUT_MS);
    return BUNDLED_SANS;
  } catch { return BUNDLED_SANS; } // CSS family resolves to bundled-sans @font-face already added; worst case still a real sans
}
```
> The per-font `withTimeout` race is what closes the **hang path**: today only the 3h process
> timeout (and `@remotion/google-fonts`' internal 60s `delayRender` + 18s FontFace timeout) bound a
> stuck fetch. A 10s race per attempt guarantees the render proceeds.

### Anti-Patterns to Avoid
- **Buffering the whole upload in the Studio process** → wastes RAM on a ≤500 MB file; stream it.
- **Re-parsing multipart with multer in the Studio** → the boundary must survive to api-server's
  multer; just pass `content-type` through.
- **Falling back to `monospace`** → the current bug (D-12); it makes a render look broken. Always
  end on a bundled sans.
- **Hardcoding `/artifacts/{jobId}/output/video.mp4`** → there is no `output` step; use the
  `videoUrl` from `POST /process` or `quality-finalizer/output.mp4`.
- **Allowing a second concurrent submit** → `MAX_CONCURRENT_JOBS=1`; lock the Render CTA via the
  dimmed-stage running state (D-06). No second `POST /process` while one is active.
- **Two greens at once** → green is ONLY the Render CTA; Download uses `--accent` (blue), failure
  uses low-chroma `--danger`. (green discipline, render-export-surface.md)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multipart streaming to upstream | Custom busboy re-encoder | Raw `req.pipe()` / `fetch(body:req,duplex)` | The boundary is already framed; re-encoding risks corruption + memory blowup |
| HTTP Range for video seek | Manual byte-range slicing | `res.sendFile` (api-server) + header passthrough | Express already implements 206/Accept-Ranges correctly |
| Offline font loading | Manual `FontFace` + fetch plumbing | `@remotion/fonts` `loadFont` | First-party, handles `staticFile` URL + format detection + delayRender |
| Font retry/timeout against gstatic | New fetch retry loop | `@remotion/google-fonts` (already retries 2x + 60s/18s timeouts) wrapped in a 10s race | Reuse its internal retry; add only the outer per-font timeout |
| Job progress %/step mapping | Frame-level plumbing | Existing `GET /status` `progress`/`stepInfo` | Backend change is locked OUT; step-based bar is the chosen design |

**Key insight:** Almost every primitive this phase needs already exists in the codebase or in
first-party Remotion packages. The net-new code is glue (3 proxy routes), UI states, and a font
fallback chain — not infrastructure.

## Runtime State Inventory

> This phase is mostly additive (new routes, new UI, font fallback) but it DOES touch the renderer
> Docker image and runtime state. Checked all 5 categories.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Redis `job:{jobId}` progress hashes (24h TTL) and BullMQ job records — already written by api-server; Phase 23 only READS them via the status poll. No new stored data. | None (read-only consumer) |
| Live service config | `ACTIVE_PIPELINE_CONFIG_PATH` already seeds the styled config into each job (Phases 16/17) — the studio-saved design is honored at render with zero new wiring. No live-service rename. | None — verified by process.ts L122-136 |
| OS-registered state | None — no Task Scheduler / systemd / pm2 names involved. | None |
| Secrets/env vars | `STUDIO_BASIC_AUTH_USER/PASSWORD` (reused for the new proxy routes — same auth model, no new secret). `WHISPER_API_URL/KEY` already on api-server. No new secret introduced. | None — reuse existing basic-auth middleware |
| Build artifacts | **Renderer Docker image must be rebuilt** to bake in `public/fonts/*.woff2` + the new `@remotion/fonts` dep. The renderer `Dockerfile` `COPY src/ src/` but does NOT currently copy a `public/fonts/` dir — the Dockerfile + image rebuild are required. **Renderer-sync clobber hazard applies**: font/composition changes land in BOTH studio and renderer; re-run renderer vitest after sync (AGENTS.md). | Add `COPY public/ public/` to renderer Dockerfile; rebuild image; re-run renderer vitest |

**The canonical question — after all files are updated, what runtime still has the old behavior?**
The **running renderer Docker image**. Vendored fonts only take effect after
`docker compose build remotion-renderer` (or the project's image-build step). A stale image will
still hit gstatic. The plan MUST include an image rebuild + a render smoke test as a verification step.

## Common Pitfalls

### Pitfall 1: The progress bar dwells on `remotion-renderer` and looks stuck
**What goes wrong:** Step 4 of 6 (`remotion-renderer`) is the long pole (~40s–minutes for a
666-frame job); the step-based bar sits at ~67% (`4/6`) the entire time.
**Why it happens:** `progress = (completedSteps+1)/6*100` is step-granular, not frame-granular, and
frame-level progress is deliberately deferred.
**How to avoid:** D-05's affordance — show the step NAME prominently ("Renderizando…") plus a
"este paso toma más tiempo" hint and an indeterminate shimmer on the bar segment while on
`remotion-renderer`. Do NOT fake movement.
**Warning signs:** Users thinking the render froze at ~67%.

### Pitfall 2: Renderer-sync clobber silently reverts the font fix
**What goes wrong:** A later bulk `cp src/compositions/* studio→renderer` (the AGENTS.md sync) can
revert a renderer-only `fonts.ts` change, re-introducing the monospace fallback.
**Why it happens:** `fonts.ts` is a shared module copied in BOTH directions historically (STATE.md
"Renderer sync clobber hazard").
**How to avoid:** Make the font change in BOTH `services/remotion-studio/src/fonts.ts` and
`services/remotion-renderer/src/fonts.ts`, and **re-run renderer vitest after any sync** (memory:
renderer-sync-clobber-hazard).
**Warning signs:** Preview shows correct font, render falls back to mono — the classic split-state bug.

### Pitfall 3: Missing `duplex:'half'` on streaming fetch body
**What goes wrong:** `fetch(url,{body: req})` throws `RequestInit: duplex option is required when
sending a body` in Node 18+/22.
**Why it happens:** Node's undici requires explicit half-duplex declaration for stream bodies.
**How to avoid:** Always set `duplex: "half"`; or use the `http.request` pipe fallback (Pattern 1).
**Warning signs:** 500 on the very first render submit, error mentions `duplex`.

### Pitfall 4: Object URL not revoked → memory leak on re-upload
**What goes wrong:** D-02 wires `URL.createObjectURL(file)` into the Player; re-uploading without
`URL.revokeObjectURL` leaks the previous blob.
**How to avoid:** Revoke the previous object URL in a `useEffect` cleanup when the File changes.
**Warning signs:** Growing tab memory after several uploads.

### Pitfall 5: Render OOM (exit 137 / signal 9) mis-surfaced
**What goes wrong:** The renderer Chrome OOMs; the failure must read `remotion-renderer · exit 137
— sin memoria` honestly (D-09), not a generic "render failed".
**Why it happens:** `MAX_CONCURRENT_JOBS=1` + Chrome RAM pressure (project's render-memory history;
`REMOTION_CONCURRENCY=2`, `shmSizeBytes=2GB`).
**How to avoid:** The `error` object is `{step:"remotion-renderer", exitCode:137, message:...}` —
format step+exitCode in the muted-mono cause line; map signal 9/exit 137 → "sin memoria".
[VERIFIED: process.ts emits `{step, exitCode, message}`; STEPS shmSize comment]
**Warning signs:** `exitCode: 137` or message containing `signal 9` / `killed`.

## Code Examples

### Map the 6-step status to a Spanish step name + honest %
```typescript
// Source: orchestrator.ts STEPS (verified) + progress.ts (verified)
const STEP_LABELS: Record<string,string> = {
  queued:             "En cola",
  whisper:            "Transcribiendo",
  "silence-cutter":   "Cortando silencios",
  "ffmpeg-finalizer": "Formato vertical 9:16",
  "remotion-renderer":"Renderizando",        // long step — show "este paso toma más tiempo"
  "quality-finalizer":"Afinando calidad",
  "srt-exporter":     "Exportando subtítulos",
  completed:          "Listo",
  timeout:            "Tiempo agotado",
  unknown:            "Error",
};
// status JSON: { status, currentStep, progress (0-100), stepInfo "n/6", steps:[done], startedAt, error }
function stepLabel(s: {currentStep:string}) { return STEP_LABELS[s.currentStep] ?? s.currentStep; }
```

### Failure cause line (D-09)
```typescript
// error object from POST /process failure OR status.error string.
// status.error is a STRING: "Step remotion-renderer failed (exit 137): <msg>"
// POST /process failure body is structured: { jobId, error: { step, exitCode, message } }
function causeLine(step: string, exitCode?: number) {
  const oom = exitCode === 137; // signal 9
  return `${step} · exit ${exitCode}${oom ? " — sin memoria" : ""}`;
}
```

### D-02: swap preview background to uploaded file
```typescript
// PreviewPlayer.tsx currently: rawVideoSrc: "/sample-video.mp4"  (server.ts:51)
// Pass the object URL down as a prop:
const objectUrl = useMemo(() => file ? URL.createObjectURL(file) : "/sample-video.mp4", [file]);
useEffect(() => () => { if (file) URL.revokeObjectURL(objectUrl); }, [objectUrl, file]);
// inputProps.rawVideoSrc = objectUrl   (subtitles stay sample-timed until real render — D-02 nuance)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@remotion/google-fonts` only, gstatic at render | `@remotion/fonts` local woff2 via `staticFile()` | v4.0.164 (2024) | Deterministic offline fonts; the documented fix for gstatic render timeouts |
| try/catch → `monospace` fallback | local-first → retry → bundled-sans chain | this phase | Closes silent-degrade (D-12) + hang path (D-11) |
| `POST /api/render` 501 stub | streaming proxy to api-server | this phase | Studio becomes a self-contained factory (RENDER-01) |

**Deprecated/outdated:**
- Relying on `@remotion/google-fonts` swallow-to-monospace as the only resilience — replaced by the
  vendored-first chain.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The deliverable finished MP4 is `quality-finalizer/output.mp4` (last step). The plan should still prefer the `videoUrl` returned by `POST /process`. | Architecture diagram / D-08 | Wrong path → broken download/preview. Mitigated: use `videoUrl` from the response, which is authoritative. |
| A2 | Node 22 `fetch` with `body: req, duplex:'half'` streams the multipart cleanly to api-server's multer. | Pattern 1 | If undici mangles the stream, fall back to `http.request` pipe (documented as the robust alternative). LOW risk. |
| A3 | Vendored woff2 filenames follow `{ModuleName}-Regular.woff2` / `-Bold.woff2` convention. | Pattern 4 | Cosmetic — naming is the implementer's choice; just keep `fonts.ts` and the vendored files in sync. |
| A4 | A 10s per-font timeout is adequate (CONTEXT marks the exact value as Claude's discretion). | Pattern 4 | Too short → spurious fallback; too long → slow start. Tunable; bounded by D-11. |
| A5 | Restricting to `latin`+`latin-ext` subsets (as the current code does) is sufficient for the vendored set. | fonts.ts | Spanish/English only need latin; verified by existing comment. LOW. |

## Open Questions

1. **Which fonts to vendor?**
   - What we know: 26 Google Fonts are in `AVAILABLE_FONTS`; vendoring all × multiple weights bloats
     the image.
   - What's unclear: whether to vendor only the **default + most-used** (Plus Jakarta Sans, Inter,
     Montserrat, Poppins, Oswald, Bebas Neue…) and let the rest fall through to gstatic-with-retry.
   - Recommendation: Vendor the **bundled-sans fallbacks (Plus Jakarta Sans + Inter) unconditionally**
     (guarantees D-12), plus the top ~6–8 fonts; remaining fonts use the gstatic-retry tier. This
     bounds image size while making the common path offline. (Planner's call — within D-10/D-12.)

2. **Does `POST /process` block until the whole render finishes (synchronous), or return a jobId immediately?**
   - What we know: `process.ts` `await runPipeline(...)` runs the FULL pipeline before responding,
     racing a 3h timeout. So `POST /process` is **synchronous** — it does NOT return until the job
     completes or fails. The `jobId` is only in the final response body.
   - What's unclear: how the browser gets the `jobId` to start polling if the request blocks for
     minutes. The status poll needs the jobId UP FRONT.
   - Recommendation: **This is a real design seam the planner must resolve.** Options: (a) the Studio
     proxy reads the jobId by ALSO calling — no, jobId is generated server-side. (b) Treat the
     `POST /api/render` request itself as the long-lived "job" — keep the fetch open, show
     indeterminate "Iniciando…" until it resolves, and poll is unnecessary because the response IS
     the terminal result. BUT that defeats live step progress (RENDER-02). (c) Preferred: the Studio
     proxy could generate-and-pass nothing; instead use the **async path** — note that api-server
     ALSO has a BullMQ queue (`POST /batch`, `videoQueue`) that returns a jobId immediately and runs
     via `worker.ts`. **The planner should verify whether to submit via the queue (immediate jobId →
     pollable) rather than the synchronous `/process`.** This is the single most important
     architectural question for RENDER-02 and is flagged HIGH priority. See `status.ts` referencing
     `videoQueue` and CONTEXT note that `POST /batch` exists.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| api-server on `pipeline-net` as `http://api-server:3000` | Proxy target (D-03) | ✓ | — | none — required; docker-compose defines it |
| Redis | Job progress hashes / BullMQ | ✓ | 7.x | none — already running |
| Docker (build renderer image) | Vendored-font rebuild | ✓ | — | none — required for RENDER-05 to take effect |
| `@remotion/fonts@4.0.457` | Offline font loading | ✗ (not yet installed) | 4.0.457 to install | `@remotion/google-fonts` retry-only (weaker, network-dependent) |
| `fonts.gstatic.com` reachability | gstatic fallback tier only | intermittent (the whole point) | — | vendored local woff2 (primary) |

**Missing dependencies with no fallback:** none (all blocking deps already present).
**Missing dependencies with fallback:** `@remotion/fonts` not yet installed — install it; without it
the offline guarantee weakens to retry-only.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (renderer + studio); api-server has existing route tests |
| Config file | `services/remotion-renderer/vitest.config.ts` (exists); studio vitest config |
| Quick run command | `cd services/remotion-renderer && npx vitest run` |
| Full suite command | per-service `npx vitest run` + a render smoke test (real `POST /process` on a short clip) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RENDER-01 | `POST /api/render` proxies a multipart upload to api-server and returns a jobId (not 501) | integration | `npx vitest run` (studio, mock upstream) | ❌ Wave 0 |
| RENDER-02 | `GET /api/status/:id` relays the upstream `{status,currentStep,progress}`; client maps currentStep→Spanish label + honest % | unit + integration | `npx vitest run` (status-map unit; proxy relay) | ❌ Wave 0 |
| RENDER-03 | On `status:"failed"` with `exitCode:137`, the cause line renders `remotion-renderer · exit 137 — sin memoria` | unit | `npx vitest run` (causeLine fn) | ❌ Wave 0 |
| RENDER-03 | On `status:"completed"`, success surface shows; on failure, danger surface shows | component | studio vitest / RTL | ❌ Wave 0 |
| RENDER-04 | `GET /api/result/:id` proxies the finished MP4 with Range headers; `<video>` can play + download works | integration | `npx vitest run` (range header passthrough) | ❌ Wave 0 |
| RENDER-05 | A simulated gstatic failure (block network / 1st-fetch throw) still completes a render via vendored font; NEVER monospace | integration / render smoke | font-fallback unit + a render with gstatic blocked | ❌ Wave 0 |
| RENDER-05 | A per-font load that never resolves is bounded by the 10s timeout (no hang) | unit | `npx vitest run` (withTimeout race) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd services/<service> && npx vitest run` for the touched service.
- **Per wave merge:** renderer + studio vitest + api-server route tests.
- **Phase gate:** A real render smoke test — `POST /process` on a short clip — green, AND a
  gstatic-blocked render that still completes with a non-monospace font (the RENDER-05 proof),
  before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `services/remotion-renderer/src/fonts.test.ts` — covers RENDER-05 (local-first, timeout race, bundled-sans fallback, NEVER monospace)
- [ ] `services/remotion-studio/src/server.test.ts` (or proxy test) — covers RENDER-01/02/04 (proxy relay, range headers, status passthrough) with a mocked api-server
- [ ] A `causeLine` / step-label unit test — covers RENDER-02/03 mapping
- [ ] A render smoke harness with gstatic blocked (e.g., `--add-host fonts.gstatic.com:127.0.0.1` or offline network) — the RENDER-05 end-to-end proof
- [ ] Vendored woff2 fixtures in `public/fonts/` for the font tests to resolve `staticFile()`

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Reuse existing Studio HTTP Basic Auth middleware (server.ts) — the new `/api/render`, `/api/status`, `/api/result` routes are auto-covered since auth is global middleware. Verify they sit AFTER the auth middleware. |
| V3 Session Management | no | Single-user local Studio; no sessions beyond basic-auth challenge. |
| V4 Access Control | yes | jobId is a UUID (validated by `uuidRegex` in status.ts). The result proxy must NOT allow arbitrary path/step (artifacts.ts already has path-traversal protection — keep proxy to fixed step names). |
| V5 Input Validation | yes | api-server's multer enforces `video/mp4` mimetype + 500MB. The Studio proxy should NOT relax these — pass through and let api-server reject. UUID-validate jobId before proxying status/result. |
| V6 Cryptography | no | No new crypto; basic-auth uses existing `timingSafeEqual` (WR-01). |

### Known Threat Patterns for Studio proxy + renderer
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via jobId/step in result proxy | Tampering | UUID-validate jobId; pin step name to `quality-finalizer`; api-server's `path.resolve` containment already blocks escapes |
| api-server exposed publicly (CORS / direct hit) | Info disclosure | Keep api-server internal on `pipeline-net`; ONLY the Studio (basic-auth) is the public origin (D-03) |
| Unbounded upload memory | DoS | Stream passthrough (no buffering); 500MB cap enforced by api-server multer |
| Font fetch SSRF / malicious URL | — | Vendored fonts are local `staticFile()`; gstatic URLs are first-party from `@remotion/google-fonts` meta — no user-controlled font URLs |
| Second concurrent submit overwhelms single-job pipeline | DoS | Lock Render CTA during active render (D-06, `MAX_CONCURRENT_JOBS=1`) |

## Sources

### Primary (HIGH confidence)
- `services/remotion-studio/src/server.ts` — proxy target, basic-auth, CORS, 501 stub, body parsers
- `services/api-server/src/routes/{process,status,artifacts}.ts` — response/error shapes, multer, Range via sendFile
- `services/api-server/src/{orchestrator,progress}.ts` — 6 STEPS, step-based % formula, error contract
- `services/remotion-renderer/src/{fonts.ts,Root.tsx,compositions/TitleOverlay.tsx,render.ts}` — font gating, delayRender, bundle/publicDir
- `services/remotion-renderer/node_modules/@remotion/google-fonts/dist/cjs/base.js` + `Inter.js` — internal retry (2x), 60s delayRender / 18s FontFace timeout, hardcoded gstatic woff2 URLs
- `services/remotion-renderer/Dockerfile` — image build; no `public/fonts` copy yet
- `.claude/skills/sketch-findings-reel-factory/references/{render-export-surface,render-last-mile,error-failure-states}.md` + `sources/themes/default.css` — design grammar + tokens
- remotion.dev/docs/fonts — `@remotion/fonts` `loadFont({family,url:staticFile,weight})` offline API [CITED]

### Secondary (MEDIUM confidence)
- remotion.dev/docs/troubleshooting/font-loading-errors — subset/weight restriction to avoid timeouts [CITED]
- npm registry — `@remotion/fonts` published, latest 4.0.471 (pin 4.0.457)

### Tertiary (LOW confidence)
- WebSearch results on `@remotion/fonts` local loading (cross-verified against official docs → promoted)

## Metadata

**Confidence breakdown:**
- Proxy architecture: HIGH — all routes/shapes read from source; one open seam (sync vs queue submit, Q2)
- Status/progress mapping: HIGH — exact formula + STEPS verified in code
- Font resilience: HIGH — google-fonts internals + @remotion/fonts API verified
- Finished-file path: MEDIUM — `videoUrl` is authoritative; the `output` path in CONTEXT is inaccurate (corrected)
- Submit-mode (sync `/process` vs async queue): MEDIUM — flagged as the top open question

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable; Remotion font API + internal codebase unlikely to shift in 30 days)
</content>
</invoke>
