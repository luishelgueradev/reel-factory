# Phase 18: Studio UI Redesign - Research

**Researched:** 2026-05-27
**Domain:** React SPA consolidation — routing collapse, tab layout, state simplification
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `PreviewApp.tsx` is the base for the unified screen. `EditorApp.tsx` is removed.
- **D-02:** `App.tsx` routing collapses to a single canonical studio route. `/editor` route and `/` → `/editor` redirect go away. Eliminates duplicated `LayoutSelector`/`StyleControls`/`TitleEditor` usage so there is exactly one consumer (STUDIO-03).
- **D-03:** Three tabs: `Subtitles` / `Titles` / `Text`. Subtitles = LayoutSelector + StyleControls + Font Grid. Titles = TitleEditor. Text = TextareaInput.
- **D-04:** `Titles` is the default-open tab on load.
- **D-05:** Render Video button kept but disabled — greyed-out with tooltip "Coming soon — rendering via pipeline API". Must NOT fire POST /api/render.
- **D-06:** Raw-JSON `ConfigPreview` panel dropped. Font Grid (`FontGridPage`) folded inline into Subtitles tab. Standalone `/preview/fonts` route absorbed.
- **D-07:** Restructure + light polish. No formal design-token system in this phase.
- **D-08:** Build for extension — tab framework must let phases 19–21 add controls without restructuring. Tab bar must be array-driven, not hard-coded JSX.
- **D-09:** Manual `Save Config` button kept (PUT /api/config). Live preview in-memory; persistence on explicit save. No autosave.
- **D-10:** Drop `previewTitles`/`titles` state split. Single `titles` state. `TitleEditor` loses `onPreviewChange`/`onSave` props; simplified to `onChange` only.

### Claude's Discretion

- Exact tab-bar visual treatment and header/toolbar contents after consolidation.
- Responsive behavior.
- How Font Grid browsing is laid out inside the Subtitles tab (D-06).
- Whether removed routes (`/editor`, `/preview/fonts`) should 301-redirect to the unified screen or be deleted outright.

### Deferred Ideas (OUT OF SCOPE)

- Formal design-token system (color/spacing/typography scale + primitive component library).
- Functional studio-side render trigger (Render Video button stays disabled).
- Autosave.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STUDIO-01 | Studio presents a single interface split into two vertical columns — left: video preview, right: controls. | PreviewApp.tsx already implements this layout (40%/60%). Research confirms no layout rebuild needed, only header + tab conversion. |
| STUDIO-02 | All controls live in the right panel, organized in tabs. | CollapsibleSection components in PreviewApp become a TabBar + tab content panels. D-03/D-04 define the tab structure. |
| STUDIO-03 | The duplicated editor/preview screens and redundant components are consolidated/removed. | EditorApp.tsx is the only file to fully delete. LayoutSelector/StyleControls/TitleEditor already imported from editor/components/ by both screens — unification removes EditorApp's usage, leaving PreviewApp as sole consumer. |
</phase_requirements>

---

## Summary

Phase 18 is a React SPA consolidation. The existing codebase already has two separate screens — `/editor` (EditorApp.tsx: form + JSON panel) and `/preview` (PreviewApp.tsx: live player + collapsible controls) — sharing the same control components from `editor/components/`. The `/preview` screen's two-column layout is already the target shape: left panel is the `PreviewPlayer`, right panel is a set of `CollapsibleSection` groups. The redesign converts those sections into a tab bar, drops EditorApp, drops ConfigPreview, folds FontGridPage inline into the Subtitles tab, and collapses the router to a single route.

The largest state change is D-10: removing the `previewTitles`/`titles` dual-state in PreviewApp and the `onPreviewChange`/`onSave` prop wiring in TitleEditor. Once titles flow through a single `titles` state (like every other config key), TitleEditor becomes a plain `onChange`-only component. The TitleEditor's internal form state (editingIndex, addingNew, newTitle draft) remains unchanged; only the side-effect hooks that call `onPreviewChange` and `onSave` are removed.

The build system is Vite 5.4 configured to compile `src/editor/` as the SPA root (`vite build src/editor`). The Express server (`server.ts`) serves the built bundle at `/editor`, `/preview`, and `/preview/*` paths — all pointing to the same `dist/editor/index.html`. Client-side routing is handled by react-router-dom v7.15 with `BrowserRouter + Routes + Route`. The route change (collapsing to `/`) requires both an App.tsx update and a server.ts update to serve the SPA at `/` and redirect old paths.

