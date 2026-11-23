# VentureX API (FastAPI). Build from the backend/ folder:  docker build -t venturex-api backend
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    APP_ENV=production

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Run as an unprivileged user. Uploaded files and logs live in writable folders that a
# persistent disk can be mounted over (/app/private_uploads).
RUN useradd --create-home --uid 10001 venturex && \
    mkdir -p /app/private_uploads /app/logs && \
    chown -R venturex /app/private_uploads /app/logs
USER venturex

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/api/health', timeout=4)"

# --proxy-headers: behind the host's load balancer, use the visitor's IP (rate limits).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
