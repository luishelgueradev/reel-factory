---
created: 2026-05-25T19:24:15.322Z
completed: 2026-05-26T13:24:00.000Z
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

## Resolution (2026-05-26)

1. **Tests**: `__tests__/worker.test.ts` mockea `constants.js` y solo testea `processJob`
   (no `startWorker`) — nunca asertaba la concurrency. No requería cambios; siguen verdes.
2. **Overrides**: `docker-compose.yml:250` usa `${MAX_CONCURRENT_JOBS:-1}` y `.env.example:30`
   es `1`. Ningún override >1. ✓
3. **Docs**: nota agregada en `AGENTS.md` Development Conventions (single-job hard limit).
   Comentario stale en `worker.ts` ("default concurrency is 2") corregido a 1.
4. **Hardening adicional** (commit `feat: cloudflare tunnel...`): `orchestrator.ts` ahora
   pasa `ShmSize=2GB` al container remotion-renderer (Chrome necesita ≥2GB shm).

Verificado e2e: job 3b577ed9 procesó vía worker (concurrency 1) sin OOM ni hang —
esto también cierra el blocker de 05-HUMAN-UAT test #5 ("render se clavó/frizado").
