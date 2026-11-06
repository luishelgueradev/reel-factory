# Reel Factory (Video Pipeline Docker)

Reel Factory convierte un video crudo de una persona hablando en un reel vertical 9:16 listo para redes sociales: transcribe el audio, elimina los silencios, recorta a 1080x1920 y agrega subtítulos animados palabra por palabra, títulos y overlays PNG. Está pensado para creadores de contenido que reciclan videos largos en clips cortos y no quieren editarlos a mano. Cada paso del proceso es un contenedor Docker independiente que deja su salida en disco, por lo que se puede inspeccionar antes de continuar. Se usa desde una API REST (un video o lotes) o desde Remotion Studio, una interfaz web para ajustar el estilo, guardar perfiles, renderizar y generar metadata para redes con IA.

## Tecnologías

| Categoría | Tecnología |
|-----------|------------|
| Lenguaje | TypeScript 5 sobre Node.js 22 |
| Lenguaje | Python 3.12 |
| Backend | Express 5.2 |
| Cola de trabajos | BullMQ 5.76 |
| Base de datos | Redis 7 (Alpine), para la cola y el progreso |
| Cliente Redis | ioredis 5.10 |
| Orquestación de contenedores | dockerode 5 |
| Subida de archivos | Multer 2 |
| Validación | Zod 4.4 (Node.js) |
| Validación | Pydantic 2 (Python) |
| Render de video | Remotion 4.0.457 |
| Frontend | React 19 |
| Build | Vite 5.4 |
| Procesamiento de video | FFmpeg 7.1.1 (compilado desde el código fuente) |
| Infraestructura | Docker con Docker Compose v2 |
| Infraestructura | Cloudflare Tunnel (opcional) |
| Testing | Vitest 4 |
| Testing | pytest |

