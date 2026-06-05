# Phase 22: Studio UI polish - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 9 (3 new, 6 modified)
**Analogs found:** 9 / 9

> All analog files are **read** and excerpted below. Every new file in this phase has a strong
> in-codebase analog — there is no "no analog" case. The dark-theme inline-styled form is the
> universal idiom; the UI-SPEC's `default.css` token set is the *target* the build migrates toward
> (excerpts below show the **current literal** hex values the analogs use, so the planner knows
> exactly what is being replaced).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `editor/components/PositionPresets.tsx` **(NEW, shared)** | component | event-driven (click→X/Y write) | `StyleControls.tsx` POSITION_OPTIONS block (L185-213) + `TitleEditor.tsx` X/Y inputs (L295-341) | exact (generalizes both) |
| `preview/PreviewApp.tsx` **(MODIFIED)** | component (shell) | request-response (config load/save) | self — restructure 2→3 col, drop `text` tab | self |
| `editor/components/StyleControls.tsx` **(MODIFIED)** | component | event-driven (onChange partial) | self — remove 3-button presets (L185-213), mount `<PositionPresets>` | self |
| `editor/components/TitleEditor.tsx` **(MODIFIED)** | component | event-driven (handleDraftChange) | self — add `<PositionPresets>` to Posición | self |
| `editor/components/OverlayEditor.tsx` **(MODIFIED)** | component | event-driven (handleDraftChange) | self — add `<PositionPresets>` + `Capa` (layer) segmented control | self |
| `SubtitledVideo.tsx` (studio) **(MODIFIED)** | composition | transform (props→frames) | self — split overlays into back/front bands (L109-113) | self |
| `remotion-renderer/src/Root.tsx` (inline `SubtitledVideo`) **(MODIFIED)** | composition | transform | studio `SubtitledVideo.tsx` (mirror, sync) | exact (must mirror) |
| `pipeline-config.ts` (`PngOverlayConfig` + validator) **(MODIFIED)** | model/schema | validation | self — `opacity?` optional field + validator block (L494-499) | self |
| `preview/PreviewApp.tsx` Column-3 placeholder **(NEW, structural)** | component | none (presentational) | `TitleEditor.tsx` empty-state card (L191-193) for surface/inline-style idiom | role-match |

---

## Shared Patterns (cross-cutting — apply to ALL new/modified files)

### Dark-theme inline-styled form idiom (THE density target)
**Source:** every editor component. Literal palette currently hard-coded (UI-SPEC migrates these to `default.css` custom-property names — see Implementation Note below).

Current literal values used across `StyleControls.tsx`, `TitleEditor.tsx`, `OverlayEditor.tsx`:
```
Panel/card bg     #1e1e2e   →  var(--surface)
Input fill        #2a2a3e   →  var(--surface-2)
Header chrome     #16213e   →  var(--chrome)
App canvas        #1a1a2e   →  var(--canvas)
Preview stage     #111      →  var(--stage)
Border hairline   #333      →  var(--border)
Border strong     #444 #555 →  var(--border-strong)
Primary text      #e0e0e0   →  var(--text)  (note: default.css token is #e6e6ea)
Secondary label   #bbb #aaa →  var(--text-2)
Muted/micro       #666 #777 →  var(--text-muted)
Accent (blue)     #90caf9   →  var(--accent)   (selection/focus/current ONLY)
Action (green)    #4CAF50   →  var(--action)   (ONE CTA per surface; Render only)
Selected wash     rgba(76,175,80,0.12) → var(--accent-tint)  (UI-SPEC reassigns selection to BLUE)
Danger            #b71c1c #ef9a9a → var(--danger)
```

**Standard control-row skeleton** (label + input), repeated ~30× — source `StyleControls.tsx` L88-105:
```typescript
<div>
  <label style={{ fontSize: 13, color: "#bbb", display: "block", marginBottom: 4 }}>
    Font Size: <strong style={{ color: "#fff" }}>{config.fontSize ?? 58}</strong>
  </label>
  <input type="range" min={24} max={200} value={config.fontSize ?? 58}
    onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
    style={{ width: "100%", accentColor: "#4CAF50" }} />
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
    <span>24</span><span>200</span>
  </div>
</div>
```

