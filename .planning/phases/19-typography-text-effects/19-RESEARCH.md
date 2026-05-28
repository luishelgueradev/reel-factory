# Phase 19: Typography & Text Effects - Research

**Researched:** 2026-05-28
**Domain:** Remotion React compositions / TypeScript schema / CSS text effects / @remotion/google-fonts
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Outer glow (TYPO-04)**
- D-01: Add a new `outerGlow` field to both `SubtitleConfig` and `TitleStyleProps`. Schema: `{ enabled: boolean; color: string; intensity: number; softness: number }`. `intensity` = alpha multiplier (0–1). `softness` = blur radius in px. CSS: `text-shadow: 0 0 {softness}px {color-with-intensity-as-alpha}`.
- D-02: `outerGlow` lands independently in `SubtitleConfig` (Subtitles tab) and `TitleStyleProps` (Titles tab).

**Bold / italic (TYPO-03)**
- D-03: `fontWeight` is a boolean toggle (false = 400/regular, true = 700/bold). Added to both `SubtitleConfig` and `TitleStyleProps`. Renderer: `true` → `font-weight: 700`, `false` → `font-weight: 400`.
- D-04: `fontStyle` is a boolean toggle (false = normal, true = italic). Added to both configs. Renderer: `true` → `font-style: italic`.
- D-05: Bold/italic applies to subtitles and titles independently.
- Note: `TikTokLayout.tsx:109` has hardcoded `fontWeight: 700` — must become config-driven, reading `config.fontWeight !== false ? 700 : 400`.

**Font size range (TYPO-02)**
- D-06: Subtitle font size slider extended from 24–120px to 24–200px. Default (58) unchanged.
- D-07: Title font size controls extended to 200px ceiling (title: 24–200, subtitle: 16–200).

**Plus Jakarta Sans (TYPO-01)**
- D-08: Import `PlusJakartaSans` from `@remotion/google-fonts/PlusJakartaSans`, add to `AVAILABLE_FONTS` and `FONT_LOADERS` in `fonts.ts`.
- D-09: Plus Jakarta Sans becomes new default `fontFamily` in `DEFAULT_SUBTITLE_CONFIG` (replacing Inter). Existing saved configs unaffected.

**Renderer sync**
- D-10: All changed files in `services/remotion-studio/src/compositions/` and shared modules must be synced to `services/remotion-renderer/src/` per AGENTS.md renderer-sync rules.

### Claude's Discretion
- Exact UI control layout within the Subtitles and Titles tabs (toggle style for bold/italic, color picker for glow, slider for softness/intensity) — decide under `impeccable` + `frontend-design` guidance at plan/execute time.
- Whether `outerGlow` renders as a single CSS `text-shadow` layer or multiple stacked layers for a denser effect at high intensity values.
- Default values for `outerGlow` fields (suggested: enabled=false, color="#ffffff", intensity=0.8, softness=20).

### Deferred Ideas (OUT OF SCOPE)
- None — all 4 requirements (TYPO-01 through TYPO-04) are covered.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TYPO-01 | User can select Plus Jakarta Sans for subtitles and titles | `PlusJakartaSans.mjs` verified in installed `@remotion/google-fonts@4.0.457`; CSS name = "Plus Jakarta Sans"; same pattern as existing 25 fonts |
| TYPO-02 | User can set subtitle/title font sizes beyond the current maximum | Slider `max` attribute change only; validation in `pipeline-config.ts` must be updated from 120/80 to 200 |
| TYPO-03 | User can apply bold and italic variants to fonts | New boolean fields on `SubtitleConfig`/`TitleStyleProps`; 4 layout files each have hardcoded `fontWeight: 700` — all must be updated |
| TYPO-04 | User can apply outer glow with configurable color, intensity, and softness | CSS `text-shadow: 0 0 Xpx rgba(...)` — verified pattern; `getOuterGlowStyle()` helper to be added to `shared-styles.ts` |
</phase_requirements>

---

## Summary

Phase 19 is a well-bounded extension of the existing Remotion studio UI and config schema. All four requirements are pure schema additions + UI controls + renderer reads — no new containers, no architectural changes. The primary technical work is: (1) add `PlusJakartaSans` to fonts infrastructure in both services, (2) extend schema with `fontWeight: boolean`, `fontStyle: boolean`, and `outerGlow: OuterGlow` in `SubtitleConfig` and `TitleStyleProps`, (3) update the font size slider `max` values in the UI, (4) wire all new fields through all four layout files (`TikTokLayout`, `BarLayout`, `KaraokeLayout`, `SentenceLayout`) where `fontWeight: 700` is currently hardcoded, and (5) add glow CSS helper to `shared-styles.ts`.

