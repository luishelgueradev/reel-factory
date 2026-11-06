#!/bin/bash
# =============================================================================
# Reel Factory — Instalador automatico
# =============================================================================
# Uso:
#   curl -sL https://raw.githubusercontent.com/luishelgueradev/reel-factory/main/install.sh | bash
#
# O desde la maquina:
#   bash /opt/luishelgueradev/reel-factory/install.sh
#
# Que hace:
#   - Instala lo que falte: git, curl, Docker, Compose >= 2.24 y buildx
#   - Clona o actualiza el repo en /opt/luishelgueradev/reel-factory, sin tocar pipeline/
#   - Completa .env (permisos 600) preguntando solo lo que no puede resolver
#   - Crea un override de Compose para esta maquina: grupo del socket de Docker y
#     publicacion de puertos (API en loopback, Redis sin publicar)
#   - Crea las redes externas que declare el compose
#   - Construye las imagenes y levanta redis, api-server y remotion-studio
#   - Publica Studio con Cloudflare Tunnel si hay token
#   - Verifica la salud de los servicios y el acceso a los servicios externos
#
# Sin terminal, las respuestas se pasan como variables de entorno:
#   WHISPER_API_URL, WHISPER_API_KEY, CLOUDFLARE_TUNNEL_TOKEN, STUDIO_BIND,
#   STUDIO_BASIC_AUTH_USER, STUDIO_BASIC_AUTH_PASSWORD, METADATA_API_URL,
#   METADATA_API_KEY, METADATA_MODEL, API_PORT, STUDIO_PORT, API_BIND
#
# Requisitos:
#   Linux con systemd o Docker ya corriendo, y root o sudo.
#   whisper-api accesible para procesar videos (servicio aparte).
# =============================================================================

set -euo pipefail

# -- Config ------------------------------------------------------------------
GIT_USER="luishelgueradev"
APP_NAME="reel-factory"
INSTALL_DIR="${INSTALL_DIR:-/opt/${GIT_USER}/${APP_NAME}}"
REPO_URL="${REPO_URL:-https://github.com/${GIT_USER}/${APP_NAME}.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
COMPOSE_MIN_VERSION="2.24.0"
PROJECT_NAME="$APP_NAME"            # Debe coincidir con PIPELINE_NETWORK
DEFAULT_PIPELINE_NETWORK="${PROJECT_NAME}_pipeline-net"
DEFAULT_TIMEOUT_MS="10800000"       # 3 horas: el default real de la API
HEALTH_RETRIES=60
HEALTH_INTERVAL=3

ENV_FILE="${INSTALL_DIR}/.env"
OVERRIDE_FILE="${INSTALL_DIR}/docker-compose.override.yml"
FRESH_ENV=0
ADDED_TO_DOCKER_GROUP=0
GENERATED_PASSWORD=0

# -- Colores -----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

# -- Helpers -----------------------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }

SUDO=""
PKG=""
TTY=""
DOCKER=(docker)

detect_environment() {
  [ "$(uname -s)" = "Linux" ] || error "Este instalador solo soporta Linux."

  if [ "$(id -u)" -ne 0 ]; then
    if have sudo; then SUDO="sudo"; else error "Necesito root o sudo para instalar dependencias y crear ${INSTALL_DIR}."; fi
  fi

  local c
  for c in apt-get dnf yum apk pacman; do
    if have "$c"; then PKG="$c"; break; fi
  done

  # Bajo `curl | bash`, stdin es el script: los prompts leen de la terminal.
  if (exec </dev/tty) 2>/dev/null; then TTY="/dev/tty"; fi

  REAL_USER="${SUDO_USER:-$(id -un)}"
  REAL_UID="$(id -u "$REAL_USER")"
  REAL_GID="$(id -g "$REAL_USER")"
}

