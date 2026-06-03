---
phase: 23-render-execution-progress
plan: 03
subsystem: infra
tags: [remotion, fonts, font-resilience, offline, woff2, docker, vitest]

requires:
  - phase: 23-01
    provides: test harness + mapping layer for Phase 23

provides:
  - "loadFont offline-first chain: local woff2 (@remotion/fonts) → gstatic-retry → bundled Plus Jakarta Sans; every attempt wrapped in 10s withTimeout"
  - "VENDORED_FONTS set (7 fonts + bundled-sans guarantee) in renderer/public/fonts/*.woff2"
  - "Renderer Dockerfile COPY public/ so vendored woff2 ships in the image"
  - "fonts.test.ts (10 unit tests): local-first, timeout race, never-monospace D-12 proof"
  - "Clobber-hazard parity: identical loadFont in both studio + renderer fonts.ts"

affects: [23-05, remotion-renderer, remotion-studio]

tech-stack:
  added:
    - "@remotion/fonts@4.0.457 (exact pin) — offline loadFont({family, url: staticFile(), weight})"
  patterns:
    - "Three-tier font resilience: local staticFile → gstatic with 2 retries → BUNDLED_SANS"
    - "withTimeout<T>(p, ms) Promise.race helper — closes the hang path on any async font load"
    - "VENDORED_FONTS set: vendor mandatory D-12 fonts + top-8; rest fall through to gstatic"
    - "Variable fonts: same woff2 file used for both Regular + Bold (latin subset)"

key-files:
  created:
    - "services/remotion-renderer/src/fonts.test.ts — RENDER-05 unit proofs (10 tests)"
    - "services/remotion-renderer/public/fonts/ — 14 woff2 files (428KB, 7 fonts × 2 weights)"
  modified:
    - "services/remotion-renderer/src/fonts.ts — rewritten: offline-first chain, withTimeout, BUNDLED_SANS"
    - "services/remotion-studio/src/fonts.ts — identical rewrite (clobber-hazard parity)"
    - "services/remotion-renderer/Dockerfile — added COPY public/ public/"
    - "services/remotion-renderer/package.json — @remotion/fonts@4.0.457 pinned"
    - "services/remotion-studio/package.json — @remotion/fonts@4.0.457 pinned"

key-decisions:
  - "D-10 (local-first): @remotion/fonts staticFile() is the primary tier — no network, deterministic"
  - "D-11 (timeout): PER_FONT_TIMEOUT_MS=10_000ms per attempt via withTimeout race"
  - "D-12 (never-monospace): BUNDLED_SANS='Plus Jakarta Sans' is the only fallback, caught in loadBundledSans()"
  - "Variable font strategy: same woff2 serves multiple weights — validated by the gstatic metadata"
  - "VENDORED_FONTS set (7): PlusJakartaSans, Inter, Montserrat, Poppins, Oswald, BebasNeue, Roboto — D-12 guaranteed + top-8"
  - "Gstatic tier uses subsets=['latin','latin-ext'] — socket-pool exhaustion guard preserved from original"
  - "Image rebuild deferred to Plan 05 — this plan makes the Dockerfile correct; verification is Plan 05's gate"

patterns-established:
  - "withTimeout<T>(p, ms): Promise.race([p, new Promise((_, r) => setTimeout(() => r(...), ms))]) — reuse for any bounded async"
  - "VENDORED_FONTS set guards the local tier — avoids attempting staticFile() for fonts with no woff2"
  - "loadBundledSans() is extracted as a separate function — both unknown-font and all-fail paths converge"

requirements-completed: [RENDER-05]

duration: 18min
completed: 2026-06-03
---

# Phase 23 Plan 03: Font Resilience Summary

**Three-tier offline-first font loading chain: local woff2 via @remotion/fonts + staticFile → gstatic-retry (2 attempts, 10s timeout each) → Plus Jakarta Sans bundled-sans fallback; never monospace; clobber-hazard-safe mirror in both services; Dockerfile bakes in the 428KB vendored font set**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-03T22:30:00Z
- **Completed:** 2026-06-03T22:38:00Z
- **Tasks:** 2
- **Files modified:** 7 + 14 new woff2 assets

## Accomplishments

