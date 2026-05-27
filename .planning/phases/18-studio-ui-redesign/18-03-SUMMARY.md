---
phase: 18-studio-ui-redesign
plan: "03"
subsystem: ui
tags: [react, typescript, remotion-studio, routing, express, refactor]

# Dependency graph
requires:
  - 18-01  # TitleEditor 2-prop interface (D-10 gate)
provides:
  - "Single canonical route / → PreviewApp (StudioApp)"
  - "301 redirects for /editor, /preview, /preview/fonts"
  - "server.ts serves SPA at / with API routes protected before static middleware"
affects:
  - 18-02  # parallel plan — completes the routing half of STUDIO-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Express static middleware at / serves all SPA assets; API routes registered first (T-18-03-01)"
    - "React Router BrowserRouter with single / route + * catch-all Navigate"
    - "301 permanent redirects from legacy routes to canonical /"

key-files:
  created: []
  modified:
    - services/remotion-studio/src/editor/App.tsx
    - services/remotion-studio/src/server.ts
  deleted:
    - services/remotion-studio/src/editor/EditorApp.tsx

key-decisions:
  - "Used 301 (permanent) not 302 for /editor and /preview redirects — these routes are gone forever, permanent redirect is correct and allows browsers/bookmarks to update"
  - "Kept app.use('/') before redirect routes: Express static serves assets files first, falls through to explicit app.get routes if no file match"

patterns-established:
  - "Single-screen SPA: no client-side route switching needed — React Router reduces to / + * catch-all"

requirements-completed:
  - STUDIO-01
  - STUDIO-02
  - STUDIO-03

# Metrics
duration: 15min
completed: 2026-05-27
---

# Phase 18 Plan 03: Routing Collapse and Server Update Summary

**App.tsx collapsed to single canonical route (/ → PreviewApp); EditorApp.tsx deleted; server.ts serves unified StudioApp at / with 301 redirects for all legacy routes**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-27T20:30:00Z
- **Completed:** 2026-05-27T20:45:00Z
- **Tasks:** 2 auto + 1 checkpoint (pending human verification)
- **Files modified:** 2
- **Files deleted:** 1

## Accomplishments

- App.tsx: 6 routes collapsed to 2 (path=/ → PreviewApp, path=* → Navigate to /)
- Removed imports: EditorApp, FontGridPage (no longer routes in the SPA)
- EditorApp.tsx deleted — fully absorbed by unified PreviewApp (StudioApp) built in plan 18-02
- server.ts: replaced /editor static block with unified / static serving
- 6 x 301 redirects: /editor, /editor/, /editor/*, /preview, /preview/, /preview/*
- SPA catch-all: app.get("/{*splat}", serveSpa) handles client-side routing
- API routes (/api/config, /api/render, etc.) verified at lines 96-203, before static middleware at line 233 — T-18-03-01 satisfied
- Verified via curl on test port 3124: / → 200 OK HTML, /editor → 301 /, /preview → 301 /, /preview/fonts → 301 /, /api/health → JSON
- npm run build:editor exits 0

## Task Commits

1. **Task 1: Collapse App.tsx to single route, delete EditorApp.tsx** - `ed65b8a` (feat)
2. **Task 2: Update server.ts to serve SPA at / with 301 redirects** - `23ad755` (feat)

## Files Created/Modified

- `services/remotion-studio/src/editor/App.tsx` — Single BrowserRouter with path=/ element=PreviewApp, path=* Navigate to /. Removed EditorApp and FontGridPage imports.
- `services/remotion-studio/src/editor/EditorApp.tsx` — DELETED. Was the old editor screen; absorbed by PreviewApp (StudioApp) in plan 18-02.
- `services/remotion-studio/src/server.ts` — Replaced /editor static + SPA block with: app.use("/" static), app.get("/" serveSpa), 6 x 301 redirects, app.get("/{*splat}" serveSpa).

## Decisions Made

- Used HTTP 301 (Moved Permanently) for /editor and /preview redirects. These routes are permanently retired — 301 is semantically correct and allows caches/browsers to update bookmarks.
- Kept `app.use("/", express.static(EDITOR_DIST))` before the explicit `app.get("/", serveSpa)` — Express static middleware calls `next()` when no file matches, so the explicit SPA handler correctly catches `/` when no file exists at that path.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is purely routing/server infrastructure; no UI stubs.

## Threat Flags

None — no new network surface introduced. Existing API routes remain unchanged. Static middleware registered after API routes per T-18-03-01.

## Checkpoint: Awaiting Human Verification

This plan ends with a `checkpoint:human-verify` gate. The server must be started from the
worktree before verifying:

```bash
WT_ROOT="/home/luis/proyectos/reel-factory/.claude/worktrees/agent-aa7e90accf7669360"
cd "$WT_ROOT/services/remotion-studio"
setsid env PORT=3123 \
    EDITOR_DIST=$(pwd)/dist/editor \
    ACTIVE_PIPELINE_CONFIG_PATH=$(pwd)/../../pipeline/pipeline-config.json \
    npx tsx src/server.ts > /tmp/remotion-server.log 2>&1 &
```

Then verify all 11 checks in the plan's checkpoint section.

## Issues Encountered

- Worktree does not have `node_modules` pre-installed — ran `npm ci` before building. This is expected for fresh worktrees.
- An existing studio server was already running on port 3123 — verified routing behavior on port 3124 instead. The human-verify checkpoint will run on the canonical port 3123 after the user starts the server.

## Self-Check: PASSED

- `services/remotion-studio/src/editor/App.tsx` — FOUND and modified
- `services/remotion-studio/src/server.ts` — FOUND and modified
- `services/remotion-studio/src/editor/EditorApp.tsx` — CONFIRMED deleted
- Commit `ed65b8a` — FOUND
- Commit `23ad755` — FOUND
- Build exits 0 — VERIFIED
- Redirect behavior via curl — VERIFIED

---
*Phase: 18-studio-ui-redesign*
*Completed: 2026-05-27*
