# Phase 21: PNG Overlays - Research

**Researched:** 2026-05-29
**Domain:** Remotion image rendering, PNG asset management, pipeline-config schema extension, studio UI upload
**Confidence:** HIGH

## Summary

Phase 21 adds transparent PNG overlays to the video (OVERLAY-01), applies a code-side crisp downscale when the source PNG is larger than the 1080px frame (OVERLAY-02), and exposes position/size controls in the studio UI (OVERLAY-03).

The codebase already has all the primitives needed: Remotion's `<Img>` component handles `delayRender`/`continueRender` automatically; the renderer's `render.ts` already copies files into `public/` before calling `bundle()` (the same pattern handles PNG assets); and the `TitleOverlay` component shows the exact pattern to follow for a new `PngOverlay` component. No new npm packages are required.

The central design decision is PNG storage in the pipeline config. Base64 data URL embedded directly in `pipeline-config.json` is the recommended approach: it is self-contained, flows through the existing PUT /api/config pipeline without additional file-management, and the renderer can decode it to a file in `public/` before bundling (same pattern as the video file copy). The JSON body limit on the Express server must be increased from 1 MB to accommodate logos (typically 50–500 KB; base64 adds ~33% overhead).

OVERLAY-02's "code-side supersampled downscale" means: when the source PNG is larger than the rendered display dimensions, the browser's default bilinear downsampling (applied by Chromium headless) produces adequate quality. No custom canvas pipeline is needed. The code-side responsibility is to set `width`/`height` CSS constraints on the `<Img>` element so Chromium downscales rather than letting the browser stretch a small image up. For logos where sharpness is paramount, setting CSS `image-rendering: pixelated` is the correct Remotion/Chromium approach for hard edges.

**Primary recommendation:** Embed PNG as base64 data URL in pipeline-config.json; decode to `public/overlay.png` in render.ts before bundle(); render via `<Img src={staticFile("overlay.png")} />` in a new `PngOverlay` composition; mirror the TitleOverlay pattern for the React component and TitleEditor pattern for the UI.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OVERLAY-01 | User can add a transparent PNG overlay onto the video | `<Img>` + `staticFile()` pattern in Remotion; PngOverlay component mirrors TitleOverlay |
| OVERLAY-02 | PNG larger than frame is downscaled by code at render time for crisp output | CSS `width`/`height` constraints on `<Img>` cause Chromium to downscale; no custom canvas needed |
| OVERLAY-03 | User can position and size the PNG overlay | Same x/y/width pattern as TitleOverlay pixel-coordinate positioning from Phase 20 |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PNG file selection/upload | Browser / Client | — | `<input type="file">` + FileReader API converts to base64 in the browser |
| PNG storage in config | API / Backend (server.ts) | — | Stored in pipeline-config.json via PUT /api/config; no separate file system needed |
| PNG decoding at render | API / Backend (render.ts) | — | render.ts decodes base64 → file in `public/` before bundle() |
| PngOverlay React component | Frontend Server (Remotion) | — | `<Img>` + `staticFile()` inside composition; delayRender handled by Remotion |
| Downscale crispness | Browser / Client (Chromium headless) | — | CSS `width`/`height` constraints + Chromium's bilinear downsampling |
| Position/size controls | Browser / Client (Studio UI) | — | x/y/width number inputs, mirrors TitleEditor pattern |
| Preview in studio | Browser / Client (Player) | — | Same `<Img>` rendered inside `@remotion/player` with data URL as src |

---

## Standard Stack

### Core (no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `remotion` (Img) | 4.0.457 | `<Img>` component with automatic delayRender | Already installed; handles frame-sync image loading |
| `remotion` (staticFile) | 4.0.457 | URL resolver for `public/` assets | Required for Remotion rendering context |
| Node.js `fs` + `Buffer` | built-in | Decode base64 data URL to file | Used in render.ts; no new dep |
| Browser `FileReader` | Web API | Convert user-selected PNG to base64 data URL | Standard browser API, no lib needed |

### No new packages required

This phase has zero new npm dependencies. All required primitives (`<Img>`, `staticFile`, `fs`, `Buffer`) are already present in the codebase.

**Installation:** None.

**Version verification:** Not applicable — no new packages.

---

## Package Legitimacy Audit