pkg_install() {
  case "$PKG" in
    apt-get) $SUDO apt-get update -qq && $SUDO apt-get install -y -qq "$@" ;;
    dnf|yum) $SUDO "$PKG" install -y "$@" ;;
    apk)     $SUDO apk add --no-cache "$@" ;;
    pacman)  $SUDO pacman -Sy --noconfirm "$@" ;;
    *)       return 1 ;;
  esac
}

ensure_cmd() {
  local cmd="$1" pkg="${2:-$1}"
  if have "$cmd"; then ok "$cmd presente"; return 0; fi
  info "Falta '$cmd', instalando ($pkg)..."
  if pkg_install "$pkg" && have "$cmd"; then
    ok "$cmd instalado"
  else
    error "No pude instalar '$cmd' automaticamente. Instala el paquete '$pkg' y reintenta."
  fi
}

gen_secret() { head -c 48 /dev/urandom | base64 | tr -d '/+=\n' | cut -c1-40; }

# -- .env --------------------------------------------------------------------
env_has() { grep -q "^$1=" "$ENV_FILE" 2>/dev/null; }

env_get() {
  local v
  v="$(grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

# Escribe KEY='valor'. Las comillas simples evitan que Compose interpole $ y #.
# El valor viaja por el entorno para no aparecer en la lista de procesos.
env_set() {
  local key="$1" value="$2" tmp
  case "$value" in
    *"'"*|*$'\n'*) error "El valor de $key no puede contener comillas simples ni saltos de linea." ;;
  esac
  tmp="$(mktemp "${ENV_FILE}.XXXXXX")"
  chmod 600 "$tmp"
  ENV_KEY="$key" ENV_VALUE="$value" awk '
    BEGIN { k = ENVIRON["ENV_KEY"]; line = k "=\047" ENVIRON["ENV_VALUE"] "\047"; done = 0 }
    index($0, k "=") == 1 { if (!done) { print line; done = 1 } next }
    { print }
    END { if (!done) print line }
  ' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
}

# ask KEY "Pregunta" "default" [secret|plain] [required|optional]
# Prioridad: entorno, luego .env existente, luego terminal, luego default.
ask() {
  local key="$1" msg="$2" def="${3:-}" kind="${4:-plain}" need="${5:-optional}"
  local value="${!key:-}" current=""

  if [ -z "$value" ] && env_has "$key"; then
    current="$(env_get "$key")"
    if [ "$FRESH_ENV" -eq 0 ]; then
      [ -n "$current" ] && return 0
      [ "$need" = "optional" ] && return 0
    fi
    [ -n "$current" ] && def="$current"
  fi

  if [ -z "$value" ]; then
    if [ -n "$TTY" ]; then
      if [ "$kind" = "secret" ]; then
        read -r -s -p "$msg: " value < "$TTY"
        echo ""
      elif [ -n "$def" ]; then
        read -r -p "$msg [$def]: " value < "$TTY"
      else
        read -r -p "$msg: " value < "$TTY"
      fi
    fi
    value="${value:-$def}"
  fi

  env_set "$key" "$value"
}

# -- Docker ------------------------------------------------------------------
dc() { (cd "$INSTALL_DIR" && "${DOCKER[@]}" compose "$@"); }

version_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]; }

ensure_docker() {
  if ! have docker; then
    info "Instalando Docker con el script oficial..."
    curl -fsSL https://get.docker.com | $SUDO sh
  fi
  ok "docker presente"

  if ! docker info >/dev/null 2>&1 && ! $SUDO docker info >/dev/null 2>&1; then
    info "Arrancando el daemon de Docker..."
    if have systemctl; then
      $SUDO systemctl enable --now docker
    elif have service; then
      $SUDO service docker start
    fi
    local i
    for i in $(seq 1 20); do
      if $SUDO docker info >/dev/null 2>&1; then break; fi
      sleep 1
    done
    $SUDO docker info >/dev/null 2>&1 || error "El daemon de Docker no responde."
  fi

  if docker info >/dev/null 2>&1; then
    DOCKER=(docker)
  else
    DOCKER=($SUDO docker)
  fi

  if ! id -nG "$REAL_USER" | grep -qw docker && getent group docker >/dev/null 2>&1; then
    info "Agregando $REAL_USER al grupo docker..."
    if $SUDO usermod -aG docker "$REAL_USER" 2>/dev/null; then ADDED_TO_DOCKER_GROUP=1; fi
  fi
}

