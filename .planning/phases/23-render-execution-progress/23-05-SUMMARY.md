---
phase: 23-render-execution-progress
plan: "05"
subsystem: pipeline-verification/render-runtime
tags: [render-05, offline-fonts, docker-rebuild, e2e-render, gstatic-block, manual-verification, gap-closure, vendoring]
dependency_graph:
  requires: ["23-03 (offline-first font chain + vendored woff2)", "23-04 (4 inline render surfaces)"]
  provides: ["RENDER-05 empirical proof (offline render)", "renderer image rebuilt with full font catalog", "E2E render sign-off", "visual sign-off of 4 inline surfaces"]
  affects:
    - services/remotion-renderer/public/fonts/
    - services/remotion-studio/public/fonts/
    - services/remotion-renderer/src/fonts.ts
    - services/remotion-studio/src/fonts.ts
    - services/remotion-renderer/src/fonts.test.ts
    - docker-compose.yml
tech_stack:
  added: []
  patterns:
    - "Standalone renderer verification: re-run only the renderer step against a completed job's artifacts with --add-host fonts.gstatic.com:127.0.0.1 + fonts.googleapis.com:127.0.0.1 to simulate a gstatic outage"
    - "Full-catalog vendoring: download latin-subset woff2 via @remotion/google-fonts getInfo().fonts.normal[weight].latin → public/fonts/<Font>-{Regular,Bold}.woff2 (variable fonts reuse one file for both weights)"
    - "Filesystem coverage test guards offline guarantee: every AVAILABLE_FONTS entry (minus monospace) must have Regular+Bold woff2 on disk"
key_files:
  created: []
  modified:
    - services/remotion-renderer/src/fonts.ts
    - services/remotion-studio/src/fonts.ts
    - services/remotion-renderer/src/fonts.test.ts
    - services/remotion-renderer/public/fonts/ (19 fonts added → 26 total)
    - services/remotion-studio/public/fonts/ (full 26-font catalog mirrored; studio previously had none)
    - docker-compose.yml (remotion-studio restart:unless-stopped)
decisions:
  - "RENDER-05 only reliable via Tier 1 (local vendored woff2): the gstatic tier registers @font-face lazily, so a blocked fetch fails inside Chrome at frame time where loadFont's try/catch cannot see it — the bundled-sans fallback never triggers. Vendor the FULL catalog."
  - "Verify offline render by re-running the renderer step standalone against an existing job's artifacts, rather than modifying the orchestrator to inject ExtraHosts."
  - "Mirror the full font catalog into the studio too so preview is offline-first and the two fonts.ts stay in real parity."
requirements: [RENDER-01, RENDER-02, RENDER-03, RENDER-04, RENDER-05]
status: complete
---

# 23-05 — Phase-gate verifications (RENDER-05 offline proof + E2E + visual sign-off)

Closing plan for Phase 23: the verifications that cannot run in CI. Executed as a
checkpoint plan — Task 1 automated by the orchestrator, Tasks 2 & 3 human-verified.

## Task 1 — Renderer parity + image rebuild (auto) ✅
- Renderer vitest green (font chain intact, no clobber regression).
- `Dockerfile` has `COPY public/`; vendored woff2 present.
- `docker compose build remotion-renderer` succeeded; confirmed woff2 baked into the image.

## Task 2 — Real render smoke through the Studio (RENDER-01..04) ✅
- Human-verified end-to-end: upload short clip → `POST /api/render` → live `/api/status`
  polling (Spanish step name + honest %) → inline "Reel listo" with proxied play + download.
- Confirmed against the live stack on port 3123 (compose studio → api-server:3000 → orchestrator).

## Task 3 — gstatic-blocked proof (RENDER-05) + visual sign-off ✅ (with gap-closure)

**Gap found during verification:** RENDER-05 held only for the 7 originally-vendored
fonts. A config using any of the other 19 selectable fonts (e.g. Outfit, Raleway)
still fetched from gstatic; with gstatic blocked the render ABORTED with NetworkError
— the exact original bug. Root cause: the gstatic tier registers `@font-face` lazily;
the failure surfaces only inside Chrome at frame time, invisible to `loadFont`'s
try/catch, so the bundled-sans fallback never triggered.

**Gap-closure (commit `3b8883e`):**
- Vendored the FULL 26-font catalog (latin subset) into renderer + studio `public/fonts`.
- Expanded `VENDORED_FONTS` to the whole catalog in both `fonts.ts`.
- Added a filesystem coverage test (renderer now 315 tests; studio 183).
- Rebuilt the renderer + studio images.

**Empirical RENDER-05 proof (after gap-closure):** the Outfit/Raleway render that
previously aborted now COMPLETES offline (gstatic + googleapis mapped to 127.0.0.1),
producing a playable MP4 with real sans-serif fonts — non-monospace, no hang, no abort.
Extracted frames confirmed visually for both the vendored-default and the
previously-failing Outfit/Raleway config.

**Visual sign-off:** the four inline surfaces (upload dropzone, live progress, inline
success, inline failure) approved by the user against 23-UI-SPEC.md + sketch grammar.

## Follow-up captured
- Backlog todo `2026-06-04-dynamic-google-font-management.md` + memory
  `font-vendoring-vs-dynamic-management`: future phase to add/remove Google Fonts
  dynamically instead of hand-vendoring.

## Self-Check: PASSED
- Renderer image rebuilt with vendored fonts; font tests green; parity intact.
- E2E Studio render works (upload → live progress → inline play + download).
- RENDER-05 proven against a real gstatic block (non-monospace, no hang) — for ALL fonts.
- The four inline surfaces meet the project visual quality bar.