The most pervasive change is `fontWeight` de-hardcoding. All four layout files independently hardcode `fontWeight: 700` inside their word/token rendering spans. The CONTEXT.md identified TikTokLayout at line 109, but BarLayout (line 111), KaraokeLayout (lines 115, 134), and SentenceLayout (line 193) all have the same hardcoded value. All must read from `config.fontWeight !== false ? 700 : 400`.

`TitleOverlay.tsx` uses hardcoded `fontWeight: 800` for the title span and `fontWeight: 500` for the subtitle span (lines 210, 227). Per D-03/D-05, the new `TitleStyleProps.fontWeight` boolean should control the title span (800→700 when bold, 400 when not), while the subtitle span can follow the same boolean or stay proportionally lighter — this is Claude's discretion territory per the UI spec.

**Primary recommendation:** Plan as a Wave 0 (schema + fonts.ts) → Wave 1 (layout files + renderer) → Wave 2 (UI controls StyleControls + TitleEditor) → Wave 3 (validation + tests + renderer sync) sequence to avoid partial states.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plus Jakarta Sans font loading | Frontend Server (remotion-studio) | Renderer (remotion-renderer) | Font loaded via `@remotion/google-fonts` in both services; studio loads for live preview, renderer loads for final render |
| Font size slider extension | Browser / Client (UI) | Config schema | Purely a UI range attribute change; schema already accepts any positive number |
| Bold/italic config schema | Config schema (pipeline-config.ts) | Both services equally | New boolean fields added to shared type; both studio and renderer read it |
| Bold/italic UI controls | Browser / Client (StyleControls, TitleEditor) | — | Two toggle-button rows in each tab |
| Bold/italic renderer consumption | Frontend Server (compositions) | Renderer (renderer/compositions) | All 4 layout files + TitleOverlay must read field instead of hardcoded value |
| Outer glow CSS helper | Config schema + shared-styles.ts | Both services' compositions | `getOuterGlowStyle()` in shared-styles.ts; consumed by layouts and TitleOverlay |
| Outer glow UI controls | Browser / Client (StyleControls, TitleEditor) | — | Collapsible section card matching Background Highlight pattern |
| Validation | Config schema (pipeline-config.ts) | — | `validatePipelineConfig` must accept/validate new fields |
| Renderer sync | File copy operation | — | AGENTS.md protocol: copy compositions/ + shared modules after each change |

---

## Standard Stack

No new packages are required for this phase. All capabilities are achievable with the existing stack.

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@remotion/google-fonts` | 4.0.457 | `PlusJakartaSans` import | Already installed; `PlusJakartaSans.mjs` confirmed present in dist/esm |
| `remotion` | 4.0.457 | Composition framework | Already in use |
| React | (via remotion) | UI components | Already in use |

### No New Packages

This phase requires zero new npm packages. Everything needed is already installed:
- `@remotion/google-fonts/PlusJakartaSans` — confirmed in `node_modules/@remotion/google-fonts/dist/esm/PlusJakartaSans.mjs` [VERIFIED: codebase grep]
- CSS `text-shadow` for glow — native CSS, no library needed [VERIFIED: CSS spec]
- Boolean toggles in React — native HTML buttons [VERIFIED: codebase grep]

**Installation:** None required.

---

## Package Legitimacy Audit

> No new packages are introduced in this phase. The audit is trivially clean.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none new)* | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks control in Studio UI
        │
        ▼
StyleControls.tsx / TitleEditor.tsx
  onChange(partial) fires immediately
        │
        ▼
In-memory config state (React state in Editor parent)
  Live preview in Remotion <Player>
        │
   ┌────┴────────────────────┐
   ▼                         ▼
LayoutDispatcher.tsx    TitleOverlay.tsx
  → TikTokLayout           reads TitleStyleProps
  → BarLayout              outerGlow / fontWeight / fontStyle
  → KaraokeLayout
  → SentenceLayout
   reads SubtitleConfig
   outerGlow / fontWeight / fontStyle
        │
        ▼ (on Save button)
PUT /api/config
  → writes pipeline-config.json
        │
        ▼ (at render time)
remotion-renderer service
  reads pipeline-config.json
  same composition code (synced)
  renders final video frames
```

### Recommended Project Structure

No new directories needed. Changes are contained to:

```
services/remotion-studio/src/
├── pipeline-config.ts              # +OuterGlow interface, +fontWeight/fontStyle fields, updated validation
├── fonts.ts                        # +PlusJakartaSans import + FONT_LOADERS entry + AVAILABLE_FONTS[0]
├── compositions/
│   ├── shared-styles.ts            # +getOuterGlowStyle() helper
│   ├── TikTokLayout.tsx            # fontWeight: 700 → config-driven; +outerGlow; +fontStyle
│   ├── BarLayout.tsx               # same as TikTokLayout
│   ├── KaraokeLayout.tsx           # fontWeight hardcoded in TWO spans (lines 115, 134); both must update
│   ├── SentenceLayout.tsx          # fontWeight: 700 → config-driven; +outerGlow; +fontStyle
│   └── TitleOverlay.tsx            # fontWeight: 800/500 → config-driven; +outerGlow
└── editor/components/
    ├── StyleControls.tsx            # font size max 120→200; +fontWeight toggle; +fontStyle toggle; +OuterGlow card
    └── TitleEditor.tsx              # font size max 120/80→200; +fontWeight toggle; +fontStyle toggle; +OuterGlow card; DEFAULT_TITLE_STYLE; FONT_OPTIONS

services/remotion-renderer/src/
├── pipeline-config.ts              # sync copy of studio version
├── fonts.ts                        # sync copy of studio version
└── compositions/                   # sync copy of all changed layout files + shared-styles.ts
    ├── shared-styles.ts
    ├── TikTokLayout.tsx
    ├── BarLayout.tsx
    ├── KaraokeLayout.tsx
    ├── SentenceLayout.tsx
    └── TitleOverlay.tsx
```

### Pattern 1: Adding a New Google Font

The established pattern from `fonts.ts` (25 existing fonts):

```typescript
// Source: services/remotion-studio/src/fonts.ts (codebase — verified pattern)

// Step 1: Import at top of fonts.ts
import { loadFont as loadPlusJakartaSans, fontFamily as plusJakartaSansFamily }
  from "@remotion/google-fonts/PlusJakartaSans";

// Step 2: Add to AVAILABLE_FONTS at position 0
export const AVAILABLE_FONTS = [
  "PlusJakartaSans",  // NEW — position 0 (default)
  "Inter", "Roboto", /* ... rest unchanged */
] as const;

// Step 3: Add to FONT_LOADERS map
const FONT_LOADERS = {
  PlusJakartaSans: { fontFamily: plusJakartaSansFamily, loadFont: loadPlusJakartaSans },
  Inter: { fontFamily: interFamily, loadFont: loadInter },
  /* ... rest unchanged */
};
```

**Key fact:** `plusJakartaSansFamily` resolves to `"Plus Jakarta Sans"` (with spaces). The `getFontFamilyCSS()` function already handles the module-name-to-CSS-name translation, so no special handling is needed.

**loadFont call pattern** (established by 260527-i3v quick task — do NOT regress):
```typescript
// Source: services/remotion-studio/src/fonts.ts:122 (codebase — verified)
const result = await loader.loadFont("normal", { subsets: ["latin", "latin-ext"] });
```

### Pattern 2: Config Schema Extension

Following the existing `TextShadow` / `BackgroundHighlight` pattern:

```typescript
// Source: services/remotion-studio/src/pipeline-config.ts (codebase — verified)

// New interface (same pattern as TextShadow)
export interface OuterGlow {
  enabled: boolean;
  color: string;       // hex color, e.g. "#ffffff"
  intensity: number;  // 0–1 alpha multiplier
  softness: number;   // blur radius in px
}

// Add to SubtitleConfig:
export interface SubtitleConfig {
  // ... existing fields ...
  fontWeight?: boolean;   // false = 400 (regular), true = 700 (bold). Default: true
  fontStyle?: boolean;    // false = normal, true = italic. Default: false
  outerGlow?: OuterGlow;
}

// Add to TitleStyleProps:
export interface TitleStyleProps {
  // ... existing fields ...
  fontWeight?: boolean;
  fontStyle?: boolean;
  outerGlow?: OuterGlow;
}
```

**Default update in DEFAULT_SUBTITLE_CONFIG:**
```typescript
// Source: services/remotion-studio/src/pipeline-config.ts:126 (codebase — verified)
// Change fontFamily default from Inter to PlusJakartaSans
// Add fontWeight: true (default bold — preserves existing behavior)
// Add fontStyle: false (default normal)
// outerGlow is optional and defaults to disabled — no need to add to DEFAULT_SUBTITLE_CONFIG
```

### Pattern 3: Outer Glow CSS Helper

Following the `getBackgroundHighlightStyle()` pattern in `shared-styles.ts`:

```typescript
// Source: services/remotion-studio/src/compositions/shared-styles.ts (codebase — verified pattern)

import type { SubtitleConfig } from "../pipeline-config";

export function getOuterGlowStyle(
  outerGlow: SubtitleConfig["outerGlow"],
  existingTextShadow?: string
): React.CSSProperties {
  if (!outerGlow || !outerGlow.enabled) {
    return existingTextShadow ? { textShadow: existingTextShadow } : {};
  }

  // Parse hex color to RGB for rgba() construction
  const hex = outerGlow.color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const colorWithAlpha = `rgba(${r}, ${g}, ${b}, ${outerGlow.intensity})`;
  const glowShadow = `0 0 ${outerGlow.softness}px ${colorWithAlpha}`;

  // Combine with existing textShadow if both are active
  const combined = existingTextShadow
    ? `${existingTextShadow}, ${glowShadow}`
    : glowShadow;

  return { textShadow: combined };
}
```

**CSS implementation confirmed:** `text-shadow: 0 0 20px rgba(255, 255, 255, 0.8)` — UI spec line 246.

### Pattern 4: fontWeight De-hardcoding in Layout Files

All four layouts use the same pattern. Example for `CaptionWord` in TikTokLayout:

```typescript
// Source: services/remotion-studio/src/compositions/TikTokLayout.tsx:109 (codebase — verified)
// BEFORE:
fontWeight: 700,

// AFTER (preserves existing bold default when config.fontWeight is undefined):
fontWeight: config.fontWeight !== false ? 700 : 400,
```

The `CaptionPage` component must pass `config.fontWeight` and `config.fontStyle` down through props to `CaptionWord`. Currently `CaptionWord` does not accept these props — they must be added to the props interface and destructured.

**KaraokeLayout special case:** `fontWeight: 700` appears in TWO spans inside `KaraokeWord` — the baseline layer (line 115) and the active fill layer (line 134). Both must be updated.

**TitleOverlay special case:** Uses hardcoded `fontWeight: 800` for the main title span and `fontWeight: 500` for the subtitle span. Per D-03/D-05, the new `TitleStyleProps.fontWeight` boolean should control the title span. Recommended mapping: `titleFontWeight === false ? 400 : 700` (not 800, matching the subtitle layout behavior). The subtitle span can remain at 500 (or follow the same boolean).

### Pattern 5: UI Toggle Buttons — Established Pattern

The `HighlightTransition` (Fade/Instant) control in `StyleControls.tsx` lines 220–255 is the exact template for Bold/Italic toggles. Copy this pattern verbatim with the new labels.

```tsx
// Source: services/remotion-studio/src/editor/components/StyleControls.tsx:219 (codebase)
// Template for Font Weight toggle:
<div>
  <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
    Font Weight
  </label>
  <div style={{ display: "flex", gap: 8 }}>
    <button
      onClick={() => onChange({ fontWeight: false })}
      style={{
        flex: 1,
        padding: "6px 12px",
        border: `1px solid ${config.fontWeight === false ? "#4CAF50" : "#444"}`,
        borderRadius: 4,
        background: config.fontWeight === false ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
        color: config.fontWeight === false ? "#a5d6a7" : "#ccc",
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      Regular
    </button>
    <button
      onClick={() => onChange({ fontWeight: true })}
      style={{
        flex: 1,
        padding: "6px 12px",
        border: `1px solid ${config.fontWeight !== false ? "#4CAF50" : "#444"}`,
        borderRadius: 4,
        background: config.fontWeight !== false ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
        color: config.fontWeight !== false ? "#a5d6a7" : "#ccc",
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      Bold
    </button>
  </div>
</div>
```

**Active state logic:** `config.fontWeight !== false` (not `=== true`) because `undefined` defaults to bold — matching existing hardcoded behavior.

### Pattern 6: Outer Glow Section Card — Collapsible Pattern

Follows the `Background Highlight` card in StyleControls.tsx lines 298–353:

```tsx
// Source: services/remotion-studio/src/editor/components/StyleControls.tsx:298 (codebase)
<div style={{ padding: "12px 16px", background: "#1e1e2e", borderRadius: 8, border: "1px solid #333" }}>
  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}>
    <input
      type="checkbox"
      checked={glow.enabled}
      onChange={(e) => onChange({ outerGlow: { ...glow, enabled: e.target.checked } })}
    />
    <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>Outer Glow</span>
  </label>
  {glow.enabled && (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: 24 }}>
      {/* Color, Intensity, Softness controls */}
    </div>
  )}
</div>
```

### Anti-Patterns to Avoid

