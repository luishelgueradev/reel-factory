FROM node:22-bookworm-slim AS builder

ARG FFMPEG_VERSION=7.1.1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        nasm \
        yasm \
        libx264-dev \
        pkg-config \
        curl \
        xz-utils \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sL "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" -o /tmp/ffmpeg.tar.xz \
    && tar -xf /tmp/ffmpeg.tar.xz -C /tmp \
    && cd /tmp/ffmpeg-${FFMPEG_VERSION} \
    && ./configure \
        --prefix=/usr/local \
        --enable-gpl \
        --enable-libx264 \
        --enable-avfilter \
        --enable-small \
        --disable-doc \
        --disable-htmlpages \
        --disable-manpages \
        --disable-podpages \
        --disable-txtpages \
    && make -j$(nproc) \
    && make install \
    && rm -rf /tmp/ffmpeg*

FROM node:22-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
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
        libx264-164 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=builder /usr/local/bin/ffprobe /usr/local/bin/ffprobe
RUN chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe

RUN ffmpeg -version | head -1 && ffmpeg -encoders 2>/dev/null | grep -q libx264

RUN mkdir -p /data/pipeline

WORKDIR /app

CMD ["true"]