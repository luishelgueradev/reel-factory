---
quick_id: 260529-mxw
slug: fix-title-position-controls-not-showing-
description: "fix title/position controls not showing in remotion live preview"
date: 2026-05-29
status: in_progress
---

# Quick Task 260529-mxw: Fix title controls not reflecting in live preview

## Root Cause

`TitleEditor` keeps edit state in local `newTitle` (useState). Parent `titles` (and thus the preview) only updates when the user clicks "Save Changes" or "Add Title". Subtitle controls work because they call `updateSubtitle` on every change (directly updates parent state). Title controls don't.

## Fix

Add a live-preview path via `onPreviewChange` callback.

### Task 1: TitleEditor — emit draft on every field change

**File:** `services/remotion-studio/src/editor/components/TitleEditor.tsx`

Changes:
1. Add `onPreviewChange?: (liveTitles: TitleConfig[]) => void` to `TitleEditorProps`
2. Add `computeLiveTitles(draft)` helper (merges draft into committed titles)
3. Add `handleDraftChange(updater)` helper (updates `newTitle` + calls `onPreviewChange`)
4. Replace all `setNewTitle((prev)` calls with `handleDraftChange((prev)` (replace_all)
5. In `handleSaveEdit`: call `onPreviewChange?.(updated)` before `resetForm()`
6. In `handleAdd`: call `onPreviewChange?.(updated)` before `resetForm()`
7. Cancel button: call `onPreviewChange?.(titles)` before `resetForm()`
8. In `handleRemove` (shifted index path): recompute and emit draft at new index

### Task 2: PreviewApp — wire live preview

**File:** `services/remotion-studio/src/preview/PreviewApp.tsx`

Changes:
1. Add `const [liveTitles, setLiveTitles] = useState<TitleConfig[]>([]);`
2. Add `useEffect(() => { setLiveTitles(titles); }, [titles]);` — syncs committed → live when not editing
3. Pass `liveTitles` to `<PreviewPlayer titles={liveTitles} />`
4. Pass `onPreviewChange={setLiveTitles}` to `<TitleEditor />`

### Task 3: Build editor + verify

```bash
cd services/remotion-studio && npm run build:editor
```

Check for TypeScript errors. Verify the studio server compiles cleanly.

## Verification

- Open studio at localhost:3123
- Add a title overlay, observe it in preview
- Change X/Y, see title move in preview WITHOUT clicking Save
- Change font size, border radius — preview updates live
- Click Save Changes — committed, form closes
- Click Cancel — preview reverts to committed state
