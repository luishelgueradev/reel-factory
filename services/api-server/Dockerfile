# API Server: Express.js REST API for pipeline orchestration
# Per D-01: Node.js 22 container with Docker CLI for sibling container management
FROM node:22-bookworm-slim

# Install docker-cli for Docker-in-Docker socket access (D-01, D-06)
# The API container needs docker CLI to run pipeline containers as siblings
# via the mounted Docker socket, NOT docker compose (which requires compose plugin)
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && apt-get purge -y gnupg \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Copy application source
COPY src/ ./src/
COPY tsconfig.json ./

# Verify the container can run the app
RUN npx tsx --version

EXPOSE 3000

# Add node user to docker group so it can access the Docker socket
# The GID must match the host's docker group (varies by system: 998, 1001, etc.)
ARG DOCKER_GID=1001
RUN if getent group docker >/dev/null 2>&1; then \
        EXISTING_GID=$(getent group docker | cut -d: -f3); \
        if [ "$EXISTING_GID" != "${DOCKER_GID}" ]; then \
            groupmod -g ${DOCKER_GID} docker; \
        fi; \
    else \
        groupadd -g ${DOCKER_GID} docker; \
    fi \
    && usermod -aG docker node

# Run the API server using tsx for TypeScript execution
CMD ["npx", "tsx", "src/index.ts"]