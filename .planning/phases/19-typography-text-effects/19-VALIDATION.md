---
phase: 19
slug: typography-text-effects
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via Remotion test files — `*.test.ts` in compositions/) |
| **Config file** | `services/remotion-studio/vitest.config.ts` (check at Wave 0) |
| **Quick run command** | `npm test` from `services/remotion-studio/` |
| **Full suite command** | `npm test` from `services/remotion-studio/` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` from `services/remotion-studio/`
- **After every plan wave:** Run `npm test` from `services/remotion-studio/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-W0-01 | W0 | 0 | TYPO-01 | — | N/A | unit | `npm test -- --grep "PlusJakartaSans"` | ❌ W0 | ⬜ pending |
| 19-W0-02 | W0 | 0 | TYPO-03 | — | N/A | unit | `npm test -- --grep "fontWeight"` | ❌ W0 | ⬜ pending |
| 19-W0-03 | W0 | 0 | TYPO-04 | T-19-01 | `outerGlow.color` matches `/^#[0-9a-fA-F]{6}$/` | unit | `npm test -- --grep "getOuterGlowStyle"` | ❌ W0 | ⬜ pending |
| 19-01-01 | 01 | 1 | TYPO-01 | — | N/A | unit | `npm test -- --grep "PlusJakartaSans"` | ✅ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | TYPO-02 | — | N/A | unit | `npm test -- --grep "subtitleFontSize"` | ✅ partial | ⬜ pending |
| 19-02-01 | 02 | 1 | TYPO-03 | — | N/A | unit | `npm test -- --grep "fontWeight"` | ✅ W0 | ⬜ pending |
| 19-03-01 | 03 | 2 | TYPO-04 | T-19-01 | `outerGlow.color` must match `/^#[0-9a-fA-F]{6}$/` before CSS injection | unit | `npm test -- --grep "getOuterGlowStyle"` | ✅ W0 | ⬜ pending |
| 19-04-01 | 04 | 2 | TYPO-01–04 | — | N/A | smoke/manual | Studio at port 3123 | Manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/remotion-studio/src/compositions/shared-styles.test.ts` — unit tests for `getOuterGlowStyle()` (TYPO-04 hex→rgba math, shadow string format, color hex validation)
- [ ] `services/remotion-studio/src/compositions/font-weight.test.ts` — unit tests for fontWeight boolean → CSS 400/700 mapping in at least one layout (TYPO-03)
- [ ] `services/remotion-studio/src/fonts.test.ts` — unit test for `AVAILABLE_FONTS[0] === "Plus Jakarta Sans"` (TYPO-01)
- [ ] Check for existing test config at `services/remotion-studio/vitest.config.ts` or `jest.config.*` — install if missing

*If framework already installed: Wave 0 stubs only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plus Jakarta Sans renders visually in studio preview | TYPO-01 | Font rendering requires visual inspection | Start studio on port 3123, open a project, select PJS font, verify text renders in the correct typeface |
| Bold/italic variants apply visually | TYPO-03 | Font weight/style rendering requires visual inspection | Toggle bold/italic in StyleControls, verify text weight and slant change in the preview |
| Outer glow renders visible halo around text | TYPO-04 | CSS text-shadow rendering requires visual inspection | Enable glow in StyleControls, verify a soft halo appears around subtitle text |
| Renderer produces correct output at render time | TYPO-01–04 | Requires running the full render pipeline | Trigger a render via API, inspect output MP4 for font and glow effects |

---

## Security Notes (ASVS L1)

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| XSS via glow color string injected into CSS | Tampering | `outerGlow.color` validated as `/^#[0-9a-fA-F]{6}$/` in `validatePipelineConfig` |
| CSS injection via softness value | Tampering | Softness from `<input type="range">` → validated as `number >= 0` in schema |
| Config poisoning via malformed JSON | Tampering | Existing `validatePipelineConfig` gate; new fields added to validation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
