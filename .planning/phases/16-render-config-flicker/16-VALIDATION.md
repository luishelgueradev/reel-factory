---
phase: 16
slug: render-config-flicker
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-23
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (`vitest ^4.1.5` in `services/remotion-renderer/package.json`) |
| **Config file** | `services/remotion-renderer/vitest.config.ts` (inferred from devDependencies) |
| **Quick run command** | `cd services/remotion-renderer && npm test` |
| **Full suite command** | `cd services/remotion-renderer && npm test` |
| **Estimated runtime** | ~16 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd services/remotion-renderer && npm test`
- **After every plan wave:** Run `cd services/remotion-renderer && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 16 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-T1 | 01 | 1 | — | T-16-01 | configToWrite (sanitized, no _meta) written to activePath | grep | `grep -c "ACTIVE_PIPELINE_CONFIG_PATH" services/remotion-studio/src/server.ts && grep -c "writeFileSync.*activePath\|activePath.*writeFileSync" services/remotion-studio/src/server.ts` | ✅ | ⬜ pending |
| 16-01-T2 | 01 | 1 | — | T-16-02 | env var explicit in docker-compose for remotion-studio | grep | `grep -c "ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json" docker-compose.yml` | ✅ | ⬜ pending |
| 16-02-T1 | 02 | 1 | — | T-16-CP | studio running with Issue A fix, bar config active | grep + cat | `grep -c "ACTIVE_PIPELINE_CONFIG_PATH" services/remotion-studio/src/server.ts && cat pipeline/pipeline-config.json \| python3 -m json.tool \| grep '"layout"'` | ✅ (after 16-01) | ⬜ pending |
| 16-02-T2 | 02 | 1 | — | T-16-CP | human-verified pipeline_config.loaded=true on real render | checkpoint | (blocking human checkpoint — see Plan 16-02 Task 2) | manual | ⬜ pending |
| 16-03-T1 | 03 | 2 | — | T-16-03 | isLastPage formula in both layout files, safeEndMs removed | grep | `grep -c "isLastPage" services/remotion-studio/src/compositions/BarLayout.tsx && grep -c "isLastPage" services/remotion-studio/src/compositions/TikTokLayout.tsx` | ✅ (after fix) | ⬜ pending |
| 16-03-T2 | 03 | 2 | — | T-16-04 | unit tests pass, renderer copies synced | vitest | `cd services/remotion-renderer && npm test 2>&1 \| tail -20` | ✅ (existing captions.test.ts) | ⬜ pending |
| 16-03-T3 | 03 | 2 | — | T-16-03 | human-verified no inter-page flicker in rendered video | checkpoint | (blocking human checkpoint — see Plan 16-03 Task 3) | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. vitest is already installed in `services/remotion-renderer`. No framework install or stub scaffolding is needed before Plan 16-01 can execute.

New test block (4 layout-duration formula cases) is added inline in Plan 16-03 Task 2 as part of implementation — not a Wave 0 pre-condition.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PUT /api/config writes pipeline-config.json (Issue A) | Plan 16-01 | Requires running studio server process + HTTP call; no unit test for server.ts PUT handler | Start studio: `setsid env PORT=3123 EDITOR_DIST=$(pwd)/dist/editor npx tsx src/server.ts > /tmp/remotion-server.log 2>&1 &`; send `curl -X PUT http://localhost:3123/api/config -H "Content-Type: application/json" -d '{"subtitle":{"layout":"bar"},"titles":[]}'`; verify `cat pipeline/pipeline-config.json \| python3 -m json.tool \| grep '"layout"'` |
| pipeline_config.loaded=true in real /process render (Issue A e2e) | Plan 16-02 | Requires full Docker stack + real MP4 input; not automatable as a unit test | Submit render via `curl -X POST http://localhost:3000/process -F video=@test.mp4`; inspect `remotion-info.json` as described in Plan 16-02 checkpoint |
| No inter-page subtitle flicker in output video (Issue B) | Plan 16-03 | Requires human visual inspection of rendered video; frame-level flicker cannot be detected by automated assertion | Play `pipeline/{jobId}/remotion-renderer/output.mp4`; scrub through subtitle transitions; confirm no blank flash between caption pages |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are blocking human checkpoints
- [x] Sampling continuity: automated tasks interleaved with checkpoints, no 3 consecutive tasks without verify
- [x] Wave 0 not needed — existing vitest infrastructure covers all automated assertions
- [x] No watch-mode flags (npm test runs `vitest run`, not `vitest --watch`)
- [x] Feedback latency < 16s for automated tasks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