- **Calling `loadFont` with the wrong signature:** Use `loadFont("normal", { subsets: ["latin", "latin-ext"] })` — NOT `loadFont({ subsets: [...] })`. The quick task 260527-i3v fixed this exact bug. Reverting to the old positional call will cause monospace fallback.
- **Forgetting `getFontFamilyCSS()`:** When rendering CSS, the module name `"PlusJakartaSans"` must be mapped to `"Plus Jakarta Sans"` via `getFontFamilyCSS()`. This is already done in `TitleOverlay.tsx` but NOT in the layout files (they pass `fontFamily` directly from config which is already the module name — and the browser resolves it because the font is already loaded. Do NOT break this flow).
- **Partial renderer sync:** If studio compositions are updated but renderer is not synced, renders use old code silently. The AGENTS.md sync must run after every composition change.
- **Using `fontWeight: true/false` directly in CSS:** CSS `fontWeight` expects a number or string (400, 700, "bold"), not a boolean. Always map: `config.fontWeight !== false ? 700 : 400`.
- **Replacing `textShadow` instead of combining:** The `outerGlow` field is a sibling to the existing `textShadow` field. When both are enabled, their `text-shadow` CSS values must be comma-joined, not one replacing the other.
- **Raising `max` without updating validation:** `pipeline-config.ts` line 359 validates `subtitleFontSize` max as 120 — must be updated to 200. Line 356 validates `titleFontSize` max as 200 (already correct). Also check if subtitle `fontSize` validation (line 247) enforces a maximum — currently it only checks `> 0`, so it is already permissive.
- **Copying wrong files to renderer:** Per AGENTS.md: DO NOT copy `*.tsx` files into `../remotion-renderer/src/` root — only copy into `src/compositions/`. DO NOT sync `Root.tsx` or `SubtitledVideo.tsx`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color-to-RGBA conversion | Custom regex parser | Built-in hex parsing (3 lines, already in `TitleEditor.tsx`) | `rgbaToHex()`/`hexAndAlphaToRgba()` pattern already exists in `TitleEditor.tsx:44-63` |
| Font CSS name resolution | Another lookup table | `getFontFamilyCSS()` in `fonts.ts:99-104` | Already handles all 25 fonts + "PlusJakartaSans" after adding the loader |
| Glow intensity/alpha handling | Custom color library | Inline RGB math (already in codebase's `lerpColor` pattern) | 3-line RGB parse, no dependency needed |
| Toggle button active state | Custom state machine | `config.fontWeight !== false` expression | Boolean field with undefined=default is sufficient |

**Key insight:** Every UI pattern this phase needs already exists in the codebase. The work is applying known patterns to new fields, not inventing new patterns.

---

## Runtime State Inventory

> Omitted — this is a greenfield feature addition, not a rename/refactor/migration phase.

---

## Common Pitfalls

### Pitfall 1: Hardcoded fontWeight in 4 Layout Files

**What goes wrong:** Only updating `TikTokLayout.tsx` (mentioned by name in CONTEXT.md D-05 note) while missing `BarLayout.tsx`, `KaraokeLayout.tsx`, and `SentenceLayout.tsx`. The bold/italic feature silently applies only in TikTok mode.
**Why it happens:** CONTEXT.md mentions TikTokLayout specifically; the others are assumed to be same.
**How to avoid:** Grep for `fontWeight: 700` before and after the change: `grep -r "fontWeight: 700" services/remotion-studio/src/compositions/`
**Warning signs:** Toggling to "Regular" works in TikTok layout but not when switching to Bar/Karaoke/Sentence.

**Confirmed grep result** (from codebase scan):
- `TikTokLayout.tsx:109` — `CaptionWord` span
- `BarLayout.tsx:111` — `BarWord` span
- `KaraokeLayout.tsx:115` — baseline span; line `134` — active fill span (TWO occurrences)
- `SentenceLayout.tsx:193` — inline span in `SentencePage`

### Pitfall 2: KaraokeLayout Has Two Hardcoded fontWeight Spans

**What goes wrong:** One of the two KaraokeLayout fontWeight hardcodings is missed, causing the karaoke fill layer to remain bold while the baseline goes regular (or vice versa), creating a visual weight mismatch at the fill boundary.
**Why it happens:** The karaoke effect uses two overlapping spans (baseline + active fill), both needing the same fontWeight for consistent rendering.
**How to avoid:** Search for `fontWeight: 700` specifically in `KaraokeLayout.tsx` — expect 2 hits.

### Pitfall 3: fontStyle Not Propagated Down to Word Components

**What goes wrong:** `fontStyle` is added to `SubtitleConfig` and the parent container div receives `fontStyle: "italic"`, but `CaptionWord`/`BarWord`/`KaraokeWord` still set a different `fontStyle` on their inner spans, overriding the parent.
**Why it happens:** These word components set their own CSS props directly. A parent `fontStyle` on a wrapper div would work for simple spans but the Webkit text stroke properties are per-span, so the font style may need to be applied at the span level too.
**How to avoid:** Apply `fontStyle` at the span level in all word components (same level as `fontWeight`). Pass `config.fontStyle` through props.

### Pitfall 4: OuterGlow Applied at Wrong DOM Level

**What goes wrong:** Applying `text-shadow` to the container `div` instead of the individual `<span>` elements that contain the text. In Remotion, the word spans already have `WebkitTextStroke` — applying glow at the container level may produce correct results for simple cases but can interact badly with opacity animations.
**How to avoid:** Apply `getOuterGlowStyle()` at the span level inside each word component, combined with the existing inline style object. For TikTokLayout, this means passing it through `CaptionWord` props.
**Alternative acceptable:** Apply at the `CaptionPage` container div as a baseline if the effect is acceptable — this is simpler and the glow on the div-level `text-shadow` does cascade to child text nodes.

### Pitfall 5: Validation Not Updated for New Fields

**What goes wrong:** `validatePipelineConfig` in `pipeline-config.ts` doesn't know about `outerGlow`, `fontWeight`, or `fontStyle`. If a user saves a config via PUT and the server validates, new fields are silently accepted (they're unknown, not rejected). This is fine for the new fields. However, the subtitle `subtitleFontSize` max is checked at line 359 as `120` — that must become `200`.
**How to avoid:** After adding fields to the interfaces, search `validatePipelineConfig` for all range checks involving `subtitleFontSize` and font-related fields.

