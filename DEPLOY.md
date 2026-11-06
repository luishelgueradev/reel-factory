# Deploy — Reel Factory

## Instalacion rapida

```bash
curl -sL https://raw.githubusercontent.com/luishelgueradev/reel-factory/main/install.sh | bash
```

El instalador deja el proyecto en `/opt/luishelgueradev/reel-factory`. Instala lo que falte, pregunta solo lo que no puede resolver y se puede volver a correr para actualizar.

Para correrlo sin terminal, pasá las respuestas como variables de entorno:

```bash
curl -sL https://raw.githubusercontent.com/luishelgueradev/reel-factory/main/install.sh | \
  WHISPER_API_URL=http://host.docker.internal:8000 \
  WHISPER_API_KEY=tu_api_key_aqui \
  bash
```

## Requisitos

- Linux con root o `sudo`.
- Acceso a internet durante la instalacion.
- RAM suficiente para Chrome headless. Cada render usa 2 GB de memoria compartida y corre de a uno.
- Disco para las imagenes y los trabajos: `pipeline/` conserva los archivos intermedios y no se limpia de forma automatica.
- **whisper-api**, para procesar videos. Es un servicio aparte con su propio repositorio (`luishelgueradev/whisper`) y el instalador no lo instala.
- **Router de LLM compatible con OpenAI** (opcional), solo para generar metadata.

El instalador instala por su cuenta `git`, `curl`, Docker, Docker Compose 2.24 o superior y `buildx`.

## Arquitectura

Tres servicios quedan siempre activos: `api-server`, `redis` y `remotion-studio`. Por cada video, `api-server` usa el socket de Docker para lanzar un contenedor por step, en este orden:

```
Studio ──► api-server ◄──► redis
               │
               ▼ un contenedor por step
whisper ─► silence-cutter ─► ffmpeg-finalizer ─► remotion-renderer ─► quality-finalizer ─► srt-exporter
   │
   ▼
whisper-api (externo)
```

Montar el socket de Docker le da a `api-server` control total sobre el motor de Docker del servidor. Por eso su API no debe quedar expuesta.

### Archivos propios de cada maquina

El instalador genera dos archivos que Git no sigue:

| Archivo | Contenido |
|---------|-----------|
| `.env` | Configuracion y secretos, con permisos 600 |
| `docker-compose.override.yml` | Grupo del socket de Docker e IP de publicacion de cada puerto. Se regenera en cada corrida |

Compose carga el override de forma automatica. Para cambiar una IP de publicacion, editá `STUDIO_BIND` o `API_BIND` en `.env` y volvé a correr el instalador.

## Variables de entorno

La lista completa, con los ajustes de cada step, esta en `.env.example` y en la seccion Configuracion del `README.md`.

| Variable | Descripcion | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `WHISPER_API_URL` | URL de whisper-api | `http://host.docker.internal:8000` | Si |
| `WHISPER_API_KEY` | Credencial de whisper-api | `tu_api_key_aqui` | Si, para procesar videos |
| `STUDIO_BASIC_AUTH_USER` | Usuario de Studio | `admin` | Si (por defecto, `admin`) |
| `STUDIO_BASIC_AUTH_PASSWORD` | Contrasena de Studio | `tu_password_aqui` | Si (se genera si esta vacia) |
| `STUDIO_BIND` | IP donde se publica Studio | `127.0.0.1` | No |
| `API_BIND` | IP donde se publica la API | `127.0.0.1` | No |
| `API_PORT` | Puerto de la API | `3000` | No |
| `STUDIO_PORT` | Puerto de Studio | `3123` | No |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token del tunel | `tu_token_aqui` | No |
| `METADATA_API_KEY` | Token del router de LLM | `tu_token_aqui` | No |
| `METADATA_API_URL` | URL del router de LLM | `http://host.docker.internal:3210` | No |
| `METADATA_MODEL` | Alias del modelo | `big-cloud` | No |
| `PROCESS_TIMEOUT_MS` | Tiempo maximo de `POST /process`. El instalador usa 3 horas | `10800000` | No |
| `HOST_PIPELINE_DIR` | Ruta de `pipeline/` en el host. La define el instalador | `/opt/luishelgueradev/reel-factory/pipeline` | Si |

`MAX_CONCURRENT_JOBS` debe quedar en `1`: dos renders simultaneos agotan la memoria.

## Servicios

| Servicio | Puerto en el host | Descripcion |
|----------|-------------------|-------------|
| `api-server` | `127.0.0.1:3000` | API REST, worker y orquestador. Sin autenticacion |
| `remotion-studio` | `127.0.0.1:3123` | Editor web, protegido con Basic Auth |
| `redis` | Sin publicar | Cola y progreso, con datos en el volumen `redis-data` |
| `cloudflared` | Sin publicar | Tunel hacia Studio. Se levanta solo si hay token |

