FROM video-pipeline-base-python:latest

# Silence cutter container — inherits Python 3.12 + FFmpeg 7.1.1 from base-python.
# Per D-02: FFmpeg silencedetect runs for candidate detection.
# Per D-03: Whisper no_speech_prob confirms silence candidates.
# No GPU needed — CPU-only FFmpeg processing.

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY main.py .

CMD ["python", "main.py"]