ensure_compose() {
  local version=""
  version="$("${DOCKER[@]}" compose version --short 2>/dev/null | sed 's/^v//' || true)"
  if [ -n "$version" ] && version_ge "$version" "$COMPOSE_MIN_VERSION"; then
    ok "docker compose $version"
    return 0
  fi

  info "Instalando el plugin de Docker Compose (se requiere >= ${COMPOSE_MIN_VERSION})..."
  local plugin_dir="/usr/local/lib/docker/cli-plugins"
  $SUDO mkdir -p "$plugin_dir"
  $SUDO curl -fsSL -o "${plugin_dir}/docker-compose" \
    "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)"
  $SUDO chmod +x "${plugin_dir}/docker-compose"
  version="$("${DOCKER[@]}" compose version --short | sed 's/^v//')"
  version_ge "$version" "$COMPOSE_MIN_VERSION" || error "Docker Compose $version es demasiado antiguo."
  ok "docker compose $version"
}

ensure_buildx() {
  if "${DOCKER[@]}" buildx version >/dev/null 2>&1; then ok "docker buildx presente"; return 0; fi
  info "Instalando docker buildx..."
  case "$PKG" in
    apt-get) pkg_install docker-buildx-plugin || pkg_install docker-buildx ;;
    dnf|yum) pkg_install docker-buildx-plugin ;;
    apk)     pkg_install docker-cli-buildx ;;
    pacman)  pkg_install docker-buildx ;;
    *)       false ;;
  esac || error "No pude instalar docker buildx. Instalalo y reintenta."
  ok "docker buildx instalado"
}

# -- Repositorio -------------------------------------------------------------
# Otro checkout con el mismo nombre de proyecto compartiria contenedores y red.
protect_existing_project() {
  local other
  other="$("${DOCKER[@]}" ps -a --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
    --format '{{.Label "com.docker.compose.project.working_dir"}}' 2>/dev/null \
    | sort -u | grep -vxF "$INSTALL_DIR" | grep -v '^$' | head -n1 || true)"
  [ -z "$other" ] && return 0

  warn "Ya hay contenedores de '${PROJECT_NAME}' creados desde ${other}."
  warn "Continuar los reemplazaria por los de ${INSTALL_DIR}. Sus datos en disco no se borran."
  if [ "${ALLOW_PROJECT_TAKEOVER:-0}" = "1" ]; then return 0; fi
  if [ -n "$TTY" ]; then
    local answer=""
    read -r -p "Escribi 'reemplazar' para continuar: " answer < "$TTY"
    [ "$answer" = "reemplazar" ] && return 0
  fi
  error "Instalacion cancelada para no pisar ${other}. Para continuar sin terminal, usa ALLOW_PROJECT_TAKEOVER=1."
}

