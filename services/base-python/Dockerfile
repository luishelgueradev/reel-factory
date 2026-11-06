FROM python:3.12-slim AS builder

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

RUN curl -fsSL --retry 5 --retry-delay 5 --retry-connrefused \
        "https://github.com/FFmpeg/FFmpeg/archive/refs/tags/n${FFMPEG_VERSION}.tar.gz" -o /tmp/ffmpeg.tar.gz \
    && mkdir -p /tmp/ffmpeg-${FFMPEG_VERSION} \
    && tar -xf /tmp/ffmpeg.tar.gz -C /tmp/ffmpeg-${FFMPEG_VERSION} --strip-components=1 \
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

FROM python:3.12-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
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