ARG FFMPEG_VERSION=7.1.1

FROM python:3.12-slim AS base

ARG FFMPEG_VERSION

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        xz-utils \
        ca-certificates \
      && curl -L "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" -o /tmp/ffmpeg.tar.xz \
      && tar -xf /tmp/ffmpeg.tar.xz -C /tmp \
      && cp /tmp/ffmpeg-${FFMPEG_VERSION}-amd64-static/ffmpeg /usr/local/bin/ \
      && cp /tmp/ffmpeg-${FFMPEG_VERSION}-amd64-static/ffprobe /usr/local/bin/ \
      && chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe \
      && rm -rf /tmp/ffmpeg* \
      && apt-get purge -y curl xz-utils \
      && apt-get autoremove -y \
      && apt-get clean \
      && rm -rf /var/lib/apt/lists/*

RUN ffmpeg -version | head -1 && ffprobe -version | head -1

RUN mkdir -p /data/pipeline

WORKDIR /app

CMD ["python", "main.py"]