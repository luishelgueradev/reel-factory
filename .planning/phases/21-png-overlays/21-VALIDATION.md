---
phase: 21
slug: png-overlays
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `services/remotion-renderer/vitest.config.ts` |
| **Quick run command** | `cd services/remotion-renderer && npx vitest run` |
| **Full suite command** | `cd services/remotion-renderer && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd services/remotion-renderer && npx vitest run`
- **After every plan wave:** Run `cd services/remotion-renderer && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | OVERLAY-01 | — | `overlays?: PngOverlayConfig[]` validates in validatePipelineConfig | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | OVERLAY-02 | — | `displayWidth` field present and validated as positive number | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 1 | OVERLAY-03 | — | `x`, `y` validated as numbers | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 2 | OVERLAY-01 | — | PngOverlay renders `<Img>` with correct src | unit | `cd services/remotion-studio && npx vitest run src/compositions/` | ❌ W0 | ⬜ pending |
| 21-03-01 | 03 | 3 | OVERLAY-01/02/03 | — | Human visual UAT: overlay visible in studio at port 3123 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/remotion-renderer/src/pipeline-config.test.ts` — add OVERLAY-01/02/03 test cases (extends existing file)
- [ ] `services/remotion-studio/src/compositions/overlay.test.ts` — PngOverlay component render tests (new file)

*Existing infrastructure covers the test runner — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PNG overlay renders transparently over video in studio preview | OVERLAY-01 | Requires visual inspection of browser Player | Upload PNG with transparency → confirm overlay appears with no white box |
| Downscale stays crisp for a logo PNG wider than 1080px | OVERLAY-02 | Subjective visual quality assessment | Upload 2160×400 logo, set displayWidth=400 → confirm text/edges are sharp not blurry |
| Overlay position moves correctly when X/Y changed | OVERLAY-03 | Requires visual layout check | Set X=0,Y=0 → top-left; set X=540,Y=960 → center; confirm movement |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
