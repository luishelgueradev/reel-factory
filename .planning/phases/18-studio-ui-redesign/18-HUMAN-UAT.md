---
status: partial
phase: 18-studio-ui-redesign
source: [18-VERIFICATION.md]
started: 2026-05-27T20:39:56Z
updated: 2026-05-27T20:39:56Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Two-column layout at root URL
expected: Single unified screen at http://localhost:3123/, no redirect to /editor, Titles tab active by default, left panel shows 9:16 video player, right panel shows TabBar
result: [pending]

### 2. Tab navigation and font selection
expected: All three tabs (Titles/Subtitles/Text) render correctly; font card click in Subtitles tab updates Player live
result: [pending]

### 3. Legacy route redirects in browser
expected: /editor, /preview, /preview/fonts each redirect to / and show StudioApp
result: [pending]

### 4. Browser console clean
expected: No React errors, no failed network requests in DevTools
result: [pending]

### 5. Save Config button
expected: Calls API and shows success banner ~2s
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