### Pitfall 6: TitleEditor Has Its Own FONT_OPTIONS Array

**What goes wrong:** `AVAILABLE_FONTS` in `fonts.ts` is updated with `PlusJakartaSans` at index 0, but `TitleEditor.tsx` has its own local `FONT_OPTIONS` array (lines 21-27) that is a separate hardcoded list — not imported from `fonts.ts`. Plus Jakarta Sans won't appear in the title font dropdowns unless this array is also updated.
**How to avoid:** Update `FONT_OPTIONS` in `TitleEditor.tsx` and its `DEFAULT_TITLE_STYLE.titleFontFamily`/`subtitleFontFamily` from `"Inter"` to `"PlusJakartaSans"`.
**Long-term fix (out of scope):** Import `AVAILABLE_FONTS` from `fonts.ts` instead of maintaining a parallel list.

### Pitfall 7: Renderer sync done only for compositions/, not pipeline-config.ts

**What goes wrong:** `pipeline-config.ts` in the renderer doesn't get the new `OuterGlow`, `fontWeight`, `fontStyle` fields. The renderer reads the config from JSON fine (TypeScript types are erased at runtime), but the TypeScript compilation may fail or warn if the renderer's types don't match.
**How to avoid:** Sync `pipeline-config.ts` explicitly. Per AGENTS.md sync rules, it's in the list of shared modules to copy.

---

## Code Examples

### Plus Jakarta Sans import (verified pattern)

```typescript
// Source: services/remotion-studio/node_modules/@remotion/google-fonts/dist/esm/PlusJakartaSans.mjs (verified)
// CSS fontFamily string: "Plus Jakarta Sans"
import { loadFont as loadPlusJakartaSans, fontFamily as plusJakartaSansFamily }
  from "@remotion/google-fonts/PlusJakartaSans";
// plusJakartaSansFamily === "Plus Jakarta Sans"
```

### Outer glow CSS construction (from UI spec)

```typescript
// Source: 19-UI-SPEC.md §"CSS Implementation Reference" (approved spec)
// color="#ffffff", intensity=0.8, softness=20
// → text-shadow: 0 0 20px rgba(255, 255, 255, 0.8)
const hex = outerGlow.color.replace("#", "");
const r = parseInt(hex.slice(0, 2), 16);
const g = parseInt(hex.slice(2, 4), 16);
const b = parseInt(hex.slice(4, 6), 16);
const shadow = `0 0 ${outerGlow.softness}px rgba(${r}, ${g}, ${b}, ${outerGlow.intensity})`;
```

### fontWeight boolean → CSS mapping (from CONTEXT.md + UI spec)

```typescript
// Source: 19-CONTEXT.md D-03 + 19-UI-SPEC.md §fontWeight mapping (approved)
// In layout components:
fontWeight: config.fontWeight !== false ? 700 : 400,
// "!== false" ensures undefined defaults to bold (preserves existing behavior)

// In TitleOverlay.tsx (title span — deviation from 800 to 700):
fontWeight: style?.fontWeight !== false ? 700 : 400,
```

### fontStyle boolean → CSS mapping (from CONTEXT.md D-04)

```typescript
// Source: 19-CONTEXT.md D-04 + 19-UI-SPEC.md §fontStyle mapping (approved)
fontStyle: config.fontStyle === true ? "italic" : "normal",
```

