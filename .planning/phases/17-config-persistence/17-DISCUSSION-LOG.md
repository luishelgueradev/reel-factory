# Phase 17: Config persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 17-config-persistence
**Areas discussed:** Canonical config path, Persistence mechanism, Fresh-install seeding, Save semantics & backups

---

## Canonical config path

| Option | Description | Selected |
|--------|-------------|----------|
| ./pipeline/pipeline-config.json | Both services already mount ./pipeline; api-server seeds from there too, drop /data/studio read-only path | ✓ |
| Dedicated ./config/ dir | New top-level config dir separate from per-job artifacts | |
| Make /data/studio writable | Keep api-server reading studio source dir, mount read-write | |

**User's choice:** ./pipeline/pipeline-config.json (single active location for writer + reader)
**Notes:** User initially asked whether ./pipeline was actually mounted externally, because they had lost config several times during development. Verified it IS a host bind mount (`docker-compose.yml:3,236`) that survives build/recreate/`down -v`. Confirmed the loss was NOT the mount — it was (1) `pipeline/` gitignored + `git clean`, and (2) non-deterministic save target in `resolveConfigPath()`.

---

## Persistence mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Host bind mount | Plain host file, directly inspectable/editable, already in use | ✓ |
| Docker named volume | Docker-managed, needs docker cp to inspect | |

**User's choice:** Host bind mount (implied by adopting ./pipeline; confirmed already in place)
**Notes:** Chosen for direct inspectability matching the "inspectable JSON" requirement (PERSIST-02).

---

## Deterministic save target (the core bug)

| Option | Description | Selected |
|--------|-------------|----------|
| Write ALWAYS only to active file | PUT /api/config writes directly + only to ACTIVE_PIPELINE_CONFIG_PATH | ✓ |
| Keep primary + mirror, pin primary | Conserve both writes but force primary to active path | |
| Analyze more | Review server.ts:150-186 + PIPELINE_CONFIG_PATH role first | |

**User's choice:** Write always only to the active file
**Notes:** `resolveConfigPath()` precedence (per-job `PIPELINE_CONFIG_PATH` → INPUT_PATH → cwd) routed saves to ephemeral locations. Per-job seeding for the RENDERER stays; only the studio save destination changes.

---

## Fresh-install seeding

| Option | Description | Selected |
|--------|-------------|----------|
| Git-tracked default, copied on first boot | Ship template in repo; copy to ./pipeline/ if active missing | ✓ |
| Version the active file directly | Untrack pipeline-config.json, track live file (dirties git status on save) | |
| Built-in code defaults | No file until first save; renderer uses hardcoded defaults | |

**User's choice:** Git-tracked default template, copied on first boot
**Notes:** Targets the `git clean -fdx` / clean-clone loss case directly. Runtime file stays gitignored so saves don't dirty git.

---

## Save semantics & backups

| Option | Description | Selected |
|--------|-------------|----------|
| Latest-save-wins, single file | Overwrite in place, simplest | ✓ |
| Keep timestamped backups | Write .bak/history before overwrite | |

**User's choice:** Overwrite in place, single file
**Notes:** Backups rejected as clutter for a single-user tool.

---

## Claude's Discretion

- Exact path/name of the default template file.
- Where the startup seed-copy hook lives (studio entrypoint vs api-server vs shared init).
- Whether to add a startup log/healthcheck confirming the active config resolved.

## Deferred Ideas

- Timestamped config backups / edit history — revisit if multi-user/undo becomes a need.
- Startup healthcheck/log confirming active-config resolution — discretionary planning detail.