La transcripción y la generación de metadata corren en servicios externos; ver [Requisitos previos](#requisitos-previos).

## Requisitos previos

- Docker y Docker Compose v2 con BuildKit.
- Acceso de lectura y escritura a `/var/run/docker.sock`: `api-server` lanza cada step como contenedor hermano.
- RAM suficiente para Chrome headless. El contenedor del render usa 2 GB de memoria compartida.
- **whisper-api** (obligatorio): servicio HTTP de transcripción, separado de este repositorio. Debe responder en `WHISPER_API_URL` (por defecto, `http://host.docker.internal:8000`).
- **Router de LLM compatible con OpenAI** (opcional): solo para generar metadata. Por defecto se espera en `http://host.docker.internal:3210`.
- Node.js 22 y Python 3.12 (solo para desarrollo y tests fuera de Docker).

## Instalación

```bash
# 1. Clonar el repositorio (el nombre del directorio define el nombre de la red de Compose)
git clone https://github.com/luishelgueradev/reel-factory.git
cd reel-factory

# 2. Crear la configuración y el directorio de datos
cp .env.example .env
mkdir -p pipeline

# 3. Crear la red externa que declara docker-compose.yml (si todavía no existe)
docker network create docker-network

# 4. Construir primero las imágenes base, de las que dependen todos los steps
docker compose build base-python base-node

# 5. Construir el resto. El perfil incluye quality-finalizer, que el orquestador necesita
docker compose --profile pipeline build

# 6. Levantar los servicios permanentes
docker compose up -d redis api-server remotion-studio

# 7. Verificar
curl http://localhost:3000/health
```

La API queda en `http://localhost:3000` y Studio en `http://localhost:3123`.

Antes de levantar los servicios, revisá estos puntos del `.env`:

- `PROCESS_TIMEOUT_MS`: `.env.example` trae `600000` (10 minutos), que reemplaza el valor por defecto de 3 horas. Puede cortar videos largos en `POST /process`.
- `WHISPER_API_URL` y `WHISPER_API_KEY`: no están en `.env.example`, así que hay que agregarlos si no usás los valores por defecto.
- `UID` y `GID`: deben coincidir con tu usuario (`id -u`, `id -g`) para que los archivos de `pipeline/` queden a tu nombre.

Si el grupo `docker` de tu host no tiene el GID 1001 (`stat -c '%g' /var/run/docker.sock`), cambiá `group_add` en `docker-compose.yml`.

Para instalar en un servidor, usá `install.sh`; ver [Deploy](#deploy).

## Configuración

Las variables se definen en `.env`. Los valores de la tabla son los que usa Compose si la variable no está definida.

```env
WHISPER_API_URL=http://host.docker.internal:8000
WHISPER_API_KEY=tu_api_key_aqui
STUDIO_BASIC_AUTH_USER=tu_usuario_aqui
STUDIO_BASIC_AUTH_PASSWORD=tu_password_aqui
METADATA_API_KEY=tu_token_del_router_aqui
METADATA_MODEL=big-cloud
CLOUDFLARE_TUNNEL_TOKEN=tu_token_de_tunel_aqui
```

### Servicios y orquestación

| Variable | Default | Descripción |
|----------|---------|-------------|
| `API_PORT` | `3000` | Puerto publicado de la API |
| `STUDIO_PORT` | `3123` | Puerto publicado de Studio. El proyecto usa siempre 3123 |
| `UID` / `GID` | `1000` | Usuario con el que corren los contenedores |
| `HOST_PIPELINE_DIR` | `$PWD/pipeline` | Ruta absoluta en el host de `pipeline/`, usada para montarla en los steps |
| `PIPELINE_NETWORK` | `reel-factory_pipeline-net` | Red a la que se conectan los steps |
| `PROCESS_TIMEOUT_MS` | `10800000` | Tiempo máximo de `POST /process` |
| `MAX_CONCURRENT_JOBS` | `1` | Trabajos simultáneos. No subirlo en producción |
| `MAX_BATCH_SIZE` | `10` | Máximo de archivos por lote |

### Servicios externos

| Variable | Default | Descripción |
|----------|---------|-------------|
| `WHISPER_API_URL` | `http://host.docker.internal:8000` | URL de whisper-api |
| `WHISPER_API_KEY` | vacío | Credencial de whisper-api |
| `METADATA_API_URL` | `http://host.docker.internal:3210` | URL del router de LLM |
| `METADATA_API_KEY` | vacío | Token del router. Sin él, la generación de metadata responde 503 |
| `METADATA_MODEL` | `big-cloud` | Alias del modelo: `big-cloud` (en la nube) o `chat-local` (local) |

### Studio y acceso público

| Variable | Default | Descripción |
|----------|---------|-------------|
| `STUDIO_BASIC_AUTH_USER` | vacío | Usuario de HTTP Basic Auth |
| `STUDIO_BASIC_AUTH_PASSWORD` | vacío | Contraseña. La autenticación se activa solo si ambas variables tienen valor |
| `CLOUDFLARE_TUNNEL_TOKEN` | vacío | Token del túnel. Se usa solo si levantás `cloudflared` |

### Steps ejecutados con `docker compose run`

Estas variables afectan a `process.sh` y a las ejecuciones manuales. `api-server` no las recibe, así que no modifican los trabajos lanzados por la API o desde Studio.

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PIPELINE_JOB_ID` | sin valor | Identificador del trabajo. `process.sh` lo define en cada ejecución |
| `SILENCE_MIN_DURATION` | `0.5` | Duración mínima, en segundos, de un silencio a cortar |
| `SILENCE_CUT_SHRINK` | `0.4` | Ajuste aplicado a los bordes de cada corte |
| `VERTICAL_WIDTH` / `VERTICAL_HEIGHT` | `1080` / `1920` | Resolución de salida |
| `CROP_STRATEGY` | `center` | Estrategia de recorte vertical |
| `ACTIVE_COLOR` / `INACTIVE_COLOR` | `#FFFF00` / `#FFFFFF` | Colores de subtítulos si no hay `pipeline-config.json` |
| `FONT_SIZE` | `58` | Tamaño de subtítulos si no hay `pipeline-config.json` |
| `REMOTION_SCALE` | `1` | Factor de supersampling del render |
| `REMOTION_IMAGE_FORMAT` | `png` | Formato de captura de frames |

### Estilo de los videos

El estilo no se configura con variables de entorno. Studio lo guarda en `pipeline/pipeline-config.json` y la API copia ese archivo a cada trabajo nuevo. Si el archivo no existe al arrancar, la API lo crea desde `services/api-server/config/pipeline-config.default.json`. Los perfiles con nombre se guardan en `pipeline/profiles/`.

## Uso

| Comando | Descripción |
|---------|-------------|
| `docker compose up -d redis api-server remotion-studio` | Levanta la API y Studio |
| `./process.sh video.mp4 [otro.mp4 ...]` | Procesa videos desde la terminal, sin la API |
| `./scripts/batch-run.sh` | Procesa todos los MP4 de `videos/` |
| `./scripts/smoke-test.sh` | Valida la infraestructura del pipeline |
| `npm test` (dentro de un servicio Node.js) | Ejecuta los tests de ese servicio |
| `pytest` (dentro de un servicio Python) | Ejecuta los tests de ese servicio |

### Desde Studio

Abrí `http://localhost:3123`. Desde ahí podés:

- Ajustar subtítulos (layouts `tiktok`, `bar` y `sentence`), títulos y overlays PNG con vista previa en vivo.
- Cargar un overlay guía de zonas seguras, visible solo en la vista previa y excluido del render.
- Guardar perfiles con nombre, y exportarlos o importarlos como JSON.
- Renderizar con un botón y seguir el progreso en vivo.
- Generar título, descripción y hashtags para TikTok, Instagram Reels y YouTube Shorts a partir de la transcripción.

### Desde la API

```bash
curl -X POST http://localhost:3000/process \
  -F "video=@video.mp4;type=video/mp4"
```

El `type=video/mp4` es necesario porque el filtro de subida valida el tipo MIME. El video final queda en `pipeline/{jobId}/output/video.mp4` y también se sirve por HTTP en `/artifacts/{jobId}/output/video.mp4`.

### Desde la terminal

`./process.sh` guarda los resultados en `pipeline/{nombre-del-video}/output/`. A diferencia de la API, toma el estilo de `services/remotion-studio/pipeline-config.json` (no de `pipeline/pipeline-config.json`) y no ejecuta `quality-finalizer`.

### Desarrollo

Studio corre como contenedor y su interfaz se compila al construir la imagen. Para ver cambios del editor en ese contenedor:

```bash
docker compose build remotion-studio
docker compose up -d remotion-studio
```

Para ejecutarlo directamente en el host, primero liberá el puerto:

```bash
docker compose stop remotion-studio
cd services/remotion-studio
npm install
npm run build:editor
PORT=3123 EDITOR_DIST=$(pwd)/dist/editor \
  ACTIVE_PIPELINE_CONFIG_PATH=$(pwd)/../../pipeline/pipeline-config.json \
  npx tsx src/server.ts
```

Los cambios en composiciones o lógica compartida deben copiarse al renderer y reconstruir su imagen. Desde `services/remotion-studio/`:

```bash
cp src/compositions/* ../remotion-renderer/src/compositions/
cp src/pipeline-config.ts src/fonts.ts src/captions.ts src/zoom-detection.ts ../remotion-renderer/src/
```

Revisá el diff antes de confirmar y volvé a correr los tests del renderer: la copia puede pisar correcciones que existan solo en ese servicio. Tampoco copies `Root.tsx` ni `SubtitledVideo.tsx`, porque cada servicio tiene su propia versión.

Después de cambiar el código de un step, reconstruí su imagen: la API usa siempre la última imagen construida.

### Consideraciones operativas

- **Un render a la vez:** cada render abre Chrome headless y dos en paralelo agotan la memoria. Por eso `MAX_CONCURRENT_JOBS` vale 1 y los lotes se procesan en secuencia.
- **Timeout:** si `POST /process` responde 408, los contenedores del trabajo siguen corriendo; el timeout no los cancela.
- **Disco:** `pipeline/` conserva los archivos intermedios de cada trabajo y no se limpia de forma automática.

## Arquitectura del proyecto

```
├── services/
│   ├── api-server/          # API REST, cola BullMQ y orquestador de steps
│   ├── remotion-studio/     # Editor web, vista previa y API de configuración
│   ├── remotion-renderer/   # Step: render de subtítulos, títulos y overlays
│   ├── whisper-http-step/   # Step: cliente HTTP de whisper-api
│   ├── silence-cutter/      # Step: detección y corte de silencios
│   ├── ffmpeg-finalizer/    # Step: conversión a 9:16
│   ├── quality-finalizer/   # Step: escalado final condicional
│   ├── srt-exporter/        # Step: subtítulos SRT y VTT
│   ├── smoke-test/          # Step de prueba de la infraestructura
│   ├── base-node/           # Imagen base Node.js con FFmpeg
│   └── base-python/         # Imagen base Python con FFmpeg
├── shared/                  # Constantes y esquemas del contrato de steps
├── scripts/                 # Lotes, smoke test y pruebas end-to-end
├── docs/                    # Contrato de steps y notas de lotes
├── pipeline/                # Datos de trabajos y configuración activa (no versionado)
├── videos/                  # Videos de entrada para lotes (no versionado)
├── process.sh               # Procesamiento desde la terminal
└── docker-compose.yml
```

### Flujo de un trabajo

```
Studio :3123 ── POST /api/render ──┐
                                   ▼
Cliente HTTP ─ /process, /batch ─► api-server :3000 ◄─► Redis (cola y progreso)
                                   │
                                   │ lanza un contenedor por step (Docker socket)
                                   ▼
   whisper ─► silence-cutter ─► ffmpeg-finalizer ─► remotion-renderer
      │                                                    │
      ▼                                                    ▼
 whisper-api (externo)                             quality-finalizer
                                                           │
                                                           ▼
                                                     srt-exporter
                                                           │
                                                           ▼
                                        pipeline/{jobId}/output/video.mp4
```

| Step | Función | Salida en `pipeline/{jobId}/` |
|------|---------|-------------------------------|
| `whisper` | Transcribe con marcas de tiempo por palabra, sobre el video original | `whisper/transcript.json` |
| `silence-cutter` | Corta los silencios y registra los cortes | `silence-cutter/output.mp4`, `silence-cuts.json` |
| `ffmpeg-finalizer` | Recorta y codifica a 1080x1920 | `ffmpeg-finalizer/output.mp4`, `finalizer-info.json` |
| `remotion-renderer` | Remapea los tiempos según los cortes y agrega subtítulos, títulos y overlays | `remotion-renderer/output.mp4` |
| `quality-finalizer` | Reduce la resolución si el render la superó; si no, copia sin recodificar | `quality-finalizer/output.mp4` |
| `srt-exporter` | Genera los subtítulos como archivos separados | `srt-exporter/output.srt`, `output.vtt` |

Cada step recibe `INPUT_PATH`, `OUTPUT_PATH` y `PIPELINE_JOB_ID`, y escribe un `manifest.json` junto a su salida. Para agregar uno, seguí el [contrato de steps](docs/step-contract.md), definí el servicio en `docker-compose.yml` y sumalo al arreglo `STEPS` de `services/api-server/src/orchestrator.ts`. No hace falta modificar los steps existentes.

## API / Endpoints

### API de procesamiento (puerto 3000)

Este servicio no tiene autenticación propia, así que no lo publiques sin protección.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado del servidor, Redis y la cola |
| `POST` | `/process` | Procesa un video y responde al terminar |
| `POST` | `/batch` | Encola varios videos y responde de inmediato |
| `GET` | `/batch/:batchId` | Estado de todos los trabajos de un lote |
| `GET` | `/status/:jobId` | Progreso de un trabajo, por step |
| `GET` | `/artifacts/:jobId` | Lista los archivos generados por step |
| `GET` | `/artifacts/:jobId/:stepName/:filename` | Descarga un archivo generado |

#### `POST /process`

Recibe `multipart/form-data` con un MP4 de hasta 500 MB en el campo `video`.

```json
{
  "jobId": "uuid",
  "videoUrl": "/artifacts/uuid/output/video.mp4",
  "artifacts": {
    "whisper": ["/artifacts/uuid/whisper/transcript.json"]
  },
  "duration_seconds": 182.4
}
```

| Código | Significado |
|--------|-------------|
| 200 | Video procesado |
| 400 | No se envió ningún archivo |
| 408 | Se superó `PROCESS_TIMEOUT_MS` |
| 413 | El archivo supera los 500 MB |
| 415 | El archivo no es `video/mp4` |
| 500 | Falló un step; `error` indica `step`, `exitCode` y `message` |

#### `POST /batch`

Recibe hasta `MAX_BATCH_SIZE` archivos en el campo `videos`.

```bash
curl -X POST http://localhost:3000/batch \
  -F "videos=@uno.mp4;type=video/mp4" \
  -F "videos=@dos.mp4;type=video/mp4"
```

La respuesta incluye `batchId` y un `jobId` por archivo. Si se excede el límite de archivos, responde 413. Consultá el avance con `GET /batch/:batchId` o `GET /status/:jobId`.

### API de Studio (puerto 3123)

Si Basic Auth está activo, todas estas rutas requieren credenciales.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` / `PUT` | `/api/config` | Lee o guarda la configuración de estilo activa |
| `POST` | `/api/render` | Envía videos a `/batch` de la API |
| `GET` | `/api/status/:jobId` | Consulta el progreso del render |
| `GET` | `/api/result/:jobId` | Descarga el video terminado |
| `GET` / `POST` | `/api/profiles` | Lista o crea perfiles |
| `GET` / `PATCH` / `DELETE` | `/api/profiles/:slug` | Lee, renombra o elimina un perfil |
| `PUT` | `/api/profiles/:slug/apply` | Aplica un perfil como configuración activa |
| `POST` | `/api/metadata` | Genera metadata para una red |
| `POST` | `/api/metadata/all` | Genera metadata para todas las redes |
| `GET` | `/api/metadata/:jobId` | Lee la metadata guardada por `POST /api/metadata` |
| `GET` | `/api/metadata-all/:jobId` | Lee la metadata guardada de todas las redes |

Las rutas de metadata requieren un `jobId` con formato UUID, por lo que no funcionan con trabajos de `process.sh`. También requieren `tone` (`cercano`, `profesional` o `llamativo`); `POST /api/metadata` además pide `platform` (`tiktok`, `instagram` o `youtube_shorts`).

## Scripts y automatización

| Script | Descripción |
|--------|-------------|
| `scripts/batch-run.sh` | Ejecuta el pipeline para cada MP4 de `videos/`. Modifica `.env` temporalmente y lo restaura al salir |
| `scripts/custom-batch.sh` | Genera 18 variantes del layout `sentence` con distintas fuentes y colores |
| `scripts/smoke-test.sh` | Prueba end-to-end de la infraestructura |
| `scripts/test-ffmpeg-finalizer.sh` | Prueba de `ffmpeg-finalizer` en Docker |
| `scripts/test-remotion-renderer.sh` | Prueba de `remotion-renderer` en Docker |
| `scripts/test-remotion-studio.sh` | Prueba de `remotion-studio` en Docker |
| `scripts/uat-silence-cutter.sh` | Prueba de aceptación de `silence-cutter` |
| `scripts/visual-test-finalizer.sh` | Prueba visual de `ffmpeg-finalizer` |
| `scripts/visual-ab-phase-13.sh` | Comparación visual A/B de calidad de codificación |

## Docker

### Servicios

| Servicio | Tipo | Puerto | Descripción |
|----------|------|--------|-------------|
| `redis` | Permanente | `6379` | Cola y progreso, con persistencia AOF en el volumen `redis-data` |
| `api-server` | Permanente | `3000` | API, worker y orquestador; monta el socket de Docker |
| `remotion-studio` | Permanente | `3123` | Editor web y API de configuración |
| `cloudflared` | Opcional | Ninguno | Publica Studio mediante Cloudflare Tunnel |
| `whisper`, `silence-cutter`, `ffmpeg-finalizer`, `remotion-renderer`, `quality-finalizer`, `srt-exporter` | Por trabajo | Ninguno | Steps del pipeline |
| `smoke-test` | Por trabajo | Ninguno | Step de prueba de la infraestructura |
| `base-python`, `base-node` | Solo build | Ninguno | Imágenes base |

Levantá los servicios por nombre: un `docker compose up` sin argumentos también intentaría ejecutar los steps y `cloudflared`.

### Imágenes

- `base-python` usa `python:3.12-slim` y `base-node` usa `node:22-bookworm-slim`. Ambas compilan FFmpeg 7.1.1 en una etapa de build separada; la versión se fija con `FFMPEG_VERSION` en sus Dockerfiles.
- `quality-finalizer` pertenece al perfil `pipeline`, por lo que `docker compose build` no lo incluye si no se indica `--profile pipeline`.
- `remotion-renderer` corre con 2 GB de memoria compartida (`shm`), con concurrencia de render 2 y escala 1.
- `remotion-studio` compila la interfaz durante el build, así que los cambios en el editor requieren reconstruir la imagen.

### Volúmenes y redes

- `./pipeline` se monta en `/data/pipeline` y es el espacio compartido entre todos los servicios.
- `pipeline-net` conecta los servicios y steps entre sí.
- `docker-network` es una red externa a la que se conecta `api-server`, y debe existir antes de levantarlo.
- Los servicios que llaman a procesos del host usan `host.docker.internal`, resuelto con `host-gateway`.

### Comandos

```bash
docker compose ps                         # Estado de los servicios
docker compose logs -f api-server         # Logs de la API y del orquestador
docker compose build remotion-renderer    # Reconstruir un step después de cambiarlo
docker compose stop                       # Detener los servicios
```

### Publicar Studio

1. Definí `STUDIO_BASIC_AUTH_USER`, `STUDIO_BASIC_AUTH_PASSWORD` y `CLOUDFLARE_TUNNEL_TOKEN` en `.env`.
2. En Cloudflare Zero Trust, apuntá el hostname público a `http://remotion-studio:3123`.
3. Levantá el conector:

```bash
docker compose up -d remotion-studio cloudflared
```

## Deploy

El instalador prepara un servidor Linux desde cero: instala Docker si falta, clona el proyecto en `/opt/luishelgueradev/reel-factory`, completa `.env`, construye las imágenes y verifica los servicios.

```bash
curl -sL https://raw.githubusercontent.com/luishelgueradev/reel-factory/main/install.sh | bash
```

A diferencia de la instalación local, deja la API solo en `127.0.0.1`, no publica Redis y activa siempre la autenticación de Studio. Para actualizar, se vuelve a correr el mismo comando; `.env` y `pipeline/` se conservan. El detalle de acceso, variables y resolución de problemas está en [DEPLOY.md](DEPLOY.md).

## Estado del proyecto

- Versiones v1.0 a v1.4 publicadas: pipeline completo, calidad de video, Whisper externo, rediseño de Studio, render desde la interfaz, perfiles y metadata con IA.
- Milestone actual: **v1.5, Controles de edición pro del Studio**. Sus 3 fases (27 a 29) están implementadas, de un total de 29 en el proyecto.
- Pendiente para cerrar v1.5: prueba de aceptación en vivo y auditoría del milestone.
- Último avance registrado: 2026-06-08.