## Red y acceso

- **Redes Docker:** `reel-factory_pipeline-net` conecta servicios y steps. Si el compose declara redes externas, como `docker-network`, el instalador las crea cuando faltan.
- **Reverse proxy:** el proyecto usa Cloudflare Tunnel y no necesita Traefik ni Nginx.
- **Firewall:** los puertos publicados por Docker pueden saltear reglas de UFW. Por eso la API queda en `127.0.0.1` por defecto.

### Acceder a Studio

**Opcion A: Cloudflare Tunnel (recomendada para acceso publico)**

1. Crea un tunel en Cloudflare Zero Trust y pasale el token al instalador.
2. Apunta el hostname publico a `http://remotion-studio:3123`.

**Opcion B: tunel SSH**

```bash
ssh -L 3123:127.0.0.1:3123 usuario@IP_DEL_SERVIDOR
```

Despues abrí `http://localhost:3123`.

**Opcion C: red privada o IP directa**

Defini `STUDIO_BIND` con la IP de la red privada (por ejemplo, la de Tailscale) y volve a correr el instalador. Con `0.0.0.0` queda expuesto por HTTP sin cifrar, asi que las credenciales viajan en texto plano.

### Servicios externos en el mismo servidor

Los contenedores llegan al host con `host.docker.internal`, y esa direccion no alcanza a un servicio que escucha solo en `127.0.0.1`. Si whisper-api o el router corren en el mismo servidor, tienen que escuchar en `0.0.0.0` o en la IP del bridge de Docker. Al terminar, el instalador prueba el acceso desde un contenedor y avisa si falla.

## Comandos utiles

Desde `/opt/luishelgueradev/reel-factory`:

```bash
# Ver logs
docker compose logs -f api-server

# Reiniciar
docker compose restart api-server remotion-studio

# Detener
docker compose stop

# Estado
docker compose ps

# Salud de la API
curl http://127.0.0.1:3000/health

# Ver las credenciales de Studio
grep '^STUDIO_BASIC_AUTH' .env
```

Levantá siempre los servicios por nombre. Un `docker compose up` sin argumentos tambien intenta ejecutar los steps.

## Actualizacion

Volve a correr el instalador:

```bash
curl -sL https://raw.githubusercontent.com/luishelgueradev/reel-factory/main/install.sh | bash
```

Actualiza el codigo con fast-forward, reconstruye las imagenes y reinicia los servicios. Conserva `.env` y `pipeline/` (videos, perfiles y configuracion activa). Si el checkout tiene cambios sin commitear, se detiene para no pisarlos.

Evita actualizar con un render en curso: reiniciar `api-server` interrumpe el seguimiento del trabajo.

## Troubleshooting

| Problema | Causa probable | Solucion |
|----------|----------------|----------|
| El step `whisper` falla con un error de conexion | whisper-api caido o escuchando solo en `127.0.0.1` | Hacelo escuchar en `0.0.0.0` y revisa `WHISPER_API_URL` |
| El step `whisper` termina con `WHISPER_API_KEY environment variable is not set` | Falta la credencial | Completala en `.env` y volve a correr el instalador |
| `POST /api/metadata` responde 503 | Falta `METADATA_API_KEY` | Completala en `.env` y volve a correr el instalador |
| Chrome se cierra durante el render | Falta memoria | Libera RAM y no subas `MAX_CONCURRENT_JOBS` |
| `POST /process` responde 415 con `curl` | Falta el tipo MIME | Usa `-F "video=@video.mp4;type=video/mp4"` |
| `POST /process` responde 408 | Se supero `PROCESS_TIMEOUT_MS` | Subi el valor en `.env`. Los contenedores del trabajo siguen corriendo |
| `api-server` no puede usar Docker | Cambio el GID del socket | Volve a correr el instalador para regenerar el override |
| El instalador avisa sobre contenedores de otro directorio | Ya hay otra copia del proyecto en la maquina | Detene esa copia o confirma el reemplazo |
| El instalador se detiene por cambios sin commitear | El checkout de `/opt` fue modificado | Commitea o descarta esos cambios y reintenta |

## Estructura del proyecto

```
├── install.sh                     # Instalador
├── docker-compose.yml             # Servicios y steps
├── docker-compose.override.yml    # Generado por el instalador (no versionado)
├── .env                           # Generado por el instalador (no versionado)
├── .env.example                   # Lista de variables
├── services/                      # Un directorio por servicio o step
└── pipeline/                      # Trabajos, perfiles y configuracion activa (no versionado)
```
