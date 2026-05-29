# Phase 20: Title Block Precision — Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 5 (3 modified in studio, 2 sync targets in renderer)
**Analogs found:** 5 / 5 — all files are self-analogs (modifying existing files in-place)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/remotion-studio/src/pipeline-config.ts` | config/schema | transform | itself (current state) | self |
| `services/remotion-studio/src/compositions/TitleOverlay.tsx` | component | request-response (Remotion frame render) | itself (current state) | self |
| `services/remotion-studio/src/editor/components/TitleEditor.tsx` | component/UI | event-driven (onChange) | itself (current state) | self |
| `services/remotion-renderer/src/pipeline-config.ts` | config/schema | transform | `services/remotion-studio/src/pipeline-config.ts` | exact (cp sync) |
| `services/remotion-renderer/src/compositions/TitleOverlay.tsx` | component | request-response | `services/remotion-studio/src/compositions/TitleOverlay.tsx` | exact (cp sync) |
| `services/remotion-renderer/src/pipeline-config.test.ts` | test | batch | itself (current state) | self |

---

## Pattern Assignments

### `services/remotion-studio/src/pipeline-config.ts` (config/schema, transform)

**Change type:** Interface field surgery — remove 4 fields, add 3 fields, remove 2 validation blocks.

**Current `TitleStyleProps` interface** (lines 72–88):
```typescript
export interface TitleStyleProps {
  entranceAnimation?: TitleEntranceAnimation;
  backgroundColor?: string;
  textColor?: string;
  titleFontSize?: number;
  subtitleFontSize?: number;    // REMOVE (D-08)
  titleColor?: string;
  subtitleColor?: string;       // REMOVE (D-08)
  titleFontFamily?: string;
  subtitleFontFamily?: string;  // REMOVE (D-08)
  topOffset?: number;           // REMOVE (D-05)
  lineHeight?: number;
  padding?: number;
  fontWeight?: boolean;
  fontStyle?: boolean;
  outerGlow?: OuterGlow;
}
```

**Target `TitleStyleProps` after Phase 20:**
```typescript
export interface TitleStyleProps {
  entranceAnimation?: TitleEntranceAnimation;
  backgroundColor?: string;
  textColor?: string;
  titleFontSize?: number;
  titleColor?: string;
  titleFontFamily?: string;
  x?: number;            // NEW — pixel x from top-left (D-05, D-06)
  y?: number;            // NEW — pixel y from top-left (D-05, D-06)
  borderRadius?: number; // NEW — configurable (was hardcoded 12) (D-09)
  lineHeight?: number;
  padding?: number;
  fontWeight?: boolean;
  fontStyle?: boolean;
  outerGlow?: OuterGlow;
}
```

**Current `TitleConfig` interface** (lines 91–97):
```typescript
export interface TitleConfig {
  text: string;
  subtitle?: string;    // REMOVE (D-07)
  startTimeMs: number;
  durationMs: number;
  style?: TitleStyleProps;
}
```

**Target `TitleConfig` after Phase 20:**
```typescript
export interface TitleConfig {
  text: string;
  startTimeMs: number;
  durationMs: number;
  style?: TitleStyleProps;
}
```

**Validation blocks to REMOVE** (lines 408–413 — both must be deleted):
```typescript
// DELETE this block (subtitleFontSize validation — D-08):
if (s.subtitleFontSize !== undefined && (typeof s.subtitleFontSize !== "number" || s.subtitleFontSize < 8 || s.subtitleFontSize > 200)) {
  errors.push(`titles[${index}].style.subtitleFontSize must be a number between 8 and 200`);
}
// DELETE this block (topOffset validation — D-05):
if (s.topOffset !== undefined && (typeof s.topOffset !== "number" || s.topOffset < 0 || s.topOffset > 100)) {
  errors.push(`titles[${index}].style.topOffset must be a number between 0 and 100`);
}
```

**Validation pattern to ADD** (after `titleFontSize` check, following the existing `if (s.X !== undefined && ...)` pattern — lines 405–407):
```typescript
// ADD: x must be a non-negative number (RESEARCH.md open question resolution)
if (s.x !== undefined && (typeof s.x !== "number" || s.x < 0)) {
  errors.push(`titles[${index}].style.x must be a non-negative number`);
}
// ADD: y must be a non-negative number
if (s.y !== undefined && (typeof s.y !== "number" || s.y < 0)) {
  errors.push(`titles[${index}].style.y must be a non-negative number`);
}
// ADD: borderRadius must be a non-negative number
if (s.borderRadius !== undefined && (typeof s.borderRadius !== "number" || s.borderRadius < 0)) {
  errors.push(`titles[${index}].style.borderRadius must be a non-negative number`);
}
```

**Pattern reference for validation style** — copy the existing non-negative number pattern already in the file (line 417):
```typescript
if (s.padding !== undefined && (typeof s.padding !== "number" || s.padding < 0 || s.padding > 100)) {
  errors.push(`titles[${index}].style.padding must be a number between 0 and 100`);
}
```

---

### `services/remotion-studio/src/compositions/TitleOverlay.tsx` (component, Remotion render)

**Change type:** Variable removals, positioning CSS change, DEFAULT_TITLE_STYLE update.

**Current `DEFAULT_TITLE_STYLE`** (lines 34–50) — self-analog for the pattern:
```typescript
const DEFAULT_TITLE_STYLE: Required<TitleStyleProps> = {
  entranceAnimation: "slide-up",
  backgroundColor: "rgba(0,0,0,0.7)",
  textColor: "#FFFFFF",
  titleFontSize: 72,
  subtitleFontSize: 42,        // REMOVE
  titleColor: "#FFFFFF",
  subtitleColor: "#FFFFFF",    // REMOVE
  titleFontFamily: "PlusJakartaSans",
  subtitleFontFamily: "PlusJakartaSans",  // REMOVE
  topOffset: 50,               // REMOVE
  lineHeight: 1.2,
  padding: 40,
  fontWeight: true,
  fontStyle: false,
  outerGlow: { enabled: false, color: "#ffffff", intensity: 0.8, softness: 20 },
};
```

**Target `DEFAULT_TITLE_STYLE` after Phase 20:**
```typescript
const DEFAULT_TITLE_STYLE: Required<TitleStyleProps> = {
  entranceAnimation: "slide-up",
  backgroundColor: "rgba(0,0,0,0.7)",
  textColor: "#FFFFFF",
  titleFontSize: 72,
  titleColor: "#FFFFFF",
  titleFontFamily: "PlusJakartaSans",
  x: 200,           // NEW (D-06)
  y: 960,           // NEW (D-06)
  borderRadius: 12, // NEW (D-09)
  lineHeight: 1.2,
  padding: 40,
  fontWeight: true,
  fontStyle: false,
  outerGlow: { enabled: false, color: "#ffffff", intensity: 0.8, softness: 20 },
};
```

**Variables to REMOVE from component body** (lines 66–71, 77–78):
```typescript
// REMOVE these variable declarations:
const subtitleFontSize = style?.subtitleFontSize ?? DEFAULT_TITLE_STYLE.subtitleFontSize;
const subtitleColor = style?.subtitleColor ?? style?.textColor ?? DEFAULT_TITLE_STYLE.subtitleColor;
const subtitleFontFamily = style?.subtitleFontFamily ?? fontFamily ?? DEFAULT_TITLE_STYLE.subtitleFontFamily;
const topOffset = style?.topOffset ?? DEFAULT_TITLE_STYLE.topOffset;
// REMOVE these CSS name resolutions:
const subtitleFontCSS = getFontFamilyCSS(subtitleFontFamily);
```

**Variables to ADD** (after existing `const titleFontCSS = ...` line 77):
```typescript
const x = style?.x ?? DEFAULT_TITLE_STYLE.x;
const y = style?.y ?? DEFAULT_TITLE_STYLE.y;
const borderRadius = style?.borderRadius ?? DEFAULT_TITLE_STYLE.borderRadius;
```

**`fontsToLoad` array fix** (lines 85–87) — remove `subtitleFontFamily` from the dedup array:
```typescript
// CURRENT (line 85):
const fontsToLoad = [titleFontFamily, subtitleFontFamily].filter(
  (f, i, arr) => f && f !== "monospace" && arr.indexOf(f) === i
);
// AFTER:
const fontsToLoad = [titleFontFamily].filter(
  (f, i, arr) => f && f !== "monospace" && arr.indexOf(f) === i
);
```

**`useEffect` dependency array fix** (line 112) — remove `subtitleFontFamily`:
```typescript
// CURRENT:
  }, [titleFontFamily, subtitleFontFamily]);
