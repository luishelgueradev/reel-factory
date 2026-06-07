---
phase: 29-ux-fuentes-metadata-multi-red
plan: 01
subsystem: remotion-studio / preview
tags: [ui, fonts, disclosure, collapsible, studio, frontend]
requires:
  - "PreviewApp.tsx Subtítulos tab (sample-text + FontGrid)"
provides:
  - "CollapsibleSection — reusable default-collapsed disclosure (chevron, aria-expanded)"
  - "Subtítulos tab: sample-text + browse-fonts collapsed by default (FONT-01/02)"
affects:
  - "services/remotion-studio/src/preview/PreviewApp.tsx"
tech-stack:
  added: []
  patterns:
    - "Pure chevron disclosure (▸/▾) — NOT the FxBlock switch idiom"
    - "Conditional body render so collapsed sections reclaim vertical space"
    - "prefers-reduced-motion respected for the chevron transition"
key-files:
  created:
    - "services/remotion-studio/src/preview/CollapsibleSection.tsx"
    - "services/remotion-studio/src/preview/collapsible-section.test.tsx"
  modified:
    - "services/remotion-studio/src/preview/PreviewApp.tsx"
decisions:
  - "CollapsibleSection owns the 'Browse Fonts' title; removed FontGrid's internal header to avoid duplication"
  - "Header is a real <button> with aria-expanded for accessibility + testability"
  - "Green discipline held: neutral/--accent tokens only, no action-green"
metrics:
  duration: "~3 min"
  completed: "2026-06-07"
  tasks: 3
  files: 3
requirements: [FONT-01, FONT-02]
---

# Phase 29 Plan 01: Fonts UX — Collapsible sample-text & browse-fonts Summary

Declutter the Subtítulos tab: the sample-text textarea (FONT-01) and the browse-fonts grid (FONT-02) are now wrapped in a reusable, default-collapsed `CollapsibleSection` disclosure (pure chevron expand/collapse, not an on/off switch). The sample-text section stays at the top of the column (collapse ≠ move) and its `sampleText → textToCaptionPages → PreviewPlayer` data flow is unchanged.

## What was built

- **`CollapsibleSection.tsx`** — reusable disclosure: a full-width `<button>` header with a rotating chevron (▸ collapsed / ▾ expanded), `aria-expanded`, accessible name = `title`. Body is conditionally rendered (absent from the DOM when collapsed) so closed sections truly reclaim vertical space. `defaultOpen` defaults to `false`. Neutral/`--accent` OKLCH tokens only (no action-green). Chevron transition disabled under `prefers-reduced-motion`. Visual register mirrors FxBlock (bordered card, full borders — no side-stripe) but with no switch widget.
- **`collapsible-section.test.tsx`** — vitest + @testing-library/react: default-collapsed, header button named by title, toggle open/closed, `defaultOpen={true}` renders on mount, `aria-expanded` reflects state.
- **`PreviewApp.tsx`** — imported `CollapsibleSection`; wrapped the sample-text block (first child of the Subtítulos tab → stays at top) and the `FontGrid` usage each in a `CollapsibleSection`, both collapsed by default. Removed FontGrid's internal "Browse Fonts" header so the section owns the (single) title.

## Tasks completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (RED) | Failing test for CollapsibleSection | 96a8bc0 | collapsible-section.test.tsx |
| 1 (GREEN) | Implement CollapsibleSection | 3cbbaeb | CollapsibleSection.tsx |
| 2 | CollapsibleSection test (covered by Task 1 TDD pair) | 96a8bc0 | collapsible-section.test.tsx |
| 3 | Wrap sample-text + browse-fonts, collapsed by default | 9d65755 | PreviewApp.tsx |

Tasks 1 and 2 are a TDD pair (test file written RED, then implementation GREEN), so they share the RED commit 96a8bc0 for the test and 3cbbaeb for the implementation.

## Frontend tooling mandate

- **impeccable**: available and applied. Design laws honored — OKLCH tinted tokens, no side-stripe borders (full borders), motion ease-out ≤250ms, no gradient text, accent ≤10% (Restrained product register), no modal. The component is a product-register disclosure.
- **frontend-design plugin**: NOT installed in this environment — **documented skip** per AGENTS.md ("en opencode usar equivalente disponible o documentar el skip"). The project `sketch-findings-reel-factory` skill (read in full) + impeccable laws cover the gap.
- **sketch-findings-reel-factory**: honored — pure chevron disclosure (NOT the FxBlock switch idiom, which would wrongly read as "apagado"/disabled), green-discipline (`--accent` only, action-green reserved for Render CTA), OKLCH token grammar, motion + reduced-motion.

## Verification

- `npm run build:editor` — **PASSED** (190 modules transformed, built in 1.77s; pre-existing `use client` directive + chunk-size warnings are unrelated to this change).
- `npx vitest run` (full studio suite) — **PASSED**: 510/510 (27 files). Baseline 506 + 4 new collapsible-section tests = 510, 0 failures.
- `grep -n -- "--action" src/preview/CollapsibleSection.tsx` — returns nothing (green discipline held).
- `grep -c "CollapsibleSection" src/preview/PreviewApp.tsx` — 8 (≥3: 1 import + 2 usages + comments).

## Deviations from Plan

None — plan executed as written. The only minor adjustment: the component-header comment was reworded to avoid the literal string `--action`, so the plan's `grep -n "--action"` acceptance check returns nothing (the original wording referenced the token only in a "NEVER use" comment). No behavioral change.

## Scope notes

- STUDIO/preview-only. No renderer changes, no renderer sync, no composition changes (per constraints).
- The worktree lacked `node_modules`; symlinked from the main checkout (no installs) to satisfy the build + vitest gate. The symlink is a local artifact, never staged/committed.

## Manual follow-up (USER, not executor)

Live docker UAT: `docker compose build remotion-studio && docker compose up -d remotion-studio`, open :3123, Subtítulos tab — confirm both "Sample text" and "Browse Fonts" are collapsed by default, expand on header click, and that expanding sample-text and editing it updates the live caption preview.

## Self-Check: PASSED

- FOUND: services/remotion-studio/src/preview/CollapsibleSection.tsx
- FOUND: services/remotion-studio/src/preview/collapsible-section.test.tsx
- FOUND: services/remotion-studio/src/preview/PreviewApp.tsx
- FOUND commits: 96a8bc0, 3cbbaeb, 9d65755
