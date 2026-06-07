---
phase: 260607-uzv-studio-edit-correcciones
plan: 01
subsystem: remotion-studio / preview
tags: [frontend, studio, preview, ux, green-discipline]
requires: []
provides:
  - "Pre-render Reemplazar/Quitar + Descargar affordances over the loaded-video preview"
affects:
  - services/remotion-studio/src/preview/PreviewApp.tsx
tech-stack:
  added: []
  patterns:
    - "Absolutely-positioned control cluster over the 9:16 stage, gated on uploadedFile && renderState===idle"
    - "Reuse the existing objectUrl memo for an <a download> href (no second URL.createObjectURL)"
key-files:
  created: []
  modified:
    - services/remotion-studio/src/preview/PreviewApp.tsx
decisions:
  - "Cluster gated on renderState===idle so it never overlaps the render progress/success/failure overlays (which mount only in non-idle states)"
  - "Download anchor disabled (pointer-events:none, muted, opacity 0.55) while objectUrl is transiently null to avoid a broken href"
  - "Accent-only styling (--accent on hover/focus, --surface-2 base); --action green stays reserved for the Render CTA"
metrics:
  duration: "~25m"
  completed: 2026-06-07
  tasks: 2
  files: 1
---

# Phase 260607-uzv Plan 01: PREVIEW — replace/clear + download uploaded video Summary

Added two pre-render affordances over the loaded-video preview in PreviewApp — "Reemplazar / Quitar video" (`setUploadedFile(null)` → returns to the dropzone) and "Descargar video" (`<a download={uploadedFile.name} href={objectUrl}>` reusing the existing object URL) — gated on `uploadedFile && renderState === "idle"`, accent-only styling, green-discipline preserved.

## What Was Built

A control cluster absolutely positioned at the top-right of the preview stage in `services/remotion-studio/src/preview/PreviewApp.tsx`, mounted only when a raw video is loaded and no render is in flight (`uploadedFile && renderState === "idle"`):

- **Reemplazar / Quitar video** — a `<button>` whose `onClick` calls `setUploadedFile(null)`. The existing dropzone-vs-player condition (`{!uploadedFile && renderState === "idle" ? <UploadDropzone .../> : ...}`) flips back to the `UploadDropzone`. No manual `URL.revokeObjectURL` — the existing `useEffect` cleanup on `objectUrl` change already revokes when `uploadedFile` becomes null.
- **Descargar video** — an `<a download={uploadedFile.name} href={objectUrl ?? undefined}>` styled as a button, reusing the existing `objectUrl` memo (no second `URL.createObjectURL`, avoiding the double-revoke/leak hazard). Guarded for the transient `objectUrl === null` case: disabled (`pointer-events:none`, muted color, `opacity:0.55`, `cursor:not-allowed`) so it can never produce a broken href.

Styling uses the established dark control idiom and tokens: `--surface-2` background, `1px solid var(--border)`, `--r-sm` radius, `--text` color, with `--accent` applied on hover/focus. The cluster's `renderState === "idle"` guard means it never overlaps the render progress / success / failure overlays, which only mount in non-idle states.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add Reemplazar/Quitar + Descargar controls over the loaded-video preview | b0dc872 | services/remotion-studio/src/preview/PreviewApp.tsx |
| 2 | Full studio vitest gate | (no code change) | — |

## Verification

- `npm run build:editor` (studio): **PASS** — 190 modules transformed, built in ~14s. The "use client" notice (from `@remotion/player`) and the chunk-size warning are pre-existing and benign.
- `npm test` (studio vitest): **PASS — 27 files, 518/518 tests, exit 0** (confirmed across two consecutive clean runs). No regression; count held at the pre-work 518.
- `grep -n "setUploadedFile(null)"` returns the new handler (line 831).
- Green-discipline: no `--action`/green tokens in the new block (all `--action` references in the file are pre-existing Render-CTA/save buttons).
- Manual Docker UAT (upload → confirm both controls appear, Quitar returns to dropzone, Descargar saves with original name) is the user's follow-up per constraints.

## Deviations from Plan

None — plan executed as written.

### Notes (not deviations)

- **Worktree node_modules**: the worktree lacked `node_modules`; per constraints I symlinked it from the main checkout (`ln -s` — no installs). The symlink is gitignored and was not committed.
- **vitest fork-pool flakiness**: the first `npm test` invocation reported 4 file errors / 10 "failures" that were all vitest worker-pool infrastructure timeouts ("Failed to start forks worker" / "Timeout waiting for worker to respond"), not assertion failures — a resource-contention artifact of running vitest's fork pool over the symlinked node_modules across the worktree path boundary. Two subsequent clean runs both reported 518/518 green with exit 0.
- **Worktree base reset**: at startup the worktree HEAD's merge-base did not match the expected base (`4b3e0f1`); per the branch-check protocol I `git reset --hard 4b3e0f1` before starting.
- **UI tooling mandate**: `impeccable` skill and the `frontend-design` plugin are not exposed as callable tools in this executor's environment; the loaded `sketch-findings-reel-factory` design system (read in full, green-discipline honored) governed the visual decisions. Documented skip per the AGENTS.md "document the skip" allowance.

## Self-Check: PASSED

- FOUND: services/remotion-studio/src/preview/PreviewApp.tsx (modified, contains `setUploadedFile(null)` + `download=`)
- FOUND: commit b0dc872 (`git log` verified on branch worktree-agent-a76d3634edbf6b052)
- No file deletions introduced by the commit.
