# Phase 21: PNG Overlays - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `services/remotion-studio/src/pipeline-config.ts` | config/schema | CRUD | self (TitleConfig/TitleStyleProps pattern) | exact |
| `services/remotion-renderer/src/pipeline-config.ts` | config/schema | CRUD | `services/remotion-studio/src/pipeline-config.ts` | exact (sync copy) |
| `services/remotion-studio/src/compositions/PngOverlay.tsx` | component | request-response | `services/remotion-studio/src/compositions/TitleOverlay.tsx` | exact |
| `services/remotion-renderer/src/compositions/PngOverlay.tsx` | component | request-response | `services/remotion-studio/src/compositions/TitleOverlay.tsx` | exact (sync copy) |
| `services/remotion-studio/src/editor/components/OverlayEditor.tsx` | component | CRUD | `services/remotion-studio/src/editor/components/TitleEditor.tsx` | exact |
| `services/remotion-studio/src/preview/PreviewApp.tsx` | component | request-response | self (TABS array + title state pattern) | exact (edit) |
| `services/remotion-studio/src/SubtitledVideo.tsx` | component | request-response | self (titles map pattern) | exact (edit) |
| `services/remotion-renderer/src/Root.tsx` | component | request-response | self (titles defaultProps + SubtitledVideo call) | exact (edit) |
| `services/remotion-renderer/src/render.ts` | service | file-I/O | self (lines 250-265: video copy before bundle()) | exact (edit) |
| `services/remotion-studio/src/server.ts` | config | request-response | self (line 85: express.json limit) | exact (edit) |

---

## Pattern Assignments

### `services/remotion-studio/src/pipeline-config.ts` (config/schema, CRUD)

**Analog:** same file — `TitleConfig` / `TitleStyleProps` block (lines 67–95) and `validatePipelineConfig` titles block (lines 362–448)

**Schema extension pattern** (lines 89–95, follow this for `PngOverlayConfig` + `PipelineConfig.overlays`):
```typescript
/** Title overlay configuration (D-12) */
export interface TitleConfig {
  text: string;
  startTimeMs: number;
  durationMs: number;
  style?: TitleStyleProps;
}

// In PipelineConfig (line 129–133):
export interface PipelineConfig {
  subtitle: SubtitleConfig;
  titles?: TitleConfig[];
  visualEffects?: VisualEffectsConfig;
  // ADD:
  // overlays?: PngOverlayConfig[];
}
```

**New interface to add** (place after `TitleConfig` block, before `TransitionType`):
```typescript
/** Configuration for a single PNG overlay (Phase 21, OVERLAY-01) */
export interface PngOverlayConfig {
  imageData: string;       // base64 data URL: "data:image/png;base64,..."
  x: number;               // pixel x from left edge of 1080px frame
  y: number;               // pixel y from top edge of 1920px frame
  displayWidth: number;    // CSS display width in pixels (triggers downscale)
  opacity?: number;        // 0–1, default 1
  _resolvedFile?: string;  // runtime-only, set by render.ts, NOT persisted
}
```

**Validation pattern to mirror** (lines 362–448 for titles array validation; repeat for overlays):
```typescript
// Validate titles (optional array) — lines 362–448
if (cfg.titles !== undefined) {
  if (!Array.isArray(cfg.titles)) {
    errors.push("PipelineConfig.titles must be an array");
  } else {
    cfg.titles.forEach((title: unknown, index: number) => {
      const t = title as Record<string, unknown>;
      if (typeof t.text !== "string" || t.text.trim() === "") {
        errors.push(`titles[${index}].text must be a non-empty string`);
      }
      // ...per-field checks
    });
  }
}
// Mirror this block for overlays: check imageData is string starting with "data:image/",
// x/y/displayWidth are non-negative numbers, opacity is 0–1 if present.
// _resolvedFile is NOT validated (runtime-only, mirrors _meta pattern).
```

---

### `services/remotion-studio/src/compositions/PngOverlay.tsx` (component, request-response)

**Analog:** `services/remotion-studio/src/compositions/TitleOverlay.tsx`

**Imports pattern** (lines 1–12 of TitleOverlay.tsx):
```typescript
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
// For PngOverlay, also import:
import { Img, staticFile } from "remotion";
import type { PngOverlayConfig } from "../pipeline-config";
```

Note: PngOverlay does NOT need `delayRender`/`continueRender` explicitly — `<Img>` from remotion handles `delayRender`/`continueRender` internally. Do NOT import them for PngOverlay.