No new packages are installed in this phase. The existing Remotion 4.0.457 package (`<Img>`, `staticFile`) handles all image rendering requirements.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Studio Browser
  FileReader API
    └─► base64 data URL (PNG)
          └─► PUT /api/config  ─────────────────────────────────────►  pipeline-config.json
                                                                              │
                                                                    (overlays[].imageData)
                                                                              │
                                                       Render time:           ▼
                                                       render.ts reads config
                                                           │
                                                           ├─► decode base64 → public/overlay-0.png
                                                           │
                                                           ├─► bundle({ publicDir: "public/" })
                                                           │
                                                           └─► inputProps.overlays = [{...}]
                                                                     │
                                                               SubtitledVideo
                                                                     │
                                                               PngOverlay (AbsoluteFill)
                                                                     │
                                                               <Img src={staticFile("overlay-0.png")}
                                                                    style={{ position:"absolute",
                                                                             left, top, width }}
                                                                    />
```

### Recommended Project Structure

```
services/remotion-studio/src/
├── compositions/
│   └── PngOverlay.tsx           # NEW — mirrors TitleOverlay.tsx pattern
├── editor/components/
│   └── OverlayEditor.tsx        # NEW — mirrors TitleEditor.tsx pattern
├── pipeline-config.ts           # EDIT — add OverlayConfig + PngOverlayConfig interfaces
└── SubtitledVideo.tsx           # EDIT — add overlays prop + <PngOverlay> rendering

services/remotion-renderer/src/
├── compositions/
│   └── PngOverlay.tsx           # SYNC from studio (cp command)
├── pipeline-config.ts           # SYNC from studio
├── Root.tsx                     # EDIT — add overlays to defaultProps + SubtitledVideo call
└── render.ts                    # EDIT — decode base64 PNGs to public/ before bundle()

services/remotion-studio/src/preview/
└── PreviewApp.tsx               # EDIT — add overlays state + Overlays tab
```

### Pattern 1: Remotion `<Img>` for PNG overlay

**What:** Use Remotion's `<Img>` component (not HTML `<img>`) to render a PNG from the public directory. `<Img>` automatically calls `delayRender()` / `continueRender()` internally to ensure the image is fully loaded before Remotion captures the frame — zero manual delayRender handling required.

**When to use:** Whenever rendering a PNG image inside a Remotion composition. Never use native `<img>` tag inside a Remotion composition.

**Example:**
```tsx
// Source: https://www.remotion.dev/docs/img
import { Img, staticFile, AbsoluteFill } from "remotion";

// In PngOverlay component:
<Img
  src={staticFile("overlay-0.png")}
  style={{
    position: "absolute",
    left: x,   // pixel x from TitleStyleProps pattern
    top: y,    // pixel y
    width: displayWidth,   // CSS display size (triggers downscale if PNG is larger)
    height: "auto",        // preserve aspect ratio
    opacity,               // fade-in/out if needed
  }}
/>
```

**Critical:** `staticFile()` must be called with the filename only (not a full path). The file must be in `public/` before `bundle()` is called. [CITED: https://www.remotion.dev/docs/staticfile] [CITED: https://www.remotion.dev/docs/img]

### Pattern 2: Base64 decode before bundle() in render.ts

**What:** The renderer already copies the input video to `public/` before calling `bundle()` (lines 250–263 of render.ts). PNG overlays use the exact same pattern: read base64 data URL from config, decode to file in `public/`, then bundle. Files added after `bundle()` returns are NOT accessible during render.

**When to use:** Any time a dynamic binary asset (video, PNG, audio) must be included in the rendered output.

**Example:**
```typescript
// Source: [ASSUMED — based on existing render.ts pattern at lines 250-263]
// Before bundle():
const overlays = pipelineConfig?.overlays ?? [];
for (let i = 0; i < overlays.length; i++) {
  const overlay = overlays[i];
  if (!overlay.imageData) continue;
  // Strip "data:image/png;base64," prefix
  const base64 = overlay.imageData.replace(/^data:image\/\w+;base64,/, "");
  const pngBuffer = Buffer.from(base64, "base64");
  const fileName = `overlay-${i}.png`;
  fs.writeFileSync(path.join(publicDir, fileName), pngBuffer);
  // Store resolved filename back for inputProps
  overlay._resolvedFile = fileName;
}
```

### Pattern 3: CSS downscale for crisp logos (OVERLAY-02)

**What:** When a PNG source is larger than its CSS display dimensions, Chromium applies bilinear interpolation by default — this is the correct algorithm for photographic images and logos with gradients. For logos with hard edges (pixel art, icons), setting `image-rendering: pixelated` prevents blurring. The "code-side" responsibility is to set the CSS `width` to the user-configured display size so Chromium downscales the image rather than the browser stretching a small PNG up.

**When to use:** Always — set explicit `width` (and `height: "auto"`) on `<Img>`. Use `imageRendering: "pixelated"` for logos with sharp edges, omit for photos.

**Example:**
```tsx
// Source: [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering]
// Source: [CITED: https://www.remotion.dev/docs/scaling]
<Img
  src={staticFile(overlay._resolvedFile)}
  style={{
    position: "absolute",
    left: overlay.x,
    top: overlay.y,
    width: overlay.displayWidth,  // CSS constraint forces downscale if PNG > displayWidth
    height: "auto",
    imageRendering: overlay.pixelArt ? "pixelated" : "auto",
  }}
