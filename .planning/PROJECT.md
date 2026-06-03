# Video Pipeline Docker

## What This Is

Un pipeline de procesamiento de video containerizado en Docker que toma un MP4 como entrada, lo procesa automáticamente (transcripción con Whisper, corte de silencios, subtítulos dinámicos con Remotion) y genera videos optimizados para redes sociales en formato vertical 9:16. Sirve todo via API REST con capacidad de procesamiento individual y por lotes. Cada paso del pipeline es independiente e inspeccionable, permitiendo revisar salidas intermedias antes de continuar.

## Core Value

Transformar un video crudo de una persona hablando en un video dinámico para redes sociales con un solo comando API, eliminando silencios y agregando subtítulos automáticamente.

## Current State

**Shipped:** v1.0 (Pipeline completo, 12 fases) + v1.1 (Calidad de video, fases 13-14) + v1.2 (Infrastructure / shared services, fases 15-16 — whisper externalizado + render config-propagation/flicker fixes + tunnel/auth/concurrency hardening). Archived: [.planning/milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md), [.planning/milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

**Phase 22 complete (2026-06-03):** Studio UI polish done — 3-column shell (preview · controls · static "Metadata de redes — Próximamente" placeholder) in PreviewApp; full impeccable densification of all three editors with Posición→Estilo→Avanzado ordering and green→blue selection states (single green Render CTA); tabs restructured to Títulos | Overlays | Subtítulos with sample text relocated atop Subtítulos; overlay back/front layering model (`PngOverlayConfig.layer` field + validator, mirrored studio/renderer, 5-layer paint order, preview-only legibility dim); shared 9-point `PositionPresets` component (size-aware px mode for titles/overlays, enum mode for subtitles). 298/298 renderer + 127/127 studio tests pass; human visual UAT approved. Verification 5/5. Code review surfaced 1 pre-existing blocker (CR-01, renderer Root.tsx subtitle prop) + advisory warnings tracked in 22-REVIEW.md.

**Phase 19 complete (2026-05-29):** Typography & text effects done — Plus Jakarta Sans added as default font (AVAILABLE_FONTS[0]); OuterGlow/fontWeight/fontStyle schema fields with hex color validation; all 4 subtitle layouts de-hardcoded from fontWeight:700 to config-driven boolean; getOuterGlowStyle() helper; Bold/Italic toggle rows + Outer Glow section card in StyleControls and TitleEditor; font size sliders extended to 200; renderer synced; 25 unit tests pass; human UAT approved.

**Phase 18 complete (2026-05-27):** Studio UI redesign done — TitleEditor simplified to 2-prop interface, PreviewApp rewritten as unified two-column StudioApp with TabBar (Titles/Subtitles/Text), React Router collapsed to single `/` route, server.ts serves SPA at root with 301 redirects for legacy routes.

**v1.1 outcomes (notable):** scale:1 production default (Spike 001 mostró que el supersampling no aporta a captions de alto contraste a 1080); orchestrator threadea `PIPELINE_CONFIG_PATH` (los renders honran el config del studio); fix determinista del sync de highlights vía marcador `transcript.timeline` (heurística como fallback); quality-finalizer container ships pero queda como no-op con scale:1.

## Current Milestone: v1.3 — Studio redesign + visual capabilities

**Goal:** Unificar el Studio en una sola interfaz de 2 columnas y expandir las capacidades visuales/tipográficas del render, con persistencia de config que sobreviva rebuilds de Docker.

**Target features:**
- **Persistencia de config** — estilos guardados como JSON en carpeta persistente (volume/bind), sobreviven `docker rebuild` (hoy se pierden en cada rebuild).
- **Tipografía** — Plus Jakarta Sans, tamaños de fuente más grandes, variantes bold/italic, efecto outer glow (color/intensidad/suavidad).
- **PNG overlays** — insertar PNGs transparentes más grandes que el frame, reducidos por código al render (logos/watermarks nítidos).
- **Bloques de título** — posicionamiento por píxeles (no %), border-radius configurable, eliminar el campo subtítulo (un subtítulo = otro bloque de título).
- **Rediseño Studio UI (mayor)** — skill `impeccable` + plugin `frontend-design`; una sola interfaz dividida vertical en 2 columnas (izq: preview de video, der: todos los controles en tabs). Elimina la duplicación editor/preview actual.

**UI tooling (no-negociable):** toda fase/tarea de frontend DEBE invocar `impeccable` + `frontend-design` al inicio (ver AGENTS.md).

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
- **UI/frontend work — REQUIRED tooling (no-negociable)**: Toda fase o tarea que toque el frontend (remotion-studio editor/preview, componentes, layout, estilos, UX) DEBE invocar al inicio del plan o execute (no como afterthought):
  1. La skill `impeccable` — disponible en Claude Code y opencode
  2. El plugin `frontend-design` de Claude Code — usar cuando se trabaja en Claude Code; en opencode usar equivalente disponible o documentar el skip
  Esto es la garantía de calidad visual del proyecto: ninguna decisión de UI improvisada.

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
*Last updated: 2026-06-03 — Phase 22 complete: Studio UI polish (3-column shell, densified editors, overlay layering, 9-point presets). Last phase of milestone v1.3.*