prepare_install_dir() {
  local parent
  parent="$(dirname "$INSTALL_DIR")"
  $SUDO mkdir -p "$parent"
  $SUDO chown "$REAL_USER:$REAL_GID" "$parent" 2>/dev/null || true

  if [ -e "$INSTALL_DIR" ] && [ ! -d "$INSTALL_DIR/.git" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    local backup
    backup="${INSTALL_DIR}.backup-$(date +%Y%m%d-%H%M%S)"
    warn "${INSTALL_DIR} existe y no es un repo git. Lo muevo a ${backup}."
    $SUDO mv "$INSTALL_DIR" "$backup"
  fi
}

# Actualiza en el lugar: pipeline/ guarda videos, perfiles y configuracion activa,
# y .env y el override no estan versionados. Nunca se elimina el directorio.
sync_repo() {
  local git_cmd=(git -c "safe.directory=${INSTALL_DIR}" -C "$INSTALL_DIR")

  if [ -d "$INSTALL_DIR/.git" ]; then
    local remote dirty
    remote="$("${git_cmd[@]}" remote get-url origin 2>/dev/null || true)"
    [ "${remote%.git}" = "${REPO_URL%.git}" ] \
      || error "${INSTALL_DIR} apunta a otro repositorio (${remote}). Abortando para no pisarlo."

    dirty="$("${git_cmd[@]}" status --porcelain | wc -l)"
    [ "$dirty" -eq 0 ] \
      || error "${INSTALL_DIR} tiene cambios sin commitear: parece un repo de desarrollo. Abortando para no pisarlo."

    info "Actualizando el repositorio..."
    "${git_cmd[@]}" fetch --quiet origin "$REPO_BRANCH"
    "${git_cmd[@]}" checkout --quiet "$REPO_BRANCH"
    "${git_cmd[@]}" merge --quiet --ff-only "origin/${REPO_BRANCH}"
    ok "Repositorio actualizado"
  else
    info "Clonando ${REPO_URL} (${REPO_BRANCH})..."
    $SUDO mkdir -p "$INSTALL_DIR"
    $SUDO chown "$REAL_USER:$REAL_GID" "$INSTALL_DIR"
    if [ "$(id -u)" -eq 0 ] && [ "$REAL_USER" != "root" ]; then
      su "$REAL_USER" -c "git clone --quiet --branch '$REPO_BRANCH' '$REPO_URL' '$INSTALL_DIR'"
    else
      git clone --quiet --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
    fi
    ok "Repositorio clonado en ${INSTALL_DIR}"
  fi

  # El override es propio de esta maquina y no debe contar como cambio local.
  local exclude="${INSTALL_DIR}/.git/info/exclude"
  grep -qxF "docker-compose.override.yml" "$exclude" 2>/dev/null \
    || echo "docker-compose.override.yml" >> "$exclude"

  mkdir -p "${INSTALL_DIR}/pipeline" "${INSTALL_DIR}/videos"
  chown "$REAL_UID:$REAL_GID" "${INSTALL_DIR}/pipeline" "${INSTALL_DIR}/videos" 2>/dev/null \
    || $SUDO chown "$REAL_UID:$REAL_GID" "${INSTALL_DIR}/pipeline" "${INSTALL_DIR}/videos"
}

# -- Configuracion -----------------------------------------------------------
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

next_free_port() {
  local port="$1"
  while port_busy "$port"; do port=$((port + 1)); done
  echo "$port"
}

configure_env() {
  if [ ! -f "$ENV_FILE" ]; then
    cp "${INSTALL_DIR}/.env.example" "$ENV_FILE"
    FRESH_ENV=1
    info "Creando .env"
  else
    # Agrega las claves nuevas de .env.example sin tocar las existentes.
    local key line
    while IFS= read -r line; do
      case "$line" in \#*|'') continue ;; esac
      key="${line%%=*}"
      env_has "$key" || echo "$line" >> "$ENV_FILE"
    done < "${INSTALL_DIR}/.env.example"
    info "Conservando el .env existente"
  fi
  chmod 600 "$ENV_FILE"
  chown "$REAL_UID:$REAL_GID" "$ENV_FILE" 2>/dev/null || true

  env_set UID "$REAL_UID"
  env_set GID "$REAL_GID"
  env_set COMPOSE_PROJECT_NAME "$PROJECT_NAME"
  env_set HOST_PIPELINE_DIR "${INSTALL_DIR}/pipeline"
  env_set PIPELINE_NETWORK "$DEFAULT_PIPELINE_NETWORK"
  # .env.example trae 10 minutos, poco para un render largo.
  [ "$FRESH_ENV" -eq 1 ] && env_set PROCESS_TIMEOUT_MS "$DEFAULT_TIMEOUT_MS"

  # Solo la primera vez: en una reinstalacion, los puertos ocupados son los propios.
  if [ "$FRESH_ENV" -eq 1 ]; then
    ask API_PORT "Puerto de la API" "$(next_free_port "$(env_get API_PORT)")"
    ask STUDIO_PORT "Puerto de Studio" "$(next_free_port "$(env_get STUDIO_PORT)")"
  fi

  echo ""
  info "whisper-api transcribe los videos y corre aparte de este proyecto."
  ask WHISPER_API_URL "URL de whisper-api" "http://host.docker.internal:8000"
  ask WHISPER_API_KEY "API key de whisper-api (Enter si todavia no la tenes)" "" secret required

  echo ""
  info "Studio se protege siempre con usuario y contrasena."
  ask STUDIO_BASIC_AUTH_USER "Usuario de Studio" "admin" plain required
  ask STUDIO_BASIC_AUTH_PASSWORD "Contrasena de Studio (Enter para generar una)" "" secret required
  if [ -z "$(env_get STUDIO_BASIC_AUTH_USER)" ]; then env_set STUDIO_BASIC_AUTH_USER "admin"; fi
  if [ -z "$(env_get STUDIO_BASIC_AUTH_PASSWORD)" ]; then
    env_set STUDIO_BASIC_AUTH_PASSWORD "$(gen_secret)"
    GENERATED_PASSWORD=1
  fi

  echo ""
  info "Cloudflare Tunnel es opcional y publica Studio en un dominio propio."
  ask CLOUDFLARE_TUNNEL_TOKEN "Token de Cloudflare Tunnel (Enter para omitir)" "" secret optional
  info "Sin tunel, 127.0.0.1 deja Studio accesible solo por SSH. 0.0.0.0 lo expone por HTTP sin cifrar."
  ask STUDIO_BIND "IP donde publicar Studio" "127.0.0.1"
  ask API_BIND "IP donde publicar la API (no tiene autenticacion)" "127.0.0.1"

  echo ""
  info "La metadata con IA es opcional y usa un router compatible con OpenAI."
  ask METADATA_API_KEY "Token del router de LLM (Enter para omitir)" "" secret optional
  if [ -n "$(env_get METADATA_API_KEY)" ]; then
    ask METADATA_API_URL "URL del router de LLM" "http://host.docker.internal:3210"
    ask METADATA_MODEL "Modelo (big-cloud o chat-local)" "big-cloud"
  fi

  chown "$REAL_UID:$REAL_GID" "$ENV_FILE" 2>/dev/null || true
  ok ".env listo (permisos 600)"
}

write_override() {
  local socket_gid group_block=""
  socket_gid="$(stat -c '%g' /var/run/docker.sock 2>/dev/null || true)"
  if [ -n "$socket_gid" ]; then
    group_block="    group_add:
      - \"${socket_gid}\""
  fi

  cat > "$OVERRIDE_FILE" <<EOF
# Generado por install.sh: ajustes propios de esta maquina. No editar a mano.
services:
  api-server:
${group_block}
    ports: !override
      - "$(env_get API_BIND):\${API_PORT:-3000}:3000"
  remotion-studio:
    ports: !override
      - "$(env_get STUDIO_BIND):\${STUDIO_PORT:-3123}:3123"
  redis:
    # Solo lo usan los servicios internos. Sin publicar no choca con otro Redis.
    ports: !reset []
EOF
  chown "$REAL_UID:$REAL_GID" "$OVERRIDE_FILE" 2>/dev/null || true
  dc config --quiet || error "La configuracion de Compose no es valida. Revisa ${OVERRIDE_FILE} y .env."
  ok "Override de Compose generado"
}

ensure_external_networks() {
  local net
  for net in $(awk '
      /^networks:/ { s = 1; next }
      /^[^ #]/     { s = 0 }
      s && /^  [A-Za-z0-9_.-]+:/ { n = $1; sub(":", "", n) }
      s && /external: *true/     { print n }
    ' "${INSTALL_DIR}/docker-compose.yml"); do
    if "${DOCKER[@]}" network inspect "$net" >/dev/null 2>&1; then
      ok "Red externa '$net' presente"
    else
      info "Creando la red externa '$net'..."
      "${DOCKER[@]}" network create "$net" >/dev/null
      ok "Red externa '$net' creada"
    fi
  done
}

# -- Build y arranque --------------------------------------------------------
build_images() {
  info "Construyendo imagenes base. La primera vez compila FFmpeg y tarda varios minutos..."
  dc build base-python base-node
  info "Construyendo los servicios y steps..."
  dc --profile pipeline build
  ok "Imagenes construidas"
}

start_services() {
  info "Levantando redis, api-server y remotion-studio..."
  dc up -d redis api-server remotion-studio

  if [ -n "$(env_get CLOUDFLARE_TUNNEL_TOKEN)" ]; then
    info "Levantando Cloudflare Tunnel..."
    dc up -d cloudflared
  else
    dc stop cloudflared >/dev/null 2>&1 || true
  fi
}

local_host_for() {
  case "$1" in
    0.0.0.0|'') echo "127.0.0.1" ;;
    *)          echo "$1" ;;
  esac
}

show_logs_and_fail() {
  warn "Ultimos logs de $1:"
  dc logs --tail 30 "$1" || true
  error "$1 no quedo saludable."
}

wait_for_health() {
  local api_url i body="" studio_id status=""
  api_url="http://$(local_host_for "$(env_get API_BIND)"):$(env_get API_PORT)/health"

  info "Esperando a api-server..."
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    body="$(curl -sf "$api_url" 2>/dev/null || true)"
    case "$body" in *'"status":"ok"'*) break ;; esac
    body=""
    sleep "$HEALTH_INTERVAL"
  done
  [ -n "$body" ] || show_logs_and_fail api-server
  ok "api-server saludable"

  info "Esperando a remotion-studio..."
  studio_id="$(dc ps -q remotion-studio)"
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    status="$("${DOCKER[@]}" inspect --format '{{.State.Health.Status}}' "$studio_id" 2>/dev/null || true)"
    [ "$status" = "healthy" ] && break
    sleep "$HEALTH_INTERVAL"
  done
  [ "$status" = "healthy" ] || show_logs_and_fail remotion-studio
  ok "remotion-studio saludable"
}

