# Phase 23: Render execution + progress - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 8 (3 new, 5 modified)
**Analogs found:** 8 / 8

> All patterns below are concrete excerpts from the existing codebase. The planner should
> reference the cited file + line range in each plan's action section rather than re-deriving.
> This phase is **glue, not infrastructure** — almost every primitive already exists.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/remotion-studio/src/server.ts` (MOD) — add `POST /api/render`, `GET /api/status/:id`, `GET /api/result/:id` proxy routes | route/proxy | request-response + streaming | `server.ts` `PUT /api/config` (L153-203) + api-server `artifacts.ts` (sendFile) | exact (same file, same auth/origin model) |
| `services/remotion-studio/src/preview/PreviewApp.tsx` (MOD) — Render CTA wiring, upload affordance, inline progress/result/failure states, poll loop | component | event-driven (poll) + request-response | `PreviewApp.tsx` `handleSave` (L300-343) + `useEffect` fetch (L243-280) + `saveTimeoutRef` (L221, L283-287) | exact (same file, same fetch/state/timeout patterns) |
| `services/remotion-studio/src/preview/PreviewPlayer.tsx` (MOD) — swap `rawVideoSrc` to uploaded-file object URL (D-02) | component | transform (prop) | `PreviewPlayer.tsx` `inputProps` useMemo (L49-63) | exact (same file) |
| `services/remotion-renderer/src/fonts.ts` (MOD) — local-first → gstatic-retry → bundled-sans chain + per-font timeout | utility/service | file-I/O + request-response (fallback) | `fonts.ts` `loadFont` try/catch (L109-131) | exact (same file, rewrite the fallback chain) |
| `services/remotion-studio/src/fonts.ts` (MOD) — mirror of renderer change (preview parity; clobber hazard) | utility/service | file-I/O | renderer `fonts.ts` (sibling copy) | exact (sibling) |
| `services/remotion-renderer/public/fonts/*.woff2` (NEW) — vendored woff2 assets | config/asset | file-I/O | `services/remotion-renderer/public/input-video.mp4` (existing public asset) | role-match |
| `services/remotion-renderer/Dockerfile` (MOD) — `COPY public/ public/` to bake fonts | config | build | `Dockerfile` `COPY src/ src/` (L11) | exact (same file) |
| `services/remotion-studio/src/server.test.ts` (NEW) — proxy relay / range / status passthrough | test | request-response | `services/api-server/src/routes/process.test.ts` (supertest + vi.mock, L1-55) | role-match (different service, same supertest+vitest harness) |
| `services/remotion-renderer/src/fonts.test.ts` (NEW) — font fallback chain, timeout race, NEVER monospace | test | unit | `services/remotion-renderer/src/captions.test.ts` (vitest unit) | role-match |

---

## Pattern Assignments

### `services/remotion-studio/src/server.ts` (proxy routes — request-response + streaming)

**Analog:** the existing `PUT /api/config` handler in the SAME file, and api-server `artifacts.ts` for Range.

The new routes sit AFTER the global basic-auth middleware (`server.ts` L63-83) and CORS (L31-34),
so they inherit auth/origin for free — confirmed by RESEARCH Security Domain V2. Register them
BEFORE the `express.static` SPA catch-all (L242-255) — the existing comment at L237-240 documents
this ordering requirement.

**Auth/origin pattern is automatic** (L63-83) — the new routes need NO extra auth code; they sit
under the same global middleware. Do not re-add auth per route.

**Handler shape to copy — error envelope + status passthrough** (from `PUT /api/config`, L153-203):
```typescript
app.put("/api/config", (req, res) => {
  // ... work ...
  try {
    // ...
    return res.json({ ...configToWrite, _meta: { /* ... */ } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error writing config";
    console.error("[studio] Error writing config:", message);
    return res.status(500).json({ error: "Failed to write config", message });
  }
});
```
> Keep the `{ error: { step, message } }` envelope shape the api-server already emits (process.ts
> L197-204) so the client failure-formatter has one contract. RESEARCH Pattern 1 proposes a 502
> envelope `{ error: { step: "proxy", message } }` for proxy-layer failures — consistent with this.

**Body-parser ordering gotcha:** the global `app.use(express.json({ limit: "10mb" }))` at
`server.ts:85` will NOT drain a multipart body (wrong content-type), but the streaming `POST
/api/render` route must be registered so no parser consumes `req` first. RESEARCH Pattern 1 +
Pitfall 3: use Node 22 `fetch(upstream, { body: req, duplex: "half" })`, fallback to
`req.pipe(http.request(...))`.

**Range-aware result proxy** — api-server's `artifacts.ts` already serves via `res.sendFile`
(L71), which natively honors Range / `206 Partial Content`. The proxy only needs to forward the
`Range`/`Content-Range`/`Accept-Ranges`/`Content-Length`/`Content-Type` headers (RESEARCH
Pattern 3). The path-traversal guard in `artifacts.ts` (L60-66) stays server-side; the proxy
pins the step name (`quality-finalizer`) and UUID-validates jobId.

**jobId UUID validation** to copy verbatim before proxying status/result (from `status.ts` L20-24):
```typescript
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(jobId)) { res.status(400).json({ error: "Invalid jobId format" }); return; }
```

> **CRITICAL submit-mode seam (RESEARCH Open Question 2 — planner MUST resolve):**
> `POST /process` (process.ts L96-165) is **synchronous** — it `await runPipeline(...)` and only
> returns the `jobId` in the FINAL body (minutes later), defeating live polling (RENDER-02).
> The poll-friendly analog is **`POST /batch`** (batch.ts L79-141): it calls
> `videoQueue.add("process-video", { jobId, ... })` (L112) and returns the `jobId` **immediately**
> (`status: "queued"`), then a `worker.ts` runs the pipeline and writes the same `job:{id}` Redis
> progress hash that `GET /status/:jobId` reads. **For RENDER-02 the planner should submit via the
> queue path (immediate jobId → pollable), not the blocking `/process`.** The batch handler already
> seeds `updateJobProgress(jobId, { status: "queued", currentStep: "queued" })` (batch.ts L123) —
> the exact precondition `GET /status` needs.

---

### `services/remotion-studio/src/preview/PreviewApp.tsx` (inline states + poll loop — event-driven)

**Analog:** the existing `handleSave` async handler + config-fetch `useEffect` + timeout-ref
cleanup, all in the SAME file.

**Async submit handler pattern** (from `handleSave`, L300-343) — copy the saving/success/error
tri-state + `try/catch/finally` for the Render submit:
```typescript
const handleSave = useCallback(async () => {
  try {
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: "Unknown error" }));
      const message = /* field errors → fallback to errData.error */;
      throw new Error(message);
    }
    // ... commit state ...
    setSaveSuccess(true);
    saveTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : "Failed to save config");
  } finally {
    setSaving(false);
  }
}, [/* deps */]);
```
> For the render submit, `body` is `FormData` (multipart `video=<File>`) — do NOT set
> `Content-Type` manually (let the browser set the multipart boundary).

**Poll loop pattern** — there is no existing interval poll in the codebase, but the **timeout-ref
lifecycle is the established analog** (`saveTimeoutRef`, L221 declared, L335 set, L283-287 cleared
on unmount). Mirror it for the poll: a `pollRef` cleared in a `useEffect` cleanup and on terminal
state. Terminal states stop polling (RESEARCH Pattern 2 / UI-SPEC §2): `completed` → success,
`failed` → failure, HTTP 404 → "Job no encontrado". Cadence ~1.5s (Claude's discretion, D-06).
```typescript
// Established cleanup analog to mirror for the poll interval (L221, L283-287):
const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }, []);
```

**Mount-fetch + shape-validation pattern** (from config-load `useEffect`, L243-280) — reuse the
`.then(res => res.json()).catch(() => {/* defaults */})` shape; the status response is already
Zod-validated server-side (`status.ts` L47-56) so the client can trust `{status, currentStep,
progress, stepInfo, steps, error}`.

**Step-label + cause-line mapping** (RESEARCH Code Examples; UI-SPEC §2 table + §4) — pure
functions, unit-testable. The 6 real steps come from `orchestrator.ts STEPS`:
`whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → quality-finalizer → srt-exporter`.
```typescript
const STEP_LABELS: Record<string,string> = {
  queued: "En cola", whisper: "Transcribiendo", "silence-cutter": "Cortando silencios",
  "ffmpeg-finalizer": "Formato vertical 9:16", "remotion-renderer": "Renderizando",
  "quality-finalizer": "Afinando calidad", "srt-exporter": "Exportando subtítulos",
  completed: "Listo", timeout: "Tiempo agotado",
};
function causeLine(step: string, exitCode?: number) {
  return `${step} · exit ${exitCode}${exitCode === 137 ? " — sin memoria" : ""}`;
}
```
> Honest % comes straight from `GET /status` `progress` = `(completedSteps+1)/6*100` (progress.ts
> L144) — ~17% increments, dwells on `remotion-renderer`. Do NOT fake movement; UI-SPEC §2 mandates
> the indeterminate shimmer + "este paso toma más tiempo" hint on that segment.

**Header CTA state machine** — the disabled green button already exists (L424-442). Wire its
4 states per UI-SPEC Copywriting: `▶ Render Video` (idle) → `⟳ Renderizando…` (disabled) →
`▶ Renderizar de nuevo` (success) → `↻ Reintentar` (failure). Green-discipline: this is the ONLY
green; Descargar uses `--accent` (UI-SPEC Color). Existing save-status chips (L369-399) are the
token/markup analog for the inline success/failure surfaces (`--success` / `--danger` borders).

---

### `services/remotion-studio/src/preview/PreviewPlayer.tsx` (D-02 background swap — transform)

**Analog:** the `inputProps` useMemo in the SAME file (L49-63).

Today `rawVideoSrc` is hardcoded (L52-53). D-02 swaps it to the uploaded File's object URL passed
down as a prop. Mirror the existing memoization; add object-URL revoke on change (RESEARCH
Pitfall 4 / UI-SPEC §1 memory-leak guard):
```typescript
// Existing (L49-63) — the shape to extend:
const inputProps: RemotionProps = useMemo(() => ({
  videoSrc: "sample-video.mp4",
  rawVideoSrc: "/sample-video.mp4",   // ← D-02: replace with object URL of uploaded File
  captionPages, subtitleLayout: subtitleConfig.layout, subtitleConfig,
  titles: titles ?? [], overlays: overlays ?? [], /* ... */
}), [captionPages, subtitleConfig, totalDurationMs, titles, overlays]);
```
```typescript
// RESEARCH Code Examples — object URL + revoke (add to PreviewApp, pass down):
const objectUrl = useMemo(() => file ? URL.createObjectURL(file) : "/sample-video.mp4", [file]);
useEffect(() => () => { if (file) URL.revokeObjectURL(objectUrl); }, [objectUrl, file]);
```
> D-02 nuance (UI-SPEC §1 copy): subtitles stay sample-timed pre-render (no transcript exists yet).

---

### `services/remotion-renderer/src/fonts.ts` + `services/remotion-studio/src/fonts.ts` (RENDER-05 — file-I/O + network fallback)

**Analog:** the current `loadFont` try/catch in the SAME file (L109-131) — the rewrite target.

**Current pattern (the bug to replace)** — ends on `monospace` (D-12 forbids this):
```typescript
export async function loadFont(fontFamily: string): Promise<string> {
  if (fontFamily === "monospace" || fontFamily === "") return "monospace";
  const loader = FONT_LOADERS[fontFamily];
  if (!loader) {
    console.warn(`[fonts] Unknown font family "${fontFamily}", falling back to monospace`);
    return "monospace";                                    // ← D-12 violation
  }
  try {
    const result = await loader.loadFont("normal", { subsets: ["latin", "latin-ext"] });
    return result.fontFamily;
  } catch (err) {
    console.warn(`[fonts] Failed to load font "${fontFamily}", falling back to monospace:`, err);
    return "monospace";                                    // ← D-12 violation + hang path (no timeout)
  }
}
```

**New shape (RESEARCH Pattern 4):** local vendored woff2 via `@remotion/fonts` `loadFont({family,
url: staticFile(...)})` FIRST → gstatic via existing `@remotion/google-fonts` retry SECOND →
bundled Plus Jakarta Sans / Inter LAST. Wrap EVERY attempt in a `withTimeout` race (D-11, ~10s):
```typescript
import { loadFont as loadLocal } from "@remotion/fonts";   // install @remotion/fonts@4.0.457 (NOT latest)
import { staticFile } from "remotion";
const PER_FONT_TIMEOUT_MS = 10_000;          // D-11 hard requirement
const BUNDLED_SANS = "Plus Jakarta Sans";    // D-12 final fallback — NEVER monospace
function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([p, new Promise<never>((_, r) =>
    setTimeout(() => r(new Error("font timeout")), ms))]);
}
```
> **Keep the `subsets: ["latin", "latin-ext"]` restriction** (current L125) — the comment there
> documents WHY (40-50 requests/font/tab exhausts Chrome's socket pool during parallel frame
> render). Carry it into the gstatic fallback tier.
>
> **`@remotion/fonts` is NOT yet installed** (only `@remotion/google-fonts` is present in both
> services' node_modules — verified). Install `@remotion/fonts@4.0.457` to MATCH `remotion@4.0.457`
> (AGENTS.md Version Compatibility — latest 4.0.471 will cause cryptic render failures).

**delayRender hang-path closure** (D-11) — the timeout must propagate through the `delayRender`/
`continueRender` gates that call `loadFont`. Both call sites already release the handle on `.catch`
(so the new chain's worst case still `continueRender`s):
- `TitleOverlay.tsx` L82-122: `delayRender` + per-font finish/cleanup (releases handle in cleanup L118-121).
- `Root.tsx` L83-86: `delayRender` → `loadFont(...).then(continueRender).catch(continueRender)`.

> **Renderer-sync clobber hazard (D-10 note, AGENTS.md, memory):** `fonts.ts` is a shared module in
> BOTH `remotion-studio` and `remotion-renderer`. Make the change in BOTH, and re-run renderer
> vitest after any `cp` sync. A bulk `cp src/compositions/*` or `cp src/fonts.ts` studio→renderer
> can silently revert the fix → preview shows the font, render falls back. (RESEARCH Pitfall 2.)

---

### `services/remotion-renderer/public/fonts/*.woff2` (NEW vendored assets) + Dockerfile (MOD)

**Analog:** existing `services/remotion-renderer/public/input-video.mp4` (public asset already
served via `staticFile`); Dockerfile `COPY src/ src/` (L11).

The renderer Dockerfile (L1-15) creates `/app/public` at runtime (L13) but does NOT `COPY` a
`public/fonts/` dir. RESEARCH Runtime State Inventory: **add `COPY public/ public/`** before/after
`COPY src/ src/`, then rebuild the image. Vendor unconditionally: Plus Jakarta Sans + Inter (D-12
guarantee) plus top ~6-8 fonts; remaining 26-font set falls through to gstatic-retry (RESEARCH
Open Question 1). **A stale image still hits gstatic** — the plan MUST include
`docker compose build remotion-renderer` + a render smoke test as a verification gate.

---

### `services/remotion-studio/src/server.test.ts` (NEW) + `services/remotion-renderer/src/fonts.test.ts` (NEW)

**Analog (proxy test):** `services/api-server/src/routes/process.test.ts` (L1-55) — supertest +
`vi.mock` of the upstream + temp-dir lifecycle. The exact harness to copy:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
vi.mock("../orchestrator.js", () => ({ runPipeline: vi.fn(), /* ... */ }));
import { app } from "../index.js";
```
> For the Studio proxy test, mock the api-server upstream `fetch` (not orchestrator) and assert
> the relay status/headers (range passthrough) and the `{error:{step,message}}` envelope.

**Analog (font unit test):** `services/remotion-renderer/src/captions.test.ts` (vitest unit, no
network) — the structure for `fonts.test.ts`: assert local-first resolves, the `withTimeout` race
rejects a never-resolving load within budget, and the final fallback returns `"Plus Jakarta Sans"`
and **never `"monospace"`** (RENDER-05 proof; RESEARCH Wave-0 gaps).

---

## Shared Patterns

### Authentication / origin (auto-applied)
**Source:** `services/remotion-studio/src/server.ts` L63-83 (global basic-auth middleware) + L31-34 (scoped CORS).
**Apply to:** all 3 new proxy routes — they inherit auth by sitting after the middleware. No per-route auth.
```typescript
app.use((req, res, next) => {
  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) return next();
  if (isLoopback(req.socket.remoteAddress ?? undefined)) return next();
  // Basic header parse + safeEqual(user) && safeEqual(pass) → next() | 401
});
```

### Error envelope
**Source:** `services/api-server/src/routes/process.ts` L197-204 (step failure shape).
**Apply to:** the proxy routes + the client failure-formatter (one contract end-to-end).
```typescript
res.status(500).json({ jobId, error: { step: err.stepName, exitCode: err.exitCode, message: err.errorMessage } });
```
> `GET /status` carries `error` as a STRING ("Step remotion-renderer failed (exit 137): <msg>",
> process.ts L194); `POST /process`/proxy failure carries it as a STRUCTURED object. The client
> formatter must handle BOTH (RESEARCH Code Examples / D-09).

### jobId UUID validation (path-traversal / access-control)
**Source:** `services/api-server/src/routes/status.ts` L20-24.
**Apply to:** `GET /api/status/:id` and `GET /api/result/:id` proxy routes before forwarding.

### Async tri-state + timeout-ref cleanup (UI)
**Source:** `services/remotion-studio/src/preview/PreviewApp.tsx` L300-343 (`handleSave`), L221 + L283-287 (ref cleanup).
**Apply to:** the render-submit handler AND the poll-interval lifecycle (mirror the ref-cleanup-on-unmount pattern for `setInterval`/`setTimeout`).

### delayRender / continueRender font gating
**Source:** `Root.tsx` L83-86 + `TitleOverlay.tsx` L82-122.
**Apply to:** confirm the rewritten `loadFont` still resolves/rejects so every `delayRender` handle
is released (the per-font timeout guarantees this — closes the hang path D-11).

### Design tokens (OKLCH) + green discipline
**Source:** `.claude/skills/sketch-findings-reel-factory/sources/themes/default.css` (canonical),
already inlined in `index.html` `:root` and used throughout `PreviewApp.tsx` (e.g. `var(--action)`,
`var(--accent)`, `var(--danger)`, `var(--success)`, `--s-*`, `--t-*`).
**Apply to:** all 4 inline surfaces. Green = Render CTA ONLY; Descargar = `--accent`; failure =
low-chroma `--danger`; never two greens (UI-SPEC Color + 23-UI-SPEC.md). Mandatory `impeccable`
skill + `frontend-design` plugin pass at start of any Studio plan (AGENTS.md, non-negotiable).

---

## No Analog Found

No files in this phase lack an analog. Two patterns are **new to the codebase** but built from
adjacent established primitives (noted inline, not "no analog"):

| Concern | Closest existing primitive | Note |
|---------|---------------------------|------|
| `setInterval` status poll loop | `saveTimeoutRef` lifecycle (PreviewApp L221/L283-287) | No existing repeating poll; mirror the single-shot timeout-ref cleanup discipline. |
| Streaming multipart proxy (`duplex:"half"`) | `PUT /api/config` handler shape (server.ts L153-203) | The streaming body is new; the route/error-envelope shape is the analog. |
| `@remotion/fonts` offline `loadFont({url:staticFile})` | `@remotion/google-fonts` `loadFont` (fonts.ts L121-126) | Package not yet installed; first-party, same `@remotion` org as 16 installed scoped packages. |

---

## Metadata

**Analog search scope:**
- `services/remotion-studio/src/` (server.ts, preview/, fonts.ts)
- `services/api-server/src/routes/` (process, status, artifacts, batch) + `progress.ts`, `queue.ts`, `orchestrator.ts`
- `services/remotion-renderer/src/` (fonts.ts, Root.tsx, compositions/TitleOverlay.tsx) + `Dockerfile`, `public/`
- test harnesses in all three services

**Files scanned:** 14 source/config files read in full or targeted; node_modules `@remotion/*`
inventory verified in both Node services.

**Key cross-cutting findings for the planner:**
1. Every UI primitive (async fetch tri-state, timeout-ref cleanup, token-styled status chips) and
   every backend primitive (auth, Range via sendFile, UUID validation, step-% formula, queue→jobId)
   already exists — net-new is 3 proxy routes, 4 inline UI states, and the font fallback chain.
2. **Submit-mode is the one unresolved architectural seam:** prefer the `POST /batch` queue path
   (immediate jobId → pollable, batch.ts L112+L123) over the blocking synchronous `POST /process`
   for RENDER-02 live progress. Flagged HIGH by RESEARCH Open Question 2.
3. `fonts.ts` lives in BOTH studio and renderer — the renderer-sync clobber hazard is the top
   execution risk; re-run renderer vitest after any sync.
4. Renderer Docker image MUST be rebuilt (`COPY public/`) for vendored fonts to take effect —
   include an image rebuild + gstatic-blocked render smoke test as the RENDER-05 phase gate.

**Pattern extraction date:** 2026-06-03
