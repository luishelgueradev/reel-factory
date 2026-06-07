# Requirements — Milestone v1.5: Controles de edición pro del Studio

**Defined:** 2026-06-07
**Goal:** Madurar los controles de edición del Studio a nivel pro: guías de encuadre seguras para celular, resaltado de subtítulos tipo "bar" por palabra, panel de fuentes más ordenado, y metadata de redes generada para todas las plataformas a la vez.

> UI tooling no-negociable: toda fase de frontend DEBE invocar `impeccable` + `frontend-design` al inicio, y honrar el design system (`sketch-findings-reel-factory`, green-discipline). Sync studio↔renderer obligatorio para cambios que afecten el render.

## v1.5 Requirements

### Overlays — guía + edición (OVERLAY)

- [ ] **OVERLAY-01**: El usuario puede cargar un overlay-guía de zonas seguras (provisto por él) que se ve en el preview del Studio.
- [ ] **OVERLAY-02**: El overlay-guía queda excluido del render final (solo es ayuda visual de edición; no aparece en el MP4 generado).
- [ ] **OVERLAY-03**: El overlay-guía se distingue de los PNG normales: queda anclado/fijo (no se reordena en el layering) y marcado en la UI como guía no-renderizada.
- [ ] **OVERLAY-04**: El usuario puede editar el nombre de un overlay.
- [ ] **OVERLAY-05**: Mientras edita un overlay, su nombre se muestra como título de lo que se está editando.

### Subtítulos pro (SUB)

- [ ] **SUB-01**: En el estilo tiktok, el usuario puede activar un background "bar" por palabra en el highlight (fondo rectangular por palabra resaltada).
- [ ] **SUB-02**: El usuario puede configurar color, transparencia, redondez de bordes y padding del bar por palabra.
- [ ] **SUB-03**: El bar por palabra se aplica de forma idéntica en el preview del Studio y en el render final (sync studio↔renderer).
- [ ] **SUB-04**: El estilo karaoke se elimina de las opciones de subtítulos.

### UX de fuentes (FONT)

- [ ] **FONT-01**: La sección "sample text" aparece colapsada por default.
- [ ] **FONT-02**: La sección "browse fonts" aparece colapsada por default.

### Metadata multi-red (META)

- [ ] **META-05**: El usuario genera la metadata para todas las redes en una sola acción (no por red individual).
- [ ] **META-06**: Las redes se presentan en tabs (no en una lista desplegable).

## Future Requirements (deferred)

- Geometría de safe-area calculada/automática por plataforma (hoy el asset del overlay-guía lo provee el usuario).
- Múltiples overlays-guía / biblioteca de guías reutilizables.
- Bar background por palabra en estilos de subtítulo distintos a tiktok.
- Edición/preview en vivo de la metadata por red antes de copiarla.

## Out of Scope

- Estilo karaoke (se elimina; no se mantiene como opción legacy).
- Cálculo automático de zonas seguras por red — v1.5 usa el PNG-guía provisto por el usuario.
- Cambios al motor de render fuera de lo necesario para SUB-01..03 y OVERLAY-02.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OVERLAY-01 | Phase 27 | Pending |
| OVERLAY-02 | Phase 27 | Pending |
| OVERLAY-03 | Phase 27 | Pending |
| OVERLAY-04 | Phase 27 | Pending |
| OVERLAY-05 | Phase 27 | Pending |
| SUB-01 | Phase 28 | Pending |
| SUB-02 | Phase 28 | Pending |
| SUB-03 | Phase 28 | Pending |
| SUB-04 | Phase 28 | Pending |
| FONT-01 | Phase 29 | Pending |
| FONT-02 | Phase 29 | Pending |
| META-05 | Phase 29 | Pending |
| META-06 | Phase 29 | Pending |