/>
```

Note: Remotion's `scale` parameter (Phase 14) multiplies the composition resolution. If `scale:2` is ever re-enabled, the PNG will be rendered at `displayWidth * 2` pixels — meaning a 2x source PNG will render at exact 1:1 pixel mapping, which is crisp. This is the deeper meaning of "supersampled downscale": at `scale:1`, Chromium downsamples; at `scale:2`, a 2x PNG renders 1:1. For this phase at `scale:1`, CSS `width` constraint is sufficient.

### Pattern 4: Browser FileReader for PNG upload

**What:** Standard HTML5 `<input type="file">` combined with `FileReader.readAsDataURL()` converts the user-selected PNG file to a base64 data URL in the browser — no server roundtrip needed for the upload step. The resulting data URL (e.g., `data:image/png;base64,...`) is stored directly in the config state and sent via PUT /api/config.

**When to use:** Whenever handling binary file upload in a React UI that stores the result as text in a config object.

**Example:**
```tsx
// Source: [ASSUMED — standard Web API pattern]
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target?.result as string; // "data:image/png;base64,..."
    onChange({ imageData: dataUrl });
  };
  reader.readAsDataURL(file);
};
```

**Constraint:** The Express JSON body limit in `server.ts` is currently `1mb`. A 500KB PNG becomes ~666KB base64. The limit must be raised to at least `4mb` (or `10mb` for safety) to handle typical logo/watermark PNGs.

### Pattern 5: Preview in @remotion/player using data URL

**What:** In the studio's `PreviewPlayer`, the PNG overlay can be rendered directly using the base64 data URL as the `src` for `<Img>` — no need to go through `staticFile()` in the browser context. `<Img>` accepts any URL including data URLs.

**When to use:** Studio preview only (browser context). The renderer uses `staticFile()` after decoding to file.

**Example:**
```tsx
// Source: [ASSUMED — based on rawVideoSrc pattern in PreviewPlayer.tsx]
// In SubtitledVideo.tsx, for browser Player context vs. renderer context:
const imageSrc = overlay.rawImageSrc ?? staticFile(overlay._resolvedFile ?? "");
<Img src={imageSrc} style={{ ... }} />
```

The existing `rawVideoSrc`/`videoSrc` pattern (see `PreviewPlayer.tsx` lines 48–50 and `SubtitledVideo.tsx`) shows the precedent: `rawVideoSrc` is the direct URL for browser use, `videoSrc` is the `staticFile()` name for renderer use.

### Anti-Patterns to Avoid

- **Using native `<img>` inside Remotion:** Will not trigger `delayRender` — Remotion may capture a frame before the image loads, producing blank/broken frames in output video. Always use `<Img>` from `remotion`.
- **Calling `staticFile()` with a full path:** `staticFile('/home/user/logo.png')` will not work — absolute paths are not supported in Remotion. Always reference files by name only, after copying them to `public/`.
- **Adding files to `public/` after `bundle()` returns:** Files added post-bundle are not accessible during render. All `public/` writes must happen before the `bundle()` call in render.ts. [CITED: https://www.remotion.dev/docs/assets]
- **Storing PNG path (not base64) in pipeline-config.json:** A file path would need careful Docker volume management to ensure the renderer can find the file. Base64 data URL is self-contained and flows through the existing config pipeline without changes to docker-compose.yml.
- **Not increasing Express JSON body limit:** The current 1mb limit will reject config saves for PNGs larger than ~750KB. Increase to at least `4mb` before implementing the upload UI.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image loading sync with render | Custom delayRender around `<img>` | `<Img>` from `remotion` | `<Img>` handles the full delayRender/continueRender lifecycle internally |
| PNG to base64 conversion | canvas.toDataURL() pipeline | Browser FileReader API | Native, synchronous (callback), no canvas overhead |
| Binary file in JSON transport | Multipart upload endpoint | base64 data URL in existing PUT /api/config | No new endpoint, no new dep (multer), consistent with existing config flow |

**Key insight:** Remotion's `<Img>` abstracts away the frame-sync complexity that would otherwise require `delayRender()`/`continueRender()` calls identical to the font loading pattern in `TitleOverlay.tsx`. Use `<Img>` and get it for free.

---

## Common Pitfalls

### Pitfall 1: File copy after bundle() call
**What goes wrong:** PNG file is written to `public/` after `bundle()` is called. The bundler copies `public/` during bundling — the file is absent from the bundle. `staticFile("overlay-0.png")` returns a URL but the webpack-dev-server returns 404. Rendered frames show no overlay.
**Why it happens:** Misreading the render.ts execution order. The video copy at line 250–256 happens before bundle() at line 262; it's easy to insert the PNG decode after bundle().
**How to avoid:** In render.ts, all `public/` writes (video copy AND PNG decode) must be grouped before the `bundle()` call. Add a comment: `// ALL public/ writes must happen before bundle() — see OVERLAY-02`.
**Warning signs:** `<Img onError>` fires in studio preview but PNGs render blank; no error thrown, just silent 404 in bundled context.

