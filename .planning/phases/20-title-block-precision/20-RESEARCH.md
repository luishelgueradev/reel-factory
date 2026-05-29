# Phase 20: Title Block Precision — Research

**Researched:** 2026-05-29
**Domain:** Remotion React composition editing / TypeScript schema migration / dark-theme inline-style UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Positioning input is typed number fields only — two inputs in `TitleEditor`: `X (px)` and `Y (px)`. No drag-to-place.
**D-02:** X input range: 0–1080. Y input range: 0–1920. Full frame coverage.
**D-03:** x/y pixel coordinates map to the 1080×1920 render frame.
**D-04:** Anchor point is the top-left corner of the title block. CSS: `left: ${(x/1080)*100}%`, `top: ${(y/1920)*100}%` — no center transform.
**D-05:** Clean break — remove `topOffset` from `TitleStyleProps`; add `x?: number` and `y?: number`. No backward-compat dual-path.
**D-06:** Default values for new title blocks: x: 200, y: 960.
**D-07:** Full schema removal — remove `subtitle?: string` from `TitleConfig`; remove subtitle rendering from `TitleOverlay.tsx`; remove subtitle input from `TitleEditor`. No migration.
**D-08:** Also remove subtitle-only styling fields from `TitleStyleProps`: `subtitleFontSize`, `subtitleColor`, `subtitleFontFamily`.
**D-09:** Add `borderRadius?: number` to `TitleStyleProps`. Currently hardcoded value of `12` becomes the default.

### Claude's Discretion

- Slider range for `borderRadius` input (suggested: 0–50px, with 12 as default).
- Whether to label inputs "X" / "Y" or "Left offset" / "Top offset" for clarity.
- Visual layout of the two coordinate inputs in `TitleEditor` (side by side vs stacked).
- Default values for `borderRadius` if not present in existing config (12px to match prior hardcoded behavior).

### Deferred Ideas (OUT OF SCOPE)

- Drag-to-place on preview — placing title blocks by dragging on the video preview.
- Design-token system (deferred from Phase 18 D-07).
- Functional render-video button (still disabled per Phase 18 D-05).
- PNG overlays (Phase 21).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TITLE-01 | User can position title blocks by pixel coordinates (not percentages) | Schema change: remove `topOffset`, add `x?: number`, `y?: number`; CSS pixel→percent conversion in `TitleOverlay`; x/y number inputs in `TitleEditor` |
| TITLE-02 | User can configure border-radius on title block containers | Schema change: add `borderRadius?: number` to `TitleStyleProps`; replace hardcoded `"12px"` in `TitleOverlay`; slider control in `TitleEditor` |
| TITLE-03 | Title blocks have no subtitle field; a subtitle is added as a separate title block | Remove `subtitle`, `subtitleFontSize`, `subtitleColor`, `subtitleFontFamily` from schema, rendering, and editor UI; remove from list display |

</phase_requirements>

---

## Summary

Phase 20 is a focused schema migration and UI cleanup with three atomic changes: pixel-coordinate positioning (remove `topOffset`, add `x`/`y`), configurable border-radius (expose the hardcoded `12px`), and subtitle field removal. All changes are co-located in exactly five files: `pipeline-config.ts` (schema), `TitleOverlay.tsx` (rendering), and `TitleEditor.tsx` (editor UI) in remotion-studio, with the composition files then synced to remotion-renderer.

The scope is narrow but the changes must be applied atomically: the schema, rendering, and editor UI all reference the same deprecated fields (`topOffset`, `subtitle`, `subtitleFontSize`, `subtitleColor`, `subtitleFontFamily`). A partial update — e.g., removing the field from the schema but not from `DEFAULT_TITLE_STYLE` in either `TitleOverlay.tsx` or `TitleEditor.tsx` — will cause TypeScript compilation errors. Both files maintain their own local `DEFAULT_TITLE_STYLE` constant, both of which must be updated.

The existing `pipeline-config.json` on disk contains `topOffset` values (e.g., 10, 23, 17) for three live title blocks — no subtitle values. These will silently lose their positioning after the migration (clean break per D-05). The planner should note this data-loss behavior in execution notes so it is not treated as a bug.

