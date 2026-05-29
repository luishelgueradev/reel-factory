---
quick_id: 260529-mxw
status: complete
commit: 7fc205a
date: 2026-05-29
---

# Summary: fix title/position controls not reflecting in remotion live preview

## Root Cause

`TitleEditor` kept all edit state in local `newTitle` useState. The parent's `titles` array (and thus the preview) only updated on "Save Changes" or "Add Title" — not on every field change. Subtitle controls worked reactively because they call `updateSubtitle` directly on change.

## Fix

Two files changed:

**TitleEditor.tsx:**
- Added `onPreviewChange?: (liveTitles: TitleConfig[]) => void` prop
- Added `computeLiveTitles(draft)` — merges draft into committed titles (replaces editing index, or appends if adding new with non-empty text)
- Added `handleDraftChange(updater)` — updates local state + calls `onPreviewChange` with computed live titles
- All `setNewTitle((prev) => ...)` calls replaced with `handleDraftChange((prev) => ...)` (20+ occurrences — every control)
- Save/Add: call `onPreviewChange?.(updated)` before resetForm so preview shows committed state
- Cancel: call `onPreviewChange?.(titles)` before resetForm to revert preview to committed state

**PreviewApp.tsx:**
- Added `liveTitles` state (separate from committed `titles`)
- `useEffect` syncs `liveTitles = titles` when committed state changes (fetch, save, delete)
- PreviewPlayer now receives `liveTitles` instead of `titles`
- TitleEditor receives `onPreviewChange={setLiveTitles}`

## Verification (playwright)

- Opened studio at localhost:3123
- Clicked Edit on "LA VIDRIERA" title
- Changed X from 200 → 600: DOM immediately updated `left: 55.56%` WITHOUT clicking Save ✓
- Switched animation to "None": title appeared instantly in preview at full opacity ✓
- Confirmed all 3 existing titles rendered in the Remotion Player DOM

## Extra Finding

Titles with slide-up/fade-in animation are invisible at frame 0 (opacity=0 is correct behavior — it's the start of the entrance animation). They become visible when the player plays. This is NOT a bug.