**Segmented-button group** (the toggle/preset affordance to standardize on) — source `StyleControls.tsx` L185-213 (subtitle position) and `TitleEditor.tsx` L344-374 (entrance animations). The active state is currently GREEN; UI-SPEC's color law moves *selection* to BLUE (`var(--accent-tint)` bg + `var(--accent-strong)` border + `var(--accent)` text). Build must flip selection green→blue everywhere:
```typescript
border: `1px solid ${isSelected ? "#4CAF50" : "#444"}`,
background: isSelected ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
color: isSelected ? "#a5d6a7" : "#ccc",
```

### Draft → live-preview update path (presets MUST push through this — D-09)
**Source:** `TitleEditor.tsx` L106-110 and `OverlayEditor.tsx` L72-76 — identical shape.
```typescript
// TitleEditor
const handleDraftChange = (updater: (prev: Partial<TitleConfig>) => Partial<TitleConfig>) => {
  const updated = updater(newTitle);
  setNewTitle(updated);
  onPreviewChange?.(computeLiveTitles(updated));
};
// OverlayEditor
const handleDraftChange = (updater: (prev: PngOverlayConfig) => PngOverlayConfig) => {
  const updated = updater(draft);
  setDraft(updated);
  onPreviewChange?.(computeLiveOverlays(updated));
};
```
`PositionPresets` must NOT own state — it receives current size + `onApply(x, y)` and the host wires
`onApply` into its existing `handleDraftChange`. For subtitles (`StyleControls`) the path is the plain
`onChange({ ... })` partial updater (no draft layer).

### Icon-only button accessible names (UI-SPEC Accessible Name Contract — required, not later polish)
Current delete buttons (`TitleEditor.tsx` L228-233, `OverlayEditor.tsx` L220-225) carry **no `aria-label`**.
Build must add: `✕` delete → `aria-label="Eliminar título"` / `"Eliminar overlay"`; `⠿` drag handle →
`aria-label="Reordenar título"` / `"Reordenar overlay"` + `role="button"`; all icon-only controls get a
44×44px hit area.

### Renderer-sync clobber hazard (AGENTS.md — load-bearing for SubtitledVideo + PngOverlay + pipeline-config)
The layering change (D-03/D-04) and the `layer` schema field land in BOTH services. After editing
`SubtitledVideo.tsx`, `PngOverlay.tsx`, or `pipeline-config.ts` in studio, sync per AGENTS.md and
**re-run renderer vitest** — `overlay.test.ts` exercises `computeOverlaySrc`/`computeOverlayOpacity`.
Note the renderer's `SubtitledVideo` is **inline in `Root.tsx`** (NOT synced as a file) and uses a
**hard-coded `fps = 30`** (`Root.tsx` L106) where studio reads `useVideoConfig()` — keep that divergence.

---

## Pattern Assignments

### `editor/components/PositionPresets.tsx` (NEW shared component, event-driven)

**Analogs (two, fused):**
1. Selection-grid affordance → `StyleControls.tsx` POSITION_OPTIONS (L17-21 array + L185-213 render).
2. Size-aware px math + X/Y write → `TitleEditor.tsx` X/Y inputs (L295-341) and `OverlayEditor.tsx` (L300-338).

