---
status: partial
phase: 24-named-config-profiles
source: [24-VERIFICATION.md]
started: 2026-06-04T13:40:00Z
updated: 2026-06-04T13:40:00Z
---

## Current Test

[awaiting human testing — visual/browser sign-off only; all functional requirements PROFILE-01..04 already verified in code + empirical E2E]

## Tests

### 1. Save-as flow en el browser
expected: "Perfiles ▾" abre el popover inline (sin modal); el input recibe foco; "Guardar actual" crea el perfil + chip "✓ Perfil guardado"; aparece en la lista al instante
result: [pending]

### 2. Apply restaura el preview
expected: click en una fila de perfil → PUT apply → el preview (Player) refleja el config (subtítulos/títulos/overlays) al instante; chip "✓ Perfil aplicado"; fila activa con ✓
result: [pending]

### 3. Rename inline (✎)
expected: input inline con el nombre actual; Enter confirma y actualiza la fila; Esc cancela
result: [pending]

### 4. Delete inline (✕) con confirm de 2 pasos
expected: "¿Borrar? Sí/No"; "Sí" elimina la fila del DOM al instante; "No" cancela
result: [pending]

### 5. Trigger deshabilitado durante render
expected: con render en progreso (submitting/running) el trigger "Perfiles ▾" muestra opacity 0.5 + cursor not-allowed y no abre
result: [pending]

### 6. Green discipline visual
expected: exactamente UN elemento verde (--action) en pantalla = "▶ Render Video"; "Perfiles ▾" y botones del popover usan --accent/--danger, nunca verde
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

(ninguno — verificación funcional completa 9/9; estos ítems son confirmación visual opcional)

## Notes

Verificación funcional ya realizada esta sesión (evidencia en 24-VERIFICATION.md):
- Suites: studio 274, renderer 315 (sin regresión F23), api-server 89.
- E2E contra el container corriendo (loopback): save→list→apply (config activa en disco verificada)→rename→delete; path-traversal rechazado.
- PROFILE-04: perfil sobrevivió `docker compose build --force-recreate`.
- 22 tests de componente de ProfilesMenu cubren open/close, save, apply, rename, delete y green-discipline.
Para confirmar: abrí http://localhost:3123 (basic auth) y probá el control "Perfiles ▾" en el header.
