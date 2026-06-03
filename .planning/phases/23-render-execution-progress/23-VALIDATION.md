---
phase: 23
slug: render-execution-progress
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `23-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (remotion-renderer + remotion-studio); api-server has existing route tests |
| **Config file** | `services/remotion-renderer/vitest.config.ts` (exists); studio vitest config (add if absent — Wave 0) |
| **Quick run command** | `cd services/<touched-service> && npx vitest run` |
| **Full suite command** | per-service `npx vitest run` + a render smoke test (real `POST /process` on a short clip) |
| **Estimated runtime** | ~30–60s unit/integration; render smoke is minutes (manual/phase-gate only) |

---

## Sampling Rate

- **After every task commit:** Run `cd services/<service> && npx vitest run` for the touched service.
- **After every plan wave:** renderer + studio vitest + api-server route tests.
- **Before `/gsd:verify-work`:** A real render smoke test — `POST /process` on a short clip — green, AND a gstatic-blocked render that still completes with a **non-monospace** font (the RENDER-05 proof).
- **Max feedback latency:** < 60 seconds (unit/integration); render smoke is a phase gate, not per-task.

---

## Per-Task Verification Map

| Req ID | Behavior | Wave | Test Type | Automated Command | File Exists |
|--------|----------|------|-----------|-------------------|-------------|
| RENDER-01 | `POST /api/render` proxies a multipart upload to api-server and returns a jobId (not 501) | 0 | integration | `npx vitest run` (studio, mock upstream) | ❌ W0 |
| RENDER-02 | `GET /api/status/:id` relays upstream `{status,currentStep,progress}`; client maps currentStep→Spanish label + honest % | 0 | unit + integration | `npx vitest run` (status-map unit; proxy relay) | ❌ W0 |
| RENDER-03 | On `status:"failed"` with `exitCode:137`, the cause line renders `remotion-renderer · exit 137 — sin memoria` | 0 | unit | `npx vitest run` (causeLine fn) | ❌ W0 |
| RENDER-03 | On `status:"completed"`, success surface shows; on failure, danger surface shows | 0 | component | studio vitest / RTL | ❌ W0 |
| RENDER-04 | `GET /api/result/:id` proxies the finished MP4 with Range headers; `<video>` plays + download works | 0 | integration | `npx vitest run` (range header passthrough) | ❌ W0 |
| RENDER-05 | A simulated gstatic failure still completes a render via vendored font; NEVER monospace | 0 | integration / render smoke | font-fallback unit + a render with gstatic blocked | ❌ W0 |
| RENDER-05 | A per-font load that never resolves is bounded by the 10s timeout (no hang) | 0 | unit | `npx vitest run` (withTimeout race) | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/remotion-renderer/src/fonts.test.ts` — covers RENDER-05 (local-first, timeout race, bundled-sans fallback, NEVER monospace)
- [ ] `services/remotion-studio/src/server.test.ts` (or proxy test) — covers RENDER-01/02/04 (proxy relay, range headers, status passthrough) with a mocked api-server
- [ ] A `causeLine` / step-label unit test — covers RENDER-02/03 mapping (currentStep→Spanish label, exitCode→cause line)
- [ ] Vendored woff2 fixtures in `services/remotion-renderer/public/fonts/` for the font tests to resolve `staticFile()`
- [ ] (If absent) studio vitest config — Wave 0 installs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real render smoke: short clip end-to-end through `POST /process` lands a playable 9:16 in the Studio | RENDER-01..04 | Full Docker pipeline (whisper→…→quality-finalizer) is minutes-long, needs GPU/containers up | Bring up compose; upload a short MP4 in the Studio (port 3123); watch step progress; confirm inline "Reel listo" plays + downloads |
| gstatic-blocked render still completes with non-monospace font | RENDER-05 | Requires network manipulation (`--add-host fonts.gstatic.com:127.0.0.1` or offline net) against a real render | Block gstatic, run a render, confirm completion + visually confirm the title font is the bundled sans (not monospace) |
| `impeccable` + `frontend-design` visual pass on every touched Studio surface | RENDER-02/03/04 (UI) | Subjective visual quality bar (AGENTS.md non-negotiable) | Run impeccable + frontend-design at execute start; review progress/result/failure surfaces against sketch grammar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
