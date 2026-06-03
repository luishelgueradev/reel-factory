---
quick_id: 260603-igq
type: quick
slug: guardar-config-saves-committed-state-not
description: "Guardar config persists the committed state, not the live preview — edits visible in the preview are lost on reload. Save what the preview shows."
files_modified:
  - services/remotion-studio/src/preview/PreviewApp.tsx
---

<objective>
"Guardar config" returns success but a browser refresh shows the PRE-save
version — edits are not persisted. Backend persistence is proven correct
(PUT→disk→GET all consistent on the same ACTIVE_PIPELINE_CONFIG_PATH). The bug
is client-side: the studio keeps TWO states and saves the wrong one.

Confirmed mechanism (PreviewApp.tsx + both editors):
- PreviewApp holds committed `titles`/`overlays` AND live `liveTitles`/`liveOverlays`.
- The Player preview renders from `liveTitles`/`liveOverlays` (L460-461).
- TitleEditor/OverlayEditor `handleDraftChange` (position/style edits) call ONLY
  `onPreviewChange` → update `liveTitles`/`liveOverlays` → preview updates. They
  commit to `onChange` (→ `titles`/`overlays`) ONLY when the user clicks the
  per-item "Guardar edición"/"Agregar" button.
- `handleSave` (L306-310, deps L331) serializes the COMMITTED `titles`/`overlays`.

So a position edit shows in the preview (live) but, unless the per-item edit was
explicitly committed, is absent from `titles`/`overlays` → "Guardar config" saves
the old version → reload shows the old version.

Fix (user-aligned): make "Guardar config" save WHAT THE PREVIEW SHOWS — serialize
`liveTitles`/`liveOverlays`, and reconcile committed state to match on success.
This naturally excludes blank drafts because `computeLiveTitles`/`computeLiveOverlays`
only include a NEW item once it has text / image data.
</objective>

<diagnosis_evidence>
- PreviewApp.tsx:212-214 — `liveTitles`/`liveOverlays` state.
- PreviewApp.tsx:290-297 — sync effects keep live = committed when not editing.
- PreviewApp.tsx:306-310,331 — handleSave payload `{subtitle, titles, overlays}`, deps `[subtitleConfig, titles, overlays]`.
- PreviewApp.tsx:460-461 — `<PreviewPlayer titles={liveTitles} overlays={liveOverlays} />`.
- PreviewApp.tsx:481,488-489 — TitleEditor `onChange=setTitles` / `onPreviewChange=setLiveTitles`; OverlayEditor onChange sets both, onPreviewChange sets live.
- TitleEditor.tsx:277-300 — `computeLiveTitles` includes a NEW draft only `if (addingNew && entry.text.trim())`; `handleDraftChange` calls only `onPreviewChange`.
- OverlayEditor.tsx:168-186 — symmetric; new draft joins preview only once it has image data.
- Verified backend: PUT fontSize=51 → disk=51 → GET=51 (persistence is NOT the bug).
</diagnosis_evidence>

<tasks>

<task type="auto">
  <name>Task 1: Save the live preview state and reconcile committed on success</name>
  <files>services/remotion-studio/src/preview/PreviewApp.tsx</files>
  <read_first>
    - services/remotion-studio/src/preview/PreviewApp.tsx (handleSave L300-331; liveTitles/liveOverlays state L212-214; sync effects L290-297; PreviewPlayer wiring L460-461)
  </read_first>
  <behavior>
    - After editing a title or overlay position (visible in the preview) and clicking "Guardar config", a browser refresh shows the EDITED version (it persisted).
    - When nothing is being edited, behavior is unchanged (live === committed via the sync effects).
    - Blank/incomplete NEW drafts are NOT saved (the live-compute helpers already exclude a new item until it has text / image data).
  </behavior>
  <action>
    In `handleSave` (PreviewApp.tsx):
    1. Build the payload from the LIVE state instead of committed:
       `const payload = { subtitle: subtitleConfig, titles: liveTitles, overlays: liveOverlays };`
    2. Update the `useCallback` dependency array to `[subtitleConfig, liveTitles, liveOverlays]` (replace the committed `titles`/`overlays` deps) so the closure always serializes the current preview.
    3. On a successful save (`res.ok`), reconcile committed state to the saved live state:
       `setTitles(liveTitles); setOverlays(liveOverlays);`
       This is REQUIRED — otherwise `computeLiveTitles`/`computeLiveOverlays` (which rebuild from committed `titles`/`overlays` and only replace the currently-edited index) would revert a previously-saved-but-uncommitted item when the user next edits a different item.
    4. Do NOT change the editors, the validator, or the save endpoint. Do NOT change the success/error UI.
  </action>
  <verify>
    <automated>cd services/remotion-studio && npm run build:editor</automated>
    <automated>cd services/remotion-studio && npx vitest run</automated>
    <manual>Live Studio (port 3123, Chrome): move a title with a preset (don't click the per-item "Guardar edición"), click "Guardar config", refresh — the title stays in the new position. Repeat for an overlay. Confirm a successful save still shows "✓ Guardado recién".</manual>
  </verify>
  <acceptance_criteria>
    - handleSave serializes `liveTitles`/`liveOverlays` (grep: payload uses live state).
    - useCallback deps are `[subtitleConfig, liveTitles, liveOverlays]`.
    - On success, committed `titles`/`overlays` are set to the live state.
    - `npm run build:editor` exits 0; studio vitest green.
    - No changes to editors/validator/endpoint/UI styling.
  </acceptance_criteria>
  <done>"Guardar config" persists exactly what the preview shows; reload no longer reverts edits.</done>
</task>

</tasks>

<constraints>
- Single file: services/remotion-studio/src/preview/PreviewApp.tsx. Do NOT touch the editors, server.ts, or the validator.
- This is a state-wiring correctness fix — no visual/UI changes, no new colors/layout.
- Commit atomically: `fix(260603-igq): save live preview state in Guardar config so edits persist`.
- Do NOT commit docs (SUMMARY/STATE/PLAN) — orchestrator handles them. Do NOT touch ROADMAP/STATE.
- REQUIRED ORDER: write SUMMARY.md → commit code → narration last.
</constraints>

<success_criteria>
- Edits visible in the preview persist after "Guardar config" + reload.
- Build exits 0; studio vitest green; no visual regressions; editors untouched.
</success_criteria>

<output>
Create `.planning/quick/260603-igq-guardar-config-saves-committed-state-not/260603-igq-SUMMARY.md` when done.
</output>
