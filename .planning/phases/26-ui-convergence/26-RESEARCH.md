# Phase 26 — UI convergence · Research (north-star vs current gap)

Condensed from a full gap analysis against the sketch corpus (`.planning/sketches/`,
north-star v4/v5 = 037/044, nav-shell-v4 = 033, MANIFEST + WRAP-UP) and the
`sketch-findings-reel-factory` skill. Source of truth for Phase 26 scope.

## Chosen north-star (v4) — canonical direction
- 3-column Editor: 9:16 preview (flex 0 1 470px) · controls (flex 1) · 320px metadata column.
- Dense header action zone (preset → tabs → status + Guardar + Render).
- **Color law:** `--accent` (blue) for ALL selection/focus/current; `--action` (green) = the SINGLE primary CTA per surface; `--danger` (low-chroma red) for destructive/error — never borrows green.
- One sans (Inter), fixed type scale `--t-2xs…--t-2xl`; compact spacing `--s-1…--s-16`; calm motion 170ms ease-out-quart (`--dur`/`--ease`).
- Always-open titled sections (no collapsing disclosure); 9-point position presets (shared); TabLead/TabForm skeleton; specimen-driven mode cards above the form.
- Responsive: tab form 2-col→1-col at ~360px; metadata col hides <1024px.

## Current Studio — already converged
Tokens are defined in `services/remotion-studio/src/editor/index.html` `:root` (OKLCH) and applied broadly. Per-surface audit: render surfaces (F23), ProfilesMenu (F24), MetadataPanel (F25), OverlayEditor, PositionPresets, UploadDropzone, PreviewPlayer — **all use the shared tokens, blue active, calm motion → consistent.** UICONV-02 is largely already satisfied.

## Real divergences (Phase 26 scope)
| # | Divergence | Where | Size | In scope |
|---|-----------|-------|------|----------|
| 1 | **Color-law violation: green active state** | `LayoutSelector.tsx:51-52` (`#4CAF50` border + `rgba(76,175,80,.12)` bg) | SMALL | **26-01 (yes)** |
| 2 | Hardcoded type/spacing/color (should be `--t-*/--s-*/--accent`) scattered in editors | editor components | SMALL | 26-01 |
| 3 | No shared z-index ladder (toast/palette/takeover/sheet) | layered surfaces | SMALL | 26-01 |
| 4 | No responsive form reflow (@media) | form sections | MEDIUM | 26-02 |
| 5 | Layout-mode is radio section, not TabLead preset cards (011-C) | StyleControls/LayoutSelector | MEDIUM | 26-03 |
| 6 | Entrance animation is flat inputs, not preset cards (014-C) | TitleEditor | MEDIUM | 26-03 |
| 7 | Specimens are static, not live word-by-word animation (025-C) | Title/Subtitle tabs | LARGE | **OUT (follow-up)** |

## Explicitly OUT of Phase 26 scope (architectural, high-risk → Phase 27+)
- **Left activity rail** (033-B nav shell) — app-shell refactor (~40h, HIGH RISK; touches app architecture).
- **Header preset bar + TabBar consolidation into one row** (037-B) — depends on the rail; layout-brittleness risk.
- **Live specimen animation** (025-C) — large, depends on caption-renderer integration in edit mode.
- Results library / batch queue / pipeline inspection / command palette / settings sheet (frontier sketches) — separate phases.

These are flagged as follow-ups; their absence is "north-star depth not yet reached," NOT a divergence. UICONV-01 criterion (shell/nav/density/motion match the direction) is met by the existing 3-column shell + the convergence in 26-01..03; the rail is a future deepening.

## Verification approach (unattended)
Anchor every change to a sketch (color law, 011-C, 014-C, 018-B). Self-verify with Playwright screenshots (before/after) of the editor tabs + panels at desktop and ~360px. Keep the full studio test suite green; assert the color-law fix in tests (no `--action`/green token in LayoutSelector active state).
