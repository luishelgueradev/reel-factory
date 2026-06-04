---
phase: 26-ui-convergence
mode: autonomous
generated_by: orchestrator (unattended; scope from 26-RESEARCH.md gap analysis vs sketch corpus)
date: 2026-06-04
requirements: [UICONV-01, UICONV-02]
research: 26-RESEARCH.md
---

# Phase 26 — UI convergence (impeccable) · Context

## Goal
The whole Studio reads as one cohesive product at the north-star quality level; the
render-progress (F23), metadata (F25), and profiles (F24) surfaces are visually integrated
with the existing shell — not bolted on.

## Success criteria → requirements
1. Shell, navigation, control density, motion match the chosen north-star (037/044/033) — deliberate convergence, not divergence. (UICONV-01)
2. The F23-25 surfaces are integrated at the same visual quality bar — no inconsistent panels. (UICONV-02)

## Decisions (D-NN)
- **D-01 — Converge within the existing 3-column Editor shell.** The audit (26-RESEARCH) shows the Studio already matches the north-star on shell/density/motion and that the F23-25 surfaces already share the token system. Phase 26 closes the *real* divergences, it does NOT restructure.
- **D-02 — The left activity rail (033) + header/TabBar consolidation (037) are OUT of scope** — they are a ~40h app-shell refactor (HIGH RISK), inappropriate for an unattended run and not required by the literal criteria. Captured as a Phase 27+ follow-up. Their absence is "north-star depth," not divergence.
- **D-03 — Live specimen animation (025-C) is OUT of scope** — large, depends on caption-renderer-in-edit-mode; follow-up todo.
- **D-04 — Color law is non-negotiable:** `--accent` (blue) for all selection/focus/current; `--action` (green) only for the single primary CTA per surface; `--danger` for destructive/error. Fix the one violation (LayoutSelector green active) and assert it in tests.
- **D-05 — Token discipline:** no hardcoded colors/type/spacing where a token exists; standardize to `--t-*`/`--s-*`/`--r-*`/`--accent`/`--ease`/`--dur` across all surfaces.
- **D-06 — Specimen-driven preset cards (26-03)** follow the documented sketches (014-C entrance cards, 011-C layout-mode TabLead cards) exactly; **static cards** (no live animation), blue active state. Conservative restyle of existing controls into the validated card pattern.
- **D-07 — Self-verify visually:** capture Playwright screenshots (basic-auth) of the editor tabs + panels at desktop (~1280px) and narrow (~360px), before and after, to confirm convergence (not divergence) since no human is present.
- **D-08 — No behavior/functional change.** This is a visual/structural convergence; all existing tests must stay green; render/profiles/metadata logic untouched.

## Constraints honored
- remotion-studio port ALWAYS 3123.
- UI work → `impeccable` + `frontend-design` non-negotiable (AGENTS.md); sketch-first against `.planning/sketches/` + `sketch-findings-reel-factory`.
- Studio-only; no renderer sync.
- Green discipline preserved everywhere.

## Out of scope (Phase 27+ follow-ups)
- Left activity rail / app-shell nav (033) + header consolidation (037).
- Live specimen animation (025-C).
- Results library, batch queue, pipeline inspection, command palette, settings sheet (frontier sketches).