### Pitfall 2: Express JSON body too small for base64 PNG
**What goes wrong:** User selects a PNG > ~750KB. The PUT /api/config request returns HTTP 413 (Payload Too Large). The studio shows a save error; the user thinks config is broken.
**Why it happens:** `express.json({ limit: "1mb" })` in server.ts. A 750KB PNG → ~1MB base64 → total config JSON > 1mb.
**How to avoid:** Increase to `"10mb"` at the same time as adding the PNG upload UI. Also add client-side size validation (reject PNGs > 5MB before sending).
**Warning signs:** Save Config button fails with "payload too large" or generic save error after selecting a PNG.

### Pitfall 3: Using data URL directly in staticFile() call
**What goes wrong:** `staticFile("data:image/png;base64,...")` — passing the data URL as if it were a filename. `staticFile()` expects a filename relative to `public/`, not a data URL. Will produce a mangled URL that fails to load.
**Why it happens:** Confusion between the browser Player context (data URL works directly as `<Img src>`) and the renderer context (must go through `staticFile()`).
**How to avoid:** Use the `rawImageSrc`/`_resolvedFile` split: browser Player uses data URL directly; renderer uses `staticFile(resolvedFilename)`.
**Warning signs:** `staticFile` returns a nonsensical encoded URL; console error about invalid image source.

### Pitfall 4: Missing alpha channel / white box around PNG
**What goes wrong:** The PNG background renders as white or another solid color instead of transparent.
**Why it happens:** `<Img>` renders inside a `<div>` that might have a background-color; or the PNG was saved without an alpha channel.
**How to avoid:** The `PngOverlay` wrapper div must have `background: "transparent"` and no explicit background. Validate at UI level that the uploaded file is a PNG with alpha (MIME check on the FileReader result).
**Warning signs:** PNG overlay shows white box in preview; transparent areas appear filled.

### Pitfall 5: Overlay covers subtitles or renders below video
**What goes wrong:** The PNG overlay is not visible (rendered behind video) or covers the subtitle text.
**Why it happens:** Z-order in `AbsoluteFill` stacking in `SubtitledVideo.tsx`. All children of `AbsoluteFill` stack by DOM order — later children are on top.
**How to avoid:** Place PNG overlays after the video (`ZoomContainer`) but before or after subtitles depending on the desired compositing. Default: after video, before subtitles (so subtitles read on top of the logo).
**Warning signs:** Preview shows nothing where PNG should be; or subtitles are hidden under the PNG.

---

## Code Examples

### PngOverlay Component (minimal structure)

```tsx
// Source: [ASSUMED — mirrors TitleOverlay.tsx verified pattern in this codebase]
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { PngOverlayConfig } from "../pipeline-config";

interface PngOverlayProps {
  overlay: PngOverlayConfig;
  rawImageSrc?: string; // data URL for browser Player context
}

export const PngOverlay: React.FC<PngOverlayProps> = ({ overlay, rawImageSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, Math.round(200 * fps / 1000)], [0, overlay.opacity ?? 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Browser Player uses data URL directly; renderer uses staticFile()
  const src = rawImageSrc ?? staticFile(overlay._resolvedFile ?? "overlay-0.png");

  return (
    <AbsoluteFill>
      <Img
        src={src}
        style={{
          position: "absolute",
          left: overlay.x,
          top: overlay.y,
          width: overlay.displayWidth,
          height: "auto",
          opacity,
          imageRendering: "auto", // Chromium bilinear downscale — crisp for logos
        }}
      />
    </AbsoluteFill>
  );
};
```