- Rewrote `loadFont` in both `remotion-renderer/src/fonts.ts` and `remotion-studio/src/fonts.ts` to the offline-first three-tier chain — closes RENDER-05 (the highest-risk item in Phase 23)
- Vendored 14 woff2 files (7 fonts × Regular+Bold, 428KB total, latin subset only) into `renderer/public/fonts/`
- Wrote 10 unit tests in `fonts.test.ts` covering: local-first success, unknown-font branch, catch branch, timeout race, D-12 never-monospace proofs — 314/314 renderer tests green
- Added `COPY public/ public/` to renderer Dockerfile so the vendored assets ship in the rebuilt image (actual rebuild is Plan 05's gate)
- Pinned `@remotion/fonts@4.0.457` (exact, not `^`) in both services to match `remotion@4.0.457` (AGENTS.md Version Compatibility rule)

## Task Commits

TDD task had three commits per protocol:

1. **RED** — `134e04d` `test(23-03): add failing RENDER-05 font-resilience unit tests (RED)`
2. **GREEN** — `d01a5b1` `feat(23-03): implement RENDER-05 offline-first font loading chain (GREEN)`
3. **Task 2** — `cc91d9a` `feat(23-03): bake vendored fonts into renderer image via COPY public/`

_No REFACTOR commit needed — implementation was clean on first pass._

## Files Created/Modified

- `services/remotion-renderer/src/fonts.ts` — Rewritten: local-first chain, withTimeout, BUNDLED_SANS="Plus Jakarta Sans"
- `services/remotion-studio/src/fonts.ts` — Identical rewrite (clobber-hazard parity)
- `services/remotion-renderer/src/fonts.test.ts` — 10 unit tests (new file)
- `services/remotion-renderer/public/fonts/` — 14 woff2 files: PlusJakartaSans, Inter, Montserrat, Poppins, Oswald, BebasNeue, Roboto (Regular + Bold each)
- `services/remotion-renderer/Dockerfile` — Added `COPY public/ public/` line 12
- `services/remotion-renderer/package.json` — `@remotion/fonts@4.0.457` (pinned exact)
- `services/remotion-studio/package.json` — `@remotion/fonts@4.0.457` (pinned exact)

## Decisions Made

- **Variable font handling:** Several fonts (PlusJakartaSans, Inter, Montserrat, Oswald, BebasNeue, Roboto) use the same woff2 file for multiple weights because they are variable fonts. Strategy: copy the same file to both `{Font}-Regular.woff2` and `{Font}-Bold.woff2` — the `@remotion/fonts` `loadFont` registers them as two `@font-face` rules pointing to the same source, which is valid and how variable fonts work in CSS.
- **VENDORED_FONTS set:** Vendoring all 26 fonts would add ~2-3MB to the image. The plan's RESEARCH Open Question 1 resolved this as: vendor the D-12 guarantee fonts (PlusJakartaSans + Inter) plus top-8 most-used; the rest fall through to gstatic. Implemented exactly that — 7 fonts vendored.
- **`loadBundledSans()` extraction:** Both the unknown-font and the all-fail paths converge on the same "load Plus Jakarta Sans + return BUNDLED_SANS" logic. Extracted into a private function to avoid code duplication and ensure both paths behave identically.
- **Dockerfile `mkdir` removal:** The original `RUN mkdir -p /app/public && chmod ...` line created an empty directory. After `COPY public/ public/`, the directory already exists with contents, so `mkdir -p` is a no-op. Changed to just `chmod -R 777 /app/public && chmod 777 /app` — same permissions, no wipe risk.

## Deviations from Plan

None — plan executed exactly as written.

The test design required one small insight not explicit in the plan: to fully unit-test the "local AND gstatic both fail → BUNDLED_SANS" case, `@remotion/google-fonts/*` modules needed to be mocked as well (not just `@remotion/fonts`). The tests mock all 26 gstatic loaders via `vi.mock()` to give deterministic control over each tier. This is standard test isolation practice, not a deviation.

## Issues Encountered

None. The `@remotion/fonts` package was installed correctly at 4.0.457 and its `loadFont` API matched the documented `{ family, url, weight }` signature.

## User Setup Required

None — no external service configuration required. The image rebuild (which makes the vendored fonts take effect at render time) is the Plan 05 smoke gate; it's an infrastructure step that requires Docker, not a user credential/config step.

## Next Phase Readiness

- Font resilience (RENDER-05) is code-complete and unit-tested
- Renderer vitest: 314/314 green
- Dockerfile is correct for the next image rebuild
- The actual RENDER-05 smoke proof (gstatic-blocked render still completes) is Plan 05's gate
- No blockers for Plan 04 (studio proxy routes) or Plan 05 (smoke test / verification)

---
*Phase: 23-render-execution-progress*
*Completed: 2026-06-03*
