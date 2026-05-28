# Phase 19: Typography & text effects - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add typography controls — Plus Jakarta Sans (new default font), extended font size range, bold/italic toggles, and an outer glow effect — to the redesigned studio UI and wire them through to the Remotion renderer. All controls land in the existing `Subtitles` and `Titles` tabs built in Phase 18; no new tabs or layout changes.

**In scope:** Plus Jakarta Sans in fonts.ts (new default); font size slider extended to 200px for subtitles and titles; fontWeight (400/700) + fontStyle (normal/italic) toggles in SubtitleConfig and TitleStyleProps; new `OuterGlow` field in both configs (color, intensity-as-alpha, softness-as-blur); UI controls in Subtitles and Titles tabs; renderer respects all new fields.

**Out of scope:** New tabs or layout restructuring (Phase 18 built the framework); pixel-coordinate title positioning (Phase 20); PNG overlays (Phase 21); design-token system (deferred from Phase 18 D-07); functional render-video button (still disabled per Phase 18 D-05).

</domain>

<decisions>
## Implementation Decisions

### Outer glow (TYPO-04)
- **D-01:** Add a **new `outerGlow` field** to both `SubtitleConfig` and `TitleStyleProps` — separate from the existing `textShadow`. Schema: `{ enabled: boolean; color: string; intensity: number; softness: number }`.
  - `intensity` = alpha multiplier (0–1) applied to the glow color (opacity-based model, Photoshop-like mental model).
  - `softness` = blur radius in px (CSS `text-shadow` blur parameter).
  - CSS implementation: `text-shadow: 0 0 {softness}px {color-with-intensity-as-alpha}`.
- **D-02:** Outer glow applies to **both subtitles and titles** — `outerGlow` lands in `SubtitleConfig` (Subtitles tab) and `TitleStyleProps` (Titles tab) independently.

### Bold / italic (TYPO-03)
- **D-03:** `fontWeight` is a **boolean toggle** (false = 400/regular, true = 700/bold). Add `fontWeight?: boolean` to `SubtitleConfig` and a corresponding field to `TitleStyleProps`. The renderer maps `true` → CSS `font-weight: 700`, `false` → `font-weight: 400`.
- **D-04:** `fontStyle` is a **boolean toggle** (false = normal, true = italic). Add `fontStyle?: boolean` to `SubtitleConfig` and `TitleStyleProps`. Renderer maps `true` → CSS `font-style: italic`.
- **D-05:** Bold/italic applies to **both subtitles and titles**. Controls land in the Subtitles tab and Titles tab respectively.
- **Note:** `fontWeight` in `TikTokLayout.tsx:109` is currently hardcoded at 700 — this must become config-driven, reading `config.fontWeight` (defaulting to true/700 to preserve existing look).

### Font size range (TYPO-02)
- **D-06:** Subtitle font size slider extended from **24–120px to 24–200px**. Default (58) unchanged.
- **D-07:** Title font size controls (in `TitleEditor`) extended to the same **200px ceiling**.
- Both subtitle and title font size ranges are extended.

### Plus Jakarta Sans (TYPO-01)
- **D-08:** Import `PlusJakartaSans` from `@remotion/google-fonts/PlusJakartaSans`, add to `AVAILABLE_FONTS` and `FONT_LOADERS` in `fonts.ts`.
- **D-09:** Make Plus Jakarta Sans the **new default `fontFamily`** in `DEFAULT_SUBTITLE_CONFIG` (replacing Inter). Existing saved configs that already specify a fontFamily are unaffected — only the fallback/default changes.

### Renderer sync
- **D-10:** All changed files in `services/remotion-studio/src/compositions/` and shared modules (`fonts.ts`, `pipeline-config.ts`, `captions.ts` if touched) must be synced to `services/remotion-renderer/src/` per the AGENTS.md renderer-sync rules after modification.

### Claude's Discretion
- Exact UI control layout within the Subtitles and Titles tabs (toggle style for bold/italic, color picker for glow, slider for softness/intensity) — decide under `impeccable` + `frontend-design` guidance at plan/execute time.
- Whether `outerGlow` renders as a single CSS `text-shadow` layer or multiple stacked layers for a denser effect at high intensity values.
- Default values for `outerGlow` fields (suggested: enabled=false, color="#ffffff", intensity=0.8, softness=20).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 19: Typography & text effects" — goal + 4 success criteria
- `.planning/REQUIREMENTS.md` — TYPO-01 (Plus Jakarta Sans), TYPO-02 (larger font sizes), TYPO-03 (bold/italic), TYPO-04 (outer glow with color/intensity/softness)

