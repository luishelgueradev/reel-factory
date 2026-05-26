# Phase 17: Config persistence - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Studio-saved configuration (subtitle styles + title blocks) survives `docker compose build`/rebuild and container recreate. The active config lives as a single inspectable JSON file in a persistent, host-mounted location, and renders after a rebuild use the persisted user values (`pipeline_config.loaded=true`).

**In scope:** Reconciling the writer/reader split onto one persistent file; making the studio save target deterministic; seeding a default config on fresh install; verifying persistence across rebuild.

**Out of scope (later phases):** Studio UI redesign (18), typography/effects (19), title precision (20), PNG overlays (21). No new config *fields* — only the persistence/plumbing of the existing schema. **No frontend/studio UI work in this phase** → the `impeccable` + `frontend-design` requirement (AGENTS.md) does NOT apply to Phase 17.
</domain>

<decisions>
## Implementation Decisions

### Canonical config location
- **D-01:** `./pipeline/pipeline-config.json` (container path `/data/pipeline/pipeline-config.json`) is the **single source of truth** for the active config. Both the studio (writer) and the api-server (seeder) use this one path.
- **D-02:** The api-server must STOP reading the active config from `/data/studio/pipeline-config.json` (the read-only mount of the git-tracked image source dir). Change `ACTIVE_PIPELINE_CONFIG_PATH` for the api-server (`docker-compose.yml:241`) to `/data/pipeline/pipeline-config.json` and remove the now-unneeded read-only mount `./services/remotion-studio:/data/studio:ro` (`docker-compose.yml:238`) unless it serves another purpose (verify during planning).

### Persistence mechanism
- **D-03:** Host **bind mount** — confirmed already in place (`./pipeline:/data/pipeline` on both studio `docker-compose.yml:236` and api-server). It is a real host folder outside the image; survives `docker compose build`, `--force-recreate`, and even `down -v` (only the named `redis-data` volume is removed by `-v`). No named volume. Chosen over a Docker named volume specifically for direct inspectability (`cat`/edit/back-up the host file).

### Deterministic save target (the core bug fix)
- **D-04:** `PUT /api/config` in the studio (`services/remotion-studio/src/server.ts:150-186`) must write the config **only to the active path** (`ACTIVE_PIPELINE_CONFIG_PATH` → `./pipeline/pipeline-config.json`). Remove the dependence on `resolveConfigPath()` for the studio *save* destination — today its precedence (`PIPELINE_CONFIG_PATH` set to a per-job `.../${PIPELINE_JOB_ID}/remotion-renderer/pipeline-config.json`, else `INPUT_PATH`-derived, else `cwd/pipeline-config.json`) means a save can land in an ephemeral per-job dir or in `services/remotion-studio/pipeline-config.json`. That non-determinism is a primary reason config appeared "lost" during dev.
- **D-05:** Keep stripping `_meta` before writing (clean config to the active file) — carried from Phase 16.

### Fresh-install seeding
- **D-06:** Ship a **git-tracked default template** (e.g. `config/pipeline-config.default.json` or similar — exact path is a planning detail). On startup, if the active config (`./pipeline/pipeline-config.json`) is missing, copy the template into place. A clean clone or a post-`git clean -fdx` state always boots with sane styling.
- **D-07:** The runtime active file (`pipeline/pipeline-config.json`) STAYS gitignored (`.gitignore:2` ignores `pipeline/`). Only the *default template* is version-controlled, so studio saves never dirty `git status`.

### Save semantics
- **D-08:** Latest-save-wins, single file, **overwrite in place**. No timestamped backups/history (rejected as clutter for a single-user tool). Matches Phase 16's "active config" mental model.

### Claude's Discretion
- Exact path/name of the default template file, the startup hook that performs the seed-copy (studio entrypoint vs api-server vs a shared init), and whether to add a startup log/healthcheck confirming the active config resolved. Decide during planning.