// AFTER:
  }, [titleFontFamily]);
```

**Positioning CSS change** (lines 199–215) — the core D-04 pattern:
```typescript
// CURRENT (lines 199–215):
<div
  style={{
    position: "absolute",
    top: `${topOffset}%`,
    left: "50%",
    transform: `translate(-50%, -50%) translateY(${translateY}px)`,
    backgroundColor,
    width: "80%",
    padding: `${padding}px 24px`,
    borderRadius: "12px",   // hardcoded
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: subtitle ? "12px" : "0",
    opacity,
  }}
>

// AFTER (D-03, D-04, D-09):
<div
  style={{
    position: "absolute",
    left: `${(x / 1080) * 100}%`,
    top: `${(y / 1920) * 100}%`,
    transform: `translateY(${translateY}px)`,   // centering removed; animation-only offset
    backgroundColor,
    width: "80%",
    padding: `${padding}px 24px`,
    borderRadius: `${borderRadius}px`,          // config-driven
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0",   // subtitle gone; gap always 0
    opacity,
  }}
>
```

**Subtitle JSX block to REMOVE entirely** (lines 236–254):
```typescript
// REMOVE this entire JSX block (D-07):
{subtitle && (
  <span
    style={{
      fontSize: subtitleFontSize,
      fontWeight: style?.fontWeight !== false ? 700 : 400,
      fontStyle: style?.fontStyle === true ? "italic" : "normal",
      color: subtitleColor,
      fontFamily: subtitleFontCSS,
      textAlign: "center",
      lineHeight: lineHeight + 0.1,
      opacity: 0.85,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      ...getOuterGlowStyle(style?.outerGlow),
    }}
  >
    {subtitle}
  </span>
)}
```

**Component signature fix** (lines 17–23, 52–58) — remove `subtitle` from interface and destructuring:
```typescript
// CURRENT interface (lines 17–23):
interface TitleOverlayProps {
  text: string;
  subtitle?: string;  // REMOVE
  style?: TitleStyleProps;
  durationMs: number;
  fontFamily?: string;
}