### Renderer sync command (from AGENTS.md)

```bash
# Source: AGENTS.md §"Development Conventions" (project convention — required)
# Run from services/remotion-studio/
cp src/compositions/* ../remotion-renderer/src/compositions/
cp src/pipeline-config.ts src/fonts.ts ../remotion-renderer/src/
# Do NOT copy *.tsx files to src/ root
# Do NOT sync Root.tsx or SubtitledVideo.tsx
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `loadFont({ subsets })` (positional-style) | `loadFont("normal", { subsets })` (style-first) | Quick task 260527-i3v (2026-05-27) | Old call caused monospace fallback for all fonts in preview + renders |
| `TitleEditor` maintains its own `FONT_OPTIONS` array | Same (not yet changed) | Phase 19 adds PlusJakartaSans here | Both `fonts.ts` AVAILABLE_FONTS and TitleEditor FONT_OPTIONS must be updated |
| `fontWeight: 700` hardcoded in all 4 layouts | (To be changed in this phase) | Phase 19 | Enables user control of bold vs regular |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TitleOverlay.tsx` should map `fontWeight` boolean to 700 (not 800) for the main title span | Code Examples | If user expects the existing 800 weight to be "bold" and 700 to feel like a downgrade — cosmetic only |
| A2 | The subtitle span in TitleOverlay.tsx (currently `fontWeight: 500`) should remain at 500 regardless of the `fontWeight` boolean (which controls the title span) | Architecture Patterns | If user expects italic/bold to apply to both title+subtitle text in the title card equally |
| A3 | `getOuterGlowStyle()` applies at the word-span level (not page-div level) for consistency with existing `WebkitTextStroke` | Common Pitfalls | If div-level glow is visually indistinguishable — then either approach is acceptable |

**If this table is not empty:** A1 and A2 are within Claude's discretion per CONTEXT.md. A3 is a UI quality judgment at execute time.

---

## Open Questions

1. **TitleOverlay fontWeight mapping for subtitle span**
   - What we know: Main title uses `fontWeight: 800`; subtitle uses `fontWeight: 500`. D-03 says the boolean maps to 700/400 for subtitle layout words.
   - What's unclear: Should the `TitleStyleProps.fontWeight` boolean also affect the title overlay's secondary subtitle span (the smaller text below the main title), or only the main title span?
   - Recommendation: Apply `fontWeight` boolean only to the main title span (800 → 700 when true, 400 when false). Keep subtitle span at 500 for visual hierarchy. This is within Claude's discretion.

2. **fontStyle on TitleOverlay subtitle font**
   - What we know: D-05 says bold/italic applies to subtitles and titles tabs independently. The Titles tab controls title style.
   - What's unclear: The title overlay has two text elements (main title + optional subtitle text below). Should italic apply to both?
   - Recommendation: Apply `fontStyle` to both spans in TitleOverlay for consistency.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@remotion/google-fonts/PlusJakartaSans` | TYPO-01 | Yes | 4.0.457 | — (confirmed in node_modules dist/esm) |
| Node.js | Build/dev | Yes | (in WSL2 env) | — |
| CSS `text-shadow` | TYPO-04 | Yes | Browser native | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via Remotion test files — `*.test.ts` in compositions/) |
| Config file | `services/remotion-studio/vitest.config.ts` (or package.json test script — check at Wave 0) |
| Quick run command | `npm test` from `services/remotion-studio/` |
| Full suite command | `npm test` from `services/remotion-studio/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TYPO-01 | PlusJakartaSans available in AVAILABLE_FONTS and FONT_LOADERS | unit | `npm test -- --grep "PlusJakartaSans"` | No — Wave 0 gap |
| TYPO-01 | `DEFAULT_SUBTITLE_CONFIG.fontFamily` defaults to PlusJakartaSans | unit | same | No — Wave 0 gap |
| TYPO-02 | Font size accepts values up to 200 (validation) | unit | existing `pipeline-config` test suite | Partial — existing test validates old max |
| TYPO-03 | `fontWeight: false` maps to CSS 400 in layout | unit | test in compositions/ | No — Wave 0 gap |
| TYPO-03 | `fontWeight: undefined` defaults to 700 (preserves behavior) | unit | same | No — Wave 0 gap |
| TYPO-04 | `getOuterGlowStyle()` with enabled=true produces correct text-shadow | unit | test in shared-styles | No — Wave 0 gap |
| TYPO-04 | Combined textShadow + outerGlow produces comma-joined string | unit | same | No — Wave 0 gap |
| All | Visual render — glow/bold/italic visible in studio preview | smoke/manual | Studio at port 3123 | Manual only |