**Primary recommendation:** Execute the three changes in strict atomic order — schema first, then rendering, then editor UI — with the renderer sync as the final step. Running vitest on the renderer's `pipeline-config.test.ts` after schema edits catches regressions before touching UI code.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Title block pixel positioning (TITLE-01) | Frontend Server (Remotion composition) | Editor UI (TitleEditor.tsx) | Coordinate → CSS percent conversion lives in `TitleOverlay.tsx`; editor inputs collect x/y values |
| Configurable border-radius (TITLE-02) | Frontend Server (Remotion composition) | Editor UI (TitleEditor.tsx) | `borderRadius` CSS value applied in `TitleOverlay.tsx`; slider in editor |
| Subtitle field removal (TITLE-03) | Config Schema (`pipeline-config.ts`) | Rendering + Editor UI | Schema is the authoritative removal point; rendering and editor follow schema |
| Schema validation | Config Schema + Renderer test | — | `validatePipelineConfig` in `pipeline-config.ts`, tested via `pipeline-config.test.ts` in remotion-renderer |
| Renderer sync | Build / DevOps | — | `cp` command per AGENTS.md renderer-sync rules |

---

## Standard Stack

### Core (no new packages — this phase is code-only)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `remotion` | 4.0.457 | `AbsoluteFill`, `useCurrentFrame`, `interpolate` — composition rendering | Already installed [VERIFIED: codebase] |
| `@remotion/player` | 4.0.457 | `<Player>` in studio preview — live preview updates on config change | Already installed [VERIFIED: codebase] |
| `react` | ^19.0.0 | Component model for `TitleEditor.tsx` | Already installed [VERIFIED: codebase] |
| `vitest` | (via renderer) | Test framework for `pipeline-config.test.ts` | Installed in remotion-renderer [VERIFIED: codebase] |

**No new packages are required for Phase 20.** All changes are TypeScript/React edits to existing files.

### Package Legitimacy Audit

> Phase 20 installs zero external packages. This section is not applicable.

**Packages removed due to slopcheck:** none (no new installs)
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
TitleEditor.tsx (UI)
    │  onChange(partial) on every keystroke
    ▼
PreviewApp.tsx (in-memory state)
    │  titles[] array with x, y, borderRadius
    ▼
TitleOverlay.tsx (Remotion composition)
    │  left: ${(x/1080)*100}%
    │  top:  ${(y/1920)*100}%
    │  borderRadius: ${borderRadius ?? 12}px
    │  (no subtitle render)
    ▼
AbsoluteFill container (1080×1920 render frame)
    │
    ├── Studio: @remotion/player (live preview)
    └── Renderer: renderMedia() (actual render output)
```

The `AbsoluteFill` wrapper fills the entire 1080×1920 frame in both studio (Player) and renderer (renderMedia). The child `div` with `position: "absolute"` + `left`/`top` percentages lands pixel-perfectly at the intended coordinate in both contexts because the percentage is calculated against the same 1080×1920 frame dimensions.

### Recommended Project Structure

No structural changes — Phase 20 edits existing files only:

```
services/remotion-studio/src/
├── pipeline-config.ts          ← schema changes (TitleStyleProps, TitleConfig)
├── compositions/
│   └── TitleOverlay.tsx        ← rendering changes (positioning, borderRadius, remove subtitle)
└── editor/components/
    └── TitleEditor.tsx         ← UI changes (x/y inputs, borderRadius slider, remove subtitle)

services/remotion-renderer/src/
├── pipeline-config.ts          ← sync target
└── compositions/
    └── TitleOverlay.tsx        ← sync target (cp from studio)
```

### Pattern 1: Pixel-to-Percent Coordinate Conversion

**What:** Convert 1080×1920 pixel coordinates to CSS percentage for `AbsoluteFill` children.
**When to use:** Any time a composition element must be positioned by pixel coordinate relative to the render frame.

```typescript
// Source: CONTEXT.md D-04 (locked decision)
// Anchor: top-left corner of the block
// No centering transform — clean absolute placement
<div
  style={{
    position: "absolute",
    left: `${(x / 1080) * 100}%`,
    top:  `${(y / 1920) * 100}%`,
    // No transform: "translate(-50%, -50%)" — D-04 specifies top-left anchor
    backgroundColor,
    borderRadius: `${borderRadius ?? 12}px`,
    // ...rest of existing styles
  }}
