---
status: complete
phase: 05-remotion-animated-subtitles
source: [05-04-SUMMARY.md, 05-05-SUMMARY.md]
started: 2026-05-12T00:00:00Z
updated: 2026-05-27T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sincronización y coloreo de subtítulos
expected: Los subtítulos se colorean palabra por palabra (estilo TikTok) y se mantienen sincronizados con el audio durante todo el video, sin drift progresivo.
result: pass

### 2. Validación defensiva de timestamps imposibles
expected: El pipeline rechaza tokens con fromMs > toMs. validateCaptionPages detecta y reporta errores SUBT-03 para timestamps imposibles.
result: pass
note: "Resuelto 2026-05-27. Cobertura de tests unitarios confirmada y ejecutada: validate.test.ts describe \"validateCaptionPages: impossible timestamps (fromMs > toMs)\" (3 tests, todos pasan). Verifican que validateCaptionPages devuelve error con SUBT-03/fromMs/toMs cuando fromMs > toMs, pasa cuando fromMs <= toMs, e identifica el token específico (page[1].tokens[0]). Es validación interna sin observable de UI — la cobertura unitaria satisface el criterio."

### 3. Pipeline config: SILENCE_CUTS_PATH no se pasa a remotion-renderer
expected: process.sh NO pasa SILENCE_CUTS_PATH al container remotion-renderer. Hay un comentario explicando por qué.
result: pass
note: "Obsoleto / resuelto-por-supersesión 2026-05-27. La premisa de este test (Whisper corre sobre el video YA cortado, por lo tanto el renderer no debe remapear) fue revertida en Phase 15 (whisper externalization). Ahora Whisper corre sobre el video ORIGINAL (Step 1, antes del corte) y emite timeline:\"original\", así que los timestamps SÍ deben remapearse contra silence-cuts.json en el renderer. process.sh:110-112 pasa SILENCE_CUTS_PATH a remotion-renderer DELIBERADAMENTE, con un comentario (process.sh:107-109) explicando por qué y notando que coincide con el api-server orchestrator. El comportamiento actual es el correcto; la expectativa del test quedó stale."

### 4. Tests unitarios pasan
expected: Los tests unitarios pasan sin regresiones.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[resolved 2026-05-27 — el único gap (Test 3) quedó obsoleto por supersesión en Phase 15]

- truth: "process.sh NO pasa SILENCE_CUTS_PATH al container remotion-renderer, con un comentario explicando por qué"
  status: superseded
  resolution: "Phase 15 (whisper externalization) revirtió la premisa. Whisper ahora corre sobre el video ORIGINAL y emite timeline:\"original\", por lo que el renderer DEBE remapear contra silence-cuts.json. process.sh:110-112 pasa SILENCE_CUTS_PATH deliberadamente, con comentario en process.sh:107-109. El comportamiento actual es el correcto; la expectativa original quedó stale."
  severity: major
  test: 3