### pipeline-config.ts additions

```typescript
// Source: [ASSUMED — mirrors TitleConfig/TitleStyleProps pattern in this codebase]

/** Configuration for a single PNG overlay */
export interface PngOverlayConfig {
  imageData: string;          // base64 data URL: "data:image/png;base64,..."
  x: number;                  // pixel x from left edge of 1080px frame
  y: number;                  // pixel y from top edge of 1920px frame
  displayWidth: number;       // CSS display width in pixels (triggers downscale)
  opacity?: number;           // 0–1, default 1
  _resolvedFile?: string;     // set by render.ts at render time, NOT persisted
}

// Add to PipelineConfig interface:
// overlays?: PngOverlayConfig[];
```

### render.ts addition (before bundle())

```typescript
// Source: [ASSUMED — mirrors existing video copy pattern at lines 250-256 of render.ts]

// Decode PNG overlays to public/ directory BEFORE bundle() call
const overlays: PngOverlayConfig[] = (pipelineConfig?.overlays ?? []).map((ov, i) => {
  if (!ov.imageData) return { ...ov, _resolvedFile: "" };
  const base64 = ov.imageData.replace(/^data:image\/\w+;base64,/, "");
  const fileName = `overlay-${i}.png`;
  fs.writeFileSync(path.join(publicDir, fileName), Buffer.from(base64, "base64"));
  console.log(`  Decoded PNG overlay ${i} -> public/${fileName}`);
  return { ...ov, _resolvedFile: fileName };
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `delayRender` + `<img>` | `<Img>` from remotion (auto delayRender) | Remotion v2.x | `<Img>` handles all loading sync — no boilerplate needed |
| Absolute file paths | `staticFile()` + public/ directory | Remotion v1.x | Cross-environment consistency; works in Remotion Studio, Player, SSR, CLI |
| `staticFile()` without encoding | `staticFile()` with `encodeURIComponent` | Remotion v4.0 | Filenames with special chars (`#`, `?`) work correctly |

**Deprecated/outdated:**
- Native `<img>` tag inside Remotion compositions: works but bypasses delayRender contract — always use `<Img>` from `remotion`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Remotion `<Img>` accepts data URLs as `src` in browser Player context | Standard Stack / Pattern 5 | Low — data URLs are standard HTML; Remotion wraps `<img>` which accepts data URLs |
| A2 | Buffer.from(base64, "base64") + fs.writeFileSync produces a valid PNG file the renderer can read | Code Examples (render.ts) | Low — standard Node.js base64 decode; PNG magic bytes preserved |
| A3 | PngOverlayConfig `_resolvedFile` field (runtime-only) can be present in the type but excluded from validatePipelineConfig | Architecture Patterns | Medium — if validation rejects unknown fields, need to explicitly allow or strip it |
| A4 | CSS `imageRendering: "auto"` in Chromium headless produces acceptable downscale quality for logos at scale:1 | Pattern 3 | Medium — some logos with thin lines may still alias; user may need `pixelated` option |
| A5 | A 4–10mb Express JSON body limit is sufficient for typical PNG overlays used as logos/watermarks | Pitfall 2 | Low — logos are rarely > 2MB; 10mb leaves ample headroom |

---

## Open Questions

1. **Should `_resolvedFile` be typed separately from the persisted config?**
   - What we know: `TitleConfig` uses `style?: TitleStyleProps` with no runtime-only fields. The `_resolvedFile` field would be added by render.ts at render time and should NOT be in pipeline-config.json.
   - What's unclear: Whether to use two types (`PngOverlayConfig` vs `PngOverlayRenderConfig`) or a single type with `_resolvedFile?: string` that validatePipelineConfig simply ignores.
   - Recommendation: Single type, `_resolvedFile` is optional and excluded from validation (matches the current `_meta` pattern on GET /api/config responses).

2. **Should opacity be animated or static?**
   - What we know: TitleOverlay has entrance/exit fade animations. OVERLAY-03 says "positioned and sized" — does not mention animation.
   - What's unclear: Whether the user expects an animated fade-in like TitleOverlay or a static overlay.
   - Recommendation: Static opacity for v1 (OVERLAY-03 says position + size only). Add animation in a future phase if requested.

