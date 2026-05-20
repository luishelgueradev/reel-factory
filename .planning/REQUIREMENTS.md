# Requirements: Video Pipeline Docker — v1.1 "Calidad de video"

**Defined:** 2026-05-20
**Core Value:** Transformar un video crudo de una persona hablando en un video dinámico para redes sociales con un solo comando API, eliminando silencios y agregando subtítulos automáticamente.

> v1.0 requirements (pipeline, whisper, silence, subtitles, zooms, API) are validated
> and recorded in PROJECT.md. Previous REQUIREMENTS.md preserved in git history.

## v1.1 Requirements

Scoped to closing the visual-quality gap with Instagram reels via parameter/render
changes (no GPU). Grounded in `.planning/research/SUMMARY.md`.

### Encode Quality (Fase A — config-only)

- [ ] **ENC-01**: El pipeline no recodifica H.264 de forma redundante — el ensamblado en silence-cutter usa stream-copy (o un único encode), eliminando la pérdida por generación entre pasos
- [ ] **ENC-02**: Los encodes apuntan a un objetivo de plataforma (CRF ~17–18) para texto nítido sin bloating, en lugar de los CRF por defecto (23/20) actuales
- [ ] **ENC-03**: Todas las salidas llevan metadata de color BT.709 correcta (matrix/primaries/transfer), evitando el lavado/tinte verdoso por etiquetas ausentes
- [ ] **ENC-04**: El finalizer usa escalado de alta calidad (Lanczos) y un unsharp suave aplicado ANTES del burn-in de subtítulos, sin halos perceptibles
- [ ] **ENC-05**: Tras los cambios de encode se preservan la sincronía A/V y la paridad de duración (sin drift respecto a `silence-cuts.json`)

### Render Supersampling (Fase B — render + nuevo step)

- [ ] **RENDER-01**: El render de Remotion usa supersampling (`scale: 2`) para que subtítulos y overlays salgan nítidos (anti-aliasing a mayor densidad de píxel)
- [ ] **RENDER-02**: La captura de frames es sin pérdida (PNG) cuando hay supersampling, eliminando la compresión JPEG intermedia
- [ ] **RENDER-03**: Un nuevo step `quality-finalizer` baja la salida supersampleada (2160×3840) a 1080×1920 con Lanczos en un único encode final; la salida sigue siendo 9:16 1080×1920 estándar
- [ ] **RENDER-04**: El impacto en tiempo de render del supersampling está medido y es aceptable (gate de benchmark; si es excesivo, evaluar `scale: 1.5`)

## v2 Requirements

Deferred to a future milestone. Tracked but not in current roadmap.

### Source Definition / Upscaling (Path B — GPU)

- **UPSCALE-01**: Super-resolución con IA (Real-ESRGAN) sobre el video fuente, ejecutada ANTES del render de subtítulos, en un step Docker con GPU, opt-in por job
- **UPSCALE-02**: Gate de prerequisito: GPU verificada dentro de Docker bajo WSL2 (`nvidia-smi`), y A/B test que demuestre que Fases A+B no cerraron la brecha

## Out of Scope

| Feature | Reason |
|---------|--------|
| Salida H.265/HEVC | Instagram no lo soporta; H.264 High Profile es lo correcto |
| Salida 4K | Las plataformas topan playback en 1080p; subir 4K desperdicia tiempo y dispara recompresión más agresiva |
| Sharpening agresivo | Los halos sobreviven a la recompresión de la plataforma y se ven peor que sin sharpening |
| Upscaling DESPUÉS del render | Degrada el texto de subtítulos quemado por Remotion (error de orden de alto costo) |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENC-01 | TBD (roadmap) | Pending |
| ENC-02 | TBD (roadmap) | Pending |
| ENC-03 | TBD (roadmap) | Pending |
| ENC-04 | TBD (roadmap) | Pending |
| ENC-05 | TBD (roadmap) | Pending |
| RENDER-01 | TBD (roadmap) | Pending |
| RENDER-02 | TBD (roadmap) | Pending |
| RENDER-03 | TBD (roadmap) | Pending |
| RENDER-04 | TBD (roadmap) | Pending |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 0 (assigned during roadmap)
- Unmapped: 9 ⚠️ (roadmapper will assign)

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-20 — milestone v1.1 start*
