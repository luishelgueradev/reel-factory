---
phase: 18-studio-ui-redesign
reviewed: 2026-05-27T12:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - services/remotion-studio/src/editor/components/TitleEditor.tsx
  - services/remotion-studio/src/preview/PreviewApp.tsx
  - services/remotion-studio/src/editor/App.tsx
  - services/remotion-studio/src/server.ts
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
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

`server.ts` has three significant defects. First, the `sanitizeTitles` / `sanitizeHtml` function actively corrupts stored data: every `&`, `<`, and `>` typed by a user is replaced with HTML entities that React and Remotion render verbatim as literal text. The anti-XSS comment justifying this is incorrect — the only render path (`TitleOverlay.tsx:{text}`) is a JSX text node, which auto-escapes; there is no `dangerouslySetInnerHTML` path. Second, the config write is non-atomic: a partial flush on process kill produces truncated JSON that causes all future reads to 500 and fall back to empty defaults. Third, `safeEqual` exits early on length mismatch before reaching `timingSafeEqual`, leaking credential length via response time.

An additional server defect: the `/api/diag` endpoint registers its own `express.json({ limit: "10kb" })` middleware after the global `express.json({ limit: "1mb" })` at line 92. Express body-parsers skip when `req._body` is already set, so the 10 KB limit is never enforced — up to 1 MB of arbitrary content can be written to server logs by anyone who can reach the endpoint.

`PreviewApp.tsx` has an unguarded `setTimeout` that calls `setSaveSuccess` on a potentially unmounted component, and loads titles from the API without validating their shape against the `TitleConfig` interface.

`TitleEditor.tsx` has a stale-index state bug: when a title at position `N` is deleted while editing title at position `M > N`, `editingIndex` is not decremented. `handleSaveEdit` then writes `updated[M]`, which is the wrong entry (or creates a new out-of-bounds slot), silently overwriting or duplicating data.

---

## Structural Findings (fallow)

No structural pre-pass was provided for this phase.

---

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: `sanitizeHtml` actively corrupts stored title text (double-encoding bug)

**File:** `services/remotion-studio/src/server.ts:18-30, 169-171`

**Issue:** `sanitizeTitles` runs `sanitizeHtml` on every `PUT /api/config` request. `sanitizeHtml` replaces `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;` and writes the escaped strings to `pipeline-config.json`. When that config is later read by `GET /api/config` and rendered by `TitleOverlay.tsx` the raw stored string is used in a JSX text node (`{text}` at line 220 of `TitleOverlay.tsx`). JSX text nodes do NOT un-escape HTML entities — `&amp;` renders as the seven-character string `&amp;`, not `&`.

Consequences:
- A user who types `Hello & World` saves it, and the video renders `Hello &amp; World`.
- Each subsequent save re-encodes the already-encoded entity: `&amp;` → `&amp;amp;`.
- The same encoded value is returned in the `PUT` response (line 183), so the editor form itself immediately shows the corrupted text after saving, making the round-trip invisible to the user.

The security comment at the top of `server.ts` (and in `TitleEditor.tsx:4`) references T-06-12 / CR-02 as the motivation. That risk does not exist in this codebase: title text reaches the screen only through `{text}` JSX expression inside `TitleOverlay`, never via `dangerouslySetInnerHTML` or equivalent. Schema validation (`validatePipelineConfig`) already rejects non-string `text` fields.

**Fix:** Remove `sanitizeHtml`, `sanitizeTitles`, and all call sites. Rely on JSX auto-escaping and the existing schema validation.

```typescript
// DELETE lines 18-30 (sanitizeHtml + sanitizeTitles functions)
// DELETE lines 169-171 in the PUT handler:
//   if (configToWrite.titles && Array.isArray(configToWrite.titles)) {
//     configToWrite.titles = sanitizeTitles(configToWrite.titles);
//   }
```

---

#### CR-02: Non-atomic config write can corrupt `pipeline-config.json` on process interrupt

**File:** `services/remotion-studio/src/server.ts:179`

**Issue:** `fs.writeFileSync(ACTIVE_PIPELINE_CONFIG_PATH, ...)` truncates the target file and writes in place. If the Node.js process is killed (Docker restart, OOM kill, `SIGKILL`) while the write is in progress, the file is left with partial JSON. On the next `GET /api/config`, `JSON.parse` throws, the handler returns `500` with empty defaults, and all previously saved configuration is silently lost until the file is manually repaired.

This is a data-loss risk under normal operational conditions (Docker container restarts are common in a dev pipeline).

**Fix:** Write to a temp file in the same directory, then atomically rename:

```typescript
import os from "os";

// Inside PUT /api/config try block, replace writeFileSync with:
const tmpPath = path.join(
  path.dirname(ACTIVE_PIPELINE_CONFIG_PATH),
  `.pipeline-config.${process.pid}.${Date.now()}.tmp.json`
);
try {
  fs.writeFileSync(tmpPath, JSON.stringify(configToWrite, null, 2), "utf-8");
  fs.renameSync(tmpPath, ACTIVE_PIPELINE_CONFIG_PATH);
} catch (writeErr) {
  try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup error */ }
  throw writeErr;
}
```

