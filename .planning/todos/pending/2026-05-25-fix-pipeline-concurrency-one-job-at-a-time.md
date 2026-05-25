---
created: 2026-05-25T19:24:15.322Z
title: Fix pipeline concurrency — enforce one job at a time
area: api
files:
  - services/api-server/src/constants.ts:54
  - services/api-server/src/worker.ts:81-83
  - services/api-server/src/__tests__/worker.test.ts
---

## Problem

El BullMQ worker tenía `MAX_CONCURRENT_JOBS` default en `2`, lo que hacía correr dos
`remotion-renderer` containers simultáneamente. Cada container levanta Chrome headless
para renderizar frames. Dos Chrome corriendo en paralelo consumen toda la RAM/shm y
Chrome OOMea y falla mid-render.

Fix aplicado en sesión 2026-05-25: default cambiado a `1` en `constants.ts`. Pero hay
más trabajo pendiente:

1. Los tests del worker (`worker.test.ts`) probablemente asumen concurrency=2 — deben
   actualizarse para reflejar concurrency=1.
2. Verificar que ningún docker-compose.yml ni `.env` override el env var
   `MAX_CONCURRENT_JOBS` a un valor >1.
3. Documentar en AGENTS.md/Conventions que el pipeline es single-job by design.

## Solution

- Auditar `worker.test.ts` y ajustar expectativas de concurrency a 1
- Grep `MAX_CONCURRENT_JOBS` en todos los compose files y .env para descartar overrides
- Agregar nota en AGENTS.md Conventions: "Pipeline worker: concurrency=1 hard limit —
  remotion-renderer spawns Chrome y OOMea si corre en paralelo"
