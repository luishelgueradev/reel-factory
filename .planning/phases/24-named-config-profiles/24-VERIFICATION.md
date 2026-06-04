---
phase: 24-named-config-profiles
verified: 2026-06-04T13:39:09Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir la Studio UI en el browser (localhost:3123), guardar la config actual con un nombre, verificar que aparece en la lista inmediatamente"
    expected: "El botón 'Perfiles ▾' abre el popover inline; ingresar nombre y presionar 'Guardar actual' crea el perfil y muestra chip '✓ Perfil guardado'"
    why_human: "Comportamiento visual del popover, animación de entrada (scale+opacity), y chip transiente no son verificables con grep"
  - test: "Seleccionar un perfil de la lista y verificar que el preview de la Studio se actualiza visualmente (subtítulos, títulos, overlays)"
    expected: "Al hacer click en la fila del perfil se llama PUT /api/profiles/:slug/apply y el preview refleja el config del perfil inmediatamente; chip '✓ Perfil aplicado' aparece brevemente"
    why_human: "El refresco del preview y la consistencia visual del estado aplicado requieren inspección humana en el browser"
  - test: "Renombrar un perfil inline (icono ✎) y verificar que el cambio persiste en la lista"
    expected: "El input inline aparece con el nombre actual; Enter confirma y actualiza la fila; Esc cancela sin cambios"
    why_human: "Comportamiento de focus/blur del input inline no es verificable con testing-library sin un browser real"
  - test: "Eliminar un perfil usando el icono ✕ y confirmar el dialog inline '¿Borrar? Sí/No'"
    expected: "La fila se elimina del DOM inmediatamente; 'No' cancela sin cambios"
    why_human: "Flow de confirmación de 2 pasos requiere interacción real en el browser"
  - test: "Verificar que el botón 'Perfiles ▾' se deshabilita mientras un render está en progreso (renderState = running/submitting)"
    expected: "El trigger muestra opacity 0.5 y cursor not-allowed; el popover no abre durante el render"
    why_human: "Depende de iniciar un render real o mockear el estado de render en la UI"
  - test: "Verificar green discipline: exactamente UN elemento con color --action (verde) en la pantalla en todo momento (el botón '▶ Render Video')"
    expected: "El trigger 'Perfiles ▾' y los botones del popover usan --accent (azul) o --danger (rojo), nunca --action (verde)"
    why_human: "Requiere inspección visual y DevTools para confirmar qué token CSS se aplica en runtime"
---

# Phase 24: Named Config Profiles — Verification Report

