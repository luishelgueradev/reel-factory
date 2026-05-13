FROM node:22-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        xz-utils \
        ca-certificates \
        libnss3 \
        libdbus-1-3 \
        libatk1.0-0 \
        libgbm-dev \
        libasound2 \
        libxrandr2 \
        libxkbcommon-dev \
        libxfixes3 \
        libxcomposite1 \
        libxdamage1 \
        libatk-bridge2.0-0 \
        libpango-1.0-0 \
        libcairo2 \
        libcups2 \
      && curl -L "https://johnvansickle.com/ffmpeg/releases/ffmpeg-7.1.1-amd64-static.tar.xz" -o /tmp/ffmpeg.tar.xz \
      && tar -xf /tmp/ffmpeg.tar.xz -C /tmp \
      && FFDIR=$(ls -d /tmp/ffmpeg-*-amd64-static | head -1) \
      && cp "${FFDIR}/ffmpeg" /usr/local/bin/ \
      && cp "${FFDIR}/ffprobe" /usr/local/bin/ \
      && chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe \
      && rm -rf /tmp/ffmpeg* \
      && apt-get purge -y curl xz-utils \
      && apt-get autoremove -y \
      && apt-get clean \
      && rm -rf /var/lib/apt/lists/*

RUN ffmpeg -version | head -1 && ffprobe -version | head -1

RUN mkdir -p /data/pipeline

WORKDIR /app

CMD ["true"]