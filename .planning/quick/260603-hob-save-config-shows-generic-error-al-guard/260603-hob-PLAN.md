---
quick_id: 260603-hob
type: quick
slug: save-config-shows-generic-error-al-guard
description: "Guardar config shows a hardcoded '✕ Error al guardar' that hides the real validation error — surface the actual PUT /api/config errors"
files_modified:
  - services/remotion-studio/src/preview/PreviewApp.tsx
---

<objective>
"Guardar config" fails and the UI shows a hardcoded "✕ Error al guardar" that
hides WHY. Root cause confirmed by curl round-trip: PUT /api/config returns
400 `{ error: "Invalid config", errors: [ ...field messages... ] }` when the
edited config fails `validatePipelineConfig` (e.g. `titles[1].style.x must be a
non-negative number`, `titleFontSize must be between 8 and 200`, `padding must
be between 0 and 100`). The on-disk config round-trips 200, so the failure is a
specific edited value.

Two real defects in PreviewApp.tsx hide that:
1. `handleSave` (L318-321) reads only `errData.error` ("Invalid config" — generic),
   ignoring `errData.errors` (the array naming the exact field).
2. The error badge (L368-378) renders a FIXED string "✕ Error al guardar" and
   ignores the `saveError` state entirely.

This task makes the real error visible so the user (and we) can see exactly which
field/value is invalid. It does NOT change the validator or the editors — once
the field is visible, the underlying invalid value is fixed in a follow-up.
</objective>

<diagnosis_evidence>
- server.ts:153-163 — PUT returns 400 with `{ error: "Invalid config", errors: validation.errors }`.
- PreviewApp.tsx:300-331 — handleSave; L319 `errData.error` only; L327 sets saveError.
- PreviewApp.tsx:368-378 — badge shows hardcoded "✕ Error al guardar", ignores saveError.
- Confirmed: GET then PUT of the on-disk config returns 200 (base save path works).
</diagnosis_evidence>

<tasks>

<task type="auto">
  <name>Task 1: Surface the real validation errors in the save badge</name>
  <files>services/remotion-studio/src/preview/PreviewApp.tsx</files>
  <read_first>
    - services/remotion-studio/src/preview/PreviewApp.tsx (handleSave L300-331; saveError state; error badge L368-378; header layout/space constraints)
    - .claude/skills/ sketch-findings-reel-factory SKILL.md — "error/failure states (inline-at-source)" pattern, to keep the surfaced error consistent with the design language
  </read_first>
  <behavior>
    - When PUT /api/config returns 400 with `errors: [...]`, the badge must show the REAL message(s), not the fixed string.
    - When the response has `errors` (array), join/show them (e.g. first message + "(+N más)" if multiple), and expose the full list via a `title` tooltip so the header stays compact.
    - When there is no structured error (network failure, non-JSON), fall back to the existing generic text.
  </behavior>
  <action>
    1. In `handleSave`, when `!res.ok`, parse the JSON and prefer the detailed errors:
       build the thrown message from `errData.errors` (a string[] of field messages) when present — e.g. `errData.errors.join("; ")` — falling back to `errData.error`, then `Save failed: ${res.status}`. So `saveError` carries the real field message(s).
    2. In the error badge (L368-378), render the actual `saveError` value instead of the hardcoded "✕ Error al guardar". Prefix with "✕ ". Keep the existing danger styling/pill. To respect the compact header: show the first message (or a truncated single line) in the badge text, and put the full `saveError` string in the element's `title` attribute (hover tooltip). Keep it a single line — do not break the header layout.
    3. Do NOT change colors/layout otherwise; this is the existing inline error affordance, now showing real content (color law unchanged — danger token stays).
  </action>
  <verify>
    <automated>cd services/remotion-studio && npm run build:editor</automated>
    <manual>In the live Studio (port 3123, Chrome): trigger a failing save and confirm the badge now shows the real validation message (e.g. a `titles[...]` / `subtitle...` field error), with the full list on hover. A successful save still shows "✓ Guardado recién".</manual>
  </verify>
  <acceptance_criteria>
    - The badge no longer shows a hardcoded "✕ Error al guardar"; it shows the real `saveError` content.
    - `handleSave` incorporates `errData.errors` (the field-level array) into the message.
    - `npm run build:editor` exits 0.
    - studio vitest still green (`npx vitest run`).
    - No styling/color regressions; the header stays single-line.
  </acceptance_criteria>
  <done>Save failures show the actual validating field message inline (full list on hover); build green.</done>
</task>

</tasks>

<constraints>
- EDITOR-ONLY, single file (services/remotion-studio/src/preview/PreviewApp.tsx). Do NOT touch server.ts, the validator, or the editor components.
- This touches a visible UI element (the error badge): keep it consistent with the existing danger pill and the sketch-findings inline-error pattern — no new colors, no layout breakage. If a larger visual treatment seems needed, keep it minimal and note it; do not improvise a redesign.
- Commit atomically: `fix(260603-hob): surface real save validation errors in Guardar config badge`.
- Do NOT commit docs artifacts (SUMMARY/STATE/PLAN) — orchestrator handles those. Do NOT touch ROADMAP/STATE.
- REQUIRED ORDER: write SUMMARY.md → narration last.
</constraints>

<success_criteria>
- Save failures display the real validation error inline (which field/value), full list on hover.
- Build exits 0; studio vitest green; no visual regressions.
</success_criteria>

<output>
Create `.planning/quick/260603-hob-save-config-shows-generic-error-al-guard/260603-hob-SUMMARY.md` when done.
</output>
