FROM video-pipeline-base-node:latest

WORKDIR /app

# Copy shared Remotion source from renderer (D-14: both containers share same compositions)
# Uses Docker BuildKit additional_contexts named 'renderer-src' from docker-compose.yml
COPY --from=renderer-src compositions/ /app/remotion-renderer-src/compositions/
COPY --from=renderer-src Root.tsx /app/remotion-renderer-src/Root.tsx
COPY --from=renderer-src captions.ts /app/remotion-renderer-src/captions.ts
COPY --from=renderer-src pipeline-config.ts /app/remotion-renderer-src/pipeline-config.ts
COPY --from=renderer-src fonts.ts /app/remotion-renderer-src/fonts.ts

# Install dependencies and ensure Chrome is available for Remotion Studio
COPY package.json package-lock.json* ./
RUN npm install && \
    npx remotion browser ensure && \
    npm cache clean --force

# Copy studio source
COPY src/ ./src/
COPY tsconfig.json ./

# Copy shared compositions from renderer staging area (D-14: same source code for preview and render)
RUN cp -r /app/remotion-renderer-src/compositions/* /app/src/compositions/ 2>/dev/null; \
    cp /app/remotion-renderer-src/Root.tsx /app/src/ && \
    cp /app/remotion-renderer-src/captions.ts /app/src/ && \
    cp /app/remotion-renderer-src/pipeline-config.ts /app/src/ && \
    cp /app/remotion-renderer-src/fonts.ts /app/src/ && \
    rm -rf /app/remotion-renderer-src

# Public directory for Remotion static file serving and sample video (D-06)
COPY public/ /app/public/
RUN chmod -R 777 /app/public

# Build the editor/preview SPA so the server can serve /editor and /preview.
# Without this the image has no dist/editor and those routes 404 in the container.
# vite.config.ts is required (it registers the React plugin and publicDir).
COPY vite.config.ts ./
RUN npm run build:editor

EXPOSE 3123

# Start the config API server (Remotion Studio is started via 'npx remotion studio' separately)
CMD ["npx", "tsx", "src/index.ts"]