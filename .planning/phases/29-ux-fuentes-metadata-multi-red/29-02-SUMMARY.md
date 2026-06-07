---
phase: 29-ux-fuentes-metadata-multi-red
plan: 02
subsystem: remotion-studio (server + preview UI)
tags: [metadata, batch-endpoint, tabs, multi-platform, META-05, META-06]
requires:
  - services/remotion-studio/src/metadata.ts (PLATFORMS, TONES, generateMetadata)
  - services/remotion-studio/src/server.ts (routerChatClient, getPipelineDataDir, atomicWriteJobFile, JOB_ID_REGEX, getMetadataModel)
provides:
  - POST /api/metadata/all batch endpoint (per-platform results map, partial-failure tolerant)
  - GET /api/metadata-all/:jobId restore endpoint (per-platform persisted results)
  - MetadataPanel with generate-all action + per-platform tab strip
affects:
  - col3 AI metadata column in PreviewApp (consumed via unchanged MetadataPanel jobId prop)
tech-stack:
  added: []
  patterns:
    - "Sequential per-platform generation (router is bottleneck, worker concurrency = 1)"
    - "Per-platform editable buffers keyed by Platform (Record<Platform, EditBuffer>)"
    - "Tab strip mirrors PreviewApp TabButton --accent underline idiom (role=tab/tablist/aria-selected)"
key-files:
  created: []
  modified:
    - services/remotion-studio/src/server.ts
    - services/remotion-studio/src/metadata-api.test.ts
    - services/remotion-studio/src/preview/MetadataPanel.tsx
    - services/remotion-studio/src/preview/metadata-panel.test.tsx
decisions:
  - "Batch via server endpoint (POST /api/metadata/all) NOT client Promise.all — keeps router calls sequential server-side, honors single-bottleneck rule, returns one atomic response with results+errors maps."
  - "Partial failure returns 200 with survivors in `results` and failures in `errors`; all-failed maps first error to single-endpoint status scheme (503/502/422/500)."
  - "Per-platform persistence as {jobId}/metadata-{platform}.json (alongside the legacy {jobId}/metadata.json from the single endpoint, which is left untouched)."
  - "Added GET /api/metadata-all/:jobId (always 200, possibly empty results) so the panel restores per-platform results on mount without treating 'nothing yet' as an error."
metrics:
  duration: ~8m
  tasks_completed: 3
  files_modified: 4
  completed: 2026-06-07
---

# Phase 29 Plan 02: Metadata multi-red (batch endpoint + per-platform tabs) Summary

One click ("Generar metadata (todas las redes)") generates metadata for all 3 platforms via a server-side batch endpoint that tolerates per-platform failure, and the platform dropdown is replaced by an `--accent`-underlined tab strip where each tab carries its own editable title/description/hashtags + copy.

## What was built

**META-05 — batch generation (server):**
- `POST /api/metadata/all { jobId, tone }` validates jobId (JOB_ID_REGEX) and tone (TONES allowlist), reads the transcript once, then loops `Object.keys(PLATFORMS)` **sequentially** calling `generateMetadata({..., client: routerChatClient })`.
- Successes collected into `results`, failures into `errors` (message strings). One platform failing does NOT 500 the request — partial success returns `200 { results, errors?, _meta: { model } }`.
- Each success persisted atomically to `{jobId}/metadata-{platform}.json`.
- All-failed maps the FIRST captured error to a status mirroring the single endpoint (`RouterNotConfigured→503`, `RouterError→502`, `EmptyTranscript→422`, `MetadataValidation→502`, `Timeout→502`, else 500).
- `GET /api/metadata-all/:jobId` reads every persisted per-platform file, returns `200 { results }` (empty map if none) for graceful restore.

