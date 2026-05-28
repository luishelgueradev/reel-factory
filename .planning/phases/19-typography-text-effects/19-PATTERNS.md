# Phase 19: Typography & Text Effects - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 10 new/modified files (studio) + 6 renderer sync targets
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/remotion-studio/src/pipeline-config.ts` | config/schema | request-response | itself (existing interfaces) | exact — extend in-place |
| `services/remotion-studio/src/fonts.ts` | config/utility | request-response | itself (25-font FONT_LOADERS map) | exact — add one entry |
| `services/remotion-studio/src/compositions/shared-styles.ts` | utility | transform | `getBackgroundHighlightStyle()` in same file | exact — parallel helper |
| `services/remotion-studio/src/compositions/TikTokLayout.tsx` | component | event-driven | itself (CaptionWord span, line 109) | exact — de-hardcode in-place |
| `services/remotion-studio/src/compositions/BarLayout.tsx` | component | event-driven | TikTokLayout.tsx (identical BarWord pattern) | exact — same word-span pattern |
| `services/remotion-studio/src/compositions/KaraokeLayout.tsx` | component | event-driven | TikTokLayout.tsx (word-span pattern, 2 spans) | exact — same pattern, dual spans |
| `services/remotion-studio/src/compositions/SentenceLayout.tsx` | component | event-driven | TikTokLayout.tsx (word-span pattern) | exact — same inline span pattern |
| `services/remotion-studio/src/compositions/TitleOverlay.tsx` | component | event-driven | itself (title+subtitle spans, lines 208–240) | exact — de-hardcode in-place |
| `services/remotion-studio/src/editor/components/StyleControls.tsx` | component | request-response | itself (Highlight Transition toggle, Background Highlight card) | exact — copy existing UI patterns |
| `services/remotion-studio/src/editor/components/TitleEditor.tsx` | component | request-response | itself (FONT_OPTIONS array, font size sliders, toggle buttons) | exact — extend in-place |

Renderer sync targets (copy after studio changes — no pattern needed, identical code):
- `services/remotion-renderer/src/pipeline-config.ts`
- `services/remotion-renderer/src/fonts.ts`
- `services/remotion-renderer/src/compositions/shared-styles.ts`
- `services/remotion-renderer/src/compositions/TikTokLayout.tsx`
- `services/remotion-renderer/src/compositions/BarLayout.tsx`
- `services/remotion-renderer/src/compositions/KaraokeLayout.tsx`
- `services/remotion-renderer/src/compositions/SentenceLayout.tsx`
- `services/remotion-renderer/src/compositions/TitleOverlay.tsx`

---

## Pattern Assignments

---

### `services/remotion-studio/src/pipeline-config.ts` (config/schema)

**Analog:** itself — extend existing interfaces in-place.

**Existing sibling interface to copy** (`TextShadow`, lines 25–31):
```typescript
export interface TextShadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}
```

**New `OuterGlow` interface — follow `TextShadow` pattern exactly:**
```typescript
// Place after TextShadow interface (line 31)
export interface OuterGlow {
  enabled: boolean;
  color: string;     // hex, e.g. "#ffffff"
  intensity: number; // 0–1 alpha multiplier
  softness: number;  // blur radius in px
}
```

**Extend `SubtitleConfig`** (add after `subtitleWidth?: number`, line 52):
```typescript
fontWeight?: boolean;   // false = 400 regular, true = 700 bold. Default: true (preserves existing behavior)
fontStyle?: boolean;    // false = normal, true = italic. Default: false
outerGlow?: OuterGlow;
```

**Extend `TitleStyleProps`** (add after `padding?: number`, line 73):
```typescript
fontWeight?: boolean;
fontStyle?: boolean;
outerGlow?: OuterGlow;
```

**Update `DEFAULT_SUBTITLE_CONFIG`** — currently declared at line 126. Change `fontFamily` key in the `Pick<>` list and set default:
```typescript
// Add "fontFamily" | "fontWeight" to the Pick keys, then in the object:
fontFamily: "PlusJakartaSans",  // was implicit Inter (no entry); now explicit
fontWeight: true,               // preserves existing hardcoded 700 behavior
// fontStyle omitted — undefined defaults to normal
```

**Validation — add to `validatePipelineConfig`** (following `textShadow` validation at line 278):
```typescript
// Validate subtitle.outerGlow (optional)
if (sub.outerGlow !== undefined) {
  const og = sub.outerGlow as Record<string, unknown>;
  if (typeof og !== "object" || og === null || Array.isArray(og)) {
    errors.push("subtitle.outerGlow must be an object");
  } else {
    if (typeof og.enabled !== "boolean") {
      errors.push("subtitle.outerGlow.enabled must be a boolean");
    }
    if (typeof og.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(og.color as string)) {
      errors.push("subtitle.outerGlow.color must be a 6-digit hex color (e.g. #ffffff)");
    }
    if (typeof og.intensity !== "number" || (og.intensity as number) < 0 || (og.intensity as number) > 1) {
      errors.push("subtitle.outerGlow.intensity must be a number between 0 and 1");
    }
    if (typeof og.softness !== "number" || (og.softness as number) < 0) {
      errors.push("subtitle.outerGlow.softness must be a non-negative number");
    }
  }
}
// Validate subtitle.fontWeight (optional boolean)
if (sub.fontWeight !== undefined && typeof sub.fontWeight !== "boolean") {
  errors.push("subtitle.fontWeight must be a boolean");
}
// Validate subtitle.fontStyle (optional boolean)
if (sub.fontStyle !== undefined && typeof sub.fontStyle !== "boolean") {
  errors.push("subtitle.fontStyle must be a boolean");
}
```

**Fix subtitle font size validation** (line 359 — `subtitleFontSize` max currently 120):
```typescript
// Change from:
if (s.subtitleFontSize !== undefined && (typeof s.subtitleFontSize !== "number" || s.subtitleFontSize < 8 || s.subtitleFontSize > 120)) {
// Change to:
if (s.subtitleFontSize !== undefined && (typeof s.subtitleFontSize !== "number" || s.subtitleFontSize < 8 || s.subtitleFontSize > 200)) {
```

---

### `services/remotion-studio/src/fonts.ts` (config/utility)

**Analog:** itself — 25-font FONT_LOADERS pattern.

**Import pattern** (lines 6–30 show the exact convention):
```typescript
import { loadFont as loadInter, fontFamily as interFamily } from "@remotion/google-fonts/Inter";
```

**New import to prepend before line 6:**
```typescript
import { loadFont as loadPlusJakartaSans, fontFamily as plusJakartaSansFamily }
  from "@remotion/google-fonts/PlusJakartaSans";
```

**`AVAILABLE_FONTS` array** (lines 35–41) — add at position 0:
```typescript
export const AVAILABLE_FONTS = [
  "PlusJakartaSans",  // NEW — position 0 (new default)
  "Inter", "Roboto", "Montserrat", "Oswald", "Poppins", "BebasNeue", "Antonio",
  // ... rest unchanged
] as const;
```

**`FONT_LOADERS` map** (lines 54–80) — add before `Inter` entry:
```typescript
const FONT_LOADERS: Record<string, { fontFamily: string; loadFont: (...args: any[]) => any }> = {
  PlusJakartaSans: { fontFamily: plusJakartaSansFamily, loadFont: loadPlusJakartaSans },
  Inter: { fontFamily: interFamily, loadFont: loadInter },
  // ... rest unchanged
};
```

**`loadFont` call pattern** (line 122 — MUST NOT regress):
```typescript
const result = await loader.loadFont("normal", { subsets: ["latin", "latin-ext"] });
```

**`getFontFamilyCSS`** (lines 99–104) resolves `"PlusJakartaSans"` → `"Plus Jakarta Sans"` automatically via the `FONT_LOADERS` map — no special case needed.

---

### `services/remotion-studio/src/compositions/shared-styles.ts` (utility/transform)

**Analog:** `getBackgroundHighlightStyle()` (lines 65–76) — the direct template.

**Existing pattern to copy:**
```typescript
// Source: shared-styles.ts lines 65–76
export function getBackgroundHighlightStyle(
  backgroundHighlight: SubtitleConfig["backgroundHighlight"]
): React.CSSProperties {
  if (!backgroundHighlight || !backgroundHighlight.enabled) {
    return {};
  }
  return {
    backgroundColor: backgroundHighlight.color,
    padding: `${backgroundHighlight.padding}px`,
    borderRadius: `${backgroundHighlight.borderRadius}px`,
  };
}
```

**New `getOuterGlowStyle()` — follow this pattern exactly:**
```typescript
// Add after getBackgroundHighlightStyle()
export function getOuterGlowStyle(
  outerGlow: SubtitleConfig["outerGlow"],
  existingTextShadow?: string
): React.CSSProperties {
  if (!outerGlow || !outerGlow.enabled) {
    return existingTextShadow ? { textShadow: existingTextShadow } : {};
  }
  const hex = outerGlow.color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const colorWithAlpha = `rgba(${r}, ${g}, ${b}, ${outerGlow.intensity})`;
  const glowShadow = `0 0 ${outerGlow.softness}px ${colorWithAlpha}`;
  const combined = existingTextShadow ? `${existingTextShadow}, ${glowShadow}` : glowShadow;
  return { textShadow: combined };
}
```

**Import update** (line 1 already imports `SubtitleConfig` — no change needed for the subtitle version; for TitleStyleProps usage in TitleOverlay, the function signature can accept `OuterGlow | undefined` directly):
```typescript
import type { SubtitleConfig, OuterGlow } from "../pipeline-config";
```

---

### `services/remotion-studio/src/compositions/TikTokLayout.tsx` (component, event-driven)

**Analog:** itself — `CaptionWord` span at line 109 is the exact target.

**`CaptionWord` props interface** (lines 40–56) — add new props:
```typescript
// Add to CaptionWord props interface:
fontWeight?: boolean;   // boolean config value
fontStyle?: boolean;    // boolean config value
// outerGlow is applied at the span level via getOuterGlowStyle
outerGlowStyle?: React.CSSProperties;
```

**`CaptionWord` destructure** (lines 58–76) — add:
```typescript
fontWeight,
fontStyle,
outerGlowStyle,
```

**`CaptionWord` span** (lines 102–122) — change `fontWeight: 700` at line 109:
```typescript
// BEFORE (line 109):
fontWeight: 700,
// AFTER:
fontWeight: config.fontWeight !== false ? 700 : 400,
fontStyle: config.fontStyle === true ? "italic" : "normal",
...outerGlowStyle,
```

**`CaptionPage`** — pass new props when rendering `<CaptionWord>`:
```typescript
// CaptionPage must read from config and pass down:
fontWeight={config.fontWeight}
fontStyle={config.fontStyle}
outerGlowStyle={getOuterGlowStyle(config.outerGlow)}
```

**Import update** (line 17–20 imports from shared-styles):
```typescript
import {
  // ... existing imports ...
  getBackgroundHighlightStyle,
  getOuterGlowStyle,   // NEW
} from "./shared-styles";
```

---

### `services/remotion-studio/src/compositions/BarLayout.tsx` (component, event-driven)

**Analog:** TikTokLayout.tsx — `BarWord` span at line 111 is identical structure to `CaptionWord`.

**Same changes as TikTokLayout** — the `BarWord` props interface (lines 39–57), destructure (lines 58–76), and span (lines 104–124) follow the identical pattern:

```typescript
// BarWord span, line 111:
// BEFORE:
fontWeight: 700,
// AFTER:
fontWeight: config.fontWeight !== false ? 700 : 400,
fontStyle: config.fontStyle === true ? "italic" : "normal",
...outerGlowStyle,
```

Add `fontWeight?: boolean`, `fontStyle?: boolean`, `outerGlowStyle?: React.CSSProperties` to `BarWord` props.

`BarPage` must pass these down to `<BarWord>` calls (same as CaptionPage pattern).

Import `getOuterGlowStyle` from `"./shared-styles"` (line 19 currently imports other helpers).

---

### `services/remotion-studio/src/compositions/KaraokeLayout.tsx` (component, event-driven)

**Analog:** TikTokLayout.tsx `CaptionWord` pattern — but KaraokeWord has TWO spans, both requiring the same update.

**`KaraokeWord` has two spans** (confirmed by grep):
- Baseline span at line 115: `fontWeight: 700`
- Active fill span at line 134: `fontWeight: 700`

**Both spans update to:**
```typescript
fontWeight: fontWeight !== false ? 700 : 400,
fontStyle: fontStyle === true ? "italic" : "normal",
```

**`KaraokeWord` props interface** (lines 23–43) — add:
```typescript
fontWeight?: boolean;
fontStyle?: boolean;
outerGlowStyle?: React.CSSProperties;
```

**Apply `outerGlowStyle`** to the outer wrapper span (lines 99–108) or baseline span, since both layers sit within the same clip mechanism.

**`KaraokeWord` outer wrapper span** (lines 99–108) currently has no `textShadow` — apply `outerGlowStyle` spread here:
```typescript
<span
  style={{
    display: "inline-block",
    position: "relative",
    // ... existing ...
    ...outerGlowStyle,  // glow on the container works for karaoke
  }}
>
```

---

### `services/remotion-studio/src/compositions/SentenceLayout.tsx` (component, event-driven)

**Analog:** TikTokLayout.tsx `CaptionWord` pattern — `SentencePage` renders tokens inline at line 193.

**Token span at line 193** (`fontWeight: 700`) — the span is defined inline inside `SentencePage`'s render, not in a separate word component. Confirm structure from lines 185–207:
```typescript
// BEFORE (line 193):
fontWeight: 700,
// AFTER:
fontWeight: (config.fontWeight !== false) ? 700 : 400,
fontStyle: config.fontStyle === true ? "italic" : "normal",
...getOuterGlowStyle(config.outerGlow),
```

`SentenceLayout` reads `config` directly in `SentencePage` — no prop-drilling needed. Call `getOuterGlowStyle` inline.

Import `getOuterGlowStyle` from `"./shared-styles"`.

---

### `services/remotion-studio/src/compositions/TitleOverlay.tsx` (component, event-driven)

**Analog:** itself — title span at line 211, subtitle span at line 228.

**`TitleOverlay` already reads `TitleStyleProps` via `style` prop** (lines 16–22). After adding `fontWeight`, `fontStyle`, `outerGlow` to `TitleStyleProps` in `pipeline-config.ts`, these are available as `style?.fontWeight`, etc.

**Main title span** (line 211 — currently `fontWeight: 800`):
```typescript
// BEFORE (line 211):
fontWeight: 800,
// AFTER (map boolean to 700 not 800 per RESEARCH.md A1):
fontWeight: style?.fontWeight !== false ? 700 : 400,
fontStyle: style?.fontStyle === true ? "italic" : "normal",
...getOuterGlowStyle(style?.outerGlow),
```

**Optional subtitle span** (line 228 — currently `fontWeight: 500`):
```typescript
// BEFORE (line 228):
fontWeight: 500,
// AFTER — subtitle span follows same toggle, lighter weight when regular (per RESEARCH.md A2):
fontStyle: style?.fontStyle === true ? "italic" : "normal",
// fontWeight on subtitle span stays at 500 for visual hierarchy (A2 recommendation)
...getOuterGlowStyle(style?.outerGlow),
```

**Import update** — `TitleOverlay` already imports from `"../fonts"` (line 11). Add `getOuterGlowStyle` from compositions:
```typescript
import { loadFont, getFontFamilyCSS } from "../fonts";
import { getOuterGlowStyle } from "./shared-styles";
```

---

### `services/remotion-studio/src/editor/components/StyleControls.tsx` (component, request-response)

**Analog:** itself — two existing patterns serve as direct templates.

**Font size slider** (lines 85–97) — change `max={120}` to `max={200}` and update hint:
```tsx
// BEFORE (line 88):
max={120}
// AFTER:
max={200}
// BEFORE (line 94-96 hint):
<span>24</span>
<span>120</span>
// AFTER:
<span>24</span>
<span>200</span>
```

**Font family selector fallback** (line 62) — change `?? "Inter"` to `?? "PlusJakartaSans"`:
```tsx
value={config.fontFamily ?? "PlusJakartaSans"}
```

**Bold/Italic toggle rows** — copy the Highlight Transition toggle pattern exactly (lines 219–256):

```tsx
// Source: StyleControls.tsx lines 219–256 (Highlight Transition toggle)
// Template — copy verbatim, substitute labels and field names:

{/* ── Font Weight toggle ────────────────────────────────────── */}
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

**Font Style toggle** — same pattern, substitute field `fontStyle`:
```tsx
// Active logic: config.fontStyle === true (italic selected), else Normal selected
// Default is Normal (undefined = false = "Normal" selected)
```

**Outer Glow section card** — copy the Background Highlight card pattern (lines 298–353):

```tsx
// Source: StyleControls.tsx lines 298–353 (Background Highlight card)
// Key structural elements to copy:
<div style={{
  padding: "12px 16px",
  background: "#1e1e2e",
  borderRadius: 8,
  border: "1px solid #333",
}}>
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
      {/* Glow Color — use ColorControl sub-component pattern (lines 360–380) */}
      {/* Intensity slider — min=0 max=1 step=0.05, label "Intensity: {value}" at 12px #999 */}
      {/* Softness slider — min=0 max=60 step=1, label "Softness: {value}px" at 12px #999 */}
    </div>
  )}
</div>
```

**`glow` initialization** (mirror `bh` const at line 23–28):
```tsx
const glow = config.outerGlow ?? {
  enabled: false,
  color: "#ffffff",
  intensity: 0.8,
  softness: 20,
};
```

**Intensity and Softness sliders** — follow the Background Highlight `Padding` slider pattern (lines 325–336):
```tsx
// Source: StyleControls.tsx lines 325–336
<div>
  <label style={{ fontSize: 12, color: "#999" }}>
    Padding: {bh.padding}px
  </label>
  <input
    type="range"
    min={0}
    max={32}
    value={bh.padding}
    onChange={(e) => onChange({ backgroundHighlight: { ...bh, padding: Number(e.target.value) } })}
    style={{ width: "100%", accentColor: "#4CAF50" }}
  />
</div>
```

**Placement order** (per UI-SPEC §"Control Placement Order"): insert Font Weight toggle and Font Style toggle after the Font Size slider (line 97), and before the Position selector (line 99). Outer Glow card goes after the Background Highlight card (line 353).

---

### `services/remotion-studio/src/editor/components/TitleEditor.tsx` (component, request-response)

**Analog:** itself — four specific locations require changes.

**`FONT_OPTIONS` array** (lines 21–27) — add `"PlusJakartaSans"` at position 0:
```typescript
const FONT_OPTIONS = [
  "PlusJakartaSans",  // NEW — position 0
  "Inter", "Roboto", "Montserrat", "Oswald", "Poppins", "BebasNeue", "Antonio",
  // ... rest unchanged
];
```

**`DEFAULT_TITLE_STYLE`** (lines 29–42) — update font defaults:
```typescript
titleFontFamily: "PlusJakartaSans",  // was "Inter"
subtitleFontFamily: "PlusJakartaSans",  // was "Inter"
```

**Font size sliders** (lines 370–402) — extend ranges:
```tsx
// Title size slider (line 378): max={120} → max={200}
// Subtitle size slider (line 394): max={80} → max={200}
```

**Font family `select` fallback** (lines 467, 484) — update default:
```tsx
value={newTitle.style?.titleFontFamily ?? "PlusJakartaSans"}   // was "Inter"
value={newTitle.style?.subtitleFontFamily ?? "PlusJakartaSans"} // was "Inter"
```

**Bold/Italic toggle rows** — copy the Entrance Animation toggle pattern (lines 282–308):
```tsx
// Source: TitleEditor.tsx lines 282–308 (Entrance Animation toggle)
// Key pattern: isSelected state + onClick → setNewTitle with spread style update
<button
  key={anim.id}
  onClick={() => setNewTitle((prev) => ({
    ...prev,
    style: { ...prev.style!, entranceAnimation: anim.id },
  }))}
  style={{
    flex: 1,
    padding: "6px 12px",
    border: `1px solid ${isSelected ? "#4CAF50" : "#444"}`,
    borderRadius: 4,
    background: isSelected ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
    color: isSelected ? "#a5d6a7" : "#ccc",
    cursor: "pointer",
    fontSize: 12,
  }}
>
```

Adapt for fontWeight:
```tsx
// Regular button: onClick → setNewTitle((prev) => ({ ...prev, style: { ...prev.style!, fontWeight: false } }))
// Bold button: onClick → setNewTitle((prev) => ({ ...prev, style: { ...prev.style!, fontWeight: true } }))
// isSelected for Bold: newTitle.style?.fontWeight !== false  (default true = Bold selected)
// isSelected for Regular: newTitle.style?.fontWeight === false
```

**Outer Glow card** — same pattern as StyleControls.tsx version above, but uses `setNewTitle` mutation pattern:
```tsx
// Color change example (following TitleEditor's existing color change pattern at lines 317–322):
onChange={(e) => {
  setNewTitle((prev) => ({
    ...prev,
    style: { ...prev.style!, outerGlow: { ...glow, color: e.target.value } },
  }));
}}
```

**`hexAndAlphaToRgba` and `rgbaToHex`** helpers (lines 44–64) already exist in TitleEditor — use for rgba construction if needed, though outer glow uses hex+float directly.

**Placement order** (per UI-SPEC §"Control Placement Order Titles tab"): after font family selects (line 496), before form actions (line 499). Insert: Font Weight toggle, Font Style toggle, Outer Glow card.

---

## Shared Patterns

### In-memory live edit + manual Save
**Source:** All existing `onChange(partial)` calls throughout `StyleControls.tsx` and `TitleEditor.tsx`
**Apply to:** All new controls (fontWeight, fontStyle, outerGlow toggles/sliders)
```tsx
// StyleControls pattern: fires immediately
onChange({ fontWeight: true })

// TitleEditor pattern: fires via setNewTitle
setNewTitle((prev) => ({ ...prev, style: { ...prev.style!, fontWeight: true } }))
```

### Dark theme inline styles
**Source:** `StyleControls.tsx` throughout, `TitleEditor.tsx` throughout
**Apply to:** All new UI controls
```tsx
// Labels: fontSize: 13, color: "#bbb"
// Inner labels: fontSize: 12, color: "#999"
// Hint text: fontSize: 11, color: "#666"
// Input backgrounds: background: "#2a2a3e"
// Section card: padding: "12px 16px", background: "#1e1e2e", borderRadius: 8, border: "1px solid #333"
// Active button: border: "1px solid #4CAF50", background: "rgba(76, 175, 80, 0.12)", color: "#a5d6a7"
// Inactive button: border: "1px solid #444", background: "#2a2a3e", color: "#ccc"
// Slider accent: accentColor: "#4CAF50"
```

### fontWeight boolean → CSS number mapping
**Source:** CONTEXT.md D-03, RESEARCH.md Pattern 4
**Apply to:** All four layout files + TitleOverlay
```typescript
// Use "!== false" (not "=== true") so undefined defaults to bold
fontWeight: config.fontWeight !== false ? 700 : 400,
```

### fontStyle boolean → CSS string mapping
**Source:** CONTEXT.md D-04, RESEARCH.md Code Examples
**Apply to:** All four layout files + TitleOverlay
```typescript
// Use "=== true" (not "!== false") so undefined defaults to "normal"
fontStyle: config.fontStyle === true ? "italic" : "normal",
```

### Hex-to-RGBA inline math (no library)
**Source:** `TitleEditor.tsx` lines 59–63 (`hexAndAlphaToRgba`), RESEARCH.md "Don't Hand-Roll"
**Apply to:** `getOuterGlowStyle()` in `shared-styles.ts`
```typescript
const r = parseInt(hex.slice(1, 3), 16);
const g = parseInt(hex.slice(3, 5), 16);
const b = parseInt(hex.slice(5, 7), 16);
// Note: getOuterGlowStyle uses hex.replace("#","") then slice(0,2) etc — both correct
```

### Renderer sync command
**Source:** AGENTS.md §"Development Conventions"
**Apply to:** After every change to studio compositions or shared modules
```bash
# Run from services/remotion-studio/
cp src/compositions/* ../remotion-renderer/src/compositions/
cp src/pipeline-config.ts src/fonts.ts ../remotion-renderer/src/
# Do NOT copy Root.tsx or SubtitledVideo.tsx
# Do NOT copy *.tsx to ../remotion-renderer/src/ root
```

---

## No Analog Found

None — all files for this phase have direct analogs in the codebase. Every pattern needed (toggle button, section card, schema interface extension, helper function, font loader entry) has a concrete existing example.

---

## Key Anti-Patterns (Extracted from RESEARCH.md)

| Anti-Pattern | What Goes Wrong | Correct Pattern |
|---|---|---|
| `fontWeight: true/false` in CSS | CSS `fontWeight` rejects booleans | Map: `config.fontWeight !== false ? 700 : 400` |
| `config.fontWeight === true` for active state | `undefined` treated as inactive (breaks default bold) | Use `config.fontWeight !== false` (undefined = bold = true) |
| `loadFont({ subsets })` | Monospace fallback bug (260527-i3v) | `loadFont("normal", { subsets: ["latin", "latin-ext"] })` |
| Replace `textShadow` with `outerGlow` | Destroys existing shadow | Comma-join both: `existingTextShadow, glowShadow` |
| Only update TikTokLayout fontWeight | Bold/italic silently broken in 3 other layouts | Update all 4: TikTok (line 109), Bar (line 111), Karaoke (lines 115+134), Sentence (line 193) |
| Copy `*.tsx` to renderer src/ root | Dead orphan copies; LayoutDispatcher imports from compositions/ | Copy only into `src/compositions/` |
| Skip renderer sync for pipeline-config.ts | Renderer TypeScript types lag studio | Sync: `cp src/pipeline-config.ts ../remotion-renderer/src/` |

---

## Metadata

**Analog search scope:** `services/remotion-studio/src/` (all subdirectories)
**Files read directly:** pipeline-config.ts, fonts.ts, shared-styles.ts, StyleControls.tsx, TitleEditor.tsx, TikTokLayout.tsx (lines 1–130), BarLayout.tsx (lines 1–140), KaraokeLayout.tsx (lines 1–160), TitleOverlay.tsx (lines 195–244, 1–50), SentenceLayout.tsx (lines 180–208)
**Pattern extraction date:** 2026-05-28
