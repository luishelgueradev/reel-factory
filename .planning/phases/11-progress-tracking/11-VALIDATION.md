---
phase: 11
slug: progress-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already in api-server) |
| **Config file** | `services/api-server/vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 \| head -80` |
| **Full suite command** | `npx vitest run 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | head -80`
- **After every plan wave:** Run `npx vitest run 2>&1`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | PROG-01 | T-11-01 | Input validation on jobId param (UUID format) | unit | `npx vitest run src/__tests__/status.test.ts` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | PROG-01 | — | Progress calculation matches step-index formula | unit | `npx vitest run src/__tests__/progress.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | PROG-01 | — | Orchestrator updates completed steps list on transition | unit | `npx vitest run src/__tests__/worker.test.ts` | ✅ exists | ⬜ pending |
| 11-02-02 | 02 | 2 | PROG-02 | — | stepInfo and progress fields computed from step position | unit | `npx vitest run src/__tests__/status.test.ts` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | PROG-01 | T-11-01 | GET /status/:jobId returns correct response shape | unit | `npx vitest run src/__tests__/status.test.ts` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | PROG-01 | T-11-02 | Unknown jobId returns 404 | unit | `npx vitest run src/__tests__/status.test.ts` | ❌ W0 | ⬜ pending |
| 11-04-01 | 04 | 3 | PROG-01, PROG-02 | — | E2E: submit job → poll status → verify step transitions | integration | `npx vitest run src/__tests__/progress-e2e.test.ts` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `services/api-server/src/__tests__/status.test.ts` — stubs for PROG-01, PROG-02
- [ ] `services/api-server/src/__tests__/progress-e2e.test.ts` — stubs for E2E validation

Existing infrastructure covers most phase requirements. Wave 0 creates test stubs for new files.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Status reflects live step transitions during real pipeline | PROG-01 | Requires Docker containers running full pipeline | Run pipeline, poll /status/{jobId} repeatedly, verify step names change |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending