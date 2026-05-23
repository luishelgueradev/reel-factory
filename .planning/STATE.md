---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Infrastructure / shared services
status: executing
last_updated: "2026-05-23T00:43:46.932Z"
last_activity: 2026-05-23
progress:
  total_phases: 13
  completed_phases: 12
  total_plans: 51
  completed_plans: 50
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-05)

**Core value:** Transformar un video crudo de una persona hablando en un video dinamico para redes sociales con un solo comando API, eliminando silencios y agregando subtítulos automaticamente.
**Current focus:** Phase 15 — whisper-externalization

## Current Position

Phase: 15 (whisper-externalization) — EXECUTING
Plan: 2 of 3
Status: Ready to execute
Last activity: 2026-05-23 — Completed 15-01 (whisper-http-step container: HTTP client, 14 unit tests green)

### Phase 15 Decisions

- **15-01 NO_AUDIO_STREAM behavior change:** the new whisper-http-step FAILS on no-audio (400 NO_AUDIO_STREAM → error manifest + exit 1), vs the legacy whisper step which wrote an empty transcript and exited 0. Adopted to surface bad input instead of silently producing an empty transcript. FLAGGED for 15-03's parity test (the no-audio case is intentionally non-parity).

## Post-Phase Fixes (2026-05-19)

### Critical Bugs Fixed

1. **Font CSS family name mismatch** — Module names (e.g., `DancingScript`) don't match CSS `fontFamily` strings (e.g., `Dancing Script`). Added `getFontFamilyCSS()` to resolve. Affects 10 of 26 fonts.
2. **TitleOverlay temporal dead zone** — `const` declarations used before initialization caused Remotion Player ⚠️ error. Reordered declarations.
3. **Player controls invisible** — Added white color override CSS for dark background.
4. **Player container collapsed** — Replaced CSS `aspect-ratio` with JS-measured dimensions.
5. **Word highlight 1-frame overlap** — Changed `frame <= toFrame` to `frame < toFrame`.
6. **fontWeight layout shift** — Fixed at 700 for all states.
7. **Config not persisting** — Added `GET /api/config` fetch on mount.
8. **PIPELINE_CONFIG_PATH missing** — Added `resolveConfigPath()` local fallback.

### Feature Enhancements

1. **Title style editor** — 6 new controls: titleFontSize, subtitleFontSize, titleColor, subtitleColor, titleFontFamily, subtitleFontFamily, topOffset.
2. **8 new Google Fonts** — Sora, DancingScript, CormorantGaramond, DMSans, JosefinSans, Righteous, TitanOne.
3. **Smooth word highlight fade** — HIGHLIGHT_FADE_MS = 80ms transition.
4. **Dual font loading in TitleOverlay** — delayRender/continueRender for title + subtitle fonts.

### Key Files

- `services/remotion-studio/src/fonts.ts` → `services/remotion-renderer/src/fonts.ts`
- `services/remotion-studio/src/compositions/TitleOverlay.tsx` → `services/remotion-renderer/src/compositions/TitleOverlay.tsx`
- `services/remotion-studio/src/SubtitledVideo.tsx` → `services/remotion-renderer/src/SubtitledVideo.tsx`
- `services/remotion-studio/src/preview/PreviewPlayer.tsx`
- `services/remotion-studio/src/preview/PreviewApp.tsx`
- `services/remotion-studio/src/editor/components/TitleEditor.tsx`
- `services/remotion-studio/src/pipeline-config.ts` → `services/remotion-renderer/src/pipeline-config.ts`
- `services/remotion-studio/src/compositions/{TikTokLayout,BarLayout,KaraokeLayout,SentenceLayout}.tsx`
- `services/remotion-studio/src/compositions/shared-styles.ts`
- `services/remotion-studio/src/server.ts`