**Option-array + render pattern to generalize** (`StyleControls.tsx` L17-21, L191-211):
```typescript
const POSITION_OPTIONS: { id: SubtitlePosition; label: string }[] = [
  { id: "bottom-center", label: "Bottom Center" },
  { id: "top-center", label: "Top Center" },
  { id: "center-screen", label: "Center Screen" },
];
// ...
{POSITION_OPTIONS.map((opt) => {
  const isSelected = (config.position ?? "bottom-center") === opt.id;
  return (
    <button key={opt.id} onClick={() => onChange({ position: opt.id })}
      style={{ flex: 1, padding: "8px 12px",
        border: `1px solid ${isSelected ? "#4CAF50" : "#444"}`, borderRadius: 6,
        background: isSelected ? "rgba(76, 175, 80, 0.12)" : "#2a2a3e",
        color: isSelected ? "#a5d6a7" : "#ccc", cursor: "pointer", fontSize: 13 }}>
      {opt.label}
    </button>
  );
})}
```
Generalize to a **3×3 grid** (`display: grid; gridTemplateColumns: repeat(3, 30px); gap: 3px`), glyphs
`↖ ↑ ↗ / ← • → / ↙ ↓ ↘`, active state in BLUE (UI-SPEC color law). Each cell maps to an `{anchorX, anchorY}`
∈ {left|center|right} × {top|center|bottom}.

**Size-aware centering math** (UI-SPEC §"Position Presets", 1080×1920 top-left anchor):
```
left = 0 ; centerX = round((1080 - elementWidth)/2) ; right = round(1080 - elementWidth)
top  = 0 ; centerY = round((1920 - elementHeight)/2); bottom = round(1920 - elementHeight)
```
- Overlay size input: `draft.displayWidth` (height = `auto` → estimate or use width as nominal; overlay anchor IS top-left, confirmed `PngOverlay.tsx` L63-67: `left: (x/1080)*100%`, `top: (y/1920)*100%`).
- Title size input: `style.titleFontSize` + padding → estimate rendered box; titles use same x/y px frame (`TitleEditor.tsx` defaults `x:200, y:960`).
- Subtitle: bottom-anchored by existing position system — nominal height estimate acceptable (UI-SPEC note).

**Interaction:** `onApply(x, y)` → host's `handleDraftChange`/`onChange`. Flash the X/Y inputs (`animation: flash 0.5s var(--ease)`) and give the active cell blue treatment. Suggested prop shape:
```typescript
interface PositionPresetsProps {
  elementWidth: number; elementHeight: number;
  frameWidth?: number;  // default 1080
  frameHeight?: number; // default 1920
  onApply: (x: number, y: number) => void;
  activeAnchor?: string; // optional, for blue highlight
}
```

---

### `preview/PreviewApp.tsx` (MODIFIED — 2→3 column shell, tab removal)

**Analog:** self. Current 2-col layout L397-467; `TABS` array L28-33.

**Tab removal (D-10):** delete `{ id: "text", label: "Text" }` from `TABS` (L32) → final
`Titles | Overlays | Subtitles` (UI-SPEC: relabel Spanish `Títulos | Overlays | Subtítulos`). Remove the
`text` tab panel (L461-464) and **move `<TextareaInput>` to the TOP of the Subtitles panel** above
`<LayoutSelector>` (currently L449-459):
```typescript
{/* Subtitles tab — TextareaInput moves to TOP */}
<div style={{ display: activeTab === "subtitles" ? "block" : "none" }}>
  <TextareaInput value={sampleText} onChange={setSampleText} />   {/* relocated from text tab */}
  <LayoutSelector value={subtitleConfig.layout} onChange={(layout) => updateSubtitle({ layout })} />
  <StyleControls config={subtitleConfig} onChange={updateSubtitle} />
  <FontGrid selectedFont={subtitleConfig.fontFamily} onSelect={(font) => updateSubtitle({ fontFamily: font })} />
</div>
```
`sampleText`/`captionPages`/`totalDurationMs` plumbing (L210, L224-228) is unchanged — verify preview still drives.

**3-column shell** — current 2-col container L397-467 (`width:"40%"` preview L401-410 → `flex: 0 1 470px`;
right panel `flex:1` L422). Add a **third column** after the right panel:
- Col1 preview stage: `flex: 0 1 470px`, `background: #111 (var(--stage))`.
- Col2 controls: `flex: 1` (TabBar + panels — existing).
- Col3 metadata placeholder: `width: 320px; flex: none` (hide below 1024px viewport).