# Prueba desde un contenedor como el que lanza el orquestador. Cualquier respuesta
# HTTP, incluso un error, significa que el servicio es accesible.
WHISPER_OK=0
ROUTER_OK=0

check_external_services() {
  local whisper_url
  whisper_url="$(env_get WHISPER_API_URL)"
  if "${DOCKER[@]}" run --rm --network "$DEFAULT_PIPELINE_NETWORK" \
      --add-host host.docker.internal:host-gateway \
      -e "TARGET_URL=${whisper_url}" --entrypoint python \
      reel-factory-whisper-http-step -c '
import os, sys, urllib.error, urllib.request
try:
    urllib.request.urlopen(os.environ["TARGET_URL"], timeout=8)
except urllib.error.HTTPError:
    pass
except Exception:
    sys.exit(1)
' >/dev/null 2>&1; then
    WHISPER_OK=1
    ok "whisper-api accesible en ${whisper_url}"
  else
    warn "No pude llegar a whisper-api en ${whisper_url}. Sin ese servicio, los videos fallan en el primer step."
    warn "Si corre en esta maquina, debe escuchar en 0.0.0.0, no solo en 127.0.0.1."
  fi

  if [ -n "$(env_get METADATA_API_KEY)" ]; then
    if dc exec -T remotion-studio node -e \
        'fetch(process.env.METADATA_API_URL,{signal:AbortSignal.timeout(8000)}).then(()=>process.exit(0)).catch(()=>process.exit(1))' \
        >/dev/null 2>&1; then
      ROUTER_OK=1
      ok "Router de LLM accesible"
    else
      warn "No pude llegar al router de LLM. La generacion de metadata va a fallar hasta resolverlo."
      warn "Si corre en esta maquina, debe escuchar en 0.0.0.0, no solo en 127.0.0.1."
    fi
  fi
}

