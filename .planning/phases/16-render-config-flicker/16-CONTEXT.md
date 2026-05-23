# Phase 16 — Render config + flicker fixes (CONTEXT)

**Milestone:** v1.2 (Infrastructure / shared services)
**Status:** scaffolded — ready to plan
**Origin:** Both bugs surfaced during the Phase 15 whisper-externalization e2e run (job `c59d1234-...`). They are **pre-existing render-path bugs, NOT whisper regressions** — the externalized whisper produced a correct transcript (parity 0.000s).

## Issue A — Studio config never reaches the renderer in production

**Symptom:** Rendered subtitles do not use the style configured in the remotion-studio UI. The e2e renderer reported `pipeline_config: {loaded: false, source: "env_vars", subtitle_layout: "tiktok", titles_count: 0}` instead of the user's studio config (`layout: bar`, `fontFamily: Inter`, 2 title overlays). Title overlays were missing entirely.

**Root cause (verified):** The v1.1 config-threading fix wired the CONSUMER half but never the PRODUCER half.
- `render.ts:165-186` loads config only from `PIPELINE_CONFIG_PATH`, else falls back to env defaults.
- `orchestrator.ts` threads `PIPELINE_CONFIG_PATH=/data/pipeline/{jobId}/remotion-renderer/pipeline-config.json` to the renderer step.
- `/process` (`process.ts:123-128`) seeds that per-job file by copying `ACTIVE_PIPELINE_CONFIG_PATH` (`constants.ts:20` → default `/data/pipeline/pipeline-config.json`) IF it exists.
- **But nothing ever creates `/data/pipeline/pipeline-config.json`.** The studio's `PUT /api/config` (`server.ts`) writes via `resolveConfigPath()` to `PIPELINE_CONFIG_PATH` env, or a per-job `{inputDir}/pipeline-config.json`, or local-dev `cwd/pipeline-config.json` — never to the active path. So `existsSync(ACTIVE_PIPELINE_CONFIG_PATH)` is always false → every `/process` render falls back to env defaults.
- (The Phase 15 e2e compounded it by running steps manually via docker, bypassing `/process` entirely — but the production `/process` path is ALSO broken for the reason above.)

**Locked fix decision (user, 2026-05-23):** The studio writes to the active config on save. `PUT /api/config` should ALSO write (or additionally mirror) to `/data/pipeline/pipeline-config.json` (the `ACTIVE_PIPELINE_CONFIG_PATH`), so "save in the studio" == "active production config that /process seeds into each job". Small change in `services/remotion-studio/src/server.ts`.

**Open sub-questions for plan/discuss:**
- Should the active config be a single global file (latest studio save wins) or keyed somehow? Global is simplest and matches the "active config" mental model.
- Confirm the studio container and api-server share the `/data/pipeline` volume so the studio CAN write there (both mount `./pipeline:/data/pipeline` per compose — yes).
- Verify the `_meta` fields the studio adds on GET don't get written into the active file (write the clean config, strip `_meta`).

## Issue B — Subtitle flicker (words appear/disappear ~15×/clip)

**Symptom:** Permanent flicker — subtitle text fades out to nothing and back in repeatedly through the clip.

**Root cause (verified):** Caption pages have empty gaps between EVERY page where no subtitle is visible. Measured on the e2e run (16 pages / 36s): inter-page gaps of 20, 40, 60, 80, 100, 140, 180, 241ms (plus two ~1s gaps at long silence cuts). Combined with `shared-styles.ts`: `FADE_IN_MS=100`, `FADE_OUT_MS=300`, `PAGE_OVERLAP_GUARD_MS=100`. Each page fades fully out over 300ms → short blank gap → next page fades in over 100ms = a visible blink at every page boundary (~15 over the clip).

**Amplifier:** The e2e fell back to `tiktok` layout (Issue A) which pops words individually; the user configured `bar` (a more continuous bar). So Issue B must be RE-MEASURED after Issue A is fixed and a render uses the correct `bar` layout — the flicker may be largely a wrong-layout artifact, or a genuine fade-gap bug, or both.

**Candidate fixes (to validate during plan):**
- Hold each page visible until the next page starts (eliminate the inter-page blank gap) — e.g. extend a page's `durationInFrames` to the next page's start instead of `lastTokenEnd + FADE_OUT`.
- Reduce/remove the fade-out-to-empty between contiguous pages (cross-fade or persist).
- For `bar` layout specifically, keep the bar container mounted across adjacent pages.
- DO NOT just lengthen fades — that can worsen the blank-gap blink.

**Files (probable):** `services/remotion-renderer/src/captions.ts` (page duration/gap logic in `transcriptToCaptionPages` + the per-layout `Sequence` from/duration in `BarLayout.tsx`/`TikTokLayout.tsx`), `shared-styles.ts` (fade constants). REMEMBER the renderer-sync convention (CLAUDE.md): edits to shared `src/*.ts` + `compositions/*` must be copied studio↔renderer.

## Sequencing
Fix Issue A first (so a correct-layout render exists), then RE-MEASURE Issue B on a `bar`-layout render before deciding the flicker fix. A real render (scale:1 now, faster) on a short clip with the studio config is the validation vehicle for both.

## Entry point
`/gsd-plan-phase 16` (or `/gsd-discuss-phase 16` first if the Issue B fix approach needs adaptive questioning — Issue A's fix is already decided). UI work touches remotion-studio/renderer → per CLAUDE.md, the `impeccable` skill + frontend-design plugin are REQUIRED at plan/execute start for any frontend-touching task.