**Config load/save (request-response) — keep verbatim** (L243-280 load, L300-331 save): `GET /api/config`
populates subtitle/titles/overlays with shape-validation filters; `PUT /api/config` posts
`{ subtitle, titles, overlays }`. The header Save button (L366-381) is the migrate-to-outline `Guardar`;
the disabled `Render Video` (L350-365) becomes the single green CTA per UI-SPEC Header Contract.

---

### Column-3 metadata placeholder (NEW structural, presentational)

**Analog (inline-style surface idiom):** `TitleEditor.tsx` empty-state + card (L191-193, L198-209).
Presentational only — no state, no fetch. Fixed `width: 320px`, `background: var(--surface)`, heading
`Metadata de redes`, body `Próximamente — descripción, hashtags y más generados a partir de tus subtítulos.`
(UI-SPEC Copywriting Contract). No interactive controls. Reuse the muted empty-state text style:
```typescript
<p style={{ fontSize: 13, color: "#666", fontStyle: "italic" }}>…</p>
```

---

### `editor/components/StyleControls.tsx` (MODIFIED — migrate subtitle presets to shared component)

**Analog:** self. **Remove** the entire Position selector block (L185-213) and the now-unused
`POSITION_OPTIONS` array (L17-21) IF the 9-point grid fully replaces it; **mount** `<PositionPresets>` in
its place inside the Posición section. The shared component writes via the existing `onChange({ position })`
or new x/y depending on the subtitle position model. **Regression guard (D-08):** the working subtitle
position path (`bottom-center`/`top-center`/`center-screen`) must not break — keep `config.position`
semantics or map presets onto it. Re-verify subtitle preview after.

---

### `editor/components/TitleEditor.tsx` (MODIFIED — add presets to Posición)

**Analog:** self. X/Y inputs block at L295-341 IS the Posición section. Mount `<PositionPresets>`
adjacent to the X/Y inputs, wired through the existing `handleDraftChange` (L106-110):
```typescript
<PositionPresets
  elementWidth={/* derive from titleFontSize+padding */}
  elementHeight={/* derive */}
  onApply={(x, y) => handleDraftChange((prev) => ({ ...prev, style: { ...prev.style!, x, y } }))}
/>
```
Existing X/Y writers (L307-311, L329-333) show the exact `style.x`/`style.y` mutation shape to reuse.
Section reorder (D-11) Posición → Estilo → Avanzado: X/Y+presets (L295-341) lead; size/color/entrance =
Estilo; borderRadius/lineHeight/padding/glow (L445-704) = Avanzado.

---

### `editor/components/OverlayEditor.tsx` (MODIFIED — add presets + `Capa` layer control)

**Analog:** self. X/Y inputs L300-338; `handleDraftChange` L72-76; `DEFAULT_OVERLAY` L27-33.

**Presets:** mount `<PositionPresets>` with `elementWidth={draft.displayWidth}` (height auto → nominal),
`onApply={(x,y) => handleDraftChange((prev) => ({ ...prev, x, y }))}`.

**New `Capa` (layer) segmented control (D-03):** add a 2-way `Detrás | Delante` toggle mirroring the
existing segmented pattern, writing `layer`:
```typescript
onClick={() => handleDraftChange((prev) => ({ ...prev, layer: "back" }))}   // / "front"
```
`DEFAULT_OVERLAY` (L27-33) gains `layer: "back"`. Layer badge on card (UI-SPEC): `Detrás` muted,
`Delante` blue (`var(--accent-tint)`). The 3-cap pattern (`MAX_OVERLAYS = 3`, `atCap` disabled add — L21-22,
L167, L416-439) and the 5MB/PNG file-gate (L79-112) are the cap/empty-state idioms to preserve.

---

### `SubtitledVideo.tsx` (studio) + inline `SubtitledVideo` in `remotion-renderer/src/Root.tsx` (MODIFIED — layering)

**Analog:** studio is canonical; renderer must mirror. Current (INCORRECT for D-03) order — studio L94-113,
renderer `Root.tsx` L103-125 — paints overlays AFTER titles (all overlays on top).