### Prior phase decisions (building on)
- `.planning/phases/18-studio-ui-redesign/18-CONTEXT.md` — D-03 (tab structure: Subtitles/Titles/Text), D-08 (build for extension so phases 19–21 can plug in controls), D-07 (no design-token system), D-09 (manual Save keeps; live in-memory preview)

### Config schema (the source of truth for renderer/studio contract)
- `services/remotion-studio/src/pipeline-config.ts` — `SubtitleConfig`, `TitleStyleProps`, `DEFAULT_SUBTITLE_CONFIG`; add `outerGlow`, `fontWeight`, `fontStyle` fields here

### Font loading infrastructure
- `services/remotion-studio/src/fonts.ts` — 26-font curated set + `AVAILABLE_FONTS` + `FONT_LOADERS` map; add `PlusJakartaSans` and update default
- `services/remotion-renderer/src/fonts.ts` — mirror of the above; must be synced after studio changes

### UI control files (where new controls land)
- `services/remotion-studio/src/editor/components/StyleControls.tsx` — subtitle font size slider (extend 120→200), add bold/italic toggles, add glow controls
- `services/remotion-studio/src/editor/components/TitleEditor.tsx` — title font size (extend to 200), add bold/italic toggles, add glow controls

### Renderer composition files (where new fields are consumed)
- `services/remotion-studio/src/compositions/TikTokLayout.tsx` — `fontWeight` hardcoded at 700 → must read from config
- `services/remotion-studio/src/compositions/shared-styles.ts` — shared style helpers; glow CSS may land here
- Sync target: `services/remotion-renderer/src/compositions/` (all composition changes)

### Project conventions (non-negotiable)
- `AGENTS.md` §"UI/frontend work — REQUIRED tooling" — `impeccable` + `frontend-design` must be invoked at start of plan/execute
- `AGENTS.md` §"Development Conventions" — renderer-sync pattern; studio port 3123; `ACTIVE_PIPELINE_CONFIG_PATH`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`FONT_LOADERS` map in `fonts.ts`** — dynamic lookup by name; adding Plus Jakarta Sans is one import + one entry in the map.
- **`AVAILABLE_FONTS` const array** — ordered list; Plus Jakarta Sans should be position 0 (first) since it's the new default.
- **`TextShadow` in `SubtitleConfig`** — already exists (enabled/color/blur/offsetX/offsetY); the new `OuterGlow` field is a sibling, not a replacement.
- **`StyleControls.tsx`** — slider currently `min=24 max=120`; just needs `max={200}`. Color picker and additional sliders follow the existing inline-style pattern.
- **`TitleEditor.tsx`** — `titleFontSize`, `subtitleFontSize` controls; extend range to 200 and add bold/italic/glow rows following existing control pattern.

### Established Patterns
- **In-memory live edit + manual PUT save** — all new controls follow this: change fires `onChange(partial)`, persists only on Save (Phase 18 D-09).
- **Dark theme inline styles** — `#1a1a2e` bg, `#bbb` labels, `#fff` values, `#90caf9` accents. New controls must match.
- **`loadFont` signature** — `loadFont(style?, options?)` with optional first arg; the quick-task fix (2026-05-27) established the correct call pattern. Do NOT regress to the old positional call that caused the monospace fallback bug.
- **Renderer receives config via `pipeline-config.json`** — new fields flow automatically once added to the config schema and read in compositions.

### Integration Points
- `SubtitleConfig` and `TitleStyleProps` in `pipeline-config.ts` → changes flow to both studio (live preview) and renderer (render output) via the shared type.
- `DEFAULT_SUBTITLE_CONFIG` sets the fallback values — changing `fontFamily` here affects all users without a saved config.
- All 4 layout files (`TikTokLayout`, `BarLayout`, `KaraokeLayout`, `SentenceLayout`) read from `config` — check which ones have the hardcoded `fontWeight: 700` and update accordingly.

</code_context>

<specifics>
## Specific Ideas

- Plus Jakarta Sans should be the visual flagship of this milestone — it's explicitly named in PROJECT.md v1.3 target features and in the memory notes as the intended upgrade from Inter.
- Outer glow color/intensity/softness matches exactly how Photoshop / After Effects label the glow effect — user will find this mental model familiar.
- "Beyond current maximum" for font sizes (TYPO-02) = 200px ceiling — enough for large punchy captions without going to extremes.
- Bold/italic as boolean toggles (not sliders) keeps the UI clean and matches how most Reels/TikTok caption tools work.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope. All 4 requirements (TYPO-01 through TYPO-04) are covered by the decisions above.

</deferred>

---

*Phase: 19-typography-text-effects*
*Context gathered: 2026-05-28*
