FROM video-pipeline-base-node:latest

WORKDIR /app

# Copy shared Remotion source from renderer (D-14: both containers share same compositions)
COPY --from=remotion-renderer /app/src /app/remotion-renderer-src

# Install dependencies and ensure Chrome is available for Remotion Studio
COPY package.json package-lock.json* ./
RUN npm install && \
    npx remotion browser ensure && \
    npm cache clean --force

# Copy studio source
COPY src/ ./src/
COPY tsconfig.json ./

# Copy shared compositions from renderer (D-14: same source code for preview and render)
RUN mkdir -p /app/src/compositions && \
    cp -r /app/remotion-renderer-src/compositions/* /app/src/compositions/ && \
    cp /app/remotion-renderer-src/Root.tsx /app/src/ && \
    cp /app/remotion-renderer-src/captions.ts /app/src/ && \
    cp /app/remotion-renderer-src/pipeline-config.ts /app/src/ && \
    cp /app/remotion-renderer-src/fonts.ts /app/src/ && \
    rm -rf /app/remotion-renderer-src

# Public directory for Remotion static file serving
RUN mkdir -p /app/public && chmod -R 777 /app/public && chmod 777 /app

EXPOSE 3123

# Start the config API server (Remotion Studio is started via 'npx remotion studio' separately)
CMD ["npx", "tsx", "src/index.ts"]