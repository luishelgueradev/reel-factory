---
phase: 23-render-execution-progress
plan: "04"
subsystem: remotion-studio/preview-ui
tags: [render-progress, upload-affordance, object-url, poll-loop, inline-surfaces, TDD, vitest, react-testing-library, green-discipline, OKLCH-tokens]
dependency_graph:
  requires: ["23-01 (render-status.ts exports)", "23-02 (proxy routes: /api/render, /api/status, /api/result)"]
  provides: ["Upload dropzone hero (§1)", "Live progress surface (§2)", "Inline success Reel listo (§3)", "Inline failure panel (§4)", "render-overlay.test.tsx"]
  affects:
    - services/remotion-studio/src/preview/PreviewApp.tsx
    - services/remotion-studio/src/preview/PreviewPlayer.tsx
    - services/remotion-studio/src/preview/render-overlay.test.tsx
tech_stack:
  added: []
  patterns:
    - "Upload dropzone: drag-drop + hidden file input + URL.createObjectURL + revoke-on-change (RESEARCH Pitfall 4)"
    - "Render state machine: idle|submitting|running|success|failure via useState"
    - "Poll loop: setInterval ~1500ms via pollRef, cleared on terminal state + unmount (mirrors saveTimeoutRef discipline)"
    - "4 inline surfaces as sibling components: UploadDropzone, RenderProgressOverlay, RenderSuccessOverlay, RenderFailureOverlay"
    - "Green discipline: no-file cold start = dropzone Elegir archivo green; with-file = header CTA green; at most 1 at a time"
    - "OKLCH token verbatim: --action, --accent, --danger, --success, --t-*, --s-*, --r-*, --ease, --dur"
    - "TDD RED (f0d1b87) → GREEN (19ae292, ae09bcf) cycle"
key_files:
  created:
    - services/remotion-studio/src/preview/render-overlay.test.tsx
  modified:
    - services/remotion-studio/src/preview/PreviewApp.tsx
    - services/remotion-studio/src/preview/PreviewPlayer.tsx
decisions:
  - "Green discipline at cold start: header Render CTA is neutral outline when no file loaded; dropzone 'Elegir archivo' is the single green (UI-SPEC §1 ratified)"
  - "RenderProgressOverlay, RenderSuccessOverlay, RenderFailureOverlay extracted as top-level sibling components (not nested in PreviewApp JSX) for readability and test isolation"
  - "Poll interval cleared on terminal state (completed/failed/404) AND on component unmount via useEffect cleanup — no leak path"
  - "objectUrl useMemo + revoke useEffect: clean revoke pattern closes the object-URL memory leak (RESEARCH Pitfall 4)"
  - "Descargar uses <a> anchor with --accent (not a button) for native download behavior"
  - "Pre-existing TS2322 in PreviewPlayer (FC<RemotionProps> not assignable to LooseComponentType) is a pre-existing Remotion type issue — confirmed present in main tree before this plan"
metrics:
  duration: "~11 minutes"
  completed: "2026-06-03"
  tasks_completed: 2
  files_changed: 3
---

# Phase 23 Plan 04: Render Execution UI — 4 Inline Surfaces Summary

Four inline render surfaces wired into the existing Phase-22 preview stage: upload dropzone hero (D-02 object-URL live preview), live step progress with indeterminate shimmer, "✓ Reel listo" success with proxied video play + Descargar (accent), and inline failure with muted-mono cause line + Reintentar (green); poll loop lifecycle-safe, green discipline held, 183/183 tests passing.

## What Was Built

### Task 1: Upload affordance + D-02 background swap (commits `f0d1b87` RED, `19ae292` feat)

**PreviewPlayer.tsx:**
- Added `rawVideoSrc?: string | null` prop to `PreviewPlayerProps`
- `effectiveRawVideoSrc` resolves to the prop value or `/sample-video.mp4` fallback
- `inputProps` useMemo includes `effectiveRawVideoSrc` in its dependency array (D-02 re-renders on file change)

**PreviewApp.tsx:**
- `uploadedFile: File | null` state; `objectUrl` derived via `useMemo(() => file ? URL.createObjectURL(file) : null, [file])`
- Revoke cleanup: `useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }, [objectUrl])`
- `UploadDropzone` component renders on the Col 1 stage when no file is uploaded and `renderState === "idle"`:
  - `aspect-ratio: 9/16`, 18px radius, `2px dashed var(--border-strong)`, fill `oklch(0.20 0.025 280 / 0.5)`
  - Hover: accent border + lighter fill
  - Supports drag-drop + hidden `<input type="file" accept="video/mp4">`
  - Copy (verbatim from UI-SPEC): "Subí tu video" heading, "MP4 · hasta 10 min" sublabel
  - "Elegir archivo" button with `var(--action)` — the single green at cold start
  - Preview-sync note: "Vas a ver tus subtítulos sincronizados recién en el video final."
- Header Render CTA shows neutral outline when no file; green only when `uploadedFile` is set

### Task 2: Render submit + poll loop + 4 inline states + header CTA (commit `ae09bcf`)

**PreviewApp.tsx render state machine:**
- `renderState: "idle"|"submitting"|"running"|"success"|"failure"`
- `jobId`, `currentStep`, `progress`, `stepInfo`, `resultUrl`, `renderCauseLine` state
- `pollRef: useRef<ReturnType<typeof setInterval>>` — cleared on terminal state + unmount cleanup effect

**`handleRender` (mirrors handleSave try/catch/finally):**
- Builds `FormData` with field `"videos"` = the uploaded file
- `fetch("/api/render", { method: "POST", body: formData })` — no manual `Content-Type`
- Reads `jobs[0].jobId` from response; transitions to `running`; starts `setInterval` poll

**Poll loop (~1500ms):**
- `GET /api/status/:jobId` on each tick
- `status === "completed"` → clear interval, `setResultUrl("/api/result/${jobId}")`, set success
- `status === "failed"` → clear interval, `parseStatusError(error)` → `causeLine(step, exitCode)`, set failure
- HTTP 404 → "Job no encontrado"

**Inline surfaces:**
| Surface | Key elements |
|---------|-------------|
| `RenderProgressOverlay` | `stepLabel(currentStep)` in `--t-xl`/`--accent`; honest `progress`%; indeterminate shimmer + "este paso toma más tiempo" on `isLongStep`; `prefers-reduced-motion` collapses shimmer |
| `RenderSuccessOverlay` | `<video>` element with `src={resultUrl}`, "✓ Reel listo" in `--success`, Descargar (`--accent` anchor), Renderizar de nuevo (`--action` button) |
| `RenderFailureOverlay` | Low-chroma `--danger` tint + border card, "No se pudo generar el reel", muted mono cause line via `causeLine(parseStatusError(error))`, single-nudge shake, Reintentar (`--action`) |

**Header CTA 4-state cycle:**
- `idle + no file` → outline disabled "▶ Render Video" (no green — green is in dropzone)
- `idle + file` → `--action` "▶ Render Video" (enabled)
- `submitting/running` → `--action` disabled "⟳ Renderizando…"
- `success` → `--action` "▶ Renderizar de nuevo"
- `failure` → `--action` "↻ Reintentar"

**`render-overlay.test.tsx` (7 tests, all GREEN):**
- "Subí tu video" / "MP4 · hasta 10 min" / preview-sync note present at cold start
- Success surface shows "✓ Reel listo" + `<video src=...api/result/...>` after render completes
- Failure with `exit 137` renders `remotion-renderer · exit 137 — sin memoria` cause line
- Progress surface shows "Renderizando" on `remotion-renderer` step
- Green discipline: ≤1 `var(--action)` element at cold-start idle

## Verification

```
cd services/remotion-studio && npx vitest run
Test Files  10 passed (10)
Tests       183 passed (183)
```

Pre-plan: 176 tests. Post-plan: 183 tests (+7 from render-overlay.test.tsx).

TypeScript: no new errors in PreviewApp.tsx or PreviewPlayer.tsx. Pre-existing `TS2322: FC<RemotionProps>` in PreviewPlayer (line was 126 in main tree) is carried forward, confirmed pre-existing.

### Acceptance criteria verification:

