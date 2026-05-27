---
phase: 18-studio-ui-redesign
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - services/remotion-studio/src/editor/components/TitleEditor.tsx
  - services/remotion-studio/src/preview/PreviewApp.tsx
  - services/remotion-studio/src/editor/App.tsx
  - services/remotion-studio/src/server.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-05-27
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files reviewed: the unified studio server (`server.ts`), the top-level React router (`App.tsx`), the main studio UI component (`PreviewApp.tsx`), and the title overlay editor (`TitleEditor.tsx`).

`App.tsx` is clean — a minimal router shim with no defects.

`server.ts` has three significant defects: a double-encoding bug that corrupts stored title text, a non-atomic file write that can produce a partial/corrupt config, and a timing side-channel in the Basic Auth `safeEqual` helper. The CORS middleware is also globally permissive in a way that conflicts with the auth model.

`PreviewApp.tsx` has an unguarded `setTimeout` that can call `setSaveSuccess` on an unmounted component, and it loads titles from the API response without any shape validation.

`TitleEditor.tsx` has a stale-index state bug: when a title at index `N` is deleted while editing title `M > N`, `editingIndex` is not decremented, so `handleSaveEdit` will overwrite the wrong entry.

---

## Critical Issues

### CR-01: Server-side HTML encoding corrupts stored title text (double-encoding)

**File:** `services/remotion-studio/src/server.ts:18-30`

