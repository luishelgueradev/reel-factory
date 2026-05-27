# Phase 18: Studio UI Redesign - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 13
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/editor/App.tsx` | router | request-response | `src/editor/App.tsx` (self — existing) | exact |
| `src/editor/EditorApp.tsx` | component | CRUD | `src/editor/EditorApp.tsx` (self — deleted) | exact (deleted) |
| `src/preview/PreviewApp.tsx` | component | CRUD + event-driven | `src/preview/PreviewApp.tsx` (self — base for unified screen) | exact |
| `src/preview/PreviewPlayer.tsx` | component | request-response | `src/preview/PreviewPlayer.tsx` (self — unchanged) | exact |
| `src/preview/FontGridPage.tsx` | component | event-driven | `src/preview/FontGridPage.tsx` (self — inline-folded) | exact (deleted as route) |
| `src/preview/TextareaInput.tsx` | component | event-driven | `src/preview/TextareaInput.tsx` (self — unchanged) | exact |
| `src/preview/textToCaptions.ts` | utility | transform | `src/preview/textToCaptions.ts` (self — unchanged) | exact |
| `src/editor/components/LayoutSelector.tsx` | component | event-driven | `src/editor/components/LayoutSelector.tsx` (self — unchanged) | exact |
| `src/editor/components/StyleControls.tsx` | component | event-driven | `src/editor/components/StyleControls.tsx` (self — unchanged) | exact |
| `src/editor/components/TitleEditor.tsx` | component | CRUD | `src/editor/components/TitleEditor.tsx` (self — simplified) | exact |
| `src/editor/components/ConfigPreview.tsx` | component | CRUD | `src/editor/components/ConfigPreview.tsx` (self — deleted) | exact (deleted) |
| `src/editor/index.tsx` | entry point | request-response | `src/editor/index.tsx` (self — unchanged) | exact |
| `src/server.ts` | server | request-response | `src/server.ts` (self — route changes only) | exact |

---

## Pattern Assignments

### `src/editor/App.tsx` (router — collapse to single route)

**Current state** (lines 1–24, `services/remotion-studio/src/editor/App.tsx`):
```typescript
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { EditorApp } from "./EditorApp.js";
import { PreviewApp } from "../preview/PreviewApp.js";
import { FontGridPage } from "../preview/FontGridPage.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/editor" element={<EditorApp />} />
        <Route path="/editor/*" element={<EditorApp />} />
        <Route path="/preview/fonts" element={<FontGridPage />} />
        <Route path="/preview" element={<PreviewApp />} />
        <Route path="/" element={<Navigate to="/editor" replace />} />
        <Route path="*" element={<Navigate to="/editor" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**After D-02 — target pattern:**
```typescript
// Remove EditorApp, FontGridPage imports.
// Remove PreviewApp import (the unified component can be named StudioApp or keep PreviewApp).
// Only two routes: "/" → StudioApp, "*" → Navigate to "/".
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PreviewApp } from "../preview/PreviewApp.js";  // renamed to StudioApp or kept as-is

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PreviewApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

### `src/editor/EditorApp.tsx` (DELETED — D-01)

**Reason for deletion:** Absorbed into the unified `PreviewApp`. No replacement file; the patterns (handleSave, updateSubtitle, updateTitles, header layout, status banners) already exist in `PreviewApp.tsx`. Key pattern to port to `PreviewApp` before deletion:

**handleSave pattern** (`src/editor/EditorApp.tsx` lines 54–78):
```typescript
const handleSave = useCallback(async () => {
  try {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errData.error || `Save failed: ${res.status}`);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to save config");
  } finally {
    setSaving(false);
  }
}, [config]);
```
Note: `PreviewApp.tsx` already has an equivalent `handleSave` (lines 83–116). The `EditorApp` version is simpler (no `updatedTitles` param). After D-10, `PreviewApp`'s `handleSave` is simplified to match this clean signature.

**Render Video (disabled) button** (`src/editor/EditorApp.tsx` lines 171–186):
```tsx
<button
  onClick={handleRender}     // REMOVE onClick per D-05 — must NOT fire
  disabled={rendering}       // replace: disabled={true} always
  title="Coming soon — rendering via pipeline API"
  style={{
    padding: "8px 20px",
    background: rendering ? "#555" : "#2196F3",   // after D-05: background "#333"
    color: "#fff",                                 // after D-05: color "#777"
    border: "none",
    borderRadius: 6,
    cursor: rendering ? "wait" : "pointer",        // after D-05: cursor "not-allowed"
    fontSize: 14,
    fontWeight: 600,
    opacity: 0.6,
  }}