**Phase Goal:** Users can save and reload named style configurations — switching between project styles is a click, not a manual file operation
**Verified:** 2026-06-04T13:39:09Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Pure, framework-free profiles core module with path-traversal guard (D-03) | ✓ VERIFIED | `profiles.ts` imports only `fs`, `path`, `pipeline-config.js`; no Express import found; `isValidSlug` rejects `.`, `/`, `\` |
| 2 | Module CRUD operates over injected dir with no globals (D-06) | ✓ VERIFIED | All exported functions (`listProfiles`, `readProfile`, `saveProfile`, `renameProfile`, `removeProfile`) accept `dir` as first param; no global path reference inside the module |
| 3 | Atomic save/rename via temp-file + fs.renameSync (D-04) | ✓ VERIFIED | `atomicWrite()` at line 351: writes `.{basename}.{pid}.{ts}.tmp.json`, then `fs.renameSync(tmpPath, targetPath)` |
| 4 | Profile file shape `{ name, slug, updatedAt, config: PipelineConfig }` (D-02) | ✓ VERIFIED | `ProfileFile` interface at line 26; `saveProfile` constructs that exact shape; test suite covers deep-equal of config |
| 5 | Studio server exposes 6 profiles HTTP routes: list, save, get, apply, rename, delete (D-05) | ✓ VERIFIED | `grep /api/profiles server.ts` shows 6 routes at lines 341, 353, 387, 411, 456, 490; all before `serveSpa` catch-all (line 554) |
| 6 | Profiles persist under `dirname(ACTIVE_PIPELINE_CONFIG_PATH)/profiles` — same bind mount as active config (D-01, PROFILE-04) | ✓ VERIFIED | `getProfilesDir()` at line 46: `path.join(path.dirname(getActivePipelineConfigPath()), "profiles")`; `ACTIVE_PIPELINE_CONFIG_PATH=/data/pipeline/pipeline-config.json` in `docker-compose.yml` line 184; `./pipeline:/data/pipeline` bind mount → profiles live at `./pipeline/profiles` on host, surviving docker rebuild |
| 7 | Applying a profile atomically writes its config to ACTIVE_PIPELINE_CONFIG_PATH and returns applied PipelineConfig (PROFILE-02, D-05) | ✓ VERIFIED | `PUT /api/profiles/:slug/apply` at line 411 calls `atomicWriteConfig(profile.config)` (line 434); `profiles-api.test.ts` line 173 reads the disk file and deep-equals the profile config |
| 8 | A 'Perfiles' control sits in the header (inline popover, no modal) and is wired to PreviewApp state | ✓ VERIFIED | `ProfilesMenu.tsx` renders a `<div role="dialog">` inside a relative container (no portal/modal); `PreviewApp.tsx` line 607 mounts `<ProfilesMenu getCurrentConfig={getCurrentConfig} onApplied={handleProfileApplied} disabled={...}>`; `handleProfileApplied` calls `applyConfigToState` which sets `subtitleConfig`, `liveTitles`, `liveOverlays` |
| 9 | All unit + integration tests pass (45 core + 19 API + 22 UI = 86 tests; full studio suite 274 green) | ✓ VERIFIED | `npx vitest run src/profiles.test.ts` → 45/45; `npx vitest run src/profiles-api.test.ts` → 19/19; `npx vitest run src/preview/profiles-menu.test.tsx` → 22/22; full `npx vitest run` → 274/274 |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/remotion-studio/src/profiles.ts` | Pure core module: slugify, isValidSlug, profilePath, listProfiles, readProfile, saveProfile, renameProfile, removeProfile, error classes | ✓ VERIFIED | 368 lines; all functions exported; atomic write internal helper; no Express/global deps |
| `services/remotion-studio/src/profiles.test.ts` | 45 unit tests over temp dir | ✓ VERIFIED | 45/45 passing |
| `services/remotion-studio/src/server.ts` | 6 profiles routes before serveSpa; PROFILES_DIR setup | ✓ VERIFIED | Lines 336-511; `getProfilesDir()` env-overridable; startup mkdir guarded for non-test |
| `services/remotion-studio/src/profiles-api.test.ts` | 19 supertest integration tests incl. apply-disk-write | ✓ VERIFIED | 19/19 passing; apply test reads disk file and verifies content (line 173-177) |
| `services/remotion-studio/src/preview/ProfilesMenu.tsx` | Inline popover: save-as, list, click-to-apply, inline rename, inline delete-confirm; green discipline | ✓ VERIFIED | 1065 lines; all handlers implemented; green discipline: trigger and popover buttons use `--accent`/`--danger` tokens only, never `--action` |
| `services/remotion-studio/src/preview/profiles-menu.test.tsx` | 22 UI tests incl. green-discipline assertion | ✓ VERIFIED | 22/22 passing |
| `services/remotion-studio/src/preview/PreviewApp.tsx` | ProfilesMenu mounted; applyConfigToState(); getCurrentConfig() | ✓ VERIFIED | Line 35: import; lines 302-343: `applyConfigToState` and `getCurrentConfig`; line 607: `<ProfilesMenu>` with proper props |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server.ts` | `profiles.ts` | `import { listProfiles, saveProfile, readProfile, renameProfile, removeProfile, isValidSlug, ProfileConflictError, ProfileValidationError }` | ✓ WIRED | Lines 17-24 of server.ts |
| `ProfilesMenu.tsx` | `GET /api/profiles` | `fetch("/api/profiles")` in `fetchProfiles()` | ✓ WIRED | Line 105 of ProfilesMenu.tsx |
| `ProfilesMenu.tsx` | `POST /api/profiles` | `fetch("/api/profiles", { method: "POST", body: JSON.stringify({ name, config }) })` | ✓ WIRED | Line 183 of ProfilesMenu.tsx |
| `ProfilesMenu.tsx` | `PUT /api/profiles/:slug/apply` | `fetch("/api/profiles/${slug}/apply", { method: "PUT" })` | ✓ WIRED | Line 215 of ProfilesMenu.tsx; response passed to `onApplied` |
| `ProfilesMenu.tsx` | `PATCH /api/profiles/:slug` | `fetch("/api/profiles/${slug}", { method: "PATCH", body: JSON.stringify({ name }) })` | ✓ WIRED | Line 259 of ProfilesMenu.tsx |
| `ProfilesMenu.tsx` | `DELETE /api/profiles/:slug` | `fetch("/api/profiles/${slug}", { method: "DELETE" })` | ✓ WIRED | Line 299 of ProfilesMenu.tsx |
| `PreviewApp.tsx` | `ProfilesMenu` | `<ProfilesMenu getCurrentConfig={getCurrentConfig} onApplied={handleProfileApplied} disabled={...}>` | ✓ WIRED | Line 607; `handleProfileApplied` calls `applyConfigToState` which updates all Studio state |
| `PUT .../apply` | `ACTIVE_PIPELINE_CONFIG_PATH` | `atomicWriteConfig(profile.config)` | ✓ WIRED | Line 434 of server.ts; `atomicWriteConfig` at line 613 uses `getActivePipelineConfigPath()` |
| `./pipeline/profiles` | Docker bind mount | `./pipeline:/data/pipeline` in `docker-compose.yml` x-pipeline-common | ✓ WIRED | Line 3 of docker-compose.yml; `PROFILES_DIR = /data/pipeline/profiles` survives container recreation |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ProfilesMenu.tsx` | `profiles` (list) | `GET /api/profiles` → `listProfiles(PROFILES_DIR)` → reads `*.json` from disk | Yes — reads real files under bind-mounted `./pipeline/profiles` | ✓ FLOWING |
| `ProfilesMenu.tsx` | `onApplied(config)` | `PUT /api/profiles/:slug/apply` → `readProfile` → `atomicWriteConfig` → returns `profile.config` | Yes — disk-sourced; integration test verifies file content matches | ✓ FLOWING |
| `PreviewApp.tsx` | `subtitleConfig`, `liveTitles`, `liveOverlays` | `applyConfigToState(config)` ← `handleProfileApplied` ← `ProfilesMenu.onApplied` | Yes — data flows from profile file on disk through API through component state to `<PreviewPlayer>` | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| profiles.ts compiles without type errors | `cd services/remotion-studio && npx tsc --noEmit 2>&1 \| grep -i profiles \|\| echo ok` | No profiles type errors | ✓ PASS |
| profiles unit tests green | `npx vitest run src/profiles.test.ts` | 45/45 passed | ✓ PASS |
| profiles-api integration tests green | `npx vitest run src/profiles-api.test.ts` | 19/19 passed | ✓ PASS |
| ProfilesMenu UI tests green (incl. green-discipline) | `npx vitest run src/preview/profiles-menu.test.tsx` | 22/22 passed | ✓ PASS |
| Full studio suite green (no regressions) | `npx vitest run` | 274/274 passed | ✓ PASS |
| 6 profiles routes registered before serveSpa | `grep -n "/api/profiles\|serveSpa" src/server.ts` | Routes at 341-510; serveSpa at 524/554 | ✓ PASS |
| profiles.ts has no Express/global imports | `grep "express\|require.*express" src/profiles.ts` | No output | ✓ PASS |

---

### Probe Execution

No conventional probe scripts found for this phase. Behavioral checks above cover all runnable criteria.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PROFILE-01 | 24-01, 24-02, 24-03 | User can save the current config as a named profile | ✓ SATISFIED | `POST /api/profiles` in server.ts (line 353) calls `saveProfile`; `ProfilesMenu` save-as handler POSTs `{ name, config: getCurrentConfig() }`; API test line 62 verifies 201 + list contains saved profile |
| PROFILE-02 | 24-01, 24-02, 24-03 | User can load a saved profile, restoring its config into the Studio | ✓ SATISFIED | `PUT /api/profiles/:slug/apply` atomically writes active config; `ProfilesMenu.handleApply` calls `onApplied(config)` which triggers `applyConfigToState` setting subtitle+titles+overlays; test at line 173 reads disk file and deep-equals |
| PROFILE-03 | 24-01, 24-02, 24-03 | User can list, rename, and delete saved profiles | ✓ SATISFIED | `GET /api/profiles` lists; `PATCH /api/profiles/:slug` renames (ProfileConflictError→409); `DELETE /api/profiles/:slug` deletes; UI tests 22/22 cover all 3 operations |
| PROFILE-04 | 24-01, 24-02 | Saved profiles persist across Docker rebuilds | ✓ SATISFIED | `PROFILES_DIR = dirname(ACTIVE_PIPELINE_CONFIG_PATH)/profiles = /data/pipeline/profiles`; bind mount `./pipeline:/data/pipeline` in docker-compose.yml line 3; profiles directory is on the host filesystem — container image rebuild does not affect it |

