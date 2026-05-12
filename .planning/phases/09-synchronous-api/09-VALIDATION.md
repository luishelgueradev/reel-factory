---
phase: 9
slug: synchronous-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | services/api-server/vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | APIS-01 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | APIS-01 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | APIS-01 | — | N/A | integration | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 1 | APIS-02 | — | N/A | integration | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | APIS-02 | — | N/A | integration | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 09-04-01 | 04 | 2 | APIS-03 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 09-05-01 | 05 | 3 | APIS-01, APIS-02, APIS-03 | — | N/A | e2e | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/api-server/src/__tests__/setup.ts` — shared test fixtures (mock Docker, temp directories)
- [ ] `services/api-server/src/__tests__/upload.test.ts` — stubs for upload validation (APIS-01)
- [ ] `services/api-server/src/__tests__/process.test.ts` — stubs for pipeline orchestration (APIS-01, APIS-02)
- [ ] `services/api-server/src/__tests__/artifacts.test.ts` — stubs for artifact serving (APIS-02)
- [ ] `services/api-server/src/__tests__/timeout.test.ts` — stubs for timeout handling (APIS-03)
- [ ] `services/api-server/vitest.config.ts` — Vite test config

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full pipeline processes a real MP4 and returns processed video | APIS-01 | Requires GPU + all Docker containers running | `curl -F "video=@test.mp4" http://localhost:3000/process` and verify 9:16 output |
| Concurrent requests produce separate valid results | APIS-01 | Requires multiple real pipeline runs simultaneously | Send 2 POST /process requests simultaneously, verify both return unique jobIds and valid results |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending