# Phase 16: Render config + flicker fixes — Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 7 files (5 modified + 1 sync target pair + docker-compose)
**Analogs found:** 7 / 7 (all files are analogs of themselves or siblings — surgical edits, no new files)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/remotion-studio/src/server.ts` | service / REST handler | request-response | self (existing PUT /api/config handler, lines 101-143) | exact (add write after existing write) |
| `services/remotion-studio/src/compositions/BarLayout.tsx` | component | transform (ms→frames) | self (existing duration formula, lines 245-268) | exact (replace 4-line block) |
| `services/remotion-studio/src/compositions/TikTokLayout.tsx` | component | transform (ms→frames) | `BarLayout.tsx` lines 245-268 (identical formula) | exact |
| `services/remotion-renderer/src/compositions/BarLayout.tsx` | component | transform (ms→frames) | studio `BarLayout.tsx` (sync target — currently identical) | exact (cp sync) |
| `services/remotion-renderer/src/compositions/TikTokLayout.tsx` | component | transform (ms→frames) | studio `TikTokLayout.tsx` (sync target — currently identical) | exact (cp sync) |
| `services/remotion-renderer/src/captions.ts` | utility | transform (transcript→pages) | self (transcriptToCaptionPages, lines 257-310) | reference only — Issue B fix is in layouts, not here |
| `docker-compose.yml` | config | — | self (remotion-studio environment block, lines 174-178) | exact (add one env var) |

---

## Pattern Assignments

### `services/remotion-studio/src/server.ts` — Issue A fix

**Change type:** Add one `fs.writeFileSync` call (and `mkdirSync` guard) after the existing write in the PUT /api/config handler.

**Existing write pattern** (lines 115-133 — copy this structure for the second write):
```typescript
// Ensure directory exists
const dir = path.dirname(configPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Write config, stripping _meta if present, sanitizing title text (CR-02)
const { _meta, ...configToWrite } = body as PipelineConfig & { _meta?: unknown };
// CR-02: Sanitize title text to prevent stored XSS — strip/escape HTML
if (configToWrite.titles && Array.isArray(configToWrite.titles)) {
  configToWrite.titles = sanitizeTitles(configToWrite.titles);
}
fs.writeFileSync(configPath, JSON.stringify(configToWrite, null, 2));

console.log("[studio] Config written to:", configPath);
return res.json({
  ...configToWrite,
  _meta: { source: "file", valid: true, path: configPath },
});
```

**New block to insert after line 130 (`console.log("[studio] Config written to:", configPath);`):**
```typescript
// Mirror to active config path so /process jobs always pick up the latest studio config.
// ACTIVE_PIPELINE_CONFIG_PATH matches api-server/src/constants.ts default.
const activePath = process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json";
const activeDir = path.dirname(activePath);
if (!fs.existsSync(activeDir)) {
  fs.mkdirSync(activeDir, { recursive: true });
}
fs.writeFileSync(activePath, JSON.stringify(configToWrite, null, 2));
console.log("[studio] Active config mirrored to:", activePath);
```

**Key constraints:**
- `configToWrite` already has `_meta` stripped (line 123 destructuring) — reuse it, do NOT re-strip
- `configToWrite.titles` is already sanitized by `sanitizeTitles()` (lines 125-127) — the same object is safe for both writes
- Do NOT change `resolveConfigPath()` — the first write to `configPath` stays unchanged
- `path` and `fs` are already imported at lines 10-11 — no new imports

**Error handling pattern** (lines 135-142 — already covers both writes since second write is inside same try block):
```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : "Unknown error writing config";
  console.error("[studio] Error writing config:", message);
  return res.status(500).json({
    error: "Failed to write config",
    message,
  });
}
```

---

### `services/remotion-studio/src/compositions/BarLayout.tsx` — Issue B fix

**Change type:** Replace the `durationInFrames` calculation block in the `BarLayout` component (lines 245-268).

**Existing buggy formula** (lines 249-255 — the four lines that create the gap):
```typescript
const nextPageStartMs = i + 1 < captionPages.length ? captionPages[i + 1].startMs : Infinity;
const displayEndMs = lastTokenEndMs + FADE_OUT_MS;
const safeEndMs = Math.min(displayEndMs, nextPageStartMs - PAGE_OVERLAP_GUARD_MS);
const clampedEndMs = (i === captionPages.length - 1 && totalDurationMs)
  ? Math.min(safeEndMs, totalDurationMs)
  : safeEndMs;