**Issue:** `sanitizeTitles` runs `sanitizeHtml` on every PUT request. `sanitizeHtml` replaces `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;` and writes the escaped result to `pipeline-config.json`. When the config is read back via GET `/api/config` and displayed in the React preview (or rendered by Remotion's `TitleOverlay`), the raw stored string is used — React/JSX does **not** un-escape HTML entities, and Remotion's canvas renderer treats `&amp;` as a literal six-character string.

Result: a user who types `Hello & World` saves it, and the video renders `Hello &amp; World`. On a second save the `&amp;` is re-encoded to `&amp;amp;` — each round-trip corrupts the text further.

The sanitisation layer is also unnecessary for this use-case: title text is stored in a JSON config file and consumed by a React JSX expression (`{text}` in `TitleOverlay.tsx:220`), which auto-escapes for HTML. There is no `dangerouslySetInnerHTML` or equivalent path, so stored XSS via the title text field is not achievable.

**Fix:** Remove `sanitizeTitles` and `sanitizeHtml` from the PUT handler. Rely on React's JSX auto-escaping and schema validation (`validatePipelineConfig` already rejects malformed entries). If a future code path introduces raw HTML injection risk, address it at that point.

```typescript
// In PUT /api/config handler — delete these lines:
// if (configToWrite.titles && Array.isArray(configToWrite.titles)) {
//   configToWrite.titles = sanitizeTitles(configToWrite.titles);
// }
```

---

### CR-02: Non-atomic config write can corrupt `pipeline-config.json`

**File:** `services/remotion-studio/src/server.ts:179`

**Issue:** `fs.writeFileSync(ACTIVE_PIPELINE_CONFIG_PATH, ...)` truncates and rewrites the file in-place. If the Node.js process is killed, the container restarts, or the filesystem flushes mid-write, the file is left with partial JSON. The next call to GET `/api/config` will call `JSON.parse` on the truncated content and throw, returning a 500 with empty defaults — silently discarding all previously saved configuration.

This is a data-loss risk whenever the server is restarted during a save (common in Docker restarts, OOM kills, etc.).

**Fix:** Write to a temporary file in the same directory and atomically rename it:

```typescript
import os from "os";

const tmpPath = path.join(
  path.dirname(ACTIVE_PIPELINE_CONFIG_PATH),
  `.pipeline-config.tmp.${Date.now()}.json`
);
fs.writeFileSync(tmpPath, JSON.stringify(configToWrite, null, 2), "utf-8");
fs.renameSync(tmpPath, ACTIVE_PIPELINE_CONFIG_PATH);
```

`rename` is atomic on POSIX filesystems (same mount point). This guarantees readers always see either the old or the new complete file, never a partial write.

---

### CR-03: `editingIndex` becomes stale when a preceding title is deleted

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:109-115`

**Issue:** `handleRemove(index)` only calls `resetForm()` when `editingIndex === index` (the deleted item is the one being edited). When a title at position `index < editingIndex` is deleted, the array shifts: what was at `editingIndex` is now at `editingIndex - 1`, but `editingIndex` is not decremented.

When the user subsequently clicks "Save Changes", `handleSaveEdit` writes `updated[editingIndex]` — which now refers to the **next** entry in the array, overwriting it with the form contents that belong to the entry that was originally being edited.

Example: titles = [A, B, C], `editingIndex = 2` (editing C). User deletes B (index 1). Array is now [A, C]. `editingIndex` stays 2. Save → writes form to index 2 which is `undefined`, creating a hole, or overwrites nothing (the array only has indices 0 and 1).

**Fix:**

```typescript
const handleRemove = (index: number) => {
  const updated = titles.filter((_, i) => i !== index);
  onChange(updated);
  if (editingIndex === index) {
    resetForm();
  } else if (editingIndex !== null && index < editingIndex) {
    setEditingIndex(editingIndex - 1);
  }
};
```

---

## Warnings

### WR-01: Timing side-channel in Basic Auth `safeEqual` leaks credential length

**File:** `services/remotion-studio/src/server.ts:63-68`

**Issue:** `safeEqual` short-circuits with `return false` when `ab.length !== bb.length` **before** calling `crypto.timingSafeEqual`. This makes the function execute in measurable constant time only when lengths match. An attacker probing the endpoint from a low-latency position can determine the exact byte-length of `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` by binary-searching for the input length that produces the slowest response.

In a Cloudflare tunnel scenario (the documented deployment model), network jitter is high enough to make this impractical. The risk is low but the fix is trivial.

**Fix:** Pad both buffers to the same length before comparing, or use a fixed-length HMAC comparison:

```typescript
function safeEqual(a: string, b: string): boolean {
  // Use fixed-size HMAC to avoid length oracle
  const key = Buffer.alloc(32);
  const ha = crypto.createHmac("sha256", key).update(a).digest();
  const hb = crypto.createHmac("sha256", key).update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
```

---

### WR-02: Wildcard CORS conflicts with Basic Auth model

**File:** `services/remotion-studio/src/server.ts:44`

**Issue:** `app.use(cors())` with no options sets `Access-Control-Allow-Origin: *`. This means any web page on any origin can make credentialless cross-origin requests to the API. When Basic Auth is enabled, the browser will not forward auth headers to the cross-origin request (correct), but the wildcard header also means the server **cannot** be updated in the future to use `credentials: 'include'` without this becoming a CSRF/exfiltration risk.

Additionally, with wildcard CORS, any script on any page can read the response of GET `/api/config` if the request somehow succeeds (e.g., through a SSRF vector, or if auth is disabled in a dev environment). Exposing the pipeline configuration to arbitrary origins is an information disclosure.

**Fix:** Restrict CORS to the actual allowed origin (or remove the global CORS middleware and only add it to endpoints that require it):

```typescript
app.use(cors({
  origin: process.env.CORS_ALLOWED_ORIGIN || "http://localhost:3123",
  credentials: true,
}));
```

---

### WR-03: `setTimeout` in `handleSave` not cancelled on unmount — React state update on unmounted component

**File:** `services/remotion-studio/src/preview/PreviewApp.tsx:275`

**Issue:** `setTimeout(() => setSaveSuccess(false), 2000)` is not stored and not cleaned up. If the component unmounts within 2 seconds of a successful save (e.g., hot-reload, navigation), React will call `setSaveSuccess(false)` on the unmounted component. In React 18 strict mode this is a no-op warning; in React 17 and earlier it throws. Either way it is a latent leak that surfaces as a console warning during development.

**Fix:**

```typescript
const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

// In handleSave:
if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
setSaveSuccess(true);
saveTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);

// Add cleanup useEffect:
useEffect(() => {
  return () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  };
}, []);
```

---

### WR-04: API response titles loaded without shape validation

**File:** `services/remotion-studio/src/preview/PreviewApp.tsx:242-243`

**Issue:** `setTitles(data.titles)` passes the raw API response array directly into state with no validation. If `pipeline-config.json` was manually edited, migrated from an older format, or corrupted, `data.titles` could contain entries missing required fields (`text`, `startTimeMs`, `durationMs`). These invalid entries are then passed to `TitleEditor` and `PreviewPlayer`, where downstream code assumes field presence (e.g., `title.startTimeMs / 1000` on line 176 of `TitleEditor.tsx` would produce `NaN` if `startTimeMs` is undefined).

**Fix:** Filter or validate titles before setting state:

```typescript
if (data && Array.isArray(data.titles)) {
  const validTitles = data.titles.filter(
    (t: unknown): t is TitleConfig =>
      typeof t === "object" && t !== null &&
      typeof (t as TitleConfig).text === "string" &&
      typeof (t as TitleConfig).startTimeMs === "number" &&
      typeof (t as TitleConfig).durationMs === "number"
  );
  setTitles(validTitles);
}
```

---

## Info

### IN-01: `key={i}` on list items uses array index as React key

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:159`

**Issue:** Using the array index as a React key causes React to reuse DOM nodes when items are deleted or reordered, which can produce stale input values and animation glitches. This is the standard React key anti-pattern.

**Fix:** Use a stable unique key. Since `TitleConfig` has no `id` field, either add one on creation or derive a key from content:

```tsx
key={`${title.text}-${title.startTimeMs}-${i}`}
```

A better long-term fix is to add an `id` field to `TitleConfig` and generate it with `crypto.randomUUID()` on creation.

---

### IN-02: `console.log` in `/api/diag` logs unsanitised user-controlled JSON — log injection risk

**File:** `services/remotion-studio/src/server.ts:103`

**Issue:** `console.log("[diag] Browser errors:", JSON.stringify(req.body, null, 2))` writes arbitrary authenticated-user-supplied content to stdout. An authenticated user can craft a body with embedded newline characters that forge log lines (log injection). While the impact is low in a single-operator tool, log-aggregation pipelines (e.g., Cloudflare Workers Logs, Datadog) may misparse injected lines.

**Fix:** Truncate or validate the body before logging, or use a structured logger that serialises payloads safely:

```typescript
const MAX_DIAG_LOG_SIZE = 2000;
const raw = JSON.stringify(req.body);
console.log("[diag] Browser errors:", raw.slice(0, MAX_DIAG_LOG_SIZE));
```

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