All 4 PROFILE requirements satisfied. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PreviewApp.tsx` | 887-934 | "Metadata placeholder card" comment + "Próximamente" text in col3 | ℹ️ Info | This is the Phase 25 (META) placeholder — intentional per requirements (META-02 mapped to Phase 25). Not a Phase 24 debt. No TBD/FIXME/XXX marker. |

No BLOCKER anti-patterns. No `TBD`, `FIXME`, or `XXX` markers found in Phase 24 files.

---

### Human Verification Required

The automated checks cover all structural and behavioral truths. The following items require a real browser session because they involve visual behavior, runtime CSS token application, and transient animation states:

#### 1. Save-as flow in the browser

**Test:** Abrir `http://localhost:3123`, presionar "Perfiles ▾", escribir un nombre en el input, presionar "Guardar actual"
**Expected:** El popover abre sin modal stack; el input recibe foco automáticamente; el chip "✓ Perfil guardado" aparece por ~2s; el perfil aparece en la lista inmediatamente
**Why human:** Animación del popover (scale/opacity), autofocus, y chip transiente no son verificables con grep ni testing-library sin browser real

#### 2. Apply-restores-preview flow

**Test:** Con al menos dos perfiles guardados con configs distintas, hacer click en un perfil de la lista
**Expected:** El preview (Player) refleja el config del perfil al instante — cambios en layout de subtítulos, títulos visibles, overlays; chip "✓ Perfil aplicado" aparece en el header del popover; la fila muestra el checkmark `✓` de activo
**Why human:** La consistencia visual entre el estado aplicado y el preview del Player requiere inspección ocular

#### 3. Inline rename (Enter confirma, Esc cancela)

**Test:** En la fila de un perfil, presionar el icono ✎, editar el nombre, Enter para confirmar
**Expected:** Input inline aparece con el nombre actual seleccionado; Enter llama PATCH y actualiza el nombre en la lista sin refresh total; Esc restaura el nombre original sin llamada HTTP
**Why human:** Focus/blur del input inline en un browser real puede diferir del entorno jsdom

#### 4. Delete confirm flow

**Test:** Presionar ✕ en una fila, luego "Sí" para confirmar
**Expected:** Aparece el prompt inline "¿Borrar este perfil? Sí / No"; "Sí" elimina la fila del DOM; "No" cancela sin cambios; el botón queda deshabilitado durante el DELETE en vuelo
**Why human:** El 2-step confirm requiere múltiples clicks en un browser real para verificar el orden de renderizado

#### 5. Disabled state durante render

**Test:** Iniciar un render (▶ Render Video) y verificar el botón "Perfiles ▾" durante el processing
**Expected:** El trigger muestra opacity 0.5 y no responde al click (disabled); hint "No disponible durante el renderizado" visible si el popover estuviera abierto
**Why human:** Requiere un render real o mockear el estado de la máquina de estado de render

#### 6. Green discipline visual

**Test:** Inspeccionar con DevTools el color computado de todos los botones del popover de Perfiles
**Expected:** Solo el botón "▶ Render Video" usa el token `--action` (verde); el trigger "Perfiles ▾", "Guardar actual", y acciones inline usan `--accent` (azul) o `--danger` (rojo)
**Why human:** Los tests de green discipline en `profiles-menu.test.tsx` prueban la ausencia de clases CSS `--action`; en producción los estilos son inline con `var(--accent)`, requiere inspección visual para confirmar que los tokens resuelven al color correcto

---

### Gaps Summary

No hay gaps. Los 4 requisitos (PROFILE-01 a PROFILE-04) están satisfechos en el código. Todos los artefactos existen, son sustantivos, están cableados, y los datos fluyen de extremo a extremo. Los 274 tests del studio suite pasan sin regresiones.

El status `human_needed` refleja 6 items de verificación visual que requieren un browser real — todos relativos al comportamiento UI del popover y la green discipline en runtime. No hay blockers.

**Evidencia empírica documentada de la sesión de implementación:**
- Studio suite: 274 green; renderer: 315 green (sin regresiones F23); api-server: 89 green
- E2E contra el container en loopback: save→list→apply (archivo de config activo en disco verificado)→rename→delete; path-traversal `../evil` rechazado (400)
- PROFILE-04: un perfil guardado sobrevivió `docker compose build --force-recreate` y seguía listado por la API (perfiles en `./pipeline/profiles`, mismo bind mount que el config activo)

---

_Verified: 2026-06-04T13:39:09Z_
_Verifier: Claude (gsd-verifier)_
