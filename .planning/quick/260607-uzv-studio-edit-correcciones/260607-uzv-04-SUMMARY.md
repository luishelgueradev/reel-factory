# Quick 260607-uzv-04: Studio edit corrections (live-UAT follow-up) Summary

Four Studio editing issues fixed after live UAT — replace/download button placement,
symmetric title-box width resize, gradient-on-text, and the non-rendering tiktok
per-word background. FRONTEND + renderer sync (item 3) + renderer-direct edit (item 4).

## Tooling (frontend mandate)

- `sketch-findings-reel-factory` skill: loaded and honored — green-discipline
  (download/replace use `--accent`, never `--action` green), token grammar
  (`--s-*` / `--t-*` / `--r-*` / `--ease` / `--dur`), no side-stripe borders.
- `impeccable` skill / `frontend-design` plugin: not available as invokable tools
  in this execution environment. **Documented skip.** Applied the codified design
  rules from the project skill directly; item 1 (button placement) was treated as
  an explicit layout-judgment task per the mandate.

## Items

### Item 1 — replace/download buttons relocated (impeccable layout task)
- **Before:** the "Reemplazar / Quitar video" + "Descargar video" buttons were
  absolutely positioned (`top/right`, `zIndex 20`) over the TOP edge of the 9:16
  preview, overlapping the video frame — cramped and unaligned.
- **After:** the stage column is now a vertical flex column. The player area
  (`flex:1`, centered, relative — still hosts the render-state overlays) sits above
  a deliberate, right-aligned action row that never overlaps the frame.
- Extracted `StageActionButton` — compact ghost buttons (transparent bg, hairline
  border, `--accent` border/text/tint on hover+focus), glyphs `↻ Reemplazar` /
  `⤓ Descargar`. Green stays the Render CTA only.
- Behavior unchanged: Reemplazar → `setUploadedFile(null)`; Descargar →
  `<a download={uploadedFile.name} href={objectUrl}>` (disabled until objectUrl ready).
- Studio-only (`PreviewApp.tsx`). No renderer sync.
- Commit `d6fa16e`.

### Item 2 — title box width resizes symmetrically around its center
- **Root cause:** TitleOverlay renders the box at `left:(x/1080)*100%` +
  `width:backgroundWidth%`, so growing the width extended only rightward.
- **Fix (editor-side only):** added pure `computeCenteredXForWidth(oldX, oldW%,
  newW%)` — when width% changes by Δpct, shift `x` by `-Δpx/2`
  (`Δpx = Δpct/100*1080`) so the box's horizontal center stays fixed, clamped to
  `[0, 1080-newWidthPx]` to keep the box on-frame. Wired into the "Ancho caja"
  RangeRow `onChange`.
- No rendering/migration change — TitleOverlay still reads `x` + `backgroundWidth`.
- Unit test (`title-width-center.test.ts`, 6 cases): center-invariance on grow and
  shrink, the half-delta formula, both clamp edges, and the no-op case.
- Studio-only (`TitleEditor.tsx`). No renderer change.
- Commit `b98a0f8`.

### Item 3 — gradient applicable to the TEXT (not only the box)
- Chose the additive **`target` selector** over a separate toggle:
  `backgroundGradient.target?: "box" | "text" | "both"`, omitted ⇒ `"box"`
  (back-compat — pre-existing configs keep box-only behavior).
- `TitleOverlay`: when target is `text`/`both`, the same vertical
  (`to bottom`, from→to) gradient is clipped to the glyphs via
  `background-image` + `-webkit-background-clip:text` + `background-clip:text` +
  transparent fill (spread last so it overrides the flat `titleColor`); box-only
  path is byte-unchanged when target is `box`.
- `TitleEditor`: "Aplicar a: Caja / Texto / Ambos" segmented control inside the
  Degradado block (visible only when the gradient is On), using the existing
  `segBtnStyle` selection grammar.
- Schema type + validation added in BOTH services (unknown target rejected).
- **Renderer sync performed:** `TitleOverlay.tsx` + `pipeline-config.ts` copied
  studio→renderer (only the changed files), verified byte-identical via `diff`.
  Full renderer vitest re-run after the sync (clobber-hazard check) — green.
- Regression tests: target box/text/both accepted, unknown target rejected (both
  services).
- Commit `eae0eb5`.

### Item 4 — tiktok per-word background not rendering (REAL BUG)
- **Root cause:** `wordBackground` was missing from the subtitle-config whitelist
  that rebuilds `SubtitleConfig` in BOTH `SubtitledVideo.tsx` (studio preview) and
  `Root.tsx` (renderer real render) — so it was stripped before reaching
  `TikTokLayout`. The per-word rendering (`getWordBackgroundStyle` →
  `CaptionWord`) was already wired and tested; only the whitelist dropped it.
- **Fix:** added `wordBackground: subtitleConfig?.wordBackground` next to
  `backgroundHighlight` in both config builds. `Root.tsx` is renderer-only —
  edited directly, NOT cp'd between services (per the sync rules).
- Regression guard in each service asserting the field survives the whitelist
  (source-assertion, matching the existing item-4 pattern in
  `tiktok-word-background.test.tsx`, since the full composition needs Remotion
  hooks unavailable in jsdom).
- `pipeline-config` unchanged for this item.
- Commit `be565ca`.

## Deliberate design override (impeccable)

Item 3 ships **gradient-clipped text**, which the impeccable design language
normally bans. The user explicitly requested it for video titles; implemented per
the request and isolated behind the opt-in `target` field (default stays box-only),
so the override never leaks into existing titles.

## Renderer sync

- Item 3 ONLY: `services/remotion-studio/src/compositions/TitleOverlay.tsx` and
  `services/remotion-studio/src/pipeline-config.ts` copied to the renderer mirrors;
  `diff` confirms byte-identical. Full renderer vitest re-run post-sync.
- Item 4: `Root.tsx` edited directly in the renderer (renderer-only, no cp).
  `SubtitledVideo.tsx` / `Root.tsx` were NOT synced between services.

## Gate

| Check | Result |
|-------|--------|
| `npm run build:editor` | PASS |
| Studio vitest | 549 passed / 29 files (538 baseline + 11 new) |
| Renderer vitest | 359 passed / 12 files (355 baseline + 4 new) |
| Renderer mirror parity (item 3) | byte-identical (TitleOverlay + pipeline-config) |

## Commits

| Item | Hash | Type |
|------|------|------|
| 1 — replace/download action row | `d6fa16e` | fix |
| 2 — symmetric title width resize | `b98a0f8` | fix |
| 3 — gradient on text | `eae0eb5` | feat |
| 4 — tiktok word background reaches layout | `be565ca` | fix |

## Notes

- Worktree `HEAD` was reset to the required base `6d293b9` at startup (the branch
  was forked from `8c94196`, an unrelated tip; the sanctioned `<worktree_branch_check>`
  reset applied).
- `node_modules` symlinked from the main checkout (no installs in the worktree).
- Live docker UAT is the user's manual follow-up — not attempted.
- Per constraints: ROADMAP/STATE not touched; this SUMMARY is uncommitted.

## Self-Check: PASSED

- Files exist: PreviewApp.tsx, TitleEditor.tsx, title-width-center.test.ts,
  TitleOverlay.tsx (both), pipeline-config.ts (both), SubtitledVideo.tsx, Root.tsx,
  subtitled-video-config-build.test.ts, root-config-build.test.ts — all present.
- Commits `d6fa16e`, `b98a0f8`, `eae0eb5`, `be565ca` all present in `git log`.