// CURRENT destructuring (lines 52–58):
export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  text,
  subtitle,        // REMOVE
  style,
  durationMs,
  fontFamily = "PlusJakartaSans",
}) => {
```

---

### `services/remotion-studio/src/editor/components/TitleEditor.tsx` (component/UI, event-driven)

**Change type:** Form field removals, new inputs, DEFAULT_TITLE_STYLE update.

**Current `DEFAULT_TITLE_STYLE`** (lines 25–38) — plain object, no TypeScript annotation:
```typescript
const DEFAULT_TITLE_STYLE = {
  entranceAnimation: "slide-up" as TitleEntranceAnimation,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  textColor: "#FFFFFF",
  titleFontSize: 72,
  subtitleFontSize: 42,        // REMOVE
  titleColor: "#FFFFFF",
  subtitleColor: "#FFFFFF",    // REMOVE
  titleFontFamily: "PlusJakartaSans",
  subtitleFontFamily: "PlusJakartaSans",  // REMOVE
  topOffset: 50,               // REMOVE
  lineHeight: 1.2,
  padding: 40,
};
```

**Target `DEFAULT_TITLE_STYLE` after Phase 20:**
```typescript
const DEFAULT_TITLE_STYLE = {
  entranceAnimation: "slide-up" as TitleEntranceAnimation,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  textColor: "#FFFFFF",
  titleFontSize: 72,
  titleColor: "#FFFFFF",
  titleFontFamily: "PlusJakartaSans",
  x: 200,           // NEW (D-06)
  y: 960,           // NEW (D-06)
  borderRadius: 12, // NEW (D-09)
  lineHeight: 1.2,
  padding: 40,
};
```

**State initializer changes** (lines 67–73 and 76–85) — remove `subtitle: ""` from every `setNewTitle` call and `resetForm`:
```typescript
// CURRENT resetForm and initial state has:
{
  text: "",
  subtitle: "",          // REMOVE from all 3 locations
  startTimeMs: 0,
  durationMs: 3000,
  style: { ...DEFAULT_TITLE_STYLE },
}
```

**`handleAdd` and `handleSaveEdit` changes** (lines 88–102, 132–145) — remove `subtitle` field:
```typescript
// REMOVE from handleAdd (line 93):
subtitle: newTitle.subtitle || undefined,

// REMOVE from handleSaveEdit (line 138):
subtitle: newTitle.subtitle || undefined,
```

**`handleStartEdit` change** (lines 119–129) — remove `subtitle` from form population:
```typescript
// CURRENT (line 123):
subtitle: title.subtitle ?? "",  // REMOVE
```

**Title list item — subtitle display line to REMOVE** (lines 173–175):
```typescript
// REMOVE this block entirely (D-07):
{title.subtitle && (
  <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{title.subtitle}</div>
)}
```

**Form fields to REMOVE entirely:**

1. **Subtitle text input** (lines 229–241) — the entire `<div>` block for "Subtitle (optional)"
2. **Subtitle Color column** (lines 351–363) — the third column in the style colors row
3. **Subtitle Size slider** (lines 387–406) — the right half of the font sizes row (`<div style={{ flex: 1 }}>` for subtitle size)
4. **Subtitle Font select** (lines 483–500) — the right half of the font families row

**Timing row — pattern to copy for X/Y inputs** (lines 244–271):
```typescript
// This existing pattern is the exact template for X/Y number inputs:
<div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
  <div style={{ flex: 1 }}>
    <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
      Start Time (seconds)
    </label>
    <input
      type="number"
      min={0}
      step={0.1}
      value={(newTitle.startTimeMs ?? 0) / 1000}
      onChange={(e) => setNewTitle((prev) => ({ ...prev, startTimeMs: Math.round(Number(e.target.value) * 1000) }))}
      style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
    />
  </div>
  <div style={{ flex: 1 }}>
    ...
  </div>
</div>
```

**New X/Y coordinate row** (replaces topOffset slider at lines 409–425 — gap in UI-SPEC is 16px):
```tsx
// Source: UI-SPEC §Component Contracts §1 + timing row pattern above
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

**Slider pattern to copy for borderRadius** — existing Intensity slider in Outer Glow card (lines 634–655):
```tsx
// Template: Outer Glow Softness slider (lines 657–677) — same structure:
<div style={{ marginBottom: 12 }}>
  <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
    Softness: {titleGlow.softness}px
  </label>
  <input
    type="range"
    min={0}
    max={60}
    step={1}
    value={titleGlow.softness}
    onChange={(e) => setNewTitle((prev) => ({
      ...prev,
      style: { ...prev.style!, outerGlow: { ...titleGlow, softness: Number(e.target.value) } },
    }))}
    style={{ width: "100%", accentColor: "#4CAF50" }}
  />
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
    <span>0px</span>
    <span>60px</span>
  </div>
</div>
```

**New borderRadius slider** (inserted after Title Size slider, before Line Height/Padding row — UI-SPEC form order position 8):
```tsx
// Source: UI-SPEC §Component Contracts §2 + Softness slider pattern above
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

**Font families row** — after removing Subtitle Font, the row becomes a single-column full-width select. Pattern: remove `<div style={{ flex: 1 }}>` wrapper and use full-width directly, OR keep a flex row with a single `flex: 1` item. Simplest: remove the outer flex row and keep one `<div style={{ marginBottom: 12 }}>` with a full-width select.

---

### `services/remotion-renderer/src/pipeline-config.ts` and `src/compositions/TitleOverlay.tsx` (sync targets)

**No independent edits.** These are copied verbatim from their studio counterparts after studio changes are complete.

**Sync command** (from project root, per AGENTS.md):
```bash
cp services/remotion-studio/src/compositions/TitleOverlay.tsx \
   services/remotion-renderer/src/compositions/TitleOverlay.tsx

cp services/remotion-studio/src/pipeline-config.ts \
   services/remotion-renderer/src/pipeline-config.ts
```

**Analog:** `services/remotion-studio/src/pipeline-config.ts` and `services/remotion-studio/src/compositions/TitleOverlay.tsx` — exact copies.

---

### `services/remotion-renderer/src/pipeline-config.test.ts` (test, batch)

**Change type:** Update 1 existing test case; add 4 new test cases.

**Test structure pattern** (lines 1–18 — import block and describe/it pattern to copy exactly):
```typescript
import { describe, it, expect } from "vitest";
import {
  validatePipelineConfig,
  // ...other imports...
  type TitleConfig,
  type TitleStyleProps,
} from "./pipeline-config";

describe("validatePipelineConfig", () => {
  describe("valid configs", () => {
    it("accepts TitleConfig without optional style", () => {
      const config = {
        subtitle: { layout: "tiktok" },
        titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000 }],
      };
      const result = validatePipelineConfig(config);
      expect(result.valid).toBe(true);
    });
  });
  // ...
});
```

**Test to UPDATE** (line 57 — existing test uses `subtitle: "Episode 1"` which becomes a TypeScript error after `TitleConfig.subtitle` removal):
```typescript
// CURRENT (line 54–67) — "accepts full config with all fields":
titles: [
  {
    text: "Welcome",
    subtitle: "Episode 1",   // REMOVE this line — field no longer in TitleConfig
    startTimeMs: 0,
    durationMs: 3000,
    style: { entranceAnimation: "slide-up", backgroundColor: "#00000080", textColor: "#FFFFFF" },
  },
],
```

**New test cases to ADD** (following the existing `describe("valid configs")` and `describe("invalid configs")` pattern):
```typescript
// ADD to describe("valid configs"):
it("accepts x and y fields in title style", () => {
  const config = {
    subtitle: { layout: "tiktok" },
    titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { x: 200, y: 960 } }],
  };
  const result = validatePipelineConfig(config);
  expect(result.valid).toBe(true);
});