`rename(2)` is atomic on POSIX filesystems when source and destination are on the same mount. Readers always see either the old or the new complete file.

---

#### CR-03: Stale `editingIndex` when a preceding title entry is deleted

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:109-115`

**Issue:** `handleRemove(index)` only resets the form when `editingIndex === index`. When a title at position `index < editingIndex` is deleted, the array shifts: the entry previously at `editingIndex` is now at `editingIndex - 1`, but `editingIndex` is not adjusted.

When the user then clicks "Save Changes", `handleSaveEdit` executes:
```typescript
updated[editingIndex] = { text: newTitle.text, ... }
```
`updated` has length `titles.length - 1`. Writing to `updated[editingIndex]` (which is now out of bounds) causes JavaScript to silently extend the array with `undefined` holes or append a new entry instead of updating the intended one. The real target entry is left unchanged, and a duplicate or wrongly-placed entry is added.

Concrete example: `titles = [A, B, C]`, `editingIndex = 2` (editing C). User deletes B. `updated = [A, C]` (length 2). `handleSaveEdit` sets `updated[2] = formData` → `onChange([A, C, formData])`. C is unchanged; the form data appears as a third, unexpected entry.

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

### Warnings

#### WR-01: `safeEqual` short-circuits before `timingSafeEqual` — credential length oracle

**File:** `services/remotion-studio/src/server.ts:63-68`

**Issue:** The early-return `if (ab.length !== bb.length) return false` executes in sub-microsecond time, while `crypto.timingSafeEqual` executes in time proportional to buffer length. An attacker with a low-latency path (e.g., same LAN segment, or measuring via the Cloudflare tunnel with enough samples) can determine the exact UTF-8 byte length of `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` through response-time measurement. This is the standard "length oracle" variant of timing attacks.

**Fix:** Hash both sides to fixed-length digests before comparing:

```typescript
function safeEqual(a: string, b: string): boolean {
  // Digest to fixed 32-byte buffers so timingSafeEqual always runs for the same duration
  const key = Buffer.alloc(32); // zero key — only used for length equalization
  const ha = crypto.createHmac("sha256", key).update(a).digest();
  const hb = crypto.createHmac("sha256", key).update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
```

---

#### WR-02: Global wildcard CORS conflicts with the Basic Auth security model

**File:** `services/remotion-studio/src/server.ts:44`

**Issue:** `app.use(cors())` with no options emits `Access-Control-Allow-Origin: *` on every response. This has two concrete problems:

1. When auth is disabled (local dev, no `STUDIO_BASIC_AUTH_USER` set), any web page on any origin can read `GET /api/config` via a cross-origin fetch, exposing the full pipeline configuration including font choices, title text, and effect settings.

2. A wildcard `Access-Control-Allow-Origin` permanently prevents upgrading to `credentials: 'include'` CORS mode without a breaking change. If Basic Auth is later expected to work across origins (e.g., embedded preview in another tool), the auth header will be silently dropped by browsers.

**Fix:** Restrict to the studio's own origin:

```typescript
app.use(cors({
  origin: process.env.CORS_ALLOWED_ORIGIN || `http://localhost:${PORT}`,
  credentials: true,
}));
```

---

#### WR-03: `setTimeout` in `handleSave` not cancelled on unmount

**File:** `services/remotion-studio/src/preview/PreviewApp.tsx:275`

**Issue:** `setTimeout(() => setSaveSuccess(false), 2000)` is not stored and not cancelled in a cleanup effect. If the component unmounts within 2 seconds of a successful save (hot-reload, SPA navigation), React attempts to update state on an unmounted component. In React 18 strict mode this produces a console warning; in earlier React it throws. Each rapid save-then-navigate also stacks multiple timeout callbacks that race to clear the success flag.

**Fix:**

```typescript
const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

// In handleSave, replace the bare setTimeout:
if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
setSaveSuccess(true);
saveTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);