3. **Multiple overlays vs single overlay?**
   - What we know: The requirements say "a transparent PNG overlay" (singular). TitleConfig uses an array.
   - What's unclear: Whether the UI should support one overlay or multiple.
   - Recommendation: Use an array (`overlays?: PngOverlayConfig[]`) from the start — symmetric with `titles[]` — but the UI can initially show a single-overlay interface (add/replace). This avoids a schema migration later if multi-overlay is needed.

---

## Environment Availability

No new external dependencies. All tools used are already present.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Remotion `<Img>` | OVERLAY-01, OVERLAY-02 | ✓ | 4.0.457 | — |
| Node.js `fs` + `Buffer` | render.ts PNG decode | ✓ | built-in | — |
| Browser FileReader API | Studio UI upload | ✓ | Web standard | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | `services/remotion-renderer/vitest.config.ts` |
| Quick run command | `cd services/remotion-renderer && npx vitest run` |
| Full suite command | `cd services/remotion-renderer && npx vitest run` |

Studio also has vitest-compatible test files in `src/compositions/*.test.ts` (run via vite + vitest in devDeps).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVERLAY-01 | `PngOverlayConfig` validates in `validatePipelineConfig` | unit | `cd services/remotion-renderer && npx vitest run src/pipeline-config.test.ts` | ❌ Wave 0 — add to `pipeline-config.test.ts` |
| OVERLAY-01 | Valid config with overlays array accepted | unit | same | ❌ Wave 0 |
| OVERLAY-02 | `displayWidth` field exists and defaults to frame width | unit | same | ❌ Wave 0 |
| OVERLAY-03 | `x`, `y`, `displayWidth` validated (non-negative numbers) | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd services/remotion-renderer && npx vitest run`
- **Per wave merge:** `cd services/remotion-renderer && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Add OVERLAY-* test cases to `services/remotion-renderer/src/pipeline-config.test.ts`
- [ ] Add OVERLAY-* test cases to `services/remotion-studio/src/compositions/` (new overlay.test.ts)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | validate MIME type client-side; validate base64 format in validatePipelineConfig |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious file disguised as PNG (polyglot) | Tampering | Client-side MIME check (`file.type === "image/png"`); server validates base64 starts with `data:image/png;base64,` |
| Oversized base64 payload (DoS) | DoS | Client-side size limit (e.g., reject > 5MB); Express body limit |
| Path traversal via `_resolvedFile` | Tampering | `_resolvedFile` is set only by render.ts (not accepted from client config); `overlay-${i}.png` is sanitized filename |

---

## Sources

### Primary (HIGH confidence)
- [https://www.remotion.dev/docs/img](https://www.remotion.dev/docs/img) — `<Img>` component props, delayRender behavior
- [https://www.remotion.dev/docs/staticfile](https://www.remotion.dev/docs/staticfile) — `staticFile()` API, public/ directory convention
- [https://www.remotion.dev/docs/assets](https://www.remotion.dev/docs/assets) — Asset import patterns; confirmed "files added to public/ after bundle() are NOT accessible"
- [https://www.remotion.dev/docs/terminology/public-dir](https://www.remotion.dev/docs/terminology/public-dir) — Public directory location and purpose
- Codebase: `services/remotion-renderer/src/render.ts` lines 250–263 — existing video-copy-before-bundle() pattern
- Codebase: `services/remotion-studio/src/compositions/TitleOverlay.tsx` — React composition pattern to mirror
- Codebase: `services/remotion-studio/src/pipeline-config.ts` — Schema extension pattern
- Codebase: `services/remotion-studio/src/server.ts` lines 85, 182–189 — JSON body limit + atomic config write pattern

### Secondary (MEDIUM confidence)
- [https://www.remotion.dev/docs/scaling](https://www.remotion.dev/docs/scaling) — Scale affects text/SVG/images; context for OVERLAY-02 at scale:2
- [https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering) — `image-rendering: pixelated` for crisp downscaling in Chromium

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new packages; all primitives verified in codebase and official docs
- Architecture: HIGH — file-copy-before-bundle pattern is proven in render.ts; base64 approach is a direct extension
- Pitfalls: HIGH — most verified from official Remotion docs or codebase inspection
- OVERLAY-02 "supersampled" interpretation: MEDIUM — CSS `width` constraint + Chromium bilinear is the simplest correct approach, but the exact semantics of "code-side supersampled" could mean canvas preprocessing

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (stable Remotion 4.0.x — no churn expected)