### Sampling Rate
- **Per task commit:** `npm test` from `services/remotion-studio/`
- **Per wave merge:** `npm test` from `services/remotion-studio/`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Unit tests for `getOuterGlowStyle()` in `shared-styles.ts` — covers TYPO-04 hex→rgba math and shadow string format
- [ ] Unit tests for `fontWeight` boolean mapping in at least one layout file — covers TYPO-03 default behavior
- [ ] Unit test for `AVAILABLE_FONTS[0] === "PlusJakartaSans"` — covers TYPO-01
- [ ] Check for existing test config file at `services/remotion-studio/vitest.config.ts` or `jest.config.*`

---

## Security Domain

> `security_enforcement` is not explicitly set to false in config.json — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes | `validatePipelineConfig` validates all new fields; intensity 0–1, softness 0–N, boolean fields |
| V6 Cryptography | No | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via glow color string injected into CSS | Tampering | Color input comes from `<input type="color">` which only produces valid hex values; validate in `validatePipelineConfig` that `outerGlow.color` matches `/^#[0-9a-fA-F]{6}$/` |
| CSS injection via softness value | Tampering | Softness comes from `<input type="range">` which produces a number; validate as `number >= 0` in schema |
| Config poisoning via malformed JSON | Tampering | Existing `validatePipelineConfig` gate already applies; new fields must be added to validation |

**The color field is the only new injection surface.** The existing `TextShadow.color` field has the same exposure and no validation currently. Recommend adding hex pattern validation for all color fields in this phase since we're touching validation anyway.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

The following directives are non-negotiable for the planner and executor:

1. **UI tooling:** Every plan/execute task that touches `StyleControls.tsx`, `TitleEditor.tsx`, or any other frontend file MUST invoke the `impeccable` skill AND the `frontend-design` plugin at the START of execution, not as an afterthought.
2. **Studio port:** Always port 3123. Start command: `cd services/remotion-studio && setsid env PORT=3123 EDITOR_DIST=$(pwd)/dist/editor ACTIVE_PIPELINE_CONFIG_PATH=$(pwd)/../../pipeline/pipeline-config.json npx tsx src/server.ts > /tmp/remotion-server.log 2>&1 &`
3. **Renderer sync:** After modifying any composition or shared module in `services/remotion-studio/src/`, copy to `services/remotion-renderer/src/` using the AGENTS.md sync commands. Do not copy Root.tsx or SubtitledVideo.tsx.
4. **Pipeline worker concurrency:** Hard limit 1 — never raise this.
5. **No design token system:** Phase 18 D-07 deferred this. Use inline styles only. No CSS modules, no Tailwind, no external UI libraries.
6. **In-memory edit + manual Save:** New controls fire `onChange(partial)` immediately for live preview; persist only on Save (PUT /api/config). No auto-save.
7. **`loadFont` signature:** Must be `loadFont("normal", { subsets: ["latin", "latin-ext"] })`. NOT `loadFont({ subsets })` — this regression caused the monospace fallback bug fixed in 260527-i3v.

---

## Sources

### Primary (HIGH confidence)
- Codebase grep + file reads — `services/remotion-studio/src/fonts.ts`, `pipeline-config.ts`, all 4 layout files, `StyleControls.tsx`, `TitleEditor.tsx`, `TitleOverlay.tsx`, `shared-styles.ts` [VERIFIED: codebase]
- `node_modules/@remotion/google-fonts/dist/esm/PlusJakartaSans.mjs` — fontFamily = "Plus Jakarta Sans", CSS weights 200–800 available [VERIFIED: codebase grep]
- `node_modules/@remotion/google-fonts/dist/cjs/PlusJakartaSans.js` — confirmed `exports.fontFamily = 'Plus Jakarta Sans'` [VERIFIED: codebase grep]
- `19-CONTEXT.md` — locked decisions D-01 through D-10 [VERIFIED: codebase]
- `19-UI-SPEC.md` — approved UI design contract [VERIFIED: codebase]
- CSS `text-shadow` spec — `0 0 <blur>px <color>` is the standard outer glow pattern [ASSUMED: training knowledge, but universally established CSS]

### Secondary (MEDIUM confidence)
- AGENTS.md renderer sync pattern — copy commands [VERIFIED: codebase]

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing stack verified in node_modules
- Architecture: HIGH — all files read directly from codebase; exact line numbers identified
- Pitfalls: HIGH — all derived from direct codebase inspection (hardcoded values confirmed by grep)
- CSS glow implementation: HIGH — CSS `text-shadow` is a well-established primitive

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (30 days — stable stack, no fast-moving dependencies)