>
```

The existing code uses `top: \`${topOffset}%\`` + `transform: "translate(-50%, -50%)"` for center-anchoring. Phase 20 removes both the `topOffset` read and the centering transform entirely, replacing them with direct `left`/`top` percentage placement.

### Pattern 2: Entrance Animation with translateY

The entrance animations (`slide-up`, `slide-down`) apply a `translateY` value via `transform`. After removing the centering `translate(-50%, -50%)`, the transform becomes `translateY(${translateY}px)` alone (only during animation; when `translateY === 0`, no transform needed or it can remain as `translateY(0px)` with no visual impact).

```typescript
// Source: current TitleOverlay.tsx (existing animation logic — unchanged by Phase 20)
// Before Phase 20:
transform: `translate(-50%, -50%) translateY(${translateY}px)`

// After Phase 20 (remove centering, keep only animation offset):
transform: translateY !== 0 ? `translateY(${translateY}px)` : undefined
// OR simply:
transform: `translateY(${translateY}px)`  // 0px has no effect
```

The `translateY` variable is non-zero only during entrance animation; it's computed from `interpolate(frame, [0, endFrame], [200, 0])` or `[-200, 0]`. Setting the transform to `translateY(0px)` when not animating is safe (no visual impact).

### Pattern 3: Schema Field Removal in TypeScript

**What:** Removing optional fields from interfaces requires removing all read sites, not just the interface declaration.

**All sites for each removed field:**

`topOffset`:
- `TitleStyleProps` interface in `pipeline-config.ts` (studio + renderer) — delete the property
- `DEFAULT_TITLE_STYLE` in `TitleOverlay.tsx` (studio + renderer) — remove `topOffset: 50`, add `x: 200, y: 960`
- `DEFAULT_TITLE_STYLE` in `TitleEditor.tsx` — same removal + addition
- `TitleOverlay.tsx` render: remove `const topOffset = ...` and `top: \`${topOffset}%\``
- `TitleEditor.tsx` — remove topOffset slider div
- `validatePipelineConfig` in `pipeline-config.ts` — remove `topOffset` range validation (lines ~411-413)

`subtitle`:
- `TitleConfig` interface in `pipeline-config.ts` (studio + renderer) — delete `subtitle?: string`
- `TitleOverlayProps` interface in `TitleOverlay.tsx` — delete `subtitle?: string`
- `TitleOverlay.tsx` component signature: remove `subtitle` from destructuring
- `TitleOverlay.tsx` render: remove the `{subtitle && <span>...}` block; remove `gap: subtitle ? "12px" : "0"` (becomes `gap: "0"`)
- `TitleEditor.tsx` — remove `subtitle: ""` from `newTitle` initial state + `resetForm`; remove subtitle input div; remove `subtitle: newTitle.subtitle || undefined` from `handleAdd` and `handleSaveEdit`; remove `{title.subtitle && <div>...}` from list display

`subtitleFontSize`, `subtitleColor`, `subtitleFontFamily`:
- `TitleStyleProps` interface — delete all three
- `DEFAULT_TITLE_STYLE` in `TitleOverlay.tsx` — delete `subtitleFontSize: 42`, `subtitleColor: "#FFFFFF"`, `subtitleFontFamily: "PlusJakartaSans"`
- `DEFAULT_TITLE_STYLE` in `TitleEditor.tsx` — same deletions
- `TitleOverlay.tsx` — remove `const subtitleFontSize = ...`, `const subtitleColor = ...`, `const subtitleFontFamily = ...`, `const subtitleFontCSS = ...`; remove font loading for `subtitleFontFamily` in `fontsToLoad`
- `TitleEditor.tsx` — remove Subtitle Color color picker column; remove Subtitle Size slider; remove Subtitle Font select
- `validatePipelineConfig` in `pipeline-config.ts` — remove `subtitleFontSize` range validation (lines ~408-410)

### Pattern 4: DEFAULT_TITLE_STYLE After Phase 20

`TitleStyleProps` will lose `topOffset`, `subtitleFontSize`, `subtitleColor`, `subtitleFontFamily` and gain `x`, `y`, `borderRadius`. The `Required<TitleStyleProps>` used in `DEFAULT_TITLE_STYLE` will require all new fields and forbid removed ones.

