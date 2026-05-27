---
phase: 17-config-persistence
plan: 02
subsystem: config-persistence
status: complete
tags: [config, docker, persistence, human-verify, render]
requirements: [PERSIST-01, PERSIST-02]
date: 2026-05-27
---

# 17-02 SUMMARY — Human verify: config survives rebuild + render

One-liner: Proved end-to-end, in the live Docker environment, that studio-saved
configuration survives `docker compose build` + `--force-recreate` and that a
`/process` render after the rebuild loads the persisted values
(`pipeline_config.loaded=true`, `subtitle_layout="bar"`, not the `tiktok` env default).

## What was verified

**Task 1 (autonomous) — seed hook on fresh start:**
- `docker compose build api-server` → exit 0.
- With `./pipeline/pipeline-config.json` absent, `docker compose up -d --force-recreate api-server`
  booted, `seedDefaultConfig()` fired, and the active config was created from the git-tracked
  default template (`layout: "bar"`, valid JSON). Existing user configs are not clobbered
  (existsSync guard). User backup restored after the test.

**Task 2 (human-verify, blocking gate) — full persistence story:**
1. Saved a marker config via the studio `PUT /api/config` (HTTP 200) → host file
   `./pipeline/pipeline-config.json` = `layout:bar, fontFamily:SpaceGrotesk, fontSize:137`,
   single-write to `/data/pipeline/pipeline-config.json` (the 17-01 fix).
2. `docker compose build api-server remotion-studio` → exit 0.
3. `docker compose up -d --force-recreate api-server remotion-studio` → both healthy.
4. **Config survived rebuild + recreate**: still `bar/SpaceGrotesk/137` → **PERSIST-02**
   (bind mount, not the ephemeral image layer).
5. Per-job seed: `/process` copied the active config into
   `pipeline/{jobId}/remotion-renderer/pipeline-config.json` = `bar/SpaceGrotesk/137`
   (key-link: `existsSync + copyFile from ACTIVE_PIPELINE_CONFIG_PATH`).
6. Render `remotion-info.json` → `"loaded": true`, `"subtitle_layout": "bar"`
   (≠ `tiktok` env default) → **PERSIST-01**. `output.mp4` produced (30.4 MB).

**Real-world confirmation:** a subsequent user-launched render of `videos/video-1.mp4`
(layout `bar`, font `LexendDeca`, 2 title overlays) completed with `loaded=true` and the
exact saved config seeded into the job — persistence holds for real production runs.

## Deviations (handled, not failures)

- The plan's step-1 assumed an open studio UI; the dockerized studio sits behind HTTP Basic
  Auth (401 on the host port). Exercised the save via authenticated `curl PUT` per the plan's
  step-7 allowance (inspection is sufficient for PERSIST-01/02; render is the gold standard).
- The plan's step-6 grep (`curl /process | grep pipeline_config`) was based on a wrong
  assumption about the response shape — `pipeline_config.loaded` is written to the renderer's
  `remotion-info.json` artifact, not the HTTP response. Verified there instead.

## Success criteria (ROADMAP Phase 17)

- [x] #1 After editing styles + `docker compose build` + recreate, config still present and applied.
- [x] #2 Active config is inspectable JSON in a persistent location (`./pipeline/` bind mount).
- [x] #3 A render after rebuild uses the persisted config (`pipeline_config.loaded=true` with user values).

## Files

No source changes (verification-only plan; `files_modified: []`).
