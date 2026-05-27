---
phase: 18
slug: studio-ui-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (remotion-renderer only; remotion-studio has no vitest configured) |
| **Config file** | none in remotion-studio — build check is primary gate |
| **Quick run command** | `cd services/remotion-studio && npm run build:editor` |
| **Full suite command** | `cd services/remotion-renderer && npm test` |
| **Estimated runtime** | ~30 seconds (build) + ~10 seconds (renderer tests) |

---

## Sampling Rate

- **After every task commit:** Run `cd services/remotion-studio && npm run build:editor`
- **After every plan wave:** Run `cd services/remotion-renderer && npm test` + visual check in browser at port 3123
- **Before `/gsd:verify-work`:** Build green + visual verification of all 3 tabs + Save Config working
- **Max feedback latency:** ~30 seconds (build gate)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-routing | — | 1 | STUDIO-03 | — | N/A | build | `cd services/remotion-studio && npm run build:editor` | n/a | ⬜ pending |
| 18-tabs | — | 1 | STUDIO-02 | — | N/A | visual | Browser at port 3123 — 3 tabs visible, Titles default-open | n/a | ⬜ pending |
| 18-layout | — | 1 | STUDIO-01 | — | N/A | visual | Two-column layout: left player 40%, right panel | n/a | ⬜ pending |
| 18-title-state | — | 2 | STUDIO-02 | — | N/A | build + visual | Build clean + TitleEditor live updates Player | n/a | ⬜ pending |
| 18-font-grid | — | 2 | STUDIO-02 | — | N/A | visual | Font grid inline in Subtitles tab, no /preview/fonts route | n/a | ⬜ pending |
| 18-regression | — | final | STUDIO-01–03 | — | N/A | unit | `cd services/remotion-renderer && npm test` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no new test framework install needed.
Build success + visual verification is the primary gate for this UI restructuring phase.

- [ ] Confirm `cd services/remotion-studio && npm run build:editor` exits 0 before any task work begins

*Optional (planner discretion):* `vitest` devDependency + `@testing-library/react` in `services/remotion-studio/package.json` for component-level tab-state tests. Not required — no existing component tests in studio.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-column layout renders: left player, right tabbed panel | STUDIO-01 | CSS/layout — no DOM API for visual verification | Open http://localhost:3123 in Chrome, confirm split |
| Tab switching shows correct controls (Subtitles/Titles/Text) | STUDIO-02 | Interaction — requires browser click | Click each tab, verify correct controls appear |
| Titles tab is default-open on load | STUDIO-02 | Load-state — visual only | Fresh reload, confirm Titles active without click |
| Font card click sets fontFamily live in Player | STUDIO-02 | Integration — visual font change | Click a font card, verify Player subtitle font changes |
| Render Video button disabled (no fetch fires) | — | Interaction guard — requires browser devtools | Click button, verify no network request in devtools |
| Save Config persists to pipeline-config.json | STUDIO-01–03 | File-system side effect | Edit a control, Save, check `./pipeline/pipeline-config.json` |

---

## Validation Sign-Off

- [ ] All tasks have build-gate or visual-verification coverage
- [ ] Sampling continuity: build check runs after each task commit
- [ ] Wave 0 confirmed (existing build green before execution starts)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (build gate)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
