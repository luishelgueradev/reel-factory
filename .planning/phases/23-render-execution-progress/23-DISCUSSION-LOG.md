# Phase 23: Render execution + progress - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 23-render-execution-progress
**Areas discussed:** Input video source, Progress surface + resolution, Completion & finished-video access, Font-load resilience

---

## Input video source

| Option | Description | Selected |
|--------|-------------|----------|
| Drop/upload in Studio | User drops/picks an MP4; POSTed to /process as multipart. Self-contained, matches API + sketch-017 dropzone. | ✓ |
| Server-side bound video | Reuse INPUT_PATH / a job the Studio is opened against. Needs new binding plumbing. | |
| Both / either | Upload primary + accept pre-bound video. More surface area. | |

**User's choice:** Drop/upload in Studio.

### Follow-up — Preview background

| Option | Description | Selected |
|--------|-------------|----------|
| Preview on real video | Uploaded MP4 becomes the preview background (WYSIWYG). | ✓ |
| Keep sample bg | Upload held for render only; preview stays sample. | |
| You decide | Defer to design pass. | |

**User's choice:** Preview on real video.
**Notes:** Real synced subtitles only exist at render (no transcript pre-render); preview = real frames + specimen caption timing.

### Follow-up — Upload route

| Option | Description | Selected |
|--------|-------------|----------|
| Proxy through Studio | Browser → Studio /api/render → api-server:3000/process; one origin, basic-auth, api-server internal. | ✓ |
| Browser → api-server directly | Requires exposing/CORS-ing api-server. | |
| You decide | Defer routing. | |

**User's choice:** Proxy through Studio.

---

## Progress surface + resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on dimmed stage | Preview dims, progress shown in place (010-A/031-A); no modal. | ✓ |
| Dedicated progress panel | Progress in a side panel. | |
| You decide | Defer placement. | |

**User's choice:** Inline on dimmed stage.

### Follow-up — Progress %

| Option | Description | Selected |
|--------|-------------|----------|
| Step label + honest bar | Step name + raw step-based %; dwell on render step accepted; no backend change. | ✓ |
| Add frame-level render progress | Remotion onProgress → status; needs backend work. | |
| Indeterminate during render | Spinner during render step. | |

**User's choice:** Step label + honest bar.

---

## Completion & finished-video access

| Option | Description | Selected |
|--------|-------------|----------|
| Inline result on stage | Dimmed stage resolves to "Reel listo" inline (play + download + re-render). | ✓ |
| Full-screen takeover (024-B) | Dedicated results screen; bigger surface, overlaps Phase 25/26. | |
| You decide | Defer. | |

**User's choice:** Inline result on stage.

### Follow-up — Get video

| Option | Description | Selected |
|--------|-------------|----------|
| Preview + download, proxied | Inline play + download, both via Studio origin; download = accent. | ✓ |
| Download link only | No inline playback. | |
| You decide | Defer. | |

**User's choice:** Preview + download, proxied.

### Follow-up — Resultados library

| Option | Description | Selected |
|--------|-------------|----------|
| Defer — out of scope | Phase 23 ships only the single just-rendered result; library needs the rail shell (033). | ✓ |
| Include minimal history | Lightweight recent-renders list now; expands scope. | |

**User's choice:** Defer — out of scope.

### Follow-up — Failure UI

| Option | Description | Selected |
|--------|-------------|----------|
| Inline, plain + cause line | Low-chroma red (040-A); plain reason + mono/muted cause (step + exitCode/signal) + Reintentar; OOM named. | ✓ |
| Plain message only | Hide technical step/exitCode. | |
| You decide | Defer detail. | |

**User's choice:** Inline, plain + cause line.

---

## Font-load resilience

| Option | Description | Selected |
|--------|-------------|----------|
| Offline-bundle + retry fallback | Vendor fonts into renderer image (primary) + gstatic retry/timeout (fallback). Deterministic; fixes silent-monospace. | ✓ |
| Retry + timeout only | Keep gstatic; add per-font timeout + retry; still network-dependent. | |
| Offline-bundle only | Local fonts only, no gstatic; new font = rebuild. | |

**User's choice:** Offline-bundle + retry fallback.

### Follow-up — Fallback font

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled default sans | Fall back to Plus Jakarta Sans / Inter — never monospace. | ✓ |
| Keep monospace fallback | Current behavior; visually jarring. | |

**User's choice:** Bundled default sans.

### Follow-up — Hang guard

| Option | Description | Selected |
|--------|-------------|----------|
| Per-font timeout required | ~10s race per load; timeout → fallback, render continues. Closes the hang path. | ✓ |
| No hard timeout | Rely on retry/bundle alone. | |

**User's choice:** Per-font timeout required.

---

## Claude's Discretion

- Polling cadence, retry count/backoff curve, per-font timeout value.
- Exact placement/motion/copy of inline progress/result/failure states (within sketch grammar + impeccable pass).
- Upload affordance shape (stage dropzone vs picker).
- Proxy route naming.

## Deferred Ideas

- Resultados persistent library/history (sketch 038) — needs rail nav-shell (033); later phase.
- Full-screen results takeover (024-B) — Phase 25/26.
- Frame-level render progress — deferred (chose honest step-based bar).
- Background/toast notifications + Cola badge (sketch 035) — batch/queue phase.
- Reviewed-not-folded todo: `2026-05-30-full-studio-ui-polish-with-impeccable-skill.md` (tagged resolves_phase 26).