| Criterion | Status |
|-----------|--------|
| `createObjectURL` ≥ 1 in PreviewApp.tsx | 1 occurrence |
| `revokeObjectURL` ≥ 1 in PreviewApp.tsx | 1 occurrence |
| PreviewPlayer `rawVideoSrc` driven by prop, in useMemo deps | Done |
| "Subí tu video" + "MP4 · hasta 10 min" in PreviewApp.tsx | Done |
| `/api/render` in PreviewApp.tsx | 3 occurrences |
| `/api/status/` in PreviewApp.tsx | 3 occurrences |
| `/api/result/` in PreviewApp.tsx | 1 occurrence |
| `stepLabel` imported from render-status | Done |
| `causeLine` imported from render-status | Done |
| `clearInterval` in PreviewApp.tsx | 9 occurrences |
| FormData with field `"videos"`, no manual Content-Type | Done |
| render-overlay.test.tsx exit-137 cause line assertion | Done |
| npx vitest run exits 0 | 183/183 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] `@testing-library/jest-dom` not installed**
- **Found during:** RED test run
- **Issue:** Test file imported `@testing-library/jest-dom` which is not in `devDependencies`
- **Fix:** Removed the import; replaced `.toBeInTheDocument()` matchers with `.not.toBeNull()` (standard vitest assertion, no new dep needed)
- **Files modified:** `render-overlay.test.tsx`
- **Commit:** `f0d1b87` (updated before commit)

**2. [Rule 1 - Bug] `vi.stubGlobal("URL", ...)` destroyed the URL constructor**
- **Found during:** First RED test run
- **Issue:** Stubbing `URL` as a plain object broke `new URL()` calls inside jsdom
- **Fix:** Replaced with `vi.spyOn(URL, "createObjectURL")` + `vi.spyOn(URL, "revokeObjectURL")` — preserves the constructor
- **Files modified:** `render-overlay.test.tsx`
- **Commit:** `f0d1b87` (updated before commit)

**3. [Rule 2 - Missing functionality] Tests needed to drive the render flow to test terminal states**
- **Found during:** GREEN phase — tests for success/failure/progress stayed in "idle" state
- **Fix:** Added `renderAndTriggerFlow` helper that fires a `change` event on the hidden file input + clicks the Render button via `fireEvent`; uses `waitFor` with 4000ms timeout for the async poll cycle
- **Files modified:** `render-overlay.test.tsx`
- **Commit:** `ae09bcf`

**4. [Rule 1 - Bug] Green discipline violation at cold start — 2 action-green elements**
- **Found during:** GREEN test run (green discipline test failed)
- **Issue:** At cold start, both the UploadDropzone "Elegir archivo" button AND the header Render CTA (disabled, opacity 0.55 but still `var(--action)` background) were present
- **Fix:** Header Render CTA at idle + no file renders as neutral outline button (no green); green only appears when `uploadedFile !== null`
- **Files modified:** `PreviewApp.tsx`
- **Commit:** `ae09bcf`

## Known Stubs

None. All four surfaces are fully functional:
- Upload: real File object → real `URL.createObjectURL` → live Player background
- Render submit: real `POST /api/render` FormData
- Poll: real `GET /api/status/:jobId` at ~1.5s interval
- Success: real `<video src=/api/result/:jobId>` inline player
- Failure: real `parseStatusError` → `causeLine` formatting

The Col 3 metadata "Próximamente" card is an intentional placeholder deferred to Phase 25 (AI metadata) — it predates this plan and is not a functional stub introduced here.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns beyond what the plan's `<threat_model>` covers:
- T-23-04-01 (second concurrent submit): render-active state disables Render CTA + Guardar config while running — implemented
- T-23-04-03 (object URL / poll-interval leak): revoke cleanup + pollRef clearInterval on terminal + unmount — implemented
- No new secrets, env vars, or external fetch targets introduced

## Self-Check: PASSED

- [x] `services/remotion-studio/src/preview/PreviewApp.tsx` — exists, modified (render state machine + 4 surfaces)
- [x] `services/remotion-studio/src/preview/PreviewPlayer.tsx` — exists, modified (rawVideoSrc prop)
- [x] `services/remotion-studio/src/preview/render-overlay.test.tsx` — exists, created (7 tests)
- [x] Commit `f0d1b87` (test: RED) — exists in git log
- [x] Commit `19ae292` (feat: Task 1) — exists in git log
- [x] Commit `ae09bcf` (feat: Task 2) — exists in git log
- [x] 183/183 studio tests passing
- [x] No new TypeScript errors in PreviewApp/PreviewPlayer
