# Phase 28: Subtítulos pro — bar background por palabra - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — autonomous overnight run)

<domain>
## Phase Boundary

In the **tiktok** subtitle style, each highlighted word can have a configurable rectangular "bar" background (color, transparency, border-radius, padding) that looks identical in the Studio preview and the final render. The off-brand **karaoke** style is removed from the options.

Requirements: SUB-01 (toggle per-word bar bg on highlighted word in tiktok), SUB-02 (configure color/transparency/border-radius/padding), SUB-03 (preview↔render parity), SUB-04 (remove karaoke style entirely).
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (with strong steers from codebase exploration)

- **Per-word bar bg (SUB-01..03):** add a new optional config group to `SubtitleConfig` (in `services/remotion-studio/src/pipeline-config.ts`, mirrored in renderer). Suggested shape: `wordBackground?: { enabled: boolean; color: string; opacity: number; borderRadius: number; padding: number }` (flat fields are also fine — match the existing SubtitleConfig style, e.g. how `outerGlow` is structured). Defaults: disabled, so existing behavior is unchanged.
  - **AVOID NAMING COLLISION:** there is already a subtitle LAYOUT mode called `"bar"` (`BarLayout.tsx`) — that is a different feature (a full-width caption bar layout). The new per-word feature is a background drawn behind each highlighted WORD inside the **tiktok** layout. Name it `wordBackground` / "fondo por palabra", NOT "bar layout".
  - Implement the rendering in `services/remotion-studio/src/compositions/TikTokLayout.tsx` (the per-word highlight render). Draw a rounded rectangle fill behind the active/highlighted word using the configured color+opacity+borderRadius+padding. Then **mirror to `services/remotion-renderer/src/compositions/TikTokLayout.tsx`** via the AGENTS.md `cp compositions/*` sync, and re-run renderer vitest (clobber hazard).
  - UI controls: add to the subtitle style editor (StyleControls / the Subtítulos tab editor under `services/remotion-studio/src/editor/components/`). Follow the existing control idiom (toggle + color swatch + opacity/radius/padding sliders, like the title `outerGlow`/caja controls). Live preview must update (live/committed state via PreviewApp).

- **Remove karaoke (SUB-04):** remove `"karaoke"` from `SubtitleLayoutMode` union (`pipeline-config.ts`, both services); delete `KaraokeLayout.tsx` in BOTH services; remove the karaoke branch from `LayoutDispatcher.tsx` (both services); remove the karaoke option from `LayoutSelector.tsx` (+ its tests, layout-mode-cards.test.tsx); remove karaoke from the renderer `validate.ts` allowed-modes list and `pipeline-config.ts` validation.
  - **Migration safety:** existing pipeline-config.json / profiles may have `layout: "karaoke"`. Coerce/fallback to `"tiktok"` on load/validate rather than hard-crashing (the renderer validate path and the studio applyConfigToState should map an unknown/removed `karaoke` → `tiktok`). Confirm no saved profile is left unloadable.

### Constraints (LOCKED)
- UI tooling non-negotiable: invoke `impeccable` + `frontend-design` at execute start for the editor-UI work; honor `sketch-findings-reel-factory` (subtitle styling controls idiom) + green-discipline (--action green = Render CTA only; subtitle controls use --accent).
- Renderer sync MANDATORY: `compositions/*` (TikTokLayout, LayoutDispatcher, deletion of KaraokeLayout) and shared `src/*` (pipeline-config.ts, captions.ts if touched) must be mirrored studio→renderer per AGENTS.md, and the renderer vitest RE-RUN after EVERY sync (clobber hazard). Do NOT sync Root.tsx / SubtitledVideo.tsx.
- Preview↔render parity (SUB-03) is the core risk: the same SubtitleConfig must produce a pixel-identical per-word bar in both. Keep the drawing logic in the shared composition file that is mirrored verbatim.
- Worker concurrency hard limit 1.
</decisions>

<code_context>
## Existing Code Insights

- Layout mode union + SubtitleConfig + validation: `services/remotion-studio/src/pipeline-config.ts` (mirror in renderer). `SubtitleLayoutMode = "tiktok" | "sentence" | "bar" | "karaoke"`.
- Layout components (synced studio→renderer via `cp compositions/*`): `compositions/TikTokLayout.tsx`, `KaraokeLayout.tsx`, `BarLayout.tsx`, `SentenceLayout.tsx`, `LayoutDispatcher.tsx`, `shared-styles.ts`.
- Layout selector UI: `services/remotion-studio/src/editor/components/LayoutSelector.tsx` (+ tests: LayoutSelector.test.tsx, layout-mode-cards.test.tsx).
- Renderer allowed-modes validation: `services/remotion-renderer/src/validate.ts` + `pipeline-config.ts`.
- Subtitle style editor (where to add the controls): `services/remotion-studio/src/editor/components/` (StyleControls / Subtítulos tab) + live/committed wiring in `PreviewApp.tsx`.
- Tests: studio vitest (currently 477) + renderer vitest (currently 332). Both must stay green.
</code_context>

<specifics>
## Specific Ideas

The per-word bar background is the TikTok/Reels look where each highlighted word sits on its own rounded colored rectangle. It is a property of the tiktok highlight, configurable (color/opacity/radius/padding), off by default. Karaoke is being deleted because the user finds it off-brand/horrible.
</specifics>

<deferred>
## Deferred Ideas

- Per-word bar background on non-tiktok styles (Future Requirements).
</deferred>