**Primary recommendation:** Start from PreviewApp.tsx as the new unified component, convert CollapsibleSections to a TabBar, delete EditorApp.tsx and ConfigPreview.tsx, fold FontGrid JSX inline into the Subtitles tab panel, and update App.tsx + server.ts for the single-route serving pattern.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Live video preview | Browser / Client | — | Remotion `<Player>` runs in-browser; PreviewPlayer.tsx handles this already |
| Tab switching and active tab state | Browser / Client | — | Pure React state — `activeTab` string in unified component |
| Subtitle config state + live preview | Browser / Client | — | `subtitleConfig` already in PreviewApp state; Player re-renders on every change |
| Title config state (unified, D-10) | Browser / Client | — | Single `titles` useState replaces the `titles`/`previewTitles` split |
| Config persistence (Save) | API / Backend | Browser / Client | PUT /api/config in server.ts; UI triggers it on button click |
| Config load on mount | API / Backend | Browser / Client | GET /api/config already called on mount in PreviewApp |
| Font loading for preview | Browser / Client | CDN | @remotion/google-fonts loadFont() — already in fonts.ts |
| SPA routing | Frontend Server (SSR) | Browser / Client | Express serves index.html at route patterns; react-router-dom handles client-side |
| Static asset serving | Frontend Server (SSR) | — | Express `express.static(EDITOR_DIST)` for /assets; no CDN |

---

## Standard Stack

### Core (all already installed — no new packages)

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| React | 19.2.6 | Component rendering | Project baseline |
| react-router-dom | 7.15.1 | SPA routing (BrowserRouter + Routes) | Already used; v7 component API unchanged from v6 for BrowserRouter/Routes |
| Vite | 5.4.21 | Build tool for SPA | Already used; `vite build src/editor` pattern established |
| @remotion/player | 4.0.457 | In-browser video preview | PreviewPlayer.tsx already uses it; unchanged |
| @remotion/google-fonts | 4.0.457 | Font loading | fonts.ts pattern established |

### No New Packages Required

This phase is a pure React refactor. All dependencies are already installed. No npm install step needed.

---

## Package Legitimacy Audit

No new packages are introduced in this phase. All packages used are already present in `package.json` and installed in `node_modules`. The registry verification above confirms they exist on npm at the expected versions.

| Package | Registry | Disposition |
|---------|----------|-------------|
| react | npm | Already installed — OK |
| react-router-dom | npm | Already installed — OK |
| vite | npm | Already installed — OK |
| @remotion/player | npm | Already installed — OK |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser tab (port 3123)
        │
        ▼