```typescript
// After Phase 20 — DEFAULT_TITLE_STYLE in TitleOverlay.tsx and TitleEditor.tsx:
const DEFAULT_TITLE_STYLE: Required<TitleStyleProps> = {
  entranceAnimation: "slide-up",
  backgroundColor: "rgba(0,0,0,0.7)",
  textColor: "#FFFFFF",
  titleFontSize: 72,
  titleColor: "#FFFFFF",
  titleFontFamily: "PlusJakartaSans",
  x: 200,           // D-06
  y: 960,           // D-06
  borderRadius: 12, // D-09
  lineHeight: 1.2,
  padding: 40,
  fontWeight: true,
  fontStyle: false,
  outerGlow: { enabled: false, color: "#ffffff", intensity: 0.8, softness: 20 },
};
```

Note: `textColor` is kept in `TitleStyleProps` (it's a fallback for `titleColor`/`subtitleColor`). Only the subtitle-specific display fields are removed.

### Anti-Patterns to Avoid

- **Partial schema migration:** Removing fields from the interface but leaving them in `DEFAULT_TITLE_STYLE` — TypeScript will error because `Required<TitleStyleProps>` will not include removed fields.
- **Keeping centering transform after anchor change:** The old `translate(-50%, -50%)` centers the block on the percentage point. D-04 specifies top-left anchor — the centering transform must be removed entirely.
- **Forgetting DEFAULT_TITLE_STYLE in TitleEditor.tsx:** `TitleEditor.tsx` has its own standalone `DEFAULT_TITLE_STYLE` constant (line 25–38) that is NOT `Required<TitleStyleProps>` — it's a plain object. Both files need updating.
- **Syncing Root.tsx or SubtitledVideo.tsx to renderer:** AGENTS.md explicitly forbids copying these. Only `TitleOverlay.tsx` and `pipeline-config.ts` are sync targets.
- **Double-font loading for subtitle after removal:** `TitleOverlay.tsx` loads both `titleFontFamily` and `subtitleFontFamily` via `fontsToLoad`. After subtitle removal, only `titleFontFamily` should be loaded. Failing to update this causes a dead reference to a removed variable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pixel-to-CSS coordinate conversion | Custom pixel-to-% utility function | Inline `${(x/1080)*100}%` | Two-line math; no abstraction needed |
| Clamping number input values | JavaScript clamp logic | HTML `min`/`max` attributes on `<input type="number">` | Browser enforces range on submit; UI-SPEC specifies HTML attributes only (per UI contract) |
| Custom slider for border-radius | Custom range component | `<input type="range" min={0} max={50} step={1}>` | Existing slider pattern in TitleEditor; UI-SPEC specifies identical HTML input |

**Key insight:** Phase 20 contains no algorithmic complexity — all the hard decisions (coordinate model, anchor point, default values) are locked in CONTEXT.md. The implementation is mechanical substitution in five known files.

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `pipeline/pipeline-config.json` has 3 title blocks with `topOffset` values (10, 23, 17); no `subtitle` values | Code edit only — after Phase 20, existing `topOffset` values in saved JSON will be ignored (no longer read); blocks will render at default x: 200, y: 960. No data migration. |
| Live service config | remotion-studio server (port 3123 if running) — serves the editor UI | No config change needed; server restarts after `npm run build:editor` |
| OS-registered state | None — no OS-level registration of title field names | None |
| Secrets/env vars | None — no env vars reference `topOffset`, `subtitle`, or subtitle style fields | None |
| Build artifacts | `dist/editor/` — stale build if present | Rebuild via `npm run build:editor` after edits |

**Data loss note:** Existing `topOffset` values in `pipeline-config.json` will be silently dropped when the schema no longer reads that field. This is intended behavior per D-05 (clean break). No user-data migration is required or possible — the old percentage-based positions do not map cleanly to the new pixel coordinate model.

---

## Common Pitfalls

### Pitfall 1: TypeScript Required<TitleStyleProps> enforces all properties

**What goes wrong:** `DEFAULT_TITLE_STYLE` in `TitleOverlay.tsx` is typed as `Required<TitleStyleProps>`. Removing a field from `TitleStyleProps` removes it from `Required<TitleStyleProps>` too. If you add `x` and `y` to the interface but forget to add them to `DEFAULT_TITLE_STYLE`, TypeScript errors. Conversely, if you remove `topOffset` from the interface but leave it in `DEFAULT_TITLE_STYLE`, TypeScript errors on the excess property.
**Why it happens:** `Required<T>` generates an exact mapped type — all properties from `T`, all required.
**How to avoid:** Update schema and `DEFAULT_TITLE_STYLE` in the same edit.
**Warning signs:** `Property 'topOffset' does not exist on type 'Required<TitleStyleProps>'` after removal.

### Pitfall 2: TitleEditor.tsx has its own DEFAULT_TITLE_STYLE (not type-checked against TitleStyleProps)

**What goes wrong:** `TitleEditor.tsx` line 25–38 defines a plain `const DEFAULT_TITLE_STYLE = { ... }` without an explicit type annotation. TypeScript will not flag stale fields (`topOffset`, `subtitleFontSize`, etc.) here because there is no `Required<TitleStyleProps>` annotation. The stale values will survive and end up in `newTitle.style` state, causing the form to submit deprecated fields that the API and renderer silently ignore — but the form state is wrong.
**Why it happens:** The TitleEditor's default is an untyped literal object, not validated by the interface.
**How to avoid:** Update `DEFAULT_TITLE_STYLE` in `TitleEditor.tsx` at the same time as schema changes. Optionally add `satisfies TitleStyleProps` annotation to catch future drift.
**Warning signs:** No TypeScript error, but form submits `topOffset: 50` in the style payload.

### Pitfall 3: Centering transform left on the element

**What goes wrong:** The existing `transform: \`translate(-50%, -50%) translateY(${translateY}px)\`` centers the block on the `top`/`left` percentage point. After switching to top-left anchor (D-04), if the centering `translate(-50%, -50%)` is not removed, a title block at x=0, y=0 will render with its center at the top-left corner — placing half the block off-screen.
**Why it happens:** Copy-paste of the existing transform string, forgetting the centering part must be removed.
**How to avoid:** Explicitly audit the `transform` property after positioning change.
**Warning signs:** Title block appears offset from where x/y would suggest (half the block's width/height outside the frame).

### Pitfall 4: fontsToLoad still references subtitleFontFamily after removal

**What goes wrong:** `TitleOverlay.tsx` lines 85–88 build `fontsToLoad` by filtering `[titleFontFamily, subtitleFontFamily]`. After `subtitleFontFamily` is removed from both the props and the local variable, the array literal `[titleFontFamily, subtitleFontFamily]` will have a TypeScript error (undefined variable). If the developer simply removes the `subtitleFontFamily` variable declaration but forgets to update the array, the build fails.
**Why it happens:** Multiple sites reference `subtitleFontFamily` in the font-loading useEffect.
**How to avoid:** When removing subtitle variables, grep for all uses. In `TitleOverlay.tsx`: `subtitleFontFamily` appears in lines 70, 71, 84, 85, 112.
**Warning signs:** `Cannot find name 'subtitleFontFamily'` TypeScript error.

### Pitfall 5: renderer sync omitted or using wrong cp command

**What goes wrong:** After modifying `TitleOverlay.tsx` in remotion-studio, if the renderer copy is skipped, the renderer still uses the old code — rendering with `topOffset` and the centering transform.
**Why it happens:** Developer forgets the sync step.
**How to avoid:** The sync command is mandatory per AGENTS.md. Include it as an explicit task in the plan with verification.

```bash
# Correct sync (from project root):
cp services/remotion-studio/src/compositions/TitleOverlay.tsx \
   services/remotion-renderer/src/compositions/TitleOverlay.tsx
cp services/remotion-studio/src/pipeline-config.ts \
   services/remotion-renderer/src/pipeline-config.ts
```

**Warning signs:** Renderer produces video with centered title blocks or visible subtitle slot.

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### Before/After: TitleOverlay.tsx positioning

```typescript
// Source: current TitleOverlay.tsx lines 199-204 (before Phase 20)
<div
  style={{
    position: "absolute",
    top: `${topOffset}%`,
    left: "50%",
    transform: `translate(-50%, -50%) translateY(${translateY}px)`,
    borderRadius: "12px",   // hardcoded
    // ...
  }}
>

// After Phase 20 (D-03, D-04, D-09):
<div
  style={{
    position: "absolute",
    left: `${(x / 1080) * 100}%`,
    top: `${(y / 1920) * 100}%`,
    transform: `translateY(${translateY}px)`,   // only animation offset, no centering
    borderRadius: `${borderRadius ?? 12}px`,    // config-driven
    // ...
  }}
>
```

### Before/After: TitleStyleProps schema

```typescript
// Source: services/remotion-studio/src/pipeline-config.ts (before Phase 20)
export interface TitleStyleProps {
  entranceAnimation?: TitleEntranceAnimation;
  backgroundColor?: string;
  textColor?: string;
  titleFontSize?: number;
  subtitleFontSize?: number;    // REMOVE
  titleColor?: string;
  subtitleColor?: string;       // REMOVE
  titleFontFamily?: string;
  subtitleFontFamily?: string;  // REMOVE
  topOffset?: number;           // REMOVE
  lineHeight?: number;
  padding?: number;
  fontWeight?: boolean;
  fontStyle?: boolean;
  outerGlow?: OuterGlow;
}

// After Phase 20:
export interface TitleStyleProps {
  entranceAnimation?: TitleEntranceAnimation;
  backgroundColor?: string;
  textColor?: string;
  titleFontSize?: number;
  titleColor?: string;
  titleFontFamily?: string;
  x?: number;            // NEW — pixel x from top-left
  y?: number;            // NEW — pixel y from top-left
  borderRadius?: number; // NEW — configurable (was hardcoded 12)
  lineHeight?: number;
  padding?: number;
  fontWeight?: boolean;
  fontStyle?: boolean;
  outerGlow?: OuterGlow;
}
```

### Before/After: TitleConfig schema

```typescript
// Before Phase 20:
export interface TitleConfig {
  text: string;
  subtitle?: string;   // REMOVE
  startTimeMs: number;
  durationMs: number;
  style?: TitleStyleProps;
}

// After Phase 20:
export interface TitleConfig {
  text: string;
  startTimeMs: number;
  durationMs: number;
  style?: TitleStyleProps;
}
```

### UI-SPEC: X/Y Input Row Pattern

```tsx
// Source: UI-SPEC §Component Contracts §1 — X/Y Coordinate Inputs
// Pattern mirrors existing Start Time / Duration row (lines 244-271 in TitleEditor.tsx)
<div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
  <div style={{ flex: 1 }}>
    <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
      X (px)
    </label>
    <input
      type="number"
      min={0}
      max={1080}
      step={1}
      value={newTitle.style?.x ?? 200}
      onChange={(e) => setNewTitle((prev) => ({
        ...prev,
        style: { ...prev.style!, x: parseInt(e.target.value) },
      }))}
      style={{
        width: "100%", padding: 8, background: "#2a2a3e",
        border: "1px solid #444", borderRadius: 4,
        color: "#e0e0e0", fontSize: 14,
      }}
    />
  </div>
  <div style={{ flex: 1 }}>
    <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
      Y (px)
    </label>
    <input
      type="number"
      min={0}
      max={1920}
      step={1}
      value={newTitle.style?.y ?? 960}
      onChange={(e) => setNewTitle((prev) => ({
        ...prev,
        style: { ...prev.style!, y: parseInt(e.target.value) },
      }))}
      style={{
        width: "100%", padding: 8, background: "#2a2a3e",
        border: "1px solid #444", borderRadius: 4,
        color: "#e0e0e0", fontSize: 14,
      }}
    />
  </div>
</div>
```

### UI-SPEC: Border Radius Slider Pattern

```tsx
// Source: UI-SPEC §Component Contracts §2 — Border-Radius Slider
// Placed after X/Y row, before Line Height / Padding row
<div style={{ marginBottom: 12 }}>
  <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
    Border Radius: {newTitle.style?.borderRadius ?? 12}px
  </label>
  <input
    type="range"
    min={0}
    max={50}
    step={1}
    value={newTitle.style?.borderRadius ?? 12}
    onChange={(e) => setNewTitle((prev) => ({
      ...prev,
      style: { ...prev.style!, borderRadius: parseInt(e.target.value) },
    }))}
    style={{ width: "100%", accentColor: "#4CAF50" }}
  />
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
    <span>0px</span>
    <span>50px</span>
  </div>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `topOffset` percentage + `translate(-50%, -50%)` centering | `x`/`y` pixel coordinates with top-left anchor | Phase 20 | Predictable pixel placement matching output resolution; no center-origin confusion |
| Hardcoded `borderRadius: "12px"` | `borderRadius?: number` from config | Phase 20 | User can set 0 (sharp corners) through 50 (pill shape) |
| `subtitle` field on `TitleConfig` | No subtitle; two title blocks = two entries | Phase 20 | Simpler data model; each block is independently positionable |

**Deprecated/outdated:**
- `TitleStyleProps.topOffset`: removed in Phase 20. No longer valid in schema or rendering.
- `TitleConfig.subtitle`: removed in Phase 20. Existing JSON with `subtitle` values will silently ignore the field after the code change.
- `TitleStyleProps.subtitleFontSize`, `.subtitleColor`, `.subtitleFontFamily`: removed in Phase 20 alongside `subtitle`.
- Validation in `validatePipelineConfig` for `topOffset` (lines ~411-413) and `subtitleFontSize` (lines ~408-410): both to be removed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `textColor` field in `TitleStyleProps` (fallback for `titleColor`) is NOT being removed in Phase 20 — only subtitle-specific fields | Architecture Patterns §Pattern 3 | Low — `textColor` is not mentioned in CONTEXT.md removals list and is used in `TitleOverlay.tsx` as `style?.titleColor ?? style?.textColor ?? DEFAULT_TITLE_STYLE.titleColor`. Removing it would break backward compat. |
| A2 | `gap: subtitle ? "12px" : "0"` on the container div can be removed entirely (replaced with `gap: "0"`) since subtitle is gone | Architecture Patterns §Pattern 3 | Negligible — with no subtitle element, gap has no visual effect regardless |

**If this table is empty:** N/A — two low-risk assumptions documented above.

---

## Open Questions

1. **validatePipelineConfig: should `x`/`y`/`borderRadius` be validated for range?**
   - What we know: Existing validation checks `topOffset` range (0–100), `titleFontSize` range (8–200). The new fields have natural ranges (x: 0–1080, y: 0–1920, borderRadius: 0–50).
   - What's unclear: Whether validation should enforce ranges or just type-check.
   - Recommendation: Add range validation consistent with existing field validation, specifically: `x` and `y` as non-negative numbers; `borderRadius` as non-negative number. Strict clamping (rejecting values > 1920) may be too rigid — a title positioned partially off-screen is valid artistically. Recommend validating as `number >= 0` only.

2. **Should `subtitleFontSize` validation block in `validatePipelineConfig` be removed or kept?**
   - What we know: Lines ~408-410 validate `s.subtitleFontSize` range (8–200). After removing the field from `TitleStyleProps`, the field will no longer appear in valid configs.
   - What's unclear: Whether to hard-error if old JSON contains `subtitleFontSize`.
   - Recommendation: Remove the validation check (the field is simply ignored in the new schema). Keeping a validation error for a field that no longer exists in the schema would be confusing.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + test | Yes | v22.22.2 | — |
| vitest | `pipeline-config.test.ts` (renderer) | Yes | via remotion-renderer node_modules | — |
| vitest | `typography.test.ts` (studio) | No — not in studio devDependencies | — | Add vitest to studio devDependencies (Wave 0 gap) |
| `npm run build:editor` | Verify editor build | Yes — vite installed | via vite ^5.4.0 | — |

**Missing dependencies with no fallback:** None blocking.

**Missing dependencies with fallback:**
- `vitest` not in remotion-studio devDependencies — studio test files (`typography.test.ts`, `transition-effect.test.ts`, etc.) cannot be run as-is. Planner should include `npm install --save-dev vitest` in studio as a Wave 0 gap OR route Phase 20 test verification through the renderer's vitest (which has the same `pipeline-config.ts` post-sync).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (remotion-renderer) |
| Config file | `services/remotion-renderer/vitest.config.ts` |
| Quick run command | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` |
| Full suite command | `cd services/remotion-renderer && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TITLE-01 | `x`/`y` accepted in `TitleStyleProps`; `topOffset` rejected or removed | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | Wave 0 — add tests |
| TITLE-01 | `x`/`y` pixel coords render as `left/top %` in TitleOverlay | visual (manual) | Studio preview at port 3123 | Manual verification |
| TITLE-02 | `borderRadius` accepted in `TitleStyleProps`; renders correctly | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | Wave 0 — add tests |
| TITLE-03 | `subtitle` field removed from `TitleConfig` schema; validator accepts configs without it | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | Wave 0 — add test (existing test at line 57 uses `subtitle: "Episode 1"` — must be updated) |

### Sampling Rate

- **Per task commit:** `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts`
- **Per wave merge:** `cd services/remotion-renderer && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `services/remotion-renderer/src/pipeline-config.test.ts` — add Phase 20 tests:
  - Accepts `x`/`y` fields in title style; rejects negative `x` or `y`
  - Accepts `borderRadius` field in title style
  - Existing test at line 57 uses `subtitle: "Episode 1"` — after subtitle removal from `TitleConfig`, this may cause a TypeScript error in the test if the type is strict. Update or remove that test case.
- [ ] No vitest config in remotion-studio — studio test files (`typography.test.ts` etc.) are orphaned. Phase 20 does not require new studio tests; existing ones are blocked regardless. Not a Wave 0 gap for this phase.

---

## Security Domain

This phase makes no changes to authentication, session management, access control, cryptography, or network communication. All changes are CSS property values and TypeScript type field removals in local React components. The only user-controlled input (x, y, borderRadius values) is bounded by HTML `min`/`max` attributes and stored in `pipeline-config.json` on disk — a trusted local file.

ASVS categories V5 (Input Validation) and V2-V4 do not apply at the component level for this type of change. No security review required.

---

## Sources

### Primary (HIGH confidence)

- Codebase direct inspection: `services/remotion-studio/src/pipeline-config.ts` — current `TitleStyleProps`, `TitleConfig`, `validatePipelineConfig` (all removed fields and their validation blocks confirmed by reading file)
- Codebase direct inspection: `services/remotion-studio/src/compositions/TitleOverlay.tsx` — current positioning logic, centering transform, borderRadius hardcode, subtitle rendering
- Codebase direct inspection: `services/remotion-studio/src/editor/components/TitleEditor.tsx` — all form fields, `DEFAULT_TITLE_STYLE`, subtitle input, topOffset slider
- Codebase direct inspection: `services/remotion-renderer/src/compositions/TitleOverlay.tsx` — confirmed identical to studio at time of research (both have same topOffset/subtitle code)
- Codebase direct inspection: `services/remotion-renderer/src/pipeline-config.ts` — confirmed identical to studio schema at time of research
- Codebase direct inspection: `pipeline/pipeline-config.json` — live config has 3 titles with `topOffset` values; no `subtitle` values
- `.planning/phases/20-title-block-precision/20-CONTEXT.md` — all locked decisions D-01 through D-09
- `.planning/phases/20-title-block-precision/20-UI-SPEC.md` — component contracts, form layout order, label text, spacing, color palette

### Secondary (MEDIUM confidence)

- `.planning/phases/18-studio-ui-redesign/18-CONTEXT.md` — confirmed tab structure, in-memory edit + manual Save pattern (D-09)
- `.planning/phases/19-typography-text-effects/19-CONTEXT.md` — confirmed renderer-sync rule (D-10), existing `TitleStyleProps` schema after Phase 19

---

## Metadata

**Confidence breakdown:**
- Schema changes: HIGH — all fields verified by direct code reading
- Rendering changes: HIGH — exact CSS patterns derived from current code + locked CONTEXT.md decisions
- Editor UI changes: HIGH — current form structure read from TitleEditor.tsx + UI-SPEC contracts
- Renderer sync: HIGH — sync commands from AGENTS.md, both files confirmed in sync at research time
- Test coverage: MEDIUM — test structure confirmed; specific new tests are Wave 0 gaps

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (stable codebase; no external packages)
