---
phase: 24-named-config-profiles
plan: "01"
subsystem: remotion-studio/profiles-core
tags: [profiles, pure-module, vitest, atomic-write, path-traversal, typescript]
dependency_graph:
  requires: [pipeline-config.ts]
  provides: [profiles.ts, profiles.test.ts]
  affects: [24-02-server-routes, 24-03-ui]
tech_stack:
  added: []
  patterns: [atomic-write-temp-rename, injected-dir-testability, typed-error-classes]
key_files:
  created:
    - services/remotion-studio/src/profiles.ts
    - services/remotion-studio/src/profiles.test.ts
  modified: []
decisions:
  - "D-04 atomic writes: temp file + fs.renameSync mirrors server.ts PUT /api/config protocol"
  - "D-06 injected dir: dir is always a parameter — no globals, no Express, fully unit-testable"
  - "D-03 slug validation: isValidSlug rejects . / \\ characters — path-traversal guard at every entry point"
  - "ProfileConflictError + ProfileValidationError typed classes: server layer maps to 409/400 without string parsing"
metrics:
  duration: "~3 minutes"
  completed: "2026-06-04"
  tasks_completed: 2
  files_created: 2
  tests_passing: 45
---

# Phase 24 Plan 01: Profiles Core Module Summary

Pure, framework-free `profiles.ts` with slugify + path-traversal-safe CRUD over an injected directory, fully proven by 45 vitest unit tests including atomicity smoke, sort-order, and conflict detection.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | profiles.ts pure core module | a3147cb | services/remotion-studio/src/profiles.ts |
| 2 | profiles.test.ts unit proofs | 914f2eb | services/remotion-studio/src/profiles.test.ts |

## What Was Built

### profiles.ts

Framework-free TypeScript module (no Express, no globals) exporting:

- **Types:** `ProfileSummary`, `ProfileFile`, `ProfileConflictError`, `ProfileValidationError`
- **Slug utilities:** `slugify(name)` — NFD normalize, lowercase, strip to `[a-z0-9_-]`, collapse, cap 64 chars; `isValidSlug(slug)` — `^[a-z0-9][a-z0-9_-]*$` with no `.`/`/`/`\` guard (D-03); `validateProfileName(name)`
- **Path guard:** `profilePath(dir, slug)` — throws `ProfileValidationError` on invalid slug; callers cannot traverse outside `dir`
- **CRUD:** `listProfiles`, `readProfile`, `saveProfile`, `renameProfile`, `removeProfile` — all take `dir` as a parameter (D-06)
- **Atomic writes:** private `atomicWrite()` using `.{basename}.{pid}.{ts}.tmp.json` + `fs.renameSync` (D-04)
- **Validation on read:** `listProfiles` calls `validatePipelineConfig()` per file; skips malformed with `console.warn` (D-07)
- **Sort:** `listProfiles` returns summaries sorted by `updatedAt` desc (D-11)
- **Conflict guard:** `renameProfile` throws `ProfileConflictError` when target slug already exists (PROFILE-03)

`PipelineConfig` is imported from `./pipeline-config.js` — not redefined.

### profiles.test.ts

45 vitest tests using real `mkdtemp` temp dirs (cleaned in `afterEach`). Coverage:

- `slugify`: spaces, accents, emoji, collapse, trim, length-cap, empty sentinel
- `isValidSlug` / `profilePath`: path-traversal guards (`../evil`, `a/b`, `a.json`, `..`, ``, backslash, uppercase)
- `validateProfileName`: empty, blank, too-long, empty-slug edge cases
- `saveProfile→listProfiles→readProfile`: round-trip with schema-valid `PipelineConfig` fixture (subtitle + title + overlay)
- Double-save = update: one file, newer `updatedAt`
- `listProfiles`: sorts by `updatedAt` desc; skips malformed JSON and wrong-shape JSON without throwing
- `renameProfile`: old file gone, new file present; `ProfileConflictError` on collision; same-slug name-update
- `removeProfile`: `true` when existed, `false` when absent; `ProfileValidationError` on invalid slug
- Atomicity smoke: no leftover `.tmp` files after `saveProfile` or `renameProfile`

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vitest run src/profiles.test.ts`: **45 tests passing (1 file)**
- `npx tsc --noEmit -p tsconfig.json`: **no profiles type errors**
- `grep -E "express|require\(|global\."` profiles.ts: **CLEAN** — no Express/global imports

## Known Stubs

None. This is a pure logic module with no UI rendering.

## Threat Flags

None — this module has no network endpoints, no file access outside the injected `dir`, and all slug inputs are validated before path construction.

## Self-Check: PASSED

- `services/remotion-studio/src/profiles.ts`: FOUND
- `services/remotion-studio/src/profiles.test.ts`: FOUND
- Commit a3147cb: FOUND
- Commit 914f2eb: FOUND