**Pixel-coordinate positioning pattern** (TitleOverlay.tsx lines 210–216):
```typescript
// Phase 20 D-03/D-04: pixel-coordinate positioning
<div
  style={{
    position: "absolute",
    left: `${(x / 1080) * 100}%`,
    top: `${(y / 1920) * 100}%`,
    // ...
  }}
>
```

Use this same percentage-based positioning for `PngOverlay` so it scales correctly inside both the 1080×1920 Composition and the smaller Player preview.

**Core component pattern** — full PngOverlay shape (mirror TitleOverlay, simplified for static opacity):
```typescript
interface PngOverlayProps {
  overlay: PngOverlayConfig;
}

export const PngOverlay: React.FC<PngOverlayProps> = ({ overlay }) => {
  // Browser Player context: overlay.imageData is a data URL — use directly as src
  // Renderer context: overlay._resolvedFile is set by render.ts — use staticFile()
  const src = overlay._resolvedFile
    ? staticFile(overlay._resolvedFile)
    : overlay.imageData;

  return (
    <AbsoluteFill>
      <Img
        src={src}
        style={{
          position: "absolute",
          left: `${(overlay.x / 1080) * 100}%`,
          top: `${(overlay.y / 1920) * 100}%`,
          width: overlay.displayWidth,
          height: "auto",
          opacity: overlay.opacity ?? 1,
          imageRendering: "auto",  // Chromium bilinear downscale — D-04
        }}
      />
    </AbsoluteFill>
  );
};
```

**Critical anti-patterns to avoid:**
- Never use native `<img>` — always `<Img>` from `remotion`
- Never call `staticFile()` with a data URL — only use it with a filename (e.g., `"overlay-0.png"`)
- Wrapper `<AbsoluteFill>` must have no background — transparent by default

---

### `services/remotion-studio/src/editor/components/OverlayEditor.tsx` (component, CRUD)

**Analog:** `services/remotion-studio/src/editor/components/TitleEditor.tsx`

**Imports pattern** (TitleEditor.tsx lines 7–9):
```typescript
import React, { useState } from "react";
import type { PngOverlayConfig } from "../../pipeline-config.js";
```

**Component interface pattern** (TitleEditor.tsx lines 11–15):
```typescript
interface OverlayEditorProps {
  overlays: PngOverlayConfig[];
  onChange: (overlays: PngOverlayConfig[]) => void;
  onPreviewChange?: (liveOverlays: PngOverlayConfig[]) => void;
}
```

**Hard-cap disabled button pattern** — D-02 (3 overlay cap):
```typescript
// TitleEditor "Add Title" button (lines 746–768) — copy this pattern for "Add Overlay"
// Disabled state when overlays.length >= 3:
<button
  onClick={() => { /* open add form */ }}
  disabled={overlays.length >= 3}
  style={{
    padding: "10px 20px",
    background: overlays.length >= 3 ? "#555" : "#2a2a3e",
    color: overlays.length >= 3 ? "#888" : "#a5d6a7",
    border: overlays.length >= 3 ? "1px dashed #555" : "1px dashed #4CAF50",
    borderRadius: 6,
    cursor: overlays.length >= 3 ? "not-allowed" : "pointer",
    fontSize: 14,
  }}
>
  + Add Overlay
</button>
```

**List item card pattern** (TitleEditor.tsx lines 195–237 — the item row with Edit/Delete):
```typescript
// Dark card with Edit + Delete buttons
<div
  key={i}
  style={{
    padding: "12px 16px",
    background: "#1e1e2e",
    borderRadius: 8,
    border: "1px solid #333",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  }}
>
  <div>
    <div style={{ fontWeight: 600, fontSize: 14, color: "#e0e0e0" }}>Overlay {i + 1}</div>
    <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
      {overlay.displayWidth}px at ({overlay.x}, {overlay.y})
    </div>
  </div>
  {/* Edit / Delete buttons — identical style to TitleEditor lines 221–234 */}
</div>
```

**Active form card pattern** (TitleEditor.tsx lines 240–246 — green-bordered form):
```typescript
<div style={{
  padding: 16,
  background: "#16213e",
  borderRadius: 8,
  border: "1px solid #4CAF50",   // green when active
}}>
  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#a5d6a7", marginBottom: 12 }}>
    {editingIndex !== null ? "Edit Overlay" : "Add Overlay"}
  </h3>
  {/* ... form controls */}
</div>
```