Express server.ts
  GET /  →  serveSpa (index.html from EDITOR_DIST)
  GET /editor  →  301 redirect to /  (or delete)
  GET /preview →  301 redirect to /  (or delete)
  GET /preview/fonts → 301 redirect to /
  GET /assets/* → express.static(EDITOR_DIST/assets)
  GET /api/config → read pipeline-config.json
  PUT /api/config → write pipeline-config.json
        │
        ▼
React SPA (BrowserRouter)
  <Route path="/" element={<StudioApp />} />
  <Route path="*" element={<Navigate to="/" />} />
        │
        ▼
StudioApp (formerly PreviewApp)
  ├── Header (title, Save Config, Render Video [disabled])
  ├── StatusBanner (success / error)
  └── Two-column content
       ├── Left panel: <PreviewPlayer />   (unchanged)
       └── Right panel:
            ├── <TabBar activeTab onTabChange />   ← NEW
            └── Tab content (overflow-y: auto)
                 ├── [Titles tab — default]   <TitleEditor onChange />
                 ├── [Subtitles tab]          <LayoutSelector /> + <StyleControls /> + FontGrid (inline)
                 └── [Text tab]               <TextareaInput />
```

### Recommended Project Structure (after phase)

```
services/remotion-studio/src/
├── editor/
│   ├── App.tsx                   # Router: single route to StudioApp
│   ├── index.tsx                 # Entry point (unchanged)
│   ├── index.html                # SPA shell (unchanged)
│   └── components/
│       ├── LayoutSelector.tsx    # Unchanged — now only used in Subtitles tab
│       ├── StyleControls.tsx     # Unchanged — now only used in Subtitles tab
│       ├── TitleEditor.tsx       # Simplified: remove onPreviewChange/onSave props
│       └── ConfigPreview.tsx     # DELETED
├── preview/
│   ├── PreviewApp.tsx            # RENAMED/CONVERTED → becomes StudioApp (or keep filename)
│   ├── PreviewPlayer.tsx         # Unchanged
│   ├── TextareaInput.tsx         # Unchanged — now only used in Text tab
│   ├── FontGridPage.tsx          # DELETED (route removed; JSX folded into Subtitles tab)
│   └── textToCaptions.ts         # Unchanged
├── pipeline-config.ts            # Unchanged
├── fonts.ts                      # Unchanged
└── server.ts                     # Update serving routes: / serves SPA, old routes redirect
```

### Pattern 1: Tab Bar (array-driven, D-08)

The tab bar must be array-driven so Phase 21 can add an "Overlays" tab with one config change.

```typescript
// Source: codebase analysis [VERIFIED: codebase]
const TABS: { id: string; label: string }[] = [
  { id: "titles",    label: "Titles"    },
  { id: "subtitles", label: "Subtitles" },
  { id: "text",      label: "Text"      },
];

const [activeTab, setActiveTab] = useState<string>("titles"); // D-04: Titles is default

// Tab bar render — active state via comparison, not hard-coded conditionals
{TABS.map((tab) => (
  <button
    key={tab.id}
    onClick={() => setActiveTab(tab.id)}
    style={{
      padding: "12px 16px",
      minHeight: 44,                // D-UI-SPEC: touch target
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
```

### Pattern 2: Title State Unification (D-10)

Remove `previewTitles` and `onSave`/`onPreviewChange` wiring. Before and after:

```typescript
// BEFORE (PreviewApp.tsx — remove this pattern):
const [titles, setTitles] = useState<TitleConfig[]>([]);
const [previewTitles, setPreviewTitles] = useState<TitleConfig[]>([]);
// ...in handleSave: updatedTitles syncs both
// ...TitleEditor: onChange={setTitles} onPreviewChange={setPreviewTitles} onSave={handleSave}
// ...PreviewPlayer: titles={previewTitles}

// AFTER (unified, D-10):
const [titles, setTitles] = useState<TitleConfig[]>([]);
// ...TitleEditor: onChange={setTitles}   ← single prop, no save callback
// ...PreviewPlayer: titles={titles}      ← live, same state
// handleSave uses `titles` directly from closure — no updatedTitles parameter needed
```

```typescript
// BEFORE (TitleEditor.tsx props — remove optional props):
interface TitleEditorProps {
  titles: TitleConfig[];
  onChange: (titles: TitleConfig[]) => void;
  onPreviewChange?: (titles: TitleConfig[]) => void;  // REMOVE
  onSave?: (titles: TitleConfig[]) => void;            // REMOVE
}

// AFTER:
interface TitleEditorProps {
  titles: TitleConfig[];
  onChange: (titles: TitleConfig[]) => void;
}
// All onPreviewChange?.() calls → remove
// All onSave?.() calls → remove
// The useEffect that calls onPreviewChange on form changes → REMOVE entirely
```

### Pattern 3: Font Grid Inline in Subtitles Tab (D-06)

FontGridPage currently navigates to `/preview?font=X` to hand off the selection. Inline version uses direct state mutation instead.

```typescript
// Source: codebase analysis [VERIFIED: codebase]
// Inside the Subtitles tab panel, after StyleControls:
// Pass subtitleConfig.fontFamily as selected, and updateSubtitle as the selection callback

function FontGrid({
  selectedFont,
  onSelect,
}: {
  selectedFont: string | undefined;
  onSelect: (font: string) => void;
}) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#90caf9", marginBottom: 8 }}>
        Browse Fonts
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 12,
      }}>
        {AVAILABLE_FONTS.filter(f => f !== "monospace").map((fontName) => (
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
// onSelect calls: updateSubtitle({ fontFamily: font })
// isSelected border: selectedFont === fontName → "2px solid #90caf9"
```

### Pattern 4: Server Route Consolidation (D-02)

```typescript
// Source: server.ts [VERIFIED: codebase]
// BEFORE: root redirects to /editor; /preview served alongside

// AFTER — serve SPA at /:
app.use("/", express.static(EDITOR_DIST));  // assets at /assets/...
app.get("/",    serveSpa);
app.get("/editor",       (_req, res) => res.redirect(301, "/"));   // Claude's discretion: redirect
app.get("/editor/",      (_req, res) => res.redirect(301, "/"));
app.get("/editor/{*splat}", (_req, res) => res.redirect(301, "/"));
app.get("/preview",      (_req, res) => res.redirect(301, "/"));
app.get("/preview/",     (_req, res) => res.redirect(301, "/"));
app.get("/preview/{*splat}", (_req, res) => res.redirect(301, "/"));
app.get("/{*splat}",     serveSpa);  // SPA catch-all for /

// Note: /assets/* already served by express.static on the /assets prefix — keep as-is
// The /api/* routes are not affected
```

### Pattern 5: React Router v7 in the Unified App

React Router v7.15 still supports the `BrowserRouter + Routes + Route` component API (no migration needed). The app uses it and it works. The unified App.tsx becomes much simpler:

```typescript
// Source: App.tsx [VERIFIED: codebase]
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StudioApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
// NOTE: useSearchParams() in PreviewApp reads ?font= from FontGridPage.
// After D-10/D-06 (font selection inline), that URL param is no longer needed.
// Remove the useSearchParams import and the fontFromUrl initialization in StudioApp.
```

### Anti-Patterns to Avoid

- **Keeping the useSearchParams font URL handoff:** FontGridPage used `navigate("/preview?font=X")`. After the font grid is inline, this URL param mechanism is dead. Remove `useSearchParams`, `searchParams.get("font")`, and the `fontFromUrl` conditional in subtitleConfig initialization.
- **Keeping the updatedTitles parameter in handleSave:** After D-10, `handleSave` does not receive `updatedTitles` from TitleEditor (that prop was removed). Simplify handleSave to always use `titles` from state.
- **Leaving `onSave` calls in TitleEditor:** The three places where TitleEditor currently calls `onSave?.(updated)` (handleAdd, handleRemove, handleSaveEdit) must all be removed — otherwise the old auto-save-on-edit behavior persists.
- **Hard-coding tab content with if/else chains:** Use `activeTab === "titles"` conditionals or a lookup table, but keep the tab definitions in the TABS array so Phase 21 can add "Overlays" by adding one entry.
- **Removing the `← Editor` Link from PreviewApp without removing the import:** The `Link` import from react-router-dom and the `to="/editor"` link in the header are removed together with the `to="/preview/fonts"` Font Grid link. Keep the `Link` import only if it's still used elsewhere (it won't be after consolidation — `Navigate` is still needed in App.tsx though).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab UI | Custom state machine with manual show/hide logic per tab | Simple `activeTab` string state + conditional rendering per tab panel | There are exactly 3 tabs; no need for a tab library |
| Font grid card loading state | Custom Promise tracking | Reuse `FontCard` component pattern from FontGridPage.tsx (already handles loaded/loading state via `useState`) | Pattern already proven in existing code |
| 301 redirects | Custom redirect middleware | Express `res.redirect(301, "/")` | Built into Express |
| SPA fallback | Custom route handler | Reuse existing `serveSpa` function in server.ts | Already handles missing build gracefully |

**Key insight:** The entire phase is a restructuring of existing React components — no new algorithmic problems to solve.

---

## Runtime State Inventory

> This phase does not rename any string keys, stored IDs, API paths, or persistent data fields. The API contracts (`PUT /api/config`, `GET /api/config`) are unchanged. The `pipeline-config.json` schema is unchanged. This section is therefore not applicable.

**Nothing found in any category — verified by reading server.ts and pipeline-config.ts: all API routes and config field names are untouched.**

---

## Common Pitfalls

### Pitfall 1: Vite Build Root is `src/editor/` — Not `src/`

**What goes wrong:** Developer edits `src/preview/PreviewApp.tsx` and tries to import from `../../pipeline-config` — this works at build time because Vite resolves from `src/editor/` as root. But if the unified component is placed in `src/preview/`, the relative imports still work because the files haven't moved.

**Why it happens:** `vite build src/editor` sets `src/editor/` as the Vite project root and uses `src/editor/index.html` as the entry. All files are discovered via `import` chains starting from `src/editor/index.tsx`. Files in `src/preview/` are reachable because they're imported by App.tsx → PreviewApp.tsx.

**How to avoid:** Do NOT move files to new directories. Keep PreviewApp.tsx in `src/preview/`. Keep the control components in `src/editor/components/`. Only change imports and add/remove props — don't restructure the file tree.

**Warning signs:** TypeScript errors about missing modules with `../../` paths after moving files.

---

### Pitfall 2: `/assets` Static Serving Breaks If Root SPA Route Changes

**What goes wrong:** The server currently serves the SPA at `/editor` and `/preview`, and the Vite bundle's asset files (JS/CSS) are at `/assets/...`. If the SPA is now served at `/`, the browser requests `/assets/index-XYZ.js` — this works because `app.use("/assets", express.static(...))` is still in place.

**Why it happens:** The `<script type="module">` in index.html references `./index.tsx` during dev, but the Vite build outputs `<script src="/assets/index-HASH.js">` with an absolute path. The server must serve these at the `/assets` prefix.

**How to avoid:** When adding `app.use("/", express.static(EDITOR_DIST))` for the root route, verify it does NOT shadow the `/api` routes (static middleware checks for file existence first; if no file matches, it calls `next()`). The API routes registered before the static middleware will take priority. The safest order:

```
API routes first → then app.use("/", static) → then SPA catch-all
```

**Warning signs:** API calls returning HTML instead of JSON (static middleware intercepted `/api/config`).

---

### Pitfall 3: TitleEditor's `useEffect` for `onPreviewChange` Must Be Fully Removed

**What goes wrong:** Removing `onPreviewChange` from TitleEditor props but leaving the `useEffect` that calls it causes a no-op (the guard `if (!onPreviewChange) return` means nothing happens) but leaves dead code. Worse: if the effect dependencies include `titles`, it may fire unnecessarily.

**Why it happens:** The `useEffect` in TitleEditor has 5 dependencies: `[newTitle, editingIndex, addingNew, titles, onPreviewChange]`. Removing `onPreviewChange` from props but keeping the effect means the prop is always `undefined`, the guard returns early, and the effect runs on every title/form change doing nothing.

**How to avoid:** Delete the entire `useEffect` block. Delete all `onPreviewChange?.()` call sites. Delete the `onSave?.()` call sites (handleAdd, handleRemove, handleSaveEdit each call it). Delete the prop declarations from the interface.

**Warning signs:** Seeing the TitleEditor `useEffect` still in the file after the refactor.

---

### Pitfall 4: `handleSave` in PreviewApp Accepts `updatedTitles` Parameter — Remove It

**What goes wrong:** The current `handleSave` has signature `async (updatedTitles?: TitleConfig[])`. It was used by TitleEditor's `onSave` to save immediately after add/edit/delete. After D-10, TitleEditor no longer calls `handleSave` — saves happen only via the "Save Config" button.

**How to avoid:** Simplify handleSave to no parameters: `const handleSave = useCallback(async () => { ... })`. The payload always reads from `subtitleConfig` and `titles` state. Remove the `updatedTitles ?? titles` conditional and the `if (updatedTitles) { setTitles(updatedTitles); setPreviewTitles(updatedTitles); }` block.

---

### Pitfall 5: Tab Scroll Position Reset on Tab Switch

**What goes wrong:** The tab content div has `overflowY: auto`. If it's a single div whose children are conditionally rendered, switching tabs resets the scroll position to 0 — acceptable per the UI-SPEC ("switching tabs does NOT reset scroll position of the panel" — but this means within a tab, scroll is preserved).

**Why it happens:** Conditional rendering (`activeTab === "subtitles" && <SubtitlesContent />`) unmounts and remounts the component on each switch, resetting all internal state including scroll.

**How to avoid:** Use `display: none` / `display: block` instead of unmounting, OR accept the reset (the spec says do NOT reset within a session, but each tab gets its own scroll container). The simplest correct approach: render all tab panels simultaneously but set `display: none` on inactive ones. This also preserves any unsaved form state in TitleEditor (editingIndex, newTitle draft) across tab switches.

```tsx
// Source: analysis [ASSUMED — pattern choice]
<div style={{ display: activeTab === "titles" ? "block" : "none" }}>
  <TitleEditor ... />
</div>
<div style={{ display: activeTab === "subtitles" ? "block" : "none" }}>
  <LayoutSelector ... />
  <StyleControls ... />
  <FontGrid ... />
</div>
<div style={{ display: activeTab === "text" ? "block" : "none" }}>
  <TextareaInput ... />
</div>
```

---

### Pitfall 6: `previewTitles` Passed to PreviewPlayer — Must Switch to `titles`

**What goes wrong:** PreviewPlayer currently receives `titles={previewTitles}`. After D-10, `previewTitles` is deleted. If the prop is not updated, TypeScript will error (or the player silently shows no titles if it receives undefined).

**How to avoid:** Change `<PreviewPlayer ... titles={previewTitles} />` to `<PreviewPlayer ... titles={titles} />`. The Player will now show the live in-memory titles state directly — which is exactly the D-10 goal.

---

### Pitfall 7: Config Load on Mount Sets Both titles and previewTitles — Must Update

**What goes wrong:** The `useEffect` that calls `GET /api/config` on mount currently does:
```ts
if (data.titles) {
  setTitles(data.titles);
  setPreviewTitles(data.titles);  // REMOVE this line
}
```
After D-10, `setPreviewTitles` does not exist. If not updated, TypeScript errors at build time.

**How to avoid:** Remove the `setPreviewTitles(data.titles)` line. The `setTitles(data.titles)` line remains.

---

## Code Examples

### Complete State Shape for Unified StudioApp

```typescript
// Source: PreviewApp.tsx analysis [VERIFIED: codebase]
// After D-10 — state in the unified component:

const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(() => ({
  ...INITIAL_SUBTITLE_CONFIG,
  // NOTE: remove fontFromUrl initialization — useSearchParams removed per D-06
}));
const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
const [titles, setTitles] = useState<TitleConfig[]>([]);           // unified, D-10
// REMOVED: const [previewTitles, setPreviewTitles] = useState<TitleConfig[]>([]);
const [saving, setSaving] = useState(false);
const [saveSuccess, setSaveSuccess] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
const [activeTab, setActiveTab] = useState<string>("titles");      // D-04: Titles default
```

### TitleEditor Props — Before and After

```typescript
// Source: TitleEditor.tsx [VERIFIED: codebase]
// BEFORE:
interface TitleEditorProps {
  titles: TitleConfig[];
  onChange: (titles: TitleConfig[]) => void;
  onPreviewChange?: (titles: TitleConfig[]) => void;
  onSave?: (titles: TitleConfig[]) => void;
}

// AFTER (D-10):
interface TitleEditorProps {
  titles: TitleConfig[];
  onChange: (titles: TitleConfig[]) => void;
}
```

### Render Video Button (D-05)

```tsx
// Source: UI-SPEC.md [CITED: .planning/phases/18-studio-ui-redesign/18-UI-SPEC.md]
<button
  disabled
  title="Coming soon — rendering via pipeline API"
  style={{
    background: "#333",
    color: "#777",
    border: "1px solid #444",
    padding: "8px 16px",
    borderRadius: 6,
    fontSize: 14,
    cursor: "not-allowed",
    opacity: 0.6,
  }}
>
  Render Video
</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `/editor` as default route | `/` as the single route (Phase 18) | This phase | Server.ts root redirect goes from `/editor` to serving SPA directly |
| CollapsibleSection groups in right panel | TabBar + tab content panels | This phase | Cleaner UX; tabs are persistent not collapsible |
| Dual titles state (titles + previewTitles) | Single titles state | This phase | TitleEditor loses 2 props; Player always sees live state |
| FontGridPage as a separate route | FontGrid inline in Subtitles tab | This phase | Font selection is direct state update, not URL navigation |
| EditorApp + PreviewApp coexisting | StudioApp (PreviewApp as base) | This phase | EditorApp.tsx + ConfigPreview.tsx deleted |

**Deprecated/outdated after this phase:**
- `EditorApp.tsx`: deleted — absorbed by StudioApp
- `ConfigPreview.tsx`: deleted per D-06
- `FontGridPage.tsx`: deleted — grid JSX moved inline
- `previewTitles` state: removed per D-10
- `onPreviewChange`/`onSave` props on TitleEditor: removed per D-10
- URL param `?font=` handoff pattern: removed (was FontGridPage → PreviewApp link)
- `/editor`, `/preview`, `/preview/fonts` routes: redirected or deleted

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | React Router v7 BrowserRouter+Routes+Route component API is unchanged from v6 — no migration required | Standard Stack / Pattern 5 | Low risk: v7.15 confirmed installed; component API retained for backward compat. If wrong, App.tsx needs rewrite to createBrowserRouter — investigate CHANGELOG. |
| A2 | `display: none` (keep mounted) vs conditional render for tab panels — using display:none preserves TitleEditor draft state across tab switches | Pitfall 5 | Low risk: the spec says "no data loss on tab switch" which both approaches satisfy; display:none is safer for UX continuity. If React behavior changes this is a minor bug. |
| A3 | 301 redirect (keep old routes) is preferable to deleting them outright | Pattern 4 | Very low risk: Claude's discretion; 301 is graceful, deletion is also fine since this is a localhost dev tool |

---

## Open Questions

1. **`/` vs `/studio` as the canonical route (Claude's discretion)**
   - What we know: CONTEXT.md says "Single canonical route: `/` renders the unified screen (or `/studio` — Claude's discretion)"
   - What's unclear: `/` is simpler; `/studio` is more explicit if other routes are added
   - Recommendation: Use `/` — it's the simplest and the server already redirects to a single path

2. **FontGrid: should monospace be excluded from the inline grid?**
   - What we know: `AVAILABLE_FONTS` includes `"monospace"` as the last entry; FontGridPage shows all fonts
   - What's unclear: Monospace is a system fallback, not a Google Font — showing it in a "Browse Fonts" grid looks odd
   - Recommendation: Filter out `"monospace"` from the inline FontGrid (`.filter(f => f !== "monospace")`); it's still available in StyleControls' `<select>` dropdown

3. **Tab content padding: 24px from UI-SPEC vs 16px from CollapsibleSection**
   - What we know: UI-SPEC says `padding: 24px` for tab content; existing CollapsibleSection has `padding: "0 16px 16px"`
   - What's unclear: The 24px is the outer wrapper; inner components have their own spacing
   - Recommendation: Apply `padding: 24px` on the tab content div; remove the CollapsibleSection wrapper entirely (components render directly in the tab panel)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build, dev server | ✓ | v22.22.2 | — |
| npm | Package scripts | ✓ | 10.9.7 | — |
| Vite | `npm run build:editor` | ✓ | 5.4.21 (node_modules) | — |
| remotion-studio server | Preview on port 3123 | ✓ (source present) | — | — |

No missing dependencies. This phase is a pure source-code edit + rebuild.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (in remotion-renderer; remotion-studio has test files but no vitest in package.json) |
| Config file | none in remotion-studio — Wave 0 must add `vitest` devDependency if new tests are written |
| Quick run command | `cd services/remotion-renderer && npm test` (covers shared composition logic) |
| Full suite command | `cd services/remotion-renderer && npm test` |

**Note on test infrastructure:** The existing tests (`zoom-scale.test.ts`, `zoom-transition.test.ts`, `transition-effect.test.ts`) are composition logic tests that run from `remotion-renderer`. The studio has copies of these files but no test runner configured. Phase 18 changes are pure UI restructuring (no composition logic changes) — existing tests remain passing and serve as a regression guard for shared logic. New UI behavior tests (tab switching, state unification) would require adding vitest to remotion-studio's `package.json` AND `@testing-library/react`. Since no component-level tests exist today, adding them is a Wave 0 gap — but the planner may choose to rely on visual verification given the UI-phase nature of this work.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STUDIO-01 | Two-column layout renders with player on left | Visual/manual | n/a | — |
| STUDIO-02 | Tab switching shows correct control group | Visual/manual | n/a | — |
| STUDIO-03 | EditorApp and ConfigPreview are deleted; only one LayoutSelector/StyleControls/TitleEditor usage path exists | Build-time check | `cd services/remotion-studio && npm run build:editor 2>&1 \| grep -E "error\|warning"` | n/a — build confirms no dead imports |
| STUDIO-01–03 | Shared logic tests still pass after refactor | unit | `cd services/remotion-renderer && npm test` | ✅ existing |

### Sampling Rate

- **Per task commit:** `cd services/remotion-studio && npm run build:editor` (build confirms TypeScript + Vite success)
- **Per wave merge:** `cd services/remotion-renderer && npm test` (logic regression) + visual check in browser at port 3123
- **Phase gate:** Build green + visual verification of all 3 tabs + Save Config working before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest` devDependency in `services/remotion-studio/package.json` — only needed if planner adds component-level tests for tab state. Planner may defer this to a future phase given UI-only nature.

*(The existing test infrastructure in remotion-renderer covers all non-UI phase requirements. For a UI restructuring phase, build success + visual verification is the primary gate.)*

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Basic Auth already implemented in server.ts — unchanged |
| V3 Session Management | no | No sessions; stateless SPA |
| V4 Access Control | no | No access control changes |
| V5 Input Validation | yes (minor) | TitleEditor text is sanitized server-side in server.ts `sanitizeTitles()` — unchanged |
| V6 Cryptography | no | No cryptographic operations |

**No security changes in this phase.** The XSS mitigation (server-side `sanitizeTitles()` in server.ts) and Basic Auth middleware are both untouched. The client-side title text field is an in-memory edit before save — the server sanitizes on PUT /api/config.

---

## Project Constraints (from CLAUDE.md)

All directives extracted from `AGENTS.md` (loaded via `CLAUDE.md @AGENTS.md` shim):

1. **UI/frontend tooling — non-negotiable:** Every plan/execute for this phase MUST invoke at the start: (a) the `impeccable` skill, and (b) the `frontend-design` plugin in Claude Code. This is the quality guarantee for visual decisions.
2. **Port 3123 always:** remotion-studio server always runs on port 3123. Start command uses `setsid` + `ACTIVE_PIPELINE_CONFIG_PATH`.
3. **Build command:** `npm run build:editor` from `services/remotion-studio/`.
4. **Renderer sync:** This phase is studio-frontend-only. No composition changes, no shared module changes → renderer sync step does NOT apply. Verify this holds: if any file in `src/compositions/`, `src/fonts.ts`, `src/captions.ts`, `src/zoom-detection.ts`, or `src/pipeline-config.ts` is touched, the sync step must be added.
5. **Pipeline concurrency:** Hard limit 1 (irrelevant to this phase — no pipeline changes).
6. **GSD workflow:** Changes must go through GSD execute workflow, not direct edits.

---

## Sources

### Primary (HIGH confidence)
- `services/remotion-studio/src/editor/App.tsx` — router structure (BrowserRouter + Routes), current routes, imports [VERIFIED: codebase]
- `services/remotion-studio/src/editor/EditorApp.tsx` — screen to delete; state shape, save/render handlers [VERIFIED: codebase]
- `services/remotion-studio/src/preview/PreviewApp.tsx` — base for unified screen; state shape (subtitleConfig, titles, previewTitles, saving, saveSuccess, saveError), CollapsibleSection pattern, font URL param, handleSave signature [VERIFIED: codebase]
- `services/remotion-studio/src/preview/PreviewPlayer.tsx` — prop interface (subtitleConfig, captionPages, totalDurationMs, titles); unchanged in this phase [VERIFIED: codebase]
- `services/remotion-studio/src/preview/FontGridPage.tsx` — navigate-based font handoff; `AVAILABLE_FONTS` from fonts.ts; `FontCard` component pattern [VERIFIED: codebase]
- `services/remotion-studio/src/preview/TextareaInput.tsx` — simple controlled textarea, no internal state [VERIFIED: codebase]
- `services/remotion-studio/src/editor/components/TitleEditor.tsx` — full prop interface including onPreviewChange/onSave; all call sites of both props; useEffect dependency list [VERIFIED: codebase]
- `services/remotion-studio/src/editor/components/ConfigPreview.tsx` — read-only JSON panel; deleted in this phase [VERIFIED: codebase]
- `services/remotion-studio/src/editor/components/LayoutSelector.tsx` — props: `{value, onChange}` [VERIFIED: codebase]
- `services/remotion-studio/src/editor/components/StyleControls.tsx` — props: `{config, onChange}` [VERIFIED: codebase]
- `services/remotion-studio/src/server.ts` — serving routes, EDITOR_DIST, serveSpa, /api routes [VERIFIED: codebase]
- `services/remotion-studio/src/fonts.ts` — AVAILABLE_FONTS array (26 + monospace), getFontFamilyCSS, loadFont [VERIFIED: codebase]
- `services/remotion-studio/src/pipeline-config.ts` — SubtitleConfig, TitleConfig, PipelineConfig types [VERIFIED: codebase]
- `services/remotion-studio/vite.config.ts` — build root = `src/editor`, outDir = `dist/editor`, proxy `/api` → localhost:3123 [VERIFIED: codebase]
- `services/remotion-studio/package.json` — react-router-dom@7.15.1, vite@5.4 (devDep), scripts [VERIFIED: codebase]
- `.planning/phases/18-studio-ui-redesign/18-CONTEXT.md` — all locked decisions (D-01 through D-10) [VERIFIED: planning docs]
- `.planning/phases/18-studio-ui-redesign/18-UI-SPEC.md` — layout dimensions, color values, tab visual contract, copywriting, header contract [VERIFIED: planning docs]

### Secondary (MEDIUM confidence)
- `npm view react-router-dom version` → 7.15.1 [VERIFIED: npm registry] — confirms v7 component API
- `npm view react version` → 19.2.6 [VERIFIED: npm registry]
- `services/remotion-renderer/src/compositions/*.test.ts` — vitest-based test files; confirm test framework and `npm test` command [VERIFIED: codebase]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages already installed, verified against npm registry
- Architecture: HIGH — all source files read and analyzed directly
- Pitfalls: HIGH — derived from concrete reading of current code (specific line references)
- TitleEditor state change: HIGH — every prop usage and call site verified in source

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (stable codebase; no external dependencies changing)
