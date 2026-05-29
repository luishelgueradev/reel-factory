---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: — Studio redesign + visual capabilities
status: completed
last_updated: "2026-05-29T16:44:36.980Z"
last_activity: 2026-05-29 -- Phase 20 marked complete
progress:
  total_phases: 19
  completed_phases: 18
  total_plans: 67
  completed_plans: 68
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-05)

**Core value:** Transformar un video crudo de una persona hablando en un video dinamico para redes sociales con un solo comando API, eliminando silencios y agregando subtítulos automaticamente.
**Current focus:** Phase 20 — title-block-precision

## Current Position

Phase: 20 — COMPLETE
Plan: 4 of 4
Status: Phase 20 complete
Last activity: 2026-05-29 -- Phase 20 marked complete

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260527-i3v | Fix google-fonts loadFont signature bug (all fonts fell back to monospace in preview + renders) | 2026-05-27 | c3b6a1c | [260527-i3v-fix-google-fonts-loadfont-signature-bug](./quick/260527-i3v-fix-google-fonts-loadfont-signature-bug/) |
| 260529-mxw | fix title/position controls not showing in remotion live preview | 2026-05-29 | 7fc205a | [260529-mxw-fix-title-position-controls-not-showing-](./quick/260529-mxw-fix-title-position-controls-not-showing-/) |
| 260529-sub | fix fontWeight/fontStyle/outerGlow silently dropped in SubtitledVideo and renderer Root — styles never applied | 2026-05-29 | bee3723 | [260529-sub-subtitle-style-fields-not-passed-through](./quick/260529-sub-subtitle-style-fields-not-passed-through/) |

### Phase 15 Decisions

- **15-01 NO_AUDIO_STREAM behavior change:** the new whisper-http-step FAILS on no-audio (400 NO_AUDIO_STREAM → error manifest + exit 1), vs the legacy whisper step which wrote an empty transcript and exited 0. Adopted to surface bad input instead of silently producing an empty transcript. FLAGGED for 15-03's parity test (the no-audio case is intentionally non-parity).
- **15-02 GPU plumbing removed (D-4):** the whisper-only NVIDIA `DeviceRequests` block (orchestrator.ts) and the compose `deploy.resources.devices` GPU stanza were grep-confirmed whisper-only and removed; the external whisper-api owns the GPU. Reachability is now via `host.docker.internal:host-gateway` (D-3). STEP name + `whisper/transcript.json` path unchanged → zero downstream change. 15-03 must verify live host.docker.internal reachability before retiring `services/whisper/`.
- **15-03 externalization VERIFIED + services/whisper retired:** timeline=`"original"` marker added in the EXTERNAL whisper repo (`/home/luis/proyectos/whisper` @ `00bceb2`) — deterministic renderer remap fired (`timestamps_already_remapped=false` on 8 cuts). Parity old-vs-new passed: 76=76 words, 0.000s max delta, no_speech_prob on all, model whisperx-large-v3 both sides. Human-verified back-half highlight sync on an 8-mid-speech-cut clip → deferred Spike 001 drift repro CLOSED. `services/whisper/` deleted (D-5 gate satisfied); pipeline runs on the HTTP step only.
- **15-03 DEFERRED (new phase — NOT whisper regressions):** (A) Studio config not applied — renderer fell back to env defaults because `ACTIVE_PIPELINE_CONFIG_PATH` (`/data/pipeline/pipeline-config.json`) is never populated (v1.1 wired the consumer, not the producer). (B) Subtitle flicker — empty inter-page caption gaps (20–241ms) + FADE_OUT_MS=300/FADE_IN_MS=100 cause ~15 fade-out/in cycles over 36s, amplified by the wrong layout fallback from (A). Both are render-path bugs, do NOT affect transcript parity, and were moved out of Phase 15. See 15-03-SUMMARY "Deferred / out-of-scope".

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

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
