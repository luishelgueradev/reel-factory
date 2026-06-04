---
phase: 25-ai-social-metadata
plan: "01"
subsystem: remotion-studio/metadata-core
tags: [pure-module, zod, vitest, ai-metadata, no-network]
dependency_graph:
  requires: []
  provides: [metadata-core]
  affects: [services/remotion-studio/src/metadata.ts]
tech_stack:
  added: []
  patterns: [injectable-client, pure-module-first, zod-schema-validate]
key_files:
  created:
    - services/remotion-studio/src/metadata.ts
    - services/remotion-studio/src/metadata.test.ts
  modified: []
decisions:
  - "MetadataSchema description max set to 5000 (youtube_shorts limit) not 2200 — per-platform enforcement done in sanitizeMetadata before schema runs"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-04T22:01:38Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 25 Plan 01: AI Social Metadata Core Summary

Pure, injectable metadata core module: transcript→platform/tone prompt, zod-validated output with per-platform caps + hashtag hygiene, injectable ChatClient pattern, single corrective retry — 59 unit tests, all green, zero network calls.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | metadata.ts pure core | e0d76d0 | services/remotion-studio/src/metadata.ts |
| 2 | metadata.test.ts unit proofs | 70c0faa | services/remotion-studio/src/metadata.test.ts, metadata.ts (schema fix) |

## What Was Built

### metadata.ts (385 lines)

Pure, framework-free TypeScript module with:

- **`PLATFORMS`** — tiktok, instagram, youtube_shorts each with `label`, `descMaxChars`, `hashtagStyle`, `notes`.
- **`TONES`** — cercano, profesional, llamativo each with `label`, `guidance`.
- **`extractTranscriptText(transcript, maxChars=8000)`** — joins `segments[].text`, collapses whitespace, head+tail truncation at budget (60% head / 40% tail), falls back to `.text`, never throws on malformed.
- **`detectLanguage(transcript)`** — reads `transcript.language`, defaults `"es"`.
- **`buildSystemPrompt({platform, tone, language})`** — role + HARD rules (faithfulness, output language, JSON-only) + platform spec (descMaxChars, hashtagStyle, notes) + tone guidance.
- **`MetadataSchema`** (zod) — `title: min(1)..max(120)`, `description: min(1)..max(5000)`, `hashtags: array(regex /^#[\p{L}0-9_]+$/u) min(1)..max(12)`.
- **`sanitizeMetadata(raw, platform)`** — trims title, truncates description to `platform.descMaxChars`, sanitizes hashtags (add leading `#`, drop malformed, case-insensitive dedup, cap at 8), runs zod schema, throws `MetadataValidationError` if unrecoverable.
- **`ChatClient` type** — `(args: {system, user}) => Promise<string>` — injected, no fetch.
- **`generateMetadata({transcript, platform, tone, client})`** — extract text (throw `EmptyTranscriptError` if empty), detect language, build prompt, call client, JSON.parse, sanitize; ONE corrective retry on failure, then throw `MetadataValidationError`.
- **Error classes** — `EmptyTranscriptError`, `MetadataValidationError`.

### metadata.test.ts (485 lines, 59 tests)

Vitest unit tests with mock `ChatClient` (zero network):

- `extractTranscriptText` — 10 cases (join, truncation, malformed, fallback)
- `detectLanguage` — 5 cases (language field, defaults, whitespace trim)
- `buildSystemPrompt` — 8 cases (per-platform, per-tone, language, max chars in prompt)
- `MetadataSchema` — 8 cases (valid/invalid title/desc/hashtags, unicode support)
- `sanitizeMetadata` — 11 cases (trim, cap ≤8, dedup, drop malformed, add #, truncate desc, per-platform limits, error cases)
- `generateMetadata` — 11 cases (happy path, system prompt content, retry, double-invalid, empty transcript x3, English transcript, sanitize in happy path, sanitize-fail → retry)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MetadataSchema description max(2200) conflicts with youtube_shorts (5000)**

- **Found during:** Task 2 — test "applies youtube_shorts descMaxChars (5000) separately" failed because MetadataSchema had `max(2200)` but youtube_shorts supports 5000 chars.
- **Issue:** AI-SPEC §4b gives `max(2200)` as the schema cap, but `PLATFORMS.youtube_shorts.descMaxChars = 5000`. After `sanitizeMetadata` truncates to `descMaxChars` (5000 for shorts), the zod `max(2200)` would then reject valid youtube_shorts output.
- **Fix:** MetadataSchema description max raised to 5000 (the highest platform limit). Per-platform 2200 enforcement for tiktok/instagram still runs in `sanitizeMetadata` BEFORE zod validation — the schema only catches truly unbounded model output. Updated the related test to test the correct cap (5001 chars fail, not 2201).
- **Files modified:** `metadata.ts` (schema), `metadata.test.ts` (test description updated)
- **Commit:** 70c0faa

## Known Stubs

None. This module is pure logic with no UI rendering or data sources.

## Threat Flags

No new network endpoints, auth paths, or trust boundaries introduced. The module is pure logic; the ChatClient is injected — network wiring happens in plan 25-02.

## Self-Check: PASSED

- [x] `services/remotion-studio/src/metadata.ts` exists
- [x] `services/remotion-studio/src/metadata.test.ts` exists
- [x] Commit e0d76d0 exists in git log
- [x] Commit 70c0faa exists in git log
- [x] 59 tests pass, 0 fail (`npx vitest run src/metadata.test.ts`)
- [x] No metadata.ts TypeScript errors (`tsc --noEmit | grep metadata.ts`)
