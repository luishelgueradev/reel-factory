FROM video-pipeline-base-node:latest

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install && npm cache clean --force

COPY tsconfig.json ./
COPY src/ src/

CMD ["npx", "tsx", "src/srt-export.ts"]