print_summary() {
  local api_host studio_host studio_port api_port host_ip
  api_host="$(env_get API_BIND)"
  studio_host="$(env_get STUDIO_BIND)"
  api_port="$(env_get API_PORT)"
  studio_port="$(env_get STUDIO_PORT)"
  host_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  host_ip="${host_ip:-IP_DEL_SERVIDOR}"

  echo ""
  echo "=========================================="
  echo "  Reel Factory instalado"
  echo "=========================================="
  echo ""
  echo "  Directorio: ${INSTALL_DIR}"
  echo "  Estado:     cd ${INSTALL_DIR} && ${DOCKER[*]} compose ps"
  echo "  Logs:       cd ${INSTALL_DIR} && ${DOCKER[*]} compose logs -f api-server"
  echo ""
  if [ "$studio_host" = "127.0.0.1" ]; then
    echo "  Studio:     http://127.0.0.1:${studio_port} (en este servidor)"
    echo "  Por SSH:    ssh -L ${studio_port}:127.0.0.1:${studio_port} ${REAL_USER}@${host_ip}"
  else
    [ "$studio_host" = "0.0.0.0" ] && studio_host="$host_ip"
    echo "  Studio:     http://${studio_host}:${studio_port}"
  fi
  if [ "$api_host" = "0.0.0.0" ]; then api_host="$host_ip"; fi
  echo "  API:        http://${api_host}:${api_port}"
  echo "  Credenciales de Studio: grep '^STUDIO_BASIC_AUTH' ${ENV_FILE}"
  if [ "$GENERATED_PASSWORD" -eq 1 ]; then
    echo "  (la contrasena se genero automaticamente)"
  fi
  echo ""

  if [ -n "$(env_get CLOUDFLARE_TUNNEL_TOKEN)" ]; then
    echo "  Tunel: en Cloudflare Zero Trust, apunta el hostname publico a"
    echo "         http://remotion-studio:3123"
    echo ""
  fi
  if [ "$WHISPER_OK" -eq 0 ] || [ -z "$(env_get WHISPER_API_KEY)" ]; then
    warn "Falta dejar operativa whisper-api: hasta entonces no se pueden procesar videos."
    warn "Completa WHISPER_API_URL y WHISPER_API_KEY en ${ENV_FILE} y volve a correr este instalador."
  fi
  if [ "$ADDED_TO_DOCKER_GROUP" -eq 1 ]; then
    warn "Se agrego ${REAL_USER} al grupo docker. Volve a iniciar sesion para usar docker sin sudo."
  fi
}

# -- Principal ---------------------------------------------------------------
# Todo corre desde main para que el script se lea completo antes de ejecutarse:
# actualizar el repo puede reescribir este archivo.
main() {
  echo ""
  echo "=========================================="
  echo "  Reel Factory — Instalador"
  echo "=========================================="
  echo ""

  detect_environment
  ensure_cmd curl
  ensure_cmd git
  ensure_docker
  ensure_compose
  ensure_buildx
  protect_existing_project
  prepare_install_dir
  sync_repo
  configure_env
  write_override
  ensure_external_networks
  build_images
  start_services
  wait_for_health
  check_external_services
  print_summary
}

main "$@"
