# Video Pipeline Docker

## What This Is

Un pipeline de procesamiento de video containerizado en Docker que toma un MP4 como entrada, lo procesa automáticamente (transcripción con Whisper, corte de silencios, subtítulos dinámicos con Remotion) y genera videos optimizados para redes sociales en formato vertical 9:16. Sirve todo via API REST con capacidad de procesamiento individual y por lotes. Cada paso del pipeline es independiente e inspeccionable, permitiendo revisar salidas intermedias antes de continuar.

## Core Value

Transformar un video crudo de una persona hablando en un video dinámico para redes sociales con un solo comando API, eliminando silencios y agregando subtítulos automáticamente.

## Current Milestone: v1.1 Calidad de video

**Goal:** Mejorar considerablemente la calidad y definición de los videos de salida, cerrando la brecha visual con los reels de Instagram.

**Target features:**
- Investigación (research-first): causas de baja nitidez del render (Remotion `scale`/supersampling, re-encode H.264 múltiple, bitrate/CRF, anti-aliasing de texto) y opciones de super-resolución/upscaling (Real-ESRGAN u otros, denoise, sharpening, tradeoffs)
- Mejoras de nitidez del render de subtítulos y video, guiadas por la investigación
- Aumento de definición más allá de la cámara del móvil vía upscaling

**Key context:** v1.0 completo (12 fases). Auditoría 2026-05-20 detectó causas probables de baja nitidez: `renderMedia` sin `scale`, triple re-encode (silence-cutter→finalizer→renderer), bitrate/CRF sin tunear. Arrancar por la fase de investigación antes de implementar.

## Requirements

### Validated

- [x] Pipeline Docker que recibe un MP4 y genera video procesado en 9:16 (Validated in Phase 1)
- [x] Cada paso del pipeline genera salida intermedia inspeccionable (Validated in Phase 1)
- [x] Arquitectura extensible: nuevos pasos se agregan como containers Docker en la secuencia (Validated in Phase 1)

### Active

- [ ] Intro/outro animados con plantillas Remotion
- [x] Zooms automáticos y jump cuts visuales en momentos clave (Validated in Phase 07)
- [ ] B-roll automático con placeholders (infraestructura lista, clips reales después)

### Validated (continued)

- [x] Transcripción automática con Whisper (texto con timestamps) (Validated in Phase 02)
- [x] Detección y corte de silencios (eliminar y juntar, sin transiciones) (Validated in Phase 03)
- [x] Subtítulos dinámicos estilo word-by-word con Remotion (Validated in Phase 05)

### Out of Scope

- B-roll con biblioteca propia o APIs externas (Pexels/Pixabay) — v1 usa placeholders
- Transiciones suaves en cortes de silencio — se elimina y junta directo
- Formatos 16:9 horizontal y 1:1 cuadrado — se agrega después
- Interfaz gráfica / UI web — solo API en v1
- Procesamiento en tiempo real — batch y on-demand son suficientes
- Edición manual interactiva — pipeline automático, inspección de salidas intermedias

## Context

- Los videos de entrada son de una persona hablando (talking head)
- Target: creadores de contenido para redes sociales que necesitan reciclar contenido largo en clips cortos verticales
- Whisper se usa para transcripción con timestamps precisos (alineación texto-video)
- Remotion permite generar overlays programáticamente (subtítulos, intros, zooms) renders de video
- Docker permite encapsular cada paso como un servicio independiente, facilitando extensibilidad
- La secuencia del pipeline: input → Whisper → silence detection → Remotion render → output
- Los pasos son independientes: cada uno lee una entrada y produce una salida, permitiendo inspección manual entre pasos

## Constraints

- **Tech Stack**: Docker + Node.js (Remotion) + Python (Whisper) — lenguajes fijos por las herramientas
- **Architecture**: Pipeline basado en steps independientes, no monolito
- **Output Format**: 9:16 vertical como mínimo en v1
- **Video Input**: MP4, talking head, una persona hablando
- **Extensibility**: Cualquier nuevo paso debe poder incorporarse como container Docker en la secuencia sin refactorizar el pipeline

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pasos independientes con salidas intermedias | Permite inspección manual y debugging, cada paso es autónomo | — Pending |
| Whisper para transcripción | Estado del arte en ASR, timestamps precisos, corre localmente | — Pending |
| Remotion para overlays programáticos | Control total sobre subtítulos, intros, zooms via código React | — Pending |
| Docker para cada paso del pipeline | Aislamiento de dependencias, extensibilidad natural | — Pending |
| Placeholders para B-roll | Infraestructura de overlays lista, clips reales se agregan después | — Pending |
| Solo 9:16 en v1 | Es el formato más demandado para redes sociales actuales | — Pending |
| Subtítulos en minúsculas (salvo inicio de frase) | Estilo TikTok/Reels consistente, evita mayúsculas incorrectas de Whisper | Validated in Phase 5 |
| Pipeline orden: Whisper→Silence→Finalizer→Remotion | Whisper en video original para timestamps correctos, remotion-renderer recibe 9:16 final | Validated in Phase 5 |

| Zoom+transition scale multiplicativo en ZoomContainer | Transición aplicada a overlay vacío era invisible; combinar escala en el elemento que envuelve el video la hace visible | Validated in Phase 07 |
| Merge inmutable con shallow clones en zoom-detection | rawEvents no debe mutarse por la función de merge; spread operator previene side effects | Validated in Phase 07 |

## Deferred Items for Phase 6

| Category | Item | Notes |
|----------|------|-------|
| Config | Subtitle position via .env (bottomOffset y más) | bottomOffset ya existe, exponer más params |
| Config | Fuente, tamaño, espaciado configurable via .env | fontFamily, letterSpacing, lineHeight |
| Config | Título de video con parámetros .env | Video title overlay with configurable text, position, font |
| Visual | Subtitle safe area margins | Left/right padding tuning (currently 40px) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-20 — started milestone v1.1 Calidad de video*