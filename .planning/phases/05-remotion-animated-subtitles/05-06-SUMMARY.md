---
phase: 05-remotion-animated-subtitles
plan: 06
status: complete
gap_closure: true
closed_gap: "process.sh NO pasa SILENCE_CUTS_PATH al container remotion-renderer, con un comentario explicando por qué"
dependencies: ["05-04", "05-05"]
---

# Plan 05-06: Remove SILENCE_CUTS_PATH from remotion-renderer

## What was built

Fixed `process.sh` to NOT pass `SILENCE_CUTS_PATH` to the remotion-renderer container. Since Whisper runs on the cut video (after silence removal), transcript timestamps are already on the silence-removed timeline. The detection logic in `areTimestampsAlreadyRemapped` handles this case automatically. `FINALIZER_INFO_PATH` remains — it's needed for safe zone positioning (bottomOffset).

## Changes

- **process.sh**: Removed `export SILENCE_CUTS_PATH=...` (line 66) and `-e SILENCE_CUTS_PATH` from the docker compose run command (line 71). Added explanatory comment block documenting why SILENCE_CUTS_PATH is intentionally omitted.

## Verification

- `bash -n process.sh` — syntax OK
- SILENCE_CUTS_PATH not passed as env var to remotion-renderer (only in explanatory comment)
- FINALIZER_INFO_PATH still passed to remotion-renderer
- Explanatory comment present with reasoning

## Key decisions

- Kept FINALIZER_INFO_PATH because it provides safe zone data (bottomOffset) needed by the renderer
- Used inline comment rather than a separate doc — the reason is specific to this one docker compose call

## Self-Check: PASSED

- [x] process.sh does NOT pass SILENCE_CUTS_PATH to remotion-renderer
- [x] process.sh still passes FINALIZER_INFO_PATH to remotion-renderer
- [x] Explanatory comment present
- [x] Bash syntax valid (`bash -n process.sh`)

## Key files

- modified: `process.sh` — removed SILENCE_CUTS_PATH export and docker compose env var, added explanatory comment