### Carried forward from Phase 16 (locked)
- Studio mirror-writes the clean (`_meta`-stripped) config to `ACTIVE_PIPELINE_CONFIG_PATH` on save — Phase 17 makes this the *sole* write (D-04), not an additional mirror.
- `/process` seeds each job's renderer config by copying the active config into the per-job renderer dir if it exists. **This per-job seed for the RENDERER is correct and stays** — the renderer legitimately reads its own per-job `PIPELINE_CONFIG_PATH`. The bug is only that the studio *save* reused that per-job env var as its write destination.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 17: Config persistence" — goal + 3 success criteria
- `.planning/REQUIREMENTS.md` — PERSIST-01 (config survives rebuild/recreate), PERSIST-02 (inspectable JSON in persistent location, not ephemeral image layer)
- `.planning/phases/16-render-config-flicker/16-CONTEXT.md` — the producer/consumer config-threading history; Issue A root cause; the locked "studio writes to the active config" decision this phase completes

### Config plumbing (files to change)
- `docker-compose.yml:236,238,241` — studio + api-server `./pipeline` mounts, the `/data/studio:ro` mount, and the divergent `ACTIVE_PIPELINE_CONFIG_PATH` values to reconcile
- `docker-compose.yml:163-180` — studio service env (`PIPELINE_CONFIG_PATH` per-job, `ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json`)
- `services/remotion-studio/src/server.ts:150-186` (save/PUT), `:262-280` (`resolveConfigPath()` precedence — the non-determinism)
- `services/api-server/src/constants.ts:20-21` — `ACTIVE_PIPELINE_CONFIG_PATH` default
- `services/api-server/src/process.ts` + `orchestrator.ts` — per-job config seeding (the consumer side; must keep working)
- `.gitignore:2` — `pipeline/` ignore rule (keep; only template is tracked)
- `services/remotion-studio/pipeline-config.json` — existing git-tracked file (2195 B); candidate basis for the default template + the old api-server read source being removed
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Bind mount already present:** `./pipeline:/data/pipeline` on both studio and api-server — no new mount needed for D-01/D-03.
- **Mirror-write already exists:** `server.ts:180-186` already writes to `ACTIVE_PIPELINE_CONFIG_PATH`. D-04 narrows this to be the *only* write rather than adding new code.
- **Legacy seed file:** `services/remotion-studio/pipeline-config.json` (git-tracked, byte-identical to current `pipeline/pipeline-config.json`) — reuse its content as the default template (D-06).

### Established Patterns
- **Per-job config seeding** (`/process` → copy active config → `/data/pipeline/{jobId}/remotion-renderer/pipeline-config.json`, consumed via `PIPELINE_CONFIG_PATH`) is the correct renderer pattern — do NOT remove it; only decouple the studio's *write* target from it.
- **`ACTIVE_PIPELINE_CONFIG_PATH` env indirection** — both services read this constant; reconcile the two compose values to the same path rather than hardcoding.

### Integration Points
- Studio `PUT /api/config` → active file (write side).
- api-server `/process` reads active file → seeds per-job renderer config (read side).
- Startup seed-copy hook (new): template → active file when missing.

### Why config was "lost" during dev (validated, informs the fix)
1. `pipeline/` is gitignored → `git clean -fdx`/aggressive resets wipe it.
2. `resolveConfigPath()` precedence routed studio saves to ephemeral per-job dirs or `cwd` instead of the persistent active file.
The bind mount itself was never the problem — it persists correctly.
</code_context>

<specifics>
## Specific Ideas

- User explicitly confirmed (2026-05-26) that they have repeatedly lost config during development — the deterministic-save fix (D-04) + versioned-default seed (D-06) directly target both observed loss causes.
- Verification must prove success criterion #3: after editing styles → `docker compose build` + recreate → a render reports `pipeline_config.loaded=true` with the user's values (not env fallback). The acceptance vehicle is a real render (or at minimum an inspection that the seeded per-job config equals the persisted active config) on a short clip.
</specifics>

<deferred>
## Deferred Ideas

- **Timestamped config backups / edit history** — considered and rejected for this phase (D-08); could revisit if multi-user or undo becomes a need.
- **Startup healthcheck/log line confirming active config resolution** — left to Claude's discretion during planning, not a separate capability.

None of these add new phase capabilities — discussion stayed within the persistence scope.
</deferred>

---

*Phase: 17-config-persistence*
*Context gathered: 2026-05-26*