**Current studio block (L109-113):**
```typescript
{/* Phase 21: PNG overlays — rendered above titles (later in DOM = higher z-order) */}
{overlays.map((ov, i) => (
  <PngOverlay key={`overlay-${i}`} overlay={ov} rawImageSrc={ov.imageData} />
))}
```

**Required new order (UI-SPEC §Overlay Layering — bottom→top):**
```
1. ZoomContainer/OffthreadVideo   (studio L87-93)
2. PngOverlay  layer === "back"   ← NEW: render BEFORE subtitles/titles
3. SubtitleLayoutRenderer         (studio L94)
4. TitleOverlay sequences         (studio L95-108)
5. PngOverlay  layer === "front"  ← promoted overlays, AFTER titles
```
Filter into two `.map()` passes preserving **array order = paint order within band** (D-04):
`overlays.filter(o => (o.layer ?? "back") === "back")` before subtitles; `=== "front"` after titles.
Renderer mirror is identical EXCEPT: omit `rawImageSrc` (renderer uses `staticFile(_resolvedFile)` —
`Root.tsx` L124, `PngOverlay.tsx` L33-41), keep hard-coded `fps = 30` (`Root.tsx` L106).

**Preview-only dim (UI-SPEC, must NOT reach renderer):** back-layer overlays in the Player get
`opacity: 0.85; filter: saturate(0.8)` as a legibility hint — apply in the studio/Player path only.

---

### `pipeline-config.ts` (`PngOverlayConfig` schema + validator) (MODIFIED — `layer` field)

**Analog:** self — the optional `opacity?` field is the exact precedent for an optional overlay field.

**Schema (L98-105) — add `layer`:**
```typescript
export interface PngOverlayConfig {
  imageData: string;
  x: number;
  y: number;
  displayWidth: number;
  opacity?: number;        // 0–1, default 1
  layer?: "back" | "front"; // NEW (D-03): default "back" — decorators behind text
  _resolvedFile?: string;
}
```

**Validator (mirror the optional-`opacity` block at L494-499):**
```typescript
// opacity precedent:
if (ov.opacity !== undefined) {
  if (typeof ov.opacity !== "number" || ov.opacity < 0 || ov.opacity > 1) {
    errors.push(`overlays[${index}].opacity must be a number between 0 and 1`);
  }
}
// → add analogous:
if (ov.layer !== undefined) {
  if (ov.layer !== "back" && ov.layer !== "front") {
    errors.push(`overlays[${index}].layer must be "back" or "front"`);
  }
}
```
Also surfaces in `PreviewApp.tsx` load-validation filter (L266-273) — optional, so the existing filter
need not require it. **Sync this file to the renderer** and re-run renderer vitest (clobber hazard).

---

## No Analog Found

None. Every file has a strong in-codebase analog (the inline-styled dark-theme editor components are the
universal idiom). The only genuinely new *visual* artifact — the 9-point preset grid and the 3-column
shell — are restructures/generalizations of existing affordances, plus the `default.css` token set already
authored in the sketch-findings skill.

## Metadata

**Analog search scope:** `services/remotion-studio/src/{preview,editor/components,compositions}`, `services/remotion-studio/src/{pipeline-config.ts,SubtitledVideo.tsx,fonts.ts}`, `services/remotion-renderer/src/Root.tsx`, `.claude/skills/sketch-findings-reel-factory/`
**Files scanned:** 11 read in full/targeted
**Pattern extraction date:** 2026-06-03

**Implementation note for planner:** UI-SPEC mandates migrating the hard-coded hex palette to the
`default.css` OKLCH custom-property names (verbatim from
`.claude/skills/sketch-findings-reel-factory/sources/themes/default.css`) and flipping the *selection*
state from green→blue per the locked color law (green = Render CTA ONLY, one per surface). The excerpts
above show the **current literal** values precisely so each replacement is mechanical. The `impeccable`
skill + `frontend-design` plugin invocation at execute-start is non-negotiable (AGENTS.md).