it("accepts borderRadius field in title style", () => {
  const config = {
    subtitle: { layout: "tiktok" },
    titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { borderRadius: 24 } }],
  };
  const result = validatePipelineConfig(config);
  expect(result.valid).toBe(true);
});

it("accepts borderRadius = 0 (sharp corners)", () => {
  const config = {
    subtitle: { layout: "tiktok" },
    titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { borderRadius: 0 } }],
  };
  const result = validatePipelineConfig(config);
  expect(result.valid).toBe(true);
});

// ADD to describe("invalid configs"):
it("rejects negative x in title style", () => {
  const config = {
    subtitle: { layout: "tiktok" },
    titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { x: -10 } }],
  };
  const result = validatePipelineConfig(config);
  expect(result.valid).toBe(false);
  expect(result.errors.some((e) => e.includes(".style.x"))).toBe(true);
});

it("rejects negative y in title style", () => {
  const config = {
    subtitle: { layout: "tiktok" },
    titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { y: -1 } }],
  };
  const result = validatePipelineConfig(config);
  expect(result.valid).toBe(false);
  expect(result.errors.some((e) => e.includes(".style.y"))).toBe(true);
});

it("rejects negative borderRadius in title style", () => {
  const config = {
    subtitle: { layout: "tiktok" },
    titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style: { borderRadius: -5 } }],
  };
  const result = validatePipelineConfig(config);
  expect(result.valid).toBe(false);
  expect(result.errors.some((e) => e.includes(".style.borderRadius"))).toBe(true);
});
```

---

## Shared Patterns

### onChange / in-memory live edit pattern
**Source:** `services/remotion-studio/src/editor/components/TitleEditor.tsx` throughout
**Apply to:** All new X/Y and borderRadius controls

The project-wide pattern for editor controls: every `onChange` spreads previous state and updates one field — no batching, no debounce, no explicit save. The Save button is the only persistence boundary.

```typescript
// From TitleEditor.tsx — the exact spread pattern used by EVERY control:
onChange={(e) => setNewTitle((prev) => ({
  ...prev,
  style: { ...prev.style!, fieldName: parseValue(e.target.value) },
}))}
```

### Slider label with live value echo
**Source:** `services/remotion-studio/src/editor/components/TitleEditor.tsx` lines 369, 390, 431, 447, 659
**Apply to:** borderRadius slider

Every slider label in TitleEditor echoes the current value: `Field Name: {currentValue}unit`. The borderRadius label follows this exactly: `Border Radius: {newTitle.style?.borderRadius ?? 12}px`.

```typescript
// Pattern (line 369):
<label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>
  Title Size: {newTitle.style?.titleFontSize ?? 72}