const durationInFrames = Math.max(1, Math.ceil((clampedEndMs - page.startMs) * (fps / 1000)));
```

**Replacement (Option 1 — extend Sequence to next page start, no gap):**
```typescript
const isLastPage = i === captionPages.length - 1;
const nextPageStartMs = !isLastPage ? captionPages[i + 1].startMs : Infinity;

// Non-last pages: run Sequence until next page starts — eliminates inter-page blank gap.
// Last page: fade out naturally after last token.
// PAGE_OVERLAP_GUARD_MS is intentionally NOT subtracted — the guard existed to prevent
// Sequence overlap; extending to exactly nextPageStartMs creates zero-gap adjacency.
const displayEndMs = !isLastPage ? nextPageStartMs : lastTokenEndMs + FADE_OUT_MS;

const clampedEndMs = (isLastPage && totalDurationMs)
  ? Math.min(displayEndMs, totalDurationMs)
  : displayEndMs;
const durationInFrames = Math.max(1, Math.ceil((clampedEndMs - page.startMs) * (fps / 1000)));
```

**Context: lines that stay unchanged** (247-248):
```typescript
const fromFrame = Math.round(page.startMs * (fps / 1000));
const lastTokenEndMs = page.tokens.length > 0 ? page.tokens[page.tokens.length - 1].toMs : page.startMs;
```

**Context: Sequence JSX stays unchanged** (lines 257-266):
```typescript
return (
  <Sequence key={i} from={fromFrame} durationInFrames={durationInFrames}>
    <BarPage
      page={page}
      config={config}
      pageFromFrame={fromFrame}
    />
  </Sequence>
);
```

**Important:** The `BarPage` component's internal fade animation (lines 153-164) is NOT changed. The fade-out still runs from `lastTokenEndFrame` over `FADE_OUT_MS`, but now it overlaps with the next page's Sequence rather than occurring in empty air. No change needed inside `BarPage`.

---

### `services/remotion-studio/src/compositions/TikTokLayout.tsx` — Issue B fix (identical)

**Change type:** Apply the exact same formula replacement as BarLayout above.

**Existing buggy formula** (lines 225-231 — identical to BarLayout):
```typescript
const nextPageStartMs = i + 1 < captionPages.length ? captionPages[i + 1].startMs : Infinity;
const displayEndMs = lastTokenEndMs + FADE_OUT_MS;
const safeEndMs = Math.min(displayEndMs, nextPageStartMs - PAGE_OVERLAP_GUARD_MS);
const clampedEndMs = (i === captionPages.length - 1 && totalDurationMs)
  ? Math.min(safeEndMs, totalDurationMs)
  : safeEndMs;
const durationInFrames = Math.max(1, Math.ceil((clampedEndMs - page.startMs) * (fps / 1000)));
```

**Replacement:** identical to the BarLayout replacement above (substitute `CaptionPage` for `BarPage` in the JSX — but the JSX is not changing, only the calculation block).

**Unchanged context lines** (223-224):
```typescript
const fromFrame = Math.round(page.startMs * (fps / 1000));
const lastTokenEndMs = page.tokens.length > 0 ? page.tokens[page.tokens.length - 1].toMs : page.startMs;
```

---

### `services/remotion-renderer/src/compositions/BarLayout.tsx` — sync target

**Change type:** `cp` copy only. Do NOT edit this file manually.

**Sync command (from `services/remotion-studio/`):**
```bash
cp src/compositions/BarLayout.tsx ../remotion-renderer/src/compositions/BarLayout.tsx
```

**Verification:** Both files are currently byte-for-byte identical (confirmed by diff). The studio edit is the source of truth.

---

### `services/remotion-renderer/src/compositions/TikTokLayout.tsx` — sync target

**Change type:** `cp` copy only.

**Sync command (from `services/remotion-studio/`):**
```bash
cp src/compositions/TikTokLayout.tsx ../remotion-renderer/src/compositions/TikTokLayout.tsx
```

---

### `docker-compose.yml` — remotion-studio environment block

**Change type:** Add one environment variable to the `remotion-studio` service (line 178, after `PORT=3123`).

**Existing environment block** (lines 174-178):
```yaml
    environment:
      - INPUT_PATH=/data/pipeline/${PIPELINE_JOB_ID}/remotion-renderer/output.mp4
      - PIPELINE_JOB_ID=${PIPELINE_JOB_ID}
      - PIPELINE_CONFIG_PATH=/data/pipeline/${PIPELINE_JOB_ID}/remotion-renderer/pipeline-config.json
      - PORT=3123
