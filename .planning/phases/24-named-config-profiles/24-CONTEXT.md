---
phase: 24-named-config-profiles
mode: autonomous
generated_by: orchestrator (unattended run — discuss auto-generated from ROADMAP + codebase map)
date: 2026-06-04
requirements: [PROFILE-01, PROFILE-02, PROFILE-03, PROFILE-04]
---

# Phase 24 — Named config profiles · Context

## Goal (from ROADMAP)
Users can save and reload named style configurations — switching between project styles is a click, not a manual file operation.

## Success criteria
1. Save the current Studio config under a chosen name — appears in the list immediately. (PROFILE-01)
2. Selecting a saved profile restores its full config into the Studio (subtitle, titles, overlays). (PROFILE-02)
3. Rename and delete profiles from the list — changes persist and reflect immediately. (PROFILE-03)
4. Saved profiles survive `docker compose build` + recreate — same guarantee as the active config (Phase 17). (PROFILE-04)

## Implementation Decisions (D-NN)

- **D-01 — Storage location = the active-config bind mount.** Profiles are JSON files under `dirname(ACTIVE_PIPELINE_CONFIG_PATH)/profiles/` → on the host that is `./pipeline/profiles/`, already bind-mounted to `/data/pipeline` in docker-compose (`x-pipeline-common`). This is what makes PROFILE-04 true by construction — the same mechanism that persists `pipeline/pipeline-config.json` (Phase 17). NEVER store profiles inside the image (`/app`).
- **D-02 — Profile file shape.** Each file `<slug>.json` = `{ "name": "<display name>", "slug": "<slug>", "updatedAt": "<ISO>", "config": <PipelineConfig> }`. The embedded `config` is the exact `PipelineConfig` shape (`subtitle`, `titles?`, `overlays?`, `visualEffects?`) — identical to what `PUT /api/config` writes — so apply is a verbatim copy.
- **D-03 — Slug = stable file id derived from name; rename moves the file.** `slugify(name)` → lowercase, spaces/illegal → `-`, strip to `[a-z0-9-_]`, collapse repeats, trim, cap length. The slug is the path id (anti path-traversal: reject anything not matching `^[a-z0-9][a-z0-9_-]*$`). Rename writes the new slug file + deletes the old; reject if the target slug already exists (409). Mirrors the `JOB_ID_REGEX` validation discipline in server.ts.
- **D-04 — Atomic writes everywhere (CR-02).** Every profile write (save, rename, apply→active) uses temp-file + `fs.renameSync` so a crash mid-write never corrupts a profile or the active config. Same protocol as `PUT /api/config`.
- **D-05 — "Load" = server-side apply.** `PUT /api/profiles/:slug/apply` reads the profile and atomically writes its `config` to `ACTIVE_PIPELINE_CONFIG_PATH`, returning the applied `PipelineConfig`. The UI then refreshes its state from the response. Single source of truth (server), keeps the pipeline's active config in sync with what the user sees. Avoids the UI hand-reconstructing then re-saving.
- **D-06 — Pure core module first (testability).** A framework-free `profiles.ts` holds slugify/validation/(de)serialization and `list/read/save/rename/remove` over an INJECTED directory path (no Express, no globals) — unit-tested in isolation (mirrors the `render-status.ts` pattern from Phase 23). `server.ts` is then a thin HTTP layer over it.
- **D-07 — Validation on read.** Listing/loading validates each profile's `config` with the existing `validatePipelineConfig()`; a malformed/hand-edited profile is reported (skipped in list with a warning, 422 on apply) rather than crashing — graceful, like `WR-04` in PreviewApp.
- **D-08 — Startup ensures the profiles dir exists** (`mkdir -p` recursive) at studio server boot, idempotent, mirroring `seedDefaultConfig()`.
- **D-09 — UI lives in the header action zone, NOT column 3.** Column 3 is reserved for Phase 25 (AI metadata placeholder). The profiles control is a "Perfiles ▾" popover next to "Guardar config" (sketch-findings: *named style presets* + *header action zone*). Inline-first (no full modal — honors the project's inline-first / modal-stack law).
- **D-10 — Green discipline preserved.** "Guardar config" remains the single green CTA. Profile actions use neutral/accent tokens (`--action` is NOT reused for profiles). At most one green element at a time.
- **D-11 — Names are display-facing; list sorted by `updatedAt` desc** (most-recently-touched first), so the active workflow profile is at the top.

## Constraints honored
- remotion-studio port ALWAYS 3123.
- UI work → `impeccable` + `frontend-design` non-negotiable (AGENTS.md); see 24-UI-SPEC.md.
- API routes registered BEFORE the static `serveSpa` catch-all (server.ts L347, T-18-03-01).
- Studio↔renderer: this phase is studio-only (server + preview UI); no renderer sync needed.

## Out of scope
- Profile import/export, sharing, or cloud sync.
- Auto-snapshotting / versioning of profiles.
- Per-profile thumbnails/previews (could be a later polish).