**X / Y number input pattern** (TitleEditor.tsx lines 296–341 — side-by-side row):
```typescript
<div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
  <div style={{ flex: 1 }}>
    <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>X (px)</label>
    <input
      type="number" min={0} max={1080} step={1}
      value={draft.x ?? 40}
      onChange={(e) => { const val = parseInt(e.target.value); if (isNaN(val)) return; /* update */ }}
      style={{ width: "100%", padding: 8, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#e0e0e0", fontSize: 14 }}
    />
  </div>
  <div style={{ flex: 1 }}>
    <label style={{ fontSize: 12, color: "#bbb", display: "block", marginBottom: 4 }}>Y (px)</label>
    <input
      type="number" min={0} max={1920} step={1}
      value={draft.y ?? 40}
      /* ... */
    />
  </div>
</div>
```

**Client-side 5 MB file gate pattern** (D-09 — add before FileReader call):
```typescript
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    setFileError("Image must be smaller than 5 MB");
    return;
  }
  setFileError(null);
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target?.result as string;
    handleDraftChange((prev) => ({ ...prev, imageData: dataUrl }));
  };
  reader.readAsDataURL(file);
};
```

**Draft live-preview pattern** (TitleEditor.tsx lines 106–110 — emit to parent on every change):
```typescript
const handleDraftChange = (updater: (prev: Partial<PngOverlayConfig>) => Partial<PngOverlayConfig>) => {
  const updated = updater(draft);
  setDraft(updated);
  onPreviewChange?.(computeLiveOverlays(updated));
};
```

**Form action buttons pattern** (TitleEditor.tsx lines 707–740):
```typescript
<div style={{ display: "flex", gap: 8 }}>
  <button
    onClick={editingIndex !== null ? handleSaveEdit : handleAdd}
    disabled={!draft.imageData}  // disabled until image is loaded
    style={{
      padding: "8px 16px",
      background: draft.imageData ? "#4CAF50" : "#555",
      color: "#fff",
      border: "none",
      borderRadius: 4,
      cursor: draft.imageData ? "pointer" : "not-allowed",
      fontSize: 13,
    }}
  >
    {editingIndex !== null ? "Save Changes" : "Add Overlay"}
  </button>
  <button
    onClick={() => { onPreviewChange?.(overlays); resetForm(); }}
    style={{ padding: "8px 16px", background: "#444", color: "#ccc", border: "1px solid #555", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
  >
    Cancel
  </button>
</div>
```

---

### `services/remotion-studio/src/preview/PreviewApp.tsx` (component, request-response) — EDIT

**Analog:** self (lines 27–31 TABS array; lines 209–213 titles state; lines 388–395 PreviewPlayer call)

**TABS array edit** (lines 27–31 — insert "overlays" after "titles"):
```typescript
// BEFORE:
const TABS: { id: string; label: string }[] = [
  { id: "titles",    label: "Titles"    },
  { id: "subtitles", label: "Subtitles" },
  { id: "text",      label: "Text"      },
];

// AFTER:
const TABS: { id: string; label: string }[] = [
  { id: "titles",    label: "Titles"    },
  { id: "overlays",  label: "Overlays"  },   // D-08: inserted after titles
  { id: "subtitles", label: "Subtitles" },
  { id: "text",      label: "Text"      },
];
```

**State pattern** (lines 209–210 — mirror titles state for overlays):
```typescript
// Existing titles state (lines 209–210):
const [titles, setTitles] = useState<TitleConfig[]>([]);
const [liveTitles, setLiveTitles] = useState<TitleConfig[]>([]);

// Add overlays state following same pattern:
const [overlays, setOverlays] = useState<PngOverlayConfig[]>([]);
const [liveOverlays, setLiveOverlays] = useState<PngOverlayConfig[]>([]);
```

**Config load pattern** (lines 245–258 — add overlays to the existing /api/config fetch):
```typescript
// Existing titles load (lines 245–258):
if (data && Array.isArray(data.titles)) {
  const validTitles = (data.titles as unknown[]).filter(
    (t): t is TitleConfig => typeof t === "object" && t !== null && ...
  );
  setTitles(validTitles);
}
// Mirror for overlays:
if (data && Array.isArray(data.overlays)) {
  const validOverlays = (data.overlays as unknown[]).filter(
    (o): o is PngOverlayConfig =>
      typeof o === "object" && o !== null &&
      typeof (o as PngOverlayConfig).imageData === "string" &&
      typeof (o as PngOverlayConfig).x === "number" &&
      typeof (o as PngOverlayConfig).y === "number" &&
      typeof (o as PngOverlayConfig).displayWidth === "number"
  );
  setOverlays(validOverlays);
}
```

