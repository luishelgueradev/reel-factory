---
phase: 20
slug: title-block-precision
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (remotion-renderer) |
| **Config file** | `services/remotion-renderer/vitest.config.ts` |
| **Quick run command** | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` |
| **Full suite command** | `cd services/remotion-renderer && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts`
- **After every plan wave:** Run `cd services/remotion-renderer && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-schema-x-y | 01 | 1 | TITLE-01 | — | N/A | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | ❌ W0 | ⬜ pending |
| 20-schema-borderradius | 01 | 1 | TITLE-02 | — | N/A | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | ❌ W0 | ⬜ pending |
| 20-schema-subtitle-removal | 01 | 1 | TITLE-03 | — | N/A | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | ❌ W0 (update existing) | ⬜ pending |
| 20-overlay-positioning | 02 | 2 | TITLE-01 | — | N/A | visual (manual) | Studio preview at port 3123 | manual | ⬜ pending |
| 20-overlay-borderradius | 02 | 2 | TITLE-02 | — | N/A | visual (manual) | Studio preview at port 3123 | manual | ⬜ pending |
| 20-overlay-subtitle-removed | 02 | 2 | TITLE-03 | — | N/A | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | ❌ W0 | ⬜ pending |
| 20-editor-xy-inputs | 03 | 2 | TITLE-01 | — | N/A | visual (manual) | Studio at port 3123 — add/edit title, set x/y, verify live preview | manual | ⬜ pending |
| 20-editor-borderradius-slider | 03 | 2 | TITLE-02 | — | N/A | visual (manual) | Studio at port 3123 — drag border-radius slider, verify live preview | manual | ⬜ pending |
| 20-editor-subtitle-removed | 03 | 2 | TITLE-03 | — | N/A | visual (manual) | Studio at port 3123 — confirm no subtitle field in add/edit form | manual | ⬜ pending |
| 20-renderer-sync | 04 | 3 | TITLE-01,02,03 | — | N/A | unit | `cd services/remotion-renderer && npx vitest run` | ✅ (after sync) | ⬜ pending |
| 20-build-verify | 04 | 3 | TITLE-01,02,03 | — | N/A | build | `cd services/remotion-studio && npm run build:editor` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/remotion-renderer/src/pipeline-config.test.ts` — update existing subtitle test at line 57 (remove `subtitle: "Episode 1"` from fixture); add tests:
  - Accepts `x` (number) and `y` (number) fields in title style
  - Rejects negative `x` or `y` values
  - Accepts `borderRadius` (number) field in title style
  - Existing config without `topOffset` is valid (no validation error)
  - Existing config without `subtitle` field is valid (no validation error)

*Note: vitest is not installed in remotion-studio devDependencies. Phase 20 routes all automated tests through the renderer's vitest (same pipeline-config.ts post-sync). No studio test infra changes required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Title block renders at x=200, y=960 in studio preview | TITLE-01 | Visual CSS positioning requires browser rendering | Start studio on port 3123; open Titles tab; add title with default x/y; verify block appears center-left of video frame |
| Title block renders at x=0, y=0 (top-left corner, no clipping) | TITLE-01 | Verifies centering transform was fully removed | Set x=0, y=0 on a title; verify top-left corner of block is flush with frame top-left (no half-block off-screen) |
| Border-radius slider changes block corner roundness live | TITLE-02 | Visual CSS property | Drag border-radius slider from 0 to 50; verify block corners change from sharp to pill in live preview |
| No subtitle field visible in add/edit form | TITLE-03 | UI field removal — visual confirmation | Open add/edit title form; confirm no "Subtitle" text input, no subtitle color, size, or font controls |
| Title list item shows no subtitle line | TITLE-03 | UI list rendering — visual confirmation | Add a title; verify list item shows only title text + timing line + buttons |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