>
  {rendering ? "Starting…" : "Render Video"}      // after D-05: always "Render Video"
</button>
```

---

### `src/preview/PreviewApp.tsx` (primary file — becomes unified StudioApp)

**Current imports** (lines 1–20):
```typescript
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { SubtitleConfig, TitleConfig } from "../pipeline-config";
import { DEFAULT_SUBTITLE_CONFIG } from "../pipeline-config";
import { PreviewPlayer } from "./PreviewPlayer";
import { TextareaInput } from "./TextareaInput";
import { textToCaptionPages, deriveTotalDurationMs, DEFAULT_SAMPLE_TEXT } from "./textToCaptions";
import { LayoutSelector } from "../editor/components/LayoutSelector";
import { StyleControls } from "../editor/components/StyleControls";
import { TitleEditor } from "../editor/components/TitleEditor";
import type { TikTokPage } from "@remotion/captions";
import { loadFont } from "../fonts";
```
Changes needed: remove `Link` and `useSearchParams` (D-06); add `AVAILABLE_FONTS, getFontFamilyCSS` from `../fonts` (for inline FontGrid); keep all others.

**Current state shape** (lines 27–43):
```typescript
const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(() => {
  const fontFromUrl = searchParams.get("font");       // REMOVE — D-06
  return {
    ...INITIAL_SUBTITLE_CONFIG,
    ...(fontFromUrl ? { fontFamily: fontFromUrl } : {}),   // REMOVE — D-06
  };
});
const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
const [titles, setTitles] = useState<TitleConfig[]>([]);
const [previewTitles, setPreviewTitles] = useState<TitleConfig[]>([]);  // REMOVE — D-10
const [saving, setSaving] = useState(false);
const [saveSuccess, setSaveSuccess] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
```
After D-10, add: `const [activeTab, setActiveTab] = useState<string>("titles");` (D-04: Titles default).

**Config load on mount** (lines 64–80) — remove `setPreviewTitles` call:
```typescript
useEffect(() => {
  fetch("/api/config")
    .then((res) => res.json())
    .then((data) => {
      if (data && data.subtitle) {
        setSubtitleConfig((prev) => ({ ...prev, ...data.subtitle }));
      }
      if (data && data.titles) {
        setTitles(data.titles);
        // setPreviewTitles(data.titles);   ← REMOVE (D-10)
      }
    })
    .catch(() => { /* use defaults */ });
}, []);
```

**handleSave simplified** (lines 83–116) — after D-10, drop `updatedTitles` param and dual-state sync:
```typescript
const handleSave = useCallback(async () => {  // no parameter — D-10
  try {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    const payload = { subtitle: subtitleConfig, titles };  // always use titles state directly
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errData.error || `Save failed: ${res.status}`);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : "Failed to save config");
  } finally {
    setSaving(false);
  }
}, [subtitleConfig, titles]);
```

**Header pattern** (lines 121–178) — keep structure, remove `Link to="/editor"` and `Link to="/preview/fonts"`, add disabled Render Video button:
```tsx
<header style={{
  padding: "12px 24px",
  borderBottom: "1px solid #333",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#16213e",
}}>
  <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", margin: 0 }}>
    Reel Factory Studio
  </h1>
  <div style={{ display: "flex", gap: 12 }}>
    <button
      disabled
      title="Coming soon — rendering via pipeline API"
      style={{
        padding: "8px 16px",
        background: "#333",
        color: "#777",
        border: "1px solid #444",
        borderRadius: 6,
        fontSize: 14,
        cursor: "not-allowed",
        opacity: 0.6,
      }}
    >
      Render Video
    </button>
    <button
      onClick={handleSave}
      disabled={saving}
      style={{
        padding: "8px 20px",
        background: saving ? "#555" : "#4CAF50",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: saving ? "wait" : "pointer",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {saving ? "Saving…" : "Save Config"}
    </button>
  </div>
</header>
```

**Status banner pattern** (lines 181–190) — keep as-is:
```tsx
{saveSuccess && (
  <div style={{ padding: "8px 24px", background: "#1b5e20", color: "#a5d6a7", fontSize: 14 }}>
    Configuration saved successfully
  </div>
)}
{saveError && (
  <div style={{ padding: "8px 24px", background: "#b71c1c", color: "#ef9a9a", fontSize: 14 }}>
    Error: {saveError}
  </div>
)}
```

**Two-column layout shell** (lines 192–213) — keep unchanged:
```tsx
<div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
  {/* Left panel: 40% */}
  <div style={{
    width: "40%",
    minWidth: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "#111",
    borderRight: "1px solid #333",
  }}>
    <PreviewPlayer
      subtitleConfig={subtitleConfig}
      captionPages={captionPages}
      totalDurationMs={totalDurationMs}
      titles={titles}          {/* was previewTitles — changed per D-10 */}
    />
  </div>

  {/* Right panel: tabs replace CollapsibleSection groups */}
  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    <div style={{ flex: 1, overflowY: "auto" }}>
      {/* Tab panels — see tab panel pattern below */}
    </div>
  </div>
</div>
```

**Tab bar pattern** (array-driven, D-08 — from RESEARCH Pattern 1):
```typescript
const TABS: { id: string; label: string }[] = [
  { id: "titles",    label: "Titles"    },
  { id: "subtitles", label: "Subtitles" },
  { id: "text",      label: "Text"      },
];

// Tab bar component — defined in same file or extracted
function TabBar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (id: string) => void }) {
  return (
    <div style={{
      display: "flex",
      borderBottom: "1px solid #333",
      background: "#16213e",
      padding: "0 24px",
    }}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: "12px 16px",
            minHeight: 44,
            border: "none",
            borderBottom: activeTab === tab.id ? "2px solid #90caf9" : "2px solid transparent",
            color: activeTab === tab.id ? "#90caf9" : "#aaa",
            fontWeight: activeTab === tab.id ? 600 : 400,
            fontSize: 14,
            background: "transparent",
            cursor: "pointer",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

**Tab panel pattern** (display:none to preserve state — RESEARCH Pitfall 5):
```tsx
<div style={{ padding: 24 }}>
  <div style={{ display: activeTab === "titles" ? "block" : "none" }}>
    <TitleEditor titles={titles} onChange={setTitles} />
  </div>
  <div style={{ display: activeTab === "subtitles" ? "block" : "none" }}>
    <LayoutSelector value={subtitleConfig.layout} onChange={(layout) => updateSubtitle({ layout })} />
    <StyleControls config={subtitleConfig} onChange={updateSubtitle} />
    <FontGrid
      selectedFont={subtitleConfig.fontFamily}
      onSelect={(font) => updateSubtitle({ fontFamily: font })}
    />
  </div>
  <div style={{ display: activeTab === "text" ? "block" : "none" }}>
    <TextareaInput value={sampleText} onChange={setSampleText} />
  </div>
</div>
```

**CollapsibleSection** (lines 262–303) — **DELETE** this component from the file after the tab conversion. It is only used in PreviewApp and is replaced by the tab panel pattern above.

---

### `src/preview/PreviewPlayer.tsx` (UNCHANGED)

**Prop interface** (lines 15–20):
```typescript
interface PreviewPlayerProps {
  subtitleConfig: SubtitleConfig;
  captionPages: TikTokPage[];
  totalDurationMs: number;
  titles?: TitleConfig[];
}
```
No changes. Caller switches from `titles={previewTitles}` to `titles={titles}` (D-10).

---

### `src/preview/FontGridPage.tsx` (DELETED as route — JSX folded inline)

**FontCard component** (`src/preview/FontGridPage.tsx` lines 12–62) — copy this component pattern inline into `PreviewApp.tsx` for use in the Subtitles tab:
```typescript
function FontCard({
  fontName,
  isSelected,
  onSelect,
}: {
  fontName: string;
  isSelected: boolean;
  onSelect: (font: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const cssFamily = getFontFamilyCSS(fontName);

  useEffect(() => {
    loadFont(fontName)
      .then(() => setLoaded(true))
      .catch(() => setLoaded(true));
  }, [fontName]);

  return (
    <div
      onClick={() => onSelect(fontName)}
      style={{
        padding: 16,
        background: "#1e1e2e",
        borderRadius: 8,
        border: `1px solid ${isSelected ? "#90caf9" : "#333"}`,     // selection state added (D-06)
        cursor: "pointer",
        transition: "border-color 0.2s, background 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#4CAF50";
        e.currentTarget.style.background = "rgba(76, 175, 80, 0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isSelected ? "#90caf9" : "#333";
        e.currentTarget.style.background = "#1e1e2e";
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#90caf9" }}>
        {fontName}
      </div>
      {loaded ? (
        <div style={{ fontSize: 24, fontFamily: cssFamily, color: "#e0e0e0" }}>
          Hola mundo
        </div>
      ) : (
        <div style={{ fontSize: 24, fontFamily: "monospace", color: "#666" }}>Loading...</div>
      )}
    </div>
  );
}
```

**FontGrid wrapper** (inline in Subtitles tab, from RESEARCH Pattern 3):
```typescript
function FontGrid({
  selectedFont,
  onSelect,
}: {
  selectedFont: string | undefined;
  onSelect: (font: string) => void;
}) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#90caf9", marginBottom: 8, marginTop: 16 }}>
        Browse Fonts
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 12,
      }}>
        {AVAILABLE_FONTS.filter((f) => f !== "monospace").map((fontName) => (
          <FontCard
            key={fontName}
            fontName={fontName}
            isSelected={selectedFont === fontName}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  );
}
```

Route `/preview/fonts` → 301 redirect to `/` in `server.ts`.

---

### `src/preview/TextareaInput.tsx` (UNCHANGED)

**Prop interface and pattern** (lines 8–48) — no changes:
```typescript
interface TextareaInputProps {
  value: string;
  onChange: (text: string) => void;
}

export function TextareaInput({ value, onChange }: TextareaInputProps) {
  // controlled textarea, inline dark-theme styles
  // used as the "Text" tab panel content
}
```

---

### `src/preview/textToCaptions.ts` (UNCHANGED)

Utility — no changes. Exports `textToCaptionPages`, `deriveTotalDurationMs`, `DEFAULT_SAMPLE_TEXT`. Used by `PreviewApp`.

---

### `src/editor/components/LayoutSelector.tsx` (UNCHANGED)

**Prop interface** (lines 9–11):
```typescript
interface LayoutSelectorProps {
  value: SubtitleLayoutMode;
  onChange: (layout: SubtitleLayoutMode) => void;
}
```
No changes. Now only consumed in Subtitles tab of unified `PreviewApp` (single usage path — STUDIO-03).

---

### `src/editor/components/StyleControls.tsx` (UNCHANGED)

**Prop interface** (lines 11–14):
```typescript
interface StyleControlsProps {
  config: SubtitleConfig;
  onChange: (partial: Partial<SubtitleConfig>) => void;
}
```
No changes. Single consumer after EditorApp removal (STUDIO-03).

---

### `src/editor/components/TitleEditor.tsx` (simplified — D-10)

**Current props interface** (lines 9–14):
```typescript
interface TitleEditorProps {
  titles: TitleConfig[];
  onChange: (titles: TitleConfig[]) => void;
  onPreviewChange?: (titles: TitleConfig[]) => void;  // REMOVE
  onSave?: (titles: TitleConfig[]) => void;            // REMOVE
}
```

**After D-10 — target interface:**
```typescript
interface TitleEditorProps {
  titles: TitleConfig[];
  onChange: (titles: TitleConfig[]) => void;
}
```

**useEffect to DELETE entirely** (lines 93–127):
```typescript
// DELETE this entire useEffect block — it drives onPreviewChange which is removed
useEffect(() => {
  if (!onPreviewChange) return;
  // ...
}, [newTitle, editingIndex, addingNew, titles, onPreviewChange]);
```

**Call sites to clean** (three locations — handleAdd line 144, handleRemove line 156, handleSaveEdit line 188):
```typescript
// handleAdd — remove these two lines:
if (onPreviewChange) onPreviewChange(updated);
onSave?.(updated);

// handleRemove — remove these two lines:
if (onPreviewChange) onPreviewChange(updated);
onSave?.(updated);

// handleSaveEdit — remove these two lines:
if (onPreviewChange) onPreviewChange(updated);
onSave?.(updated);
```

**Function signature** (line 68) — remove props from destructure:
```typescript
// Before:
export function TitleEditor({ titles, onChange, onPreviewChange, onSave }: TitleEditorProps) {
// After:
export function TitleEditor({ titles, onChange }: TitleEditorProps) {
```

---

### `src/editor/components/ConfigPreview.tsx` (DELETED — D-06)

Full deletion. No pattern to port. The live `<Player>` preview in the left column replaces this raw-JSON view.

---

### `src/editor/index.tsx` (UNCHANGED)

Entry point (lines 1–10) — no changes needed. Bootstraps `<App />` which now routes to the unified screen.

---

### `src/server.ts` (route changes — D-02)

**Current root + editor + preview serving** (lines 228–251):
```typescript
app.use("/editor", express.static(EDITOR_DIST));
app.use("/assets", express.static(path.join(EDITOR_DIST, "assets")));
app.get("/editor", serveSpa);
app.get("/editor/", serveSpa);
app.get("/editor/{*splat}", serveSpa);
app.get("/preview", serveSpa);
app.get("/preview/", serveSpa);
app.get("/preview/{*splat}", serveSpa);
app.get("/", (_req, res) => { res.redirect("/editor"); });
```

**After D-02 — target pattern:**
```typescript
// Serve SPA at root — static assets first, then SPA fallback
app.use("/", express.static(EDITOR_DIST));          // serves /assets/... bundle files
app.get("/", serveSpa);                              // root → unified screen

// Redirect old routes to unified screen (301 graceful — Claude's discretion, A3)
app.get("/editor",          (_req, res) => res.redirect(301, "/"));
app.get("/editor/",         (_req, res) => res.redirect(301, "/"));
app.get("/editor/{*splat}", (_req, res) => res.redirect(301, "/"));
app.get("/preview",         (_req, res) => res.redirect(301, "/"));
app.get("/preview/",        (_req, res) => res.redirect(301, "/"));
app.get("/preview/{*splat}",(_req, res) => res.redirect(301, "/"));

// SPA catch-all for client-side routing under /
app.get("/{*splat}", serveSpa);
```
Critical order: API routes (`/api/*`) must be registered BEFORE `app.use("/", express.static(...))`. The existing `app.use(express.static(PUBLIC_DIR))` for sample-video stays in place. The `/assets` static route can be removed since `app.use("/", express.static(EDITOR_DIST))` already covers it, but keeping it as an explicit route is harmless.

**serveSpa function** (lines 216–226) — unchanged:
```typescript
function serveSpa(_req: express.Request, res: express.Response) {
  const indexHtml = path.join(EDITOR_DIST, "index.html");
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).json({
      error: "Editor SPA not built",
      message: "Run 'npm run build:editor' to build the config editor SPA",
    });
  }
}
```

---

## Shared Patterns

### Dark Theme Color Palette
**Source:** Every component — inline styles throughout
**Apply to:** All UI components (preserved per D-07, light polish only)

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `#1a1a2e` | `height: "100vh"` wrapper |
| Header/panel background | `#16213e` | header, tab bar, form card |
| Card/section background | `#1e1e2e` | CollapsibleSection, title cards |
| Input background | `#2a2a3e` | `<input>`, `<select>`, `<textarea>` |
| Accent (links, active tab, section headers) | `#90caf9` | tab active, link text, section labels |
| Selected state border | `#4CAF50` | radio items, active buttons |
| Selected state bg | `rgba(76, 175, 80, 0.12)` | selected option backgrounds |
| Selected state text | `#a5d6a7` | selected label text |
| Body text | `#e0e0e0` | primary content text |
| Muted text | `#999`, `#888` | descriptions, secondary labels |
| Dim text | `#666` | range min/max labels |
| Border | `#333` | dividers, card borders |
| Input border | `#444` | form field borders |
| Save button active | `#4CAF50` | Save Config button |
| Save button disabled | `#555` | Saving… state |
| Success banner bg | `#1b5e20`, text `#a5d6a7` | save success |
| Error banner bg | `#b71c1c`, text `#ef9a9a` | save error |

### Config Fetch/Save Pattern
**Source:** `src/preview/PreviewApp.tsx` (lines 64–116) and `src/editor/EditorApp.tsx` (lines 35–78)
**Apply to:** `PreviewApp.tsx` (unified screen — already present)

Load on mount:
```typescript
useEffect(() => {
  fetch("/api/config")
    .then((res) => res.json())
    .then((data) => {
      if (data && data.subtitle) setSubtitleConfig((prev) => ({ ...prev, ...data.subtitle }));
      if (data && data.titles) setTitles(data.titles);
    })
    .catch(() => { /* use defaults */ });
}, []);
```

Save on button click (simplified post D-10):
```typescript
const handleSave = useCallback(async () => {
  try {
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtitle: subtitleConfig, titles }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errData.error || `Save failed: ${res.status}`);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : "Failed to save config");
  } finally {
    setSaving(false);
  }
}, [subtitleConfig, titles]);
```

### Selected/Active Option Button Pattern
**Source:** `src/editor/components/StyleControls.tsx` (lines 105–128) and `src/editor/components/TitleEditor.tsx` (lines 325–346)
**Apply to:** Tab bar buttons, any new toggle button groups in phases 19–21

```typescript
// Active state: #4CAF50 border, rgba(76, 175, 80, 0.12) bg, #a5d6a7 text
// Inactive state: #444 border, #2a2a3e bg, #ccc text
const isSelected = value === option.id;
style={{
  border: `1px solid ${isSelected ? "#4CAF50" : "#444"}`,
  background: isSelected ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
  color: isSelected ? "#a5d6a7" : "#ccc",
  borderRadius: 6,
  cursor: "pointer",
}}
```

### Section Label Pattern
**Source:** `src/editor/EditorApp.tsx` (lines 219–221) and `src/editor/components/StyleControls.tsx`
**Apply to:** Any section heading inside tab panels

```typescript
// uppercase, letter-spacing 1, #90caf9 accent color
<div style={{ fontSize: 12, fontWeight: 600, color: "#90caf9", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
  Section Title
</div>
```

### Form Input Pattern
**Source:** `src/editor/components/TitleEditor.tsx` (lines 263–270)
**Apply to:** Any new input fields added in phases 19–21

```typescript
<input
  type="text"
  style={{
    width: "100%",
    padding: 8,
    background: "#2a2a3e",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 14,
  }}
/>
```

---

## No Analog Found

All files have direct analogs within the codebase (they are the existing files being modified). No new algorithmic patterns are introduced — this is a pure restructuring phase.

---

## Key Anti-Patterns (Do NOT Replicate)

These exist in the current codebase and are being removed in Phase 18:

1. **`useSearchParams` for cross-route state handoff** (`PreviewApp.tsx` lines 28–36) — replaced by direct in-tab state mutation.
2. **Dual `titles`/`previewTitles` state** (`PreviewApp.tsx` lines 39–40) — replaced by single `titles` state (D-10).
3. **`handleSave(updatedTitles?: TitleConfig[])` parameter** (`PreviewApp.tsx` line 83) — removed; `handleSave` takes no parameters after D-10.
4. **`onPreviewChange` / `onSave` props on TitleEditor** (lines 12–13 of `TitleEditor.tsx`) — removed entirely.
5. **`useEffect` calling `onPreviewChange`** (`TitleEditor.tsx` lines 93–127) — full block deleted.
6. **Hard-coded collapsible sections** (`PreviewApp.tsx` lines 226–256) — replaced by array-driven tab bar.
7. **`CollapsibleSection` component** (`PreviewApp.tsx` lines 262–303) — deleted after tab conversion.

---

## Metadata

**Analog search scope:** `services/remotion-studio/src/` (all files)
**Files scanned:** 13 source files read directly
**Pattern extraction date:** 2026-05-27