**META-06 — per-platform tabs (UI):**
- `MetadataPanel` primary action is now "Generar metadata (todas las redes)" (→ "↻ Regenerar (todas)" once results exist), POSTing `{ jobId, tone }` (no platform) to `/api/metadata/all`.
- Platform `<select>` removed; a `role="tablist"` strip renders one `role="tab"` per platform with `aria-selected`, active tab styled `borderBottom: 2px solid var(--accent)` + `--accent` text (PreviewApp TabButton idiom).
- Per-platform edit buffers (`Record<Platform, EditBuffer>`) — switching tabs is pure UI (no fetch); edits to one platform never bleed into another.
- A failed platform's tab shows an inline `--danger` line (+ a `!` marker on the tab); successful tabs render fields normally.
- Tone stays a single `<select>` applied to all. Restore on mount via `GET /api/metadata-all/:jobId`.

## Batch approach used

**Server endpoint, sequential loop** (not client `Promise.all`). Chosen because the local-llms router is the bottleneck and the project's worker-concurrency rule is 1; sequential server-side calls avoid hammering the router and let the client get one atomic response carrying both `results` and `errors`.

## Verification

- `npx vitest run src/metadata-api.test.ts` — 23 passed (16 existing + 7 new: all-ok, persistence, partial-failure, bad-tone 400, missing-transcript 404, all-failed 503).
- `npx vitest run src/preview/metadata-panel.test.tsx` — 25 passed (generate-all POST, 3 tabs, active-tab fields, tab switch shows other platform, no-fetch-on-switch, no-bleed edits, one select, aria-selected, partial-failure per-tab error, copy, restore, green discipline ×2).
- `npm run build:editor` — succeeded (pre-existing chunk-size / "use client" warnings only).
- `npx vitest run` (full studio suite) — **514 passed / 26 files** (baseline ≥506).
- Scope guard: `git diff --name-only base..HEAD` lists only the 4 plan files; **PreviewApp.tsx untouched**, renderer untouched.
- Acceptance greps: `metadata/all` in MetadataPanel = 3; exactly one `<select` element (Tono); no `--action` token in rendered inline styles.

## TDD Gate Compliance

Both tasks followed RED→GREEN:
- Server: 7 new supertest cases failed (404 SPA catch-all) → endpoint added → 23 green.
- Panel: 14 cases failed against the old dropdown panel → rework → 25 green.

## Deviations from Plan

### Auto-fixed / additions (Rule 2/3 — critical for the plan's restore behavior)

**1. [Rule 2 - Missing critical functionality] Added `GET /api/metadata-all/:jobId` restore endpoint**
- **Found during:** Task 3 (panel restore-on-mount).
- **Why:** The plan's behavior spec says "restore persisted per-platform results … preferred: restore what exists." The single `GET /api/metadata/:jobId` only serves the legacy combined file, not the new per-platform files. A dedicated batch-GET was the cleanest way to restore the tabbed state without crashing when nothing is persisted.
- **What:** Always-200 endpoint reading each `{jobId}/metadata-{platform}.json`, returning `{ results }`.
- **Files:** services/remotion-studio/src/server.ts
- **Commit:** 188c1d9 (bundled with the batch endpoint, since both are server-side and tested together)

**2. [Rule 3 - Blocking] Added `import type { Metadata }` to server.ts**
- The batch handler types `results: Record<string, Metadata>`; the type was not previously imported.
- **Commit:** 188c1d9

### Environment

- Worktree lacked `node_modules`; symlinked from the main checkout (no installs), per plan GATE. The symlinks are untracked (the `node_modules/` gitignore pattern has a trailing slash so it does not match symlinks) — staged files individually so they were never committed.

## Known Stubs

None. The legacy single `{jobId}/metadata.json` and `POST /api/metadata` endpoint are intentionally left intact (untouched, still tested) — they are not stubs, just unused by the new batch flow.

## Manual UAT (USER follow-up — NOT performed by executor)

`docker compose build remotion-studio && docker compose up -d remotion-studio`, run a render to get a jobId, open the metadata column: one "Generar metadata (todas las redes)" click should populate all 3 tabs; switching tabs shows each network's editable fields + copy.

## Self-Check: PASSED
- All 4 modified files exist on disk.
- Commits 188c1d9 and 24d88c7 exist in git history.