</label>
```

### Range bounds display (min/max spans under slider)
**Source:** `services/remotion-studio/src/editor/components/TitleEditor.tsx` lines 382–385, 650–653, 673–676
**Apply to:** borderRadius slider

Every slider in TitleEditor has min/max bound labels below it using this exact pattern:
```typescript
<div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
  <span>0px</span>
  <span>50px</span>
</div>
```

### Flex row for paired inputs
**Source:** `services/remotion-studio/src/editor/components/TitleEditor.tsx` lines 244–271 (timing row) and 366–407 (font sizes row)
**Apply to:** X/Y coordinate row

Paired inputs always use `display: "flex", gap: N, marginBottom: 10` with `flex: 1` on each child. The gap value for the X/Y row is **16px** per UI-SPEC (not the 12px used in the timing row — the UI-SPEC specifies `gap: 16px` for coordinate inputs explicitly).

### Input styling (dark theme)
**Source:** `services/remotion-studio/src/editor/components/TitleEditor.tsx` lines 225, 255, 267
**Apply to:** X and Y number inputs

All `<input>` elements use this exact inline style:
```typescript
style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
```

### Remotion frame-variable derivation pattern
**Source:** `services/remotion-studio/src/compositions/TitleOverlay.tsx` lines 63–73
**Apply to:** x, y, borderRadius variable derivation in TitleOverlay.tsx

All derived style values use the same null-coalescing pattern against `DEFAULT_TITLE_STYLE`:
```typescript
const fieldName = style?.fieldName ?? DEFAULT_TITLE_STYLE.fieldName;
```

### validatePipelineConfig non-negative number check
**Source:** `services/remotion-studio/src/pipeline-config.ts` lines 270–272 (outlineWidth) and 417–419 (padding)
**Apply to:** x, y, borderRadius validation additions

```typescript
// Exact pattern to copy for x, y, borderRadius (padding example at line 417):
if (s.padding !== undefined && (typeof s.padding !== "number" || s.padding < 0 || s.padding > 100)) {
  errors.push(`titles[${index}].style.padding must be a number between 0 and 100`);
}
// For x/y/borderRadius — use `< 0` only (no upper bound enforcement per RESEARCH.md recommendation):
if (s.x !== undefined && (typeof s.x !== "number" || s.x < 0)) {
  errors.push(`titles[${index}].style.x must be a non-negative number`);
}
```

---

## No Analog Found

No files in this phase lack analogs — all changes are in-place edits of existing files whose own current state is the best pattern reference.

---

## Execution Order (Atomicity Requirement)

Per RESEARCH.md: changes must be applied in this order to avoid TypeScript compilation errors at any intermediate step:

1. **`pipeline-config.ts` (studio)** — schema is the authority; update first so `Required<TitleStyleProps>` reflects the new shape
2. **`TitleOverlay.tsx` (studio)** — update `DEFAULT_TITLE_STYLE` (typed against `Required<TitleStyleProps>`) and all rendering sites
3. **`TitleEditor.tsx` (studio)** — update untyped `DEFAULT_TITLE_STYLE` and all form sites
4. **Run tests:** `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts`
5. **Renderer sync:** `cp` both files from studio to renderer
6. **Run full suite:** `cd services/remotion-renderer && npx vitest run`
7. **Build:** `cd services/remotion-studio && npm run build:editor`

---

## Metadata

**Analog search scope:** `services/remotion-studio/src/`, `services/remotion-renderer/src/`
**Files scanned:** 6 source files read directly
**Pattern extraction date:** 2026-05-29
