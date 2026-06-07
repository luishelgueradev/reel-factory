# Phase 29: UX de fuentes + Metadata multi-red - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — autonomous overnight run)

<domain>
## Phase Boundary

Two independent Studio UX improvements:
1. **Fonts UX (FONT-01/02):** the "sample text" section and the "browse fonts" section are COLLAPSED by default (expandable on demand).
2. **Metadata multi-red (META-05/06):** the social metadata is generated for ALL networks in ONE action (not per-network), and the networks are presented as TABS instead of a dropdown.

Requirements: FONT-01 (sample text collapsed by default), FONT-02 (browse fonts collapsed by default), META-05 (generate metadata for all networks at once), META-06 (networks as tabs, not dropdown).
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (with steers from codebase exploration)

- **FONT-01/02 (fonts UX):** both sections live in `services/remotion-studio/src/preview/PreviewApp.tsx`:
  - "browse fonts" = the font specimen/list block (~line 215-225, `AVAILABLE_FONTS.filter(...).map(...)`).
  - "sample text" = the sample-text `<TextareaInput>` block (~line 874, "Sample text textarea — MUST stay at top").
  Wrap each in a collapsible section (a small reusable disclosure — reuse the existing collapsible idiom if one exists, e.g. the FxBlock pattern in StyleControls, or a lightweight local `<details>`-style toggle consistent with sketch-findings). Default state = COLLAPSED for both. Persisting the open/closed state across reloads is optional (nice-to-have, not required). Keep the sample-text data flow intact (sampleText → textToCaptionPages → PreviewPlayer).
  - NOTE the comment at line 874 says sample text "MUST stay at top" — keep it at the top of its column; collapsing ≠ moving. Just make the body collapsible with a header toggle.

- **META-05 (generate all networks at once):** there are 3 PLATFORMS in `services/remotion-studio/src/metadata.ts`: `tiktok` (TikTok), `instagram` (Instagram Reels), `youtube_shorts` (YouTube Shorts). Today `MetadataPanel.tsx` generates ONE platform via `POST /api/metadata { jobId, platform, tone }`. Change to generate for all 3 in one action:
  - Preferred: add a server batch path — either a new `POST /api/metadata/all { jobId, tone }` that loops PLATFORMS server-side and returns `{ results: { tiktok: {...}, instagram: {...}, youtube_shorts: {...} } }`, OR have the client fire the 3 existing per-platform requests in parallel (`Promise.all`). Either is acceptable; a single batch endpoint is cleaner and keeps one round-trip. Reuse the existing `generateMetadata()` + router client. Handle partial failure gracefully (show which platform failed, keep the others).
  - The single primary action becomes "Generar metadata (todas las redes)".

- **META-06 (tabs, not dropdown):** replace the platform `<select>` dropdown in `MetadataPanel.tsx` with a TAB strip (one tab per platform: TikTok / Instagram Reels / YouTube Shorts). After a single generate-all, each tab shows that platform's editable title/description/hashtags + copy buttons. The tone control stays (still a single tone select applied to all). Honor green-discipline: Generar uses --accent (NOT --action green); tabs use accent for the active tab.

### Constraints (LOCKED)
- UI tooling non-negotiable: invoke `impeccable` + `frontend-design` at execute start; honor `sketch-findings-reel-factory` (the AI-metadata-column + tabs idioms, header-action-zone) + green-discipline (--action green = Render CTA ONLY; Generar/copy/tabs use --accent).
- This is STUDIO/preview-only + server (metadata endpoint). NO renderer changes, NO renderer sync, NO composition changes.
- Studio is Docker-baked; live UAT (docker compose build/up) is a MANUAL user follow-up. Executors must pass `npm run build:editor` + the studio vitest suite (currently 506). The metadata endpoint change must keep `metadata-panel.test.tsx` green (update it for the new all-networks + tabs flow).
- Keep the existing metadata states (empty/ready/generating/generated/error) coherent in the tabbed UI.
</decisions>

<code_context>
## Existing Code Insights

- Metadata UI: `services/remotion-studio/src/preview/MetadataPanel.tsx` (+ `metadata-panel.test.tsx`). Platform dropdown ~L263, tone select ~L305, Generar ~L331, result fields ~L436.
- Metadata domain: `services/remotion-studio/src/metadata.ts` — `PLATFORMS` (tiktok / instagram / youtube_shorts), `TONES`, `generateMetadata()`, prompt builder.
- Metadata endpoint: `services/remotion-studio/src/server.ts` `POST /api/metadata` (~L684) — validates jobId/platform/tone, reads transcript, calls generateMetadata via router client.
- Fonts UX: `services/remotion-studio/src/preview/PreviewApp.tsx` — font specimen list (~L215) and sample-text textarea (~L874). `AVAILABLE_FONTS` from `../fonts`.
- Collapsible idiom precedent: `FxBlock` in `services/remotion-studio/src/editor/components/StyleControls.tsx` (used for title/subtitle effect sections).
- Tests: studio vitest (currently 506). No renderer impact.
</code_context>

<specifics>
## Specific Ideas

User intent: stop generating metadata per individual network (tedious); one click generates for all networks; switch between networks with tabs (not a dropdown). And declutter the fonts area — sample text and the font browser shouldn't be expanded taking space by default.
</specifics>

<deferred>
## Deferred Ideas

- Live per-network preview/edit before copy beyond what exists (Future Requirements).
- Persisting collapse state across reloads (optional nice-to-have).
</deferred>