// Add cleanup effect (alongside other useEffects):
useEffect(() => {
  return () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  };
}, []);
```

---

#### WR-04: API-loaded titles bypass shape validation before entering state

**File:** `services/remotion-studio/src/preview/PreviewApp.tsx:242-243`

**Issue:** `setTitles(data.titles)` stores the raw API response directly without verifying that each entry has the required `text` (string), `startTimeMs` (number), and `durationMs` (number) fields. If `pipeline-config.json` was hand-edited, migrated from an older schema, or partially written, `data.titles` may contain entries with missing or wrong-typed fields.

Downstream code assumes these fields exist. `TitleEditor.tsx:176` computes `title.startTimeMs / 1000` — if `startTimeMs` is `undefined`, this produces `NaN`, which propagates into the time-range display and potentially into `PreviewPlayer`.

**Fix:**

```typescript
if (data && Array.isArray(data.titles)) {
  const validTitles = (data.titles as unknown[]).filter(
    (t): t is TitleConfig =>
      typeof t === "object" && t !== null &&
      typeof (t as TitleConfig).text === "string" &&
      typeof (t as TitleConfig).startTimeMs === "number" &&
      typeof (t as TitleConfig).durationMs === "number"
  );
  setTitles(validTitles);
}
```

---

#### WR-05: `/api/diag` 10 KB body limit is silently bypassed by the global body parser

**File:** `services/remotion-studio/src/server.ts:92, 102`

**Issue:** The global `app.use(express.json({ limit: "1mb" }))` at line 92 runs before every route, including `/api/diag`. By the time the inline `express.json({ limit: "10kb" })` at line 102 is evaluated, `req._body` is already `true` and Express body-parser skips re-parsing. The effective body size limit for `/api/diag` is therefore 1 MB, not 10 KB.

When Basic Auth is disabled (no credentials configured), `/api/diag` is unauthenticated. Any caller can send up to 1 MB of arbitrary content that `console.log` writes to stdout verbatim. In containerised deployments with log aggregation (Datadog, CloudWatch, Loki), this allows log flooding at essentially no cost.

**Fix:** Remove the global body parser and apply `express.json` per-route, or remove the illusory inline parser from `/api/diag` and add explicit size validation:

```typescript
// Option A: Remove global parser; apply per route
// app.use(express.json({ limit: "1mb" }));   ← delete
app.post("/api/diag", express.json({ limit: "10kb" }), (req, res) => { ... });
app.put("/api/config", express.json({ limit: "1mb" }), (req, res) => { ... });

// Option B: Keep global parser, add manual size guard in /api/diag:
app.post("/api/diag", (req, res) => {
  const raw = JSON.stringify(req.body);
  if (raw.length > 10_000) {
    return res.status(413).json({ error: "Payload too large" });
  }
  console.log("[diag] Browser errors:", raw.slice(0, 2000));
  res.json({ received: true });
});
```

---

### Info

#### IN-01: `key={i}` — array index used as React key on title list items

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:159`

**Issue:** Using array index as a React key causes React to reuse the existing DOM node when items are reordered or deleted. In a list with inputs (the edit form appears inline), this can produce stale values in controlled inputs and unexpected animation states. This is the standard documented React key anti-pattern.

**Fix:** Derive a stable key from content, or add a generated `id` field to `TitleConfig`:

```tsx
// Short-term: composite content key
key={`${title.text}-${title.startTimeMs}`}

// Better: add id to TitleConfig, generate on creation
// In handleAdd / handleStartEdit:
const title: TitleConfig = {
  id: crypto.randomUUID(),
  ...
};
// key={title.id} in the list
```

---

#### IN-02: `/api/diag` logs unsanitised user-controlled content — log injection risk

**File:** `services/remotion-studio/src/server.ts:103`

**Issue:** `console.log("[diag] Browser errors:", JSON.stringify(req.body, null, 2))` writes arbitrary authenticated-user-supplied content to stdout without size or content restrictions. Crafted payloads with embedded newlines or ANSI escape sequences can forge log lines or corrupt terminal output. Log aggregation pipelines (Datadog, Loki) that ingest multi-line JSON may misparse injected content.

**Fix:**

```typescript
const MAX_DIAG_SIZE = 2000;
const raw = JSON.stringify(req.body);
console.log("[diag] Browser errors:", raw.slice(0, MAX_DIAG_SIZE));
```

---

#### IN-03: `prev.style!` non-null assertion relies on a runtime invariant the type system does not enforce

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:285, 316, 332, 345, 357, 377, 393, 412, 432, 448, 465, 482`

**Issue:** `TitleConfig.style` is typed as `style?: TitleStyleProps` (optional). Twelve event handlers use `{ ...prev.style!, ... }` with a non-null assertion. In practice `newTitle.style` is always populated by `DEFAULT_TITLE_STYLE` in `resetForm` and `handleStartEdit`, so the assertion never fires at runtime. However, the type system allows `style` to be `undefined`, and if the initialisation logic ever changes, these assertions will silently spread `undefined` — producing `{ ...undefined }` which is an empty object in JavaScript, discarding all current style values.

**Fix:** Use the nullish coalescing spread instead of the assertion:

```typescript
style: { ...(prev.style ?? DEFAULT_TITLE_STYLE), entranceAnimation: anim.id }
```

---

#### IN-04: `textColor` legacy field and `titleColor`/`subtitleColor` create a dual-source style read

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx:342-354`

**Issue:** `TitleStyleProps` exposes both a legacy `textColor` field and the newer `titleColor` / `subtitleColor` fields. The editor reads these with a fallback (`titleColor ?? textColor`), but writes only to `titleColor` / `subtitleColor`. `DEFAULT_TITLE_STYLE` populates all three, keeping the duplication alive in every new title.

If a title loaded from the config has only `textColor` (saved by an older version of the code), the editor correctly displays it via the fallback, but on save only `titleColor` is written — the old `textColor` field persists in the config as a ghost value alongside the newly-written `titleColor`. Over time configs accumulate stale `textColor` entries.

**Fix:** Remove `textColor` from `TitleStyleProps`, `DEFAULT_TITLE_STYLE`, and the editor fallback reads. Add a one-time migration in the GET `/api/config` response path to promote legacy `textColor` to `titleColor`/`subtitleColor` for existing configs.

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
