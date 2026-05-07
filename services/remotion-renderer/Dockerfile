FROM video-pipeline-base-node:latest

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install && \
    npx remotion browser ensure && \
    npm cache clean --force

COPY tsconfig.json remotion.config.ts ./
COPY src/ src/

RUN mkdir -p /app/public && chmod -R 777 /app/public && chmod 777 /app

CMD ["npx", "tsx", "src/render.ts"]