```

**Add after `PORT=3123`:**
```yaml
      - ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json
```

**Pattern source:** `services/api-server/src/constants.ts` lines 20-21:
```typescript
export const ACTIVE_PIPELINE_CONFIG_PATH =
  process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json";
```
The hardcoded default in server.ts must match this value.

---

### `services/remotion-renderer/src/captions.ts` — reference only

**Change type:** No changes required for Phase 16.

`transcriptToCaptionPages` (lines 257-310) produces `TikTokPage[]` with correct `startMs` values from `@remotion/captions`. The Issue B gap is in how the layout components consume `startMs` to compute `durationInFrames` — not in how `captions.ts` generates the pages.

**Pattern to understand (for Issue B test writing):** `TikTokPage.startMs` is the page's absolute timestamp in milliseconds. `captionPages[i+1].startMs` is the exact value the Option 1 fix extends to.

---

## Shared Patterns

### fs.writeFileSync with mkdirSync guard
**Source:** `services/remotion-studio/src/server.ts` lines 116-120
**Apply to:** The new active-path write in the same PUT /api/config handler
```typescript
const dir = path.dirname(configPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
```
Both the existing write and the new active-path write must guard with `mkdirSync` since the `/data/pipeline/` directory may be empty on first run.

### Remotion frame math
**Source:** `BarLayout.tsx` lines 246, 255; `TikTokLayout.tsx` lines 222, 231
**Apply to:** Any new `durationInFrames` calculation
```typescript
const fromFrame = Math.round(page.startMs * (fps / 1000));
const durationInFrames = Math.max(1, Math.ceil((endMs - page.startMs) * (fps / 1000)));
```
Convention: `fromFrame` uses `Math.round`, `durationInFrames` uses `Math.ceil`, always `Math.max(1, ...)` to prevent zero-frame Sequences.

### Renderer-sync convention (CLAUDE.md)
**Source:** CLAUDE.md sync pattern
**Apply to:** Every plan task that edits BarLayout.tsx or TikTokLayout.tsx in remotion-studio
```bash
# Run from services/remotion-studio/
cp src/compositions/BarLayout.tsx ../remotion-renderer/src/compositions/
cp src/compositions/TikTokLayout.tsx ../remotion-renderer/src/compositions/
```
Do NOT sync `server.ts`, `Root.tsx`, or `SubtitledVideo.tsx` — those are service-specific.

### Sequencing checkpoint (CONTEXT.md mandate)
**Apply to:** Plan task ordering
Issue A must be fixed and validated (pipeline_config.loaded=true in remotion-info.json) BEFORE Issue B layout changes are applied. The plan must include a human-verify checkpoint between the two waves.

---

## No Analog Found

None. All files are surgical edits to existing files with well-understood patterns.

---

## Metadata

**Analog search scope:** `services/remotion-studio/src/`, `services/remotion-renderer/src/`, `docker-compose.yml`
**Files read:** 8 (server.ts, BarLayout.tsx×2, TikTokLayout.tsx×2, shared-styles.ts, captions.ts, docker-compose.yml excerpt)
**Pattern extraction date:** 2026-05-23
