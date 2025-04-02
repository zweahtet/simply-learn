FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app \
    C_FORCE_ROOT=true

WORKDIR /app

# Install system dependencies and cleanup in one layer to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt && \
    rm -rf ~/.cache/pip

# Copy script files
COPY ./compose/local/fastapi/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//g' /entrypoint.sh && chmod +x /entrypoint.sh

COPY ./compose/local/fastapi/start.sh /start.sh
RUN sed -i 's/\r$//g' /start.sh && chmod +x /start.sh

COPY ./compose/local/fastapi/celery/worker/start.sh /start-celery-worker.sh
RUN sed -i 's/\r$//g' /start-celery-worker.sh && chmod +x /start-celery-worker.sh

COPY ./compose/local/fastapi/celery/beat/start.sh /start-celery-beat.sh
RUN sed -i 's/\r$//g' /start-celery-beat.sh && chmod +x /start-celery-beat.sh

COPY ./compose/local/fastapi/celery/flower/start.sh /start-celery-flower.sh
RUN sed -i 's/\r$//g' /start-celery-flower.sh && chmod +x /start-celery-flower.sh

# Clean up pyc files to reduce memory footprint
RUN find /app -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find /app -name "*.pyc" -delete

# Create and configure directories that might cause issues if not present
RUN mkdir -p /app/logs /app/temp_files /app/fastembed_models && \
    chmod -R 777 /app/logs /app/temp_files /app/fastembed_models

# Command to run the application
ENTRYPOINT ["/entrypoint.sh"]