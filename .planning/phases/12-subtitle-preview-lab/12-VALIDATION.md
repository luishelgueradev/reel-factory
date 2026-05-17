---
phase: 12
slug: subtitle-preview-lab
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | services/remotion-studio/vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `cd services/remotion-studio && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd services/remotion-studio && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd services/remotion-studio && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd services/remotion-studio && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | PREV-03 | — | pastWordOpacity applied to past words via config | unit | `npx vitest run src/editor/__tests__/StyleControls.test.tsx -x` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | PREV-03 | — | lineHeight and bottomOffset sliders render and update config | unit | `npx vitest run src/editor/__tests__/StyleControls.test.tsx -x` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | PREV-01 | — | N/A | unit | `cd services/remotion-studio && npm ls @remotion/player react-router-dom 2>&1 \| grep -E "@remotion/player\|react-router-dom"` | ✅ | ⬜ pending |
| 12-02-02 | 02 | 2 | PREV-01 | — | Player renders SubtitledVideo at 1080x1920 | unit | `npx vitest run src/preview/__tests__/PreviewPlayer.test.tsx -x` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | PREV-02 | — | All 18 fonts load via loadFont() | unit | `npx vitest run src/__tests__/fonts.test.ts -x` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | PREV-03 | — | textToCaptionPages returns valid TikTokPage[] | unit | `npx vitest run src/preview/__tests__/textToCaptions.test.ts -x` | ❌ W0 | ⬜ pending |
| 12-02-03 | 02 | 2 | PREV-01 | — | Manual E2E: /preview renders 9:16 viewport | manual | Browser test | — | ⬜ pending |
| 12-02-03 | 02 | 2 | PREV-02 | — | Manual E2E: Font grid shows all 18 fonts | manual | Browser test | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/remotion-studio/vitest.config.ts` — Vitest configuration for remotion-studio
- [ ] `services/remotion-studio/src/preview/__tests__/PreviewPlayer.test.tsx` — React component test for Player mount
- [ ] `services/remotion-studio/src/preview/__tests__/textToCaptions.test.ts` — Unit tests for text-to-captions conversion
- [ ] `services/remotion-studio/src/editor/__tests__/StyleControls.test.tsx` — Test extended StyleControls with pastWordOpacity, lineHeight, bottomOffset
- [ ] `services/remotion-studio/src/__tests__/fonts.test.ts` — Verify all 18 fonts load
- [ ] `services/remotion-studio/src/preview/__tests__/FontGridPage.test.tsx` — Font grid renders all fonts
- [ ] Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` in remotion-studio devDependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /preview renders 9:16 viewport with subtitle overlay | PREV-01 | Visual layout verification requires browser | Open http://localhost:3100/preview, verify 9:16 aspect ratio viewport with sample video background and subtitle text |
| Font grid shows all 18 fonts in correct typeface | PREV-02 | Font rendering is visual | Navigate to /preview/fonts, verify each font cell renders in the correct typeface, click a font to select it |
| All SubtitleConfig parameters update preview in real-time | PREV-03 | Real-time UI response requires browser interaction | Change each parameter slider/dropdown, verify preview updates instantly without page reload |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending