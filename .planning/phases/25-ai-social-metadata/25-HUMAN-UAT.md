---
status: partial
phase: 25-ai-social-metadata
source: [25-VERIFICATION.md]
started: 2026-06-04T22:25:00Z
updated: 2026-06-04T22:25:00Z
---

## Current Test

[awaiting human visual sign-off only — META-01..04 verified in code + REAL E2E against the local-llms router]

## Tests

### 1. Flujo completo en el browser
expected: tras un render, en col3 "Metadata de redes" elegís plataforma+tono → "Generar metadata" → aparecen Título/Descripción/Hashtags; estados generating (shimmer/spinner) y generated se ven bien
result: [pending]

### 2. Copiar cada campo
expected: el botón de copiar de cada campo escribe ese campo al clipboard (permiso del browser) y muestra el chip "✓ Copiado"
result: [pending]

### 3. Green discipline visual
expected: "Generar/Regenerar" y selectores se ven en --accent (azul), nunca verde; el único verde sigue siendo Render/Guardar config
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

(ninguno bloqueante — verificación funcional 9/9 + E2E real)

## Notes

- **E2E real ya ejecutado** contra tu router local-llms (gpt-oss:120b / big-cloud): POST /api/metadata → 200 en 4.4s, título faithful "¡Mira este efecto fantasmagórico!", descripción + hashtags válidos; GET restaura lo persistido; regenerar con otra plataforma/tono da salida distinta (META-04); metadata.json persistido.
- Suites: studio 373, renderer 315, api-server 89.
- **Config:** dejé `METADATA_API_KEY` (= tu ROUTER_BEARER_TOKEN) y `METADATA_MODEL=big-cloud` en `reel-factory/.env` (gitignored). Para usar Qwen local/privado: cambiá `METADATA_MODEL=chat-local` y recreá el studio — sin tocar código.
- Polish menor pendiente (no requisito): propagar `_meta.backend` al response (hoy solo `_meta.model`); el chip muestra el alias del modelo, que ya distingue cloud vs local.
- Para verificar: abrí http://localhost:3123 (basic auth), hacé un render corto, y probá el panel "Metadata de redes" en la columna derecha.
