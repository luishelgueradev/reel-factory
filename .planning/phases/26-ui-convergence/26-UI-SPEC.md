---
phase: 26-ui-convergence
type: ui-spec
requirements: [UICONV-01, UICONV-02]
tokens_source: services/remotion-studio/src/editor/index.html :root (OKLCH --action/--accent/--danger/--t-*/--s-*/--r-*/--ease/--dur)
mandatory_tooling: "impeccable + frontend-design (AGENTS.md) + sketch-findings-reel-factory; sketch-first vs .planning/sketches/"
---

# Phase 26 — UI convergence contract

The Studio must read as ONE product at north-star v4 quality. This is a *consistency &
convergence* pass, not a redesign. Anchor every change to a sketch.

## Non-negotiable laws (apply everywhere)
- **Color law:** `--accent` (blue) = ALL selection / focus / current / active states. `--action` (green) = exactly ONE primary CTA per surface (Render in Editor; "Elegir archivo" at cold-start; nothing else green). `--danger` (low-chroma red) = destructive/error only, never borrows green. **Zero hardcoded `#4CAF50`/green on active states.**
- **Token discipline:** every color, font-size, spacing, radius, duration uses the `:root` token (or a documented fallback). No stray hardcoded px/hex where a token exists.
- **Motion:** 170ms `--ease` (ease-out-quart) for UI transitions; respect `prefers-reduced-motion`.
- **Density:** compact `--s-*` rhythm; always-open titled sections; no collapsing disclosure.

## Per-surface bar (UICONV-02 — all must match)
Editor tabs (Títulos/Overlays/Subtítulos), render surfaces (F23), ProfilesMenu (F24),
MetadataPanel (F25), UploadDropzone, PreviewPlayer — all share: the same SectionHeader
pattern, blue active states, token spacing/type, calm motion, designed empty/error states.
No panel may look bolted-on (different radii, colors, density, or motion).

## Convergence deliverables
1. **Color-law + token sweep (26-01):** fix LayoutSelector green→`--accent`; replace any remaining hardcoded type/spacing/color with tokens across editor components + render surfaces; add a shared z-index ladder (toast 60 ▸ palette 40 ▸ takeover 30 ▸ sheet 20) and apply to layered surfaces (ProfilesMenu popover, render overlays, metadata) so layering is consistent.
2. **Responsive reflow (26-02):** at ~360px the tab form grids collapse 2-col→1-col and card rows reflow (018-B); metadata column hides <1024px (confirm existing behavior).
3. **Specimen-driven preset cards (26-03):** Titles entrance presets (014-C) and Subtitles layout modes (011-C) become **blue-active preset cards leading the form** (replacing the green-bordered radio LayoutSelector and the flat entrance inputs). **Static cards** — no live animation (deferred). Keeps all existing config fields/behavior.

## Acceptance (visual, self-verified via Playwright screenshots)
- Side-by-side with north-star sketches reads as deliberate convergence.
- Exactly one green element per surface; no green on any active/selected control.
- The three new surfaces (F23/F24/F25) are visually indistinguishable in quality/density from the Phase-22 editor surfaces.
- Desktop (~1280px) and narrow (~360px) both render without overflow; form reflows.
- Reduced-motion honored.

## Out of scope (Phase 27+)
Left activity rail (033) + header consolidation (037); live specimen animation (025-C); frontier screens (results/queue/inspection/palette/settings).