**Save payload pattern** (lines 283–288 — add overlays to PUT /api/config body):
```typescript
// BEFORE:
const payload = { subtitle: subtitleConfig, titles };
// AFTER:
const payload = { subtitle: subtitleConfig, titles, overlays };
```

**Tab content pattern** (lines 411–433 — add overlays tab panel):
```typescript
{/* Overlays tab — D-08: after Titles */}
<div style={{ display: activeTab === "overlays" ? "block" : "none" }}>
  <OverlayEditor overlays={overlays} onChange={setOverlays} onPreviewChange={setLiveOverlays} />
</div>
```

**PreviewPlayer call** (line 389–394 — pass overlays into inputProps):
```typescript
// BEFORE:
<PreviewPlayer subtitleConfig={subtitleConfig} captionPages={captionPages} totalDurationMs={totalDurationMs} titles={liveTitles} />
// AFTER: add overlays prop (PreviewPlayer must pass to Player inputProps)
<PreviewPlayer subtitleConfig={subtitleConfig} captionPages={captionPages} totalDurationMs={totalDurationMs} titles={liveTitles} overlays={liveOverlays} />
```

---

### `services/remotion-studio/src/SubtitledVideo.tsx` (component, request-response) — EDIT

**Analog:** self (lines 91–104 — titles map pattern)

**Interface extension** (line 26 — add overlays to RemotionProps):
```typescript
// Existing (line 26):
titles?: TitleConfig[];
// Add after:
overlays?: PngOverlayConfig[];
```

**Overlay rendering pattern** (mirror titles map, lines 91–104):
```typescript
// Existing titles rendering (lines 91–104):
{(titles ?? []).map((title, i) => {
  const fromFrame = Math.round(title.startTimeMs * (fps / 1000));
  const durationInFrames = Math.max(1, Math.round(title.durationMs * (fps / 1000)));
  return (
    <Sequence key={`title-${i}`} from={fromFrame} durationInFrames={durationInFrames}>
      <TitleOverlay text={title.text} style={title.style} durationMs={title.durationMs} fontFamily={config.fontFamily} />
    </Sequence>
  );
})}

// PngOverlay rendering — static (no Sequence wrapper; no timing):
{(overlays ?? []).map((overlay, i) => (
  <PngOverlay key={`overlay-${i}`} overlay={overlay} />
))}
// Place AFTER subtitle renderer and BEFORE (or after) title overlays per desired z-order.
// Default: after ZoomContainer+subtitles, before titles — so subtitles read on top.
```

---

### `services/remotion-renderer/src/Root.tsx` (component, request-response) — EDIT

**Analog:** self (lines 8–9 TitleOverlay import; lines 23 titles type; lines 142 defaultProps titles)

**Import addition** (lines 4–9):
```typescript
import { TitleOverlay } from "./compositions/TitleOverlay";
// ADD:
import { PngOverlay } from "./compositions/PngOverlay";
```

**Type import addition** (line 8):
```typescript
import type { SubtitleLayoutMode, SubtitlePosition, SubtitleConfig, TitleConfig } from "./pipeline-config";
// ADD PngOverlayConfig to this import:
import type { SubtitleLayoutMode, SubtitlePosition, SubtitleConfig, TitleConfig, PngOverlayConfig } from "./pipeline-config";
```

**RemotionProps interface extension** (line 23):
```typescript
titles?: TitleConfig[];
// ADD:
overlays?: PngOverlayConfig[];
```

**defaultProps extension** (lines 130–146):
```typescript
defaultProps={{
  // ... existing fields ...
  titles: [] as TitleConfig[],
  // ADD:
  overlays: [] as PngOverlayConfig[],
  // ...
}}
```

---

### `services/remotion-renderer/src/render.ts` (service, file-I/O) — EDIT

**Analog:** self (lines 250–265 — video copy before bundle() pattern)

