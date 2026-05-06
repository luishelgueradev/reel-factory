FROM video-pipeline-base-python:latest

# Whisper transcription container — inherits Python 3.12 + FFmpeg 7.1.1 from base-python.
# Per D-03: GPU is required. NVIDIA Container Toolkit provides CUDA at runtime.
# Per D-06: Audio extraction (FFmpeg) runs inside this container.

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY main.py .

CMD ["python", "main.py"]