**File copy before bundle() pattern** (lines 250–265):
```typescript
// Step 3: Copying video to Remotion public/ directory (lines 250–256)
console.log("[remotion-renderer] Step 3: Copying video to Remotion public/ directory");
const publicDir = path.join(process.cwd(), "public");
fs.mkdirSync(publicDir, { recursive: true });
const videoFileName = "input-video.mp4";
const publicVideoPath = path.join(publicDir, videoFileName);
fs.copyFileSync(inputPath, publicVideoPath);
console.log(`  Copied ${inputPath} -> public/${videoFileName}`);

// ADD: Decode PNG overlays BEFORE bundle() — same step, same publicDir
// ALL public/ writes must happen before bundle() — see OVERLAY-02 pitfall
const overlays = (pipelineConfig?.overlays ?? []).map((ov, i) => {
  if (!ov.imageData) return { ...ov, _resolvedFile: "" };
  const base64 = ov.imageData.replace(/^data:image\/\w+;base64,/, "");
  const pngBuffer = Buffer.from(base64, "base64");
  const fileName = `overlay-${i}.png`;
  fs.writeFileSync(path.join(publicDir, fileName), pngBuffer);
  // Advisory upscale warning (D-05): warn if decoded PNG is likely smaller than displayWidth
  if (pngBuffer.length < ov.displayWidth * ov.displayWidth * 0.5) {
    console.warn(`  [WARN] overlay-${i}: PNG may be upscaled — source size ${pngBuffer.length}B is small for displayWidth=${ov.displayWidth}px`);
  }
  console.log(`  Decoded PNG overlay ${i} -> public/${fileName}`);
  return { ...ov, _resolvedFile: fileName };
});
```

**inputProps extension** (lines 279–310 — add overlays):
```typescript
const inputProps: RemotionProps = {
  videoSrc: videoFileName,
  // ... existing fields ...
  titles: pipelineConfig?.titles || [],
  // ADD:
  overlays,
};
```

---

### `services/remotion-studio/src/server.ts` (config, request-response) — EDIT

**Analog:** self (line 85)

**JSON body limit edit** (line 85 — single character change):
```typescript
// BEFORE:
app.use(express.json({ limit: "1mb" }));

// AFTER (D-10):
app.use(express.json({ limit: "10mb" }));
```

---

## Shared Patterns

### Pixel-coordinate CSS positioning
**Source:** `services/remotion-studio/src/compositions/TitleOverlay.tsx` lines 210–216
**Apply to:** `PngOverlay.tsx` (both studio and renderer)
```typescript
style={{
  position: "absolute",
  left: `${(x / 1080) * 100}%`,
  top: `${(y / 1920) * 100}%`,
}}
```

### Dark-theme inline style palette
**Source:** `services/remotion-studio/src/editor/components/TitleEditor.tsx` throughout
**Apply to:** `OverlayEditor.tsx` (all form controls, cards, buttons)
```typescript
// Colors used consistently across TitleEditor:
background: "#1a1a2e"   // page background
background: "#16213e"   // active form card background
background: "#1e1e2e"   // list item card background
background: "#2a2a3e"   // input field background
border: "1px solid #333"  // card border
border: "1px solid #444"  // input border
border: "1px solid #4CAF50"  // active/selected green border
color: "#e0e0e0"         // primary text
color: "#bbb"            // label text
color: "#666"            // secondary/hint text
color: "#a5d6a7"         // green accent text
accentColor: "#4CAF50"   // range slider accent
```

### Draft live-preview loop
**Source:** `services/remotion-studio/src/editor/components/TitleEditor.tsx` lines 106–110
**Apply to:** `OverlayEditor.tsx`
```typescript
const handleDraftChange = (updater: (prev: Partial<T>) => Partial<T>) => {
  const updated = updater(draft);
  setDraft(updated);
  onPreviewChange?.(computeLiveItems(updated));
};
```

### Config load + shape validation
**Source:** `services/remotion-studio/src/preview/PreviewApp.tsx` lines 245–258
**Apply to:** `PreviewApp.tsx` overlays load block
```typescript
const valid = (data.x as unknown[]).filter(
  (item): item is T =>
    typeof item === "object" && item !== null &&
    typeof (item as T).requiredNumericField === "number"
);
```

### File copy / decode before bundle()
**Source:** `services/remotion-renderer/src/render.ts` lines 250–256
**Apply to:** `render.ts` PNG decode block
All `public/` writes (video copy AND PNG decode) must be grouped before the `bundle()` call at line 260.

### Renderer sync (mandatory after any composition edit)
**Source:** `AGENTS.md` §"Development Conventions" — renderer-sync pattern
**Apply to:** After editing studio compositions or shared modules
```bash
cp services/remotion-studio/src/compositions/* services/remotion-renderer/src/compositions/
cp services/remotion-studio/src/pipeline-config.ts services/remotion-renderer/src/
```

---

## No Analog Found

All files have close analogs in the codebase. No entries in this section.

---

## Metadata

**Analog search scope:** `services/remotion-studio/src/`, `services/remotion-renderer/src/`
**Files scanned:** 10 source files read directly
**Pattern extraction date:** 2026-05-29
